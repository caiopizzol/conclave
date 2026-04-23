---
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion
description: Stateful, multi-round multi-model consensus on an implementation plan.
argument-hint: "[task description]"
---

# /converge

Run a plan through an iterative Claude <-> Codex loop until they converge on an approach, or hit a round cap. Unlike `/consult` (one-shot second opinion) and `/review` (one-shot critique of a diff), `/converge` is stateful: draft, critique, revise, re-critique, stop on consensus or cap.

**Scope (MVP)**: plan-level. Produces an agreed approach, not a patch. Code-level convergence is a later phase using the same ledger contract.

**Core principle**: the coordinator owns the canonical ledger. Claude cannot create, rename, or drop issues; only respond to them. This is what keeps convergence honest.

## Step 0: Session

```bash
CONVERGE_DIR=$(mktemp -d /tmp/conclave-converge-XXXXXX)
```

All artifacts, ledger snapshots, and per-round prompts live under `$CONVERGE_DIR`. Layout is owned by the coordinator (see `docs/converge.md`).

## Step 1: Gather context

Same pattern as `/consult`. You are responsible for gathering the right context. Don't dump raw conversation history. Read the actual files and assemble a focused CONTEXT block into `$CONVERGE_DIR/context.md`.

Include:
- files or modules the task touches
- related existing code the plan will interact with
- constraints from `$ARGUMENTS` (perf, compat, deadlines)
- approaches the user already ruled out

## Step 2: Launch coordinator

```bash
bash ~/.claude/scripts/conclave-converge.sh \
  --task "$ARGUMENTS" \
  --context "$CONVERGE_DIR/context.md" \
  --session "$CONVERGE_DIR" \
  --max-rounds 3
```

The coordinator runs the full state machine: spawns the implementer (Claude) and the reviewer (Codex) once per round, reconciles issues against the canonical ledger, and applies stop conditions. It writes per-round files into `$CONVERGE_DIR` and emits a final JSON summary to stdout.

MVP requires two exact keys in `~/.config/conclave/tools.json`:
- `claude-opus` (implementer)
- `codex` (reviewer)

If either key is missing or disabled, the coordinator fails fast with a clear error. Transport-layer integration (via `conclave-run.sh --tool <name>`) is phase 2.

Final JSON shape:

```json
{
  "rounds_run": 2,
  "stop_reason": "no_open_blockers",
  "final_artifact": "/tmp/conclave-converge-XYZ/round_2/artifact.md",
  "ledger": [
    { "id": "ISSUE-001", "kind": "correctness", "status": "resolved" }
  ],
  "disputes": [
    { "id": "ISSUE-003", "severity": "concern", "reviewer_claim": "...", "claude_rationale": "..." }
  ]
}
```

Valid `stop_reason`: `no_open_blockers`, `round_cap`, `stable_with_disputes`. See `docs/converge.md` for round semantics - `final_artifact` is always the artifact that was reviewed in the final round (never an un-reviewed revision).

If the coordinator is missing, tell the user to run `bun run register` from the conclave directory. **Stop.**

## Step 3: Present results

Read the final artifact and summary. Show:

```
=== /converge results ===

Stopped: {stop_reason} after {rounds_run} rounds

## Final plan
{contents of final_artifact}

## Resolved during convergence
- [ISSUE-001] {claim} (resolved round 1)
- [ISSUE-002] {claim} (resolved round 2)

## Open disputes
- [ISSUE-003] ({severity}) {reviewer_claim}
  Claude's rationale: {claude_rationale}

## Stalemates
- [ISSUE-004] {claim} (ping-ponged, coordinator flipped to terminal)
```

If `stop_reason` is `round_cap` or `stable_with_disputes`, flag to the user that the plan is usable but not fully agreed.

## Step 4: Next step

Ask: "Plan looks good to implement?"

- Yes -> hand off to `/implement` or `/fix` with the final artifact
- Revise -> treat user input as additional context and re-run `/converge`
- Drop disputed item -> user edits the plan manually, then implements

## Error handling

- Coordinator script missing: tell user to run `bun run register`
- Implementer or reviewer CLI fails mid-round: coordinator retries once, then fails the run with partial results preserved in `$CONVERGE_DIR`
- Required tool key missing or disabled: tell user exactly which key (`claude-opus` or `codex`) needs to be enabled in `~/.config/conclave/tools.json`

## Arguments
$ARGUMENTS
