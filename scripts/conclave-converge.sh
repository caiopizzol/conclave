#!/bin/bash -l
# conclave-converge.sh — thin wrapper that runs the TypeScript coordinator via bun.
#
# Usage:
#   conclave-converge.sh --task <text> --context <file> --session <dir> [--max-rounds N]
#
# See docs/converge.md for design.

set -uo pipefail

# Resolve the symlink to find the real script dir, so conclave-converge.ts
# is picked up from the actual conclave checkout even when invoked via
# ~/.claude/scripts/conclave-converge.sh.
resolve_symlink() {
  local target="$1"
  while [[ -L "$target" ]]; do
    local link
    link="$(readlink "$target")"
    if [[ "$link" = /* ]]; then
      target="$link"
    else
      target="$(cd "$(dirname "$target")" && pwd)/$link"
    fi
  done
  printf '%s\n' "$target"
}

SELF="$(resolve_symlink "$0")"
SCRIPT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
TS_FILE="$SCRIPT_DIR/conclave-converge.ts"

if [[ ! -f "$TS_FILE" ]]; then
  echo "conclave-converge: coordinator not found at $TS_FILE" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "conclave-converge: 'bun' is required (https://bun.sh)" >&2
  exit 1
fi

exec bun run "$TS_FILE" "$@"
