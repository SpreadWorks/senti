# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Add Explicit Bounds Before Normalizing Findings
**Finding key:** loop-499410a5d729839e12d2
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** The new loop walks every entry in `blockingFindings` and `nonBlockingImprovements` without an explicit count bound. Since this processes model output, it can violate the `bounded-resource-usage` guardrail if schema validation does not already cap array lengths before this normalization step.  
**Suggestion:** Validate or enforce maximum finding counts before this loop, or move this normalization after a lightweight bounded pre-validation. Reuse the same maximums expected by `buildImplReviewResponseSchema(requirementIds)` so resource limits are defined in one place.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** The new loop walks every entry in `blockingFindings` and `nonBlockingImprovements` without an explicit count bound. Since this processes model output, it can violate the `bounded-resource-usage` guardrail if schema validation does not already cap array lengths before this normalization step.  
**Suggestion:** Validate or enforce maximum finding counts before this loop, or move this normalization after a lightweight bounded pre-validation. Reuse the same maximums expected by `buildImplReviewResponseSchema(requirementIds)` so resource limits are defined in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Extract lifecycle authority validation
**Finding key:** loop-7b02faa0f9a378c3b798
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** The same `flowManager` capability check is duplicated in `commitOwnedTestEvidenceRefresh` and `completeLateAppliedFindingRepair`, and now each check has a wider two-method condition.  
**Suggestion:** Extract a small helper such as `assertImplRepairLifecycleAuthority(flowManager, action)` that checks for `updateStepStatus` or `updateStepStatuses` and formats the action-specific error message.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** The same `flowManager` capability check is duplicated in `commitOwnedTestEvidenceRefresh` and `completeLateAppliedFindingRepair`, and now each check has a wider two-method condition.  
**Suggestion:** Extract a small helper such as `assertImplRepairLifecycleAuthority(flowManager, action)` that checks for `updateStepStatus` or `updateStepStatuses` and formats the action-specific error message.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Centralize batch status transition dispatch
**Finding key:** loop-3f3b056ed3cc4489fdaa
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `completeLateAppliedFindingRepair` now wraps a single `ExplicitRecoveryTransition` in an array solely to call `updateStepStatuses`. That makes the call site awkward and couples it to the manager’s batching API shape.  
**Suggestion:** Add a local helper such as `updateLifecycleStepStatuses(flowManager, transitions, options)` and use it consistently. The helper can prefer `updateStepStatuses` when present and fall back to `updateStepStatus` for a single transition if needed.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `completeLateAppliedFindingRepair` now wraps a single `ExplicitRecoveryTransition` in an array solely to call `updateStepStatuses`. That makes the call site awkward and couples it to the manager’s batching API shape.  
**Suggestion:** Add a local helper such as `updateLifecycleStepStatuses(flowManager, transitions, options)` and use it consistently. The helper can prefer `updateStepStatuses` when present and fall back to `updateStepStatus` for a single transition if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Rename spec test path matcher for clarity
**Finding key:** loop-a1eb93e3e47a5a8dbcc6
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `SPEC_TEST_SOURCE_PATH` sounds like a path value, but it is a regular expression matcher for source files under `specs/<id>/tests/`.  
**Suggestion:** Rename it to `SPEC_TEST_SOURCE_PATH_PATTERN` or `SPEC_TEST_SOURCE_FILE_PATTERN` so call sites like `SPEC_TEST_SOURCE_FILE_PATTERN.test(relativePath)` read more accurately.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `SPEC_TEST_SOURCE_PATH` sounds like a path value, but it is a regular expression matcher for source files under `specs/<id>/tests/`.  
**Suggestion:** Rename it to `SPEC_TEST_SOURCE_PATH_PATTERN` or `SPEC_TEST_SOURCE_FILE_PATTERN` so call sites like `SPEC_TEST_SOURCE_FILE_PATTERN.test(relativePath)` read more accurately.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 4. Avoid unbounded ledger loading in transaction recovery check
**Finding key:** loop-aa91d6575a692bccb78e
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `readImplRepairLedger(specDir)?.entries.at(-1)` loads the ledger entries just to compare the latest entry. Under the bounded-resource-usage guardrail, bulk data reads should have explicit limits.  
**Suggestion:** Add or use a bounded helper that reads only the latest impl-repair ledger entry, or enforces a maximum ledger size before loading. Then compare that latest entry against `entry`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `readImplRepairLedger(specDir)?.entries.at(-1)` loads the ledger entries just to compare the latest entry. Under the bounded-resource-usage guardrail, bulk data reads should have explicit limits.  
**Suggestion:** Add or use a bounded helper that reads only the latest impl-repair ledger entry, or enforces a maximum ledger size before loading. Then compare that latest entry against `entry`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 5. Replace JSON string equality with an explicit ledger entry comparison helper
**Finding key:** loop-80c723f20f84fdb09c43
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `JSON.stringify(persistedEntry.toJSON()) === JSON.stringify(entry.toJSON())` is a fragile structural comparison and obscures the intended domain check.  
**Suggestion:** Add a helper such as `isSameRepairLedgerEntry(left, right)` that compares the stable identity fields for an impl-repair entry. This makes the recovery condition easier to audit and avoids depending on JSON property order.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `JSON.stringify(persistedEntry.toJSON()) === JSON.stringify(entry.toJSON())` is a fragile structural comparison and obscures the intended domain check.  
**Suggestion:** Add a helper such as `isSameRepairLedgerEntry(left, right)` that compares the stable identity fields for an impl-repair entry. This makes the recovery condition easier to audit and avoids depending on JSON property order.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Extract shared tests evidence path
**Finding key:** loop-054c246af93d8f98b7ae
**Failure mode:** refactor
**File:** src/flow/lib/retry-recovery.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/retry-recovery.js`  
**Requirement:** R1  
**Issue:** `${dir}/tests` is now used in multiple recovery evidence source branches, which adds small but avoidable duplication in path construction.  
**Suggestion:** Define a local `testsPath` constant near `dir` initialization and reuse it in both branches, e.g. `const testsPath = `${dir}/tests`;`, then use `paths: [testsPath]` and `paths: ["src", `${dir}/spec.json`, testsPath]`.
**Suggestion:** **File:** `src/flow/lib/retry-recovery.js`  
**Requirement:** R1  
**Issue:** `${dir}/tests` is now used in multiple recovery evidence source branches, which adds small but avoidable duplication in path construction.  
**Suggestion:** Define a local `testsPath` constant near `dir` initialization and reuse it in both branches, e.g. `const testsPath = `${dir}/tests`;`, then use `paths: [testsPath]` and `paths: ["src", `${dir}/spec.json`, testsPath]`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Rename Misleading Boolean
**Finding key:** loop-2f44d780275bcca11a6b
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `exhaustedRejectedReview` is true when the review is rejected, even if semantic attempts are not exhausted. The name implies both rejection and exhaustion are required, but the condition is actually “rejected OR semantically exhausted with prior evidence identity.”  
**Suggestion:** Rename it to something that matches the logic, such as `recoverableReviewFailure` or split the condition into two booleans:

```js
const rejectedReview = current.disposition === "REJECTED";
const exhaustedSemanticRecovery = current.evidence == null
  && current.semanticAttempts === current.semanticMaxAttempts
  && records[index].evidenceIdentity != null;

if (!rejectedReview && !exhaustedSemanticRecovery) {
  throw new Error("review semantic recovery requires rejected or exhausted evidence");
}
```
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `exhaustedRejectedReview` is true when the review is rejected, even if semantic attempts are not exhausted. The name implies both rejection and exhaustion are required, but the condition is actually “rejected OR semantically exhausted with prior evidence identity.”  
**Suggestion:** Rename it to something that matches the logic, such as `recoverableReviewFailure` or split the condition into two booleans:

```js
const rejectedReview = current.disposition === "REJECTED";
const exhaustedSemanticRecovery = current.evidence == null
  && current.semanticAttempts === current.semanticMaxAttempts
  && records[index].evidenceIdentity != null;

if (!rejectedReview && !exhaustedSemanticRecovery) {
  throw new Error("review semantic recovery requires rejected or exhausted evidence");
}
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Prefer Current Record Data Consistently
**Finding key:** loop-e1b7a4af7636a6158d19
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** The new condition mostly reads from `current`, but checks `records[index].evidenceIdentity`. Since `readCurrent(flowState)` already returns `current`, mixing both sources makes the invariant harder to reason about and risks inconsistency if `current` is later transformed or wrapped.  
**Suggestion:** Use `current.evidenceIdentity` if available on the state object, or introduce a clearly named local if the raw record must be consulted:

```js
const currentRecord = records[index];
```

Then use `currentRecord.evidenceIdentity` in the condition to make the source intentional.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** The new condition mostly reads from `current`, but checks `records[index].evidenceIdentity`. Since `readCurrent(flowState)` already returns `current`, mixing both sources makes the invariant harder to reason about and risks inconsistency if `current` is later transformed or wrapped.  
**Suggestion:** Use `current.evidenceIdentity` if available on the state object, or introduce a clearly named local if the raw record must be consulted:

```js
const currentRecord = records[index];
```

Then use `currentRecord.evidenceIdentity` in the condition to make the source intentional.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Extract Execution Evidence Construction
**Finding key:** loop-dd2ec1d2feccaef0bcf3
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Execution evidence assembly is spread across inline logic: `streamEvidence`, `manifestStreams`, raw manifest lines, `executionBinding`, and later validation. This duplicates field knowledge and makes it easy for artifact fields and raw evidence fields to drift.  
**Suggestion:** Extract a small helper such as `buildFinalRegressionExecutionBinding({ root, result, resultStatus, commandText, rawOutputPathRelative, attemptPath, beforeHeadSha, beforeTreeSha, beforeWorktreeSha256 })` that returns `{ manifestStreams, executionBinding, rawManifestLines, testCount, truncated }`. Keep all SHA, byte-limit, parsed-result, and stream metadata naming in one place.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Execution evidence assembly is spread across inline logic: `streamEvidence`, `manifestStreams`, raw manifest lines, `executionBinding`, and later validation. This duplicates field knowledge and makes it easy for artifact fields and raw evidence fields to drift.  
**Suggestion:** Extract a small helper such as `buildFinalRegressionExecutionBinding({ root, result, resultStatus, commandText, rawOutputPathRelative, attemptPath, beforeHeadSha, beforeTreeSha, beforeWorktreeSha256 })` that returns `{ manifestStreams, executionBinding, rawManifestLines, testCount, truncated }`. Keep all SHA, byte-limit, parsed-result, and stream metadata naming in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Replace Magic Selected Action String With a Named Constant
**Finding key:** loop-61208ff25ba9c187b638
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a bare string in both `failedRecordedArtifact()` and `recordAndProceed()`. This is a new workflow state value but is not named alongside `NEXT_RECOMMENDED_ACTIONS`, increasing typo risk and weakening design consistency.  
**Suggestion:** Define a local constant, for example `const EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed";`, and use it in both places. If this file already centralizes action names near `NEXT_RECOMMENDED_ACTIONS`, place it there.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a bare string in both `failedRecordedArtifact()` and `recordAndProceed()`. This is a new workflow state value but is not named alongside `NEXT_RECOMMENDED_ACTIONS`, increasing typo risk and weakening design consistency.  
**Suggestion:** Define a local constant, for example `const EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed";`, and use it in both places. If this file already centralizes action names near `NEXT_RECOMMENDED_ACTIONS`, place it there.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Simplify Pass Invalidation Predicate
**Finding key:** loop-b30e43fd46782a1a27fe
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The pass rejection condition is a long inline boolean combining started, exit code, test count, truncation, and repository mutation checks. These are exactly the pass artifact acceptance criteria, but the current shape obscures that policy and makes future edits error-prone.  
**Suggestion:** Extract a predicate such as `finalRegressionPassEvidenceAccepted({ result, testCount, truncated, repositoryChangedDuringRun })` or `passArtifactMeetsCompletionCriteria(...)`. Then use `if (resultStatus === "pass" && !passArtifactMeetsCompletionCriteria(...))`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The pass rejection condition is a long inline boolean combining started, exit code, test count, truncation, and repository mutation checks. These are exactly the pass artifact acceptance criteria, but the current shape obscures that policy and makes future edits error-prone.  
**Suggestion:** Extract a predicate such as `finalRegressionPassEvidenceAccepted({ result, testCount, truncated, repositoryChangedDuringRun })` or `passArtifactMeetsCompletionCriteria(...)`. Then use `if (resultStatus === "pass" && !passArtifactMeetsCompletionCriteria(...))`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Rename `gitValue` To Clarify Its Behavior
**Finding key:** loop-6b691222f45b834848ad
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `gitValue(root, args)` is vague and hides that it synchronously executes Git and trims stdout. The name reads like a pure accessor, but failures throw and execution depends on repository state.  
**Suggestion:** Rename it to something more explicit, such as `readGitOutput(root, args)` or `gitOutputSync(root, args)`, matching the existing command-oriented style in this file.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `gitValue(root, args)` is vague and hides that it synchronously executes Git and trims stdout. The name reads like a pure accessor, but failures throw and execution depends on repository state.  
**Suggestion:** Rename it to something more explicit, such as `readGitOutput(root, args)` or `gitOutputSync(root, args)`, matching the existing command-oriented style in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 5. Isolate UTF-8 Truncation Logic
**Finding key:** loop-131ecb91d64b83330adc
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `captureStream()` combines byte-limit enforcement, UTF-8 boundary handling, and evidence object construction. The boundary logic is low-level and distracts from the capture policy.  
**Suggestion:** Extract the byte slicing into `truncateUtf8Buffer(buffer, maxBytes)` returning the captured buffer. Then `captureStream()` can focus on converting content into `{ content, originalByteLength, capturedByteLength, truncated }`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `captureStream()` combines byte-limit enforcement, UTF-8 boundary handling, and evidence object construction. The boundary logic is low-level and distracts from the capture policy.  
**Suggestion:** Extract the byte slicing into `truncateUtf8Buffer(buffer, maxBytes)` returning the captured buffer. Then `captureStream()` can focus on converting content into `{ content, originalByteLength, capturedByteLength, truncated }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Remove the now-unused `storedStep` parameter
**Finding key:** loop-60ff101297f821f604bb
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R3  
**Issue:** `isBlockedImplRepairRecovery({ id, status, activeNode, storedStep })` no longer reads `storedStep` after the diff removed `storedStep?.status === "done"`. Keeping the parameter creates dead code and makes callers look like the stored step still affects recovery eligibility.  
**Suggestion:** Remove `storedStep` from the function signature and from the call site at `isBlockedImplRepairRecovery({ id, status, activeNode, storedStep })`, leaving only the values that participate in the predicate.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R3  
**Issue:** `isBlockedImplRepairRecovery({ id, status, activeNode, storedStep })` no longer reads `storedStep` after the diff removed `storedStep?.status === "done"`. Keeping the parameter creates dead code and makes callers look like the stored step still affects recovery eligibility.  
**Suggestion:** Remove `storedStep` from the function signature and from the call site at `isBlockedImplRepairRecovery({ id, status, activeNode, storedStep })`, leaving only the values that participate in the predicate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Bound raw output loading
**Finding key:** loop-9b4509393d92a37e0cda
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads `rawOutputPath` with `fs.readFileSync(rawPath, "utf8")` without checking file size first. That allows unbounded bulk loading, violating `bounded-resource-usage`, and weakens the 1 MiB output evidence constraint.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files over the expected evidence limit. If the manifest plus captured streams can exceed 1 MiB slightly, define a named upper bound such as `FINAL_REGRESSION_RAW_OUTPUT_MAX_BYTES` and enforce it consistently.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads `rawOutputPath` with `fs.readFileSync(rawPath, "utf8")` without checking file size first. That allows unbounded bulk loading, violating `bounded-resource-usage`, and weakens the 1 MiB output evidence constraint.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files over the expected evidence limit. If the manifest plus captured streams can exceed 1 MiB slightly, define a named upper bound such as `FINAL_REGRESSION_RAW_OUTPUT_MAX_BYTES` and enforce it consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Bound untracked file fingerprinting
**Finding key:** loop-a6006401e16a6c73078f
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint()` reads every eligible untracked file fully with `fs.readFileSync(absolutePath)`. Large or numerous untracked files can cause unbounded memory and runtime usage, violating `bounded-resource-usage`.  
**Suggestion:** Add explicit bounds for untracked files, such as max file count and max bytes per file, or stream each file into the hash with a byte limit. Reject evidence if the worktree exceeds those bounds.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint()` reads every eligible untracked file fully with `fs.readFileSync(absolutePath)`. Large or numerous untracked files can cause unbounded memory and runtime usage, violating `bounded-resource-usage`.  
**Suggestion:** Add explicit bounds for untracked files, such as max file count and max bytes per file, or stream each file into the hash with a byte limit. Reject evidence if the worktree exceeds those bounds.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Extract execution binding field validation
**Finding key:** loop-853554ed2a68711685a8
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** Required binding fields are checked inline in `validateExplicitFinalRegressionProceed()`, while `validateFinalRegressionEvidence()` separately validates overlapping binding properties. This duplicates the validation concept and risks drift as binding requirements evolve.  
**Suggestion:** Extract a helper such as `requireExecutionBindingFields(binding, fields, label)` and reuse it for both artifact-level and explicit proceed evidence validation.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** Required binding fields are checked inline in `validateExplicitFinalRegressionProceed()`, while `validateFinalRegressionEvidence()` separately validates overlapping binding properties. This duplicates the validation concept and risks drift as binding requirements evolve.  
**Suggestion:** Extract a helper such as `requireExecutionBindingFields(binding, fields, label)` and reuse it for both artifact-level and explicit proceed evidence validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Rename manifest parser for clarity
**Finding key:** loop-b56e28316f146c1ed6da
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `readFinalRegressionManifest(rawText)` does not read from storage; it parses manifest lines from already-loaded text. The name makes the function sound like it performs I/O.  
**Suggestion:** Rename it to `parseFinalRegressionEvidenceManifest(rawText)` or `parseFinalRegressionManifest(rawText)` to match its behavior.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `readFinalRegressionManifest(rawText)` does not read from storage; it parses manifest lines from already-loaded text. The name makes the function sound like it performs I/O.  
**Suggestion:** Rename it to `parseFinalRegressionEvidenceManifest(rawText)` or `parseFinalRegressionManifest(rawText)` to match its behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 5. Share current git binding collection
**Finding key:** loop-859d63aa46f76b4c0ae3
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` shells out separately for `HEAD`, `write-tree`, and `finalRegressionWorktreeFingerprint(root)` inside the stale-binding check. The logic is compact but mixes validation with current-state collection.  
**Suggestion:** Extract a helper such as `currentFinalRegressionExecutionBinding(root)` returning `{ headSha, treeSha, worktreeSha256 }`, then compare against it. This makes the evidence binding contract easier to audit and reuse.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` shells out separately for `HEAD`, `write-tree`, and `finalRegressionWorktreeFingerprint(root)` inside the stale-binding check. The logic is compact but mixes validation with current-state collection.  
**Suggestion:** Extract a helper such as `currentFinalRegressionExecutionBinding(root)` returning `{ headSha, treeSha, worktreeSha256 }`, then compare against it. This makes the evidence binding contract easier to audit and reuse.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Use a more specific environment variable name
**Finding key:** loop-9d67fdfd5759b08029bc
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R4  
**Issue:** The new `environment` variable is generic, but its purpose is specifically to remove `NODE_TEST_CONTEXT` before spawning the test process.  
**Suggestion:** Rename it to something like `envWithoutNodeTestContext` so the intent is clear at the call site:

```js
const { NODE_TEST_CONTEXT: _nodeTestContext, ...envWithoutNodeTestContext } = process.env;
...
env: { ...envWithoutNodeTestContext, ...command.env },
```
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R4  
**Issue:** The new `environment` variable is generic, but its purpose is specifically to remove `NODE_TEST_CONTEXT` before spawning the test process.  
**Suggestion:** Rename it to something like `envWithoutNodeTestContext` so the intent is clear at the call site:

```js
const { NODE_TEST_CONTEXT: _nodeTestContext, ...envWithoutNodeTestContext } = process.env;
...
env: { ...envWithoutNodeTestContext, ...command.env },
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Extract the Explicit Record-And-Proceed Action Name
**Finding key:** loop-1a45f65be9cc291c51e5
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression-record-and-proceed.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R4  
**Issue:** The literal `"explicit-record-and-proceed"` is now repeated in the fixture and assertion. If the action name changes again, the test can become internally inconsistent or require multiple edits.  
**Suggestion:** Define a local constant such as `const EXPLICIT_RECORD_AND_PROCEED = "explicit-record-and-proceed";` and use it in both `failedRecordedArtifact()` and the text assertion.
**Suggestion:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R4  
**Issue:** The literal `"explicit-record-and-proceed"` is now repeated in the fixture and assertion. If the action name changes again, the test can become internally inconsistent or require multiple edits.  
**Suggestion:** Define a local constant such as `const EXPLICIT_RECORD_AND_PROCEED = "explicit-record-and-proceed";` and use it in both `failedRecordedArtifact()` and the text assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Add a Focused Assertion for Newly Required Record-And-Proceed Fields
**Finding key:** loop-0e854204aee55eed4ca9
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression-record-and-proceed.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R2  
**Issue:** The fixture now includes `failureClassification`, `operatorJustification`, `remainingRisk`, and `executionBinding`, but the negative schema test still only checks invalid evidence. That leaves the test less clear about which new fields are required versus incidental fixture data.  
**Suggestion:** Add one compact invalid-case assertion for a missing or empty newly required field, for example `operatorJustification: ""`, so the test documents the explicit-record-and-proceed contract more directly.
**Suggestion:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R2  
**Issue:** The fixture now includes `failureClassification`, `operatorJustification`, `remainingRisk`, and `executionBinding`, but the negative schema test still only checks invalid evidence. That leaves the test less clear about which new fields are required versus incidental fixture data.  
**Suggestion:** Add one compact invalid-case assertion for a missing or empty newly required field, for example `operatorJustification: ""`, so the test documents the explicit-record-and-proceed contract more directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Extract Repeated SHA Fixtures Into Named Constants
**Finding key:** loop-51c84e5e6e6969c887c3
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The new tests repeat values like `"8".repeat(40)`, `"a".repeat(40)`, `"b".repeat(64)`, and `"d".repeat(64)` across setup, mutation input, and assertions. This makes the intended identity relationships harder to scan and easier to accidentally desynchronize.  
**Suggestion:** Define local constants such as `previousTreeSha`, `nextTreeSha`, and `evidenceDigest` at the top of each test, then reuse them in the state setup, mutation input, and assertions.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The new tests repeat values like `"8".repeat(40)`, `"a".repeat(40)`, `"b".repeat(64)`, and `"d".repeat(64)` across setup, mutation input, and assertions. This makes the intended identity relationships harder to scan and easier to accidentally desynchronize.  
**Suggestion:** Define local constants such as `previousTreeSha`, `nextTreeSha`, and `evidenceDigest` at the top of each test, then reuse them in the state setup, mutation input, and assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Clarify Or Correct Tree SHA Length In The Newer Review Tree Test
**Finding key:** loop-b4069de8352688e9dba0
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The first added test uses 40-character tree SHAs, while the second uses 64-character values for `treeSha`, `previousTreeSha`, and `nextTreeSha`. If these fields represent Git tree SHAs, the inconsistency obscures the fixture’s intent and may accidentally test unrealistic data.  
**Suggestion:** Use 40-character tree SHA fixtures consistently, unless the 64-character value is intentional. If intentional, add a short fixture name or comment explaining why this test uses 64-character tree identifiers.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The first added test uses 40-character tree SHAs, while the second uses 64-character values for `treeSha`, `previousTreeSha`, and `nextTreeSha`. If these fields represent Git tree SHAs, the inconsistency obscures the fixture’s intent and may accidentally test unrealistic data.  
**Suggestion:** Use 40-character tree SHA fixtures consistently, unless the 64-character value is intentional. If intentional, add a short fixture name or comment explaining why this test uses 64-character tree identifiers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Consolidate Duplicate Cleanup Hooks
**Finding key:** loop-b09ca167f17bfd39edf9
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-file-map.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-recovery-file-map.test.js`  
**Requirement:** R1  
**Issue:** Both `describe` blocks define identical `cleanup` arrays and `afterEach` teardown loops. This repeats the same test fixture lifecycle logic in the same file.  
**Suggestion:** Move `const cleanup = [];` and the shared `afterEach(() => { while (...) ... })` to the outer scope once, or introduce a small helper like `trackTmpDir(root)` if each test suite needs clearer ownership. This removes duplication without changing test behavior.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-file-map.test.js`  
**Requirement:** R1  
**Issue:** Both `describe` blocks define identical `cleanup` arrays and `afterEach` teardown loops. This repeats the same test fixture lifecycle logic in the same file.  
**Suggestion:** Move `const cleanup = [];` and the shared `afterEach(() => { while (...) ... })` to the outer scope once, or introduce a small helper like `trackTmpDir(root)` if each test suite needs clearer ownership. This removes duplication without changing test behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Avoid Over-Specific Eligibility Helper
**Finding key:** loop-071a08cb9c8dcb92c0c2
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-file-map.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-recovery-file-map.test.js`  
**Requirement:** R1  
**Issue:** `implReviewEligibility()` duplicates the existing `eligibility()` helper shape and only changes fixed option values. As more retry recovery scenarios are added, this pattern can grow into several near-identical helpers.  
**Suggestion:** Replace both helpers with one parameterized helper, for example `recoveryEligibility(root, flowState, overrides = {})`, with the common defaults inside and scenario-specific fields passed by each test. This keeps the test setup concise while preserving readability.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-file-map.test.js`  
**Requirement:** R1  
**Issue:** `implReviewEligibility()` duplicates the existing `eligibility()` helper shape and only changes fixed option values. As more retry recovery scenarios are added, this pattern can grow into several near-identical helpers.  
**Suggestion:** Replace both helpers with one parameterized helper, for example `recoveryEligibility(root, flowState, overrides = {})`, with the common defaults inside and scenario-specific fields passed by each test. This keeps the test setup concise while preserving readability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Centralize Explicit Record-And-Proceed Action Name
**Finding key:** loop-a39878d3bb386effa3bc
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** The workflow action string `"explicit-record-and-proceed"` is introduced in production code and repeated in `tests/unit/flow/final-regression-record-and-proceed.test.js`. This creates a cross-file naming drift risk between the emitted action and the test fixture/assertion.  
**Suggestion:** Export or colocate a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the production module or a shared workflow constants module, then use it in both production code and tests.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** The workflow action string `"explicit-record-and-proceed"` is introduced in production code and repeated in `tests/unit/flow/final-regression-record-and-proceed.test.js`. This creates a cross-file naming drift risk between the emitted action and the test fixture/assertion.  
**Suggestion:** Export or colocate a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the production module or a shared workflow constants module, then use it in both production code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Unify Final Regression Execution Binding Contract
**Finding key:** loop-d81d2a5ef41cbaaccf2c
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Final regression execution binding fields are assembled in `run-final-regression.js`, validated in `test-artifacts.js`, and manually mirrored in `tests/unit/flow/final-regression-record-and-proceed.test.js`. The same contract is spread across files, increasing the chance that required fields, names, or semantics drift.  
**Suggestion:** Introduce a shared helper or class for final regression execution binding construction and validation, with one source of truth for required fields such as `headSha`, `treeSha`, `worktreeSha256`, command metadata, and raw output path.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Final regression execution binding fields are assembled in `run-final-regression.js`, validated in `test-artifacts.js`, and manually mirrored in `tests/unit/flow/final-regression-record-and-proceed.test.js`. The same contract is spread across files, increasing the chance that required fields, names, or semantics drift.  
**Suggestion:** Introduce a shared helper or class for final regression execution binding construction and validation, with one source of truth for required fields such as `headSha`, `treeSha`, `worktreeSha256`, command metadata, and raw output path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Share Final Regression Evidence Size Limits
**Finding key:** loop-4b3ba5146b9ce8e378d6
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R4  
**Issue:** `run-final-regression.js` appears to enforce capture/truncation behavior while `test-artifacts.js` validates raw evidence loading separately. If byte limits are defined only at the producer or consumer side, the files can disagree about acceptable evidence size.  
**Suggestion:** Define a shared named limit such as `FINAL_REGRESSION_RAW_OUTPUT_MAX_BYTES` and use it in both evidence capture and evidence validation before reading raw output.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R4  
**Issue:** `run-final-regression.js` appears to enforce capture/truncation behavior while `test-artifacts.js` validates raw evidence loading separately. If byte limits are defined only at the producer or consumer side, the files can disagree about acceptable evidence size.  
**Suggestion:** Define a shared named limit such as `FINAL_REGRESSION_RAW_OUTPUT_MAX_BYTES` and use it in both evidence capture and evidence validation before reading raw output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Align Git SHA Fixture Semantics With Production Binding Names
**Finding key:** loop-0770c75bb5cad5b22bfd
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** Tests use mixed 40-character and 64-character values for fields named `treeSha`, while production final-regression and recovery code treats `treeSha` as a Git tree identity. This naming/data mismatch can obscure whether a value is a Git SHA, evidence digest, or generic hash.  
**Suggestion:** Use 40-character fixtures for Git SHA fields consistently, and reserve 64-character fixtures for digest fields with names like `evidenceDigest` or `worktreeSha256`.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** Tests use mixed 40-character and 64-character values for fields named `treeSha`, while production final-regression and recovery code treats `treeSha` as a Git tree identity. This naming/data mismatch can obscure whether a value is a Git SHA, evidence digest, or generic hash.  
**Suggestion:** Use 40-character fixtures for Git SHA fields consistently, and reserve 64-character fixtures for digest fields with names like `evidenceDigest` or `worktreeSha256`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
