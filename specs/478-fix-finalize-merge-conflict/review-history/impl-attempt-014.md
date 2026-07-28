# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Align Recovery Hint With Actual Rebase Target
**Finding key:** loop-71257d4e173af0ef34b3
**Failure mode:** refactor
**File:** src/flow/commands/merge.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** `runPreSync` rebases onto `rebaseRef` (`${remote}/${baseBranch}`), but the recovery hint tells users to run `git rebase ${baseBranch}`. That can send users through a slightly different recovery path than the code attempted.  
**Suggestion:** Use `rebaseRef` in the hint: `Run 'git rebase ${rebaseRef}' ...`.
**Suggestion:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** `runPreSync` rebases onto `rebaseRef` (`${remote}/${baseBranch}`), but the recovery hint tells users to run `git rebase ${baseBranch}`. That can send users through a slightly different recovery path than the code attempted.  
**Suggestion:** Use `rebaseRef` in the hint: `Run 'git rebase ${rebaseRef}' ...`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Extract Finalize-Merge Command Text
**Finding key:** loop-f6b08c591b25b8788db5
**Failure mode:** refactor
**File:** src/flow/commands/merge.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** The user-facing retry command text `finalize-merge` now appears in multiple hint strings. Future command renames or wording changes could drift.  
**Suggestion:** Define a small local constant such as `const finalizeMergeCommand = "senti flow run finalize-merge";` or `const finalizeMergeStep = "finalize-merge";` and interpolate it in both hints.
**Suggestion:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** The user-facing retry command text `finalize-merge` now appears in multiple hint strings. Future command renames or wording changes could drift.  
**Suggestion:** Define a small local constant such as `const finalizeMergeCommand = "senti flow run finalize-merge";` or `const finalizeMergeStep = "finalize-merge";` and interpolate it in both hints.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Extract finalize-merge step list constant
**Finding key:** loop-708564b3a8be6337db66
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R1
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R1  
**Issue:** `["finalize-sync", "finalize-cleanup"]` is duplicated in `prepareFinalizeMerge` and `SkipSteps`. This makes the conflict-handling contract easier to accidentally drift.  
**Suggestion:** Add a module-level constant such as `const FINALIZE_MERGE_DOWNSTREAM_STEPS = ["finalize-sync", "finalize-cleanup"];` and reuse it in both actions.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R1  
**Issue:** `["finalize-sync", "finalize-cleanup"]` is duplicated in `prepareFinalizeMerge` and `SkipSteps`. This makes the conflict-handling contract easier to accidentally drift.  
**Suggestion:** Add a module-level constant such as `const FINALIZE_MERGE_DOWNSTREAM_STEPS = ["finalize-sync", "finalize-cleanup"];` and reuse it in both actions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Reduce repeated finalize-merge branching
**Finding key:** loop-3b736dcd3a34e947d957
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `command === "finalize-merge"` is checked repeatedly throughout `resolveFinalizeLifecycle`, which makes the lifecycle harder to scan and increases the chance of inconsistent future behavior.  
**Suggestion:** Introduce `const isFinalizeMerge = command === "finalize-merge";` near the top of `resolveFinalizeLifecycle` and use it consistently.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `command === "finalize-merge"` is checked repeatedly throughout `resolveFinalizeLifecycle`, which makes the lifecycle harder to scan and increases the chance of inconsistent future behavior.  
**Suggestion:** Introduce `const isFinalizeMerge = command === "finalize-merge";` near the top of `resolveFinalizeLifecycle` and use it consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Extract finalize-merge conflict metadata action
**Finding key:** loop-12adc543c350b9edd9cb
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R2
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R2  
**Issue:** The finalize-merge error path now has several tightly coupled actions: preflight, fail outbox, skip downstream steps, `finalizeOnError`, and metadata commit. The intent is important but embedded inline.  
**Suggestion:** Consider extracting small helpers like `finalizeMergeConflictActions(command)` or `commitFinalizeMergeConflictMetadataAction()` to mirror `finalizeMergeMetadataPreflightAction()` and make the R2 conflict metadata sequence easier to preserve.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R2  
**Issue:** The finalize-merge error path now has several tightly coupled actions: preflight, fail outbox, skip downstream steps, `finalizeOnError`, and metadata commit. The intent is important but embedded inline.  
**Suggestion:** Consider extracting small helpers like `finalizeMergeConflictActions(command)` or `commitFinalizeMergeConflictMetadataAction()` to mirror `finalizeMergeMetadataPreflightAction()` and make the R2 conflict metadata sequence easier to preserve.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 4. Rename `suppressAutoPromotion` to lifecycle-specific terminology
**Finding key:** loop-ebb0f00b9a1c79efc22c
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `suppressAutoPromotion` is technically accurate but vague without knowing the step engine behavior. It is introduced only to prevent downstream finalize steps from being auto-started after finalize-merge retry success.  
**Suggestion:** Rename to something more explicit, such as `suppressNextStepPromotion` or `suppressDownstreamPromotion`, and keep the constructor validation unchanged.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `suppressAutoPromotion` is technically accurate but vague without knowing the step engine behavior. It is introduced only to prevent downstream finalize steps from being auto-started after finalize-merge retry success.  
**Suggestion:** Rename to something more explicit, such as `suppressNextStepPromotion` or `suppressDownstreamPromotion`, and keep the constructor validation unchanged.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Avoid Duplicate Main Repository Path Resolution
**Finding key:** loop-091e914bde7b452bf2b0
**Failure mode:** refactor
**File:** src/flow/lib/finalize-flow-state-owner.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/finalize-flow-state-owner.js`  
**Requirement:** R5  
**Issue:** `mainRepoPath` is now computed twice in the same method: once inside the `existing` branch and again before creating a new owner. This is small duplication, but it also makes the fallback behavior harder to scan.  
**Suggestion:** Compute `const mainRepoPath = ctx.mainRoot || ctx.flowManager._mainRoot || ctx.root;` once before the `if (existing)` block, then reuse it for both the authority check and `forMainRepository(...)`.
**Suggestion:** **File:** `src/flow/lib/finalize-flow-state-owner.js`  
**Requirement:** R5  
**Issue:** `mainRepoPath` is now computed twice in the same method: once inside the `existing` branch and again before creating a new owner. This is small duplication, but it also makes the fallback behavior harder to scan.  
**Suggestion:** Compute `const mainRepoPath = ctx.mainRoot || ctx.flowManager._mainRoot || ctx.root;` once before the `if (existing)` block, then reuse it for both the authority check and `forMainRepository(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Make Authority Mismatch Behavior Explicit
**Finding key:** loop-68eb136ec2a617d5fb1a
**Failure mode:** refactor
**File:** src/flow/lib/finalize-flow-state-owner.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/finalize-flow-state-owner.js`  
**Requirement:** R5  
**Issue:** When `existing.specId === specId` but `existing.authorityRoot !== path.resolve(mainRepoPath)`, the method silently falls through and creates a new main-repository owner. That behavior may be intentional, but it is not obvious from the control flow.  
**Suggestion:** Add a clear branch or short comment explaining that an owner bound to a deleted or non-main worktree is intentionally replaced with a main-repository owner. This would make the R5 requirement easier to audit and reduce the chance of a future change restoring use of the deleted worktree state.
**Suggestion:** **File:** `src/flow/lib/finalize-flow-state-owner.js`  
**Requirement:** R5  
**Issue:** When `existing.specId === specId` but `existing.authorityRoot !== path.resolve(mainRepoPath)`, the method silently falls through and creates a new main-repository owner. That behavior may be intentional, but it is not obvious from the control flow.  
**Suggestion:** Add a clear branch or short comment explaining that an owner bound to a deleted or non-main worktree is intentionally replaced with a main-repository owner. This would make the R5 requirement easier to audit and reduce the chance of a future change restoring use of the deleted worktree state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Bound Failure History Growth
**Finding key:** loop-9ca6a3656fc3af421f85
**Failure mode:** refactor
**File:** src/flow/lib/flow-outbox.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/flow-outbox.js`  
**Requirement:** R2  
**Issue:** `markFailed()` appends to `failureHistory` without an upper bound. Repeated retry/failure cycles can grow persisted outbox records indefinitely, violating `bounded-resource-usage`.  
**Suggestion:** Introduce an explicit cap, e.g. `MAX_OUTBOX_FAILURE_HISTORY`, and retain either the most recent N failures or the first + most recent N-1 failures. Apply the cap when appending and when loading stored data.
**Suggestion:** **File:** `src/flow/lib/flow-outbox.js`  
**Requirement:** R2  
**Issue:** `markFailed()` appends to `failureHistory` without an upper bound. Repeated retry/failure cycles can grow persisted outbox records indefinitely, violating `bounded-resource-usage`.  
**Suggestion:** Introduce an explicit cap, e.g. `MAX_OUTBOX_FAILURE_HISTORY`, and retain either the most recent N failures or the first + most recent N-1 failures. Apply the cap when appending and when loading stored data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Avoid Revalidating Immutable Failure History Entries Repeatedly
**Finding key:** loop-23a1b46c3a00c8bc0055
**Failure mode:** refactor
**File:** src/flow/lib/flow-outbox.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/flow-outbox.js`  
**Requirement:** R4  
**Issue:** Methods like `markRetrying()`, `markDone()`, and `markPending()` pass `this.failureHistory` into the constructor, which then maps and rechecks every entry each time a new `FlowOutboxEntry` is created. That adds repeated work and spreads normalization concerns across lifecycle transitions.  
**Suggestion:** Add a small helper such as `normalizeFailureHistory(failureHistory)` and use it only at construction/storage boundaries, or pass a frozen normalized array through unchanged when all entries are already `FlowOutboxFailure` instances.
**Suggestion:** **File:** `src/flow/lib/flow-outbox.js`  
**Requirement:** R4  
**Issue:** Methods like `markRetrying()`, `markDone()`, and `markPending()` pass `this.failureHistory` into the constructor, which then maps and rechecks every entry each time a new `FlowOutboxEntry` is created. That adds repeated work and spreads normalization concerns across lifecycle transitions.  
**Suggestion:** Add a small helper such as `normalizeFailureHistory(failureHistory)` and use it only at construction/storage boundaries, or pass a frozen normalized array through unchanged when all entries are already `FlowOutboxFailure` instances.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Clarify Failure History Field Naming
**Finding key:** loop-6fdf5ddd741b059a3a92
**Failure mode:** refactor
**File:** src/flow/lib/flow-outbox.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/flow-outbox.js`  
**Requirement:** R2  
**Issue:** `FlowOutboxFailure` stores the message in a property also named `failure`, while `FlowOutboxEntry` already has a current `failure` field. This makes `failureHistory[n].failure` harder to distinguish from the entry-level failure.  
**Suggestion:** Rename the historical record property to something more specific, such as `message` or `reason`, while preserving serialized compatibility if existing persisted records may already use `failure`.
**Suggestion:** **File:** `src/flow/lib/flow-outbox.js`  
**Requirement:** R2  
**Issue:** `FlowOutboxFailure` stores the message in a property also named `failure`, while `FlowOutboxEntry` already has a current `failure` field. This makes `failureHistory[n].failure` harder to distinguish from the entry-level failure.  
**Suggestion:** Rename the historical record property to something more specific, such as `message` or `reason`, while preserving serialized compatibility if existing persisted records may already use `failure`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Extract and nullish-check the finalize idempotency key
**Finding key:** loop-b6786de9dc87bf8499d5
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-merge.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-finalize-merge.js`  
**Requirement:** R4  
**Issue:** The fallback idempotency key is computed inline, and `||` treats any falsy value as missing. That makes the merge/outbox idempotency behavior harder to audit in a path where side effects must execute exactly once.  
**Suggestion:** Compute the key before `completeMergeAfterRebase` and use `??`:

```js
const idempotencyKey = ctx.flowOutboxEntry?.idempotencyKey
  ?? finalizationOutboxIdentity(state, "finalize-merge").idempotencyKey;
```

Then pass `idempotencyKey` into the command. This makes the retry identity explicit and avoids accidental fallback on non-null falsy values.
**Suggestion:** **File:** `src/flow/lib/run-finalize-merge.js`  
**Requirement:** R4  
**Issue:** The fallback idempotency key is computed inline, and `||` treats any falsy value as missing. That makes the merge/outbox idempotency behavior harder to audit in a path where side effects must execute exactly once.  
**Suggestion:** Compute the key before `completeMergeAfterRebase` and use `??`:

```js
const idempotencyKey = ctx.flowOutboxEntry?.idempotencyKey
  ?? finalizationOutboxIdentity(state, "finalize-merge").idempotencyKey;
```

Then pass `idempotencyKey` into the command. This makes the retry identity explicit and avoids accidental fallback on non-null falsy values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Split Metadata Paths From Tolerated Runtime Paths
**Finding key:** loop-3e65fe6e6a3561c300ba
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R3  
**Issue:** `getFinalizeMergeAllowedMetadataPaths()` now returns `allowedMetadataPaths` containing only `flow.json` and `issue-log.json`, but its `pathSet` also includes `.senti/.active-flow` and `.tmp/logs/${specId}.log`. That name makes runtime-log exceptions look like commit-eligible metadata paths, and it weakens the R3 rule that dirty paths outside the active spec metadata should block mutation.  
**Suggestion:** Rename `pathSet` to something explicit like `allowedDirtyPathSet` or return separate sets, for example `committableMetadataPaths` and `ignoredRuntimeEvidencePaths`. This keeps the commit boundary and dirty-path exception policy clear.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R3  
**Issue:** `getFinalizeMergeAllowedMetadataPaths()` now returns `allowedMetadataPaths` containing only `flow.json` and `issue-log.json`, but its `pathSet` also includes `.senti/.active-flow` and `.tmp/logs/${specId}.log`. That name makes runtime-log exceptions look like commit-eligible metadata paths, and it weakens the R3 rule that dirty paths outside the active spec metadata should block mutation.  
**Suggestion:** Rename `pathSet` to something explicit like `allowedDirtyPathSet` or return separate sets, for example `committableMetadataPaths` and `ignoredRuntimeEvidencePaths`. This keeps the commit boundary and dirty-path exception policy clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Avoid Recomputing Positional Metadata Paths
**Finding key:** loop-a71627edc840d14f0b01
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R1  
**Issue:** `commitFinalizeMergeMetadataIfSafe()` relies on `metadataPreflight.allowedMetadataPaths[0]` and `[1]` to mean `flow.json` and `issue-log.json`. That positional coupling is fragile if `getFinalizeMergeAllowedMetadataPaths()` changes.  
**Suggestion:** Return named paths from `getFinalizeMergeAllowedMetadataPaths()`, such as `{ flowJsonPath, issueLogPath, metadataPaths, allowedDirtyPathSet }`, and use those names when adding `includeFlowJson` and `includeIssueLog`.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R1  
**Issue:** `commitFinalizeMergeMetadataIfSafe()` relies on `metadataPreflight.allowedMetadataPaths[0]` and `[1]` to mean `flow.json` and `issue-log.json`. That positional coupling is fragile if `getFinalizeMergeAllowedMetadataPaths()` changes.  
**Suggestion:** Return named paths from `getFinalizeMergeAllowedMetadataPaths()`, such as `{ flowJsonPath, issueLogPath, metadataPaths, allowedDirtyPathSet }`, and use those names when adding `includeFlowJson` and `includeIssueLog`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Extract Downstream Finalize Step IDs
**Finding key:** loop-b6cadb4a263cdfbea092
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R2  
**Issue:** `["finalize-sync", "finalize-cleanup"]` is embedded directly inside `finalizeOnError()`. These IDs represent required conflict metadata and are likely to be reused or audited. Inline literals make the requirement harder to verify.  
**Suggestion:** Define a module-level constant such as `FINALIZE_MERGE_DOWNSTREAM_STEP_IDS` and use it when building `entry.downstream`.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R2  
**Issue:** `["finalize-sync", "finalize-cleanup"]` is embedded directly inside `finalizeOnError()`. These IDs represent required conflict metadata and are likely to be reused or audited. Inline literals make the requirement harder to verify.  
**Suggestion:** Define a module-level constant such as `FINALIZE_MERGE_DOWNSTREAM_STEP_IDS` and use it when building `entry.downstream`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 4. Clarify `includeIssueLog` Naming
**Finding key:** loop-a30725f0ee28226e1d43
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R1  
**Issue:** `includeIssueLog` sounds like it controls whether issue-log evidence is written, but it only forces staging of `issue-log.json` if present. The actual log entry is written elsewhere.  
**Suggestion:** Rename it to `forceStageIssueLog` or `includeIssueLogPath` to make the behavior precise and consistent with `includeFlowJson`.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R1  
**Issue:** `includeIssueLog` sounds like it controls whether issue-log evidence is written, but it only forces staging of `issue-log.json` if present. The actual log entry is written elsewhere.  
**Suggestion:** Rename it to `forceStageIssueLog` or `includeIssueLogPath` to make the behavior precise and consistent with `includeFlowJson`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Rename the lifecycle target flag to match its widened meaning
**Finding key:** loop-2b60ef1f8de9e7a2f642
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R2  
**Issue:** `hasExplicitInProgressTarget` now becomes true when an action has `suppressAutoPromotion`, even if the action is not targeting `in_progress`. The name no longer describes the condition accurately.  
**Suggestion:** Rename the field to something like `shouldSkipAutoPromotion` or `hasManualLifecycleControl`, and update downstream references so the boolean reflects both cases clearly.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R2  
**Issue:** `hasExplicitInProgressTarget` now becomes true when an action has `suppressAutoPromotion`, even if the action is not targeting `in_progress`. The name no longer describes the condition accurately.  
**Suggestion:** Rename the field to something like `shouldSkipAutoPromotion` or `hasManualLifecycleControl`, and update downstream references so the boolean reflects both cases clearly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Centralize finalize metadata commit options
**Finding key:** loop-f1ad7661420c7ae5a8b0
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R1
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R1  
**Issue:** `commitFinalizeMergeMetadataIfSafe` is now called from multiple branches with partially overlapping argument shapes. One branch passes `preflight` and a custom message, while another omits both and relies on defaults. That makes the lifecycle behavior harder to audit for R1/R2 metadata-only commit guarantees.  
**Suggestion:** Add a small helper method on `RegistryLifecycleAdapter`, for example `commitFinalizeMergeMetadata(options = {})`, that consistently supplies `root`, `specId`, and the relevant preflight source. Let each handler pass only the behavior-specific fields such as `includeFlowJson` or `message`.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R1  
**Issue:** `commitFinalizeMergeMetadataIfSafe` is now called from multiple branches with partially overlapping argument shapes. One branch passes `preflight` and a custom message, while another omits both and relies on defaults. That makes the lifecycle behavior harder to audit for R1/R2 metadata-only commit guarantees.  
**Suggestion:** Add a small helper method on `RegistryLifecycleAdapter`, for example `commitFinalizeMergeMetadata(options = {})`, that consistently supplies `root`, `specId`, and the relevant preflight source. Let each handler pass only the behavior-specific fields such as `includeFlowJson` or `message`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Avoid string-matching outbox errors inline
**Finding key:** loop-a862e68e4274d3d6f60c
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R2
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R2  
**Issue:** `recordSideEffectFailure` detects a missing outbox entry by checking `String(error.message).startsWith("outbox entry not found:")`. This embeds store-specific error text in lifecycle code and makes the fallback fragile if the outbox store changes its message wording.  
**Suggestion:** Move this detection behind a named helper such as `isOutboxEntryNotFound(error)` in this file, or preferably use a typed/code-bearing error if the outbox store already exposes one. That improves naming clarity and keeps the begin-then-fail recovery path readable.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R2  
**Issue:** `recordSideEffectFailure` detects a missing outbox entry by checking `String(error.message).startsWith("outbox entry not found:")`. This embeds store-specific error text in lifecycle code and makes the fallback fragile if the outbox store changes its message wording.  
**Suggestion:** Move this detection behind a named helper such as `isOutboxEntryNotFound(error)` in this file, or preferably use a typed/code-bearing error if the outbox store already exposes one. That improves naming clarity and keeps the begin-then-fail recovery path readable.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Reduce handler-name branching in `runFinalizeHook`
**Finding key:** loop-6a9e7c968fa1d1465832
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** `runFinalizeHook` has grown several string-keyed `if (handler === "...")` branches for finalize-merge lifecycle behavior. The new branches mix preflight capture, retry reset, branch-mode metadata commits, conflict commits, and error handling in one method, making ordering and side effects harder to reason about.  
**Suggestion:** Extract the finalize-merge-specific branches into private methods such as `assertFinalizeMergeMetadataMutationSafe`, `prepareFinalizeMergeRetry`, `commitFinalizeMergeMetadataBeforeBranchMerge`, and `commitFinalizeMergeConflictMetadata`. Keep `runFinalizeHook` as a dispatcher so the lifecycle pattern remains consistent and easier to extend.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** `runFinalizeHook` has grown several string-keyed `if (handler === "...")` branches for finalize-merge lifecycle behavior. The new branches mix preflight capture, retry reset, branch-mode metadata commits, conflict commits, and error handling in one method, making ordering and side effects harder to reason about.  
**Suggestion:** Extract the finalize-merge-specific branches into private methods such as `assertFinalizeMergeMetadataMutationSafe`, `prepareFinalizeMergeRetry`, `commitFinalizeMergeMetadataBeforeBranchMerge`, and `commitFinalizeMergeConflictMetadata`. Keep `runFinalizeHook` as a dispatcher so the lifecycle pattern remains consistent and easier to extend.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 4. Name `mutated` more specifically
**Finding key:** loop-c0e03a1fab00a8280938
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** The variable `mutated` is vague in the `prepareFinalizeMerge` branch. It appears to mean that skipped downstream finalize steps were reset to pending, but the name does not communicate what changed or why it controls committing `flow.json`.  
**Suggestion:** Rename it to something like `downstreamStepsReset` or `finalizeStepsResetToPending`, then use that name in the `if` and `includeFlowJson` logic. This makes the retry-state transition clearer.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** The variable `mutated` is vague in the `prepareFinalizeMerge` branch. It appears to mean that skipped downstream finalize steps were reset to pending, but the name does not communicate what changed or why it controls committing `flow.json`.  
**Suggestion:** Rename it to something like `downstreamStepsReset` or `finalizeStepsResetToPending`, then use that name in the `if` and `includeFlowJson` logic. This makes the retry-state transition clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Rename `statusRes` to Reflect the Command
**Finding key:** loop-0efe6dd44f1ca5f492ed
**Failure mode:** refactor
**File:** src/lib/git-helpers.js
**Requirement:** R4
**Issue:** **File:** `src/lib/git-helpers.js`  
**Requirement:** R4  
**Issue:** `statusRes` now stores the result of `git diff --name-only --diff-filter=U`, not `git status`. The name makes the control flow slightly harder to read.  
**Suggestion:** Rename `statusRes` to `conflictFilesRes` or `diffRes` so the variable matches the command and its purpose.
**Suggestion:** **File:** `src/lib/git-helpers.js`  
**Requirement:** R4  
**Issue:** `statusRes` now stores the result of `git diff --name-only --diff-filter=U`, not `git status`. The name makes the control flow slightly harder to read.  
**Suggestion:** Rename `statusRes` to `conflictFilesRes` or `diffRes` so the variable matches the command and its purpose.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Reuse the finalize step activator in the CLI route test
**Finding key:** loop-563504b3bc597abb76b7
**Failure mode:** refactor
**File:** tests/e2e/flow/commands/worktree-finalize.test.js
**Requirement:** R6
**Issue:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The new test manually walks `state.steps -> children -> children` to mark `finalize-merge` in progress, even though the file now defines `activateFinalizeMerge()` for the same purpose. This duplicates traversal logic and makes the test more sensitive to step tree shape changes.  
**Suggestion:** Replace the nested loop in `"executes the finalize-merge CLI route..."` with `activateFinalizeMerge(state)` before saving the flow state.
**Suggestion:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The new test manually walks `state.steps -> children -> children` to mark `finalize-merge` in progress, even though the file now defines `activateFinalizeMerge()` for the same purpose. This duplicates traversal logic and makes the test more sensitive to step tree shape changes.  
**Suggestion:** Replace the nested loop in `"executes the finalize-merge CLI route..."` with `activateFinalizeMerge(state)` before saving the flow state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Centralize CLI spawning logic
**Finding key:** loop-661f99c8f4dd216c8fdf
**Failure mode:** refactor
**File:** tests/e2e/flow/commands/worktree-finalize.test.js
**Requirement:** R6
**Issue:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** `runCli()` and `runCliResult()` duplicate the same `spawnSync("node", [FLOW_CMD, "flow", ...args], ...)` setup. Only the assertion behavior differs.  
**Suggestion:** Add a small shared helper like `spawnFlowCli(args, tmp)` and have `runCli()` call it, assert success, and return `stdout`; keep `runCliResult()` as a thin wrapper or remove it if direct calls are clearer.
**Suggestion:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** `runCli()` and `runCliResult()` duplicate the same `spawnSync("node", [FLOW_CMD, "flow", ...args], ...)` setup. Only the assertion behavior differs.  
**Suggestion:** Add a small shared helper like `spawnFlowCli(args, tmp)` and have `runCli()` call it, assert success, and return `stdout`; keep `runCliResult()` as a thin wrapper or remove it if direct calls are clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Split the large conflict fixture setup by responsibility
**Finding key:** loop-25acec4928211c6236b4
**Failure mode:** refactor
**File:** tests/e2e/flow/commands/worktree-finalize.test.js
**Requirement:** R6
**Issue:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** `setupConflictWorktree()` performs Git repository setup, remote setup, conflicting commits, spec fixture creation, flow setup, flow commit, and binding-store setup in one long helper. That makes the test fixture harder to audit and reuse.  
**Suggestion:** Split it into focused helpers such as `setupConflictingBranches()`, `writeWorktreeFlowFixture()`, and `writeWorktreeBinding()`, with `setupConflictWorktree()` composing them. This keeps the test intent intact while reducing setup complexity.
**Suggestion:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** `setupConflictWorktree()` performs Git repository setup, remote setup, conflicting commits, spec fixture creation, flow setup, flow commit, and binding-store setup in one long helper. That makes the test fixture harder to audit and reuse.  
**Suggestion:** Split it into focused helpers such as `setupConflictingBranches()`, `writeWorktreeFlowFixture()`, and `writeWorktreeBinding()`, with `setupConflictWorktree()` composing them. This keeps the test intent intact while reducing setup complexity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Name the command-specific expectation
**Finding key:** loop-582dc08344bd8f9588fc
**Failure mode:** refactor
**File:** tests/unit/flow/finalization-outbox.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/finalization-outbox.test.js`  
**Requirement:** R4  
**Issue:** The assertion compares two inline boolean expressions, which makes the changed behavior less self-documenting.  
**Suggestion:** Extract the expected value into a named constant before the assertion, e.g. `const shouldBeginOutboxEffect = command === "finalize-merge";`, then assert against that name. This makes the test intent clearer without changing behavior.
**Suggestion:** **File:** `tests/unit/flow/finalization-outbox.test.js`  
**Requirement:** R4  
**Issue:** The assertion compares two inline boolean expressions, which makes the changed behavior less self-documenting.  
**Suggestion:** Extract the expected value into a named constant before the assertion, e.g. `const shouldBeginOutboxEffect = command === "finalize-merge";`, then assert against that name. This makes the test intent clearer without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Centralize Downstream Finalize Step IDs
**Finding key:** loop-9801ae70b9ee48787042
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R1
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R1
**Issue:** The downstream finalize step list `["finalize-sync", "finalize-cleanup"]` is duplicated across `src/flow/definition.js` and `src/flow/lib/run-finalize.js`. These files now share the same finalize-merge lifecycle contract, so separate literals can drift.
**Suggestion:** Define one shared constant, for example `FINALIZE_MERGE_DOWNSTREAM_STEP_IDS`, in a common finalize lifecycle module and import it in both files.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R1
**Issue:** The downstream finalize step list `["finalize-sync", "finalize-cleanup"]` is duplicated across `src/flow/definition.js` and `src/flow/lib/run-finalize.js`. These files now share the same finalize-merge lifecycle contract, so separate literals can drift.
**Suggestion:** Define one shared constant, for example `FINALIZE_MERGE_DOWNSTREAM_STEP_IDS`, in a common finalize lifecycle module and import it in both files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Use One Name For Auto-Promotion Suppression
**Finding key:** loop-ac89de4a5545cb0dce90
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R4
**Issue:** `suppressAutoPromotion` in `src/flow/definition.js` is interpreted in `src/flow/lib/step-transition-policy.js` through a boolean named `hasExplicitInProgressTarget`. The flag name and consumer name describe different concepts, which makes the cross-file interface misleading.
**Suggestion:** Rename the action field and policy variable around the same concept, such as `suppressNextStepPromotion` and `shouldSuppressNextStepPromotion`.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R4
**Issue:** `suppressAutoPromotion` in `src/flow/definition.js` is interpreted in `src/flow/lib/step-transition-policy.js` through a boolean named `hasExplicitInProgressTarget`. The flag name and consumer name describe different concepts, which makes the cross-file interface misleading.
**Suggestion:** Rename the action field and policy variable around the same concept, such as `suppressNextStepPromotion` and `shouldSuppressNextStepPromotion`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Centralize Finalize-Merge Command/Step Identity
**Finding key:** loop-f12a5df050f1920b2241
**Failure mode:** refactor
**File:** src/flow/commands/merge.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/merge.js`
**Requirement:** R4
**Issue:** The finalize-merge identity appears as user-facing command text in `merge.js` and as lifecycle string comparisons in `definition.js`, `registry.js`, `run-finalize.js`, and `run-finalize-merge.js`. This creates multiple independent sources for the same command/step identity.
**Suggestion:** Introduce shared constants such as `FINALIZE_MERGE_STEP_ID = "finalize-merge"` and `FINALIZE_MERGE_COMMAND = "senti flow run finalize-merge"` and use them across command hints, lifecycle checks, registry hooks, and outbox identity generation.
**Suggestion:** **File:** `src/flow/commands/merge.js`
**Requirement:** R4
**Issue:** The finalize-merge identity appears as user-facing command text in `merge.js` and as lifecycle string comparisons in `definition.js`, `registry.js`, `run-finalize.js`, and `run-finalize-merge.js`. This creates multiple independent sources for the same command/step identity.
**Suggestion:** Introduce shared constants such as `FINALIZE_MERGE_STEP_ID = "finalize-merge"` and `FINALIZE_MERGE_COMMAND = "senti flow run finalize-merge"` and use them across command hints, lifecycle checks, registry hooks, and outbox identity generation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Align Metadata Path Helper Naming Across Callers
**Finding key:** loop-36f5a08ce9246d451cbe
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize.js`
**Requirement:** R1
**Issue:** `getFinalizeMergeAllowedMetadataPaths()` returns data consumed by `src/flow/registry.js`, but the proposed shape mixes committable metadata paths with tolerated dirty runtime paths. That cross-file interface makes registry behavior harder to audit because callers cannot tell which paths are safe to commit versus merely allowed to exist.
**Suggestion:** Return named fields such as `committableMetadataPaths`, `allowedDirtyPathSet`, `flowJsonPath`, and `issueLogPath`, then update registry callers to use those names explicitly.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`
**Requirement:** R1
**Issue:** `getFinalizeMergeAllowedMetadataPaths()` returns data consumed by `src/flow/registry.js`, but the proposed shape mixes committable metadata paths with tolerated dirty runtime paths. That cross-file interface makes registry behavior harder to audit because callers cannot tell which paths are safe to commit versus merely allowed to exist.
**Suggestion:** Return named fields such as `committableMetadataPaths`, `allowedDirtyPathSet`, `flowJsonPath`, and `issueLogPath`, then update registry callers to use those names explicitly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 5. Unify Finalize-Merge Metadata Commit Entry Points
**Finding key:** loop-539a947f85ad5f1686f8
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R2
**Issue:** **File:** `src/flow/registry.js`
**Requirement:** R2
**Issue:** `commitFinalizeMergeMetadataIfSafe()` is called from multiple registry branches while related safety and path logic lives in `run-finalize.js`. The call sites pass overlapping but different option shapes, which can cause lifecycle branches to diverge in what metadata they stage or commit.
**Suggestion:** Add a single registry adapter helper, for example `commitFinalizeMergeMetadata(options)`, that supplies shared context and delegates to `commitFinalizeMergeMetadataIfSafe()` with a consistent option contract.
**Suggestion:** **File:** `src/flow/registry.js`
**Requirement:** R2
**Issue:** `commitFinalizeMergeMetadataIfSafe()` is called from multiple registry branches while related safety and path logic lives in `run-finalize.js`. The call sites pass overlapping but different option shapes, which can cause lifecycle branches to diverge in what metadata they stage or commit.
**Suggestion:** Add a single registry adapter helper, for example `commitFinalizeMergeMetadata(options)`, that supplies shared context and delegates to `commitFinalizeMergeMetadataIfSafe()` with a consistent option contract.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
