// scripts/conclave-core/types.ts
// Shared types for the advisor adapter layer. Concrete adapters live in ./adapters/.

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
}

export interface AdvisorSessionState {
	advisorId: AdvisorId;
	provider: ProviderId;
	threadId?: string;
	sessionId?: string;
	previousResponseId?: string;
	model?: string;
	firstSeenAt: string;
	updatedAt: string;
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
