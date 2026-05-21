#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { ClaudeCliAdvisor } from "../core/adapters/claude-cli.ts";
import { CodexExecAdvisor } from "../core/adapters/codex-exec.ts";
import { ConfigError, loadConfig, type ResolvedConfig } from "../core/config.ts";
import {
	advisorFingerprint,
	detectWorktreeRoot,
	generateRunId,
	loadState,
	saveState,
	writeRunRecord,
} from "../core/state.ts";
import type { Advisor, AdvisorConfig, RunRecord } from "../core/types.ts";

interface CliArgs {
	sessionId?: string;
	question?: string;
	questionFile?: string;
	advisors?: string;
	includeFiles?: string;
	includeDiff?: boolean;
	listAdvisors?: boolean;
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
			case "--list-advisors":
				out.listAdvisors = true;
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
	process.stderr.write(`conclave consult: ${msg}\n`);
	process.exit(code);
}

function makeAdvisor(config: AdvisorConfig): Advisor {
	switch (config.provider) {
		case "codex-exec":
			return new CodexExecAdvisor(config);
		case "claude-cli":
			return new ClaudeCliAdvisor(config);
		default:
			die(`provider not implemented: ${config.provider}`);
	}
}

function readQuestion(args: CliArgs): string {
	if (args.questionFile) return readFileSync(args.questionFile, "utf8").trim();
	if (args.question) return args.question.trim();
	return readFileSync(0, "utf8").trim();
}

function formatMarkdown(record: RunRecord, notes: Map<string, string>): string {
	const lines: string[] = [];
	lines.push("# Conclave advisory run");
	lines.push("");
	lines.push(`- run: ${record.runId}`);
	lines.push(`- worktree: ${record.worktreeRoot}`);
	lines.push(`- advisors: ${record.advisorResults.map((r) => r.advisorId).join(", ")}`);
	lines.push("");
	for (const r of record.advisorResults) {
		lines.push(`## ${r.advisorId}${r.model ? ` (${r.model})` : ""}`);
		const note = notes.get(r.advisorId);
		if (note) lines.push(`- ${note}`);
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

function listAdvisors(resolved: ResolvedConfig): string {
	const lines: string[] = [];
	lines.push("# Conclave advisors (resolved)");
	lines.push("");
	lines.push(`- config: ${resolved.configPath ?? "(no user config)"}`);
	lines.push(`- defaults: ${resolved.defaultAdvisors.join(", ") || "(none)"}`);
	lines.push("");
	lines.push("## Available advisors");
	lines.push("");
	for (const [id, c] of resolved.advisors) {
		const envFlag = c.env && Object.keys(c.env).length > 0 ? "yes" : "no";
		const resumePolicy = c.passModelOnResume ? "always" : "inherit";
		lines.push(
			`- **${id}** - provider=${c.provider}, model=${c.model ?? "(default)"}, env=${envFlag}, passModelOnResume=${resumePolicy}`,
		);
		if (c.description) lines.push(`  - ${c.description}`);
	}
	return `${lines.join("\n")}\n`;
}

const HELP = `Usage:
  consult.ts --session-id <id> [options]
  consult.ts --list-advisors

Reads the question from --question, --question-file, or stdin (in that order).

Options:
  --session-id <id>       Claude Code session ID (use \${CLAUDE_SESSION_ID})
  --question <text>       Inline question
  --question-file <path>  Read question from a file
  --advisors <list>       Comma-separated advisor IDs (default: from config)
  --include-files <list>  Comma-separated file paths to flag as relevant
  --include-diff          Hint that uncommitted changes are relevant
  --list-advisors         Print resolved advisor roster and exit
  -h, --help              Show this message

Config: ~/.config/conclave/advisors.json (optional; built-in codex+claude always available)
State:  ~/.local/state/conclave/sessions/{sessionId}-{worktreeHash}.json
Audit:  ~/.local/state/conclave/runs/{runId}.json
`;

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		process.stdout.write(HELP);
		return;
	}

	let resolved: ResolvedConfig;
	try {
		resolved = loadConfig();
	} catch (e) {
		if (e instanceof ConfigError) die(e.message);
		throw e;
	}

	if (args.listAdvisors) {
		process.stdout.write(listAdvisors(resolved));
		return;
	}

	if (!args.sessionId) die("--session-id required");
	const question = readQuestion(args);
	if (!question) die("question is empty");

	const cwd = process.cwd();
	const worktreeRoot = detectWorktreeRoot(cwd);
	const state = loadState(args.sessionId, worktreeRoot);

	const advisorIds = args.advisors
		? args.advisors
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: resolved.defaultAdvisors;
	if (advisorIds.length === 0)
		die("no advisors selected (config defaults empty and no --advisors)");

	const advisorPairs = advisorIds.map((id) => {
		const config = resolved.advisors.get(id);
		if (!config) {
			die(`unknown advisor: ${id} (available: ${[...resolved.advisors.keys()].join(", ")})`);
		}
		return { id, config, advisor: makeAdvisor(config) };
	});

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
	const notes = new Map<string, string>();

	for (const { id, config, advisor } of advisorPairs) {
		const prior = state.advisors[id];
		const currentFp = advisorFingerprint(config);

		// Fingerprint check: missing prior fingerprint is gentle migration
		// (accept resume). Present-and-mismatched starts a fresh session
		// and preserves the prior state until the fresh call succeeds.
		const fingerprintMismatch = prior?.fingerprint !== undefined && prior.fingerprint !== currentFp;

		const priorForCall = fingerprintMismatch ? undefined : prior;

		if (fingerprintMismatch) {
			notes.set(
				id,
				"advisor configuration changed since last session; started a fresh session instead of resuming the previous one.",
			);
		}

		const r = await advisor.ask(askReq, priorForCall);
		results.push(r);

		// Save advisor session state only when the call actually produced new
		// session fields. On fingerprint-mismatch + failed-fresh, the prior
		// entry stays intact so a transient error doesn't destroy continuity.
		if (r.ok && r.newSessionFields) {
			state.advisors[id] = r.newSessionFields;
			saveState(state);
		}

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

	process.stdout.write(formatMarkdown(record, notes));
}

main().catch((e) => {
	process.stderr.write(`conclave consult: ${(e as Error).message}\n`);
	process.exit(1);
});
