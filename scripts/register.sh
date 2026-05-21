#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p ~/.claude/skills/consult

# The skill is the only invocation surface. It calls the helper directly at
# the repo path (sed-substituted below), so there's no symlink in ~/.claude/scripts.
sed "s|{{CONCLAVE_REPO}}|$DIR|g" "$DIR/examples/skills/consult/SKILL.md" \
	> ~/.claude/skills/consult/SKILL.md

# Remove anything from older conclave installs.
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
