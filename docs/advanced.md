# Advanced

Architecture and adapter contract for conclave. For setup and usage, see the [README](../README.md).

## Architecture

```
conclave/
├── src/
│   ├── core/                        # the harness (shared, recipe-agnostic)
│   │   ├── types.ts                 # Advisor interface, state shapes
│   │   ├── state.ts                 # XDG state, atomic writes, run audit
│   │   ├── mcp-client.ts            # Stdio MCP client (reserved for future MCP-backed adapters)
│   │   └── adapters/
│   │       ├── codex-exec.ts        # Codex via `codex exec resume`
│   │       └── claude-cli.ts        # Claude via `claude --print --resume`
│   └── recipes/
│       └── consult.ts               # /consult recipe entry, imports from ../core/
├── skills/
│   └── consult/
│       └── SKILL.md                 # Claude Code skill UX surface
├── scripts/
│   ├── register.sh                  # Bundles src/recipes/consult.ts and installs the skill
│   └── unregister.sh
└── docs/
    └── advanced.md                  # This file
```

**Conclave is the console.** `src/core/` is the reusable harness: provider adapters, state store, run audit, MCP client (held for adapters that need it). It is recipe-agnostic.

**`/consult` is the first recipe.** `src/recipes/consult.ts` is its CLI entry. It imports from `../core/` and ships its own SKILL.md under `skills/consult/`. Future recipes (review, investigation, planning) would live alongside as siblings under `src/recipes/`, each with their own SKILL.md.

**The installed skill is self-contained.** `register.sh` uses Bun's bundler to inline all of `src/core/` into the recipe entry and write a single file at `~/.claude/skills/consult/scripts/consult.js`. The installed skill needs no other files and does not depend on the repo's path on disk. Re-run `bun run register` after pulling new conclave changes to refresh the bundle.

## Why provider-native resume

Advisors keep their own context via each vendor's documented non-interactive resume primitive:

- **Codex**: `codex exec resume <SESSION_ID> --json`. The session ID comes from a `thread.started` event on the first call's JSONL stream. Persists at `~/.codex/sessions/`.
- **Claude**: `claude --print --resume <SESSION_ID> --output-format json`. The session ID comes from the result JSON's `session_id` field. Persists via Claude Code's session store.

This means conclave does not maintain its own conversation transcripts for advisors. Each advisor's history is owned by its vendor's tooling. Conclave's only state is the mapping from `{claudeSessionId, worktreeHash}` to advisor session IDs.

### Why not `codex mcp-server`

OpenAI documents `codex mcp-server` as an MCP-server entry point with `codex` and `codex-reply` tools. Initial design used it. Discovered mid-implementation: the `threadId` returned by `codex mcp-server` is process-bound. Each fresh server process has its own in-memory thread registry. A `threadId` minted in process A returns `Session not found` in process B, even though the rollout exists on disk.

Per-invocation helpers cannot use `codex mcp-server` for persistent advisors without a long-lived daemon. `codex exec resume` reads from disk and works across processes, which is what `/consult` needs.

`mcp-client.ts` is retained in `src/core/` for future adapters that need MCP-based transports (e.g., consuming third-party MCP servers from inside an advisor adapter).

## State

Two files per consultation:

**Advisor session map** at `~/.local/state/conclave/sessions/{claudeSessionId}-{worktreeHash}.json`:

```json
{
  "schema": 1,
  "executor": { "provider": "claude-code", "sessionId": "..." },
  "worktreeRoot": "/abs/path/to/worktree",
  "worktreeHash": "abc123def456",
  "cwd": "...",
  "advisors": {
    "codex": { "provider": "codex-exec", "threadId": "...", "model": "...", "firstSeenAt": "...", "updatedAt": "..." },
    "claude": { "provider": "claude-cli", "sessionId": "...", "model": "...", "firstSeenAt": "...", "updatedAt": "..." }
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

The key is `{claudeSessionId, worktreeHash}` because Claude Code can resume the same session in a different cwd (e.g., across git worktrees). Hashing on `realpath(git rev-parse --show-toplevel || pwd)` prevents the same Claude session from accidentally reusing an advisor thread tied to a different repo or worktree.

**Per-run audit** at `~/.local/state/conclave/runs/{runId}.json`:

```json
{
  "schema": 1,
  "runId": "...",
  "startedAt": "...",
  "finishedAt": "...",
  "executorSessionId": "...",
  "worktreeRoot": "...",
  "question": "...",
  "advisorResults": [{ "ok": true, "advisorId": "codex", "content": "...", "newSessionFields": { ... }, "durationMs": 8323 }]
}
```

Audit logs are append-only. They exist so you can inspect what conclave actually asked, which advisor answered, how long it took, and what came back. Native session resume is continuity; the audit log is observability.

## Adapter contract

```ts
interface Advisor {
  readonly id: AdvisorId;
  readonly config: AdvisorConfig;
  ask(req: AskRequest, prior: AdvisorSessionState | undefined): Promise<AdvisorResponse>;
  close?(): Promise<void>;
}
```

`ask()` receives:
- `req.question` - the user's question
- `req.worktreeRoot` - absolute path the advisor should treat as its cwd
- `req.includeFiles` - optional list of file paths the caller flagged as relevant
- `req.includeDiff` - optional flag that uncommitted changes are relevant
- `prior` - the advisor's prior session state for this worktree, if any

Returns `AdvisorResponse`:
- `ok` - boolean
- `content` - the advisor's text response (markdown allowed)
- `newSessionFields` - the new advisor session state to persist (with the vendor's session/thread ID)
- `durationMs`, `error` - audit/telemetry

The adapter is responsible for:
1. Translating `prior?.threadId` (or `prior?.sessionId`) into the vendor's resume invocation
2. Capturing the vendor's session ID from its first-call output
3. Setting `cwd` on the spawned process
4. Sandboxing/permissions appropriate to read-only consultation (codex-exec uses `--sandbox read-only`)

## Adding an advisor

1. Add a `ProviderId` to `src/core/types.ts`.
2. Implement the adapter under `src/core/adapters/<provider>.ts`.
3. Add a branch in the recipe that uses it (e.g., `src/recipes/consult.ts`'s `defaultAdvisorConfig()` and `makeAdvisor()`).

The interface is intentionally minimal. Resist generalizing it until you have a third concrete adapter that needs something the current shape can't express.

## Adding a recipe

1. Create `src/recipes/<recipe>.ts`. Import from `../core/` for adapters, state, audit.
2. Create `skills/<recipe>/SKILL.md` describing the UX.
3. Add a bundle step to `scripts/register.sh` that emits `~/.claude/skills/<recipe>/scripts/<recipe>.js`.

Each recipe defines its own input shape, advisor selection, persistence mode, and the verification instructions the executor should follow. The harness handles transport, persistence, and audit uniformly.

## CLI helper

The `/consult` recipe entry is bundled into a single file at install time:

```
bun "${CLAUDE_SKILL_DIR}/scripts/consult.js" \
  --session-id "$CLAUDE_SESSION_ID" \
  --advisors codex,claude \
  --question "..."
```

Reads the question from `--question`, `--question-file`, or stdin (in that order). Outputs markdown with one section per advisor to stdout. State and audit writes happen as side effects.

Run `bun src/recipes/consult.ts --help` from the repo root for the full flag list.
