Commit implementation changes as a finalize sub-step. This is the first step of the finalize sequence.

## Required Sequence

1. Resolve context.
   - Run `senti flow get resolve-context` to get JSON with:
     - `mainRepoPath`, `worktreePath`, `activeFlow`, `flowJsonPath`
     - `spec`, `baseBranch`, `featureBranch`, `worktree`
     - `dirty`, `dirtyFiles`, `currentBranch`, `ghAvailable`

2. Run `senti flow run finalize-commit [--message "<msg>"]`.
   - The command performs preflight checks, migration hooks, stages production code (excluding test artifacts under `specs/<spec>/`), and creates the implementation commit.
   - The preceding `report` step has already generated `report.json` and delivered the linked Issue comment. The post-hook creates a separate durable-artifact commit holding `report.json`, `retro.json`, `test-execute-result.json`, `test-result-review.json`, `test-result-review.md`, `final-regression-result.json`, and `tests/.raw/` before it confirms the finalize-commit outbox entry.
   - Display the JSON result to the user.
   - If preflight fails (result=preflight_failed), display the failure reason and stop.

3. After success, the dispatcher automatically advances to finalize-merge.
