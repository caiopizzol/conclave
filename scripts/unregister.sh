#!/bin/bash
set -e

# Remove commands
rm -f ~/.claude/commands/review.md
rm -f ~/.claude/commands/consult.md
rm -f ~/.claude/commands/converge.md

# Remove engine + coordinator
rm -f ~/.claude/scripts/conclave-run.sh
rm -f ~/.claude/scripts/conclave-converge.sh
rm -f ~/.claude/scripts/conclave-converge.ts

# Remove agents (if installed)
rm -f ~/.claude/agents/correctness-investigator.md
rm -f ~/.claude/agents/dx-investigator.md
rm -f ~/.claude/agents/test-investigator.md
rm -f ~/.claude/agents/multi-model-executor.md
rm -f ~/.claude/agents/review-investigator.md

echo "⊛ conclave unregistered"
echo "  config preserved at ~/.config/conclave/"
