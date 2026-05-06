Clean up flow state and worktree as the final finalize sub-step.

## Required Sequence

1. Run `sdd-forge flow run finalize-cleanup`.
   - Updates `finalize-cleanup` to `done` on the main repo flow.json.
   - Stages and commits the final flow.json snapshot.
   - On commit success: removes the worktree directory and deletes the feature branch.
   - Writes `.sdd-forge/last-finalized-spec`.
   - Returns an envelope whose `data.report` contains `{ path, text }` of the finalize Report.

2. **Display the Report:**
   - Read `data.report.text` from the cleanup envelope and place the text verbatim inside a fenced code block so the user sees the Report.
   - If `data.report` is `null`, the envelope's `errors` array contains a `level: warn` entry with `code: REPORT_MISSING`. Surface that warning's message to the user — do not fabricate Report contents.

3. **After cleanup**, the worktree directory has been removed. The next `sdd-forge` command runs from the main repository (the shell's previous worktree cwd is no longer valid).
