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

### 10. 1. Extract Evidence Hash Helpers
**Finding key:** loop-a847ceaef59b8b38b729
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 creation is repeated inline for stream content and raw artifact content, which makes evidence generation noisier and easier to drift from validation semantics.  
**Suggestion:** Add a small helper such as `sha256Hex(content)` and use it for `evidence.*.sha256` and `rawOutputSha256`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 creation is repeated inline for stream content and raw artifact content, which makes evidence generation noisier and easier to drift from validation semantics.  
**Suggestion:** Add a small helper such as `sha256Hex(content)` and use it for `evidence.*.sha256` and `rawOutputSha256`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Extract Stream Manifest Formatting
**Finding key:** loop-949d480545ebc9485caf
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** The `rawLines.push(...)` block for execution evidence mixes command execution flow with manifest serialization details, including repeated stdout/stderr formatting logic.  
**Suggestion:** Move the evidence line construction into a focused helper, for example `finalRegressionEvidenceLines({ commandText, resultStatus, testCount, truncated, repository, streams })`, returning the lines to append.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** The `rawLines.push(...)` block for execution evidence mixes command execution flow with manifest serialization details, including repeated stdout/stderr formatting logic.  
**Suggestion:** Move the evidence line construction into a focused helper, for example `finalRegressionEvidenceLines({ commandText, resultStatus, testCount, truncated, repository, streams })`, returning the lines to append.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Replace Magic Selected Action String
**Finding key:** loop-86b389a0adb07a00cc4e
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places while related actions use `NEXT_RECOMMENDED_ACTIONS`. This weakens naming consistency and makes typos harder to catch.  
**Suggestion:** Define a constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed"` near the other final-regression action constants and reuse it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places while related actions use `NEXT_RECOMMENDED_ACTIONS`. This weakens naming consistency and makes typos harder to catch.  
**Suggestion:** Define a constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed"` near the other final-regression action constants and reuse it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Simplify Manifest Stream Fallback
**Finding key:** loop-c8ed490da0bd05e10e3d
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `manifestStreams` can recapture `result.stdout` and `result.stderr` after `result` has already been replaced with captured content. That fallback is subtle and produces different `originalByteLength` semantics depending on whether `streamEvidence` was set.  
**Suggestion:** Ensure `streamEvidence` is initialized for every non-skipped execution path before manifest construction, then remove the fallback recapture branch.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `manifestStreams` can recapture `result.stdout` and `result.stderr` after `result` has already been replaced with captured content. That fallback is subtle and produces different `originalByteLength` semantics depending on whether `streamEvidence` was set.  
**Suggestion:** Ensure `streamEvidence` is initialized for every non-skipped execution path before manifest construction, then remove the fallback recapture branch.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 5. Extract Pass Evidence Gate
**Finding key:** loop-13f8a4bd7169d9e234c1
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The pass-to-fail downgrade condition combines several independent evidence requirements inline: started, exit code, test count, truncation, and repository binding. This is the core R1 gate but is currently embedded in the middle of command orchestration.  
**Suggestion:** Extract a helper such as `finalRegressionPassEvidenceFailure({ result, testCount, truncated, repositoryChangedDuringRun })` that returns `null` or a reason. Use that reason when assigning `UnknownRegressionFailure`, making the gate easier to audit and extend.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The pass-to-fail downgrade condition combines several independent evidence requirements inline: started, exit code, test count, truncation, and repository binding. This is the core R1 gate but is currently embedded in the middle of command orchestration.  
**Suggestion:** Extract a helper such as `finalRegressionPassEvidenceFailure({ result, testCount, truncated, repositoryChangedDuringRun })` that returns `null` or a reason. Use that reason when assigning `UnknownRegressionFailure`, making the gate easier to audit and extend.
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

### 16. 1. Bound raw output and worktree reads
**Finding key:** loop-1311a7b3a18345a0591d
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads the raw output file with `fs.readFileSync(rawPath, "utf8")`, and `finalRegressionWorktreeFingerprint()` loads full git diffs and untracked file contents into memory. This violates the bounded-resource-usage guardrail because file/diff size is not capped before bulk loading.  
**Suggestion:** Add explicit size checks before reading raw output and untracked files, and avoid unbounded `execFileSync` diff capture where possible. For raw output, reject files larger than the expected artifact limit before reading.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads the raw output file with `fs.readFileSync(rawPath, "utf8")`, and `finalRegressionWorktreeFingerprint()` loads full git diffs and untracked file contents into memory. This violates the bounded-resource-usage guardrail because file/diff size is not capped before bulk loading.  
**Suggestion:** Add explicit size checks before reading raw output and untracked files, and avoid unbounded `execFileSync` diff capture where possible. For raw output, reject files larger than the expected artifact limit before reading.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Reuse repository binding comparison
**Finding key:** loop-c82a832dc90a7462f379
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `FinalRegressionRepositoryBinding.matches()` is defined but `validateFinalRegressionEvidence()` manually compares `headSha`, `treeSha`, and `worktreeSha256` instead. That leaves dead or underused class behavior and duplicates comparison logic.  
**Suggestion:** Replace the three manual stale checks with `recordedRepository.matches(currentRepository)`, or remove `matches()` if field-specific error messages are more important.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `FinalRegressionRepositoryBinding.matches()` is defined but `validateFinalRegressionEvidence()` manually compares `headSha`, `treeSha`, and `worktreeSha256` instead. That leaves dead or underused class behavior and duplicates comparison logic.  
**Suggestion:** Replace the three manual stale checks with `recordedRepository.matches(currentRepository)`, or remove `matches()` if field-specific error messages are more important.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Extract stream evidence validation
**Finding key:** loop-98f451c158c1e15e7e05
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** The stream validation loop mixes presence checks, length checks, truncation checks, and hashing inline. This makes the evidence-binding logic harder to audit and will be easy to duplicate if more streams or fields are added.  
**Suggestion:** Extract a small helper such as `validateFinalRegressionStreamBinding(name, bindingStream, manifestStream)` that performs the comparison and hash check, then call it for `stdout` and `stderr`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** The stream validation loop mixes presence checks, length checks, truncation checks, and hashing inline. This makes the evidence-binding logic harder to audit and will be easy to duplicate if more streams or fields are added.  
**Suggestion:** Extract a small helper such as `validateFinalRegressionStreamBinding(name, bindingStream, manifestStream)` that performs the comparison and hash check, then call it for `stdout` and `stderr`.
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

### 26. 1. Centralize Explicit Record-And-Proceed Action Name
**Finding key:** loop-27b1e10694e622fcc48d
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** The new action name `"explicit-record-and-proceed"` is introduced in production code and repeated in `tests/unit/flow/final-regression-record-and-proceed.test.js`. This creates a cross-file naming drift risk between the implementation contract and test fixtures/assertions.
**Suggestion:** Export or colocate a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the production module, and have tests import or mirror it through the existing action-constant pattern.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** The new action name `"explicit-record-and-proceed"` is introduced in production code and repeated in `tests/unit/flow/final-regression-record-and-proceed.test.js`. This creates a cross-file naming drift risk between the implementation contract and test fixtures/assertions.
**Suggestion:** Export or colocate a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the production module, and have tests import or mirror it through the existing action-constant pattern.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Share Final Regression Evidence Hashing Semantics
**Finding key:** loop-e06de77af123f1de7602
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Evidence SHA-256 values are generated inline in `run-final-regression.js`, while `src/flow/lib/test-artifacts.js` independently validates stream/raw evidence hashes. The producer and validator now encode the same evidence-binding semantics separately across files.
**Suggestion:** Extract a shared helper such as `sha256Hex(content)` or a small final-regression evidence utility module used by both generation and validation paths.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Evidence SHA-256 values are generated inline in `run-final-regression.js`, while `src/flow/lib/test-artifacts.js` independently validates stream/raw evidence hashes. The producer and validator now encode the same evidence-binding semantics separately across files.
**Suggestion:** Extract a shared helper such as `sha256Hex(content)` or a small final-regression evidence utility module used by both generation and validation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Align Stream Evidence Construction And Validation
**Finding key:** loop-7400035866d40b787506
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `run-final-regression.js` formats stdout/stderr stream evidence and `test-artifacts.js` validates the same stream fields with separate inline logic. This duplicates the stream contract across files and makes future additions easy to implement on only one side.
**Suggestion:** Introduce a shared stream evidence abstraction or helper pair with common field names and hashing rules, then use it from both manifest generation and validation.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `run-final-regression.js` formats stdout/stderr stream evidence and `test-artifacts.js` validates the same stream fields with separate inline logic. This duplicates the stream contract across files and makes future additions easy to implement on only one side.
**Suggestion:** Introduce a shared stream evidence abstraction or helper pair with common field names and hashing rules, then use it from both manifest generation and validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Centralize Bounded Artifact Read Limits
**Finding key:** loop-9abc5b0eeb2e4622a48a
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R4  
**Issue:** Multiple files raise bounded-resource concerns around model output normalization, ledger reads, raw output reads, and git/worktree captures. The limits appear to be enforced or proposed locally, which risks inconsistent caps across review findings, repair ledgers, and final regression artifacts.
**Suggestion:** Define shared limit constants/helpers for flow artifact reads and generated-output normalization, then reuse them in `review.js`, `impl-repair-artifacts.js`, and `test-artifacts.js`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R4  
**Issue:** Multiple files raise bounded-resource concerns around model output normalization, ledger reads, raw output reads, and git/worktree captures. The limits appear to be enforced or proposed locally, which risks inconsistent caps across review findings, repair ledgers, and final regression artifacts.
**Suggestion:** Define shared limit constants/helpers for flow artifact reads and generated-output normalization, then reuse them in `review.js`, `impl-repair-artifacts.js`, and `test-artifacts.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
