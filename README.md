<img height="200" alt="conclave-logo" src="https://github.com/user-attachments/assets/9bfb9226-fef1-45c8-bc6f-2c0aa98487c5" />

[![GitHub release](https://img.shields.io/github/v/release/caiopizzol/conclave)](https://github.com/caiopizzol/conclave/releases)

A local console for coding-agent handoffs.

Conclave is a harness. The executor stays in your existing coding agent (Claude Code). When you need another agent's perspective, conclave hands the question off to advisors and brings the response back. Each advisor's session is resumed across consults within the current Claude Code session for this worktree, so follow-up questions don't start cold. The executor verifies before acting.

`/consult` is the first recipe shipped on the console.

## What `/consult` does

You're working in Claude Code. You hit something you want a second opinion on. You run:

```
/consult "should this rate limiter use a token bucket or a sliding window?"
```

Conclave asks Codex and Claude as advisors. Each advisor uses its own persistent session for this worktree, so when you follow up later in the same Claude Code session, it remembers what you discussed.

The executor (Claude Code, you) gets back the advisors' answers and is instructed to verify each claim against the actual code before acting. No advisor advice is accepted on faith.

## What it replaces

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

Conclave ships two built-in advisors and loads additional advisors from `~/.config/conclave/advisors.json` if you provide one.

Built-in:

- **codex** - `gpt-5.3-codex` via `codex exec resume`. Persistent across processes via the rollout file at `~/.codex/sessions/`.
- **claude** - `opus` via `claude --print --resume`. Persistent across processes via Claude Code's session store.

Both are invoked headlessly using each vendor's documented non-interactive mode. No scraping, no daemons, no proxies. State for advisor sessions lives at `~/.local/state/conclave/sessions/`.

User-defined advisors are added through the config file without code changes. Any provider conclave implements (currently `claude-cli`) can back a user-defined advisor with its own model and env. The canonical example: pointing claude-cli at Ollama's Anthropic-compatible endpoint to use Kimi, Qwen, or other models as advisors with the same persistent-session pattern. See [docs/advanced.md](docs/advanced.md) for the config schema and a copy-pasteable Kimi setup. Run `bun ~/.claude/skills/consult/scripts/consult.js --list-advisors` after install to see the resolved roster.

## A console, not orchestration

Conclave is intentionally narrow. It is not:

- An agent swarm or autonomous fleet
- A dashboard or web UI
- A model router or unified gateway
- An "AI team" with autonomous workers
- A consensus engine that synthesizes a final answer for you

The executor stays in charge. Advisors don't talk to each other. The harness's job is to keep their sessions warm and hand off questions cleanly, while you decide what to act on.

## Inspiration

Inspired by [karpathy/llm-council](https://github.com/karpathy/llm-council). Conclave takes the multi-model premise and rebuilds it around *persistent native sessions* and *executor verification* instead of *consensus*. The advisors don't vote, rank each other, or synthesize a chairman's answer. They each remember this worktree, you ask narrowly, and you stay in charge.

## State and audit

- Advisor sessions: `~/.local/state/conclave/sessions/{claudeSessionId}-{worktreeHash}.json` - maps the current Claude Code session and worktree to each advisor's resume ID.
- Per-consultation audit: `~/.local/state/conclave/runs/{runId}.json` - question, advisors invoked, responses, timings, errors. Useful when an advisor returns something surprising.

## What's next

`/consult` is the launch recipe. The same harness can power other recipes (review, investigation, planning, etc.) on the same adapter and state primitives. They'll arrive when they earn their place.

## Advanced

Architecture, adapter contract, and adding a new advisor or recipe: [docs/advanced.md](docs/advanced.md).

## License

MIT
