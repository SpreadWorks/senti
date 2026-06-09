---
name: senti.flow-status
description: Show the current Spec-Driven Development flow status including branch, worktree, step progress, requirements, and commit state.
---

# Spec-Driven Development Flow Status

Display the current state of the Spec-Driven Development workflow.

## Procedure

1. Load flow state.
   - Run `senti flow get status`.
   - If the envelope's `data.active` is `false`, tell the user there is no active flow and stop.

2. Gather additional context.
   - Run `senti flow get resolve-context` to get `currentBranch`, `dirty`, `dirtyFiles`, `aheadCount`, `lastCommit`, and path information.

3. Display all of the following:

   ### Branch & Worktree
   - Current branch: `currentBranch` from resolve-context
   - Base branch: from flow state
   - Feature branch: from flow state
   - Worktree: from flow state (true/false)
     - If worktree: show `worktreePath` and `mainRepoPath`
   - Mode: determine from state:
     - `worktree: true` → "Worktree"
     - `featureBranch != baseBranch` → "Branch"
     - `featureBranch == baseBranch` → "Spec only"

   ### Step Progress
   - Show the step table from `senti flow get status` output.
   - Highlight the current step (first `in_progress` or first `pending` after all `done`).

   ### Requirements Progress
   - Show the requirements table from `senti flow get status` output.
   - If no requirements are set yet, note "Requirements not yet defined (set after spec approval)".

   ### Spec Summary
   - Spec path: from flow state
   - Use `goal`, `scope`, and `requirements` from the resolve-context/status envelopes. Do not parse `spec.md`; it is a generated human-readable view.
   - User Confirmation status comes from the approval step / spec.json approval state, not from a markdown checkbox.

   ### Commit & Working Tree
   - Uncommitted changes: use `dirty` and `dirtyFiles` from resolve-context (show file count and list)
   - Commits ahead of base: use `aheadCount` from resolve-context
     - Skip if spec-only mode (same branch)
   - Last commit: use `lastCommit` from resolve-context

3. Format output.
   - Use plain text with lines and indentation. Do NOT use markdown tables or headings.
   - Example:

   ```
   Flow Status
   ────────────────────────────────
     Mode:             Branch
     Feature branch:   feature/045-xxx
     Base branch:      main
     Spec:             specs/045-xxx/spec.json
     Goal:             Flow state step tracking
     User approved:    Yes

   Steps (3/9 done)
   ────────────────────────────────
      1. branch         ✓ done
      2. prepare-spec   ✓ done
      3. draft          ✓ done
      4. spec            > in_progress
      5. gate              pending
      6. approval          pending
      ...

   Requirements (1/3 done)
   ────────────────────────────────
     0. ✓ refactor flow.js to dispatcher
     1. > implement status subcommand
     2.   update SKILL.md

   Commits (3 ahead of main)
     - abc1234 feat: implement xxx
     - def5678 fix: yyy
     - ghi9012 test: zzz

   Uncommitted Changes (2 files)
     - M src/lib/flow-state.js
     - M tests/flow.test.js
   ```

## Notes

- This skill is read-only. It does not modify any files or state.
- If spec.json is missing or unreadable, show the path but note it cannot be read.
- Use `senti flow get status` as the primary data source for the current execution context only.
- `flow get status` is not for selecting arbitrary specs. Use `senti flow resume` when flow discovery/recovery is needed.
