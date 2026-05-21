// scripts/conclave-core/adapters/codex-exec.ts
// Codex advisor over `codex exec` (and `codex exec resume`).
//
// Why not codex mcp-server: the mcp-server's threadId is process-bound. Each
// new server process has its own in-memory registry, so a threadId minted in
// process A cannot be resumed by process B even though the rollout exists on
// disk. `codex exec resume <id>` reads from disk and works across processes,
// which is what we need for the persistent-advisor use case.

import type {
	Advisor,
	AdvisorConfig,
	AdvisorResponse,
	AdvisorSessionState,
	AskRequest,
} from "../types.ts";

interface CodexJsonEvent {
	type: string;
	thread_id?: string;
	item?: { id?: string; type?: string; text?: string };
	usage?: unknown;
}

export class CodexExecAdvisor implements Advisor {
	readonly id: string;
	readonly config: AdvisorConfig;

	constructor(config: AdvisorConfig) {
		this.id = config.id;
		this.config = config;
	}

	async ask(req: AskRequest, prior: AdvisorSessionState | undefined): Promise<AdvisorResponse> {
		const started = Date.now();
		try {
			const cmd = this.buildCommand(prior);
			const prompt = this.buildPrompt(req);

			const proc = Bun.spawn({
				cmd,
				cwd: req.worktreeRoot,
				stdin: "pipe",
				stdout: "pipe",
				stderr: "pipe",
			});
			proc.stdin.write(prompt);
			proc.stdin.end();

			const [stdoutText, stderrText, exitCode] = await Promise.all([
				new Response(proc.stdout).text(),
				new Response(proc.stderr).text(),
				proc.exited,
			]);

			if (exitCode !== 0) {
				const tail = (stderrText || stdoutText).trim().split("\n").slice(-5).join("\n");
				return {
					ok: false,
					advisorId: this.id,
					model: this.config.model,
					durationMs: Date.now() - started,
					error: `codex exec exited ${exitCode}: ${tail.slice(0, 500)}`,
				};
			}

			const { threadId, agentText } = parseJsonlStream(stdoutText);
			if (!agentText) {
				return {
					ok: false,
					advisorId: this.id,
					model: this.config.model,
					durationMs: Date.now() - started,
					error: "no agent_message in codex output",
				};
			}

			const now = new Date().toISOString();
			const effectiveThreadId = threadId ?? prior?.threadId;
			return {
				ok: true,
				advisorId: this.id,
				model: this.config.model,
				content: agentText,
				newSessionFields: effectiveThreadId
					? {
							advisorId: this.id,
							provider: "codex-exec",
							threadId: effectiveThreadId,
							model: this.config.model,
							firstSeenAt: prior?.firstSeenAt ?? now,
							updatedAt: now,
						}
					: undefined,
				durationMs: Date.now() - started,
			};
		} catch (e) {
			return {
				ok: false,
				advisorId: this.id,
				model: this.config.model,
				durationMs: Date.now() - started,
				error: (e as Error).message || String(e),
			};
		}
	}

	private buildCommand(prior: AdvisorSessionState | undefined): string[] {
		// codex exec resume does NOT accept --sandbox or --skip-git-repo-check.
		// Those are first-call only; resumed sessions inherit the original config.
		const base = ["codex", "exec", "--json"];
		if (this.config.model) base.push("-m", this.config.model);
		if (this.config.reasoningEffort) {
			base.push("-c", `model_reasoning_effort="${this.config.reasoningEffort}"`);
		}

		if (prior?.threadId) {
			// resume subcommand: codex exec resume <id> <prompt|->
			return [...base.slice(0, 2), "resume", "--json", prior.threadId, "-"];
		}
		// fresh: codex exec --json --sandbox read-only --skip-git-repo-check -
		return [...base, "--sandbox", "read-only", "--skip-git-repo-check", "-"];
	}

	private buildPrompt(req: AskRequest): string {
		const parts: string[] = [req.question];
		if (req.includeFiles?.length) {
			parts.push("");
			parts.push("Files the caller flagged as relevant (read them yourself if needed):");
			for (const f of req.includeFiles) parts.push(`- ${f}`);
		}
		if (req.includeDiff) {
			parts.push("");
			parts.push(
				"The caller indicated current uncommitted changes are relevant. Run `git diff` if you need to see them.",
			);
		}
		return parts.join("\n");
	}
}

function parseJsonlStream(stdout: string): { threadId?: string; agentText?: string } {
	let threadId: string | undefined;
	let agentText: string | undefined;
	for (const line of stdout.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		let evt: CodexJsonEvent;
		try {
			evt = JSON.parse(trimmed) as CodexJsonEvent;
		} catch {
			continue;
		}
		if (evt.type === "thread.started" && typeof evt.thread_id === "string") {
			threadId = evt.thread_id;
		}
		if (
			evt.type === "item.completed" &&
			evt.item?.type === "agent_message" &&
			typeof evt.item.text === "string"
		) {
			// Multiple agent_message items can appear (intermediate reasoning, etc).
			// The last one is the final answer.
			agentText = evt.item.text;
		}
	}
	return { threadId, agentText };
}
