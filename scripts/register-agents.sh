#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p ~/.claude/agents

ln -sf "$DIR/examples/agents/correctness-investigator.md" ~/.claude/agents/correctness-investigator.md
ln -sf "$DIR/examples/agents/dx-investigator.md" ~/.claude/agents/dx-investigator.md
ln -sf "$DIR/examples/agents/test-investigator.md" ~/.claude/agents/test-investigator.md
ln -sf "$DIR/examples/agents/multi-model-executor.md" ~/.claude/agents/multi-model-executor.md

echo "⊛ investigator agents registered"
