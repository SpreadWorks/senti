# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Avoid JSON string comparison for ledger entry identity
**Finding key:** loop-a3383f5a563bedc3af0e
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `commitRepairTransaction()` compares `persistedEntry.toJSON()` and `entry.toJSON()` via `JSON.stringify()`. This is brittle because equality depends on serialization order and full object shape, and it obscures the actual identity condition being checked.  
**Suggestion:** Extract a named helper such as `isSameImplRepairEntry(persistedEntry, entry)` and compare stable identity fields directly, for example entry id/timestamp/reason/fingerprint fields if available. If full structural equality is intentional, centralize it in a helper with a clear name.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `commitRepairTransaction()` compares `persistedEntry.toJSON()` and `entry.toJSON()` via `JSON.stringify()`. This is brittle because equality depends on serialization order and full object shape, and it obscures the actual identity condition being checked.  
**Suggestion:** Extract a named helper such as `isSameImplRepairEntry(persistedEntry, entry)` and compare stable identity fields directly, for example entry id/timestamp/reason/fingerprint fields if available. If full structural equality is intentional, centralize it in a helper with a clear name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Extract repeated test-execute step lookup intent
**Finding key:** loop-06c94cebcef03fc0736c
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The new `findStepById(activeState.steps || [], "test-execute")?.status === "in_progress"` embeds workflow knowledge inline and makes the invalidation condition harder to scan.  
**Suggestion:** Add a small helper such as `isTestExecutionInProgress(state)` or `isTestExecuteAlreadyInvalidated(state)` and use it in `completeLateAppliedFindingRepair()`. This keeps the repair logic focused on invalidation behavior rather than step lookup mechanics.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The new `findStepById(activeState.steps || [], "test-execute")?.status === "in_progress"` embeds workflow knowledge inline and makes the invalidation condition harder to scan.  
**Suggestion:** Add a small helper such as `isTestExecutionInProgress(state)` or `isTestExecuteAlreadyInvalidated(state)` and use it in `completeLateAppliedFindingRepair()`. This keeps the repair logic focused on invalidation behavior rather than step lookup mechanics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Rename `SPEC_TEST_SOURCE_PATH` to reflect the exception semantics
**Finding key:** loop-c3364f3dfc1b4d422baf
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `SPEC_TEST_SOURCE_PATH` describes a path pattern, but its role is more specific: it is an allowlist exception inside `isDurableRepairEvidencePath()`. The current name does not explain why spec paths are sometimes allowed even though `specs/` is generally excluded.  
**Suggestion:** Rename it to something like `DURABLE_SPEC_TEST_SOURCE_PATH` or `WORKFLOW_ARTIFACT_DURABLE_TEST_SOURCE_PATH` so the relationship with durable repair evidence is explicit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `SPEC_TEST_SOURCE_PATH` describes a path pattern, but its role is more specific: it is an allowlist exception inside `isDurableRepairEvidencePath()`. The current name does not explain why spec paths are sometimes allowed even though `specs/` is generally excluded.  
**Suggestion:** Rename it to something like `DURABLE_SPEC_TEST_SOURCE_PATH` or `WORKFLOW_ARTIFACT_DURABLE_TEST_SOURCE_PATH` so the relationship with durable repair evidence is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Simplify durable evidence path exclusion branching
**Finding key:** loop-0f57c00ff9a11dbad9f8
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The compound condition in `isDurableRepairEvidencePath()` mixes two concepts: workflow artifact exclusion and spec test source exception. As the exception list grows, this form will become harder to maintain.  
**Suggestion:** Split the condition into named booleans:

```js
const isWorkflowArtifact = WORKFLOW_ARTIFACT_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
const isDurableSpecTestSource = SPEC_TEST_SOURCE_PATH.test(relativePath);
if (isWorkflowArtifact && !isDurableSpecTestSource) return false;
```

This preserves behavior while making the exception explicit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The compound condition in `isDurableRepairEvidencePath()` mixes two concepts: workflow artifact exclusion and spec test source exception. As the exception list grows, this form will become harder to maintain.  
**Suggestion:** Split the condition into named booleans:

```js
const isWorkflowArtifact = WORKFLOW_ARTIFACT_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
const isDurableSpecTestSource = SPEC_TEST_SOURCE_PATH.test(relativePath);
if (isWorkflowArtifact && !isDurableSpecTestSource) return false;
```

This preserves behavior while making the exception explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Extract shared tests evidence path
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

### 6. 1. Rename Misleading Boolean
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

### 7. 2. Prefer Current Record Data Consistently
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

### 8. 1. Bound the in-memory diff used for evidence hashing
**Finding key:** loop-668609fc2253d4b5e6bd
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `runGit(["diff", "--no-ext-diff", "--binary", "HEAD"])` captures the entire tracked working-tree diff into memory. For large binary changes or broad worktrees, this is unbounded bulk data loading and violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Compute the hash through a bounded/streaming path, or avoid loading patch bytes entirely. For example, hash `git diff --name-status` plus per-file blob/object metadata where possible, or add an explicit maximum diff byte cap and fail with a clear review evidence error when exceeded. If exact patch binding is required, extend `runGit` or add a helper that streams stdout into `crypto.Hash` with a configured byte limit.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `runGit(["diff", "--no-ext-diff", "--binary", "HEAD"])` captures the entire tracked working-tree diff into memory. For large binary changes or broad worktrees, this is unbounded bulk data loading and violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Compute the hash through a bounded/streaming path, or avoid loading patch bytes entirely. For example, hash `git diff --name-status` plus per-file blob/object metadata where possible, or add an explicit maximum diff byte cap and fail with a clear review evidence error when exceeded. If exact patch binding is required, extend `runGit` or add a helper that streams stdout into `crypto.Hash` with a configured byte limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Centralize execution evidence construction
**Finding key:** loop-e1c4ad24f1145ed0c644
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Execution evidence is assembled inline across several blocks: stream capture, stream manifest lines, SHA-256 calculation, and `executionBinding`. This duplicates concepts and makes it easy for artifact JSON and raw manifest values to drift.  
**Suggestion:** Extract a helper such as `buildFinalRegressionExecutionBinding({ root, result, commandText, attemptPath, ... })` and a small `sha256()` helper. Have both manifest writing and artifact serialization consume the same object.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Execution evidence is assembled inline across several blocks: stream capture, stream manifest lines, SHA-256 calculation, and `executionBinding`. This duplicates concepts and makes it easy for artifact JSON and raw manifest values to drift.  
**Suggestion:** Extract a helper such as `buildFinalRegressionExecutionBinding({ root, result, commandText, attemptPath, ... })` and a small `sha256()` helper. Have both manifest writing and artifact serialization consume the same object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Replace magic action string with a named constant
**Finding key:** loop-12e39b9a62886d873d66
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places, while nearby actions use named constants. This weakens consistency and increases typo risk.  
**Suggestion:** Define a constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed"` and use it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places, while nearby actions use named constants. This weakens consistency and increases typo risk.  
**Suggestion:** Define a constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed"` and use it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Rename `captureStream` to reflect bounded evidence semantics
**Finding key:** loop-d1f12b3949868fd6857c
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `captureStream()` sounds like it captures a live stream, but it actually truncates already-collected output to the final regression evidence byte limit.  
**Suggestion:** Rename it to `captureBoundedOutput()` or `captureBoundedRegressionStream()` so callers make the 1 MiB evidence constraint obvious.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `captureStream()` sounds like it captures a live stream, but it actually truncates already-collected output to the final regression evidence byte limit.  
**Suggestion:** Rename it to `captureBoundedOutput()` or `captureBoundedRegressionStream()` so callers make the 1 MiB evidence constraint obvious.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Bound output before full buffering where possible
**Finding key:** loop-ed7f5fafbf5e028c1ad0
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** The new 1 MiB cap is applied after `result.stdout` and `result.stderr` already exist. If the subprocess runner buffers unbounded output before this point, the bounded-resource requirement is only enforced at artifact serialization time, not during collection.  
**Suggestion:** Push the byte cap into the command execution/output accumulation path used by final regression, so stdout/stderr are bounded as they are collected and the artifact never depends on unbounded intermediate strings.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** The new 1 MiB cap is applied after `result.stdout` and `result.stderr` already exist. If the subprocess runner buffers unbounded output before this point, the bounded-resource requirement is only enforced at artifact serialization time, not during collection.  
**Suggestion:** Push the byte cap into the command execution/output accumulation path used by final regression, so stdout/stderr are bounded as they are collected and the artifact never depends on unbounded intermediate strings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 5. Avoid repeated repository fingerprint calls
**Finding key:** loop-a738b3fb32602fd14ca3
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The pass validation block recalculates HEAD, tree, and worktree fingerprint inline with a long boolean expression. This mixes evidence capture with policy validation and repeats the same repository-state concept in multiple shapes.  
**Suggestion:** Extract `currentFinalRegressionRepositoryBinding(root)` returning `{ headSha, treeSha, worktreeSha256 }`, then compare it with the pre-run binding via a small equality helper. This makes the “repository changed during run” condition easier to audit.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The pass validation block recalculates HEAD, tree, and worktree fingerprint inline with a long boolean expression. This mixes evidence capture with policy validation and repeats the same repository-state concept in multiple shapes.  
**Suggestion:** Extract `currentFinalRegressionRepositoryBinding(root)` returning `{ headSha, treeSha, worktreeSha256 }`, then compare it with the pre-run binding via a small equality helper. This makes the “repository changed during run” condition easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Extract Repeated Binding Field Validation
**Finding key:** loop-30e4bc7eed3711c1991b
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `validateExplicitFinalRegressionProceed` repeats required-field checks and equality checks for `rawOutputSha256`, `headSha`, and `treeSha` in separate loops. This makes the validation harder to scan and increases the chance of future drift if another binding field is added.
**Suggestion:** Extract a small helper such as `requireMatchingExecutionBindingFields(operatorBinding, artifactBinding, fields, label)` and reuse it for required-presence plus equality validation.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `validateExplicitFinalRegressionProceed` repeats required-field checks and equality checks for `rawOutputSha256`, `headSha`, and `treeSha` in separate loops. This makes the validation harder to scan and increases the chance of future drift if another binding field is added.
**Suggestion:** Extract a small helper such as `requireMatchingExecutionBindingFields(operatorBinding, artifactBinding, fields, label)` and reuse it for required-presence plus equality validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Avoid Duplicate Evidence Failure Wrapper
**Finding key:** loop-72f2f951aac94f879138
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `finalRegressionEvidenceFailure(reason)` only wraps `{ ok: false, reason }`, and both validators use identical `try/catch` return handling. The helper is very thin and does not remove meaningful complexity.
**Suggestion:** Either inline `{ ok: false, reason: err.message }` at the catch sites, or extract a deeper helper that runs a validator callback and standardizes `{ ok: true }` / failure result handling.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `finalRegressionEvidenceFailure(reason)` only wraps `{ ok: false, reason }`, and both validators use identical `try/catch` return handling. The helper is very thin and does not remove meaningful complexity.
**Suggestion:** Either inline `{ ok: false, reason: err.message }` at the catch sites, or extract a deeper helper that runs a validator callback and standardizes `{ ok: true }` / failure result handling.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Normalize Remaining Risk Location
**Finding key:** loop-7a7ab6448048a9ed32f0
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R3
**Issue:** `validateFinalRegressionRecordAndProceed` validates `result.recordAndProceed.remainingRisk`, while `validateExplicitFinalRegressionProceed` also requires `artifact.remainingRisk` and compares the two. This split naming/location makes the data model harder to reason about.
**Suggestion:** Prefer one canonical source for remaining risk in explicit proceed artifacts. If both are required for backward compatibility within this change set, add a small helper such as `validateExplicitRemainingRisk(artifact)` so the duplication and intent are localized.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R3
**Issue:** `validateFinalRegressionRecordAndProceed` validates `result.recordAndProceed.remainingRisk`, while `validateExplicitFinalRegressionProceed` also requires `artifact.remainingRisk` and compares the two. This split naming/location makes the data model harder to reason about.
**Suggestion:** Prefer one canonical source for remaining risk in explicit proceed artifacts. If both are required for backward compatibility within this change set, add a small helper such as `validateExplicitRemainingRisk(artifact)` so the duplication and intent are localized.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Name Manifest Parser By Actual Format
**Finding key:** loop-ee6c4442f4b14d89eae9
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `readFinalRegressionManifest(rawText)` sounds like it reads a manifest file, but it actually parses `evidence.*:` lines embedded in raw output text.
**Suggestion:** Rename it to something more precise, such as `parseFinalRegressionEvidenceManifest(rawText)`, to make the call site clearer and avoid implying filesystem behavior.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `readFinalRegressionManifest(rawText)` sounds like it reads a manifest file, but it actually parses `evidence.*:` lines embedded in raw output text.
**Suggestion:** Rename it to something more precise, such as `parseFinalRegressionEvidenceManifest(rawText)`, to make the call site clearer and avoid implying filesystem behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 5. Remove Redundant `truncated` Sources Or Centralize Comparison
**Finding key:** loop-8390eba97a3245a0722a
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R1
**Issue:** Truncation is represented in several places: `artifact.executionBinding.truncated`, `manifest.truncated`, and per-stream `manifest.streams.*.truncated`. The validation currently compares all of them inline, which is correct but visually dense.
**Suggestion:** Extract `manifestTruncated(manifest)` or `validateFinalRegressionTruncation(binding, manifest)` so the invariant “overall truncated equals stdout or stderr truncated” is named once and reused consistently.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R1
**Issue:** Truncation is represented in several places: `artifact.executionBinding.truncated`, `manifest.truncated`, and per-stream `manifest.streams.*.truncated`. The validation currently compares all of them inline, which is correct but visually dense.
**Suggestion:** Extract `manifestTruncated(manifest)` or `validateFinalRegressionTruncation(binding, manifest)` so the invariant “overall truncated equals stdout or stderr truncated” is named once and reused consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Extract Repeated SHA Fixtures Into Named Constants
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

### 20. 2. Clarify Or Correct Tree SHA Length In The Newer Review Tree Test
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

### 21. 1. Consolidate Duplicate Cleanup Hooks
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

### 22. 2. Avoid Over-Specific Eligibility Helper
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

### 23. 1. Centralize final regression evidence binding
**Finding key:** loop-b23b11f779346e247961
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `run-final-regression.js` constructs execution evidence while `test-artifacts.js` independently validates the same binding fields, manifest values, hashes, truncation flags, and remaining-risk shape. This creates a cross-file contract that is duplicated rather than represented by a shared abstraction.  
**Suggestion:** Extract a shared final-regression evidence/binding model or helper used by both artifact creation and validation, for example `buildFinalRegressionExecutionBinding()` plus `validateFinalRegressionExecutionBinding()` in one module.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `run-final-regression.js` constructs execution evidence while `test-artifacts.js` independently validates the same binding fields, manifest values, hashes, truncation flags, and remaining-risk shape. This creates a cross-file contract that is duplicated rather than represented by a shared abstraction.  
**Suggestion:** Extract a shared final-regression evidence/binding model or helper used by both artifact creation and validation, for example `buildFinalRegressionExecutionBinding()` plus `validateFinalRegressionExecutionBinding()` in one module.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Normalize bounded evidence handling
**Finding key:** loop-41187fbe4c514ee24649
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `review-evidence-store.js` and `run-final-regression.js` both introduce evidence capture/hash paths, but only final regression appears to apply an explicit byte cap after output is already buffered. The bounded-resource policy is therefore inconsistent across evidence-producing files.  
**Suggestion:** Introduce a shared bounded evidence capture/hash utility that supports streaming or explicit byte limits, then use it for review diff hashing and final regression stdout/stderr evidence.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `review-evidence-store.js` and `run-final-regression.js` both introduce evidence capture/hash paths, but only final regression appears to apply an explicit byte cap after output is already buffered. The bounded-resource policy is therefore inconsistent across evidence-producing files.  
**Suggestion:** Introduce a shared bounded evidence capture/hash utility that supports streaming or explicit byte limits, then use it for review diff hashing and final regression stdout/stderr evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Use one canonical explicit proceed action constant
**Finding key:** loop-4f9c9c7f91871667a6d4
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw action string in `run-final-regression.js`, while `test-artifacts.js` validates corresponding explicit proceed artifact structure. The action name is part of a cross-file protocol but is not centralized.  
**Suggestion:** Define and export a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the shared artifact/protocol module and use it in both generation and validation code.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw action string in `run-final-regression.js`, while `test-artifacts.js` validates corresponding explicit proceed artifact structure. The action name is part of a cross-file protocol but is not centralized.  
**Suggestion:** Define and export a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the shared artifact/protocol module and use it in both generation and validation code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Align repository identity naming across review recovery and final regression
**Finding key:** loop-f71ec1b05825770d7da8
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** Review recovery code refers to `evidenceIdentity`, while final regression proposals refer to repository bindings with `headSha`, `treeSha`, and `worktreeSha256`. These appear to describe related repository-state evidence concepts but use different names and shapes across files.  
**Suggestion:** Standardize on one naming model, such as `repositoryBinding`, with consistent fields and equality helpers. Use that model in review convergence, final regression generation, and validation code where repository-state identity is compared.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** Review recovery code refers to `evidenceIdentity`, while final regression proposals refer to repository bindings with `headSha`, `treeSha`, and `worktreeSha256`. These appear to describe related repository-state evidence concepts but use different names and shapes across files.  
**Suggestion:** Standardize on one naming model, such as `repositoryBinding`, with consistent fields and equality helpers. Use that model in review convergence, final regression generation, and validation code where repository-state identity is compared.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
