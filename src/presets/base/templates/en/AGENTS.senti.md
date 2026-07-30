## Spec-Driven Development (Spec-Driven Development)

This project uses Spec-Driven Development powered by senti.

- **MUST: Start the Spec-Driven Development flow only when the user explicitly instructs it.** Ordinary feature, fix, code-change, investigation, and consultation requests must be handled normally without automatic flow-start confirmation, flow-use suggestions, or "direct editing vs flow" choices.
  - Suggesting flow use or presenting flow choices is allowed only when the user explicitly asks to start the flow, consider using the flow, or see options. Do not infer usefulness from the request and suggest the flow proactively.
  - When the user explicitly starts the flow, drive the mainline lifecycle through planning, implementation, and finalization.
- **MUST: Standalone docs-sync runs use the dedicated flow-sync skill.**
- If skills are unavailable, create a preparing flow with `senti flow set init --request "<request>"`. Use the returned runId in every subsequent `senti flow prepare ... --run-id <runId>` and `senti flow run dispatch --expect-run-id <runId>` command, and consult each command's `--help` for details.

### Never cross the worktree boundary (MUST)

While working inside a worktree created by `flow prepare --worktree`, observe the following:

- **MUST: Never `cd` out of the worktree path.** The only legitimate exit is after `senti flow run finalize-cleanup` cleanup completes (the finalize skill announces that transition).
- **MUST: Never run `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` in the main repository while a flow is active.** Stale stashes from other branches can be restored unintentionally, causing conflicts and corrupting shared state.
- **If baseline comparison (e.g., test results on the base branch) is required, do NOT cd back to main.** Use a short-lived detached worktree (`git worktree add --detach <tmp> <baseBranch>` → measure → `git worktree remove <tmp>`), or reuse evidence already captured in prior `issue-log.json` entries.

### About docs/

`docs/` is a structured knowledge base covering the project's design, architecture, and business logic.
Read docs to understand the full picture before making changes.

**If docs and source code conflict, source code is the truth.**

Before starting work, run `senti check freshness`.
When the result is `stale` or `never-built`, suggest running `senti docs build` to the user. When it is `indeterminate`, report the limiting condition and do not treat docs as fresh.

### Development Workflow

- After modifying skill or preset artifacts in `src/skills/` or `src/presets/`, run `senti upgrade` to refresh project skills, the SDD sections in AGENTS/CLAUDE, and preset copies.
- Run `senti docs build` when docs template changes must be reflected in generated documentation.
- Official preset migrations are verified against the real plugin repository's clean Git HEAD and contribution paths.

### docs/ Editing Rules

- docs/ content is primarily auto-generated from source code analysis
- Content inside `{{data}}` / `{{text}}` directives is overwritten by auto-generation
- Content outside directives is preserved
- Chapter ordering is defined by the `chapters` array in `preset.json`
