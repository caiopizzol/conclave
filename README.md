<img height="200" alt="conclave-logo" src="https://github.com/user-attachments/assets/9bfb9226-fef1-45c8-bc6f-2c0aa98487c5" />

[![GitHub release](https://img.shields.io/github/v/release/caiopizzol/conclave)](https://github.com/caiopizzol/conclave/releases)

Consensus before commit.

Every AI model has blind spots. They hallucinate differently, miss different edge cases, get confident about different wrong things. Conclave runs multiple AI CLIs in parallel and surfaces where they agree. When 2 out of 3 models flag the same issue, it's probably real. When only one does, it might be noise.

One command. Multiple perspectives. Clear signal.

## What It Is

A shell script that reads your config, runs a prompt through every AI CLI you have installed, and returns structured JSON. That's the core. Everything else — the `/review` command, the `/consult` command, the investigator agents — those are examples you can use, modify, or replace.

```
your prompt ──► conclave-run.sh ──► Codex ──►┐
                                   Gemini ──►├──► JSON results
                                   Claude ──►┘
```

## Installation

```bash
git clone https://github.com/caiopizzol/conclave ~/dev/conclave
cd ~/dev/conclave
bun run register
```

**Requires**: [jq](https://jqlang.org/) (`brew install jq`)

This installs the engine script and example commands. To unregister: `bun run unregister`.

## Quick Start

The engine script works standalone:

```bash
# Write a prompt
echo "What are the pros and cons of server components?" > /tmp/prompt.md

# Run it through your configured models
bash ~/.claude/scripts/conclave-run.sh --scope review --prompt /tmp/prompt.md
```

Returns JSON:
```json
{
  "tools_run": ["codex", "claude-opus"],
  "results": {
    "codex": { "model": "gpt-5.3-codex", "success": true, "output": "..." },
    "claude-opus": { "model": "opus", "success": true, "output": "..." }
  }
}
```

Or use the example slash commands inside Claude Code:

```bash
git add -p && /review                          # multi-model code review
/consult "why is the table rendering broken?"  # second opinion from multiple models
```

## Configuration

Edit `~/.config/conclave/tools.json`:

```json
{
  "tools": {
    "codex": {
      "enabled": true,
      "command": "codex exec --full-auto -m gpt-5.3-codex -",
      "model": "gpt-5.3-codex"
    },
    "claude-opus": {
      "enabled": true,
      "command": "CLAUDECODE=0 claude --print --model opus",
      "model": "opus"
    },
    "gemini": {
      "enabled": false,
      "command": "gemini -o text"
    }
  }
}
```

Add any CLI tool that accepts a prompt via stdin. For tools that take the prompt as an argument instead, set `"input": "argument"`.

### Tool Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `enabled` | Yes | — | Whether to use this tool |
| `command` | Yes | — | CLI command to run |
| `scope` | No | all | Array of scopes: `["review"]`, `["consult"]`, or both. Omit to use for everything |
| `input` | No | `"stdin"` | `"stdin"` (piped) or `"argument"` (appended to command) |
| `model` | No | — | Model name (for display) |

### Supported Tools

| Tool | Install |
|------|---------|
| Codex | `npm install -g @openai/codex` |
| Claude | Built-in |
| Gemini | `npm install -g @google/gemini-cli` |
| Qwen | `npm install -g @qwen-code/qwen-code` |
| Mistral | `pipx install mistral-vibe` |
| Grok | `bun add -g @vibe-kit/grok-cli` |
| Ollama | [ollama.com/download](https://ollama.com/download) |

Any CLI that reads from stdin works. Configure it and it joins the council.

## Create Your Own Command

Create `~/.claude/commands/my-command.md`:

```markdown
---
description: "My custom multi-model command"
allowed-tools: Bash, Read
---

# My Command

\```bash
cat > /tmp/prompt.md << 'EOF'
Your prompt here. $ARGUMENTS
EOF
\```

\```bash
bash ~/.claude/scripts/conclave-run.sh --scope my-command --prompt /tmp/prompt.md
\```

Parse the JSON and present results.
```

Add your scope to the config, or omit `scope` to use all tools:

```json
{ "codex": { "enabled": true, "scope": ["review", "consult", "my-command"] } }
```

Then: `/my-command "refactor the auth module"`

## Architecture

```
conclave/
├── scripts/
│   ├── conclave-run.sh       # Core engine
│   ├── register.sh
│   └── unregister.sh
└── examples/
    ├── commands/              # /review, /consult
    ├── agents/                # Optional investigator agents
    └── config/                # tools.json, prompt templates
```

The engine reads config, runs tools in parallel, returns JSON. Everything in `examples/` is a starting point — fork it, change it, replace it.

## Why

More models ≠ better. Consensus = signal.

- 1 model flags an issue → might be noise
- 2+ models flag the same issue → likely real
- Only one model sees it → you know to be skeptical

Conclave doesn't generate code. It doesn't replace your judgment. It surfaces what matters and dims what doesn't.

Inspired by [LLM Council](https://github.com/karpathy/llm-council).

## License

MIT
