## SDD (Spec-Driven Development)

This project uses Spec-Driven Development powered by sdd-forge.

- **MUST: When the user requests any feature, fix, or code change, confirm with the user whether to use the SDD workflow (`/sdd-forge.flow-plan`). Do NOT modify code without confirmation.**
- **MUST: After implementation is complete, run `/sdd-forge.flow-finalize`.**
- If skills are unavailable, run `sdd-forge flow --request "<request>"` instead.

### Never cross the worktree boundary (MUST)

While working inside a worktree created by `flow prepare --worktree`, observe the following:

- **MUST: Never `cd` out of the worktree path.** The only legitimate exit is after `sdd-forge flow run finalize` cleanup completes (the finalize skill announces that transition).
- **MUST: Never run `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` in the main repository while a flow is active.** Stale stashes from other branches can be restored unintentionally, causing conflicts and corrupting shared state.
- **If baseline comparison (e.g., test results on the base branch) is required, do NOT cd back to main.** Use a short-lived detached worktree (`git worktree add --detach <tmp> <baseBranch>` → measure → `git worktree remove <tmp>`), or reuse evidence already captured in prior `issue-log.json` entries.

### About docs/

`docs/` is a structured knowledge base covering the project's design, architecture, and business logic.
Read docs to understand the full picture before making changes.

**If docs and source code conflict, source code is the truth.**

Before starting work, compare modification dates of docs/ and source code.
If source is newer, suggest running `sdd-forge build` to the user.

### Development Workflow

- After modifying templates in `src/templates/` or `src/presets/`, run `sdd-forge upgrade` to deploy changes to the project's skills and settings.

### docs/ Editing Rules

- docs/ content is primarily auto-generated from source code analysis
- Content inside `{{data}}` / `{{text}}` directives is overwritten by auto-generation
- Content outside directives is preserved
- Chapter ordering is defined by the `chapters` array in `preset.json`
