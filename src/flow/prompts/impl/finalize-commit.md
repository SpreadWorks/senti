Commit implementation changes as a finalize sub-step. This is the first step of the finalize sequence.

## Required Sequence

1. Resolve context.
   - Run `sdd-forge flow get resolve-context` to get JSON with:
     - `mainRepoPath`, `worktreePath`, `activeFlow`, `flowJsonPath`
     - `spec`, `baseBranch`, `featureBranch`, `worktree`
     - `dirty`, `dirtyFiles`, `currentBranch`, `ghAvailable`

2. Run `sdd-forge flow run finalize-commit [--message "<msg>"]`.
   - The command performs preflight checks, migration hooks, stages production code (excluding test artifacts under `specs/<spec>/`), and creates the implementation commit.
   - The post-hook generates `report.json`, posts to the linked issue (if any), and creates a separate `chore: add test artifacts` commit holding `retro.json`, `test-execute-result.json`, `test-result-review.json`, `test-result-review.md`, and `tests/.raw/`. Retro itself runs as a mainline impl-phase step before finalize, not in the post-hook.
   - Display the JSON result to the user.
   - If preflight fails (result=preflight_failed), display the failure reason and stop.

3. After success, the dispatcher automatically advances to finalize-merge.
