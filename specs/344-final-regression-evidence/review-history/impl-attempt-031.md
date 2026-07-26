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

### 10. 1. Extract Execution Evidence Helpers
**Finding key:** loop-47da3f78d6a61bb87d7e
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 calculation and git fingerprint collection are repeated inline for streams, raw output, HEAD, tree, and worktree state. This makes the evidence-binding logic harder to audit.  
**Suggestion:** Add small helpers such as `sha256(content)`, `currentGitHeadSha(root)`, `currentGitTreeSha(root)`, and possibly `captureExecutionIdentity(root)`. Use them for both pre-run capture and post-run validation checks.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 calculation and git fingerprint collection are repeated inline for streams, raw output, HEAD, tree, and worktree state. This makes the evidence-binding logic harder to audit.  
**Suggestion:** Add small helpers such as `sha256(content)`, `currentGitHeadSha(root)`, `currentGitTreeSha(root)`, and possibly `captureExecutionIdentity(root)`. Use them for both pre-run capture and post-run validation checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Replace Explicit Proceed String Literal With a Constant
**Finding key:** loop-843d35e75e137c5737ee
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places, while nearby workflow actions use `NEXT_RECOMMENDED_ACTIONS`. This weakens naming consistency and makes typo regressions easier.  
**Suggestion:** Define a named constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, and use it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places, while nearby workflow actions use `NEXT_RECOMMENDED_ACTIONS`. This weakens naming consistency and makes typo regressions easier.  
**Suggestion:** Define a named constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, and use it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Remove Now-Unused `autoApprove` Constructor Behavior
**Finding key:** loop-f1107123663f1b1d3348
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R4  
**Issue:** `FinalRegressionFailureProfile` still receives or references `autoApprove` semantics, but the constructor now always sets `selectedAction = null`. The old parameter/branch appears dead after the policy change requiring explicit override.  
**Suggestion:** Remove the unused `autoApprove` parameter from the class constructor and update call sites accordingly, so the type reflects the new behavior directly.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R4  
**Issue:** `FinalRegressionFailureProfile` still receives or references `autoApprove` semantics, but the constructor now always sets `selectedAction = null`. The old parameter/branch appears dead after the policy change requiring explicit override.  
**Suggestion:** Remove the unused `autoApprove` parameter from the class constructor and update call sites accordingly, so the type reflects the new behavior directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Split Evidence Manifest Construction From Command Flow
**Finding key:** loop-35fcd319bfc856ef35d7
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** The `run()` method now contains a large inline block that builds manifest lines, computes stream hashes, writes the raw artifact, builds `executionBinding`, and validates it. This increases method complexity around security-critical evidence handling.  
**Suggestion:** Extract this into a focused helper such as `buildFinalRegressionExecutionBinding({ root, resultStatus, commandText, attemptPath, rawOutputPathRelative, streams, testCount, truncated, beforeState })`, returning both manifest lines and the binding object. This keeps the command orchestration simpler and makes evidence rules easier to review.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** The `run()` method now contains a large inline block that builds manifest lines, computes stream hashes, writes the raw artifact, builds `executionBinding`, and validates it. This increases method complexity around security-critical evidence handling.  
**Suggestion:** Extract this into a focused helper such as `buildFinalRegressionExecutionBinding({ root, resultStatus, commandText, attemptPath, rawOutputPathRelative, streams, testCount, truncated, beforeState })`, returning both manifest lines and the binding object. This keeps the command orchestration simpler and makes evidence rules easier to review.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Remove the now-unused `storedStep` parameter
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

### 15. 1. Bound raw output manifest reads
**Finding key:** loop-a435b8957bfe36bba548
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads `rawPath` with `fs.readFileSync(rawPath, "utf8")` before enforcing any size bound. That allows an arbitrarily large raw output file to be loaded during evidence validation, violating the bounded-resource-usage guardrail.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files above the expected evidence limit, or read through a capped helper that refuses content beyond the configured maximum.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads `rawPath` with `fs.readFileSync(rawPath, "utf8")` before enforcing any size bound. That allows an arbitrarily large raw output file to be loaded during evidence validation, violating the bounded-resource-usage guardrail.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files above the expected evidence limit, or read through a capped helper that refuses content beyond the configured maximum.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Bound untracked file hashing
**Finding key:** loop-544f3b48956b4267dff8
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint()` reads every eligible untracked file fully with `fs.readFileSync(absolutePath)`. A large untracked file can cause unbounded memory use during validation.  
**Suggestion:** Hash untracked files with a bounded streaming helper, and either cap per-file size / total bytes / file count or explicitly reject oversized untracked evidence inputs.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint()` reads every eligible untracked file fully with `fs.readFileSync(absolutePath)`. A large untracked file can cause unbounded memory use during validation.  
**Suggestion:** Hash untracked files with a bounded streaming helper, and either cap per-file size / total bytes / file count or explicitly reject oversized untracked evidence inputs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Extract repeated Git command helpers
**Finding key:** loop-569f971257842868314f
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** The new code repeats `execFileSync("git", ..., { cwd: root, encoding: "utf8" }).trim()` patterns for HEAD, tree, staged diff, unstaged diff, and file listing. This makes command execution behavior and error handling harder to keep consistent.  
**Suggestion:** Add small helpers such as `gitOutput(root, args)` and `gitOutputTrimmed(root, args)`, then use them in `finalRegressionWorktreeFingerprint()` and `validateFinalRegressionEvidence()`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** The new code repeats `execFileSync("git", ..., { cwd: root, encoding: "utf8" }).trim()` patterns for HEAD, tree, staged diff, unstaged diff, and file listing. This makes command execution behavior and error handling harder to keep consistent.  
**Suggestion:** Add small helpers such as `gitOutput(root, args)` and `gitOutputTrimmed(root, args)`, then use them in `finalRegressionWorktreeFingerprint()` and `validateFinalRegressionEvidence()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 4. Avoid inconsistent remaining risk location
**Finding key:** loop-060d6d40850e0ed67c64
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionRecordAndProceed()` requires `result.recordAndProceed.remainingRisk`, while `validateExplicitFinalRegressionProceed()` also requires `artifact.remainingRisk` and checks equality. The split location increases the chance of future drift and duplicates validation responsibility.  
**Suggestion:** Normalize remaining-risk validation into one helper that checks both fields only if both are intentionally part of the artifact contract, with a single error message and one source of truth for the non-empty string rule.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionRecordAndProceed()` requires `result.recordAndProceed.remainingRisk`, while `validateExplicitFinalRegressionProceed()` also requires `artifact.remainingRisk` and checks equality. The split location increases the chance of future drift and duplicates validation responsibility.  
**Suggestion:** Normalize remaining-risk validation into one helper that checks both fields only if both are intentionally part of the artifact contract, with a single error message and one source of truth for the non-empty string rule.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Use a more specific environment variable name
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

### 20. 1. Extract the Explicit Record-And-Proceed Action Name
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

### 21. 2. Add a Focused Assertion for Newly Required Record-And-Proceed Fields
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

### 22. 1. Extract Repeated SHA Fixtures Into Named Constants
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

### 23. 2. Clarify Or Correct Tree SHA Length In The Newer Review Tree Test
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

### 24. 1. Consolidate Duplicate Cleanup Hooks
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

### 25. 2. Avoid Over-Specific Eligibility Helper
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

### 26. 1. Centralize Final Regression Evidence Helpers
**Finding key:** loop-c33d4d7e4871e57389b1
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** Both `run-final-regression.js` and `test-artifacts.js` introduce inline SHA-256, git state, tree/head, raw output, and worktree fingerprint logic. The same evidence-binding concepts are now split across command execution and validation, increasing drift risk.
**Suggestion:** Extract shared helpers in one evidence-focused module, for example `sha256Content()`, `gitOutputTrimmed()`, `captureFinalRegressionExecutionIdentity()`, and bounded raw artifact hashing. Use them from both execution and validation paths.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** Both `run-final-regression.js` and `test-artifacts.js` introduce inline SHA-256, git state, tree/head, raw output, and worktree fingerprint logic. The same evidence-binding concepts are now split across command execution and validation, increasing drift risk.
**Suggestion:** Extract shared helpers in one evidence-focused module, for example `sha256Content()`, `gitOutputTrimmed()`, `captureFinalRegressionExecutionIdentity()`, and bounded raw artifact hashing. Use them from both execution and validation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Share Explicit Record-And-Proceed Action Naming
**Finding key:** loop-6e1ac45e1e0af542f8b6
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** The literal `"explicit-record-and-proceed"` appears in production code and tests, with separate proposals suggesting constants in each file. Defining separate constants would still allow production and test naming to drift.
**Suggestion:** Export or colocate a single action constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, from the workflow action module or final-regression module, and import it in `tests/unit/flow/final-regression-record-and-proceed.test.js`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** The literal `"explicit-record-and-proceed"` appears in production code and tests, with separate proposals suggesting constants in each file. Defining separate constants would still allow production and test naming to drift.
**Suggestion:** Export or colocate a single action constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, from the workflow action module or final-regression module, and import it in `tests/unit/flow/final-regression-record-and-proceed.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Unify Remaining-Risk Contract Validation
**Finding key:** loop-4f52f6db1c96bae33e0b
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `remainingRisk` is validated across `validateFinalRegressionRecordAndProceed()` and `validateExplicitFinalRegressionProceed()`, while related fixture requirements are duplicated in `final-regression-record-and-proceed.test.js`. This creates a cross-file contract that is easy to update incompletely.
**Suggestion:** Add one helper or schema-level validator for explicit record-and-proceed fields, including `remainingRisk`, `operatorJustification`, and `failureClassification`, then use it from artifact validation and targeted tests.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `remainingRisk` is validated across `validateFinalRegressionRecordAndProceed()` and `validateExplicitFinalRegressionProceed()`, while related fixture requirements are duplicated in `final-regression-record-and-proceed.test.js`. This creates a cross-file contract that is easy to update incompletely.
**Suggestion:** Add one helper or schema-level validator for explicit record-and-proceed fields, including `remainingRisk`, `operatorJustification`, and `failureClassification`, then use it from artifact validation and targeted tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Standardize Git SHA Fixture Semantics
**Finding key:** loop-95a20c3d150ad29ea9a7
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`
**Requirement:** R3
**Issue:** New retry-recovery tests use both 40-character and 64-character values for fields named `treeSha`, while final-regression evidence code appears to treat git tree/head values as git object identifiers. Cross-file naming suggests these should be the same kind of identifier.
**Suggestion:** Use consistently named fixture constants such as `gitTreeSha` for 40-character Git SHAs and `evidenceDigest` for 64-character SHA-256 digests. Apply that naming consistently across retry-recovery and final-regression tests.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`
**Requirement:** R3
**Issue:** New retry-recovery tests use both 40-character and 64-character values for fields named `treeSha`, while final-regression evidence code appears to treat git tree/head values as git object identifiers. Cross-file naming suggests these should be the same kind of identifier.
**Suggestion:** Use consistently named fixture constants such as `gitTreeSha` for 40-character Git SHAs and `evidenceDigest` for 64-character SHA-256 digests. Apply that naming consistently across retry-recovery and final-regression tests.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
