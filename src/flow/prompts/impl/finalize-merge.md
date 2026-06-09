Merge the feature branch as a finalize sub-step.

## Required Sequence

1. Run `senti flow run finalize-merge`.
   - Merge strategy is auto-detected: `commands.gh=enable` AND `gh` available → PR, else squash merge.
   - Display the JSON result to the user.

2. If merge fails, the onError hook automatically marks finalize-sync and finalize-cleanup as skipped.
   - Display the error and any recovery hints (e.g., rebase instructions for conflict resolution).
   - The dispatcher will skip subsequent finalize steps.

3. If the result shows PR route (strategy=pr), note that docs sync will need to be run after the PR is merged:
   ```
   PR マージ後に以下を実行してください:
   - ドキュメントの同期: senti build または /senti.flow-sync
   ```

4. After success, the dispatcher automatically advances to finalize-sync.
