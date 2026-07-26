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

### 9. 1. Extract Evidence Hashing Helpers
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

### 10. 2. Replace Magic Proceed Action String
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

### 11. 3. Validate Artifact Before Persisting Result JSON
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

### 12. 4. Make Worktree Fingerprint Bounds Explicit
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

### 13. 1. Bound raw evidence reads
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

### 14. 2. Extract repeated git metadata helpers
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

### 15. 3. Rename `readFinalRegressionManifest`
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

### 16. 4. Extract stream binding validation
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

### 17. 5. Avoid duplicated remaining-risk ownership
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

### 18. 6. Normalize explicit proceed field validation
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

### 19. 1. Extract the Explicit Record-And-Proceed Action Name
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

### 20. 2. Add a Focused Assertion for Newly Required Record-And-Proceed Fields
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

### 21. 1. Extract Repeated SHA Fixtures Into Named Constants
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

### 22. 2. Clarify Or Correct Tree SHA Length In The Newer Review Tree Test
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

### 23. 1. Consolidate Duplicate Cleanup Hooks
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

### 24. 2. Avoid Over-Specific Eligibility Helper
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

### 25. 1. Centralize Explicit Record-And-Proceed Action
**Finding key:** loop-228c54e1f0708e81547a
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** The action string `"explicit-record-and-proceed"` is introduced in production code and repeated again in `tests/unit/flow/final-regression-record-and-proceed.test.js`. This creates a cross-file naming/contract drift risk if the action name changes.
**Suggestion:** Export or colocate a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the production module or an existing workflow constants module, then use that constant in both production code and tests.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** The action string `"explicit-record-and-proceed"` is introduced in production code and repeated again in `tests/unit/flow/final-regression-record-and-proceed.test.js`. This creates a cross-file naming/contract drift risk if the action name changes.
**Suggestion:** Export or colocate a named constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION` from the production module or an existing workflow constants module, then use that constant in both production code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Align Final Regression Evidence Hashing Helpers
**Finding key:** loop-61ee26def1c464eb4bb0
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** `run-final-regression.js` computes SHA-256 hashes inline while `src/flow/lib/review-evidence-store.js` also introduces evidence hashing behavior for review evidence. The two files now have parallel hashing responsibilities without a shared helper or visibly consistent resource-bound policy.
**Suggestion:** Introduce a shared evidence hashing helper, for example `sha256Hex()` plus a bounded streaming variant where needed, and use it from both final-regression and review-evidence paths.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** `run-final-regression.js` computes SHA-256 hashes inline while `src/flow/lib/review-evidence-store.js` also introduces evidence hashing behavior for review evidence. The two files now have parallel hashing responsibilities without a shared helper or visibly consistent resource-bound policy.
**Suggestion:** Introduce a shared evidence hashing helper, for example `sha256Hex()` plus a bounded streaming variant where needed, and use it from both final-regression and review-evidence paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Unify Git Metadata Access For Evidence Binding
**Finding key:** loop-5e247412f52b23a89c03
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `test-artifacts.js` performs inline `git` metadata reads for final-regression validation, while `review-evidence-store.js` and `run-final-regression.js` also depend on Git-derived worktree/evidence identity. The same concept is being implemented across files with different call shapes and unclear shared bounds.
**Suggestion:** Add a small shared Git evidence metadata module with helpers like `readGitHeadSha(root)`, `readGitTreeSha(root)`, and bounded fingerprint/hash helpers, then route all evidence-binding code through it.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R2
**Issue:** `test-artifacts.js` performs inline `git` metadata reads for final-regression validation, while `review-evidence-store.js` and `run-final-regression.js` also depend on Git-derived worktree/evidence identity. The same concept is being implemented across files with different call shapes and unclear shared bounds.
**Suggestion:** Add a small shared Git evidence metadata module with helpers like `readGitHeadSha(root)`, `readGitTreeSha(root)`, and bounded fingerprint/hash helpers, then route all evidence-binding code through it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 4. Canonicalize Remaining-Risk Ownership Across Writer And Validator
**Finding key:** loop-275b0a562694803158e4
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R3
**Issue:** `validateFinalRegressionRecordAndProceed()` and `validateExplicitFinalRegressionProceed()` validate duplicated `remainingRisk` fields, while `run-final-regression.js` is responsible for producing the artifact shape. This creates a cross-file interface inconsistency: the writer and validator must preserve duplicated state that represents one concept.
**Suggestion:** Pick one canonical location for `remainingRisk` in the final-regression artifact contract. If both fields must remain temporarily, isolate the compatibility rule in one helper used by validation and make the writer populate it through a single artifact builder.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R3
**Issue:** `validateFinalRegressionRecordAndProceed()` and `validateExplicitFinalRegressionProceed()` validate duplicated `remainingRisk` fields, while `run-final-regression.js` is responsible for producing the artifact shape. This creates a cross-file interface inconsistency: the writer and validator must preserve duplicated state that represents one concept.
**Suggestion:** Pick one canonical location for `remainingRisk` in the final-regression artifact contract. If both fields must remain temporarily, isolate the compatibility rule in one helper used by validation and make the writer populate it through a single artifact builder.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
