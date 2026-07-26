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

### 9. 1. Replace hard-coded explicit proceed action with a named constant
**Finding key:** loop-b69d52259d8dd3cb9179
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a string literal in multiple places, while nearby action names use `NEXT_RECOMMENDED_ACTIONS`. This weakens naming consistency and makes future renames error-prone.  
**Suggestion:** Define a local constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed"` near the action constants and use it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `"explicit-record-and-proceed"` is introduced as a string literal in multiple places, while nearby action names use `NEXT_RECOMMENDED_ACTIONS`. This weakens naming consistency and makes future renames error-prone.  
**Suggestion:** Define a local constant such as `EXPLICIT_RECORD_AND_PROCEED_ACTION = "explicit-record-and-proceed"` near the action constants and use it in `failedRecordedArtifact()` and `recordAndProceed()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Remove or rename the now-misleading `autoApprove` path
**Finding key:** loop-df81610cf1baffa751db
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `FinalRegressionFailureProfile` still appears to accept/use `autoApprove`, but the new behavior forces `selectedAction = null`. That leaves dead or misleading API surface around an approval mode that no longer auto-selects proceed.  
**Suggestion:** Remove the `autoApprove` constructor parameter and update call sites, or rename the remaining concept to something that reflects its current role if it still affects eligibility elsewhere.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `FinalRegressionFailureProfile` still appears to accept/use `autoApprove`, but the new behavior forces `selectedAction = null`. That leaves dead or misleading API surface around an approval mode that no longer auto-selects proceed.  
**Suggestion:** Remove the `autoApprove` constructor parameter and update call sites, or rename the remaining concept to something that reflects its current role if it still affects eligibility elsewhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Extract SHA-256 helpers for evidence hashing
**Finding key:** loop-a5493a96c866e3b76020
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 calculation is repeated inline for stream content and raw output files. The repeated `crypto.createHash("sha256").update(...).digest("hex")` pattern makes evidence code noisier and easier to accidentally vary.  
**Suggestion:** Add small helpers such as `sha256Text(value)` and `sha256Buffer(buffer)`, then use them in `executionManifestLines()` and `executionBinding.rawOutputSha256`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 calculation is repeated inline for stream content and raw output files. The repeated `crypto.createHash("sha256").update(...).digest("hex")` pattern makes evidence code noisier and easier to accidentally vary.  
**Suggestion:** Add small helpers such as `sha256Text(value)` and `sha256Buffer(buffer)`, then use them in `executionManifestLines()` and `executionBinding.rawOutputSha256`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Rename `gitValue` to describe its contract
**Finding key:** loop-f01449ddd5ef71f57409
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `gitValue(root, args)` is very generic, but it specifically runs `git`, expects UTF-8 stdout, trims it, and throws on failure. The name hides that contract at evidence-critical call sites.  
**Suggestion:** Rename it to something like `gitScalar(root, args)` or `readGitOutput(root, args)` so calls for `HEAD` and `write-tree` are clearer.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `gitValue(root, args)` is very generic, but it specifically runs `git`, expects UTF-8 stdout, trims it, and throws on failure. The name hides that contract at evidence-critical call sites.  
**Suggestion:** Rename it to something like `gitScalar(root, args)` or `readGitOutput(root, args)` so calls for `HEAD` and `write-tree` are clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 5. Centralize execution evidence construction
**Finding key:** loop-b2f86aa99ffa678f0ae7
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Evidence data is assembled in several adjacent but separate blocks: stream capture, manifest lines, raw file write, raw hash, and `executionBinding`. This spreads one logical artifact across multiple steps and makes it easier for fields to drift.  
**Suggestion:** Extract a helper such as `buildExecutionEvidence({ root, attemptPath, commandText, resultStatus, result, beforeHeadSha, beforeTreeSha, beforeWorktreeSha256 })` that returns manifest lines plus the binding object after the raw file hash is available.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Evidence data is assembled in several adjacent but separate blocks: stream capture, manifest lines, raw file write, raw hash, and `executionBinding`. This spreads one logical artifact across multiple steps and makes it easier for fields to drift.  
**Suggestion:** Extract a helper such as `buildExecutionEvidence({ root, attemptPath, commandText, resultStatus, result, beforeHeadSha, beforeTreeSha, beforeWorktreeSha256 })` that returns manifest lines plus the binding object after the raw file hash is available.
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

### 23. 1. Centralize Final Regression Evidence Hashing
**Finding key:** loop-7a319bb9e496392d43b4
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** SHA-256 evidence hashing is being introduced in `run-final-regression.js`, while `review-evidence-store.js` also computes evidence identity from Git diff content. These are related evidence-binding concerns, but the hashing logic appears file-local and could drift in algorithm, encoding, or resource limits.
**Suggestion:** Extract a shared evidence hashing helper, for example under `src/flow/lib/evidence-hash.js`, with clear APIs for text, buffer, and bounded stream hashing. Use it from both final regression evidence generation and review evidence storage.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** SHA-256 evidence hashing is being introduced in `run-final-regression.js`, while `review-evidence-store.js` also computes evidence identity from Git diff content. These are related evidence-binding concerns, but the hashing logic appears file-local and could drift in algorithm, encoding, or resource limits.
**Suggestion:** Extract a shared evidence hashing helper, for example under `src/flow/lib/evidence-hash.js`, with clear APIs for text, buffer, and bounded stream hashing. Use it from both final regression evidence generation and review evidence storage.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Align Execution Binding Field Names Across Producer And Validator
**Finding key:** loop-f550e694ffa5262cae8b
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R3
**Issue:** `run-final-regression.js` produces execution binding fields such as `rawOutputSha256`, `headSha`, `treeSha`, and truncation state, while `test-artifacts.js` validates the same fields through separate inline checks. The producer and validator currently share an implicit interface rather than a named contract, which makes future field additions easy to miss on one side.
**Suggestion:** Define a shared execution binding field list or small binding class/helper used by both files, so generation and validation depend on the same canonical field names and invariants.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R3
**Issue:** `run-final-regression.js` produces execution binding fields such as `rawOutputSha256`, `headSha`, `treeSha`, and truncation state, while `test-artifacts.js` validates the same fields through separate inline checks. The producer and validator currently share an implicit interface rather than a named contract, which makes future field additions easy to miss on one side.
**Suggestion:** Define a shared execution binding field list or small binding class/helper used by both files, so generation and validation depend on the same canonical field names and invariants.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Normalize Remaining Risk Location In Explicit Proceed Artifacts
**Finding key:** loop-abc5c1849f8b2924194f
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** `test-artifacts.js` validates remaining risk in both `artifact.remainingRisk` and `result.recordAndProceed.remainingRisk`, implying duplicate sources for one concept. The corresponding producer in `run-final-regression.js` should not emit a data shape where the same semantic value must be kept in sync across two locations.
**Suggestion:** Pick one canonical location for remaining risk in explicit proceed artifacts, then update both the artifact construction in `run-final-regression.js` and validation in `test-artifacts.js` to enforce that single source.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** `test-artifacts.js` validates remaining risk in both `artifact.remainingRisk` and `result.recordAndProceed.remainingRisk`, implying duplicate sources for one concept. The corresponding producer in `run-final-regression.js` should not emit a data shape where the same semantic value must be kept in sync across two locations.
**Suggestion:** Pick one canonical location for remaining risk in explicit proceed artifacts, then update both the artifact construction in `run-final-regression.js` and validation in `test-artifacts.js` to enforce that single source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Reuse Test Evidence Path Construction
**Finding key:** loop-9f119e8931c0cba205fe
**Failure mode:** refactor
**File:** src/flow/lib/retry-recovery.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/retry-recovery.js`
**Requirement:** R1
**Issue:** `retry-recovery.js` introduces repeated `${dir}/tests` construction, while adjacent test fixture code in `tests/unit/flow/retry-recovery-file-map.test.js` is also accumulating duplicated recovery eligibility setup. These duplicate introductions point to missing shared naming around retry recovery evidence paths.
**Suggestion:** Introduce a small helper for recovery evidence paths, such as `recoveryTestsPath(dir)`, and use it in production code and tests where applicable. This keeps path naming consistent and reduces fixture drift.
**Suggestion:** **File:** `src/flow/lib/retry-recovery.js`
**Requirement:** R1
**Issue:** `retry-recovery.js` introduces repeated `${dir}/tests` construction, while adjacent test fixture code in `tests/unit/flow/retry-recovery-file-map.test.js` is also accumulating duplicated recovery eligibility setup. These duplicate introductions point to missing shared naming around retry recovery evidence paths.
**Suggestion:** Introduce a small helper for recovery evidence paths, such as `recoveryTestsPath(dir)`, and use it in production code and tests where applicable. This keeps path naming consistent and reduces fixture drift.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
