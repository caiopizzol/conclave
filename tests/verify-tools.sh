#!/bin/bash
# Verify CLI tools are available and config is valid

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/examples/config/tools.json"

# Tools used by conclave
TOOLS=(codex claude gemini qwen vibe ollama grok jq)

echo "Checking CLI tools..."
missing=()
for tool in "${TOOLS[@]}"; do
    if command -v "$tool" &>/dev/null; then
        echo "  ✓ $tool"
    else
        echo "  ○ $tool (not installed)"
        missing+=("$tool")
    fi
done

if [ ${#missing[@]} -gt 0 ]; then
    echo ""
    echo "Note: ${#missing[@]} tool(s) not found. Install them to use all features."
fi

echo ""
echo "Validating config syntax..."
if ! command -v jq &>/dev/null; then
    echo "  ✗ jq not installed, cannot validate config"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "  ✗ $CONFIG_FILE not found"
    exit 1
fi

if jq empty "$CONFIG_FILE" 2>/dev/null; then
    echo "  ✓ $CONFIG_FILE is valid JSON"
else
    echo "  ✗ $CONFIG_FILE has invalid JSON syntax"
    exit 1
fi

echo ""
echo "Done."
