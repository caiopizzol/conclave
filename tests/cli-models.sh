#!/bin/bash
# Model validation tests - verifies all documented models work
# Usage: bun run test:models
#
# WARNING: This runs many API calls (one per model) and incurs significant costs.
# Only run when validating README model documentation is accurate.
#
# NOTE: Ollama cloud models (`:cloud` suffix) require OLLAMA_API_KEY environment variable.
# Get your API key at https://ollama.com
#
# NOTE: Grok models require GROK_API_KEY environment variable.
# Get your API key at https://console.x.ai

set -eo pipefail

PROMPT="Reply with exactly: OK"
EXPECTED="OK"
TIMEOUT=90  # 1.5 minutes per model (some are slower)

# Cross-platform timeout wrapper (macOS needs gtimeout from coreutils)
if command -v timeout &>/dev/null; then
    timeout_cmd="timeout"
elif command -v gtimeout &>/dev/null; then
    timeout_cmd="gtimeout"
else
    echo "Error: timeout or gtimeout required (brew install coreutils)"
    exit 1
fi

passed=0
failed=0
skipped=0

test_model() {
    local tool=$1
    local model=$2
    local cmd=$3
    local use_stdin=$4

    local name="$tool/$model"
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
        echo "  ✓ $name"
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

echo "Model Validation Tests"
echo "======================"
echo "Prompt: \"$PROMPT\""
echo "Timeout: ${TIMEOUT}s per model"
echo ""

# Codex models (4)
echo "--- Codex ---"
test_model "codex" "gpt-5.2-codex" "codex exec --full-auto -m gpt-5.2-codex -" true
test_model "codex" "gpt-5.1-codex-mini" "codex exec --full-auto -m gpt-5.1-codex-mini -" true
test_model "codex" "gpt-5.1-codex-max" "codex exec --full-auto -m gpt-5.1-codex-max -" true
test_model "codex" "gpt-5.2" "codex exec --full-auto -m gpt-5.2 -" true
echo ""

# Claude models (3)
echo "--- Claude ---"
test_model "claude" "opus" "claude --print --model opus" true
test_model "claude" "sonnet" "claude --print --model sonnet" true
test_model "claude" "haiku" "claude --print --model haiku" true
echo ""

# Gemini models (4)
echo "--- Gemini ---"
test_model "gemini" "gemini-2.5-pro" "gemini -o text -m gemini-2.5-pro" true
test_model "gemini" "gemini-2.5-flash" "gemini -o text -m gemini-2.5-flash" true
test_model "gemini" "gemini-3-pro-preview" "gemini -o text -m gemini-3-pro-preview" true
test_model "gemini" "gemini-3-flash-preview" "gemini -o text -m gemini-3-flash-preview" true
echo ""

# Qwen models (2)
echo "--- Qwen ---"
test_model "qwen" "coder-model" "qwen -o text -m coder-model" true
test_model "qwen" "vision-model" "qwen -o text -m vision-model" true
echo ""

# Mistral (1 - config-based)
echo "--- Mistral ---"
test_model "mistral" "default" "vibe --output text -p" false
echo ""

# Grok models (7 - text models only, excluding vision/image)
# Requires GROK_API_KEY environment variable
echo "--- Grok ---"
if [[ -n "$GROK_API_KEY" ]]; then
    test_model "grok" "grok-code-fast-1" "grok -p -m grok-code-fast-1" false
    test_model "grok" "grok-4-1-fast-reasoning" "grok -p -m grok-4-1-fast-reasoning" false
    test_model "grok" "grok-4-1-fast-non-reasoning" "grok -p -m grok-4-1-fast-non-reasoning" false
    test_model "grok" "grok-4-fast-reasoning" "grok -p -m grok-4-fast-reasoning" false
    test_model "grok" "grok-4-fast-non-reasoning" "grok -p -m grok-4-fast-non-reasoning" false
    test_model "grok" "grok-3" "grok -p -m grok-3" false
    test_model "grok" "grok-3-mini" "grok -p -m grok-3-mini" false
else
    echo "  ○ grok models skipped (GROK_API_KEY not set)"
    ((skipped+=7))
fi
echo ""

# Ollama models
# Cloud models require OLLAMA_API_KEY, local models must be pulled first
echo "--- Ollama ---"
if [[ -n "$OLLAMA_API_KEY" ]]; then
    test_model "ollama" "qwen3-coder:480b-cloud" "ollama run qwen3-coder:480b-cloud" true
    test_model "ollama" "devstral-2:123b-cloud" "ollama run devstral-2:123b-cloud" true
else
    echo "  ○ cloud models skipped (OLLAMA_API_KEY not set)"
    ((skipped+=2))
fi
test_model "ollama" "qwen2.5-coder:7b" "ollama run qwen2.5-coder:7b" true
echo ""

echo "======================"
echo "Results: $passed passed, $failed failed, $skipped skipped"
echo ""

if [ $failed -gt 0 ]; then
    echo "Some models failed - verify README documentation is accurate"
    exit 1
fi

if [ $passed -eq 0 ]; then
    echo "No models were tested (all tools missing)"
    exit 1
fi

echo "All documented models validated successfully"
exit 0
