---
description: "Get a second opinion from multiple AI models when stuck on a problem."
argument-hint: "[problem description]"
allowed-tools: Bash, Read, AskUserQuestion
---

# Multi-Model Consultation

Get perspectives from multiple AI models when stuck, going in circles, or wanting alternative approaches.

## Step 1: Gather Context

### Find Session History

Locate the current Claude Code conversation history:

```bash
CWD=$(pwd)
SESSION_ID=$(grep "\"project\":\"$CWD\"" ~/.claude/history.jsonl | tail -1 | python3 -c "import sys, json; print(json.loads(sys.stdin.read())['sessionId'])")
PROJECT_PATH=$(echo "$CWD" | sed 's|/|-|g' | sed 's|^-||')
HISTORY_FILE=~/.claude/projects/-${PROJECT_PATH}/${SESSION_ID}.jsonl

if [ ! -f "$HISTORY_FILE" ]; then
  HISTORY_FILE=$(find ~/.claude/projects -name "${SESSION_ID}.jsonl" 2>/dev/null | head -1)
fi
```

### Extract Recent History

Extract the last ~50 conversation turns for context:

```bash
tail -200 "$HISTORY_FILE" | jq -r '
  select(.type == "user" or .type == "assistant")
  | .type + ": " + (
    if .message.content | type == "array"
    then (.message.content | map(select(.type == "text") | .text) | join(" "))
    else (.message.content // "")
    end
  )' 2>/dev/null | tail -c 100000 > /tmp/conclave-history.txt
```

If extraction fails (python3 or jq missing, no history), continue without history — the question alone is usually sufficient.

## Step 2: Build Prompt

Read the prompt template:

```bash
cat ~/.config/conclave/consult-prompt.md
```

If it doesn't exist, use a sensible default that asks for alternative approaches, root causes, and red flags.

Replace template variables:
- `{{history}}` → contents of `/tmp/conclave-history.txt` (the extracted conversation turns)
- `{{history_file}}` → path to the raw JSONL history file (for tools with file access)
- `{{question}}` → the user's question from $ARGUMENTS
- `{{cwd}}` → current working directory

Create a unique session directory and write the prompt:

```bash
SESSION_DIR=$(mktemp -d /tmp/conclave-consult-XXXXXX)
cat > $SESSION_DIR/prompt.md << 'PROMPT_EOF'
{completed prompt with all variables replaced}
PROMPT_EOF
```

## Step 3: Run Models

```bash
bash ~/.claude/scripts/conclave-run.sh --scope consult --prompt $SESSION_DIR/prompt.md
```

This reads `~/.config/conclave/tools.json`, filters tools with `"consult"` in their scope, and runs them all in parallel.

If no tools are enabled for the consult scope, tell the user to check their config.

## Step 4: Synthesize

Analyze all responses and present:

```
=== Consultation Results ===

Models consulted: [list]

## Consensus
- [Points multiple models raised]

## Unique Perspectives

### From {tool} ({model})
[Unique insight or approach]

### From {tool} ({model})
[Different angle or suggestion]

## Disagreements
- [Where models differ and the tradeoff]

## Recommended Path Forward
1. [Most promising suggestion]
2. [Alternative if #1 doesn't work]
```

## Step 5: Next Steps

Ask: "Want me to try the top suggestion?"

- "Yes" → implement the most promising approach
- "Try alternative" → go with the backup
- "Need more context" → ask a follow-up consultation

## Error Handling

- If a tool fails, continue with others
- If all tools fail, suggest manual debugging or a different approach
- If no tools enabled for consult scope, tell user to check config

## Arguments
$ARGUMENTS
