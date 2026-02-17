#!/bin/bash
# Live CLI tests - runs actual API calls
# Usage: bun run test:live
#
# WARNING: This runs real API calls and incurs costs.
# Only run when you need to verify tools are working end-to-end.
#
# NOTE: Ollama cloud models require OLLAMA_API_KEY and run Claude Code via Ollama's API.
# NOTE: Grok requires GROK_API_KEY environment variable.

set -eo pipefail

PROMPT="Reply with exactly: OK"
EXPECTED="OK"
TIMEOUT=60  # 1 minute per tool

# Cross-platform timeout wrapper (macOS needs gtimeout from coreutils)
if command -v timeout &>/dev/null; then
    timeout_cmd="timeout"
elif command -v gtimeout &>/dev/null; then
    timeout_cmd="gtimeout"
else
    echo "Error: timeout or gtimeout required (brew install coreutils)"
    exit 1
fi

# Model overrides
MODEL_OLLAMA="${MODEL_OLLAMA:-qwen2.5-coder:7b}"

passed=0
failed=0
skipped=0

test_tool() {
    local name=$1
    local cmd=$2
    local use_stdin=$3  # true for most, false for mistral

    echo "Testing $name..."

    # Check if command exists
    local base_cmd="${cmd%% *}"
    if ! command -v "$base_cmd" &>/dev/null; then
        echo "  ○ $name skipped ($base_cmd not installed)"
        ((skipped++))
        return 2
    fi

    # Build env prefix (e.g., CLAUDECODE=0 for nested Claude Code sessions)
    local env_prefix="${4:-}"

    if [ "$use_stdin" = "true" ]; then
        result=$(echo "$PROMPT" | $env_prefix $timeout_cmd $TIMEOUT $cmd 2>&1)
    else
        result=$($env_prefix $timeout_cmd $TIMEOUT $cmd "$PROMPT" 2>&1)
    fi

    exit_code=$?

    if [ $exit_code -eq 124 ]; then
        echo "  ✗ $name timed out after ${TIMEOUT}s"
        ((failed++))
        return 1
    elif [ $exit_code -eq 0 ] && [[ "$result" == *"$EXPECTED"* ]]; then
        echo "  ✓ $name responded"
        ((passed++))
        return 0
    elif [ $exit_code -eq 0 ]; then
        echo "  ✗ $name responded but output missing '$EXPECTED'"
        echo "    Output: ${result:0:100}"
        ((failed++))
        return 1
    else
        echo "  ✗ $name failed (exit: $exit_code)"
        if [ -n "$result" ]; then
            echo "    Output: ${result:0:100}"
        fi
        ((failed++))
        return 1
    fi
}

echo "Live CLI Tests"
echo "=============="
echo "Prompt: \"$PROMPT\""
echo "Timeout: ${TIMEOUT}s per tool"
echo ""

# Test each tool with model flags where applicable
test_tool "codex" "codex exec --full-auto" true
test_tool "claude" "claude --print" true
test_tool "gemini" "gemini -o text" true
test_tool "qwen" "qwen -o text" true
test_tool "mistral" "vibe --output text -p" false
# Skip grok if API key not set
if [[ -n "$GROK_API_KEY" ]]; then
    test_tool "grok" "grok -p" false
else
    echo "Testing grok..."
    echo "  ○ grok skipped (GROK_API_KEY not set)"
    ((skipped++))
fi
# Ollama: cloud models run Claude Code via Ollama's API, local uses `ollama run`
if [[ "$MODEL_OLLAMA" == *":cloud"* ]]; then
    if [[ -z "$OLLAMA_API_KEY" ]]; then
        echo "Testing ollama..."
        echo "  ○ ollama skipped (cloud model requires OLLAMA_API_KEY)"
        ((skipped++))
    else
        test_tool "ollama" "claude --print --model $MODEL_OLLAMA" true "CLAUDECODE=0 ANTHROPIC_AUTH_TOKEN=$OLLAMA_API_KEY ANTHROPIC_API_KEY= ANTHROPIC_BASE_URL=https://ollama.com"
    fi
else
    test_tool "ollama" "ollama run $MODEL_OLLAMA" true
fi

echo ""
echo "Results: $passed passed, $failed failed, $skipped skipped"

if [ $failed -gt 0 ]; then
    exit 1
fi

exit 0
