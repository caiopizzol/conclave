// CLAUDECODE=0 is set in the env to prevent the spawned process from
// detecting that it's running inside Claude Code (which would otherwise
// trigger recursive harness behavior). Config-supplied env (e.g., for
// Ollama-routed Claude CLI) is merged in after the inherited environment.

import { findSensitiveValues, sanitize } from "../sanitize.ts";
import { advisorFingerprint } from "../state.ts";
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
		const sensitive = findSensitiveValues(this.config.env);
		try {
			const cmd = this.buildCommand(prior);
			const prompt = this.buildPrompt(req);

			const proc = Bun.spawn({
				cmd,
				cwd: req.worktreeRoot,
				env: { ...process.env, CLAUDECODE: "0", ...(this.config.env ?? {}) },
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
				// Sanitize BEFORE slicing tail so a redacted value can't survive
				// truncation as a partial leak.
				const cleaned = sanitize(stderrText || stdoutText, sensitive);
				const tail = cleaned.trim().split("\n").slice(-5).join("\n");
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
					error: `claude --print output was not valid JSON: ${sanitize((e as Error).message, sensitive)}`,
				};
			}

			if (parsed.is_error || parsed.subtype !== "success") {
				return {
					ok: false,
					advisorId: this.id,
					model: this.config.model,
					durationMs: Date.now() - started,
					error: sanitize(
						parsed.result ?? `claude returned non-success subtype: ${parsed.subtype ?? "unknown"}`,
						sensitive,
					),
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
							fingerprint: advisorFingerprint(this.config),
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
				error: sanitize((e as Error).message || String(e), sensitive),
			};
		}
	}

	private buildCommand(prior: AdvisorSessionState | undefined): string[] {
		const base = ["claude", "--print", "--output-format", "json"];
		if (prior?.sessionId) {
			base.push("--resume", prior.sessionId);
			// Custom Anthropic-compatible endpoints (Ollama, etc.) require
			// --model on every call, because resume otherwise defaults the
			// model to claude-sonnet-* which the custom endpoint won't have.
			if (this.config.passModelOnResume && this.config.model) {
				base.push("--model", this.config.model);
			}
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
