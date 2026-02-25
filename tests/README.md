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

### `cli-live.sh`

Live tests that verify each CLI tool works end-to-end by making actual API calls.

**Note!!:** This runs real API calls and incurs costs. Only run when needed.

**Run:**

```bash
bun run test:live
```

**Requirements:**

- `timeout` (Linux) or `gtimeout` (macOS: `brew install coreutils`)

**What it tests:**

| Tool    | Command                                    | Input Method |
| ------- | ------------------------------------------ | ------------ |
| Codex   | `codex exec --full-auto -m $MODEL_CODEX -` | stdin        |
| Claude  | `claude --print --model $MODEL_CLAUDE`     | stdin        |
| Gemini  | `gemini -o text`                           | stdin        |
| Qwen    | `qwen -o text`                             | stdin        |
| Mistral | `vibe --output text -p`                    | argument     |

**Test criteria:**

- Tool responds without error
- Output contains expected response ("OK")
- Model flag is accepted (where applicable)

**Environment variables:**

- `MODEL_CODEX` - Override codex model (default: `gpt-5.3-codex`)
- `MODEL_CLAUDE` - Override claude model (default: `sonnet`)

**Exit codes:**

- 0: All installed tools passed
- 1: At least one tool failed

Missing tools are skipped (not failures).

### `cli-models.sh`

Validates all documented models from README work correctly. Use to verify documentation accuracy.

**Note!!:** This runs many API calls (one per model) and incurs significant costs. Only run when validating README.

**Run:**

```bash
bun run test:models
```

**What it tests:**

| Tool    | Models                                                                                 |
| ------- | -------------------------------------------------------------------------------------- |
| Codex   | `gpt-5.3-codex`, `gpt-5.2-codex`, `gpt-5.1-codex-mini`, `gpt-5.1-codex-max`            |
| Claude  | `opus`, `sonnet`, `haiku`                                                              |
| Gemini  | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-pro-preview`, `gemini-3-flash-preview` |
| Qwen    | `coder-model`, `vision-model`                                                          |
| Mistral | default (config-based)                                                                 |

**Exit codes:**

- 0: All documented models validated
- 1: At least one model failed (README may need updating)

## Future Phases

- Integration tests for full review workflow
