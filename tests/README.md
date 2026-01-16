# Tests

## Available Tests

### `verify-tools.sh`

Checks that CLI tools used by conclave are installed and validates config file syntax.

**Run manually:**
```bash
bun run test:tools
```

**What it checks:**
- CLI tools: `codex`, `claude`, `gemini`, `qwen`, `vibe`, `jq`
- JSON syntax of `config/tools.example.json`

Missing CLI tools are reported but don't cause failure. Requires `jq` for config validation - exits 1 if `jq` is missing or config JSON is invalid.

## Pre-commit Hook

Tests run automatically via lefthook on `git commit`.

## Future Phases

- Live API tests (optional, requires API keys)
- Integration tests for review workflow
