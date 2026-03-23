---
allowed-tools: Bash, Read, Agent, AskUserQuestion
description: Multi-model code review. Runs parallel reviews across configured AI tools and synthesizes findings.
---

# Multi-Model Code Review

Review code using multiple AI CLI tools in parallel, then synthesize findings interactively.

## Step 1: Gather Context

Verify we're in a git repo:

```bash
git rev-parse --git-dir 2>/dev/null
```

If not, tell the user: "⊛ conclave needs a git repository. Navigate to your project and run `/review` again." **Stop.**

Get branch info:

```bash
BRANCH=$(git branch --show-current)
TARGET=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/@@' || echo "origin/main")
```

Get the diff. Check staged changes first, then unstaged. Exclude lock files and minified assets:

```bash
git diff --staged -- . \
  ':!package-lock.json' ':!yarn.lock' ':!pnpm-lock.yaml' ':!bun.lockb' ':!bun.lock' \
  ':!Cargo.lock' ':!Gemfile.lock' ':!composer.lock' ':!poetry.lock' ':!Pipfile.lock' \
  ':!go.sum' ':!pubspec.lock' ':!flake.lock' \
  ':!shrinkwrap.json' ':!.pnp.cjs' ':!.pnp.loader.mjs' \
  ':!*.min.js' ':!*.min.css' ':!*.map'
```

If no staged changes, try `git diff` (unstaged). If still nothing, ask the user what to review.

## Step 2: Build Prompt

Read the prompt template:

```bash
cat ~/.config/conclave/prompt.md
```

If it doesn't exist, use a sensible default review prompt that asks for findings with file:line references and severity.

Replace template variables:
- `{{branch}}` → current branch name
- `{{target_branch}}` → target branch
- `{{diff}}` → the full diff content

Write the completed prompt to a temp file using the **Bash tool** (not Write tool):

```bash
cat > /tmp/conclave-prompt.md << 'PROMPT_EOF'
{completed prompt with all variables replaced}
PROMPT_EOF
```

## Step 3: Run Models

Execute the conclave engine:

```bash
bash ~/.claude/scripts/conclave-run.sh --scope review --prompt /tmp/conclave-prompt.md
```

This reads `~/.config/conclave/tools.json`, filters tools with `"review"` in their scope, runs them all in parallel, and returns JSON.

The JSON output contains:
- `tools_run` — array of tool names that ran
- `results` — object with each tool's `model`, `success`, and `output` (or `error`)

If the JSON contains `"error"`, tell the user and stop. If no tools are enabled for the review scope, tell the user to check their config.

## Step 4: Present Results

For each successful tool, show its findings:

```
## Review Results

### From {tool_name} ({model})
{output}

### From {tool_name} ({model})
{output}
```

Identify **consensus** — issues flagged by 2+ tools. These are stronger signals.

Show a brief summary:

```
=== Review Summary ===
Tools: [list of tools that responded]
Issues found: [count]
Consensus items: [count flagged by 2+ tools]
```

## Step 5: Investigate (Optional)

**Requires**: Investigator agents installed (`bun run register:agents` from the conclave directory).

If agents are not installed, skip this step — the review is still useful without investigation.

Ask the user: "Want me to investigate each issue and draft PR comments?"

**If yes:**

### 5a: Create Worktree

```bash
REPO=$(basename $(git rev-parse --show-toplevel))
BRANCH=$(git branch --show-current)
WORKTREE=~/worktrees/$REPO/review-$BRANCH
mkdir -p ~/worktrees/$REPO
git worktree add $WORKTREE HEAD 2>/dev/null || echo "Worktree exists, reusing"
```

### 5b: Launch Investigators

Launch **all 3 in parallel** using the Agent tool — send 3 Agent calls in a single message:

**1. correctness-investigator** — Verify each flagged issue. Trace logic, check if real or false positive, draft inline comments.

Prompt must include:
- Working directory: `{worktree path}`
- Branch: `{branch}`
- Diff context: `{the diff}`
- Issues found: `{numbered list of issues with which tools flagged them, marking CONSENSUS for 2+ tools}`

**2. test-investigator** — Assess test coverage for the changed code.

Prompt must include:
- Working directory: `{worktree path}`
- Branch: `{branch}`
- Diff context: `{the diff}`

**3. dx-investigator** — Check code quality: duplication, existing utilities, YAGNI violations.

Prompt must include:
- Working directory: `{worktree path}`
- Branch: `{branch}`
- Diff context: `{the diff}`

### 5c: Combine Results

After all 3 return, present combined findings:

```
=== Investigation Summary ===
Correctness: [real issues] real, [false positives] false positive
Test coverage: [status]
DX findings: [count]

Recommended action: [Request changes / Comment / Approve]
Reason: [brief reason]

=== Issues ===

[CRITICAL] file:line — Issue title
Verdict: real_issue
Draft: "the comment"

[MEDIUM] file:line — Issue title
Verdict: false_positive
Reason: why it's not a problem
```

### 5d: Cleanup Note

Tell the user:

> Worktree at `~/worktrees/<repo>/review-<branch>/`. Run `/worktree-cleanup` when done.

**If user declines investigation**, skip to Step 6 with just the raw review summaries.

## Step 6: Draft PR Comment

Ask: "Ready to draft the final review comment?"

If yes, draft a concise PR comment. Write like a colleague, not a report:

- Lowercase, conversational tone
- Ask questions instead of demanding changes for non-blocking issues
- Reference inline comments naturally ("left a note on X")
- Skip bullet points for single issues — just say it

**Examples:**

Request changes:
```
nice cleanup on the line spacing normalization. couple things:

the autospacing calc looks off when `lineRaw` is ≤10 - it bypasses twips conversion which would give near-zero spacing for those docs.

also converting `exact` to a multiplier makes it font-dependent - was that intentional?

see inline comments for details.
```

Comment:
```
good fix for the percentage width handling. left a question inline about test coverage for the mixed pct/dxa scenario. lgtm otherwise.
```

Approve:
```
looks good. the spec-compliant autospacing handling is correct. minor suggestions inline.
```

## Error Handling

- Tool not installed → skip, note in output
- Tool fails → report error, continue with others
- No tools enabled → tell user to check `~/.config/conclave/tools.json`
- Config missing → tell user to run `bun run register` from the conclave directory
