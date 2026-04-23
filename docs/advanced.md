# Advanced

Configuration, custom commands, and the engine's JSON contract. For the mental model, start with the [README](../README.md). For the `/converge` coordinator specifically, see [converge.md](converge.md).

## Configuration

`bun run register` installs a working `~/.config/conclave/tools.json` if you don't already have one. The default config enables `codex` and `claude-opus`. Other tools in the default config are disabled until you flip them on.

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

Any CLI that reads a prompt on stdin works. For tools that want the prompt as an argument, set `"input": "argument"`.

### Tool fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `enabled` | Yes | - | Whether to use this tool |
| `command` | Yes | - | CLI command to run |
| `scope` | No | all | Array of scopes: `["review"]`, `["consult"]`, or both. Omit to use for everything |
| `input` | No | `"stdin"` | `"stdin"` (piped) or `"argument"` (appended to command) |
| `model` | No | - | Model name (for display) |

### Supported CLIs

| Tool | Install |
|------|---------|
| Codex | `npm install -g @openai/codex` |
| Claude | Built-in with Claude Code |
| Gemini | `npm install -g @google/gemini-cli` |
| Qwen | `npm install -g @qwen-code/qwen-code` |
| Mistral | `pipx install mistral-vibe` |
| Grok | `bun add -g @vibe-kit/grok-cli` |
| Ollama | [ollama.com/download](https://ollama.com/download) |

Any CLI that reads from stdin can join the council.

## Engine usage (standalone)

The core engine is a shell script. It works outside Claude Code:

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

## Create your own command

Drop a file in `~/.claude/commands/my-command.md`:

````markdown
---
description: "My custom multi-model command"
allowed-tools: Bash, Read
---

# My Command

```bash
cat > /tmp/prompt.md << 'EOF'
Your prompt here. $ARGUMENTS
EOF
```

```bash
bash ~/.claude/scripts/conclave-run.sh --scope my-command --prompt /tmp/prompt.md
```

Parse the JSON and present results.
````

Scope the tools you want for that command (or omit `scope` to use all):

```json
{ "codex": { "enabled": true, "scope": ["review", "consult", "my-command"] } }
```

Then: `/my-command "refactor the auth module"`

## Architecture

```
conclave/
├── scripts/
│   ├── conclave-run.sh              # Core engine (transport)
│   ├── conclave-converge.sh         # /converge wrapper
│   ├── conclave-converge.ts         # /converge coordinator (state machine)
│   ├── register.sh
│   └── unregister.sh
├── docs/
│   ├── advanced.md                  # This file
│   └── converge.md                  # /converge design
└── examples/
    ├── commands/                    # /review, /consult, /converge
    ├── agents/                      # Optional investigator agents
    └── config/                      # tools.json, prompt templates
```

The engine reads config, runs tools in parallel, returns JSON. The coordinator runs the `/converge` state machine on top of the engine. Everything in `examples/` is a starting point - fork it, change it, replace it.
