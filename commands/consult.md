---
description: "Get a second opinion from multiple AI models when stuck on a problem. Use when going in circles, facing a tricky decision, or wanting alternative approaches."
argument-hint: "[problem description]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, TaskOutput, AskUserQuestion, mcp__browser-tools__*
---

# Multi-Model Consultation

Get perspectives from multiple AI tools when you're stuck, going in circles, or want alternative approaches.

## When to Use

- Agent is going in circles on a problem
- Facing a tricky architectural decision
- Want to validate an approach before committing
- Debugging something that doesn't make sense
- Need fresh perspectives on a stuck problem

## Workflow

### Step 1: Verify Git Repository

Check if we're in a git repository (for context gathering):

```bash
git rev-parse --git-dir 2>/dev/null
```

If not in a repo, that's fine - we can still consult, just without git context.

### Step 2: Load Configuration

Read the user's tool configuration:

```bash
cat ~/.config/conclave/tools.json
```

If no config exists, inform the user:

> No config found at `~/.config/conclave/tools.json`.
> Run: `mkdir -p ~/.config/conclave && cp ~/dev/conclave/config/tools.example.json ~/.config/conclave/tools.json`

Parse the config to determine which tools are enabled **for this command**.

**Scope Filtering**: A tool is eligible for `/consult` if:
- `enabled` is `true` AND
- `scope` is not set (backwards compatible) OR `scope` array includes `"consult"`

### Step 3: Gather Context

#### 3a: Find Current Session History

Locate the current Claude Code conversation history file using the session ID from `history.jsonl`:

```bash
# Get current session ID by filtering history.jsonl for this project
CWD=$(pwd)
SESSION_ID=$(grep "\"project\":\"$CWD\"" ~/.claude/history.jsonl | tail -1 | python3 -c "import sys, json; print(json.loads(sys.stdin.read())['sessionId'])")

# Get encoded project path (replace / with -)
PROJECT_PATH=$(echo "$CWD" | sed 's|/|-|g' | sed 's|^-||')

# Build the history file path
HISTORY_FILE=~/.claude/projects/-${PROJECT_PATH}/${SESSION_ID}.jsonl

# Verify it exists, otherwise search for it
if [ ! -f "$HISTORY_FILE" ]; then
  HISTORY_FILE=$(find ~/.claude/projects -name "${SESSION_ID}.jsonl" 2>/dev/null | head -1)
fi

echo "Session ID: $SESSION_ID"
echo "History file: $HISTORY_FILE"
```

**Why this is safe**: We filter `history.jsonl` by the current project path (`pwd`), then take the last matching entry. This ensures we get the session ID for THIS project, not another concurrent session.

#### 3b: Build Context

1. **From arguments**: If $ARGUMENTS provided, use that as the specific question
2. **From history file**: Pass the JSONL file path to external tools - let them explore as needed
3. **From codebase**: If in a git repo, include the repo root path

The history file contains:
- `user` messages with `message.content` - what the user asked
- `assistant` messages - what Claude responded
- Tool calls and results - what was tried
- File snapshots - state at various points

**Do NOT summarize** - pass the raw file path and let each model explore the full context.

### Step 4: Build the Consultation Prompt

Read the prompt template from the config's `prompts.consult` path (default: `~/.config/conclave/consult-prompt.md`):

```bash
cat ~/.config/conclave/consult-prompt.md
```

Replace template variables:
- `{{history_file}}` - path to the JSONL conversation history from Step 3a
- `{{question}}` - the specific question/problem from $ARGUMENTS
- `{{cwd}}` - current working directory (for file references)

The prompt should instruct external tools to:
1. Read the JSONL history file to understand what's been tried
2. Look for `type: "user"` and `type: "assistant"` messages
3. Focus on recent messages to understand the current problem

If no prompt file exists, use the default embedded prompt.

### Step 5: Spawn Parallel Consultations

For each tool that passes the scope filter, run background Bash commands.

**Important**: Launch all commands in a SINGLE message with multiple Bash tool calls (using `run_in_background: true`) to run them in parallel.

**Step 5a - Write prompt file once**:

```bash
cat > /tmp/conclave-consult-prompt.md << 'PROMPT_EOF'
{consultation_prompt}
PROMPT_EOF
```

**Step 5b - Run consultation commands in background** (run ALL in parallel with `run_in_background: true`):

**Environment override for nested Claude Code**: When running inside Claude Code, `CLAUDECODE=1` prevents spawning nested sessions. Prefix with `CLAUDECODE=0` for any tool whose command contains `claude`:

```bash
# Claude tools
cat /tmp/conclave-consult-prompt.md | CLAUDECODE=0 claude --print --model opus 2>&1

# Ollama cloud tools (runs Claude Code pointed at Ollama's API)
cat /tmp/conclave-consult-prompt.md | CLAUDECODE=0 ANTHROPIC_AUTH_TOKEN=$OLLAMA_API_KEY ANTHROPIC_API_KEY= ANTHROPIC_BASE_URL=https://ollama.com claude --print --model glm-5:cloud 2>&1
```

For stdin-based tools:
```bash
cat /tmp/conclave-consult-prompt.md | {final_command} 2>&1
```

For command substitution tools (Mistral, Grok):
```bash
{final_command} "$(cat /tmp/conclave-consult-prompt.md)" 2>&1
```

Use `timeout: 300000` (5 minutes) for each command.

**Model Flag Injection**: Same as `/review` - see Tool Command Reference below.

**Step 5c - Wait for all background tasks** using TaskOutput tool.

### Step 6: Synthesize Responses

After all tools respond, analyze the results:

1. **Find consensus** - Where do multiple models agree?
2. **Identify unique insights** - What did only one model suggest?
3. **Note disagreements** - Where do models differ?

Present a synthesis:

```
=== Consultation Results ===

Models consulted: [list]

## Consensus (N+ models agree)
- [Point that multiple models raised]
- [Another shared insight]

## Unique Perspectives

### From Codex
[Unique insight or approach]

### From Gemini
[Different angle or suggestion]

## Disagreements
- Codex suggests X, while Claude suggests Y
- [Explain the tradeoff]

## Recommended Path Forward
Based on the consultation:
1. [Most promising suggestion]
2. [Alternative if #1 doesn't work]
```

### Step 7: Validate Top Suggestion (Optional)

After presenting synthesis, offer to validate the most promising suggestion:

"Want me to validate this suggestion with debug logs before you commit to it?"

**If user says yes:**

1. **Add targeted debug logs** based on the suggestion:
   ```typescript
   console.log('[VALIDATE] <hypothesis>:', { ...relevantState });
   ```

2. **Instruct user** to run the dev server and reproduce the issue

3. **Capture browser state**:
   - `mcp__browser-tools__getConsoleLogs`
   - `mcp__browser-tools__getConsoleErrors`

4. **Report validation result**:
   ```
   === Validation Result ===
   Suggestion: "Event ordering issue, not locking"

   Evidence:
   - [VALIDATE] logs show X happens before Y ✓
   - This supports/contradicts the suggestion

   Verdict: Suggestion appears VALID / INVALID
   ```

5. **Clean up** - Remove the debug logs after validation

Keep it lightweight - just enough to confirm or reject the hypothesis before making real changes.

### Step 8: Next Steps

Use AskUserQuestion to engage:

- "Suggestion validated. Want me to implement the fix?"
- "Suggestion didn't hold up. Want to try the alternative approach?"
- "There's disagreement on Y vs Z. Which direction do you prefer?"

## Tool Command Reference

Same as `/review` - see `~/.config/conclave/tools.json` for enabled tools.

| Tool     | Default Command                    | Model Flag               |
| -------- | ---------------------------------- | ------------------------ |
| Codex    | `codex exec --full-auto -`         | `-m` (before `-`)        |
| Claude   | `claude --print`                   | `--model` (append)       |
| Gemini   | `gemini -o text`                   | `-m` (append)            |
| Qwen     | `qwen -o text`                     | `-m` (append)            |
| Mistral  | `vibe --output text -p`            | Config-based             |
| Grok     | `grok -p`                          | `-m` (append)            |
| Ollama (local) | `ollama run`                  | Appended directly        |
| Ollama (cloud) | `ANTHROPIC_AUTH_TOKEN=$OLLAMA_API_KEY ANTHROPIC_API_KEY= ANTHROPIC_BASE_URL=https://ollama.com claude --print` | `--model` (append) |

## Error Handling

- If a tool fails, note it and continue with others
- If no tools respond, suggest manual debugging or different approach
- If all tools agree on "this is impossible", surface that clearly

## Example Usage

```
/consult "Trying to fix a race condition in the table update logic.
I've tried adding locks but it's still happening intermittently."
```

Output:

```
=== Consultation Results ===

Models consulted: Codex, Claude, Gemini

## Consensus
- Event ordering issue, not locking
- updateDOM may be called before handleSelection completes

## Recommended Path Forward
1. Add logging to verify event order

---

Want me to validate this with debug logs? [Yes/No]
```

If validated:

```
=== Validation Result ===

Suggestion: "Event ordering issue"

Evidence:
- [VALIDATE] handleSelection started at 12:00:00.100
- [VALIDATE] updateDOM called at 12:00:00.050 ← before selection!

Verdict: Suggestion VALID - updateDOM fires before handleSelection completes
```

## Arguments
$ARGUMENTS
