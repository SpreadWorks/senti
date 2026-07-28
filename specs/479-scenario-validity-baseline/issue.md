## Summary

In Issue #459's `scenario-validity` preflight, a flow created from an older `main` baseline was later evaluated against the current tip of `main` after `main` had advanced by 9 commits. The preflight incorrectly treated those upstream-only changes as implementation changes made by the current flow.

This produced a false positive and forced an unnecessary rebase of the feature worktree onto current `main` just to satisfy `scenario-validity`. During that rebase, an autostash conflict also occurred in the generated file `.senti/output/analysis.json`.

## Expected Behavior

`scenario-validity` should only determine whether the current flow itself changed production targets before implementation.

Changes that landed on `main` after the flow was created, and were not introduced by the current flow, must not be treated as implementation changes or as a blocking condition.

## Actual Behavior

The current implementation compares the worktree against the moving `baseBranch` tip. As `main` advances, unrelated upstream-only changes are pulled into the diff and misclassified as feature-side changes.

That causes false positives, unnecessary rebases, and avoidable conflicts in generated artifacts.

## Evidence

- `specs/336-reset-draft-review-artifacts/issue-log.json`
- Step: `scenario-validity`
- Recorded reason: `Scenario validity baseline was nine commits behind main and rebase autostash conflicted in generated analysis.json`
- Observed resolution: rebased the feature worktree onto current `main`, preserved spec files, and removed only the stale generated autostash content

## Suspected Root Cause

`src/flow/lib/run-scenario-validity.js` builds the preflight diff in `buildScenarioValidityDiffArgs()` using:

```sh
git diff --name-only <baseBranch>
```

This compares the current worktree against the current tip of the branch name, not against an immutable flow baseline. Once the base branch advances, upstream-only changes appear in the diff and are incorrectly attributed to the current flow.

## Proposed Fix

Switch the comparison baseline from a moving branch reference to an immutable authority-backed baseline, such as:

- the flow creation baseline commit, or
- a validated merge-base derived from stored authority metadata

The preflight should continue detecting committed, staged, unstaged, and untracked implementation-target changes made by the current flow, while ignoring upstream-only base branch advancement.

If baseline authority is missing, inconsistent, or ambiguous, return a typed fail-closed error instead of guessing.

## Scope

Primary code paths:

- `src/flow/lib/run-scenario-validity.js`
- existing shared baseline / merge-base helpers
- focused unit coverage, for example `tests/unit/flow/scenario-validity-preflight.test.js`

## Acceptance Criteria

- If `main` advances after flow creation, `scenario-validity` still passes when the feature worktree has not changed production targets.
- Feature-side committed, staged, unstaged, and untracked changes to `src/`, `tests/`, `package.json`, and `.senti/config.json` are still detected and blocked.
- Divergent branch state, missing baseline, missing authority, or multiple merge-bases produce an explicit fail-closed error.
- The same flow can continue without requiring a rebase or autostash cleanup just to satisfy `scenario-validity`.
- No regression is introduced in existing `scenario-validity` artifacts, raw logs, or step transition contracts.

## Out of Scope

- relaxing the `scenario-validity` production-target allowlist
- changing the repair fingerprint baseline
- changing finalize-time rebase or merge strategy

<details>
<summary>ja</summary>

scenario-validityが進行したmainをfeature変更として誤検出する

## Summary

In Issue #459's `scenario-validity` preflight, a flow created from an older `main` baseline was later evaluated against the current tip of `main` after `main` had advanced by 9 commits. The preflight incorrectly treated those upstream-only changes as implementation changes made by the current flow.

This produced a false positive and forced an unnecessary rebase of the feature worktree onto current `main` just to satisfy `scenario-validity`. During that rebase, an autostash conflict also occurred in the generated file `.senti/output/analysis.json`.

## Expected Behavior

`scenario-validity` should only determine whether the current flow itself changed production targets before implementation.

Changes that landed on `main` after the flow was created, and were not introduced by the current flow, must not be treated as implementation changes or as a blocking condition.

## Actual Behavior

The current implementation compares the worktree against the moving `baseBranch` tip. As `main` advances, unrelated upstream-only changes are pulled into the diff and misclassified as feature-side changes.

That causes false positives, unnecessary rebases, and avoidable conflicts in generated artifacts.

## Evidence

- `specs/336-reset-draft-review-artifacts/issue-log.json`
- Step: `scenario-validity`
- Recorded reason: `Scenario validity baseline was nine commits behind main and rebase autostash conflicted in generated analysis.json`
- Observed resolution: rebased the feature worktree onto current `main`, preserved spec files, and removed only the stale generated autostash content

## Suspected Root Cause

`src/flow/lib/run-scenario-validity.js` builds the preflight diff in `buildScenarioValidityDiffArgs()` using:

```sh
git diff --name-only <baseBranch>
```

This compares the current worktree against the current tip of the branch name, not against an immutable flow baseline. Once the base branch advances, upstream-only changes appear in the diff and are incorrectly attributed to the current flow.

## Proposed Fix

Switch the comparison baseline from a moving branch reference to an immutable authority-backed baseline, such as:

- the flow creation baseline commit, or
- a validated merge-base derived from stored authority metadata

The preflight should continue detecting committed, staged, unstaged, and untracked implementation-target changes made by the current flow, while ignoring upstream-only base branch advancement.

If baseline authority is missing, inconsistent, or ambiguous, return a typed fail-closed error instead of guessing.

## Scope

Primary code paths:

- `src/flow/lib/run-scenario-validity.js`
- existing shared baseline / merge-base helpers
- focused unit coverage, for example `tests/unit/flow/scenario-validity-preflight.test.js`

## Acceptance Criteria

- If `main` advances after flow creation, `scenario-validity` still passes when the feature worktree has not changed production targets.
- Feature-side committed, staged, unstaged, and untracked changes to `src/`, `tests/`, `package.json`, and `.senti/config.json` are still detected and blocked.
- Divergent branch state, missing baseline, missing authority, or multiple merge-bases produce an explicit fail-closed error.
- The same flow can continue without requiring a rebase or autostash cleanup just to satisfy `scenario-validity`.
- No regression is introduced in existing `scenario-validity` artifacts, raw logs, or step transition contracts.

## Out of Scope

- relaxing the `scenario-validity` production-target allowlist
- changing the repair fingerprint baseline
- changing finalize-time rebase or merge strategy

</details>