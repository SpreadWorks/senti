# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Prepare pre hooks run before required spec artifacts exist
**Finding key:** prepare-pre-hooks-run-before-spec-artifacts
**Failure mode:** spec_behavior_contradiction
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R6
**Issue:** `writeFlowState()` now wraps both source-file creation and `flowManager.create()` inside `runFlowCommandWithPluginLifecycle()`. That means newly supported `prepare.pre` hooks execute before `spec.json`, `spec.md`, and optional `issue.md` are written, while hook execution still builds contexts with `requireSpecArtifacts: true`. A required prepare pre hook that needs the prepare artifacts will fail before the command has created the artifacts it is expected to validate or consume.
**Suggestion:** Create the prepare source files before invoking `prepare.pre`, then run the required pre hook, create `flow.json`, and keep the rollback path deleting the created files and plugin artifacts on required hook failure.
**Disposition:** must-fix
**Rationale:** R6 covers prepare hook behavior in `src/flow/lib/run-prepare-spec.js`; the implementation contradicts the expected lifecycle ordering by enabling `prepare.pre` while withholding the artifacts required by the hook context.

### 2. Required finalize post hook failure can occur after spec-only completion
**Finding key:** finalize-post-required-failure-not-transactional
**Failure mode:** security_or_data_integrity_bug
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** In the spec-only branch, `runSpecOnlyCompletion()` is executed before `runFinalizePostHooks()`. If a required finalize post hook fails, the command returns `PLUGIN_HOOK_REQUIRED_FAILED` after active-flow cleanup/report side effects have already completed, with no rollback or recovery journal path protecting those changes.
**Suggestion:** Run spec-only completion through the same transactional lifecycle pattern as teardown, or add an explicit rollback/recovery step around `runSpecOnlyCompletion()` before returning a required post-hook failure.
**Disposition:** must-fix
**Rationale:** R7 maps to finalize cleanup behavior and required hook failures. A required post-hook failure is mandatory blocking behavior, but this branch reports failure after mutating flow state, leaving the command in a partially completed state.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
