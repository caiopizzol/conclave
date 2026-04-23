#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Create directories
mkdir -p ~/.claude/commands ~/.claude/scripts ~/.config/conclave

# Core: engine script
ln -sf "$DIR/scripts/conclave-run.sh" ~/.claude/scripts/conclave-run.sh

# Coordinator for stateful commands (e.g. /converge)
ln -sf "$DIR/scripts/conclave-converge.sh" ~/.claude/scripts/conclave-converge.sh
ln -sf "$DIR/scripts/conclave-converge.ts" ~/.claude/scripts/conclave-converge.ts
chmod +x "$DIR/scripts/conclave-converge.sh" 2>/dev/null || true

# Examples: commands
ln -sf "$DIR/examples/commands/review.md" ~/.claude/commands/review.md
ln -sf "$DIR/examples/commands/consult.md" ~/.claude/commands/consult.md
ln -sf "$DIR/examples/commands/converge.md" ~/.claude/commands/converge.md

# Config (copy only if not already present)
cp -n "$DIR/examples/config/tools.json" ~/.config/conclave/tools.json 2>/dev/null || true
cp -n "$DIR/examples/config/prompt.md" ~/.config/conclave/prompt.md 2>/dev/null || true
cp -n "$DIR/examples/config/consult-prompt.md" ~/.config/conclave/consult-prompt.md 2>/dev/null || true

# Clean up old agent from previous versions
rm -f ~/.claude/agents/review-investigator.md

echo "⊛ conclave registered"
echo "  engine:      ~/.claude/scripts/conclave-run.sh"
echo "  coordinator: ~/.claude/scripts/conclave-converge.sh"
echo "  commands:    /review, /consult, /converge"
echo "  config:      ~/.config/conclave/"
echo ""
echo "Optional: run 'bun run register:agents' for investigator agents"
