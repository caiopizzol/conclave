#!/bin/bash
set -e

# Persistent /consult
rm -rf ~/.claude/skills/consult
# Older versions also symlinked the helper into ~/.claude/scripts/; clean it up
# if present.
rm -f ~/.claude/scripts/conclave-advise.ts

# Anything left from older conclave installs
rm -f ~/.claude/commands/consult.md
rm -f ~/.claude/commands/review.md
rm -f ~/.claude/commands/converge.md
rm -f ~/.claude/scripts/conclave-run.sh
rm -f ~/.claude/scripts/conclave-converge.sh
rm -f ~/.claude/scripts/conclave-converge.ts
rm -f ~/.claude/agents/correctness-investigator.md
rm -f ~/.claude/agents/dx-investigator.md
rm -f ~/.claude/agents/test-investigator.md
rm -f ~/.claude/agents/multi-model-executor.md
rm -f ~/.claude/agents/review-investigator.md

echo "⊛ conclave unregistered"
echo "  advisor state preserved at ~/.local/state/conclave/"
