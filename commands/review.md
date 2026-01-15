---
allowed-tools: Bash, Read, Write, Glob, Grep, TaskOutput, AskUserQuestion
description: Multi-model code review. Spawns parallel reviews from configured AI tools (Codex, Claude, Gemini) and synthesizes results interactively.
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

Parse the config to determine which tools are enabled.

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

Get the actual diff content:
```bash
git diff --staged  # or git diff, depending on what's available
```

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
```bash
cat /tmp/conclave-review-{tool_name}.md | {configured_command} 2>&1
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

### Step 6: Interactive Synthesis

Analyze all reviews and engage with the user:

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

All tools receive the prompt via stdin: `cat prompt.md | {command}`

| Tool | Default Command | Notes |
|------|-----------------|-------|
| Codex | `codex exec --full-auto -` | `-` reads prompt from stdin, `--full-auto` skips approvals |
| Claude | `claude --print` | `--print` outputs response without interactive mode |
| Gemini | `gemini` | Reads prompt from stdin |

**Note**: Each parallel subagent should use a unique temp file (e.g., `/tmp/conclave-review-{tool}.md`) to avoid race conditions.

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
