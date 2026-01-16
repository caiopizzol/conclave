---
allowed-tools: Bash, Read, Write, Glob, Grep, TaskOutput, AskUserQuestion
description: Multi-model code review. Spawns parallel reviews from configured AI tools (Codex, Claude, Gemini, Qwen, Mistral) and synthesizes results interactively.
---

# Multi-Model Code Review

Review code using multiple AI CLI tools in parallel, then synthesize findings interactively.

## Workflow

### Step 1: Verify Git Repository

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

Parse the config to determine which tools are enabled. Each tool can have:

- `enabled` (required) - whether to use this tool
- `command` (required) - the CLI command to run
- `model` (optional) - specific model to use (injected via `--model` or `-m` flag)
- `description` (optional) - human-readable description

### Step 3: Gather Context

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
git diff --staged -- \
  ':!package-lock.json' ':!yarn.lock' ':!pnpm-lock.yaml' ':!bun.lockb' ':!bun.lock' \
  ':!Cargo.lock' ':!Gemfile.lock' ':!composer.lock' ':!poetry.lock' ':!Pipfile.lock' \
  ':!go.sum' ':!pubspec.lock' ':!flake.lock' \
  ':!shrinkwrap.json' ':!.pnp.cjs' ':!.pnp.loader.mjs' \
  ':!*.min.js' ':!*.min.css' ':!*.map'

# Or for unstaged changes:
git diff -- \
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

Read the prompt template from the file specified in `prompt_file` (default: `~/.config/conclave/prompt.md`):

```bash
cat ~/.config/conclave/prompt.md
```

Replace template variables in the prompt:

- `{{branch}}` - current branch name
- `{{target_branch}}` - target branch (e.g., origin/main)
- `{{diff}}` - the full diff content

If no prompt file exists, use a default review prompt.

### Step 4: Spawn Parallel Review Commands

For each **enabled** tool in the config, run background Bash commands.

**Important**: Launch all commands in a SINGLE message with multiple Bash tool calls (using `run_in_background: true`) to run them in parallel.

For each tool:

1. First, write the review prompt to a unique temp file (to avoid shell escaping issues and race conditions)
2. Then run the CLI tool piping from that file, in background mode

**Step 4a - Write prompt files** (run these in parallel):

```bash
cat > /tmp/conclave-review-{tool_name}.md << 'PROMPT_EOF'
{review_prompt_with_variables_replaced}
PROMPT_EOF
```

**Step 4b - Run review commands in background** (run these in parallel with `run_in_background: true`):

For most tools (stdin-based):
```bash
cat /tmp/conclave-review-{tool_name}.md | {final_command} 2>&1
```

For Mistral Vibe (command substitution - does not accept stdin):
```bash
{final_command} "$(cat /tmp/conclave-review-mistral.md)" 2>&1
```

**Model Flag Injection**: If a tool has a `model` field specified, inject the model flag into the command:

| Tool     | Model Flag | Injection Point             |
| -------- | ---------- | --------------------------- |
| codex    | `-m`       | Before the `-` stdin marker |
| claude   | `--model`  | Appended to command         |
| gemini   | `-m`       | Appended to command         |
| qwen     | `-m`       | Appended to command         |
| mistral  | N/A        | Model set via `~/.vibe/config.toml` |

**Notes**:
- Codex model injection requires the command to end with ` -` (stdin marker). If the command doesn't end with ` -`, skip model injection for that tool.
- Model values should be simple identifiers (alphanumeric, dots, dashes). Do not include shell metacharacters.
- If the user's command already includes a model flag (`-m` or `--model`), skip model injection to avoid duplicate flags.

Command construction examples:

```
# Codex (model flag goes BEFORE the trailing `-`)
Original: codex exec --full-auto -
With model: codex exec --full-auto -m gpt-5.2-codex -

# Claude (model flag appended)
Original: claude --print
With model: claude --print --model claude-opus-4-5-20251101

# Gemini (model flag appended)
Original: gemini -o text
With model: gemini -o text -m gemini-2.5-pro

# Qwen (model flag appended)
Original: qwen -o text
With model: qwen -o text -m coder-model

# Mistral (no model flag - configured via ~/.vibe/config.toml)
# Uses command substitution instead of stdin:
vibe --output text -p "$(cat /tmp/conclave-review-mistral.md)"
```

Use `timeout: 300000` (5 minutes) for each command since AI tools can be slow.

**Step 4c - Wait for all background tasks** using TaskOutput tool:

- Call TaskOutput for each background task ID
- This will block until each completes and return the full output

### Step 5: Collect and Parse Results

After all subagents complete, collect their outputs. Structure the findings:

```
## Review Results

### From Codex (GPT-5.2)
[codex findings]

### From Claude (Opus)
[claude findings]

### From Gemini
[gemini findings]
```

### Step 5.5: Deep Investigation

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

**If user opts in**, launch the `review-investigator` sub-agent using the Task tool:

```
subagent_type: review-investigator
prompt: |
  Investigate these code review findings and draft comments:

  **Diff Context**:
  [the diff being reviewed]

  **Issues Found**:
  1. [Issue from Tool A] - Line X: description
  2. [Issue from Tool B] - Line Y: description (CONSENSUS if flagged by multiple)
  ...

  For each issue:
  1. Read the relevant code to understand context
  2. Explain why this is (or isn't) a real problem
  3. Draft a comment

  Output plain text, no markdown, no emojis, no AI-speak.
```

Wait for the investigator to complete, then proceed to Step 6 with the investigation results.

**If user declines**, skip to Step 6 with just the raw review summaries.

### Step 6: Present Results for Approval

If investigation was performed, present each issue with its drafted comment:

```
=== Issues Found (N total) ===

[CRITICAL] Line X - Issue title
Draft: "the drafted comment"
→ Post this comment? [y/n/edit]

[MEDIUM] Line Y - Issue title
Draft: "the drafted comment"
→ Post this comment? [y/n/edit]

[LOW] Line Z - Issue title
Draft: "the drafted comment"
→ Post this comment? [y/n/edit]
```

Use AskUserQuestion to let the user approve, skip, or edit each comment.

If no investigation was performed, fall back to the standard synthesis:

1. **Identify consensus** - Issues flagged by multiple tools are likely real problems
2. **Group by category** - bugs, security, performance, style
3. **Highlight disagreements** - Where tools differ, present both perspectives

Use AskUserQuestion to engage:

- "Codex and Claude both flagged a potential null reference at line 42. Should I create a fix?"
- "Gemini suggests refactoring the auth module. Is this in scope for this review?"
- "Some style suggestions were made. Do you want to see those or focus on bugs only?"

### Step 7: Generate Action Items (Optional)

If the user wants, generate:

- A summary of actionable findings
- Suggested fixes for critical issues
- A checklist of items to address

---

## Tool Command Reference

Most tools receive the prompt via stdin: `cat prompt.md | {command}`

| Tool     | Default Command                    | Model Flag               | Notes                                                      |
| -------- | ---------------------------------- | ------------------------ | ---------------------------------------------------------- |
| Codex    | `codex exec --full-auto -`         | `-m` (insert before `-`) | `-` reads prompt from stdin, `--full-auto` skips approvals |
| Claude   | `claude --print`                   | `--model` (append)       | `--print` outputs response without interactive mode        |
| Gemini   | `gemini -o text`                   | `-m` (append)            | Reads prompt from stdin, `-o text` for plain output        |
| Qwen     | `qwen -o text`                     | `-m` (append)            | Reads prompt from stdin, `-o text` for plain output        |
| Mistral  | `vibe --output text -p`            | Config-based             | Uses command substitution: `vibe --output text -p "$(cat file)"` |

**Notes**:
- Each parallel subagent should use a unique temp file (e.g., `/tmp/conclave-review-{tool}.md`) to avoid race conditions.
- Mistral Vibe does not accept stdin; prompt must be passed via `-p` flag using command substitution.
- Mistral model selection is done via `~/.vibe/config.toml` (`active_model` setting), not CLI flags.
- **Limitation**: Mistral's command-line argument passing has a ~200KB limit (ARG_MAX). Very large diffs may fail.

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
