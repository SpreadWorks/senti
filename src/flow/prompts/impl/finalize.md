Use this guidance when the impl phase reaches the finalize action. The full procedural sequence (commit → merge → sync → cleanup) is driven by `sdd-forge flow run finalize`, invoked from the dispatcher.

## Required Sequence

1. Resolve context.
   - Run `sdd-forge flow get resolve-context` to get JSON with:
     - `mainRepoPath`, `worktreePath`, `activeFlow`, `flowJsonPath`
     - `spec`, `baseBranch`, `featureBranch`, `worktree`
     - `dirty`, `dirtyFiles`, `currentBranch`, `ghAvailable`

2. Present mode choice.
   - The mode was already selected in Step 0.

3. **If "all"** (Option 1):
   - Run `sdd-forge flow run finalize --mode all`.
   - Merge strategy is auto-detected: `commands.gh=enable` AND `gh` available → PR, else squash merge.
   - The pipeline executes 4 steps:
     - **Step 1 (commit)**: Commits implementation changes. After commit, retro (AI evaluation) and report (report.json) are automatically generated as post-commit operations.
     - **Step 2 (merge)**: Squash merge or PR creation.
     - **Step 3 (sync)**: Docs build on main repo after merge (skipped for PR route).
     - **Step 4 (cleanup)**: Worktree/branch deletion and flow state cleanup.
   - Display the JSON result to the user.
   - If the result shows sync was skipped (PR route), display the reminder from step 5.

4. **If "select"** (Option 2):
   - Run `sdd-forge flow get prompt finalize.steps` and present the step choices. Wait for user selection.
   - Available steps: 1=commit(+retro+report), 2=merge, 3=sync, 4=cleanup.
   - If the user selected the merge step (2), run `sdd-forge flow get prompt finalize.merge-strategy` and present the choices.
   - Run `sdd-forge flow run finalize --mode select --steps <selected> [--merge-strategy <choice>]`.
   - Display the JSON result to the user.

5. Post-finalize.
   - If the result shows sync was skipped (PR route), display:
     ```
     PR マージ後に以下を実行してください:
     - ドキュメントの同期: sdd-forge build または /sdd-forge.flow-sync
     ```
   - If the result includes `steps.retro`, display the retro summary or failure message. Retro runs automatically as part of the commit step (step 1) — no separate call is needed.
   - **If step 1 was not included** (select mode without commit), retro was not run automatically. Run it manually: `sdd-forge flow run retro`. If retro.json already exists, use `--force` to overwrite. Use `--dry-run` to preview without writing.
   - **Display the Report via CLI, not transcription.** After finalize completes (including select-mode runs that executed the commit/cleanup steps), run `sdd-forge flow report show` and place the command's stdout inside a fenced code block, verbatim. The CLI reads the authoritative `report.json` via the `.sdd-forge/last-finalized-spec` pointer written by finalize cleanup, so `steps.report.text` does not need to be copied or reformatted. If `sdd-forge flow report show` exits non-zero (e.g., cleanup was skipped and no pointer exists), surface stderr to the user instead of fabricating report contents. Add any commentary outside the code block.
   - Sync result (if available) should also be displayed: show `steps.sync.diffSummary` for the list of changed docs files.
