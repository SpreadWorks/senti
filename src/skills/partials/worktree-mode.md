When `worktree: true` in flow.json:
- **All file operations (editing, creating, reading) MUST be done inside the worktree directory.** Do not edit files in the main repository.
- Run `sdd-forge flow get status` to see the worktree path. Use absolute paths if needed.
- The worktree is an isolated copy — changes in the main repo are NOT visible in the worktree and vice versa.
- **Flow state definitions:**
  - **Flow is active** — BOTH of the following hold simultaneously (AND):
    - `sdd-forge flow get status` returns `active: true`.
    - The worktree directory still exists on disk (verifiable via `test -d <worktree-path>`).
  - **Flow is released** — EITHER of the following has flipped (OR); either one alone is sufficient:
    - `sdd-forge flow get status` returns `active: false` — the flow has ended.
    - The worktree directory no longer exists (`test -d <worktree-path>` fails) — cleanup has deleted it.
- **MUST: While the flow is active (per the definition above), never `cd` out of the worktree path.**
- **Once the flow is released, the worktree boundary is lifted and `cd` out of the (former) worktree path is allowed.**
- **Once `sdd-forge flow run finalize-cleanup` completes successfully (envelope `ok: true`), both release conditions flip together: the worktree directory is removed and `flow get status` reports `active: false`.** The cleanup command owns finalize Report delivery and removes the worktree; subsequent `sdd-forge` commands run from the main repository because the worktree no longer exists.
- **Halt envelopes (e.g. `ORPHAN_COMMITS_DETECTED`, `SQUASH_BASELINE_MISSING`, `SQUASH_BASELINE_DIVERGED`, `MAIN_REPO_DIRTY`, `MAIN_REPO_LOCKED`, `CHERRY_PICK_CONFLICT`, `ARGS_ERROR`) leave the worktree boundary in effect.** The worktree directory and feature branch are intentionally retained so the user can recover (e.g. archive the branch, run `--auto-rescue`, or re-run with `--force`). Until the next `finalize-cleanup` invocation succeeds, do NOT cd out of the worktree.
- **MUST: Never run `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` in the main repository while the flow is active.** Stashes, resets, and checkouts on shared state can restore stale content (e.g. unrelated stashes from other branches), introduce conflicts, and corrupt the main working tree — even when the flow's own worktree is unaffected.
- **If baseline comparison (e.g., running tests on `baseBranch` to compare failure counts) is required, do NOT cd into the main repo.** Instead, create a short-lived detached worktree (`git worktree add --detach <tmp-path> <baseBranch>` in an allowed location, run the comparison there, then remove it with `git worktree remove <tmp-path>`). When in doubt, reuse evidence already captured in prior `issue-log.json` entries rather than re-measuring against `main`.
- **MUST: During an active worktree flow, never pass a main repo absolute path as the file-path argument to Edit/Write tool calls.** Allowed alternatives are (a) a relative path from the worktree cwd, or (b) an absolute path under the `worktreePath` returned by `sdd-forge flow get resolve-context`. Rationale: Edit/Write writes to whatever absolute path it receives regardless of the shell's cwd, so a main-repo path silently bypasses the worktree and mutates shared state. Paths surfaced by Read/Grep that resolve to the main repo must be rewritten to the worktree equivalent before being passed to Edit/Write.

<!-- {{data("base.skills.rule", {id: "no-shared-repo-git-ops"})}} -->
<!-- {{/data}} -->
