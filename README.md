
<img height="200" alt="conclave-logo" src="https://github.com/user-attachments/assets/9bfb9226-fef1-45c8-bc6f-2c0aa98487c5" />

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
git clone https://github.com/caiopizzol/conclave ~/dev/conclave
cd ~/dev/conclave
bun run setup
```

To uninstall:
```bash
bun run uninstall
```

## Configuration

### Tools (`~/.config/conclave/tools.json`)

```json
{
  "tools": {
    "codex": {
      "enabled": true,
      "command": "codex exec --full-auto -",
      "description": "OpenAI Codex CLI"
    },
    "claude": {
      "enabled": true,
      "command": "claude --print",
      "description": "Claude Code"
    },
    "gemini": {
      "enabled": false,
      "command": "gemini",
      "description": "Google Gemini CLI"
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
