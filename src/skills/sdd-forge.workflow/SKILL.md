---
name: sdd-forge.workflow
description: |
  Manage GitHub Projects board drafts and publish them as issues via the sdd-forge workflow command.
  TRIGGER when the user says any of: "ボードに追加", "タスク化", "メモしておいて", "issue にして",
  "issueにして", "ドラフトを作って", "board に追加", "アイデアをメモ".
  Also TRIGGER when the user explicitly invokes /sdd-forge.workflow.
---

# SDD Experimental: Workflow

Experimental workflow for managing GitHub Projects board drafts and publishing them as issues.
This skill is a thin wrapper around the `sdd-forge workflow` command that ensures the AI follows the
operational rules when invoking the CLI.

## CLI Reference

```bash
sdd-forge workflow <subcommand> [args]
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
- **MUST: Drafts on the board must be written in the language defined by `config.workflow.languages.source`.** The default is `config.lang`.
- **MUST: The title and body passed to `add` / `update` must be authored directly in the source language.** Do not draft in another language and translate.
- **MUST: Before running `add` / `update`, verify that the title and body consist only of the source language.**
- **MUST: Immediately after `add` / `update`, run `show <hash>` to verify that the draft is stored in the source language.**

### Candidate quality rules
- **MUST: Before proposing or adding a board draft, make the decision material explicit.** The user must be able to judge the item without opening logs or asking follow-up questions.
- **MUST: A board draft body must include target, problem, cause, improvement direction, and why it belongs on the board.** Use headings in the source language.
- **MUST: Do not propose unnecessary items.** Skip raw diagnostics, duplicates, one-off agent mistakes, and items already fully resolved inside the current work unless they reveal a reusable process/tooling problem.
- **MUST: Do not ask the user to choose from title-only candidates.** If the cause or improvement direction is unclear, explain that it is not board-ready instead of adding it.
- **MUST: Do not use speculative wording such as "probably" / "おそらく" for the cause.** Use observed evidence, or state that the candidate is not ready for board entry.

### Status management
- **MUST: New drafts must always be created with `Ideas` status. Do not pass `--status` to `add`.** Even implementation tasks and bugs must be added as `Ideas`. Promotion to `Todo` is the user's decision; the AI must never do it on its own.
- Use `--category` when a classification tag is needed.

### Publishing (issue creation)
- **MUST: To create an issue, always create a draft on the board first and wait for the user's "issue にして" instruction.** Never call `gh issue create` directly without going through a draft.
- **MUST: When the user says "○○を issue にして", run `sdd-forge workflow publish <hash> [--label ...]`.**
- Attach an appropriate label (bug / enhancement / documentation etc.) via `--label`.
- On successful `publish`, the board item's status is automatically moved to `Todo`.

## Procedure

1. When the user says "ボードに追加", "タスク化", "メモしておいて", or similar, compose the title and body in the source language.
2. Ensure the body includes target, problem, cause, improvement direction, and board reason. If the item is not board-ready, do not add it; explain the missing decision material.
3. Run `sdd-forge workflow add "<title>" [--category ...] [--body <text>]` and check `data.title` in the JSON envelope. Do not pass `--status` (always `Ideas`).
4. When the user says "issue にして", look up the corresponding hash via `search` or `show`.
5. Run `sdd-forge workflow publish <hash> --label <label>`.
6. Report the resulting `data.issueUrl` back to the user.

## Output Format

All subcommands return a JSON envelope `{ ok, type, key, data, errors }`.
On failure, the process exits with a non-zero status code.
