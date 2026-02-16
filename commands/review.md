---
allowed-tools: Bash, Read, Write, Glob, Grep, Task, TaskOutput, AskUserQuestion
description: Multi-model code review. Spawns parallel reviews from configured AI tools (Codex, Claude, Gemini, Qwen, Mistral, Ollama, Grok) and synthesizes results interactively.
---

# Multi-Model Code Review

Review code using multiple AI CLI tools in parallel, then synthesize findings interactively.

## State Machine

This workflow follows a state machine pattern. Output the current state marker after each major step:

```
[STATE: INIT]           → Verifying git repo and loading config
[STATE: GATHERING]      → Collecting diff and context
[STATE: SPAWNING]       → Launching parallel review tools
[STATE: TOOLS_COMPLETE] → All tools have returned
[STATE: PERSISTED]      → Results saved to disk (or PERSISTENCE_SKIPPED/PERSISTENCE_FAILED_CONTINUING)
[STATE: SYNTHESIZING]   → Building summary from results
[STATE: INVESTIGATING]  → Deep investigation in progress
[STATE: COMPLETE]       → Review finished
```

**Checkpoints**: Steps marked with ⛔ are blocking checkpoints that require verification before proceeding.

## Workflow

### Step 1: Verify Git Repository

**State: `[INIT]`**

First, check if we're in a git repository:

```bash
git rev-parse --git-dir 2>/dev/null
```

**If NOT in a git repo**: Stop and tell the user:

> ⊛ conclave needs to run from a git repository.
> Navigate to your project directory and run `/review` again.

**Do not proceed** if not in a git repo.

### Step 2: Load Configuration

Read the user's tool configuration:

```bash
cat ~/.config/conclave/tools.json
```

If the config doesn't exist, inform the user:

> No config found at `~/.config/conclave/tools.json`.
> Run: `mkdir -p ~/.config/conclave && cp ~/dev/conclave/config/tools.example.json ~/.config/conclave/tools.json`

Parse the config to determine which tools are enabled **for this command**. Each tool can have:

- `enabled` (required) - whether to use this tool
- `scope` (optional) - array of commands this tool is enabled for (e.g., `["review", "consult"]`)
- `command` (required) - the CLI command to run
- `model` (optional) - specific model to use (injected via `--model` or `-m` flag)
- `description` (optional) - human-readable description

**Scope Filtering**: A tool is eligible for `/review` if:
- `enabled` is `true` AND
- `scope` is not set (backwards compatible) OR `scope` array includes `"review"`

### Step 3: Gather Context

**State: `[GATHERING]`**

Collect git context for template variables:

```bash
# Get current branch
git branch --show-current

# Get target branch (usually main or master)
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/@@' || echo "origin/main"
```

Check for command arguments. If files were specified, use those. Otherwise:

1. Check for staged changes: `git diff --staged --name-only`
2. If no staged changes, check for unstaged changes: `git diff --name-only`
3. If no changes, ask the user what to review

Get the actual diff content (excluding lock files and minified assets):

```bash
# Use pathspec to exclude generated/large files from review
git diff --staged -- . \
  ':!package-lock.json' ':!yarn.lock' ':!pnpm-lock.yaml' ':!bun.lockb' ':!bun.lock' \
  ':!Cargo.lock' ':!Gemfile.lock' ':!composer.lock' ':!poetry.lock' ':!Pipfile.lock' \
  ':!go.sum' ':!pubspec.lock' ':!flake.lock' \
  ':!shrinkwrap.json' ':!.pnp.cjs' ':!.pnp.loader.mjs' \
  ':!*.min.js' ':!*.min.css' ':!*.map'

# Or for unstaged changes:
git diff -- . \
  ':!package-lock.json' ':!yarn.lock' ':!pnpm-lock.yaml' ':!bun.lockb' ':!bun.lock' \
  ':!Cargo.lock' ':!Gemfile.lock' ':!composer.lock' ':!poetry.lock' ':!Pipfile.lock' \
  ':!go.sum' ':!pubspec.lock' ':!flake.lock' \
  ':!shrinkwrap.json' ':!.pnp.cjs' ':!.pnp.loader.mjs' \
  ':!*.min.js' ':!*.min.css' ':!*.map'
```

**Excluded files** (auto-generated, not useful to review):

- Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `bun.lock`, `Cargo.lock`, `Gemfile.lock`, `composer.lock`, `poetry.lock`, `Pipfile.lock`, `go.sum`, `pubspec.lock`, `flake.lock`, `shrinkwrap.json`
- Yarn PnP: `.pnp.cjs`, `.pnp.loader.mjs`
- Minified assets: `*.min.js`, `*.min.css`, `*.map`

### Step 3b: Build the Review Prompt

Read the prompt template from the config's `prompts.review` path (default: `~/.config/conclave/prompt.md`).

**Note**: The config can use either the legacy `prompt_file` key or the new `prompts.review` key:

```bash
cat ~/.config/conclave/prompt.md
```

Replace template variables in the prompt:

- `{{branch}}` - current branch name
- `{{target_branch}}` - target branch (e.g., origin/main)
- `{{diff}}` - the full diff content

If no prompt file exists, use a default review prompt.

### Step 4: Delegate to Multi-Model Executor

**State: `[SPAWNING]`**

Delegate the parallel tool execution to the `multi-model-executor` sub-agent. This keeps all model outputs in the sub-agent's context, reducing main conversation bloat.

**Step 4a - Prepare tools JSON**:

Extract the enabled tools for "review" scope from the config:

```javascript
// Filter tools: enabled=true AND (no scope OR scope includes "review")
const eligibleTools = Object.entries(config.tools)
  .filter(([key, tool]) => tool.enabled && (!tool.scope || tool.scope.includes("review")))
  .reduce((acc, [key, tool]) => ({ ...acc, [key]: tool }), {});
```

**Step 4b - Launch executor sub-agent**:

Use the Task tool to spawn the multi-model-executor:

```
Task(
  subagent_type: "multi-model-executor",
  prompt: |
    Execute this review prompt across multiple AI models.

    **Prompt**:
    {the full review prompt with variables replaced}

    **Tools** (JSON):
    {eligible tools object from config}

    **Scope**: "review"
    **Timeout**: 300000
)
```

The sub-agent will:
1. Write the prompt to a temp file
2. Spawn all eligible tools in parallel
3. Wait for completion
4. Return structured JSON results

**Step 4c - Receive results**:

The sub-agent returns a JSON block in this format:

```json
{
  "tools_run": ["codex", "claude", "gemini"],
  "tools_skipped": ["ollama"],
  "results": {
    "codex": { "model": "gpt-5.2-codex", "success": true, "output": "..." },
    "claude": { "model": "opus", "success": true, "output": "..." }
  }
}
```

Parse this JSON and store the results for persistence and synthesis.

After receiving results, output: `[STATE: TOOLS_COMPLETE]`

**IMPORTANT**: Proceed IMMEDIATELY to the persistence checkpoint. Do NOT synthesize or present results yet.

### ⛔ CHECKPOINT: Persist Raw Outputs

**CRITICAL: DO NOT PROCEED TO STEP 6 UNTIL PERSISTENCE IS COMPLETE OR EXPLICITLY SKIPPED**

This checkpoint ensures review data is saved before any synthesis or user interaction.
Skipping this step has caused data loss in past sessions.

**State: `[TOOLS_COMPLETE]` → `[PERSISTED]`**

---

**Config options**:
- `persistence.enabled`: Whether to save review results (default: true)
- `persistence.required`: If true, STOP on persistence failure (default: false)
- `persistence.data_dir`: Where to save results (default: `~/.local/share/conclave/reviews`)

If `persistence.enabled` is `false` in the config:
- Output: `[STATE: PERSISTENCE_SKIPPED]`
- Proceed directly to Step 6

If `persistence.enabled` is `true`:

**5.1 - Create data directory and generate ID**:

```bash
mkdir -p ~/.local/share/conclave/reviews

# Generate unique review ID
REVIEW_ID=$(date -u +"%Y-%m-%dT%H-%M-%S")-$(basename $(git rev-parse --show-toplevel))-$(git branch --show-current | tr '/' '-')
```

**5.2 - Collect diff stats**:

```bash
# Get diff stats (e.g., "5 files changed, 120 insertions(+), 45 deletions(-)")
git diff --stat | tail -1
```

**5.3 - Write JSON file**:

Build a JSON file with the review data. For each tool that was run, include:
- `tool_name`: The tool key from config
- `model`: The model used (if specified)
- `success`: Whether the tool completed without error
- `output`: The raw output from the tool

Use `jq` if available to construct the JSON, otherwise use a heredoc with proper escaping.

The JSON structure should be:

```json
{
  "id": "{REVIEW_ID}",
  "timestamp": "{ISO timestamp}",
  "context": {
    "repo": "{repo name}",
    "branch": "{branch name}",
    "target_branch": "{target branch}",
    "diff_stats": "{diff stat line}"
  },
  "models": {
    "{tool_name}": {
      "model": "{model}",
      "success": true|false,
      "output": "{raw output}"
    }
  },
  "investigation": null
}
```

Write this to `~/.local/share/conclave/reviews/{REVIEW_ID}.json`.

**Important**: When writing the JSON, escape special characters in the model outputs (newlines, quotes, backslashes). If using a heredoc, use `jq -Rs` to properly escape the output strings, or write to temp files and use `jq` to construct the final JSON.

Example approach using temp files and jq:

```bash
# Write each model output to a temp file
echo "$CODEX_OUTPUT" > /tmp/conclave-output-codex.txt
echo "$CLAUDE_OUTPUT" > /tmp/conclave-output-claude.txt

# Build JSON using jq
jq -n \
  --arg id "$REVIEW_ID" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg repo "$(basename $(git rev-parse --show-toplevel))" \
  --arg branch "$(git branch --show-current)" \
  --arg target "$TARGET_BRANCH" \
  --arg diff_stats "$DIFF_STATS" \
  --rawfile codex_output /tmp/conclave-output-codex.txt \
  --rawfile claude_output /tmp/conclave-output-claude.txt \
  '{
    id: $id,
    timestamp: $timestamp,
    context: {
      repo: $repo,
      branch: $branch,
      target_branch: $target,
      diff_stats: $diff_stats
    },
    models: {
      "codex": { model: "gpt-5.2-codex", success: true, output: $codex_output },
      "claude-opus": { model: "opus", success: true, output: $claude_output }
    },
    investigation: null
  }' > ~/.local/share/conclave/reviews/${REVIEW_ID}.json
```

Adapt the jq command based on which tools actually ran and their success/failure status.

**If `jq` is not available**: Fall back to writing raw outputs to separate files:

```bash
mkdir -p ~/.local/share/conclave/reviews/${REVIEW_ID}
echo "$CODEX_OUTPUT" > ~/.local/share/conclave/reviews/${REVIEW_ID}/codex.txt
echo "$CLAUDE_OUTPUT" > ~/.local/share/conclave/reviews/${REVIEW_ID}/claude-opus.txt
# Write metadata
cat > ~/.local/share/conclave/reviews/${REVIEW_ID}/metadata.json << EOF
{"timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "repo": "$(basename $(git rev-parse --show-toplevel))", "branch": "$(git branch --show-current)"}
EOF
```

**If `jq` is not available**: Fall back to writing raw outputs to separate files (see fallback above).

**5.4 - VERIFY PERSISTENCE** (Required):

```bash
# Verify the file was written successfully
ls -la ~/.local/share/conclave/reviews/${REVIEW_ID}.json && echo "✓ PERSISTED: ${REVIEW_ID}"
```

If verification fails and `persistence.required` is `true` in config:
- **STOP** and report the error to the user
- Do NOT proceed to synthesis

If verification succeeds OR `persistence.required` is `false`:
- Output: `[STATE: PERSISTED]` (or `[STATE: PERSISTENCE_FAILED_CONTINUING]`)
- Proceed to Step 6

---

### Step 6: Claude's Own Review + Synthesize Results

**State: `[PERSISTED]` → `[SYNTHESIZING]`**

After persisting (or if persistence is disabled), **perform your own code review before synthesizing**.

#### 6a: Your Own Review

You have the full diff from Step 3. **Review it yourself** — don't just summarize what the external tools said. Read the diff line by line and look for:

- Bugs, logic errors, off-by-one mistakes, edge cases
- Security issues (injection, auth bypass, data leaks)
- Performance problems (N+1 queries, unnecessary allocations, missing indexes)
- Race conditions or concurrency issues
- Missing error handling at system boundaries
- Anything the external tools might have missed

You are a reviewer too, not just a moderator. Form your own opinions about the code.

#### 6b: Synthesize All Findings

Now combine **your own findings** with the external model results. You count as a reviewer — if you and one external tool flag the same issue, that's consensus.

**Comment style for synthesis**:
- Use simple words -- say "pick one place" not "canonicalize", "cut in half" not "halve", "differs from" not "diverges from"
- Concrete consequence first, then the technical detail
- 1-3 sentences per finding
- Lowercase start, no prefixes
- End with a question when it's a design decision

**Output format**:

Group findings by consensus (flagged by multiple tools, including yourself) vs unique. For each finding:

```
**<file>:<lines>** -- <short title>

<1-3 sentence comment>
```

End with a summary table:

```
| Finding | Severity | Flagged by |
|---------|----------|------------|
| <short title> | Low/Medium/High | <which tools flagged it, include "claude (self)" for your own findings> |
```

### Step 7: Deep Investigation

**State: `[INVESTIGATING]` (if user opts in)**

After collecting results, present a summary to the user and offer investigation.

First, show a brief overview:

```
=== Review Summary ===
Tools: [list of tools that responded]
Issues found: [count]
Consensus items: [count of issues flagged by 2+ tools]
```

Then use AskUserQuestion:

"Want me to investigate each issue and draft PR comments?"

**If user opts in**:

#### 7a: Create Investigation Worktree

Before launching the investigator, create an isolated worktree to avoid disrupting local work:

```bash
# Get repo name and branch
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
BRANCH_NAME=$(git branch --show-current)
WORKTREE_PATH=~/worktrees/$REPO_NAME/review-$BRANCH_NAME

# Create worktree directory
mkdir -p ~/worktrees/$REPO_NAME

# Create worktree from current branch (if changes are committed)
# or from HEAD if reviewing uncommitted changes
git worktree add $WORKTREE_PATH HEAD 2>/dev/null || git worktree add $WORKTREE_PATH
```

If the worktree already exists, reuse it:
```bash
cd $WORKTREE_PATH && git checkout $BRANCH_NAME
```

#### 7b: Launch Investigator

Launch the `review-investigator` sub-agent using the Task tool:

```
subagent_type: review-investigator
prompt: |
  Investigate these code review findings with DEEP EXPLANATIONS.

  **Working Directory**: [worktree path from 7a]
  IMPORTANT: cd to this directory before investigating.

  **Branch**: [branch name]

  **Context from Linear/ticket** (if available):
  [any context about the feature, customer, requirements]

  **Diff Context**:
  [the diff being reviewed]

  **Issues Found**:
  1. [Issue from Tool A] - Line X: description
  2. [Issue from Tool B] - Line Y: description (CONSENSUS if flagged by multiple)
  ...

  For each issue, provide a DEEP DIVE that enables human verification:

  1. **Read the actual code** - Don't trust the reviewer's description
  2. **Trace the logic** - Walk through step by step what happens
  3. **Explain what the code does** - Show snippets, trace data flow
  4. **Explain why it might be a problem** - Specific mechanism of failure
  5. **Explain why it might NOT be a problem** - Counter-arguments, guards
  6. **Give your verdict** - real_issue, false_positive, or needs_clarification
  7. **Draft inline comment** - If real_issue or needs_clarification

  The goal is human-in-the-loop verification. The reader should understand
  the issue well enough to say "yes that makes sense" or "wait, that's wrong because..."

  After all issues, provide summary with recommended action.

  Output plain text, no emojis, no AI-speak.
```

Wait for the investigator to complete, then proceed to Step 6 with the investigation results.

#### 7c: Cleanup (Optional)

After investigation completes, inform the user about the worktree:

> Investigation worktree created at `~/worktrees/<repo>/review-<branch>/`
> Run `/worktree-cleanup` to remove it when done.

#### 7d: Persist Investigation + Quality Data

If persistence is enabled and investigation was performed, update the JSON with both investigation output and quality tracking data:

```bash
# Write investigation output to temp file
echo "$INVESTIGATION_OUTPUT" > /tmp/conclave-investigation.txt

# Extract quality JSON (line after ```quality marker)
QUALITY_JSON=$(grep -A1 '```quality' /tmp/conclave-investigation.txt | tail -1)

# Update persisted review with investigation and quality data
jq --rawfile inv /tmp/conclave-investigation.txt \
   --argjson q "${QUALITY_JSON:-null}" \
   '.investigation = {ran: true, output: $inv} | .quality = $q' \
   ~/.local/share/conclave/reviews/${REVIEW_ID}.json > /tmp/conclave-review-updated.json \
   && mv /tmp/conclave-review-updated.json ~/.local/share/conclave/reviews/${REVIEW_ID}.json
```

The `.quality` field contains structured issue verdicts for tracking model accuracy over time:
- `real_issue` - Confirmed problem
- `false_positive` - Not actually a problem
- `wont_fix` - Valid but out of scope

**If user declines**, skip to Step 8 with just the raw review summaries.

### Step 8: Present Investigation Results

The investigator returns **deep dive explanations** for each issue. Present them directly to the user for human-in-the-loop verification.

The user should be able to:
1. Read each deep dive and understand what the code actually does
2. Verify if the problem assessment makes sense
3. Decide which inline comments to post

**Output format** (from investigator):

The investigator returns deep dives for each issue. Present them using simple, plain language:

```
**Issue N: [title]** -- [file:line]
Priority: [CRITICAL/MEDIUM/LOW] | Flagged by: [reviewers]

[What the code does -- 2-3 sentences with a code snippet]

[Why it matters or doesn't -- 1-2 sentences]

**Verdict: [real_issue / false_positive / needs_clarification]**

**Draft comment**: [1-2 sentence comment in plain words, or "[skip]" for false positives]
```

After all issues:

```
### Summary

| Verdict | Count | Details |
|---------|-------|---------|
| Real issues | N | [briefs] |
| False positives | N | [briefs] |
| Needs clarification | N | [briefs] |

Recommended action: [Request changes / Comment / Approve]
```

**Do NOT automatically draft a final summary comment.** The user reviews inline comments and decides what to post.

If no investigation was performed, fall back to the standard synthesis:

1. **Identify consensus** - Issues flagged by multiple tools are likely real problems
2. **Group by category** - bugs, security, performance, style
3. **Highlight disagreements** - Where tools differ, present both perspectives

### Step 9: User Reviews and Posts Comments

The user reviews each deep dive explanation and decides:
- Which inline comments to post on the PR
- Whether to request changes, comment, or approve
- If any issues need further discussion

The review is complete when the user has processed all findings.

After completing all steps, output: `[STATE: COMPLETE]`

---

## Tool Command Reference

Most tools receive the prompt via stdin: `cat prompt.md | {command}`

| Tool     | Default Command                    | Model Flag               | Notes                                                      |
| -------- | ---------------------------------- | ------------------------ | ---------------------------------------------------------- |
| Codex    | `codex exec --full-auto -`         | `-m` (insert before `-`) | `-` reads prompt from stdin, `--full-auto` skips approvals |
| Gemini   | `gemini -o text`                   | `-m` (append)            | Reads prompt from stdin, `-o text` for plain output        |
| Qwen     | `qwen -o text`                     | `-m` (append)            | Reads prompt from stdin, `-o text` for plain output        |
| Mistral  | `vibe --output text -p`            | Config-based             | Uses command substitution: `vibe --output text -p "$(cat file)"` |
| Grok     | `grok -p`                          | `-m` (append)            | Uses command substitution: `grok -p -m model "$(cat file)"` |
| Ollama   | `ollama run`                       | Appended directly        | Model appended without flag: `ollama run <model>`          |

**Notes**:
- All tools read from the same prompt file (`/tmp/conclave-review-prompt.md`) written once in Step 4a.
- Mistral Vibe does not accept stdin; prompt must be passed via `-p` flag using command substitution.
- Mistral model selection is done via `~/.vibe/config.toml` (`active_model` setting), not CLI flags.
- Grok CLI does not accept stdin; prompt must be passed via `-p` flag using command substitution (like Mistral).
- **Limitation**: Mistral and Grok's command-line argument passing has a ~200KB limit (ARG_MAX). Very large diffs may fail.

---

## Error Handling

- If a tool is not installed, skip it and note in output
- If a tool fails, report the error but continue with other tools
- If no tools are enabled/available, inform user and exit

---

## Example Usage

User runs `/review` with staged changes:

1. Config shows Codex and Claude enabled
2. Spawn 2 parallel subagents
3. Collect both reviews
4. "Both tools found an issue at line 15. Codex says it's a race condition, Claude says it's a deadlock risk. Want me to investigate further?"
5. User says yes
6. Provide detailed analysis and suggested fix
