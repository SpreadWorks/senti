---
name: senti.workflow
description: Manage GitHub Projects board drafts and publish them as issues via the senti workflow command.
---

# Workflow Board

Use `senti workflow <subcommand> [args]` for board draft operations.

Supported subcommands:

- `add <title> [--category RESEARCH|BUG|ENHANCE|OTHER] [--body <text>]`
- `update <hash> [--status <status>] [--title <text>] [--body <text>]`
- `show <hash>`
- `search <query>`
- `list [--status <status>]`
- `publish <hash> [--label <label>]`
- `ideas --spec <spec>`

Draft titles and non-empty draft bodies are written in the source language configured at `plugin.config.workflow.languages.source`, falling back to the project language.

When publishing an item, use `publish <hash>`. The plugin handles translation according to `plugin.config.workflow.languages.publish` and the configured workflow agent overrides.
