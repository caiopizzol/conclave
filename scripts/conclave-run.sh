#!/bin/bash -l
# conclave-run.sh — Run a prompt through configured AI models in parallel
#
# Usage:
#   conclave-run.sh --scope <scope> --prompt <file> [options]
#
# Options:
#   --scope <name>       Filter tools by this scope (required)
#   --prompt <file>      Prompt file to send to each model (required)
#   --config <file>      Config file (default: ~/.config/conclave/tools.json)
#   --timeout <seconds>  Per-tool timeout in seconds (default: 300)
#
# Output:
#   JSON to stdout with results from each model:
#   {
#     "tools_run": ["codex", "gemini"],
#     "results": {
#       "codex": { "model": "gpt-5.3-codex", "success": true, "output": "..." },
#       "gemini": { "model": "gemini-3-pro", "success": false, "error": "..." }
#     }
#   }

set -uo pipefail

# --- Parse arguments ---

SCOPE=""
PROMPT_FILE=""
CONFIG="$HOME/.config/conclave/tools.json"
TIMEOUT=300

while [[ $# -gt 0 ]]; do
  case $1 in
    --scope)   SCOPE="$2"; shift 2 ;;
    --prompt)  PROMPT_FILE="$2"; shift 2 ;;
    --config)  CONFIG="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    -h|--help) sed -n '2,/^$/{ s/^# \?//; p }' "$0"; exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

# --- Validate ---

fail() { echo "{\"error\":\"$1\"}" >&2; exit 1; }

[[ -z "$SCOPE" ]]         && fail "--scope is required"
[[ -z "$PROMPT_FILE" ]]   && fail "--prompt is required"
[[ ! -f "$PROMPT_FILE" ]] && fail "prompt not found: $PROMPT_FILE"
[[ ! -f "$CONFIG" ]]      && fail "config not found: $CONFIG"
command -v jq &>/dev/null  || fail "jq is required (brew install jq)"

# --- Setup ---

SESSION=$(mktemp -d /tmp/conclave-XXXXXX)

# Timeout command (macOS uses gtimeout from coreutils)
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout $TIMEOUT"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout $TIMEOUT"
fi

# --- Get enabled tools for this scope ---

TOOLS=$(jq -r --arg scope "$SCOPE" '
  .tools | to_entries[]
  | select(.value.enabled == true)
  | select(.value.scope == null or (.value.scope | index($scope)))
  | .key
' "$CONFIG")

if [[ -z "$TOOLS" ]]; then
  echo '{"tools_run":[],"results":{}}'
  rm -rf "$SESSION"
  exit 0
fi

# --- Build and run tool scripts in parallel ---

PIDS=()
TOOL_LIST=()

for TOOL in $TOOLS; do
  CMD=$(jq -r --arg t "$TOOL" '.tools[$t].command' "$CONFIG")
  INPUT=$(jq -r --arg t "$TOOL" '.tools[$t].input // "stdin"' "$CONFIG")

  # Build a runner script for this tool
  if [[ "$INPUT" == "argument" ]]; then
    {
      echo '#!/bin/bash -l'
      echo "$CMD \"\$(cat '$PROMPT_FILE')\" 2>&1 \\"
      echo "  | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g; s/\x1b\[[0-9;?]*[hlGK]//g'"
    } > "$SESSION/$TOOL.sh"
  else
    {
      echo '#!/bin/bash -l'
      echo "cat '$PROMPT_FILE' | $CMD 2>&1 \\"
      echo "  | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g; s/\x1b\[[0-9;?]*[hlGK]//g'"
    } > "$SESSION/$TOOL.sh"
  fi

  chmod +x "$SESSION/$TOOL.sh"

  # Run in background with optional timeout
  (
    $TIMEOUT_CMD bash "$SESSION/$TOOL.sh" > "$SESSION/$TOOL.txt" 2>&1
    echo $? > "$SESSION/$TOOL.exit"
  ) &

  PIDS+=($!)
  TOOL_LIST+=("$TOOL")
done

# --- Wait for all tools to finish ---

for PID in "${PIDS[@]}"; do
  wait "$PID" 2>/dev/null || true
done

# --- Build JSON output ---

RESULT='{"tools_run":[],"results":{}}'

for TOOL in "${TOOL_LIST[@]}"; do
  MODEL=$(jq -r --arg t "$TOOL" '.tools[$t].model // "unknown"' "$CONFIG")
  EXIT_CODE=$(cat "$SESSION/$TOOL.exit" 2>/dev/null || echo "1")
  OUTPUT_FILE="$SESSION/$TOOL.txt"

  if [[ ! -f "$OUTPUT_FILE" ]]; then
    RESULT=$(echo "$RESULT" | jq \
      --arg t "$TOOL" --arg m "$MODEL" \
      '.tools_run += [$t] | .results[$t] = {model: $m, success: false, error: "no output"}')
    continue
  fi

  if [[ "$EXIT_CODE" == "0" ]]; then
    RESULT=$(echo "$RESULT" | jq \
      --arg t "$TOOL" --arg m "$MODEL" \
      --rawfile out "$OUTPUT_FILE" \
      '.tools_run += [$t] | .results[$t] = {model: $m, success: true, output: $out}')
  else
    RESULT=$(echo "$RESULT" | jq \
      --arg t "$TOOL" --arg m "$MODEL" \
      --rawfile out "$OUTPUT_FILE" \
      '.tools_run += [$t] | .results[$t] = {model: $m, success: false, error: $out}')
  fi
done

echo "$RESULT"

# --- Cleanup ---

rm -rf "$SESSION"
