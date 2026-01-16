<img height="200" alt="conclave-logo" src="https://github.com/user-attachments/assets/9bfb9226-fef1-45c8-bc6f-2c0aa98487c5" />

[![GitHub release](https://img.shields.io/github/v/release/caiopizzol/conclave)](https://github.com/caiopizzol/conclave/releases)

Multi-model code review for [Claude Code](https://claude.com/claude-code). Run reviews across multiple AI CLI tools in parallel and get consensus-driven feedback.

## How It Works

```
/review
   │
   ├── Claude Opus ──► reviews independently
   ├── Codex ────────► reviews independently
   ├── Gemini ───────► reviews independently
   ├── Qwen Code ────► reviews independently
   ├── Mistral Vibe ─► reviews independently
   └── Ollama ───────► reviews independently (local)

   ▼
   Synthesis: consensus highlighted, noise filtered
```

When multiple models flag the same issue, that's a stronger signal than any single review.

Enable/disable any combination of tools to get diverse perspectives from different training datasets.

## Inspiration

Inspired by [LLM Council](https://github.com/karpathy/llm-council) — the idea that multiple LLMs reviewing the same problem surfaces stronger signals than any single model.

## Installation

```bash
git clone https://github.com/caiopizzol/conclave ~/dev/conclave
cd ~/dev/conclave
bun run register
```

To unregister:

```bash
bun run unregister
```

## Configuration

### Tools (`~/.config/conclave/tools.json`)

```json
{
  "tools": {
    "codex": {
      "enabled": true,
      "command": "codex exec --full-auto -",
      "model": "gpt-5.2-codex",
      "description": "OpenAI Codex CLI"
    },
    "claude-opus": {
      "enabled": true,
      "command": "claude --print",
      "model": "opus",
      "description": "Claude Code (Opus)"
    },
    "claude-sonnet": {
      "enabled": false,
      "command": "claude --print",
      "model": "sonnet",
      "description": "Claude Code (Sonnet)"
    },
    "gemini": {
      "enabled": false,
      "command": "gemini -o text",
      "description": "Google Gemini CLI (uses default model)"
    },
    "qwen": {
      "enabled": false,
      "command": "qwen -o text",
      "description": "Qwen Code (Alibaba)"
    },
    "mistral": {
      "enabled": false,
      "command": "vibe --output text -p",
      "description": "Mistral Vibe (Devstral)"
    },
    "ollama": {
      "enabled": false,
      "command": "ollama run",
      "model": "qwen2.5-coder:7b",
      "description": "Ollama local models"
    }
  },
  "prompt_file": "~/.config/conclave/prompt.md"
}
```

You can define multiple entries for the same provider with different models (e.g., `claude-opus` and `claude-sonnet`).

The `model` field is optional for most tools. If omitted, each tool uses its default model. **Exception:** Ollama requires an explicit `model` since it has no default.

**Supported models:**

| Tool    | Models                                                                                                                         | Documentation                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Codex   | `gpt-5.2-codex`, `gpt-5.1-codex-mini`, `gpt-5.1-codex-max`, `gpt-5.2`                                                          | [Codex Models](https://developers.openai.com/codex/models/)    |
| Claude  | `opus`, `sonnet`, `haiku` (aliases) or full names like `claude-opus-4-5-20251101`                                              | [CLI Reference](https://code.claude.com/docs/en/cli-reference) |
| Gemini  | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-pro-preview`, `gemini-3-flash-preview`                                         | [Gemini CLI](https://geminicli.com/docs/cli/model/)            |
| Qwen    | `coder-model` (default), `vision-model`                                                                                        | [Qwen Code Docs](https://qwenlm.github.io/qwen-code-docs/)     |
| Mistral | Config-based (`~/.vibe/config.toml`)                                                                                           | [Mistral Vibe Docs](https://docs.mistral.ai/mistral-vibe/)     |
| Ollama  | `qwen2.5-coder:7b`, `qwen3-coder:30b`, `codellama:7b`, `deepseek-coder:6.7b`, `codegemma:7b`, `starcoder2:7b` | [Ollama Library](https://ollama.com/search?c=code)             |

> **Note:** Ollama models use `:tag` syntax for parameter sizes (e.g., `qwen2.5-coder:7b`). Larger models need more RAM: 7B ≈ 8GB, 13B ≈ 16GB, 30B+ ≈ 32GB+. MoE models like `qwen3-coder:30b` are more efficient (only 3.3B params active).

> **Note:** Mistral uses command-line argument passing (not stdin), which has a ~200KB limit on macOS. Very large diffs may cause Mistral to fail while other tools succeed.

### Prompt (`~/.config/conclave/prompt.md`)

Customize review instructions with template variables:

- `{{branch}}` — current branch
- `{{target_branch}}` — target branch
- `{{diff}}` — the diff content

### Authentication

| Tool    | Install                                                                       |
| ------- | ----------------------------------------------------------------------------- |
| Codex   | `npm install -g @openai/codex`                                                |
| Claude  | Built-in                                                                      |
| Gemini  | `npm install -g @google/gemini-cli`                                           |
| Qwen    | `npm install -g @qwen-code/qwen-code`                                         |
| Mistral | `pipx install mistral-vibe`                                                   |
| Ollama  | [ollama.com/download](https://ollama.com/download) then `ollama pull <model>` |

## Usage

```bash
/review
```

## Philosophy

More models ≠ better. The value is **consensus**:

- 1 model flags issue → might be noise
- 2+ models flag same issue → likely real

Conclave surfaces what matters.

## License

MIT
