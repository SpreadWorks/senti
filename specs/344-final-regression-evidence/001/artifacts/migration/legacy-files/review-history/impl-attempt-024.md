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

### 9. 1. Centralize SHA-256 Computation
**Finding key:** loop-e68d7984fd74c79e39af
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 hashing is repeated inline for stream content and raw output, which makes evidence generation noisier and easier to drift if hashing behavior changes.  
**Suggestion:** Add a small helper such as `sha256Hex(content)` and use it for `evidence.*.sha256` and `rawOutputSha256`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** SHA-256 hashing is repeated inline for stream content and raw output, which makes evidence generation noisier and easier to drift if hashing behavior changes.  
**Suggestion:** Add a small helper such as `sha256Hex(content)` and use it for `evidence.*.sha256` and `rawOutputSha256`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Replace Literal `record-and-proceed`
**Finding key:** loop-805de70e79fbe70a6557
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R4  
**Issue:** The change replaces some `NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED` usages with the literal string `"record-and-proceed"`, creating inconsistent naming and increasing typo risk.  
**Suggestion:** Keep using the existing `NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED` constant unless there is a concrete serialization reason not to. If the constant value is wrong for alpha artifacts, introduce a clearly named constant for the artifact value.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R4  
**Issue:** The change replaces some `NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED` usages with the literal string `"record-and-proceed"`, creating inconsistent naming and increasing typo risk.  
**Suggestion:** Keep using the existing `NEXT_RECOMMENDED_ACTIONS.RECORD_AND_PROCEED` constant unless there is a concrete serialization reason not to. If the constant value is wrong for alpha artifacts, introduce a clearly named constant for the artifact value.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Extract Execution Binding Construction
**Finding key:** loop-8a37c1b613946729a36e
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Execution evidence is assembled across several local blocks: stream capture, manifest lines, raw output hashing, repository fingerprints, test count, and truncation. This makes the main `run` method harder to follow and couples evidence formatting with command execution flow.  
**Suggestion:** Extract helpers such as `buildFinalRegressionExecutionBinding(...)` and `appendExecutionEvidenceLines(...)` so the command path reads as orchestration and the binding logic is isolated.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** Execution evidence is assembled across several local blocks: stream capture, manifest lines, raw output hashing, repository fingerprints, test count, and truncation. This makes the main `run` method harder to follow and couples evidence formatting with command execution flow.  
**Suggestion:** Extract helpers such as `buildFinalRegressionExecutionBinding(...)` and `appendExecutionEvidenceLines(...)` so the command path reads as orchestration and the binding logic is isolated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Simplify Repository Change Detection Naming
**Finding key:** loop-dc184a4a0707bfa41928
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `repositoryChangedDuringRun` is computed only when `resultStatus === "pass"`, but the variable name itself does not communicate that it is pass-gated.  
**Suggestion:** Rename to `passRunRepositoryChanged` or move the `resultStatus === "pass"` guard outside the expression to make the condition easier to read.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `repositoryChangedDuringRun` is computed only when `resultStatus === "pass"`, but the variable name itself does not communicate that it is pass-gated.  
**Suggestion:** Rename to `passRunRepositoryChanged` or move the `resultStatus === "pass"` guard outside the expression to make the condition easier to read.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 5. Bound Git Command Failure Handling
**Finding key:** loop-c099700a1fddc42c4e58
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `gitValue()` directly throws from `execFileSync`. That may be acceptable, but the helper name hides that it can terminate the regression command before artifact creation.  
**Suggestion:** Rename it to something explicit like `requiredGitValue()` or wrap failures with a more specific error message including the git args, so evidence-binding failures are easier to diagnose.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `gitValue()` directly throws from `execFileSync`. That may be acceptable, but the helper name hides that it can terminate the regression command before artifact creation.  
**Suggestion:** Rename it to something explicit like `requiredGitValue()` or wrap failures with a more specific error message including the git args, so evidence-binding failures are easier to diagnose.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Bound raw evidence file reads
**Finding key:** loop-202575b5216c3b6eefe9
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads `rawOutputPath` with `fs.readFileSync(rawPath, "utf8")` before checking size. This allows an arbitrarily large raw output file to be loaded into memory, violating the `bounded-resource-usage` guardrail.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files above the expected maximum, ideally derived from the artifact contract: stdout <= 1 MiB plus stderr <= 1 MiB plus manifest overhead.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `validateFinalRegressionEvidence()` reads `rawOutputPath` with `fs.readFileSync(rawPath, "utf8")` before checking size. This allows an arbitrarily large raw output file to be loaded into memory, violating the `bounded-resource-usage` guardrail.  
**Suggestion:** Check `fs.statSync(rawPath).size` before reading and reject files above the expected maximum, ideally derived from the artifact contract: stdout <= 1 MiB plus stderr <= 1 MiB plus manifest overhead.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Bound untracked file fingerprinting
**Finding key:** loop-7c9925768c3f1e5df2fd
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint()` hashes every untracked regular file with `fs.readFileSync(absolutePath)`. A large or numerous set of untracked files can cause unbounded memory and time usage.  
**Suggestion:** Add explicit limits for untracked file count and per-file byte size, or stream file contents into the hash with a maximum byte budget. Reject evidence validation when the limit is exceeded.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `finalRegressionWorktreeFingerprint()` hashes every untracked regular file with `fs.readFileSync(absolutePath)`. A large or numerous set of untracked files can cause unbounded memory and time usage.  
**Suggestion:** Add explicit limits for untracked file count and per-file byte size, or stream file contents into the hash with a maximum byte budget. Reject evidence validation when the limit is exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Extract repeated execution binding field validation
**Finding key:** loop-9d35aebd729fd0b34024
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateExplicitFinalRegressionProceed()` repeats field iteration for required fields and mismatch checks, and similar binding comparisons also exist in `validateFinalRegressionEvidence()`. This makes future binding requirements easy to update inconsistently.  
**Suggestion:** Introduce a small helper such as `requireMatchingExecutionBindingFields(source, target, fields, label)` and reuse it for `rawOutputSha256`, `headSha`, `treeSha`, and related checks.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateExplicitFinalRegressionProceed()` repeats field iteration for required fields and mismatch checks, and similar binding comparisons also exist in `validateFinalRegressionEvidence()`. This makes future binding requirements easy to update inconsistently.  
**Suggestion:** Introduce a small helper such as `requireMatchingExecutionBindingFields(source, target, fields, label)` and reuse it for `rawOutputSha256`, `headSha`, `treeSha`, and related checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Validate manifest string fields explicitly
**Finding key:** loop-72287e2ed208614fcfaf
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `readFinalRegressionManifest()` validates numeric and boolean fields, but returns string fields like `command`, `result`, `worktreeSha256`, and stream `sha256` without validating presence or format. Later checks catch some cases indirectly, but the manifest parser itself accepts malformed manifests.  
**Suggestion:** Add helpers for required strings and SHA-256 fields, and validate `result` against the accepted values before returning the manifest object. This keeps parsing invariants local to the parser.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `readFinalRegressionManifest()` validates numeric and boolean fields, but returns string fields like `command`, `result`, `worktreeSha256`, and stream `sha256` without validating presence or format. Later checks catch some cases indirectly, but the manifest parser itself accepts malformed manifests.  
**Suggestion:** Add helpers for required strings and SHA-256 fields, and validate `result` against the accepted values before returning the manifest object. This keeps parsing invariants local to the parser.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Extract Repeated SHA Fixtures Into Named Constants
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

### 19. 2. Clarify Or Correct Tree SHA Length In The Newer Review Tree Test
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

### 20. 1. Consolidate Duplicate Cleanup Hooks
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

### 21. 2. Avoid Over-Specific Eligibility Helper
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

### 22. 1. Centralize final regression execution binding schema
**Finding key:** loop-2747ca06ded8910dea4e
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `run-final-regression.js` constructs execution binding fields while `test-artifacts.js` independently validates many of the same fields. This creates a cross-file drift risk whenever binding fields such as `rawOutputSha256`, `headSha`, `treeSha`, or stream hashes change.  
**Suggestion:** Move the execution binding field list and validation/comparison logic into a shared helper in `src/flow/lib/test-artifacts.js` or a dedicated binding module, then have both artifact creation and validation consume the same field definitions.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `run-final-regression.js` constructs execution binding fields while `test-artifacts.js` independently validates many of the same fields. This creates a cross-file drift risk whenever binding fields such as `rawOutputSha256`, `headSha`, `treeSha`, or stream hashes change.  
**Suggestion:** Move the execution binding field list and validation/comparison logic into a shared helper in `src/flow/lib/test-artifacts.js` or a dedicated binding module, then have both artifact creation and validation consume the same field definitions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Standardize SHA length semantics across production and tests
**Finding key:** loop-374f5b86ad26bdccae16
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** Test fixtures mix 40-character and 64-character values for `treeSha`, while production code also handles SHA-256 fields for evidence artifacts. Across files, this makes it unclear whether a field represents a Git object SHA or a SHA-256 digest.  
**Suggestion:** Use explicit fixture names and validators that distinguish Git SHAs from SHA-256 digests, for example `gitTreeSha` for 40-character Git object IDs and `evidenceSha256` for 64-character hashes.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** Test fixtures mix 40-character and 64-character values for `treeSha`, while production code also handles SHA-256 fields for evidence artifacts. Across files, this makes it unclear whether a field represents a Git object SHA or a SHA-256 digest.  
**Suggestion:** Use explicit fixture names and validators that distinguish Git SHAs from SHA-256 digests, for example `gitTreeSha` for 40-character Git object IDs and `evidenceSha256` for 64-character hashes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Share bounded hashing and file-read utilities
**Finding key:** loop-fdfdcf842a463615a411
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** Multiple files introduce evidence hashing or fingerprinting paths that may read large data into memory: `review-evidence-store.js` hashes full git diffs, `run-final-regression.js` hashes output content inline, and `test-artifacts.js` reads raw evidence and untracked files. These are related evidence-generation concerns but have separate resource behavior.  
**Suggestion:** Introduce a shared bounded hashing helper for git output and file contents, with explicit byte limits and clear errors. Reuse it from review evidence capture, final regression output hashing, and evidence validation.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** Multiple files introduce evidence hashing or fingerprinting paths that may read large data into memory: `review-evidence-store.js` hashes full git diffs, `run-final-regression.js` hashes output content inline, and `test-artifacts.js` reads raw evidence and untracked files. These are related evidence-generation concerns but have separate resource behavior.  
**Suggestion:** Introduce a shared bounded hashing helper for git output and file contents, with explicit byte limits and clear errors. Reuse it from review evidence capture, final regression output hashing, and evidence validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Avoid duplicate path construction conventions for test evidence
**Finding key:** loop-8ec6e72bd5ace08d735d
**Failure mode:** refactor
**File:** src/flow/lib/retry-recovery.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/retry-recovery.js`  
**Requirement:** R1  
**Issue:** `retry-recovery.js` constructs `${dir}/tests` independently while `impl-repair-artifacts.js` has separate durable evidence path logic for spec test sources. These files are both encoding workflow artifact path semantics, but the naming and construction are split.  
**Suggestion:** Centralize workflow evidence path constants or helpers, such as `testsEvidencePath(dir)` and durable spec test source matching, so recovery and repair code refer to the same path model.
**Suggestion:** **File:** `src/flow/lib/retry-recovery.js`  
**Requirement:** R1  
**Issue:** `retry-recovery.js` constructs `${dir}/tests` independently while `impl-repair-artifacts.js` has separate durable evidence path logic for spec test sources. These files are both encoding workflow artifact path semantics, but the naming and construction are split.  
**Suggestion:** Centralize workflow evidence path constants or helpers, such as `testsEvidencePath(dir)` and durable spec test source matching, so recovery and repair code refer to the same path model.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
