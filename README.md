<img height="200" alt="conclave-logo" src="https://github.com/user-attachments/assets/9bfb9226-fef1-45c8-bc6f-2c0aa98487c5" />

[![GitHub release](https://img.shields.io/github/v/release/caiopizzol/conclave)](https://github.com/caiopizzol/conclave/releases)

Multi-model AI collaboration for [Claude Code](https://claude.com/claude-code). Get consensus-driven code reviews and second opinions from multiple AI models in parallel.

## Commands

| Command | Purpose |
|---------|---------|
| `/review` | Multi-model code review on your staged changes |
| `/consult` | Get a second opinion when stuck on a problem |

## How It Works

```
/review                              /consult "why is this broken?"
   │                                    │
   ├── Codex ───► reviews diff          ├── Codex ───► reads conversation
   ├── Gemini ──► reviews diff          ├── Gemini ──► reads conversation
   ├── Claude ──► reviews diff          ├── Claude ──► reads conversation
   └── ...                              └── ...
   │                                    │
   ▼                                    ▼
   Consensus: issues flagged            Synthesis: consensus suggestions,
   by 2+ models highlighted             unique perspectives, disagreements
```

**Why multiple models?**
- Different training data → different blind spots
- 2+ models flagging the same issue → stronger signal
- Diverse perspectives surface better solutions

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
  "persistence": {
    "enabled": true,
    "required": false,
    "data_dir": "~/.local/share/conclave/reviews"
  },
  "tools": {
    "codex": {
      "enabled": true,
      "scope": ["review", "consult"],
      "command": "codex exec --full-auto -",
      "model": "gpt-5.2-codex",
      "description": "OpenAI Codex CLI"
    },
    "claude-opus": {
      "enabled": true,
      "scope": ["consult"],
      "command": "claude --print",
      "model": "opus",
      "description": "Claude Code (Opus)"
    },
    "gemini": {
      "enabled": true,
      "scope": ["review", "consult"],
      "command": "gemini -o text",
      "model": "gemini-3-pro-preview",
      "description": "Google Gemini CLI"
    }
  },
  "prompts": {
    "review": "~/.config/conclave/prompt.md",
    "consult": "~/.config/conclave/consult-prompt.md"
  }
}
```

#### Tool Fields

| Field | Required | Description |
|-------|----------|-------------|
| `enabled` | Yes | Whether to use this tool |
| `scope` | No | Array of commands: `["review"]`, `["consult"]`, or `["review", "consult"]`. If omitted, tool is used for all commands |
| `command` | Yes | CLI command to run |
| `model` | No | Model to use (injected via `--model` or `-m` flag) |
| `description` | No | Human-readable description |

You can define multiple entries for the same provider with different models (e.g., `claude-opus` and `claude-sonnet`).

#### Persistence Fields

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` | Save review results to disk for later analysis |
| `required` | `false` | If `true`, halt on persistence failure instead of continuing |
| `data_dir` | `~/.local/share/conclave/reviews` | Directory for saved review data |

Review results are saved as JSON files containing raw model outputs, timestamps, and investigation results. This enables:
- Tracking review history across PRs
- Analyzing model performance over time
- Recovering from context compaction

**Supported models:**

| Tool    | Models                                                                                                                         | Documentation                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Codex   | `gpt-5.2-codex`, `gpt-5.1-codex-mini`, `gpt-5.1-codex-max`, `gpt-5.2`                                                          | [Codex Models](https://developers.openai.com/codex/models/)    |
| Claude  | `opus`, `sonnet`, `haiku` (aliases) or full names like `claude-opus-4-5-20251101`                                              | [CLI Reference](https://code.claude.com/docs/en/cli-reference) |
| Gemini  | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-pro-preview`, `gemini-3-flash-preview`                                         | [Gemini CLI](https://geminicli.com/docs/cli/model/)            |
| Qwen    | `coder-model` (default), `vision-model`                                                                                        | [Qwen Code Docs](https://qwenlm.github.io/qwen-code-docs/)     |
| Mistral | Config-based (`~/.vibe/config.toml`)                                                                                           | [Mistral Vibe Docs](https://docs.mistral.ai/mistral-vibe/)     |
| Grok    | `grok-code-fast-1`, `grok-4-1-fast-*`, `grok-4-fast-*`, `grok-3`, `grok-3-mini`                                                 | [xAI API Models](https://docs.x.ai/docs/models)                |
| Ollama  | Cloud: `minimax-m2.5:cloud`, `glm-5:cloud`, `kimi-k2.5:cloud`, or any model from [library](https://ollama.com/library). Local: `qwen2.5-coder:7b` | [Ollama Library](https://ollama.com/library) |

> **Note:** Ollama models use `ollama run` directly. Cloud models (`:cloud` suffix) require an Ollama account — sign up at [ollama.com](https://ollama.com). Local models (e.g., `qwen2.5-coder:7b`) run on your machine and require ~8GB+ RAM for 7B models.

> **Note:** Mistral and Grok use command-line argument passing (not stdin), which has a ~200KB limit on macOS. Very large diffs may cause these tools to fail while other tools succeed.

> **Note:** Grok uses the community CLI ([`@vibe-kit/grok-cli`](https://github.com/superagent-ai/grok-cli)) until xAI releases the official "Grok Build" CLI.

### Prompts

Customize prompts for each command:

| File | Template Variables |
|------|-------------------|
| `~/.config/conclave/prompt.md` | `{{branch}}`, `{{target_branch}}`, `{{diff}}` |
| `~/.config/conclave/consult-prompt.md` | `{{history_file}}`, `{{question}}`, `{{cwd}}` |

### Authentication

| Tool    | Install                                                                       |
| ------- | ----------------------------------------------------------------------------- |
| Codex   | `npm install -g @openai/codex`                                                |
| Claude  | Built-in                                                                      |
| Gemini  | `npm install -g @google/gemini-cli`                                           |
| Qwen    | `npm install -g @qwen-code/qwen-code`                                         |
| Mistral | `pipx install mistral-vibe`                                                   |
| Grok    | `bun add -g @vibe-kit/grok-cli`; `export GROK_API_KEY="key"` in `~/.zshrc`    |
| Ollama  | [ollama.com/download](https://ollama.com/download); cloud: `ollama login`; local: `ollama pull <model>` |

## Usage

### Code Review

```bash
# Review staged changes
git add -p
/review
```

### Second Opinion

```bash
# When stuck on a problem
/consult "why is the table rendering broken after paste?"

# When going in circles
/consult "I've tried X, Y, Z but none work"

# Validate an approach
/consult "is this the right way to handle state here?"
```

`/consult` passes your Claude Code conversation history to external models, so they can see what's already been tried and avoid suggesting the same things.

## Philosophy

More models ≠ better. The value is **consensus**:

- 1 model flags issue → might be noise
- 2+ models flag same issue → likely real
- Different perspectives → surface blind spots

Conclave surfaces what matters.

## Workflow

`/review` follows a state machine pattern with checkpoints to ensure reliability:

```
[INIT] → [GATHERING] → [SPAWNING] → [TOOLS_COMPLETE]
                                          │
                                    ⛔ CHECKPOINT
                                          │
                                    [PERSISTED] → [SYNTHESIZING] → [INVESTIGATING] → [COMPLETE]
```

The ⛔ checkpoint ensures review data is persisted before synthesis. If `persistence.required` is `true`, the workflow halts on persistence failure.

## License

MIT
