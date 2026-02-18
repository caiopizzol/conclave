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

### Step 4: Spawn Parallel Reviews

**State: `[SPAWNING]`**

#### 4a: Write Prompt File

Write the complete review prompt to a temp file:

```bash
cat > /tmp/conclave-prompt.md << 'PROMPT_EOF'
{the complete review prompt from Step 3b, with all template variables replaced}
PROMPT_EOF
```

#### 4b: Build Shell Scripts

For each eligible tool (filtered in Step 2), write a shell script using the Write tool.

The `command` field in the config is **complete** — it includes env vars, model flags, everything. Just plug it in.

**For stdin-based tools** (command does NOT contain `-p`), write `/tmp/conclave-run-{tool_name}.sh`:
```bash
#!/bin/bash -l
cat /tmp/conclave-prompt.md | {command from config} 2>&1
```

**For flag-based tools** (command contains `-p`), write `/tmp/conclave-run-{tool_name}.sh`:
```bash
#!/bin/bash -l
{command from config} "$(cat /tmp/conclave-prompt.md)" 2>&1
```

**Example**: For a tool with `"command": "ollama run minimax-m2.5:cloud"`, write:
```bash
#!/bin/bash -l
cat /tmp/conclave-prompt.md | ollama run minimax-m2.5:cloud 2>&1
```

#### 4c: Delegate Execution

Spawn the `multi-model-executor` sub-agent to run all scripts in parallel:

```
Task tool call:
  subagent_type: multi-model-executor
  prompt: |
    Run these commands in parallel and collect results.

    **Timeout**: 300000

    **Commands**:
    - name: {tool_name}, model: {model}, script: /tmp/conclave-run-{tool_name}.sh
    - name: {tool_name}, model: {model}, script: /tmp/conclave-run-{tool_name}.sh
    ...
```

The executor runs each script via `bash -l` in background and returns structured JSON results.

After the executor returns, parse the JSON `results` object to extract each tool's output. Output: `[STATE: TOOLS_COMPLETE]`

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

### Step 6: Synthesize Results

**State: `[PERSISTED]` → `[SYNTHESIZING]`**

After persisting (or if persistence is disabled), structure the findings for presentation:

```
## Review Results

### From Codex (GPT-5.2)
[codex findings]

### From Claude (Opus)
[claude findings]

### From Gemini
[gemini findings]
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
  Investigate these code review findings and draft comments.

  **Working Directory**: [worktree path from 7a]
  IMPORTANT: cd to this directory before investigating.

  **Branch**: [branch name]

  **Diff Context**:
  [the diff being reviewed]

  **Issues Found**:
  1. [Issue from Tool A] - Line X: description
  2. [Issue from Tool B] - Line Y: description (CONSENSUS if flagged by multiple)
  ...

  For each issue:
  1. Read the relevant code to understand context
  2. Explain why this is (or isn't) a real problem
  3. Assign a verdict: `real_issue`, `false_positive`, or `needs_clarification`
  4. If real_issue or needs_clarification: Draft an inline comment

  After investigating all issues, provide:
  - **Summary**: Brief overview of findings (what's real, what's not)
  - **Recommended action**: "Request changes" / "Comment" / "Approve"
  - **Reason**: Why this action (e.g., "critical bug found" or "only minor suggestions")

  Output plain text, no markdown formatting beyond code blocks, no emojis, no AI-speak.
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

### Step 8: Present Results for Approval

If investigation was performed, present the investigation summary first, then each issue:

```
=== Investigation Summary ===
Real issues: [count]
False positives: [count]
Needs clarification: [count]

Recommended action: [Request changes / Comment / Approve]
Reason: [brief reason from investigator]

=== Issues Found ===

[CRITICAL] Line X - Issue title
Verdict: real_issue
Draft: "the drafted comment"

[MEDIUM] Line Y - Issue title
Verdict: false_positive
Reason: [why this isn't actually a problem]

[LOW] Line Z - Issue title
Verdict: needs_clarification
Draft: "the drafted comment"
```

After presenting the summary, use AskUserQuestion to confirm the review action:

"Investigation complete. Ready to draft the final review comment?"
- "Yes, draft it" - Proceed to Step 9
- "Let me review the inline comments first" - Present each draft for approval/editing
- "Skip final comment" - End without summary comment

If no investigation was performed, fall back to the standard synthesis:

1. **Identify consensus** - Issues flagged by multiple tools are likely real problems
2. **Group by category** - bugs, security, performance, style
3. **Highlight disagreements** - Where tools differ, present both perspectives

Use AskUserQuestion to engage:

- "Codex and Claude both flagged a potential null reference at line 42. Should I create a fix?"
- "Gemini suggests refactoring the auth module. Is this in scope for this review?"
- "Some style suggestions were made. Do you want to see those or focus on bugs only?"

### Step 9: Draft Final Review Comment

After investigation is complete and inline comments are drafted, generate a **final summary comment** for the GitHub PR review submission dialog.

The final comment should:
1. **Summarize the review** - Brief overview of what was reviewed and overall quality
2. **List key findings** - Bullet points of the main issues (with severity)
3. **Note false positives** - Mention any reviewer concerns that were dismissed and why
4. **Recommend review action** - Suggest "Approve", "Comment", or "Request changes"

**Output format**:

```
## Final Review Comment

**Recommended action:** [Request changes / Comment / Approve]

**Draft comment:**
---
[The actual comment text the user can copy/paste into GitHub]
---

Copy the text between the --- lines into the GitHub review dialog.
```

**Guidelines for the draft comment**:
- Write like a colleague, not a formal report - conversational but concise
- Use lowercase for casual observations, questions where appropriate
- Ask questions instead of demanding changes when the issue isn't blocking
- Skip bullet points for single issues - just say it naturally
- Reference inline comments casually ("left a question inline about X")
- Match the tone of how you'd talk in a quick Slack message or standup

**Tone examples**:
- Instead of: "**Bug in autospacing calculation** - when `lineRaw` is a small multiplier..."
- Write: "the autospacing calc looks off when `lineRaw` is small - might produce near-zero spacing?"

- Instead of: "Please confirm this is intentional."
- Write: "is this intentional?"

- Instead of: "Two items need attention:"
- Write: "couple things:"

**Example draft comments**:

For "Request changes":
```
nice cleanup on the line spacing normalization. couple things:

the autospacing calc looks off when `lineRaw` is ≤10 - it bypasses twips conversion which would give near-zero spacing for those docs.

also converting `exact` to a multiplier makes it font-dependent - was that intentional?

see inline comments for details.
```

For "Comment":
```
good fix for the percentage width handling. left a question inline about test coverage for the mixed pct/dxa scenario. lgtm otherwise.
```

For "Approve":
```
looks good. the spec-compliant autospacing handling is correct. minor suggestions inline.
```

### Step 10: Generate Action Items (Optional)

If the user wants, generate:

- A summary of actionable findings
- Suggested fixes for critical issues
- A checklist of items to address

After completing all steps, output: `[STATE: COMPLETE]`

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
