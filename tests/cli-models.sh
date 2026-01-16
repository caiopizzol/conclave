#!/bin/bash
# Model validation tests - verifies all documented models work
# Usage: bun run test:models
#
# WARNING: This runs many API calls (one per model) and incurs significant costs.
# Only run when validating README model documentation is accurate.
#
# NOTE: Ollama models must be pulled locally first (e.g., `ollama pull qwen2.5-coder:7b`).
# If not pulled, ollama will attempt to download them, which can be slow and cause timeouts.

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

# Ollama coder models (popular models from ollama.com/library, requires models to be pulled first)
# See: https://ollama.com/search?c=code
echo "--- Ollama (Coder Models) ---"
test_model "ollama" "codegemma:7b" "ollama run codegemma:7b" true                  
test_model "ollama" "codellama:7b" "ollama run codellama:7b" true
test_model "ollama" "deepseek-coder:6.7b" "ollama run deepseek-coder:6.7b" true   
test_model "ollama" "starcoder2:7b" "ollama run starcoder2:7b" true
test_model "ollama" "qwen2.5-coder:7b" "ollama run qwen2.5-coder:7b" true 
test_model "ollama" "qwen3-coder:30b" "ollama run qwen3-coder:30b" true            
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
