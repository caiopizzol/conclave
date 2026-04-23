#!/bin/bash
# Verify /converge wires tool extraArgs through to the spawned CLIs.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/conclave-converge-extraargs-XXXXXX)"
HOME_DIR="$TMP_DIR/home"
BIN_DIR="$TMP_DIR/bin"
LOG_DIR="$TMP_DIR/logs"
SESSION_DIR="$TMP_DIR/session"
CONTEXT_FILE="$TMP_DIR/context.md"
OUTPUT_FILE="$TMP_DIR/final.json"

cleanup() {
	rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$HOME_DIR/.config/conclave" "$BIN_DIR" "$LOG_DIR" "$SESSION_DIR"

cat > "$BIN_DIR/fake-implementer" <<'EOF'
#!/bin/bash
set -euo pipefail

LOG_FILE="${TEST_LOG_DIR:?}/implementer.log"
{
  printf 'argc=%s\n' "$#"
  i=1
  for arg in "$@"; do
    printf 'arg%s=%s\n' "$i" "$arg"
    i=$((i + 1))
  done
  printf 'stdin='
  cat
  printf '\n'
} > "$LOG_FILE"

cat <<'JSON'
{"schema_version":1,"round":0,"plan_markdown":"Draft plan"}
JSON
EOF

cat > "$BIN_DIR/fake-reviewer" <<'EOF'
#!/bin/bash
set -euo pipefail

LOG_FILE="${TEST_LOG_DIR:?}/reviewer.log"
{
  printf 'argc=%s\n' "$#"
  i=1
  for arg in "$@"; do
    printf 'arg%s=%s\n' "$i" "$arg"
    i=$((i + 1))
  done
  printf 'stdin='
  cat
  printf '\n'
} > "$LOG_FILE"

cat <<'JSON'
{"schema_version":1,"round":1,"references":[],"new_issues":[],"overall":"lgtm"}
JSON
EOF

chmod +x "$BIN_DIR/fake-implementer" "$BIN_DIR/fake-reviewer"

cat > "$HOME_DIR/.config/conclave/tools.json" <<EOF
{
  "tools": {
    "claude-opus": {
      "enabled": true,
      "command": "$BIN_DIR/fake-implementer",
      "input": "argument",
      "extraArgs": [
        "--mcp-config",
        "$TMP_DIR/implementer config.json",
        "--allowedTools",
        "mcp__browser__*,mcp__github__*",
        "quote'arg"
      ]
    },
    "codex": {
      "enabled": true,
      "command": "$BIN_DIR/fake-reviewer",
      "input": "stdin",
      "extraArgs": [
        "--mcp-config",
        "$TMP_DIR/reviewer config.json",
        "--allowedTools",
        "mcp__filesystem__*",
        "quote'arg"
      ]
    }
  }
}
EOF

cat > "$CONTEXT_FILE" <<'EOF'
Tiny context for integration testing.
EOF

TEST_LOG_DIR="$LOG_DIR" HOME="$HOME_DIR" bun run "$ROOT_DIR/scripts/conclave-converge.ts" \
	--task "Verify extraArgs" \
	--context "$CONTEXT_FILE" \
	--session "$SESSION_DIR" \
	--max-rounds 1 \
	> "$OUTPUT_FILE"

assert_contains() {
	local file=$1
	local needle=$2

	if ! grep -F "$needle" "$file" >/dev/null; then
		echo "Expected '$needle' in $file" >&2
		echo "--- $file ---" >&2
		cat "$file" >&2
		exit 1
	fi
}

assert_contains "$OUTPUT_FILE" '"stop_reason": "no_open_blockers"'

assert_contains "$LOG_DIR/implementer.log" "arg1=--mcp-config"
assert_contains "$LOG_DIR/implementer.log" "arg2=$TMP_DIR/implementer config.json"
assert_contains "$LOG_DIR/implementer.log" "arg3=--allowedTools"
assert_contains "$LOG_DIR/implementer.log" "arg4=mcp__browser__*,mcp__github__*"
assert_contains "$LOG_DIR/implementer.log" "arg5=quote'arg"
assert_contains "$LOG_DIR/implementer.log" "arg6=You are the IMPLEMENTER in a conclave /converge session."
assert_contains "$LOG_DIR/implementer.log" "stdin="

assert_contains "$LOG_DIR/reviewer.log" "arg1=--mcp-config"
assert_contains "$LOG_DIR/reviewer.log" "arg2=$TMP_DIR/reviewer config.json"
assert_contains "$LOG_DIR/reviewer.log" "arg3=--allowedTools"
assert_contains "$LOG_DIR/reviewer.log" "arg4=mcp__filesystem__*"
assert_contains "$LOG_DIR/reviewer.log" "arg5=quote'arg"
assert_contains "$LOG_DIR/reviewer.log" "stdin=You are the REVIEWER in a conclave /converge session."
