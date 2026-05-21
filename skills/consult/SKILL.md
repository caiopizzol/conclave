---
name: consult
description: Consult persistent advisor sessions on a focused question. Use when stuck, designing something non-trivial, or wanting a second opinion. Advisors keep their own session per worktree, so each consult builds on prior ones in the same Claude Code session.
argument-hint: <your specific question>
disable-model-invocation: true
---

# /consult

This is the `/consult` recipe of conclave — the first workflow built on the handoff console.

User question: $ARGUMENTS

## Step 1 - validate the question

If `$ARGUMENTS` is empty or vague (one word, no specifics), ask the user what they want to consult about before invoking the helper. A vague consult produces vague advice.

## Step 2 - invoke the helper

Run this via the Bash tool. The heredoc preserves any quotes or shell metacharacters in the user's question literally:

```bash
bun "${CLAUDE_SKILL_DIR}/scripts/consult.js" \
  --session-id "${CLAUDE_SESSION_ID}" <<'CONCLAVE_QUESTION_END_DELIMITER'
$ARGUMENTS
CONCLAVE_QUESTION_END_DELIMITER
```

The helper picks advisors from the user's config (`~/.config/conclave/advisors.json`'s `defaultAdvisors`, or the built-in `codex,claude` if no config exists). To override for a single call, add `--advisors <comma-separated-list>`. Built-in IDs are `codex` (gpt-5.3-codex via `codex exec resume`) and `claude` (opus via `claude --print --resume`). User-defined advisors (e.g., Kimi via Ollama) are added through the config file — see conclave's `docs/advanced.md` for an example.

Each advisor maintains its own session per worktree, so each consult in the same Claude Code session builds on prior ones for that advisor.

Add `--include-files path/to/x.ts,path/to/y.ts` if the question depends on specific files. Add `--include-diff` if it depends on uncommitted changes.

What the helper does:
- Loads per-worktree advisor state from `~/.local/state/conclave/sessions/`
- For Codex: resumes via `codex exec resume <threadId>` if a threadId exists; otherwise starts a fresh `codex exec --json` session and captures the new threadId from the `thread.started` event
- For Claude: resumes via `claude --print --resume <sessionId>` if a sessionId exists; otherwise starts a fresh `claude --print --output-format json` session and captures the new sessionId from the result JSON
- Writes a per-run audit record to `~/.local/state/conclave/runs/`
- Returns markdown with one section per advisor

## Step 3 - verify, don't accept

For each advisor claim:

1. Re-read the cited file, function, or test in the current code. If the advisor names a symbol, grep for it. If they describe behavior, confirm against the implementation.
2. Discard claims you cannot confirm. Mention them to the user as unverified rather than acting on them.
3. Cite the `file:line` you verified at.

## Step 4 - synthesize

Combine surviving advice into a clear next step. Attribute insights to advisors rather than paraphrasing them as your own.
