<img height="200" alt="conclave-logo" src="https://github.com/user-attachments/assets/9bfb9226-fef1-45c8-bc6f-2c0aa98487c5" />

[![GitHub release](https://img.shields.io/github/v/release/caiopizzol/conclave)](https://github.com/caiopizzol/conclave/releases)

Consensus before commit.

Conclave is a local multi-model CLI for developer decisions. It runs your coding tasks through more than one model, using the CLIs you already have.

Compare when you want perspectives. Converge when you want them to argue.

## Modes

| Mode | What it does | When to use it |
|------|--------------|----------------|
| `/review` | parallel critique on a diff | before commit or PR |
| `/consult` | parallel second opinions on a question | when stuck |
| `/converge` | one model drafts, another challenges, a coordinator tracks issues until they resolve or hit a cap | when the plan matters |

`/review` and `/consult` **compare** - same prompt, multiple models, consensus highlighted.

`/converge` **deliberates** - two roles (implementer and reviewer), one ledger, bounded rounds.

## What it's not

- Not agent soup
- Not a hosted orchestration product
- Not an always-on framework
- Not "ask 5 models and pray"

Two roles, one ledger, bounded rounds.

There is no Conclave-hosted service and no Conclave proxy. Conclave invokes the CLIs already on your machine - Claude, Codex, Gemini, whatever you have - and runs locally. The underlying CLIs still call their providers' APIs; that's up to you to configure.

## Quick start

```bash
git clone https://github.com/caiopizzol/conclave ~/dev/conclave
cd ~/dev/conclave
bun run register
```

**Requires:** [bun](https://bun.sh/), [jq](https://jqlang.org/), and at least one AI CLI on your `PATH` (Claude, Codex, Gemini, ...).

`/review` and `/consult` work with any one or more configured CLIs. `/converge` needs the default config's `claude-opus` and `codex` keys both enabled, because the implementer and reviewer roles are hardcoded to those keys in the MVP. Swap support is planned.

## First successful run

Stage a small diff, then from Claude Code:

```
/review
```

Each configured model critiques the diff in parallel. Consensus items (flagged by two or more models) are marked separately. Single-model findings are more likely noise.

For a question instead of a diff:

```
/consult "why is the table rendering broken?"
```

When the plan itself matters, not just the diff:

```
/converge "design a rate limiter for the auth endpoint"
```

`/converge` takes longer than the other two because it runs a review/revise loop. Expect 2-5 minutes. The session writes every prompt, artifact, and ledger snapshot to a temp directory so you can audit what the models actually said.

## When to use what

- Fast signal before a commit: `/review`
- Quick second opinion on an approach: `/consult`
- A plan you want models to challenge and refine: `/converge`

## Advanced

The engine is a shell script that reads a config, runs tools in parallel, and returns JSON. Custom commands, custom scopes, and the engine's JSON contract are covered in [docs/advanced.md](docs/advanced.md).

The `/converge` coordinator has its own design document: [docs/converge.md](docs/converge.md).

## Why

More models does not mean better. Consensus is the signal.

- One model flags an issue → might be noise.
- Two or more models flag the same issue → probably real.
- One model drafts and another challenges until they agree → a plan you can actually trust.

Conclave does not replace your judgment. It structures the output of multiple models so disagreement becomes useful instead of overwhelming.

Inspired by [LLM Council](https://github.com/karpathy/llm-council).

## License

MIT
