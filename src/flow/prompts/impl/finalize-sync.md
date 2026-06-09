Build and commit documentation as a finalize sub-step. Runs on the main repo after merge.

## Required Sequence

1. Run `senti flow run finalize-sync`.
   - Runs `senti docs build` on the main repo (or the current repo in branch mode).
   - Stages and commits documentation changes.
   - Display the JSON result to the user.
   - If the result includes diffSummary, show the list of changed docs files.

2. After success, the dispatcher automatically advances to finalize-cleanup.
