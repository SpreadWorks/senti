# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Align Test Requirement Labels With Spec Requirements
**Finding key:** loop-1d72ebb11fecde681976
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R3
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The updated test names still use `R8`/`R9`, but the related requirements for this file identify the migrated verdict/evidence behavior as `R3` and final regression strength as `R9`. The `R8` label is inconsistent with the provided requirement mapping.  
**Suggestion:** Rename the first updated test from `R8: production context...` to `R3: production context...` so the test title matches the spec requirement it validates.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The updated test names still use `R8`/`R9`, but the related requirements for this file identify the migrated verdict/evidence behavior as `R3` and final regression strength as `R9`. The `R8` label is inconsistent with the provided requirement mapping.  
**Suggestion:** Rename the first updated test from `R8: production context...` to `R3: production context...` so the test title matches the spec requirement it validates.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Remove Duplicate Source-Finding Construction
**Finding key:** loop-d863f104496f676a2bc4
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R4
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The test constructs deferred finding source metadata once in `deferredFindings` and reconstructs the same `sourceArtifact` / `sourceFindingId` logic again in the expected assertion. This duplicates indexing rules and makes future changes more error-prone.  
**Suggestion:** Extract a small local helper such as `deferredFindingSource(index)` or precompute `deferredFindings` once, then derive both fixture input and expected assertions from that shared value.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The test constructs deferred finding source metadata once in `deferredFindings` and reconstructs the same `sourceArtifact` / `sourceFindingId` logic again in the expected assertion. This duplicates indexing rules and makes future changes more error-prone.  
**Suggestion:** Extract a small local helper such as `deferredFindingSource(index)` or precompute `deferredFindings` once, then derive both fixture input and expected assertions from that shared value.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Align Deferred Flow Test Labels With Related Requirement
**Finding key:** loop-e07d64763420ca4a126e
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R4
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The updated tests are still named `R5: ...`, while the provided related requirement for deferred final dispositions and unresolved-risk verdict behavior is `R4`. This makes the test-to-requirement mapping harder to audit.  
**Suggestion:** Rename the affected test descriptions from `R5: ...` to `R4: ...` where they validate deferred final dispositions, evidence binding, or unresolved-risk verdict behavior.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The updated tests are still named `R5: ...`, while the provided related requirement for deferred final dispositions and unresolved-risk verdict behavior is `R4`. This makes the test-to-requirement mapping harder to audit.  
**Suggestion:** Rename the affected test descriptions from `R5: ...` to `R4: ...` where they validate deferred final dispositions, evidence binding, or unresolved-risk verdict behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Extract acceptance fixture runner in spec 295 test
**Finding key:** loop-7e900ee7bd0f9fc0ceb6
**Failure mode:** refactor
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R5
**Issue:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The new acceptance fixture call repeats low-level fixture plumbing inline, making the R6 test harder to scan. The assertions are about deferred finding aggregation, not about constructing the runner argument object.  
**Suggestion:** Add a small local helper or inline closure such as `runAcceptanceReview(disposition)` that wraps `runAcceptanceReviewFixture` with `acceptanceFixture` fields and returns the artifact.
**Suggestion:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The new acceptance fixture call repeats low-level fixture plumbing inline, making the R6 test harder to scan. The assertions are about deferred finding aggregation, not about constructing the runner argument object.  
**Suggestion:** Add a small local helper or inline closure such as `runAcceptanceReview(disposition)` that wraps `runAcceptanceReviewFixture` with `acceptanceFixture` fields and returns the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Extract repeated acceptance fixture run arguments
**Finding key:** loop-311e7ef16d685a1791ff
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** The same `runAcceptanceReviewFixture` argument set is repeated several times with only `deferredFindingDispositions`, `persist`, `apply`, or `flowManager` changing. This makes the test longer and increases maintenance cost if fixture inputs change.  
**Suggestion:** Add a small local helper inside each relevant test, for example `runAcceptance(disposition, overrides = {})`, that fills `root`, `state`, `diff`, and `requirementJudgments` from `acceptanceFixture`.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** The same `runAcceptanceReviewFixture` argument set is repeated several times with only `deferredFindingDispositions`, `persist`, `apply`, or `flowManager` changing. This makes the test longer and increases maintenance cost if fixture inputs change.  
**Suggestion:** Add a small local helper inside each relevant test, for example `runAcceptance(disposition, overrides = {})`, that fills `root`, `state`, `diff`, and `requirementJudgments` from `acceptanceFixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Use a named helper for adopting and cleaning acceptance fixtures
**Finding key:** loop-4ec7ef60d53348028bce
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The `adoptAcceptanceReviewFixture` + `try/finally cleanup` pattern appears multiple times in this file. The cleanup is correct, but the repeated ceremony obscures the assertions that the regression is actually trying to verify.  
**Suggestion:** Introduce a file-local helper such as `withAdoptedAcceptanceFixture(producerFixture, fn)` that handles adoption and cleanup, then calls the test body with the fixture.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The `adoptAcceptanceReviewFixture` + `try/finally cleanup` pattern appears multiple times in this file. The cleanup is correct, but the repeated ceremony obscures the assertions that the regression is actually trying to verify.  
**Suggestion:** Introduce a file-local helper such as `withAdoptedAcceptanceFixture(producerFixture, fn)` that handles adoption and cleanup, then calls the test body with the fixture.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Rename `entry` to clarify its role
**Finding key:** loop-3060eff5aa527038452c
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** `entry` is too generic for a test that contains several artifacts and fixture objects. It represents the generated deferred flow finding, which is important to the assertions.  
**Suggestion:** Rename it to `deferredFindingEntry` or `flowFindingEntry` in both tests where it is destructured from `readFlowFindingsArtifact(...).entries`.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** `entry` is too generic for a test that contains several artifacts and fixture objects. It represents the generated deferred flow finding, which is important to the assertions.  
**Suggestion:** Rename it to `deferredFindingEntry` or `flowFindingEntry` in both tests where it is destructured from `readFlowFindingsArtifact(...).entries`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Derive fixture spec directory from fixture state
**Finding key:** loop-38459c9c5ad6ea128ed3
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R7
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** The test constructs `fixtureSpecDir` as ``specs/${fixture.specId}``, duplicating path knowledge already present in the fixture via `fixture.specPath`. If fixture path layout changes, this assertion path can drift independently.  
**Suggestion:** Use `path.dirname(fixture.specPath)` for durable pathspec assertions, or expose a fixture property for the relative spec directory if the helper already has that concept.
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** The test constructs `fixtureSpecDir` as ``specs/${fixture.specId}``, duplicating path knowledge already present in the fixture via `fixture.specPath`. If fixture path layout changes, this assertion path can drift independently.  
**Suggestion:** Use `path.dirname(fixture.specPath)` for durable pathspec assertions, or expose a fixture property for the relative spec directory if the helper already has that concept.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Remove unused deferred finding entry
**Finding key:** loop-3f806a5eff8fd709e08c
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** The second R8 test declares `const [entry] = readFlowFindingsArtifact(...).toJSON().entries;` but never uses `entry`. This is dead code and makes the test look like it verifies source identity when it does not.  
**Suggestion:** Remove the unused `entry` declaration, or add an assertion using it if source identity is intended to be covered there.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** The second R8 test declares `const [entry] = readFlowFindingsArtifact(...).toJSON().entries;` but never uses `entry`. This is dead code and makes the test look like it verifies source identity when it does not.  
**Suggestion:** Remove the unused `entry` declaration, or add an assertion using it if source identity is intended to be covered there.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Extract repeated deferred acceptance fixture setup
**Finding key:** loop-5d2de8f8634951a216c8
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** Both R8 tests repeat the same setup sequence: `prepareSpecRoot()`, `runFinalSemanticFail(...)`, `readFlowFindingsArtifact(...)`, and `adoptAcceptanceReviewFixture(...)`, followed by `try/finally cleanup`.  
**Suggestion:** Extract a small helper such as `prepareAcceptanceFixtureWithDeferredFinding(findingId)` that returns `{ acceptanceFixture, entry }`. This would reduce duplication and make each test focus on the behavior under assertion.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** Both R8 tests repeat the same setup sequence: `prepareSpecRoot()`, `runFinalSemanticFail(...)`, `readFlowFindingsArtifact(...)`, and `adoptAcceptanceReviewFixture(...)`, followed by `try/finally cleanup`.  
**Suggestion:** Extract a small helper such as `prepareAcceptanceFixtureWithDeferredFinding(findingId)` that returns `{ acceptanceFixture, entry }`. This would reduce duplication and make each test focus on the behavior under assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Bound recursive source-file traversal in the migration test
**Finding key:** loop-cc73061ad55a55eee5aa
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` with no explicit depth or file-count bound. Even in tests, this is unbounded recursive bulk loading under the `bounded-resource-usage` guardrail.  
**Suggestion:** Add explicit limits, for example `maxDepth` and `maxFiles`, and fail the test if traversal exceeds them.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` with no explicit depth or file-count bound. Even in tests, this is unbounded recursive bulk loading under the `bounded-resource-usage` guardrail.  
**Suggestion:** Add explicit limits, for example `maxDepth` and `maxFiles`, and fail the test if traversal exceeds them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Remove unused names from `runtimeRepairTestFiles`
**Finding key:** loop-5b20dcdbdfa5acac0aa9
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R10
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** `runtimeRepairTestFiles` is a `Map`, but only `.values()` are used. The descriptive keys are dead data and make the structure look more meaningful than it is.  
**Suggestion:** Replace it with a plain array of file paths, or use the keys in assertion messages if the labels are intended to aid diagnostics.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** `runtimeRepairTestFiles` is a `Map`, but only `.values()` are used. The descriptive keys are dead data and make the structure look more meaningful than it is.  
**Suggestion:** Replace it with a plain array of file paths, or use the keys in assertion messages if the labels are intended to aid diagnostics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Deduplicate fixture context construction
**Finding key:** loop-333cc21ba95bcdf897c1
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** Many tests repeat the same `acceptance.buildAcceptanceReviewContext({ root: fixture.root, state: fixture.state, diff: fixture.diff })` block.  
**Suggestion:** Add a small helper such as `buildFixtureAcceptanceContext(fixture)` to reduce duplication and make future context input changes one-line.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** Many tests repeat the same `acceptance.buildAcceptanceReviewContext({ root: fixture.root, state: fixture.state, diff: fixture.diff })` block.  
**Suggestion:** Add a small helper such as `buildFixtureAcceptanceContext(fixture)` to reduce duplication and make future context input changes one-line.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Add a recursion bound or visited set for evidence freshness checks
**Finding key:** loop-1cfab385245775e706cd
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively follows `associatedPrimaryEvidencePath()` without an explicit depth limit or visited set. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or self-reference, this can recurse unboundedly, violating `bounded-resource-usage`.  
**Suggestion:** Pass a `seen` `Set` or depth counter through `isFreshMigrationArtifact()` and return `false` or throw on repeated paths / excessive depth.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively follows `associatedPrimaryEvidencePath()` without an explicit depth limit or visited set. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or self-reference, this can recurse unboundedly, violating `bounded-resource-usage`.  
**Suggestion:** Pass a `seen` `Set` or depth counter through `isFreshMigrationArtifact()` and return `false` or throw on repeated paths / excessive depth.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 5. Use the delta writer return value for ledger references
**Finding key:** loop-3da03b3a6847bdda9236
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `RepairMigrationEvidenceReplacement.replace()` hardcodes `changedPathsRef: \`${REPAIR_DELTA_DIR}/${id}.json\`` while also calling `writeRepairDelta(this.specDir, delta)`. If `writeRepairDelta()` owns path construction, this duplicates path knowledge.  
**Suggestion:** Capture the returned ref from `writeRepairDelta()` and pass that into `ImplRepairEntry.changedPathsRef`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `RepairMigrationEvidenceReplacement.replace()` hardcodes `changedPathsRef: \`${REPAIR_DELTA_DIR}/${id}.json\`` while also calling `writeRepairDelta(this.specDir, delta)`. If `writeRepairDelta()` owns path construction, this duplicates path knowledge.  
**Suggestion:** Capture the returned ref from `writeRepairDelta()` and pass that into `ImplRepairEntry.changedPathsRef`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 6. Remove or use `MigrationEvidenceInspection.failure`
**Finding key:** loop-70e21bd3011c64d1b0f1
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection` stores `failure`, but callers only read `.current`; the failure value is currently dead state after the warning is emitted.  
**Suggestion:** Either remove the `failure` property and keep the class focused on the boolean result, or return the inspection object to callers that can include `failure` in diagnostics.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection` stores `failure`, but callers only read `.current`; the failure value is currently dead state after the warning is emitted.  
**Suggestion:** Either remove the `failure` property and keep the class focused on the boolean result, or return the inspection object to callers that can include `failure` in diagnostics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Clarify stage-set naming
**Finding key:** loop-8cb89ab3a438f28a7681
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** `SPEC_CORRECTION_SUPPORTED_STAGES` is defined as `"implement"` plus `PLAN_REWIND_SUPPORTED_STAGES`, but the name does not make that relationship explicit.  
**Suggestion:** Rename to something more precise, such as `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, if this constant is specifically for rewind eligibility during spec correction.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** `SPEC_CORRECTION_SUPPORTED_STAGES` is defined as `"implement"` plus `PLAN_REWIND_SUPPORTED_STAGES`, but the name does not make that relationship explicit.  
**Suggestion:** Rename to something more precise, such as `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, if this constant is specifically for rewind eligibility during spec correction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Validate resolver type before invocation
**Finding key:** loop-298470167a26b360cad6
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** `resolveNextTreeSha` defaults to `null`, but any non-null value is invoked as a function. A malformed caller input would fail with a less clear `TypeError`.  
**Suggestion:** Check `typeof resolveNextTreeSha === "function"` before calling it, or require callers to pass only `nextTreeSha` and move resolution outside this factory.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** `resolveNextTreeSha` defaults to `null`, but any non-null value is invoked as a function. A malformed caller input would fail with a less clear `TypeError`.  
**Suggestion:** Check `typeof resolveNextTreeSha === "function"` before calling it, or require callers to pass only `nextTreeSha` and move resolution outside this factory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Extract exhausted-attempt predicate
**Finding key:** loop-5966bbdb7f8e2116710e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** The `forExhaustedAttempt` guard embeds a multi-condition tooling exhaustion check directly in the factory, making the intent harder to scan and likely to be duplicated if reused.  
**Suggestion:** Extract a small helper such as `isToolingAttemptExhausted(reviewRecord)` and use it in the guard.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** The `forExhaustedAttempt` guard embeds a multi-condition tooling exhaustion check directly in the factory, making the intent harder to scan and likely to be duplicated if reused.  
**Suggestion:** Extract a small helper such as `isToolingAttemptExhausted(reviewRecord)` and use it in the guard.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Bound diff materialization before hashing
**Finding key:** loop-3c5c491850368436f363
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `resolveCurrentReviewTreeSha()` runs `git diff --binary HEAD` and consumes the full diff in `diff.stdout` with no explicit size bound. Large binary patches can make review evidence resolution unbounded in memory/time, violating `bounded-resource-usage`.  
**Suggestion:** Use a bounded hashing path instead of materializing the entire diff string, or enforce a maximum diff byte size before hashing and fail with a clear `REVIEW_TARGET_TREE_UNAVAILABLE` error when exceeded.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `resolveCurrentReviewTreeSha()` runs `git diff --binary HEAD` and consumes the full diff in `diff.stdout` with no explicit size bound. Large binary patches can make review evidence resolution unbounded in memory/time, violating `bounded-resource-usage`.  
**Suggestion:** Use a bounded hashing path instead of materializing the entire diff string, or enforce a maximum diff byte size before hashing and fail with a clear `REVIEW_TARGET_TREE_UNAVAILABLE` error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Extract review target fingerprint construction
**Finding key:** loop-8be2102f4fb1e4fe3de1
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R3  
**Issue:** The tree-plus-diff hash construction is embedded directly in `resolveCurrentReviewTreeSha()`, mixing git resolution, dirty-worktree detection, and fingerprint formatting in one function. The function name also still says `TreeSha`, but it can now return a synthetic hash that is not a Git tree SHA.  
**Suggestion:** Extract a helper such as `buildReviewTargetFingerprint(treeSha, diffText)` and consider renaming the exported function to `resolveCurrentReviewTargetFingerprint()` if callers treat this as an evidence identity rather than a literal tree SHA.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R3  
**Issue:** The tree-plus-diff hash construction is embedded directly in `resolveCurrentReviewTreeSha()`, mixing git resolution, dirty-worktree detection, and fingerprint formatting in one function. The function name also still says `TreeSha`, but it can now return a synthetic hash that is not a Git tree SHA.  
**Suggestion:** Extract a helper such as `buildReviewTargetFingerprint(treeSha, diffText)` and consider renaming the exported function to `resolveCurrentReviewTargetFingerprint()` if callers treat this as an evidence identity rather than a literal tree SHA.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Rename latest artifact variables for clarity
**Finding key:** loop-50db1ebb5e870add799b
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `latestArtifact` stores the raw JSON object, while `reviewedArtifacts` stores `{ artifact, raw }`. This makes the loop harder to reason about because “artifact” sometimes means parsed `ReviewFindingGateArtifact` and sometimes raw artifact data.  
**Suggestion:** Rename `latestArtifact` to `latestRawArtifact`, and consider `reviewedArtifacts` entries like `{ gateArtifact, rawArtifact }` to keep parsed vs raw representations explicit.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `latestArtifact` stores the raw JSON object, while `reviewedArtifacts` stores `{ artifact, raw }`. This makes the loop harder to reason about because “artifact” sometimes means parsed `ReviewFindingGateArtifact` and sometimes raw artifact data.  
**Suggestion:** Rename `latestArtifact` to `latestRawArtifact`, and consider `reviewedArtifacts` entries like `{ gateArtifact, rawArtifact }` to keep parsed vs raw representations explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 4. Bound authoritative specification prompt size
**Finding key:** loop-343e3b20bdfd6184abf0
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `targetText` now appends the full `specJsonToPromptText(...)` output to the review prompt without an explicit size bound. If `spec.json` grows large, gate review prompt construction can become unbounded and may exceed model/context limits.  
**Suggestion:** Reuse an existing prompt-size limiting helper if available in this file, or add an explicit maximum character budget for the authoritative specification section with a deterministic truncation/error strategy.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `targetText` now appends the full `specJsonToPromptText(...)` output to the review prompt without an explicit size bound. If `spec.json` grows large, gate review prompt construction can become unbounded and may exceed model/context limits.  
**Suggestion:** Reuse an existing prompt-size limiting helper if available in this file, or add an explicit maximum character budget for the authoritative specification section with a deterministic truncation/error strategy.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Preserve a specific unsupported-stage message
**Finding key:** loop-16898e023e6d7f3758f6
**Failure mode:** refactor
**File:** src/flow/lib/run-reopen-draft.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R1  
**Issue:** The new error message says “supported implementation stage” but does not identify which stages are supported, making the failure less actionable than it could be.  
**Suggestion:** Include the supported stage ids from `SPEC_CORRECTION_SUPPORTED_STAGES` in the message, for example: `spec-correction reopen is only available from: ${SPEC_CORRECTION_SUPPORTED_STAGES.join(", ")}`.
**Suggestion:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R1  
**Issue:** The new error message says “supported implementation stage” but does not identify which stages are supported, making the failure less actionable than it could be.  
**Suggestion:** Include the supported stage ids from `SPEC_CORRECTION_SUPPORTED_STAGES` in the message, for example: `spec-correction reopen is only available from: ${SPEC_CORRECTION_SUPPORTED_STAGES.join(", ")}`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Name the category check by intent
**Finding key:** loop-aa1858dfed76fddec74f
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R1  
**Issue:** `shouldValidateScenarioValidityPreflight(state)` hides the actual exception case. The caller has to infer that scenario preflight is skipped only after a spec-correction rewind.  
**Suggestion:** Rename it to something more explicit, such as `isSpecCorrectionRewind(state)` or `shouldSkipScenarioValidityPreflight(state)`, then invert or use it directly at the call site for clearer intent.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R1  
**Issue:** `shouldValidateScenarioValidityPreflight(state)` hides the actual exception case. The caller has to infer that scenario preflight is skipped only after a spec-correction rewind.  
**Suggestion:** Rename it to something more explicit, such as `isSpecCorrectionRewind(state)` or `shouldSkipScenarioValidityPreflight(state)`, then invert or use it directly at the call site for clearer intent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Avoid repeating the `"spec-correction"` string literal
**Finding key:** loop-4c45652101dde624cb96
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R1  
**Issue:** The new helper compares against the raw category string `"spec-correction"`. If this category is already used elsewhere, repeating the literal makes future renames error-prone.  
**Suggestion:** Reuse an existing constant if one exists in the flow modules, or introduce a local constant in this file such as `const SPEC_CORRECTION_REWIND_CATEGORY = "spec-correction";` and compare against that.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R1  
**Issue:** The new helper compares against the raw category string `"spec-correction"`. If this category is already used elsewhere, repeating the literal makes future renames error-prone.  
**Suggestion:** Reuse an existing constant if one exists in the flow modules, or introduce a local constant in this file such as `const SPEC_CORRECTION_REWIND_CATEGORY = "spec-correction";` and compare against that.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Extract repeated fixture evidence builders
**Finding key:** loop-0dd06a0e2405037bd776
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Test file content, raw output lines, `node --test ${this.testFile}`, and per-requirement evidence objects are assembled repeatedly in `#createFixtureRepository()` and `#writeMechanicalEvidence()`.  
**Suggestion:** Add small helpers such as `#testCommand()`, `#fixtureTestContent()`, `#rawRequirementLines(suffix)`, and `#requirementEvidence(id, index)`. This keeps fixture artifacts mechanically consistent and reduces drift risk.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Test file content, raw output lines, `node --test ${this.testFile}`, and per-requirement evidence objects are assembled repeatedly in `#createFixtureRepository()` and `#writeMechanicalEvidence()`.  
**Suggestion:** Add small helpers such as `#testCommand()`, `#fixtureTestContent()`, `#rawRequirementLines(suffix)`, and `#requirementEvidence(id, index)`. This keeps fixture artifacts mechanically consistent and reduces drift risk.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Avoid repeated requirement lookup
**Finding key:** loop-0f4713c1cf7b9c158000
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#createFixtureRepository()` calls `existingSpec.requirements?.find(...)` three times per requirement when writing `desc`, `priority`, and `status`.  
**Suggestion:** Build a `Map` once, for example `const existingRequirements = new Map(...);`, then read `const existingRequirement = existingRequirements.get(id)` inside the mapper.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#createFixtureRepository()` calls `existingSpec.requirements?.find(...)` three times per requirement when writing `desc`, `priority`, and `status`.  
**Suggestion:** Build a `Map` once, for example `const existingRequirements = new Map(...);`, then read `const existingRequirement = existingRequirements.get(id)` inside the mapper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Remove dead `rawEndLine` check
**Finding key:** loop-54db7b81e8d4eeabe4d8
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `const rawEndLine = Math.max(1, this.requirementIds.length);` is always at least `1`, so `if (rawEndLine < 1)` is unreachable dead code.  
**Suggestion:** Remove `rawEndLine` and the final check, or replace it with a real invariant check on `this.requirementIds.length` if empty requirements are invalid for this fixture.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `const rawEndLine = Math.max(1, this.requirementIds.length);` is always at least `1`, so `if (rawEndLine < 1)` is unreachable dead code.  
**Suggestion:** Remove `rawEndLine` and the final check, or replace it with a real invariant check on `this.requirementIds.length` if empty requirements are invalid for this fixture.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Bound recursive test discovery
**Finding key:** loop-f21395620c8ade123d26
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#existingTestFile()` uses recursive directory loading without an explicit depth, count, or size bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Replace `fs.readdirSync(..., { recursive: true })` with a bounded traversal, or stop after finding the first matching `.test.js` / `.test.mjs` file with a documented maximum entry count.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#existingTestFile()` uses recursive directory loading without an explicit depth, count, or size bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Replace `fs.readdirSync(..., { recursive: true })` with a bounded traversal, or stop after finding the first matching `.test.js` / `.test.mjs` file with a documented maximum entry count.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 5. Name `omitArtifacts` by behavior
**Finding key:** loop-ea098398df73c0bb3028
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `omitArtifacts` is a list of artifact file names that suppress fixture writes, but the name does not make clear that existing artifacts are still preserved and only missing writes are skipped.  
**Suggestion:** Rename to something more explicit, such as `skipArtifactWrites`, and keep a local compatibility alias only if existing tests already depend on the current option name.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `omitArtifacts` is a list of artifact file names that suppress fixture writes, but the name does not make clear that existing artifacts are still preserved and only missing writes are skipped.  
**Suggestion:** Rename to something more explicit, such as `skipArtifactWrites`, and keep a local compatibility alias only if existing tests already depend on the current option name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 6. Extract repeated readiness evaluation setup
**Finding key:** loop-5788600542a08975070b
**Failure mode:** refactor
**File:** tests/unit/flow/finding-gate-readiness.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R9  
**Issue:** The new test repeats the same `evaluateReviewFindingGateReadiness({ root, state, phase, issueLog })` object twice.  
**Suggestion:** Add a local helper or closure inside the test, e.g. `const evaluate = () => evaluateReviewFindingGateReadiness(...)`, so the assertion target stays focused on the fingerprint behavior being tested.
**Suggestion:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R9  
**Issue:** The new test repeats the same `evaluateReviewFindingGateReadiness({ root, state, phase, issueLog })` object twice.  
**Suggestion:** Add a local helper or closure inside the test, e.g. `const evaluate = () => evaluateReviewFindingGateReadiness(...)`, so the assertion target stays focused on the fingerprint behavior being tested.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Ensure per-stage temp directory cleanup is exception-safe
**Finding key:** loop-5f7a9261d41204f1ff93
**Failure mode:** refactor
**File:** tests/unit/flow/reopen-draft-spec-correction.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R9  
**Issue:** The new loop manually calls `removeTmpDir(tmp)` at the end of each iteration. If an assertion fails before cleanup, that iteration leaves `tmp` assigned and cleanup depends on outer test hooks rather than the local loop body.  
**Suggestion:** Wrap each iteration body in `try/finally` and move `removeTmpDir(tmp); tmp = null;` into the `finally` block.
**Suggestion:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R9  
**Issue:** The new loop manually calls `removeTmpDir(tmp)` at the end of each iteration. If an assertion fails before cleanup, that iteration leaves `tmp` assigned and cleanup depends on outer test hooks rather than the local loop body.  
**Suggestion:** Wrap each iteration body in `try/finally` and move `removeTmpDir(tmp); tmp = null;` into the `finally` block.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Extract repeated repair evidence paths
**Finding key:** loop-905124c7a4818af5ee56
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R9  
**Issue:** Paths like `specs/demo/test-execute-result.json`, `specs/demo/tests/.raw/test-execution.log`, and `specs/demo/repair-fingerprint.json` are repeated across the new helper and several tests. This makes future fixture layout changes error-prone.  
**Suggestion:** Define small local constants or helper functions inside the `describe` block, for example `testExecuteResultPath()`, `rawExecutionLogPath()`, and `repairFingerprintPath()`, then reuse them in reads, writes, and removals.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R9  
**Issue:** Paths like `specs/demo/test-execute-result.json`, `specs/demo/tests/.raw/test-execution.log`, and `specs/demo/repair-fingerprint.json` are repeated across the new helper and several tests. This makes future fixture layout changes error-prone.  
**Suggestion:** Define small local constants or helper functions inside the `describe` block, for example `testExecuteResultPath()`, `rawExecutionLogPath()`, and `repairFingerprintPath()`, then reuse them in reads, writes, and removals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 3. Rename migration helper to describe its side effects
**Finding key:** loop-b2405a4040d3f549ca3e
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R9  
**Issue:** `migrateBaselineBearingLegacyV2()` sounds like a pure fixture setup helper, but it initializes a repo, writes legacy artifacts, executes `RunGateCommand`, mutates flow state, and returns the command result.  
**Suggestion:** Rename it to something more explicit such as `runLegacyV2BaselineMigration()` or `executeLegacyV2BaselineRecovery()` so call sites communicate that the migration/recovery has already happened.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R9  
**Issue:** `migrateBaselineBearingLegacyV2()` sounds like a pure fixture setup helper, but it initializes a repo, writes legacy artifacts, executes `RunGateCommand`, mutates flow state, and returns the command result.  
**Suggestion:** Rename it to something more explicit such as `runLegacyV2BaselineMigration()` or `executeLegacyV2BaselineRecovery()` so call sites communicate that the migration/recovery has already happened.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 4. Factor repeated post-migration state setup
**Finding key:** loop-dea348d1cfbf3ccf5c8d
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat:

```js
state.steps[0].status = "done";
state.steps[1].status = "in_progress";
```

This couples tests to positional step indexes and duplicates the same setup intent.  
**Suggestion:** Add a small helper such as `markTestExecutionCompleted(state)` that sets the intended statuses by step id or encapsulates the positional writes in one place.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat:

```js
state.steps[0].status = "done";
state.steps[1].status = "in_progress";
```

This couples tests to positional step indexes and duplicates the same setup intent.  
**Suggestion:** Add a small helper such as `markTestExecutionCompleted(state)` that sets the intended statuses by step id or encapsulates the positional writes in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Add Timeouts To Synchronous Git Calls
**Finding key:** loop-31af8bf9a0152e08ca16
**Failure mode:** refactor
**File:** tests/unit/flow/review-evidence-tree.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/review-evidence-tree.test.js`  
**Requirement:** R1  
**Issue:** The local `git(...args)` helper calls `execFileSync` without a timeout. If Git blocks unexpectedly, the test can hang without an explicit upper bound, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Pass a small `timeout` option to `execFileSync`, for example `{ cwd: tmp, encoding: "utf8", timeout: 5000 }`.
**Suggestion:** **File:** `tests/unit/flow/review-evidence-tree.test.js`  
**Requirement:** R1  
**Issue:** The local `git(...args)` helper calls `execFileSync` without a timeout. If Git blocks unexpectedly, the test can hang without an explicit upper bound, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Pass a small `timeout` option to `execFileSync`, for example `{ cwd: tmp, encoding: "utf8", timeout: 5000 }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Extract Fixture Setup For Readability
**Finding key:** loop-4e3d6d861de77ec3c2e1
**Failure mode:** refactor
**File:** tests/unit/flow/run-scenario-validity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/run-scenario-validity.test.js`  
**Requirement:** R1  
**Issue:** The test body mixes fixture creation, Git setup, command construction, failure assertion, and success assertion in one long flow. This makes the actual behavior under test harder to scan.  
**Suggestion:** Extract narrowly scoped helpers inside the file, such as `writeSpecFixture(root, specDir, spec)` and `createContext(root, spec, planRewinds)`, keeping the assertions in the test body.
**Suggestion:** **File:** `tests/unit/flow/run-scenario-validity.test.js`  
**Requirement:** R1  
**Issue:** The test body mixes fixture creation, Git setup, command construction, failure assertion, and success assertion in one long flow. This makes the actual behavior under test harder to scan.  
**Suggestion:** Extract narrowly scoped helpers inside the file, such as `writeSpecFixture(root, specDir, spec)` and `createContext(root, spec, planRewinds)`, keeping the assertions in the test body.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Centralize acceptance fixture runner/adoption helpers
**Finding key:** loop-20afe27d108a4114f1a5
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Multiple spec tests independently repeat the same `runAcceptanceReviewFixture` argument plumbing and `adoptAcceptanceReviewFixture` + `try/finally cleanup` lifecycle. This duplication appears in specs 295, 296, and 310, so local helpers in each file would still leave cross-file drift.  
**Suggestion:** Add shared helper APIs in `tests/helpers/acceptance-review-fixture.js`, such as `runAcceptanceReviewForFixture(fixture, overrides)` and `withAdoptedAcceptanceReviewFixture(producerFixture, fn)`, then update the affected tests to use them.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Multiple spec tests independently repeat the same `runAcceptanceReviewFixture` argument plumbing and `adoptAcceptanceReviewFixture` + `try/finally cleanup` lifecycle. This duplication appears in specs 295, 296, and 310, so local helpers in each file would still leave cross-file drift.  
**Suggestion:** Add shared helper APIs in `tests/helpers/acceptance-review-fixture.js`, such as `runAcceptanceReviewForFixture(fixture, overrides)` and `withAdoptedAcceptanceReviewFixture(producerFixture, fn)`, then update the affected tests to use them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Align acceptance/deferred requirement labels across migrated tests
**Finding key:** loop-dbc133af4e586fed4263
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R4
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** Requirement labels in test titles are inconsistent across related acceptance/deferred migration tests: one file still uses `R8`/`R9` labels for behavior mapped to `R3`, while this file uses `R5` for behavior mapped to `R4`. This weakens cross-spec auditability of the migration.  
**Suggestion:** Rename the affected test descriptions so each title uses the same requirement id as the related spec mapping, especially `R3` for verdict/evidence behavior and `R4` for deferred final disposition behavior.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** Requirement labels in test titles are inconsistent across related acceptance/deferred migration tests: one file still uses `R8`/`R9` labels for behavior mapped to `R3`, while this file uses `R5` for behavior mapped to `R4`. This weakens cross-spec auditability of the migration.  
**Suggestion:** Rename the affected test descriptions so each title uses the same requirement id as the related spec mapping, especially `R3` for verdict/evidence behavior and `R4` for deferred final disposition behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 3. Consolidate spec-correction rewind naming and category constants
**Finding key:** loop-8114865dd0c15ce47a40
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** Spec-correction rewind behavior is named differently across `plan-rewind.js`, `run-reopen-draft.js`, and `run-scenario-validity.js`, while the raw `"spec-correction"` category string is introduced separately. This creates a cross-file vocabulary mismatch around the same feature.  
**Suggestion:** Export or colocate a shared constant/name set, for example `SPEC_CORRECTION_REWIND_CATEGORY` and `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, and use those names consistently in all three files.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** Spec-correction rewind behavior is named differently across `plan-rewind.js`, `run-reopen-draft.js`, and `run-scenario-validity.js`, while the raw `"spec-correction"` category string is introduced separately. This creates a cross-file vocabulary mismatch around the same feature.  
**Suggestion:** Export or colocate a shared constant/name set, for example `SPEC_CORRECTION_REWIND_CATEGORY` and `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, and use those names consistently in all three files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 4. Rename tree SHA interfaces to fingerprint consistently
**Finding key:** loop-eac8af867e75d453fe3b
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha()` can now return a synthetic tree-plus-diff fingerprint, while related tests and review convergence code still reason about “tree sha” terminology. The interface name no longer matches its cross-file semantics.  
**Suggestion:** Rename the exported API and related variables/tests toward `reviewTargetFingerprint`, keeping `treeSha` only for actual Git tree SHA values.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha()` can now return a synthetic tree-plus-diff fingerprint, while related tests and review convergence code still reason about “tree sha” terminology. The interface name no longer matches its cross-file semantics.  
**Suggestion:** Rename the exported API and related variables/tests toward `reviewTargetFingerprint`, keeping `treeSha` only for actual Git tree SHA values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 5. Share bounded traversal utilities for filesystem walks
**Finding key:** loop-d2eb6fc94e4e98e11329
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Unbounded recursive traversal is introduced in more than one place, including fixture test discovery and acceptance migration source scanning. Fixing each locally risks inconsistent depth/count limits.  
**Suggestion:** Add a small shared bounded traversal helper for tests, with explicit `maxDepth` and `maxEntries` options, and use it from both fixture discovery and migration source-file scanning.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Unbounded recursive traversal is introduced in more than one place, including fixture test discovery and acceptance migration source scanning. Fixing each locally risks inconsistent depth/count limits.  
**Suggestion:** Add a small shared bounded traversal helper for tests, with explicit `maxDepth` and `maxEntries` options, and use it from both fixture discovery and migration source-file scanning.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
