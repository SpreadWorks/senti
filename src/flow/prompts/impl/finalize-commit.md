Commit implementation changes as a finalize sub-step. This is the first step of the finalize sequence.

## Required Sequence

1. Resolve context.
   - Run `sdd-forge flow get resolve-context` to get JSON with:
     - `mainRepoPath`, `worktreePath`, `activeFlow`, `flowJsonPath`
     - `spec`, `baseBranch`, `featureBranch`, `worktree`
     - `dirty`, `dirtyFiles`, `currentBranch`, `ghAvailable`

2. Run `sdd-forge flow run finalize-commit [--message "<msg>"]`.
   - The command performs preflight checks, migration hooks, git add, and commit.
   - The post-hook automatically runs retro, report generation, issue comment, and artifacts commit.
   - Display the JSON result to the user.
   - If preflight fails (result=preflight_failed), display the failure reason and stop.

3. After success, the dispatcher automatically advances to finalize-merge.
