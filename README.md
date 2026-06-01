# Conclave Is Deprecated

[![Deprecated](https://img.shields.io/badge/status-deprecated-red)](https://chit.run)
[![Use Chit](https://img.shields.io/badge/use-chit-orange)](https://github.com/caiopizzol/chit)

Conclave has been superseded by [Chit](https://chit.run).

Chit keeps the useful idea from Conclave, persistent multi-agent handoffs, but moves it into a clearer runtime: a small JSON manifest declares the agents, steps, context flow, and review points; the same manifest can run from the CLI, a Claude Code skill, MCP tools, or Studio.

Use Chit for new work:

```sh
bunx @chit-run/cli --help
```

Repository: <https://github.com/caiopizzol/chit>  
Docs: <https://chit.run/docs>  
npm: <https://www.npmjs.com/package/@chit-run/cli>

## Migrating `/consult`

If you installed Conclave's old `/consult` skill, remove it first:

```sh
git clone https://github.com/caiopizzol/conclave ~/dev/conclave
cd ~/dev/conclave
bun run unregister
```

Then install Chit's `consult` manifest as a Claude Code skill:

```sh
git clone https://github.com/caiopizzol/chit ~/dev/chit
cd ~/dev/chit
bun install
bun run cli install examples/consult.json --as claude-skill --name consult --force
```

After that, use `/consult` in Claude Code the same way conceptually: ask a focused question and verify the returned advice before acting.

## What Changed

Conclave was a single-purpose handoff console centered on one Claude Code skill. Chit is the replacement runtime:

- `examples/consult.json` replaces Conclave's hard-coded `/consult` recipe.
- `chit run` executes a manifest directly.
- `chit show` inspects a manifest before running it.
- `chit install <manifest> --as claude-skill` exposes a manifest as a Claude Code skill.
- `chit mcp` exposes stepwise MCP tools.
- `chit converge` provides the implement/review loop that Conclave was starting to grow toward.

## Historical Status

This repository is kept only as an archive of the earlier experiment. It is not receiving new features, bug fixes, or support. The old state directories are left untouched by default:

- Conclave state: `~/.local/state/conclave/`
- Conclave config: `~/.config/conclave/advisors.json`

Chit uses its own state and config locations, so migration does not require deleting historical Conclave records.

## License

MIT
