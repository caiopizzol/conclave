// CLAUDECODE=0 is set in the env to prevent the spawned process from
// detecting that it's running inside Claude Code (which would otherwise
// trigger recursive harness behavior).

import type {
	Advisor,
	AdvisorConfig,
	AdvisorResponse,
	AdvisorSessionState,
	AskRequest,
} from "../types.ts";

interface ClaudePrintResult {
	session_id?: string;
	result?: string;
	is_error?: boolean;
	subtype?: string;
}

export class ClaudeCliAdvisor implements Advisor {
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
				env: { ...process.env, CLAUDECODE: "0" },
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
					error: `claude --print exited ${exitCode}: ${tail.slice(0, 500)}`,
				};
			}

			let parsed: ClaudePrintResult;
			try {
				parsed = JSON.parse(stdoutText.trim()) as ClaudePrintResult;
			} catch (e) {
				return {
					ok: false,
					advisorId: this.id,
					model: this.config.model,
					durationMs: Date.now() - started,
					error: `claude --print output was not valid JSON: ${(e as Error).message}`,
				};
			}

			if (parsed.is_error || parsed.subtype !== "success") {
				return {
					ok: false,
					advisorId: this.id,
					model: this.config.model,
					durationMs: Date.now() - started,
					error:
						parsed.result ?? `claude returned non-success subtype: ${parsed.subtype ?? "unknown"}`,
				};
			}

			if (!parsed.result) {
				return {
					ok: false,
					advisorId: this.id,
					model: this.config.model,
					durationMs: Date.now() - started,
					error: "claude --print returned no result field",
				};
			}

			const now = new Date().toISOString();
			const sessionId = parsed.session_id ?? prior?.sessionId;
			return {
				ok: true,
				advisorId: this.id,
				model: this.config.model,
				content: parsed.result,
				newSessionFields: sessionId
					? {
							advisorId: this.id,
							provider: "claude-cli",
							sessionId,
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
		const base = ["claude", "--print", "--output-format", "json"];
		if (prior?.sessionId) {
			// Resume inherits model/settings from the original session.
			base.push("--resume", prior.sessionId);
		} else if (this.config.model) {
			base.push("--model", this.config.model);
		}
		return base;
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
