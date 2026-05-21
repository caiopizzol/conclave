#!/usr/bin/env bun
// scripts/conclave-advise.ts
// CLI entry for persistent advisor consultation. Called by the /consult skill.

import { readFileSync } from "node:fs";
import { ClaudeCliAdvisor } from "./conclave-core/adapters/claude-cli.ts";
import { CodexExecAdvisor } from "./conclave-core/adapters/codex-exec.ts";
import {
	detectWorktreeRoot,
	generateRunId,
	loadState,
	saveState,
	writeRunRecord,
} from "./conclave-core/state.ts";
import type { Advisor, AdvisorConfig, RunRecord } from "./conclave-core/types.ts";

interface CliArgs {
	sessionId?: string;
	question?: string;
	questionFile?: string;
	advisors?: string;
	includeFiles?: string;
	includeDiff?: boolean;
	help?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
	const out: CliArgs = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		switch (a) {
			case "--session-id":
				out.sessionId = argv[++i];
				break;
			case "--question":
				out.question = argv[++i];
				break;
			case "--question-file":
				out.questionFile = argv[++i];
				break;
			case "--advisors":
				out.advisors = argv[++i];
				break;
			case "--include-files":
				out.includeFiles = argv[++i];
				break;
			case "--include-diff":
				out.includeDiff = true;
				break;
			case "-h":
			case "--help":
				out.help = true;
				break;
		}
	}
	return out;
}

function die(msg: string, code = 1): never {
	process.stderr.write(`conclave-advise: ${msg}\n`);
	process.exit(code);
}

// Hardcoded advisor defaults for v1.0. Move to ~/.config/conclave/advisors.json
// once there's an actual second advisor to choose between.
function defaultAdvisorConfig(id: string): AdvisorConfig {
	if (id === "codex") {
		return {
			id: "codex",
			provider: "codex-exec",
			model: "gpt-5.3-codex",
			reasoningEffort: "xhigh",
			description: "OpenAI Codex via `codex exec resume` (persistent across processes).",
		};
	}
	if (id === "claude") {
		return {
			id: "claude",
			provider: "claude-cli",
			model: "opus",
			description: "Claude via `claude --print --resume` (persistent across processes).",
		};
	}
	die(`unknown advisor: ${id} (v1 supports: codex, claude)`);
}

function makeAdvisor(config: AdvisorConfig): Advisor {
	switch (config.provider) {
		case "codex-exec":
			return new CodexExecAdvisor(config);
		case "claude-cli":
			return new ClaudeCliAdvisor(config);
		default:
			die(`provider not implemented in v1: ${config.provider}`);
	}
}

function readQuestion(args: CliArgs): string {
	if (args.questionFile) return readFileSync(args.questionFile, "utf8").trim();
	if (args.question) return args.question.trim();
	return readFileSync(0, "utf8").trim();
}

function formatMarkdown(record: RunRecord): string {
	const lines: string[] = [];
	lines.push("# Conclave advisory run");
	lines.push("");
	lines.push(`- run: ${record.runId}`);
	lines.push(`- worktree: ${record.worktreeRoot}`);
	lines.push(`- advisors: ${record.advisorResults.map((r) => r.advisorId).join(", ")}`);
	lines.push("");
	for (const r of record.advisorResults) {
		lines.push(`## ${r.advisorId}${r.model ? ` (${r.model})` : ""}`);
		if (r.ok) {
			lines.push(`- duration: ${(r.durationMs / 1000).toFixed(1)}s`);
			lines.push("");
			lines.push(r.content?.trim() || "(empty response)");
		} else {
			lines.push(
				`- **FAILED** after ${(r.durationMs / 1000).toFixed(1)}s: ${r.error ?? "unknown error"}`,
			);
		}
		lines.push("");
	}
	return lines.join("\n");
}

const HELP = `Usage:
  conclave-advise.ts --session-id <id> [options]

Reads the question from --question, --question-file, or stdin (in that order).

Options:
  --session-id <id>       Claude Code session ID (use \${CLAUDE_SESSION_ID})
  --question <text>       Inline question
  --question-file <path>  Read question from a file
  --advisors <list>       Comma-separated advisor IDs (default: codex)
  --include-files <list>  Comma-separated file paths to flag as relevant
  --include-diff          Hint that uncommitted changes are relevant
  -h, --help              Show this message

State:  ~/.local/state/conclave/sessions/{sessionId}-{worktreeHash}.json
Audit:  ~/.local/state/conclave/runs/{runId}.json
`;

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		process.stdout.write(HELP);
		return;
	}
	if (!args.sessionId) die("--session-id required");

	const question = readQuestion(args);
	if (!question) die("question is empty");

	const cwd = process.cwd();
	const worktreeRoot = detectWorktreeRoot(cwd);
	const state = loadState(args.sessionId, worktreeRoot);

	const advisorIds = (args.advisors ?? "codex")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const advisors = advisorIds.map((id) => makeAdvisor(defaultAdvisorConfig(id)));

	const runId = generateRunId();
	const startedAt = new Date().toISOString();
	const includeFiles = args.includeFiles
		?.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	const askReq = {
		question,
		worktreeRoot,
		includeFiles,
		includeDiff: args.includeDiff,
	};

	const results = [];
	for (const advisor of advisors) {
		const prior = state.advisors[advisor.id];
		const r = await advisor.ask(askReq, prior);
		if (r.ok && r.newSessionFields) {
			state.advisors[advisor.id] = r.newSessionFields;
			saveState(state);
		}
		results.push(r);
		if (advisor.close) await advisor.close();
	}

	const record: RunRecord = {
		schema: 1,
		runId,
		startedAt,
		finishedAt: new Date().toISOString(),
		executorSessionId: args.sessionId,
		worktreeRoot,
		question,
		advisorResults: results,
	};
	writeRunRecord(record);

	process.stdout.write(formatMarkdown(record));
}

main().catch((e) => {
	process.stderr.write(`conclave-advise: ${(e as Error).message}\n`);
	process.exit(1);
});
