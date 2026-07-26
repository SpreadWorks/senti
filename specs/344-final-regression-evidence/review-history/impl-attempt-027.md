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

### 10. 1. Bound the in-memory diff used for evidence hashing
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

### 11. 1. Extract Evidence Hashing Helpers
**Finding key:** loop-9a25fdf543562b50fe6c
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 calculation is repeated inline for stdout, stderr, and raw output, making evidence-binding logic harder to audit.  
**Suggestion:** Add a small helper such as `sha256Hex(content)` and use it for stream hashes and `rawOutputSha256`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 calculation is repeated inline for stdout, stderr, and raw output, making evidence-binding logic harder to audit.  
**Suggestion:** Add a small helper such as `sha256Hex(content)` and use it for stream hashes and `rawOutputSha256`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Replace Magic Proceed Action String
**Finding key:** loop-499dd8339c5f4c698f90
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places, while existing actions use `NEXT_RECOMMENDED_ACTIONS`.  
**Suggestion:** Define a named constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, and reuse it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a raw string in multiple places, while existing actions use `NEXT_RECOMMENDED_ACTIONS`.  
**Suggestion:** Define a named constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, and reuse it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Validate Artifact Before Persisting Result JSON
**Finding key:** loop-345a3ca3c17049a8f861
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `resultPath` is written before `validateFinalRegressionEvidence()` runs. If validation fails, an invalid artifact remains on disk.  
**Suggestion:** Build and validate the JSON first, then write it only after all artifact and evidence-binding validation succeeds.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `resultPath` is written before `validateFinalRegressionEvidence()` runs. If validation fails, an invalid artifact remains on disk.  
**Suggestion:** Build and validate the JSON first, then write it only after all artifact and evidence-binding validation succeeds.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 4. Make Worktree Fingerprint Bounds Explicit
**Finding key:** loop-14ae1ae4d08e813d9af4
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint(root)` is called without an explicit bound at the call site, while the guardrail requires bounded bulk processing.  
**Suggestion:** Pass an explicit maximum, reuse an existing scan limit constant, or add a named constant near the final-regression evidence constants so the fingerprint operation’s resource bound is visible and auditable.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint(root)` is called without an explicit bound at the call site, while the guardrail requires bounded bulk processing.  
**Suggestion:** Pass an explicit maximum, reuse an existing scan limit constant, or add a named constant near the final-regression evidence constants so the fingerprint operation’s resource bound is visible and auditable.
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

### 16. 1. Bound raw evidence reads
**Finding key:** loop-d5370af48f6495004aab
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads the entire raw output file with `fs.readFileSync(rawPath, "utf8")` before validating manifest truncation or stream sizes. This creates an unbounded bulk read and violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files above the maximum expected artifact size, ideally derived from the two 1 MiB stream caps plus manifest overhead. Keep the cap explicit and named, for example `FINAL_REGRESSION_RAW_OUTPUT_MAX_BYTES`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads the entire raw output file with `fs.readFileSync(rawPath, "utf8")` before validating manifest truncation or stream sizes. This creates an unbounded bulk read and violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files above the maximum expected artifact size, ideally derived from the two 1 MiB stream caps plus manifest overhead. Keep the cap explicit and named, for example `FINAL_REGRESSION_RAW_OUTPUT_MAX_BYTES`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Extract repeated git metadata helpers
**Finding key:** loop-8965f472c08be053f85a
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` calls `execFileSync("git", ...)` inline for `HEAD` and `write-tree`, while `finalRegressionWorktreeFingerprint()` also embeds git command execution directly. The file is accumulating repeated low-level git command handling.  
**Suggestion:** Add small helpers such as `readGitHeadSha(root)`, `readGitTreeSha(root)`, and `readGitOutput(root, args)`. This centralizes `cwd`, `encoding`, trimming behavior, and error handling, making evidence binding validation easier to audit.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` calls `execFileSync("git", ...)` inline for `HEAD` and `write-tree`, while `finalRegressionWorktreeFingerprint()` also embeds git command execution directly. The file is accumulating repeated low-level git command handling.  
**Suggestion:** Add small helpers such as `readGitHeadSha(root)`, `readGitTreeSha(root)`, and `readGitOutput(root, args)`. This centralizes `cwd`, `encoding`, trimming behavior, and error handling, making evidence binding validation easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Rename `readFinalRegressionManifest`
**Finding key:** loop-0edb3c7bc45e9f9fb5aa
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `readFinalRegressionManifest(rawText)` parses and validates the evidence manifest from raw output text, but the name suggests a plain read operation. That hides important behavior and makes call sites less clear.  
**Suggestion:** Rename it to `parseFinalRegressionEvidenceManifest()` or `parseFinalRegressionManifestFromRawOutput()` to reflect that it parses raw output and enforces field invariants.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `readFinalRegressionManifest(rawText)` parses and validates the evidence manifest from raw output text, but the name suggests a plain read operation. That hides important behavior and makes call sites less clear.  
**Suggestion:** Rename it to `parseFinalRegressionEvidenceManifest()` or `parseFinalRegressionManifestFromRawOutput()` to reflect that it parses raw output and enforces field invariants.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Extract stream binding validation
**Finding key:** loop-f7326eec191f7029d35d
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** The stream validation block inside `validateFinalRegressionEvidence()` performs several checks inline for both `stdout` and `stderr`, including existence, byte lengths, truncation, and hash comparison. This makes the main validation flow dense.  
**Suggestion:** Extract a helper such as `validateFinalRegressionStreamBinding(binding, manifest, streamName)`. The main function would then read as two explicit validations while the stream-specific invariant stays in one place.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** The stream validation block inside `validateFinalRegressionEvidence()` performs several checks inline for both `stdout` and `stderr`, including existence, byte lengths, truncation, and hash comparison. This makes the main validation flow dense.  
**Suggestion:** Extract a helper such as `validateFinalRegressionStreamBinding(binding, manifest, streamName)`. The main function would then read as two explicit validations while the stream-specific invariant stays in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 5. Avoid duplicated remaining-risk ownership
**Finding key:** loop-ba72a5b3a7bb403ebe77
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionRecordAndProceed()` requires `recordAndProceed.remainingRisk`, while `validateExplicitFinalRegressionProceed()` also requires `artifact.remainingRisk` and then checks both values match. This duplicates the same concept across two locations in the artifact shape.  
**Suggestion:** Prefer one canonical location for remaining risk. If compatibility requires both fields for now, add a focused helper such as `validateExplicitRemainingRiskBinding(artifact)` so the duplication is intentional and isolated.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionRecordAndProceed()` requires `recordAndProceed.remainingRisk`, while `validateExplicitFinalRegressionProceed()` also requires `artifact.remainingRisk` and then checks both values match. This duplicates the same concept across two locations in the artifact shape.  
**Suggestion:** Prefer one canonical location for remaining risk. If compatibility requires both fields for now, add a focused helper such as `validateExplicitRemainingRiskBinding(artifact)` so the duplication is intentional and isolated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 6. Normalize explicit proceed field validation
**Finding key:** loop-19a058e39ff025aa35b1
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionRecordAndProceed()` checks presence of `failureClassification`, `operatorJustification`, `remainingRisk`, and `executionBinding`, but only validates `operatorJustification` as a non-empty string there. More specific checks are split into `validateExplicitFinalRegressionProceed()`, making the invariant distribution hard to follow.  
**Suggestion:** Move explicit proceed evidence validation into a dedicated helper, for example `validateExplicitRecordAndProceedEvidence(result)`, and call it from both validation paths where appropriate. This keeps explicit override requirements in one design pattern instead of scattered checks.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionRecordAndProceed()` checks presence of `failureClassification`, `operatorJustification`, `remainingRisk`, and `executionBinding`, but only validates `operatorJustification` as a non-empty string there. More specific checks are split into `validateExplicitFinalRegressionProceed()`, making the invariant distribution hard to follow.  
**Suggestion:** Move explicit proceed evidence validation into a dedicated helper, for example `validateExplicitRecordAndProceedEvidence(result)`, and call it from both validation paths where appropriate. This keeps explicit override requirements in one design pattern instead of scattered checks.
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

### 28. 1. Centralize Final Regression Action Name
**Finding key:** loop-1cca6c3d245e01d73b71
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** The action string `"explicit-record-and-proceed"` appears in both production code and tests, with separate proposals suggesting local constants. Defining it independently per file still leaves a cross-file contract duplicated and easy to desynchronize.
**Suggestion:** Export a single production constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, from the final-regression domain module and import it in `tests/unit/flow/final-regression-record-and-proceed.test.js`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** The action string `"explicit-record-and-proceed"` appears in both production code and tests, with separate proposals suggesting local constants. Defining it independently per file still leaves a cross-file contract duplicated and easy to desynchronize.
**Suggestion:** Export a single production constant, for example `EXPLICIT_RECORD_AND_PROCEED_ACTION`, from the final-regression domain module and import it in `tests/unit/flow/final-regression-record-and-proceed.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Unify Final Regression Evidence Bounds
**Finding key:** loop-e6380bf04ba088c2565f
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R4
**Issue:** Multiple files introduce or validate final-regression evidence artifacts with separate bounded-resource concerns: `run-final-regression.js` fingerprints the worktree, `test-artifacts.js` reads raw output, and `review-evidence-store.js` hashes diffs. The limits are proposed independently, which risks inconsistent caps for one evidence pipeline.
**Suggestion:** Define shared named limits for final-regression evidence, raw output, stream output, and worktree fingerprinting in one module, then use those constants across artifact writing, validation, and evidence hashing.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R4
**Issue:** Multiple files introduce or validate final-regression evidence artifacts with separate bounded-resource concerns: `run-final-regression.js` fingerprints the worktree, `test-artifacts.js` reads raw output, and `review-evidence-store.js` hashes diffs. The limits are proposed independently, which risks inconsistent caps for one evidence pipeline.
**Suggestion:** Define shared named limits for final-regression evidence, raw output, stream output, and worktree fingerprinting in one module, then use those constants across artifact writing, validation, and evidence hashing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Align Git Hash Helper Usage Across Evidence Modules
**Finding key:** loop-6c8332ec1429bc84619c
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** Both `run-final-regression.js` and `test-artifacts.js` are accumulating inline SHA/git metadata logic, while `review-evidence-store.js` also performs evidence hashing. This creates duplicate low-level evidence-binding behavior across files.
**Suggestion:** Add shared helpers such as `sha256Hex()`, `readGitHeadSha()`, `readGitTreeSha()`, and bounded hash helpers in a common evidence utility module, then reuse them from final-regression generation, validation, and review evidence storage.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** Both `run-final-regression.js` and `test-artifacts.js` are accumulating inline SHA/git metadata logic, while `review-evidence-store.js` also performs evidence hashing. This creates duplicate low-level evidence-binding behavior across files.
**Suggestion:** Add shared helpers such as `sha256Hex()`, `readGitHeadSha()`, `readGitTreeSha()`, and bounded hash helpers in a common evidence utility module, then reuse them from final-regression generation, validation, and review evidence storage.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Normalize Step Status Update Capability Handling
**Finding key:** loop-61115aa7f2a2cae385ab
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R1
**Issue:** `impl-repair-artifacts.js` now handles both `updateStepStatus` and `updateStepStatuses`, while `set-step.js` owns related step transition behavior. Keeping capability detection local to one artifact module can create interface drift around lifecycle status updates.
**Suggestion:** Move step-status dispatch and authority validation into a shared lifecycle helper used by impl-repair artifact code and step transition code, so batch and single-step update semantics are defined once.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R1
**Issue:** `impl-repair-artifacts.js` now handles both `updateStepStatus` and `updateStepStatuses`, while `set-step.js` owns related step transition behavior. Keeping capability detection local to one artifact module can create interface drift around lifecycle status updates.
**Suggestion:** Move step-status dispatch and authority validation into a shared lifecycle helper used by impl-repair artifact code and step transition code, so batch and single-step update semantics are defined once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 5. Use Consistent Git Tree SHA Fixtures
**Finding key:** loop-1620f4e39ab51e07108a
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`
**Requirement:** R3
**Issue:** New retry-recovery tests use both 40-character and 64-character values for fields named `treeSha`, while production evidence code validates Git metadata elsewhere. This creates a naming/contract inconsistency across tests and evidence modules about whether these fields are Git object SHAs or generic digests.
**Suggestion:** Use 40-character fixtures for Git tree SHA fields consistently, and reserve 64-character fixtures for SHA-256 digest fields with names like `evidenceDigest` or `outputSha256`.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`
**Requirement:** R3
**Issue:** New retry-recovery tests use both 40-character and 64-character values for fields named `treeSha`, while production evidence code validates Git metadata elsewhere. This creates a naming/contract inconsistency across tests and evidence modules about whether these fields are Git object SHAs or generic digests.
**Suggestion:** Use 40-character fixtures for Git tree SHA fields consistently, and reserve 64-character fixtures for SHA-256 digest fields with names like `evidenceDigest` or `outputSha256`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
