export type AdvisorId = string;

export type ProviderId =
	| "codex-exec"
	| "codex-mcp"
	| "claude-cli"
	| "claude-sdk"
	| "openai-responses"
	| "cli-oneshot";

export interface AdvisorConfig {
	id: AdvisorId;
	provider: ProviderId;
	model?: string;
	reasoningEffort?: string;
	description?: string;
	// Runtime-only env vars passed to the spawned advisor process (e.g., to
	// route claude-cli through Ollama). NEVER persisted to state or audit
	// logs; values matching sensitive key patterns are redacted from errors.
	env?: Record<string, string>;
	// When true, the adapter passes --model on resume in addition to the
	// session id. Required for advisors backed by custom Anthropic-compatible
	// endpoints (e.g., Ollama-routed Claude CLI), where omitting --model
	// causes the CLI to default to the wrong model and 404.
	passModelOnResume?: boolean;
}

export interface AdvisorSessionState {
	advisorId: AdvisorId;
	provider: ProviderId;
	threadId?: string;
	sessionId?: string;
	previousResponseId?: string;
	model?: string;
	// SHA-256 prefix of {provider, model, passModelOnResume, base-URL}. Used
	// to detect config drift between calls. Missing on state from older
	// versions; treated as "accept resume" (gentle migration).
	fingerprint?: string;
	firstSeenAt: string;
	updatedAt: string;
}

// User-supplied config from ~/.config/conclave/advisors.json. The `id` is
// the map key in `advisors`; not duplicated in the value. Built-in advisor
// IDs ("codex", "claude") cannot be redefined.
export interface UserAdvisorEntry {
	provider: ProviderId;
	model?: string;
	reasoningEffort?: string;
	description?: string;
	env?: Record<string, string>;
	passModelOnResume?: boolean;
}

export interface UserConfig {
	defaultAdvisors?: AdvisorId[];
	advisors?: Record<AdvisorId, UserAdvisorEntry>;
}

export interface ConversationState {
	schema: 1;
	executor: { provider: "claude-code"; sessionId: string };
	worktreeRoot: string;
	worktreeHash: string;
	cwd: string;
	advisors: Record<AdvisorId, AdvisorSessionState>;
	createdAt: string;
	updatedAt: string;
}

export interface AskRequest {
	question: string;
	worktreeRoot: string;
	includeFiles?: string[];
	includeDiff?: boolean;
}

export interface AdvisorResponse {
	ok: boolean;
	advisorId: AdvisorId;
	model?: string;
	content?: string;
	newSessionFields?: AdvisorSessionState;
	durationMs: number;
	error?: string;
}

export interface Advisor {
	readonly id: AdvisorId;
	readonly config: AdvisorConfig;
	ask(req: AskRequest, prior: AdvisorSessionState | undefined): Promise<AdvisorResponse>;
	close?(): Promise<void>;
}

export interface RunRecord {
	schema: 1;
	runId: string;
	startedAt: string;
	finishedAt: string;
	executorSessionId: string;
	worktreeRoot: string;
	question: string;
	advisorResults: AdvisorResponse[];
}
