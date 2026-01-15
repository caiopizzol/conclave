# ⊛ conclave

Multi-model code review for [Claude Code](https://claude.com/claude-code). Run reviews across multiple AI CLI tools in parallel and get consensus-driven feedback.

## How It Works

```
/review
   │
   ├── Claude Opus ──► reviews independently
   ├── Codex ────────► reviews independently
   └── Gemini ───────► reviews independently

   ▼
   Synthesis: consensus highlighted, noise filtered
```

When multiple models flag the same issue, that's a stronger signal than any single review.

## Installation

```bash
# 1. Clone
git clone https://github.com/caiopizzol/conclave ~/dev/conclave

# 2. Symlink command
ln -sf ~/dev/conclave/commands/review.md ~/.claude/commands/review.md

# 3. Setup config
mkdir -p ~/.config/conclave
cp ~/dev/conclave/config/tools.example.json ~/.config/conclave/tools.json
cp ~/dev/conclave/config/prompt.example.md ~/.config/conclave/prompt.md
```

## Configuration

### Tools (`~/.config/conclave/tools.json`)

```json
{
  "tools": {
    "codex": {
      "enabled": true,
      "command": "codex exec --ask-for-approval never",
      "description": "OpenAI Codex"
    },
    "claude-opus": {
      "enabled": true,
      "command": "claude --model opus --print",
      "description": "Claude Opus"
    }
  },
  "prompt_file": "~/.config/conclave/prompt.md"
}
```

### Prompt (`~/.config/conclave/prompt.md`)

Customize review instructions with template variables:

- `{{branch}}` — current branch
- `{{target_branch}}` — target branch
- `{{diff}}` — the diff content

### Authentication

| Tool   | Install                             |
| ------ | ----------------------------------- |
| Codex  | `npm install -g @openai/codex`      |
| Claude | Built-in                            |
| Gemini | `npm install -g @google/gemini-cli` |

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
