#!/bin/bash
# Live CLI tests - runs actual API calls
# Usage: bun run test:live
#
# WARNING: This runs real API calls and incurs costs.
# Only run when you need to verify tools are working end-to-end.

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

# Model overrides via environment variables
MODEL_CODEX="${MODEL_CODEX:-gpt-5.2-codex}"
MODEL_CLAUDE="${MODEL_CLAUDE:-sonnet}"

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

    if [ "$use_stdin" = "true" ]; then
        result=$(echo "$PROMPT" | $timeout_cmd $TIMEOUT $cmd 2>&1)
    else
        result=$($timeout_cmd $TIMEOUT $cmd "$PROMPT" 2>&1)
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
test_tool "codex" "codex exec --full-auto -m $MODEL_CODEX -" true
test_tool "claude" "claude --print --model $MODEL_CLAUDE" true
test_tool "gemini" "gemini -o text" true
test_tool "qwen" "qwen -o text" true
test_tool "mistral" "vibe --output text -p" false

echo ""
echo "Results: $passed passed, $failed failed, $skipped skipped"

if [ $failed -gt 0 ]; then
    exit 1
fi

exit 0
