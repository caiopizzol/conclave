import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AdvisorConfig, ConversationState, RunRecord } from "./types.ts";

function xdgStateHome(): string {
	return process.env.XDG_STATE_HOME || join(homedir(), ".local/state");
}

function root(): string {
	return join(xdgStateHome(), "conclave");
}

export function sessionsDir(): string {
	const d = join(root(), "sessions");
	mkdirSync(d, { recursive: true });
	return d;
}

export function runsDir(): string {
	const d = join(root(), "runs");
	mkdirSync(d, { recursive: true });
	return d;
}

export function detectWorktreeRoot(cwd: string): string {
	try {
		const top = execSync("git rev-parse --show-toplevel", {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim();
		return realpathSync(top);
	} catch {
		return realpathSync(cwd);
	}
}

export function worktreeHash(rootPath: string): string {
	return createHash("sha256").update(rootPath).digest("hex").slice(0, 12);
}

// Identity hash for an advisor configuration. Used to detect drift between
// the config that minted a session and the current config. Includes only
// non-secret runtime identity; never env values.
export function advisorFingerprint(config: AdvisorConfig): string {
	const baseUrl = config.env?.ANTHROPIC_BASE_URL ?? config.env?.OPENAI_BASE_URL ?? "";
	const parts = [
		config.provider,
		config.model ?? "",
		config.passModelOnResume ? "1" : "0",
		baseUrl,
	];
	return createHash("sha256").update(parts.join("\x00")).digest("hex").slice(0, 16);
}

function statePath(sessionId: string, hash: string): string {
	return join(sessionsDir(), `${sessionId}-${hash}.json`);
}

export function loadState(sessionId: string, worktreeRoot: string): ConversationState {
	const hash = worktreeHash(worktreeRoot);
	const path = statePath(sessionId, hash);
	if (existsSync(path)) {
		try {
			const parsed = JSON.parse(readFileSync(path, "utf8")) as ConversationState;
			if (parsed.schema === 1) return parsed;
		} catch {
			// fall through to fresh state
		}
	}
	const now = new Date().toISOString();
	return {
		schema: 1,
		executor: { provider: "claude-code", sessionId },
		worktreeRoot,
		worktreeHash: hash,
		cwd: process.cwd(),
		advisors: {},
		createdAt: now,
		updatedAt: now,
	};
}

function atomicWrite(path: string, body: string): void {
	const tmp = `${path}.tmp.${process.pid}`;
	writeFileSync(tmp, body);
	renameSync(tmp, path);
}

export function saveState(state: ConversationState): void {
	state.updatedAt = new Date().toISOString();
	atomicWrite(
		statePath(state.executor.sessionId, state.worktreeHash),
		JSON.stringify(state, null, 2),
	);
}

export function generateRunId(): string {
	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const rand = Math.random().toString(36).slice(2, 8);
	return `${ts}-${rand}`;
}

export function writeRunRecord(record: RunRecord): string {
	const path = join(runsDir(), `${record.runId}.json`);
	atomicWrite(path, JSON.stringify(record, null, 2));
	return path;
}
