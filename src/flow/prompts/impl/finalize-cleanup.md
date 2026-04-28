Clean up flow state and worktree as the final finalize sub-step.

## Required Sequence

1. **Before running cleanup**, save the main repo path for post-cleanup cd:
   - Run `sdd-forge flow get resolve-context` and note `mainRepoPath`.

2. Run `sdd-forge flow run finalize-cleanup`.
   - Writes the last-finalized-spec pointer.
   - Clears flow state (deletes flow.json / .active-flow).
   - Removes the worktree directory and deletes the feature branch.
   - Display the JSON result to the user.

3. **After cleanup completes** (worktree mode):
   - The worktree directory has been deleted, invalidating the shell's cwd.
   - **MUST: Immediately run `cd <mainRepoPath>`** to restore a valid working directory.

4. **Display the Report:**
   - Run `sdd-forge flow report show` and place the command's stdout verbatim inside a fenced code block.
   - If the command exits non-zero, surface stderr to the user.
