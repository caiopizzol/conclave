#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Wipe any previous install so stale files from older layouts don't linger.
rm -rf ~/.claude/skills/consult
mkdir -p ~/.claude/skills/consult/scripts

# Copy the skill's UX file as-is.
cp "$DIR/skills/consult/SKILL.md" ~/.claude/skills/consult/SKILL.md

# Bundle the recipe entry into a single self-contained JS file. The bundler
# inlines src/core/* so the installed skill needs no other files or import
# paths back into the repo.
bun build "$DIR/src/recipes/consult.ts" \
	--target=bun \
	--outfile ~/.claude/skills/consult/scripts/consult.js

# Clean up artifacts from older conclave installs.
rm -f ~/.claude/commands/consult.md
rm -f ~/.claude/commands/review.md
rm -f ~/.claude/commands/converge.md
rm -f ~/.claude/scripts/conclave-advise.ts
rm -f ~/.claude/scripts/conclave-run.sh
rm -f ~/.claude/scripts/conclave-converge.sh
rm -f ~/.claude/scripts/conclave-converge.ts
rm -f ~/.claude/agents/correctness-investigator.md
rm -f ~/.claude/agents/dx-investigator.md
rm -f ~/.claude/agents/test-investigator.md
rm -f ~/.claude/agents/multi-model-executor.md
rm -f ~/.claude/agents/review-investigator.md

echo "⊛ conclave registered"
echo "  recipe: ~/.claude/skills/consult/  (/consult)"
echo "  state:  ~/.local/state/conclave/"
echo ""
echo "Invoke /consult \"your question\" inside Claude Code."
echo "Re-run 'bun run register' after pulling new conclave changes."
