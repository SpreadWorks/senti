## Spec-Driven Development (Spec-Driven Development)

This project uses Spec-Driven Development powered by senti.

- **MUST: Start the Spec-Driven Development flow only when the user explicitly instructs it.** Ordinary feature, fix, code-change, investigation, and consultation requests do not require automatic flow-start confirmation and may be handled normally.
  - If a request would benefit from the flow, suggest it as an option, but do not start the flow or present a mandatory startup choice unless the user chooses it.
  - When the user explicitly starts the flow, drive the mainline lifecycle through planning, implementation, and finalization.
- **MUST: Standalone docs-sync runs use the dedicated flow-sync skill.**
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

- After modifying skill sources, presets, or templates in `src/skills/` or `src/presets/`, run `senti upgrade` to deploy changes to the project's skills and settings.
- Official preset migrations are verified against the real plugin repository's clean Git HEAD and contribution paths.

### docs/ Editing Rules

- docs/ content is primarily auto-generated from source code analysis
- Content inside `{{data}}` / `{{text}}` directives is overwritten by auto-generation
- Content outside directives is preserved
- Chapter ordering is defined by the `chapters` array in `preset.json`
