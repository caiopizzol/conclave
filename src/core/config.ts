// Resolve the effective advisor roster by merging built-in defaults with
// the user's ~/.config/conclave/advisors.json (if present).
//
// Built-in IDs ("codex", "claude") are immutable: user config cannot
// redefine them, only add new advisor IDs. Strict validation by design:
// unknown top-level keys or unknown advisor entry fields fail loudly.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AdvisorConfig, AdvisorId, ProviderId, UserConfig } from "./types.ts";

const BUILTIN_IDS: ReadonlySet<AdvisorId> = new Set(["codex", "claude"]);

// Only providers that have a concrete adapter implementation today. The
// ProviderId type union in types.ts is deliberately broader (it's the
// type space for future providers), but config validation must reject
// names that aren't yet wired through makeAdvisor() — otherwise users
// hit a runtime failure after passing strict validation, which defeats
// the purpose. Extend this set when a new adapter ships.
const IMPLEMENTED_PROVIDERS: ReadonlySet<ProviderId> = new Set(["codex-exec", "claude-cli"]);

export interface ResolvedConfig {
	advisors: Map<AdvisorId, AdvisorConfig>;
	defaultAdvisors: AdvisorId[];
	configPath?: string;
}

function builtinAdvisors(): Map<AdvisorId, AdvisorConfig> {
	const m = new Map<AdvisorId, AdvisorConfig>();
	m.set("codex", {
		id: "codex",
		provider: "codex-exec",
		model: "gpt-5.3-codex",
		reasoningEffort: "xhigh",
		description: "OpenAI Codex via `codex exec resume` (persistent across processes).",
	});
	m.set("claude", {
		id: "claude",
		provider: "claude-cli",
		model: "opus",
		description: "Claude via `claude --print --resume` (persistent across processes).",
	});
	return m;
}

function configPath(): string {
	const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(xdgConfig, "conclave", "advisors.json");
}

class ConfigError extends Error {}

const ALLOWED_TOP_KEYS = new Set(["defaultAdvisors", "advisors"]);
const ALLOWED_ENTRY_KEYS = new Set([
	"provider",
	"model",
	"reasoningEffort",
	"description",
	"env",
	"passModelOnResume",
]);

function validate(raw: unknown, path: string): UserConfig {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
		throw new ConfigError(`${path}: top-level value must be a JSON object`);
	}
	const obj = raw as Record<string, unknown>;
	for (const k of Object.keys(obj)) {
		if (!ALLOWED_TOP_KEYS.has(k)) {
			throw new ConfigError(`${path}: unknown top-level key "${k}"`);
		}
	}

	const out: UserConfig = {};

	if (obj.defaultAdvisors !== undefined) {
		if (!Array.isArray(obj.defaultAdvisors)) {
			throw new ConfigError(`${path}: "defaultAdvisors" must be an array of strings`);
		}
		for (const id of obj.defaultAdvisors) {
			if (typeof id !== "string" || !id) {
				throw new ConfigError(`${path}: "defaultAdvisors" entries must be non-empty strings`);
			}
		}
		out.defaultAdvisors = obj.defaultAdvisors as string[];
	}

	if (obj.advisors !== undefined) {
		if (obj.advisors === null || typeof obj.advisors !== "object" || Array.isArray(obj.advisors)) {
			throw new ConfigError(`${path}: "advisors" must be a JSON object`);
		}
		const advisors = obj.advisors as Record<string, unknown>;
		out.advisors = {};
		for (const [id, entry] of Object.entries(advisors)) {
			if (BUILTIN_IDS.has(id)) {
				throw new ConfigError(
					`${path}: built-in advisor "${id}" cannot be redefined by user config`,
				);
			}
			if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
				throw new ConfigError(`${path}: advisors.${id} must be a JSON object`);
			}
			const e = entry as Record<string, unknown>;
			for (const k of Object.keys(e)) {
				if (!ALLOWED_ENTRY_KEYS.has(k)) {
					throw new ConfigError(`${path}: advisors.${id}: unknown field "${k}"`);
				}
			}
			if (typeof e.provider !== "string" || !IMPLEMENTED_PROVIDERS.has(e.provider as ProviderId)) {
				throw new ConfigError(
					`${path}: advisors.${id}.provider must be one of: ${[...IMPLEMENTED_PROVIDERS].join(", ")}`,
				);
			}
			if (e.model !== undefined && typeof e.model !== "string") {
				throw new ConfigError(`${path}: advisors.${id}.model must be a string`);
			}
			if (e.reasoningEffort !== undefined && typeof e.reasoningEffort !== "string") {
				throw new ConfigError(`${path}: advisors.${id}.reasoningEffort must be a string`);
			}
			if (e.description !== undefined && typeof e.description !== "string") {
				throw new ConfigError(`${path}: advisors.${id}.description must be a string`);
			}
			if (e.passModelOnResume !== undefined && typeof e.passModelOnResume !== "boolean") {
				throw new ConfigError(`${path}: advisors.${id}.passModelOnResume must be a boolean`);
			}
			if (e.env !== undefined) {
				if (e.env === null || typeof e.env !== "object" || Array.isArray(e.env)) {
					throw new ConfigError(`${path}: advisors.${id}.env must be a JSON object`);
				}
				for (const [k, v] of Object.entries(e.env as Record<string, unknown>)) {
					if (typeof v !== "string") {
						throw new ConfigError(
							`${path}: advisors.${id}.env.${k} must be a string (got ${typeof v})`,
						);
					}
				}
			}
			out.advisors[id] = {
				provider: e.provider as ProviderId,
				model: e.model as string | undefined,
				reasoningEffort: e.reasoningEffort as string | undefined,
				description: e.description as string | undefined,
				env: e.env as Record<string, string> | undefined,
				passModelOnResume: e.passModelOnResume as boolean | undefined,
			};
		}
	}

	return out;
}

export function loadConfig(): ResolvedConfig {
	const advisors = builtinAdvisors();
	const path = configPath();

	if (!existsSync(path)) {
		return {
			advisors,
			defaultAdvisors: ["codex", "claude"],
		};
	}

	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, "utf8"));
	} catch (e) {
		throw new ConfigError(`${path}: invalid JSON: ${(e as Error).message}`);
	}

	const user = validate(raw, path);

	if (user.advisors) {
		for (const [id, entry] of Object.entries(user.advisors)) {
			advisors.set(id, { id, ...entry });
		}
	}

	const defaults = user.defaultAdvisors ?? ["codex", "claude"];
	for (const id of defaults) {
		if (!advisors.has(id)) {
			throw new ConfigError(`${path}: defaultAdvisors includes unknown advisor "${id}"`);
		}
	}

	return {
		advisors,
		defaultAdvisors: defaults,
		configPath: path,
	};
}

export { ConfigError };
