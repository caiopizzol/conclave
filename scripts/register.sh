#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p ~/.claude/skills

# Replace the installed skill with the current repo copy. The skill is
# self-contained: SKILL.md references its bundled scripts via ${CLAUDE_SKILL_DIR},
# so the install does not depend on the repo's path on disk.
rm -rf ~/.claude/skills/consult
cp -R "$DIR/skills/consult" ~/.claude/skills/consult

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
echo "  skill: ~/.claude/skills/consult/SKILL.md"
echo "  state: ~/.local/state/conclave/"
echo ""
echo "Invoke /consult \"your question\" inside Claude Code."
echo "Re-run 'bun run register' after pulling new conclave changes."
