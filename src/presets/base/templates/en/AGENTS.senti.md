## Spec-Driven Development (Spec-Driven Development)

This project uses Spec-Driven Development powered by senti.

- **MUST: When the user requests any feature, fix, or code change, classify the request and use AskUserQuestion to present a 2-way choice between "direct edit" and "Spec-Driven Development workflow (`/senti.flow`)". Do NOT modify code without confirmation.**
  - **Direct-edit leaning** (typos, comments, docs wording, single-file single-line replacements, semantically-neutral renames, config tweaks) → mark "direct edit" as Recommended
  - **Flow leaning** (behavioral changes, multi-file changes, test/spec impact, new features, new APIs) → mark "flow" as Recommended
  - **When in doubt, mark flow as Recommended** (keep review / gate / docs-sync safety nets on the default path)
  - If direct edit is chosen, show the `git diff` and confirm before committing. Docs sync will not run; suggest `senti docs build` separately if needed
- **MUST: The mainline Spec-Driven Development lifecycle (planning, implementation, finalization) is driven by a single `/senti.flow` skill invocation. Standalone docs-sync runs use `/senti.flow-sync`. If the Spec-Driven Development workflow path is chosen, drive it through to finalize.**
- If skills are unavailable, run `senti flow --request "<request>"` instead.

### Never cross the worktree boundary (MUST)

While working inside a worktree created by `flow prepare --worktree`, observe the following:

- **MUST: Never `cd` out of the worktree path.** The only legitimate exit is after `senti flow run finalize` cleanup completes (the finalize skill announces that transition).
- **MUST: Never run `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` in the main repository while a flow is active.** Stale stashes from other branches can be restored unintentionally, causing conflicts and corrupting shared state.
- **If baseline comparison (e.g., test results on the base branch) is required, do NOT cd back to main.** Use a short-lived detached worktree (`git worktree add --detach <tmp> <baseBranch>` → measure → `git worktree remove <tmp>`), or reuse evidence already captured in prior `issue-log.json` entries.

### About docs/

`docs/` is a structured knowledge base covering the project's design, architecture, and business logic.
Read docs to understand the full picture before making changes.

**If docs and source code conflict, source code is the truth.**

Before starting work, compare modification dates of docs/ and source code.
If source is newer, suggest running `senti build` to the user.

### Development Workflow

- After modifying skill sources in `src/skills/` or templates in `src/presets/`, run `senti upgrade` to deploy changes to the project's skills and settings.

### docs/ Editing Rules

- docs/ content is primarily auto-generated from source code analysis
- Content inside `{{data}}` / `{{text}}` directives is overwritten by auto-generation
- Content outside directives is preserved
- Chapter ordering is defined by the `chapters` array in `preset.json`
