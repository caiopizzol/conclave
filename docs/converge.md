# /converge coordinator design

Stateful coordinator that drives a round-based implementer <-> reviewer loop with a canonical ledger owned by the coordinator (not either model).

MVP invokes model CLIs directly (bypassing `conclave-run.sh`) and requires two exact keys in `~/.config/conclave/tools.json`: `claude-opus` (implementer) and `codex` (reviewer). Transport integration is phase 2 and non-breaking.

## Why a coordinator

`/consult` and `/review` are one-shot: fan out, synthesize, done. `/converge` needs state that persists across rounds:

- a canonical issue ledger with stable IDs
- which issues are open, resolved, disputed, or stalemated
- per-round artifacts and critiques
- stop condition evaluation

If the implementer owned the ledger, it could silently rename, merge, or drop objections and manufacture convergence. The whole point of the loop breaks. Coordinator-owned ledger is load-bearing.

## Language and placement

Bun + TypeScript at `scripts/conclave-converge.ts`, wrapped by `scripts/conclave-converge.sh` for shell invocation. Bun because:

- JSON-heavy state (ledger, critiques, responses)
- schema validation on model outputs
- readable state-machine code vs. bash + jq
- conclave already depends on bun (see `bun.lock`, `package.json`)

## Wire format

Model outputs are **strict JSON only**. No surrounding prose, no markdown fences, no commentary. The coordinator parses stdout as JSON and rejects any response that fails parse or schema validation. On rejection, retry once with an explicit "JSON only, no prose" reminder, then fail the round.

Human-readable `artifact.md` files are rendered by the coordinator from `plan_markdown` for debugging and final display. They are outputs, not contracts.

### ImplementerResponse (v1)

Claude's response in any round:

```json
{
  "schema_version": 1,
  "round": 1,
  "plan_markdown": "# Plan\n\n...",
  "sections": [
    { "id": "sec-1", "title": "Approach", "summary": "..." }
  ],
  "decisions": [
    { "claim": "...", "why": "..." }
  ],
  "open_questions": ["..."],
  "responses": [
    { "id": "ISSUE-001", "status": "resolved",  "rationale": "..." },
    { "id": "ISSUE-003", "status": "disputed",  "rationale": "..." }
  ]
}
```

`responses` rules (enforced by coordinator, not model):

- Round 0: `responses` must be empty.
- Round N >= 1: `responses` must contain **exactly one entry per open issue ID** in the ledger snapshot given to Claude. Missing IDs -> reject. Extra/unknown IDs -> reject. Duplicate IDs -> reject.
- Allowed `status` values: `resolved`, `disputed`, `partially_resolved`.
- Claude cannot create, rename, or drop issues. Only respond to IDs.

Exactness is how the coordinator tells "forgot to address" from "left open."

### ReviewerResponse (v1)

Codex's response in any review phase:

```json
{
  "schema_version": 1,
  "round": 1,
  "references": [
    { "id": "ISSUE-001", "verdict": "still_open" }
  ],
  "new_issues": [
    {
      "kind": "correctness",
      "scope": "planning",
      "location": "step 3",
      "claim": "...",
      "severity": "blocker"
    }
  ],
  "overall": "concerns"
}
```

Rules:

- Round 1: `references` must be empty (no prior ledger).
- Round N >= 2: `references` entries must reference IDs present in the ledger snapshot. Unknown IDs -> reject.
- Allowed `verdict` values: `still_open`, `agreed_resolved`, `new_concern`.
- Allowed `overall` values: `lgtm`, `concerns`, `blocker`.
- `new_issues` have no ID field. The coordinator assigns IDs during reconciliation.

## Session layout

Everything for one run lives under `$SESSION` (caller-provided tmpdir):

```
$SESSION/
  context.md                       # from the slash command
  task.md                          # the task description
  round_0/
    prompt_implementer.md          # what Claude saw
    artifact.json                  # ImplementerResponse
    artifact.md                    # coordinator-rendered from plan_markdown
  round_1/
    prompt_reviewer.md             # what Codex saw (context + artifact_0)
    critique.json                  # ReviewerResponse
    ledger_after_review.json       # ledger state after reviewer reconciliation
    prompt_implementer.md          # revision prompt (context + artifact_0 + ledger snapshot)
    artifact.json                  # ImplementerResponse (with responses)
    artifact.md                    # rendered
    ledger_after_revise.json       # ledger state after Claude's responses
  round_2/ ...
  final.json                       # emitted to stdout
```

Every intermediate state is on disk. Debuggable, auditable, resumable in phase 2.

## Ledger schema

```json
{
  "version": 1,
  "issues": [
    {
      "id": "ISSUE-001",
      "kind": "correctness | design | scope | test | perf | style",
      "scope": "planning | file:path | function:name",
      "location": "free-text locator (step N, file.py:fn, section heading)",
      "claim_normalized": "lowercased, stopword-stripped token set",
      "claim_display": "human-readable one-line summary",
      "severity": "blocker | concern | nit",
      "status": "open | resolved | disputed | partially_resolved | stalemate",
      "first_seen_round": 1,
      "last_updated_round": 2,
      "history": [
        { "round": 1, "action": "created_by_reviewer" },
        { "round": 2, "action": "claude_resolved", "rationale": "..." }
      ]
    }
  ]
}
```

## Fingerprint and reconciliation

Canonical identity is not model text. For each `new_issue` the reviewer emits:

```
fingerprint = hash(kind + scope + location + claim_normalized)
```

`claim_normalized` is produced by the coordinator, not the model: lowercased, punctuation stripped, stopwords removed, tokens sorted. Not perfect, but stops trivial rewording from creating phantom issues.

Matching rule, applied in order:

1. Same fingerprint exists -> reuse ID, update `last_updated_round`.
2. Same `(kind, scope, location)` but different `claim_normalized` -> suspect variant. Reuse ID, append to a `variant_claims` array.
3. Otherwise -> assign fresh `ISSUE-NNN`.

Rule (2) is deliberately loose. False merges are recoverable (Claude disputes it), false splits pollute the ledger and break convergence detection.

**Status transition on match**: a matched re-raise (via `new_issues` instead of `references`) is also a signal. Transitions applied:

- `resolved` or `partially_resolved` matched -> flip to `open`, history `reviewer_rejects_resolution`. This is the same effective outcome as a `new_concern` verdict in `references`, just arrived via the wrong channel.
- `disputed` matched -> stays `disputed`, history `reraised_by_reviewer`, counts as re-raise for stalemate detection (same as `still_open` verdict).
- `stalemate` matched -> terminal, no status change, history `reraised_but_stalemate`.
- `open` matched -> no status change, history `reraised_by_reviewer`.

Severity is not updated on match. Keeps the original intent and prevents the reviewer from escalating via wording alone.

## Per-round prompts

### Round 0: initial draft

**Implementer (Claude)** sees:
- `task.md`
- `context.md`
- ImplementerResponse schema reminder. `responses` must be empty.

Reviewer is not invoked.

### Round N (N >= 1): review phase

**Reviewer (Codex)** sees:
- `task.md`
- `context.md`
- `round_{N-1}/artifact.md` (current plan, rendered from `plan_markdown`)
- Round 1: no prior ledger. `references` must be empty.
- Round N >= 2: compact ledger snapshot with prior issue IDs, kind, `claim_display`, status. **Not** Claude's full rationale. Semi-blind: enough state to reference existing issues, not enough to anchor to Claude's wording.
- ReviewerResponse schema reminder.

Coordinator reconciles `new_issues` against the ledger (fingerprint rule) and applies `references` verdicts to update statuses.

### Round N: revise phase

**Implementer (Claude)** sees:
- `task.md`
- `context.md`
- `round_{N-1}/artifact.md`
- Ledger snapshot: the **actionable** set, meaning all `open` issues plus any `disputed` blocker. Disputed blockers stay in Claude's workload every round until they resolve or the loop hits `round_cap`. Each entry includes IDs, kind, `claim_display`, severity, and current status.
- Claude's own prior responses for continuity (its round N-1 rationales).
- ImplementerResponse schema reminder, plus the exactness rule: exactly one `responses` entry per actionable ID.

## Round semantics and rounds_run

A **round** = one review phase, optionally followed by a revise phase if the review did not trigger a stop.

- Round 0 is the initial draft. It is not counted in `rounds_run`.
- `rounds_run` increments after each **review** phase completes.
- Stop conditions are evaluated at the end of each review phase.
- If a stop fires, the round ends immediately. No revise. `final_artifact` is the artifact that was just reviewed.
- If no stop fires, revise runs. The revised artifact becomes the input to the next round's review.

This guarantees `final_artifact` is **always** an artifact that has been reviewed in the current ledger state. The "final artifact predates latest critique" failure mode cannot occur.

## Stop conditions

"Unresolved blocker" = any ledger entry with `severity: blocker` AND `status` in (`open`, `disputed`). Blockers never auto-stalemate (see below), so a disputed blocker remains unresolved until round cap or phase-2 adjudication. Evaluated at the end of each review phase:

1. **`no_open_blockers`**: reviewer `overall` is `lgtm` AND zero unresolved blockers.
2. **`stable_with_disputes`**: reviewer emitted zero `new_issues` in this round AND zero unresolved blockers. The "disputes" in the name refer to `nit` and `concern` disputes only (which are either terminal via stalemate or benign).
3. **`round_cap`**: `rounds_run >= max_rounds` (default 3). Fires at end of the final review.

**Diff-size is not a stop rule.** Small edits can change semantics; large edits can be cosmetic. Ledger state is ground truth.

## Stalemate detection

Distinguishes by severity, because auto-terminating a correctness blocker on one round of disagreement is unsafe.

- **`nit` and `concern`**: if Claude disputes the issue in round N and the reviewer re-raises the same issue unchanged in round N+1's `references` as `still_open`, the coordinator flips status to `stalemate` (terminal). Closes ping-pong on style/opinion.
- **`blocker`**: never auto-stalemates. A disputed blocker stays `disputed` (open for stop-condition purposes until round cap or user adjudication). Blockers on correctness or design should not be silently resolved by a timer.

Phase 2: a `/converge adjudicate <issue-id>` command to let the user resolve disputed blockers manually.

## Transport integration

**MVP (now)**: coordinator reads `~/.config/conclave/tools.json`, looks up two exact keys (`claude-opus` and `codex`), and invokes each tool's `command` directly. Zero changes to `conclave-run.sh`.

Precondition: if either key is missing or disabled, coordinator fails fast with a clear message telling the user which key is required.

**Phase 2 (non-breaking)**: extend `conclave-run.sh` with a `--tool <name>` flag that selects a single tool by name, bypassing scope filtering. The coordinator then becomes:

```bash
conclave-run.sh --tool claude-opus --prompt round_N/prompt_implementer.md
conclave-run.sh --tool codex       --prompt round_N/prompt_reviewer.md
```

Role assignment stays hardcoded in the coordinator (`claude-opus` = implementer, `codex` = reviewer) until a third stateful command needs configurability, at which point add `role` to `tools.json` entries.

## Open questions

1. **Severity inflation.** A reviewer can mark everything `blocker`. Cap blockers per round, or trust the model? Leaning trust for MVP, revisit if it shows up.

2. **User interjection mid-round.** Should `/converge` pause to let the user add a constraint after seeing round 1? Phase 2. MVP runs to completion.

3. **Resumability.** Session state is on disk, so resumption is feasible, but exposing it needs a `--resume <session>` flag on command + coordinator. Phase 2.

4. **Disputed blocker escape hatch.** With blockers exempt from auto-stalemate, a runaway disagreement blocks `no_open_blockers`. `round_cap` still terminates the loop and the final artifact is emitted with the blocker still open. User sees it in `disputes` and adjudicates manually. Acceptable for MVP, formal adjudication in phase 2.
