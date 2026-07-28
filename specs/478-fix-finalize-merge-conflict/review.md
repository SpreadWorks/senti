# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Centralize finalize-merge recovery hints
**Finding key:** loop-ccf51cd4d4655efc31b1
**Failure mode:** refactor
**File:** src/flow/commands/merge.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** Retry guidance is duplicated inline and already drifts between `finalize`, `finalize-merge`, and `senti flow run finalize-merge`. This weakens consistency around the R4 retry path after conflict resolution.  
**Suggestion:** Extract a small helper or constants for finalize-merge retry/rebase hints, then use it in both squash paths and `runPreSync`. This removes duplicate wording and ensures all conflict/retry guidance points to `finalize-merge` consistently.
**Suggestion:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** Retry guidance is duplicated inline and already drifts between `finalize`, `finalize-merge`, and `senti flow run finalize-merge`. This weakens consistency around the R4 retry path after conflict resolution.  
**Suggestion:** Extract a small helper or constants for finalize-merge retry/rebase hints, then use it in both squash paths and `runPreSync`. This removes duplicate wording and ensures all conflict/retry guidance points to `finalize-merge` consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Extract Shared Finalize-Merge Branch Logic
**Finding key:** loop-c570b6b57dd371d11bce
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R1
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R1  
**Issue:** `resolveFinalizeLifecycle` now repeats `command === "finalize-merge"` branching across `finalize:pre`, `finalize:onError`, and normal completion. This makes the conflict path harder to audit, especially because ordering is requirement-critical.  
**Suggestion:** Introduce small helpers such as `isFinalizeMerge(command)`, `addFinalizeMergePreActions(actions)`, or command-specific lifecycle builders for `finalize-merge`. This would keep the metadata preflight, outbox begin/fail, skipped downstream steps, and metadata commit sequencing in one place.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R1  
**Issue:** `resolveFinalizeLifecycle` now repeats `command === "finalize-merge"` branching across `finalize:pre`, `finalize:onError`, and normal completion. This makes the conflict path harder to audit, especially because ordering is requirement-critical.  
**Suggestion:** Introduce small helpers such as `isFinalizeMerge(command)`, `addFinalizeMergePreActions(actions)`, or command-specific lifecycle builders for `finalize-merge`. This would keep the metadata preflight, outbox begin/fail, skipped downstream steps, and metadata commit sequencing in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Rename `suppressAutoPromotion` To Match Behavior
**Finding key:** loop-2bcceceb679fdbda6e96
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `suppressAutoPromotion` is a broad name that does not explain what promotion is being suppressed or why only `finalize-merge` needs it. The comment says the retried merge should not begin `finalize-sync`, so the name should reflect step auto-advancement.  
**Suggestion:** Rename it to something more domain-specific, such as `suppressNextStepPromotion` or `suppressDownstreamStepPromotion`, and update constructor validation and `forStep` propagation accordingly.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `suppressAutoPromotion` is a broad name that does not explain what promotion is being suppressed or why only `finalize-merge` needs it. The comment says the retried merge should not begin `finalize-sync`, so the name should reflect step auto-advancement.  
**Suggestion:** Rename it to something more domain-specific, such as `suppressNextStepPromotion` or `suppressDownstreamStepPromotion`, and update constructor validation and `forStep` propagation accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Deduplicate Outbox Failure Action Construction
**Finding key:** loop-b4ababc47a3e97da61c3
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R2
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R2  
**Issue:** In `finalize:onError`, both branches add `new FailOutboxEffect({ step: command })`; the only finalize-merge-specific behavior is adding `SkipSteps` before `finalizeOnError`.  
**Suggestion:** Push `FailOutboxEffect` once before the conditional, then conditionally add `SkipSteps`. This makes the required failure-state ordering easier to read and reduces duplicated action construction.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R2  
**Issue:** In `finalize:onError`, both branches add `new FailOutboxEffect({ step: command })`; the only finalize-merge-specific behavior is adding `SkipSteps` before `finalizeOnError`.  
**Suggestion:** Push `FailOutboxEffect` once before the conditional, then conditionally add `SkipSteps`. This makes the required failure-state ordering easier to read and reduces duplicated action construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 4. Consider A Command Lifecycle Strategy Map
**Finding key:** loop-0ad71652337dcbc133a3
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R5
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R5  
**Issue:** `resolveFinalizeLifecycle` is accumulating command-specific special cases for `finalize-merge`, `finalize-sync`, `finalize-cleanup`, and `finalize-commit`. The current shape increases the chance that future lifecycle changes put hooks on the wrong repository authority or in the wrong phase.  
**Suggestion:** Use a small command-to-lifecycle map or per-command helper functions for pre, error, and success actions. That would align the design with explicit command strategies and make it easier to verify that the normal no-conflict path does not create the metadata-only commit.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R5  
**Issue:** `resolveFinalizeLifecycle` is accumulating command-specific special cases for `finalize-merge`, `finalize-sync`, `finalize-cleanup`, and `finalize-commit`. The current shape increases the chance that future lifecycle changes put hooks on the wrong repository authority or in the wrong phase.  
**Suggestion:** Use a small command-to-lifecycle map or per-command helper functions for pre, error, and success actions. That would align the design with explicit command strategies and make it easier to verify that the normal no-conflict path does not create the metadata-only commit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Avoid Duplicate Main Repository Path Resolution
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

### 7. 2. Make Authority Mismatch Behavior Explicit
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

### 8. 1. Bound Failure History Growth
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

### 9. 2. Avoid Revalidating Immutable Failure History Entries Repeatedly
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

### 10. 3. Clarify Failure History Field Naming
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

### 11. 1. Extract and nullish-check the finalize idempotency key
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

### 12. 1. Replace Positional Metadata Path Access
**Finding key:** loop-1146e1af627039a180bf
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R1  
**Issue:** `commitFinalizeMergeMetadataIfSafe` relies on `allowedMetadataPaths[0]` and `[1]` for `flow.json` and `issue-log.json`, which is brittle and makes future path changes easy to break silently.  
**Suggestion:** Return named paths from `getFinalizeMergeAllowedMetadataPaths`, e.g. `{ flowJsonPath, issueLogPath, paths, pathSet }`, then use those names for `includeFlowJson` and `includeIssueLog`.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R1  
**Issue:** `commitFinalizeMergeMetadataIfSafe` relies on `allowedMetadataPaths[0]` and `[1]` for `flow.json` and `issue-log.json`, which is brittle and makes future path changes easy to break silently.  
**Suggestion:** Return named paths from `getFinalizeMergeAllowedMetadataPaths`, e.g. `{ flowJsonPath, issueLogPath, paths, pathSet }`, then use those names for `includeFlowJson` and `includeIssueLog`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Deduplicate Metadata Preflight Construction
**Finding key:** loop-32e780875493f9f2cb1c
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R3  
**Issue:** `buildFinalizeMergeMetadataPreflight` and `readFinalizeMergeMetadataPreflight` duplicate the same classification logic for metadata vs external dirty paths.  
**Suggestion:** Extract a helper such as `classifyFinalizeMergeDirtyPaths(specId, dirtyPaths, { stopOnExternal = false })` and use it from both call sites. This keeps the external-dirty behavior consistent and reduces maintenance risk.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R3  
**Issue:** `buildFinalizeMergeMetadataPreflight` and `readFinalizeMergeMetadataPreflight` duplicate the same classification logic for metadata vs external dirty paths.  
**Suggestion:** Extract a helper such as `classifyFinalizeMergeDirtyPaths(specId, dirtyPaths, { stopOnExternal = false })` and use it from both call sites. This keeps the external-dirty behavior consistent and reduces maintenance risk.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Bound Git Status Output Processing
**Finding key:** loop-8a93ef11db57e97dba21
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R3  
**Issue:** `readFinalizeMergeStatusOutput` loads full `git status --porcelain=v1 -z --untracked-files=all` output into memory. In a worktree with many untracked files, this is unbounded bulk loading and violates `bounded-resource-usage`.  
**Suggestion:** Add an explicit upper bound to status collection or use a streaming/status helper that stops after enough evidence is found, especially since the external dirty preflight only needs to report the first blocking external path.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R3  
**Issue:** `readFinalizeMergeStatusOutput` loads full `git status --porcelain=v1 -z --untracked-files=all` output into memory. In a worktree with many untracked files, this is unbounded bulk loading and violates `bounded-resource-usage`.  
**Suggestion:** Add an explicit upper bound to status collection or use a streaming/status helper that stops after enough evidence is found, especially since the external dirty preflight only needs to report the first blocking external path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Rename `downstream` Metadata Field for Clarity
**Finding key:** loop-a190077774c154ee2130
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R2  
**Issue:** The issue-log entry field `downstream` is vague; it stores statuses for skipped downstream finalize steps, not arbitrary downstream data.  
**Suggestion:** Use a clearer internal name such as `downstreamStepStatuses` or `skippedDownstreamStatuses`. If the persisted schema must remain `downstream`, build it from a clearly named local variable to make the intent explicit.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`  
**Requirement:** R2  
**Issue:** The issue-log entry field `downstream` is vague; it stores statuses for skipped downstream finalize steps, not arbitrary downstream data.  
**Suggestion:** Use a clearer internal name such as `downstreamStepStatuses` or `skippedDownstreamStatuses`. If the persisted schema must remain `downstream`, build it from a clearly named local variable to make the intent explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Rename Misleading In-Progress Flag
**Finding key:** loop-86d416999b7c58aaa595
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** `hasExplicitInProgressTarget` now becomes true when an action has `suppressAutoPromotion`, even if the action status is not `"in_progress"`. The name no longer matches the condition and can mislead future readers.  
**Suggestion:** Rename it to something like `hasExplicitPromotionControl` or split it into two booleans: `hasExplicitInProgressTarget` and `hasSuppressedAutoPromotion`, depending on how the value is used later in the file.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** `hasExplicitInProgressTarget` now becomes true when an action has `suppressAutoPromotion`, even if the action status is not `"in_progress"`. The name no longer matches the condition and can mislead future readers.  
**Suggestion:** Rename it to something like `hasExplicitPromotionControl` or split it into two booleans: `hasExplicitInProgressTarget` and `hasSuppressedAutoPromotion`, depending on how the value is used later in the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Extract Restore-Branch-Merge Validation
**Finding key:** loop-65f274d36d5a6eff7452
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R5  
**Issue:** The new `restore-branch-merge-post-state` branch embeds a dense, multi-condition validation inline. This makes the entrypoint dispatch harder to scan as more explicit recovery modes are added.  
**Suggestion:** Extract the condition into a small helper such as `isValidBranchMergeRestoreChange(recoveryChanges)` or `validateBranchMergeRestore(recoveryChanges)`, keeping the constructor focused on routing by entrypoint.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R5  
**Issue:** The new `restore-branch-merge-post-state` branch embeds a dense, multi-condition validation inline. This makes the entrypoint dispatch harder to scan as more explicit recovery modes are added.  
**Suggestion:** Extract the condition into a small helper such as `isValidBranchMergeRestoreChange(recoveryChanges)` or `validateBranchMergeRestore(recoveryChanges)`, keeping the constructor focused on routing by entrypoint.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Replace brittle outbox “not found” detection
**Finding key:** loop-e2a9bebd962f52856ec6
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R2
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R2  
**Issue:** `recordFailedOutboxEntry` detects a missing outbox entry by matching `String(error.message).startsWith("outbox entry not found:")`. This is fragile and duplicates the `fail` call.  
**Suggestion:** Add/use an outbox-store helper such as `failOrBeginAndFail(identity, reason)`, or catch a typed error/code if available. That keeps missing-entry recovery explicit and avoids depending on message text.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R2  
**Issue:** `recordFailedOutboxEntry` detects a missing outbox entry by matching `String(error.message).startsWith("outbox entry not found:")`. This is fragile and duplicates the `fail` call.  
**Suggestion:** Add/use an outbox-store helper such as `failOrBeginAndFail(identity, reason)`, or catch a typed error/code if available. That keeps missing-entry recovery explicit and avoids depending on message text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Guard missing step lookups in finalize-merge rehydration
**Finding key:** loop-d5d38959a710fcac27f0
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** `ensureFinalizeMergeInProgress` assumes several `findStepById(...)` calls always return a step. In particular, `findStepById(state.steps || [], active.stepId).status = "done"` can throw if the active step is stale or absent.  
**Suggestion:** Store lookup results in named locals and null-check them before mutation. This also makes the state transition easier to audit.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** `ensureFinalizeMergeInProgress` assumes several `findStepById(...)` calls always return a step. In particular, `findStepById(state.steps || [], active.stepId).status = "done"` can throw if the active step is stale or absent.  
**Suggestion:** Store lookup results in named locals and null-check them before mutation. This also makes the state transition easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Extract finalize hook handler names
**Finding key:** loop-35d411d6222087efa65a
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R1
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R1  
**Issue:** `runFinalizeHook` now has several string-literal handler names, including new finalize-merge metadata handlers. The growing `if` chain makes typos hard to catch and weakens consistency.  
**Suggestion:** Define local constants or a small handler dispatch table for finalize hook names, then route through that. This reduces duplication and makes the finalize-merge metadata flow easier to maintain.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R1  
**Issue:** `runFinalizeHook` now has several string-literal handler names, including new finalize-merge metadata handlers. The growing `if` chain makes typos hard to catch and weakens consistency.  
**Suggestion:** Define local constants or a small handler dispatch table for finalize hook names, then route through that. This reduces duplication and makes the finalize-merge metadata flow easier to maintain.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Rename `statusRes` to Reflect the Command
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

### 22. 1. Remove unused import
**Finding key:** loop-a33b415de9a353b071f5
**Failure mode:** refactor
**File:** tests/e2e/flow/commands/worktree-finalize.test.js
**Requirement:** R6
**Issue:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** `replaceFlowState` is imported from `../../../helpers/flow-setup.js` but is never used.  
**Suggestion:** Remove `replaceFlowState` from the import list to eliminate dead code and keep the test dependencies clear.
**Suggestion:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** `replaceFlowState` is imported from `../../../helpers/flow-setup.js` but is never used.  
**Suggestion:** Remove `replaceFlowState` from the import list to eliminate dead code and keep the test dependencies clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Reuse the finalize-merge activation helper
**Finding key:** loop-7b5e61870e8977c4d652
**Failure mode:** refactor
**File:** tests/e2e/flow/commands/worktree-finalize.test.js
**Requirement:** R6
**Issue:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The test manually walks `state.steps -> children -> children` to set `finalize-merge` and `finalize-cleanup` statuses, while the new `activateFinalizeMerge()` helper already centralizes finalize-merge status setup using `flattenSteps()`. This duplicates status-transition setup logic and assumes a fixed tree depth.  
**Suggestion:** Replace the nested loops in `"executes the finalize-merge CLI route before the main-side cleanup route"` with `activateFinalizeMerge(state)`, then explicitly set `finalize-cleanup` to `pending` via `findStepById()` if that status is necessary for the scenario.
**Suggestion:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The test manually walks `state.steps -> children -> children` to set `finalize-merge` and `finalize-cleanup` statuses, while the new `activateFinalizeMerge()` helper already centralizes finalize-merge status setup using `flattenSteps()`. This duplicates status-transition setup logic and assumes a fixed tree depth.  
**Suggestion:** Replace the nested loops in `"executes the finalize-merge CLI route before the main-side cleanup route"` with `activateFinalizeMerge(state)`, then explicitly set `finalize-cleanup` to `pending` via `findStepById()` if that status is necessary for the scenario.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Avoid pre-creating the bare origin directory
**Finding key:** loop-d6f8c81c62fdbfff73a5
**Failure mode:** refactor
**File:** tests/e2e/flow/commands/worktree-finalize.test.js
**Requirement:** R6
**Issue:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The test creates `origin = createTmpDir(...)` and then runs `git init --bare origin` inside `setupConflictWorktree()`. Initializing a bare repo into a pre-existing temp directory works, but it is less direct and creates a lifecycle split between `tmp` and `origin`.  
**Suggestion:** Let `setupConflictWorktree()` derive an origin path under `root`, or pass a not-yet-created path such as `path.join(tmp, "origin.git")`. This simplifies cleanup and keeps the fixture self-contained.
**Suggestion:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The test creates `origin = createTmpDir(...)` and then runs `git init --bare origin` inside `setupConflictWorktree()`. Initializing a bare repo into a pre-existing temp directory works, but it is less direct and creates a lifecycle split between `tmp` and `origin`.  
**Suggestion:** Let `setupConflictWorktree()` derive an origin path under `root`, or pass a not-yet-created path such as `path.join(tmp, "origin.git")`. This simplifies cleanup and keeps the fixture self-contained.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Name the command-specific expectation
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

### 26. 1. Standardize Finalize-Merge Retry Terminology
**Finding key:** loop-43b71579e981e61c8977
**Failure mode:** refactor
**File:** src/flow/commands/merge.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** Retry guidance and command naming appear in multiple files as `finalize`, `finalize-merge`, and `senti flow run finalize-merge`, while lifecycle and outbox code also encode finalize-merge-specific behavior. This creates a cross-file naming consistency risk for the recovery path.
**Suggestion:** Introduce shared constants/helpers for the finalize-merge command name and retry hint text, then use them from command output, lifecycle resolution, registry hook handling, and tests.
**Suggestion:** **File:** `src/flow/commands/merge.js`  
**Requirement:** R4  
**Issue:** Retry guidance and command naming appear in multiple files as `finalize`, `finalize-merge`, and `senti flow run finalize-merge`, while lifecycle and outbox code also encode finalize-merge-specific behavior. This creates a cross-file naming consistency risk for the recovery path.
**Suggestion:** Introduce shared constants/helpers for the finalize-merge command name and retry hint text, then use them from command output, lifecycle resolution, registry hook handling, and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Align Auto-Promotion Naming Across Lifecycle And Policy
**Finding key:** loop-5fce3b4b65b0cd65aa60
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `suppressAutoPromotion` in `definition.js` and `hasExplicitInProgressTarget` in `step-transition-policy.js` describe the same promotion-control behavior with mismatched names. One is broad, the other implies only `"in_progress"` status, so the interface between the files is unclear.
**Suggestion:** Rename both sides around a shared concept such as `suppressNextStepPromotion` / `hasExplicitPromotionControl`, and keep the action field and policy variable semantically aligned.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `suppressAutoPromotion` in `definition.js` and `hasExplicitInProgressTarget` in `step-transition-policy.js` describe the same promotion-control behavior with mismatched names. One is broad, the other implies only `"in_progress"` status, so the interface between the files is unclear.
**Suggestion:** Rename both sides around a shared concept such as `suppressNextStepPromotion` / `hasExplicitPromotionControl`, and keep the action field and policy variable semantically aligned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Consolidate Finalize-Merge Step Activation In Tests And Runtime
**Finding key:** loop-bccc79038b4349591883
**Failure mode:** refactor
**File:** tests/e2e/flow/commands/worktree-finalize.test.js
**Requirement:** R6
**Issue:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The e2e test manually mutates nested finalize step statuses while runtime code in `registry.js` has finalize-merge rehydration logic that also mutates step state. This duplicates lifecycle setup across files and risks tests passing with a shape that diverges from production transitions.
**Suggestion:** Use shared test helpers like `activateFinalizeMerge()` and `findStepById()` consistently, and mirror the production finalize-merge activation semantics rather than open-coding tree traversal.
**Suggestion:** **File:** `tests/e2e/flow/commands/worktree-finalize.test.js`  
**Requirement:** R6  
**Issue:** The e2e test manually mutates nested finalize step statuses while runtime code in `registry.js` has finalize-merge rehydration logic that also mutates step state. This duplicates lifecycle setup across files and risks tests passing with a shape that diverges from production transitions.
**Suggestion:** Use shared test helpers like `activateFinalizeMerge()` and `findStepById()` consistently, and mirror the production finalize-merge activation semantics rather than open-coding tree traversal.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Use Shared Finalize Hook Identifiers
**Finding key:** loop-ff74941ffa7d85729492
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R1
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R1  
**Issue:** Finalize hook names are represented as string literals in `registry.js`, while `definition.js` constructs finalize lifecycle phases that depend on matching command-specific hooks. This cross-file string interface is brittle.
**Suggestion:** Define shared constants or a dispatch map for finalize hook identifiers, especially the finalize-merge metadata hooks, and import them wherever lifecycle actions and hook handlers are registered.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R1  
**Issue:** Finalize hook names are represented as string literals in `registry.js`, while `definition.js` constructs finalize lifecycle phases that depend on matching command-specific hooks. This cross-file string interface is brittle.
**Suggestion:** Define shared constants or a dispatch map for finalize hook identifiers, especially the finalize-merge metadata hooks, and import them wherever lifecycle actions and hook handlers are registered.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
