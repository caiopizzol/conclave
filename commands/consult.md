---
description: "Get a second opinion from multiple AI models when stuck on a problem. Use when going in circles, facing a tricky decision, or wanting alternative approaches."
argument-hint: "[problem description]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task, TaskOutput, AskUserQuestion, mcp__browser-tools__*
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

#### 5a: Write Prompt File

Write the complete consultation prompt to a temp file:

```bash
cat > /tmp/conclave-prompt.md << 'PROMPT_EOF'
{the complete consultation prompt from Step 4, with all template variables replaced}
PROMPT_EOF
```

#### 5b: Build Shell Scripts

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

#### 5c: Delegate Execution

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

After the executor returns, parse the JSON `results` object to extract each tool's output.

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
