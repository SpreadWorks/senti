Clean up flow state and worktree as the final finalize sub-step.

## Required Sequence

1. Run `sdd-forge flow run finalize-cleanup`.
   - Updates `finalize-cleanup` to `done` on the main repo flow.json.
   - Stages and commits the final flow.json snapshot.
   - On commit success: removes the worktree directory and deletes the feature branch.
   - Writes `.sdd-forge/last-finalized-spec`.
   - Returns an envelope whose `data.report` contains `{ path, text }` of the finalize Report.

2. **If the envelope returns an `ORPHAN_COMMITS_DETECTED` error (squash route only):**
   The cleanup body detected commits on the feature branch that were created after the squash baseline and would be lost by branch deletion. The envelope contains `data.orphanCommits` (up to 50 entries) and `data.recoveryOptions = ["cherry-pick", "abort", "force-continue"]`.

   Present the following choice to the user using the standard Choice Format:

   ```
   ──────────────────────────────────────────────────────────
     Orphan commits detected on the feature branch.
     N commit(s) would be lost by deletion. How should we proceed?
   ──────────────────────────────────────────────────────────

     [1] cherry-pick — re-run finalize-cleanup with `--auto-rescue` to cherry-pick the orphan commits onto baseBranch
     [2] abort — leave the worktree and feature branch intact for manual recovery
     [3] force-continue — re-run finalize-cleanup with `--force` to delete the branch (commits will be lost; recorded to issue-log)

   ```

   Show the orphan commit list (sha + subject) above the choice block so the user can decide.

   **MUST: This choice is presented to the user every time, even when `autoApprove: true`.** Silent loss of feature-branch commits violates the spec goal; this is an explicit exception to the autoApprove auto-select rule. Do not auto-pick `[3]` to keep the flow moving.

   - If `[1]` cherry-pick: run `sdd-forge flow run finalize-cleanup --auto-rescue`. On `CHERRY_PICK_CONFLICT`, the worktree and branch are retained — propose archiving the branch (`git branch <archive> <featureBranch>`) and resolving manually before re-running.
   - If `[2]` abort: STOP and return control to the user. The flow remains active.
   - If `[3]` force-continue: explicitly confirm the destructive action with the user, then run `sdd-forge flow run finalize-cleanup --force`. The dropped commit list is persisted to `issue-log.json`.

3. **If the envelope returns `SQUASH_BASELINE_MISSING` or `SQUASH_BASELINE_DIVERGED`:**
   The recorded squash baseline is unavailable or no longer an ancestor of the feature branch (history rewrite). Read `errors[0].messages` and surface the manual recovery steps to the user. Do not pass `--force` automatically — propose archiving the branch and walking through the recovery procedure.

4. **Display the Report:**
   - Read `data.report.text` from the cleanup envelope and place the text verbatim inside a fenced code block so the user sees the Report.
   - If `data.report` is `null`, the envelope's `errors` array contains a `level: warn` entry with `code: REPORT_MISSING`. Surface that warning's message to the user — do not fabricate Report contents.
   - When the envelope contains a `level: warn` entry with `code: FORCED_ORPHAN_DROP`, surface the warning text plus the dropped commit list so the user understands what was lost.

5. **After cleanup**, the worktree directory has been removed. The next `sdd-forge` command runs from the main repository (the shell's previous worktree cwd is no longer valid).
