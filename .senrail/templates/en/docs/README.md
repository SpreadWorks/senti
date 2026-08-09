# <!-- {{data("cli.project.name")}} --><!-- {{/data}} -->

<!-- {{data("cli.docs.langSwitcher", {labels: "absolute"})}} -->
<!-- {{/data}} -->

[![npm version](https://img.shields.io/npm/v/senrail.svg)](https://www.npmjs.com/package/senrail)
[![license](https://img.shields.io/npm/l/senrail.svg)](https://opensource.org/licenses/MIT)
[![downloads](https://img.shields.io/npm/dm/senrail.svg)](https://www.npmjs.com/package/senrail)

> **Alpha:** APIs, command structure, and configuration formats may change without notice.

## Spec-Driven Development — Design, implement, and document in a single flow

A spec-first development flow manager designed to work with AI coding agents.

## The Spec-Driven Development Flow

Every feature goes through three phases, from spec to merge.

```
plan ──────── Specification
│  ├─ draft       Refine requirements through dialogue
│  ├─ spec        Create spec (feature branch + spec.md)
│  ├─ gate        Spec validation + guardrail check
│  └─ test        Write test code
│
implement ─── Coding
│  ├─ implement   Write code after gate PASS
│  └─ review      AI code review
│
finalize ──── Wrap-up
│  ├─ commit      Commit + retro + report
│  ├─ merge       Squash merge or PR
│  ├─ sync        Auto-update documentation
│  └─ cleanup     Remove branch / worktree
```

### AI stays in its lane

Source code analysis, spec gate checks, and flow orchestration are all handled by deterministic commands. AI is not in charge of the flow — it assists with spec drafting, code review, and prose generation within well-defined boundaries.

- **Spec gate** — Programmatic validation of unresolved items and missing approvals. No PASS, no implementation
- **Guardrails** — Project-specific design principles checked against each spec
- **Compaction resilience** — Flow state and requirements are persisted, so you can resume after context compression

## Automatic Doc Sync

Source code is statically analyzed to extract file structure, classes, methods, configuration, and dependencies. The extracted data is injected into templates to produce structured documentation (`docs/`) and `README.md`.

Documentation is automatically refreshed during the merge phase, so docs and code never drift apart. With always-current docs, both humans and AI agents can understand the system without reading every source file.

## Quick Start

### Install

<pre>
npm install -g <!-- {{data("cli.project.name")}} --><!-- {{/data}} -->
</pre>

### Setup

<pre>
<!-- {{data("cli.project.name")}} --><!-- {{/data}} --> setup
</pre>

An interactive wizard configures your project type (preset) and AI agent.

### Generate docs for an existing project

If you already have source code, generate documentation to get a complete picture of the system. Especially useful for onboarding onto legacy codebases.

<pre>
<!-- {{data("cli.project.name")}} --><!-- {{/data}} --> docs build
</pre>

### Develop with the Spec-Driven Development flow

**[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — run each phase via skills:

| Skill | Phase |
|---|---|
| `/senrail.flow` | full Spec-Driven Development flow (plan, implement, finalize) |

**[Codex CLI](https://github.com/openai/codex)** — invoke via `$` prefix:

| Command | Phase |
|---|---|
| `$senrail.flow` | full Spec-Driven Development flow (plan, implement, finalize) |

## Commands

| Command | Description |
|---|---|
| `setup` | Register project and generate config |
| `docs build` | Run the full documentation pipeline |

See `senrail help` or the [command reference](docs/cli_commands.md) for the full list.

## Configuration

`setup` generates `.senrail/config.json`:

```jsonc
{
  "type": "node-cli",          // project type (preset name)
  "lang": "en",                // operating language
  "agent": {
    "default": "claude",       // AI agent
    "providers": { ... }       // agent settings
  }
}
```

See the [configuration reference](docs/configuration.md) for details.

## Documentation

<!-- {{data("cli.docs.chapters", {header: "", labels: "Chapter|Summary", ignoreError: true})}} -->
<!-- {{/data}} -->

## License

MIT
