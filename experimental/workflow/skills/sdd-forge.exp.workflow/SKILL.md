---
name: sdd-forge.exp.workflow
description: |
  Manage GitHub Projects board drafts and publish them as issues via experimental/workflow.js.
  TRIGGER when the user says any of: "ボードに追加", "タスク化", "メモしておいて", "issue にして",
  "issueにして", "ドラフトを作って", "board に追加", "アイデアをメモ".
  Also TRIGGER when the user explicitly invokes /sdd-forge.exp.workflow.
---

# SDD Experimental: Workflow

Experimental workflow for managing GitHub Projects board drafts and publishing them as issues.
This skill is a thin wrapper around `experimental/workflow.js` that ensures the AI follows the
operational rules when invoking the CLI.

## CLI Reference

```bash
node experimental/workflow.js <subcommand> [args]
```

| Subcommand | Purpose |
|---|---|
| `add <title> [--category RESEARCH\|BUG\|ENHANCE\|OTHER] [--body <text>]` | Create a new draft (always in `Ideas` status) |
| `update <hash> [--status <s>] [--body <text>] [--title <text>]` | Update an existing draft |
| `show <hash>` | Show item details |
| `search <query>` | Full-text search |
| `list [--status <status>]` | List items |
| `publish <hash> [--label <l>]` | Convert draft to a GitHub Issue (translates if needed) |

## MUST Rules

### Draft language rules
- **MUST: Drafts on the board must be written in the language defined by `config.experimental.workflow.languages.source`.** The default is `config.lang`.
- **MUST: The title and body passed to `add` / `update` must be authored directly in the source language.** Do not draft in another language and translate.
- **MUST: Before running `add` / `update`, verify that the title and body consist only of the source language.**
- **MUST: Immediately after `add` / `update`, run `show <hash>` to verify that the draft is stored in the source language.**

### Status management
- **MUST: New drafts must always be created with `Ideas` status. Do not pass `--status` to `add`.** Even implementation tasks and bugs must be added as `Ideas`. Promotion to `Todo` is the user's decision; the AI must never do it on its own.
- Use `--category` when a classification tag is needed.

### Publishing (issue creation)
- **MUST: To create an issue, always create a draft on the board first and wait for the user's "issue にして" instruction.** Never call `gh issue create` directly without going through a draft.
- **MUST: When the user says "○○を issue にして", run `node experimental/workflow.js publish <hash> [--label ...]`.**
- Attach an appropriate label (bug / enhancement / documentation etc.) via `--label`.
- On successful `publish`, the board item's status is automatically moved to `Todo`.

## Procedure

1. When the user says "ボードに追加", "タスク化", "メモしておいて", or similar, compose the title and body in the source language.
2. Run `node experimental/workflow.js add "<title>" [--category ...] [--body <text>]` and check `data.title` in the JSON envelope. Do not pass `--status` (always `Ideas`).
3. When the user says "issue にして", look up the corresponding hash via `search` or `show`.
4. Run `node experimental/workflow.js publish <hash> --label <label>`.
5. Report the resulting `data.issueUrl` back to the user.

## Output Format

All subcommands return a JSON envelope `{ ok, type, key, data, errors }`.
On failure, the process exits with a non-zero status code.
