<img height="200" alt="conclave-logo" src="https://github.com/user-attachments/assets/9bfb9226-fef1-45c8-bc6f-2c0aa98487c5" />

[![GitHub release](https://img.shields.io/github/v/release/caiopizzol/conclave)](https://github.com/caiopizzol/conclave/releases)

Persistent multi-model advisors for Claude Code.

Conclave lets one executor (Claude Code) consult other models that keep their own session per worktree. Each follow-up question resumes the advisor's prior context. No copy-pasting between terminals.

## What it does

You're working in Claude Code. You hit something you want a second opinion on. You run:

```
/consult "should this rate limiter use a token bucket or a sliding window?"
```

Conclave asks Codex and Claude (as advisors) the question. Each advisor uses its own persistent session for this worktree, so when you follow up later in the same Claude Code session, it remembers what you discussed.

The executor (Claude Code, you) gets back the advisors' answers and is instructed to verify each claim against the actual code before acting. No advisor advice is accepted on faith.

## How it replaces multi-terminal workflows

Before:
- One terminal running Claude Code
- One running Codex
- One running another model
- You copy-paste questions between them, manually carrying context forward

After:
- One terminal
- `/consult` inside Claude Code
- Advisor sessions live on disk, resumed via the vendor's native primitive (`codex exec resume`, `claude --print --resume`)
- The executor synthesizes and verifies

## Quick start

```bash
git clone https://github.com/caiopizzol/conclave ~/dev/conclave
cd ~/dev/conclave
bun run register
```

Then inside any Claude Code session:

```
/consult "your specific question"
```

**Requires:** [bun](https://bun.sh/), and the advisor CLIs you want to use on your `PATH` ([codex](https://developers.openai.com/codex), [claude](https://docs.claude.com/claude-code), or both).

## Advisors

v1 ships two:

- **codex** - `gpt-5.3-codex` via `codex exec resume`. Persistent across processes via the rollout file at `~/.codex/sessions/`.
- **claude** - `opus` via `claude --print --resume`. Persistent across processes via Claude Code's session store.

Both are invoked headlessly using each vendor's documented non-interactive mode. No scraping, no daemons, no proxies. State for advisor sessions lives at `~/.local/state/conclave/sessions/`.

## What it's not

- Not an agent framework. The executor (Claude Code) stays in charge.
- Not a hosted service. Conclave invokes the CLIs already on your machine.
- Not a multi-mode product. One feature: persistent advisory.
- Not a substitute for verification. The skill instructs the executor to verify advisor claims against current code before acting.

## State and audit

- Advisor sessions: `~/.local/state/conclave/sessions/{claudeSessionId}-{worktreeHash}.json` - maps the current Claude Code session and worktree to each advisor's resume ID.
- Per-consultation audit: `~/.local/state/conclave/runs/{runId}.json` - question, advisors invoked, responses, timings, errors. Useful when an advisor returns something surprising.

## Advanced

Architecture, adapter contract, and adding a new advisor: [docs/advanced.md](docs/advanced.md).

## License

MIT
