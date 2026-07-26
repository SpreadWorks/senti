# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Extract Repeated Artifact Writer Arguments
**Finding key:** loop-e86c3e954c7783bd997a
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R9
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R9  
**Issue:** Calls to `writeAcceptanceReviewArtifact` repeat the same `specDir`, `fingerprint`, and `flowState` fixture arguments several times, making the test noisier and easier to update inconsistently.  
**Suggestion:** Add a small local helper such as `writeFixtureArtifact(fixture, artifact)` and use it in the writer tests.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R9  
**Issue:** Calls to `writeAcceptanceReviewArtifact` repeat the same `specDir`, `fingerprint`, and `flowState` fixture arguments several times, making the test noisier and easier to update inconsistently.  
**Suggestion:** Add a small local helper such as `writeFixtureArtifact(fixture, artifact)` and use it in the writer tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Rename Stale Verdict Test Title
**Finding key:** loop-4da56754cc3022d18272
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R3
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The test named `secondary scores cannot offset current unmet requirements or hard blockers` no longer uses secondary scores. The title carries old model terminology after the migration to requirement judgments.  
**Suggestion:** Rename it to describe the current behavior directly, for example `R9: unmet requirements and hard blockers derive non-pass verdicts`.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The test named `secondary scores cannot offset current unmet requirements or hard blockers` no longer uses secondary scores. The title carries old model terminology after the migration to requirement judgments.  
**Suggestion:** Rename it to describe the current behavior directly, for example `R9: unmet requirements and hard blockers derive non-pass verdicts`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Replace Hidden Flow-Findings Behavior In Generic JSON Helper
**Finding key:** loop-36d0181605486936aad1
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R4
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** `writeJsonFile` now silently rewrites `flow-findings.json` payloads by adding `version`, `fingerprint`, `disposition`, and `rationale`. That makes a generic helper contain artifact-specific behavior and can hide what each test is actually asserting.  
**Suggestion:** Move that logic into an explicit helper like `writeFlowFindingsFile(file, value)` and call it only where the flow-findings schema defaults are intended.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** `writeJsonFile` now silently rewrites `flow-findings.json` payloads by adding `version`, `fingerprint`, `disposition`, and `rationale`. That makes a generic helper contain artifact-specific behavior and can hide what each test is actually asserting.  
**Suggestion:** Move that logic into an explicit helper like `writeFlowFindingsFile(file, value)` and call it only where the flow-findings schema defaults are intended.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Extract Repair Fingerprint Fixture Helper
**Finding key:** loop-f1d383e2f432053d7ce0
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R9
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** The same `buildRepairFingerprint` dynamic import and argument object are duplicated in multiple tests.  
**Suggestion:** Add a local async helper such as `buildTestRepairFingerprint()` or `repairFingerprintForBaseSpec()` to centralize the import and fixed `root/specPath/state` inputs.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** The same `buildRepairFingerprint` dynamic import and argument object are duplicated in multiple tests.  
**Suggestion:** Add a local async helper such as `buildTestRepairFingerprint()` or `repairFingerprintForBaseSpec()` to centralize the import and fixed `root/specPath/state` inputs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 5. Simplify `baseFlowState` Step Handling
**Finding key:** loop-3b4f20687e65a7641c0b
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R9
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** `baseFlowState` assigns `steps` both before and after `...rest`, and mutates the supplied `steps` object by setting `branch` to `done`. The duplicate property assignment is confusing, and mutation of caller-provided steps is implicit.  
**Suggestion:** Build the returned object once with a single `steps` property. If caller-supplied steps must be modified, make that explicit with a helper name or clone/update pattern before returning.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** `baseFlowState` assigns `steps` both before and after `...rest`, and mutates the supplied `steps` object by setting `branch` to `done`. The duplicate property assignment is confusing, and mutation of caller-provided steps is implicit.  
**Suggestion:** Build the returned object once with a single `steps` property. If caller-supplied steps must be modified, make that explicit with a helper name or clone/update pattern before returning.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Remove the unused export lookup
**Finding key:** loop-fb2a022012f687d77ea5
**Failure mode:** refactor
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R9
**Issue:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R9  
**Issue:** The `R6: exhausted semantic findings...` test still assigns `resolveRetryExhaustionForFlowStep`, but that value is no longer used after the retry-resolution assertions were moved into a separate test.  
**Suggestion:** Delete the unused `const resolveRetryExhaustionForFlowStep = requireExport(...)` line from that test.
**Suggestion:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R9  
**Issue:** The `R6: exhausted semantic findings...` test still assigns `resolveRetryExhaustionForFlowStep`, but that value is no longer used after the retry-resolution assertions were moved into a separate test.  
**Suggestion:** Delete the unused `const resolveRetryExhaustionForFlowStep = requireExport(...)` line from that test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Extract deferred finding identity mapping
**Finding key:** loop-b4246b279b23de3a0a0c
**Failure mode:** refactor
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R5
**Issue:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The acceptance fixture setup and assertion both repeat the same projection of `artifact.entries` into `{ findingId, sourceStep, sourceArtifact, sourceFindingId }`, with only `finalDisposition` added in the expected value.  
**Suggestion:** Add a small local helper such as `deferredFindingIdentity(entry, finalDisposition)` and use it for both fixture input and `assert.deepEqual` expected values.
**Suggestion:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The acceptance fixture setup and assertion both repeat the same projection of `artifact.entries` into `{ findingId, sourceStep, sourceArtifact, sourceFindingId }`, with only `finalDisposition` added in the expected value.  
**Suggestion:** Add a small local helper such as `deferredFindingIdentity(entry, finalDisposition)` and use it for both fixture input and `assert.deepEqual` expected values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Centralize JSON artifact writes
**Finding key:** loop-85ae9e43576f234db76e
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The file repeatedly writes JSON artifacts with `fs.writeFileSync(path.join(...), JSON.stringify(..., null, 2) + "\n")`. A `writeRetrySource` helper exists, but several tests still duplicate the full write expression.  
**Suggestion:** Generalize `writeRetrySource` to a neutral helper like `writeSpecArtifact(specDir, file, artifact)` and use it for `test-review.json`, `impl-gate-result.json`, and other JSON fixture writes.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The file repeatedly writes JSON artifacts with `fs.writeFileSync(path.join(...), JSON.stringify(..., null, 2) + "\n")`. A `writeRetrySource` helper exists, but several tests still duplicate the full write expression.  
**Suggestion:** Generalize `writeRetrySource` to a neutral helper like `writeSpecArtifact(specDir, file, artifact)` and use it for `test-review.json`, `impl-gate-result.json`, and other JSON fixture writes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Extract acceptance review invocation boilerplate
**Finding key:** loop-6be8f0d4ce64f4d0b4f1
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Several tests call `runAcceptanceReviewFixture` with the same `root`, `state`, `diff`, and `requirementJudgments` fields from the fixture. This makes each test longer and increases the chance of inconsistent setup.  
**Suggestion:** Add a helper such as `runAcceptance(fixture, options = {})` that fills the shared fields and spreads test-specific options like `deferredFindingDispositions`, `persist`, `apply`, and `flowManager`.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Several tests call `runAcceptanceReviewFixture` with the same `root`, `state`, `diff`, and `requirementJudgments` fields from the fixture. This makes each test longer and increases the chance of inconsistent setup.  
**Suggestion:** Add a helper such as `runAcceptance(fixture, options = {})` that fills the shared fields and spreads test-specific options like `deferredFindingDispositions`, `persist`, `apply`, and `flowManager`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 5. Extract retry deferral assertion setup
**Finding key:** loop-1f0a01e0dfef11939ef9
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** The review and gate retry tests repeat the same pattern: write source artifact, build retry flow state, call retry checker, assert `deferred`, then inspect `flow-findings.json`.  
**Suggestion:** Introduce focused helpers such as `assertReviewRetryDeferred(fixture, case)` and `assertGateRetryDeferred(fixture, case)` to keep the case tables readable and reduce duplicate setup logic.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** The review and gate retry tests repeat the same pattern: write source artifact, build retry flow state, call retry checker, assert `deferred`, then inspect `flow-findings.json`.  
**Suggestion:** Introduce focused helpers such as `assertReviewRetryDeferred(fixture, case)` and `assertGateRetryDeferred(fixture, case)` to keep the case tables readable and reduce duplicate setup logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Remove Redundant `nextAction` Override
**Finding key:** loop-085152e6376e91a61b83
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R7
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`
**Requirement:** R7
**Issue:** `skippedByProjectPolicyArtifact()` now already returns `nextAction: "report"`, but the later validator assertion spreads the artifact and overrides `nextAction` to `"report"` again. That override is dead code and obscures the fact that the helper itself is the canonical valid artifact.
**Suggestion:** Replace the assertion with `assert.doesNotThrow(() => validateFinalRegressionResult(skippedByProjectPolicyArtifact()));`.
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`
**Requirement:** R7
**Issue:** `skippedByProjectPolicyArtifact()` now already returns `nextAction: "report"`, but the later validator assertion spreads the artifact and overrides `nextAction` to `"report"` again. That override is dead code and obscures the fact that the helper itself is the canonical valid artifact.
**Suggestion:** Replace the assertion with `assert.doesNotThrow(() => validateFinalRegressionResult(skippedByProjectPolicyArtifact()));`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 5. Simplify Repeated Repo Preparation
**Finding key:** loop-d3e02851581990914969
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R9
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`
**Requirement:** R9
**Issue:** Multiple R3/R4 test cases repeat the same setup sequence: `writeSpec(tmp)`, `commitAll(tmp)`, `checkoutFeature(tmp)`, then `writeNoTestsArtifacts(specDir, { root: tmp, ... })`.
**Suggestion:** Add a local helper such as `prepareNoTestsFeatureRepo(tmp, options)` that performs this sequence and returns `specDir`. This reduces duplication while preserving the changed ordering needed for repair fingerprints.
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`
**Requirement:** R9
**Issue:** Multiple R3/R4 test cases repeat the same setup sequence: `writeSpec(tmp)`, `commitAll(tmp)`, `checkoutFeature(tmp)`, then `writeNoTestsArtifacts(specDir, { root: tmp, ... })`.
**Suggestion:** Add a local helper such as `prepareNoTestsFeatureRepo(tmp, options)` that performs this sequence and returns `specDir`. This reduces duplication while preserving the changed ordering needed for repair fingerprints.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Extract Repeated Acceptance Fixture Execution Setup
**Finding key:** loop-716ebd35e37dbdf389bd
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** The R8 tests repeatedly call `runAcceptanceReviewFixture` with the same `root`, `state`, `diff`, `requirementJudgments`, `flowManager`, and `apply` wiring. This duplication makes the tests harder to scan and increases maintenance cost if the fixture API changes.
**Suggestion:** Add a small local helper such as `runDeferredAcceptanceFixture(fixture, disposition, options = {})` that supplies the common arguments and only varies `deferredFindingDispositions` and `apply`.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** The R8 tests repeatedly call `runAcceptanceReviewFixture` with the same `root`, `state`, `diff`, `requirementJudgments`, `flowManager`, and `apply` wiring. This duplication makes the tests harder to scan and increases maintenance cost if the fixture API changes.
**Suggestion:** Add a small local helper such as `runDeferredAcceptanceFixture(fixture, disposition, options = {})` that supplies the common arguments and only varies `deferredFindingDispositions` and `apply`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Extract Deferred Finding Producer Setup
**Finding key:** loop-0ee5c31fb90ead100eb3
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** Several R8 tests repeat the sequence `prepareSpecRoot()`, `runFinalSemanticFail(...)`, and `readFlowFindingsArtifact(...).toJSON().entries`. This is setup noise rather than test intent.
**Suggestion:** Introduce a helper like `produceDeferredFinding(findingId)` returning `{ producerFixture, entry }`, then use it in the R8 tests to keep each test focused on the acceptance-review behavior being asserted.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** Several R8 tests repeat the sequence `prepareSpecRoot()`, `runFinalSemanticFail(...)`, and `readFlowFindingsArtifact(...).toJSON().entries`. This is setup noise rather than test intent.
**Suggestion:** Introduce a helper like `produceDeferredFinding(findingId)` returning `{ producerFixture, entry }`, then use it in the R8 tests to keep each test focused on the acceptance-review behavior being asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Rename Ambiguous Fixture Variables
**Finding key:** loop-cf7ad0899f0aa960a585
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** The R8 tests use several generic names such as `fixture`, `blockingFixture`, and `acceptanceFixture` for different roles. In particular, `blockingFixture` is named after the disposition being tested, while `fixture` sometimes means a producer fixture and sometimes an acceptance fixture.
**Suggestion:** Use role-based names consistently, for example `producerFixture` and `reviewFixture`, and reserve disposition-specific names for result values such as `blockingResult`.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** The R8 tests use several generic names such as `fixture`, `blockingFixture`, and `acceptanceFixture` for different roles. In particular, `blockingFixture` is named after the disposition being tested, while `fixture` sometimes means a producer fixture and sometimes an acceptance fixture.
**Suggestion:** Use role-based names consistently, for example `producerFixture` and `reviewFixture`, and reserve disposition-specific names for result values such as `blockingResult`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Add an explicit recursion bound for source scanning
**Finding key:** loop-3c8ffe96bf2e7b9ee136
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth or entry bound, which violates the `bounded-resource-usage` guardrail even though the current tree is finite.  
**Suggestion:** Add parameters such as `maxDepth` and `maxEntries`, decrement/check them during traversal, and fail with a clear assertion if exceeded.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth or entry bound, which violates the `bounded-resource-usage` guardrail even though the current tree is finite.  
**Suggestion:** Add parameters such as `maxDepth` and `maxEntries`, decrement/check them during traversal, and fail with a clear assertion if exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Replace unused `Map` keys with a plain array
**Finding key:** loop-a88b68cd60059b083f2f
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R10
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** `runtimeRepairTestFiles` is a `Map`, but only `.values()` is used. The descriptive keys are dead metadata and make the structure look more meaningful than it is.  
**Suggestion:** Change it to an array of test file paths, or use the labels in assertion messages if the names are intended to aid debugging.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** `runtimeRepairTestFiles` is a `Map`, but only `.values()` is used. The descriptive keys are dead metadata and make the structure look more meaningful than it is.  
**Suggestion:** Change it to an array of test file paths, or use the labels in assertion messages if the names are intended to aid debugging.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Reuse resolved review convergence records
**Finding key:** loop-8794682a5f55e11fc210
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `latestReviewConvergenceRecords(flowState)` is now called repeatedly in nearby code paths, including once for handoffs and again for canonical records. This creates duplicated resolution logic and makes it easier for future edits to accidentally use different record sets.  
**Suggestion:** Store the latest records in a local `latestRecords` variable and derive both `reviewHandoffs` and `canonicalRecords` from it.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `latestReviewConvergenceRecords(flowState)` is now called repeatedly in nearby code paths, including once for handoffs and again for canonical records. This creates duplicated resolution logic and makes it easier for future edits to accidentally use different record sets.  
**Suggestion:** Store the latest records in a local `latestRecords` variable and derive both `reviewHandoffs` and `canonicalRecords` from it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Clarify latest vs historical handoff naming
**Finding key:** loop-52355c2e0e523d91f0c7
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `reviewHandoffs` now means latest handoffs, while `historicalReviewHandoffs` means all raw convergence records. The distinction is important but easy to miss because the names differ only by one adjective.  
**Suggestion:** Rename them to something more explicit, such as `latestReviewHandoffs` and `allReviewHandoffs`, and consider naming the helper `reviewHandoffFindingsFromRecords(records)` to reflect its new parameter contract.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `reviewHandoffs` now means latest handoffs, while `historicalReviewHandoffs` means all raw convergence records. The distinction is important but easy to miss because the names differ only by one adjective.  
**Suggestion:** Rename them to something more explicit, such as `latestReviewHandoffs` and `allReviewHandoffs`, and consider naming the helper `reviewHandoffFindingsFromRecords(records)` to reflect its new parameter contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Bound Recursive Evidence Resolution
**Finding key:** loop-6bc32816208e11638fef
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively resolves associated evidence paths without an explicit depth or visited-path bound. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or self-reference, this can recurse indefinitely, violating `bounded-resource-usage`.  
**Suggestion:** Replace recursion with an iterative resolver using a `visited` set and a small max depth, or pass a `visited` set through recursive calls and return `false` on repeats.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively resolves associated evidence paths without an explicit depth or visited-path bound. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or self-reference, this can recurse indefinitely, violating `bounded-resource-usage`.  
**Suggestion:** Replace recursion with an iterative resolver using a `visited` set and a small max depth, or pass a `visited` set through recursive calls and return `false` on repeats.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Avoid Rechecking Repair Delta Evidence
**Finding key:** loop-b6b1a7c53b157bd00cb0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isCompletedRepairMigrationCurrent()` calls `hasCurrentRepairDelta()` and then also checks every invalidation with `isFreshMigrationArtifact()`. If `REPAIR_DELTA_DIR` appears in `migration.invalidations`, the ledger/delta evidence is read and inspected twice.  
**Suggestion:** Skip `REPAIR_DELTA_DIR` in the final invalidation loop after `hasCurrentRepairDelta()` succeeds, or compute evidence freshness once and reuse the result.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isCompletedRepairMigrationCurrent()` calls `hasCurrentRepairDelta()` and then also checks every invalidation with `isFreshMigrationArtifact()`. If `REPAIR_DELTA_DIR` appears in `migration.invalidations`, the ledger/delta evidence is read and inspected twice.  
**Suggestion:** Skip `REPAIR_DELTA_DIR` in the final invalidation loop after `hasCurrentRepairDelta()` succeeds, or compute evidence freshness once and reuse the result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Rename Manifest Variables To Fingerprint
**Finding key:** loop-618ca355666be5b82649
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `observedCurrent` is produced by `buildRepairFingerprint()`, then stored in `currentManifest` and passed through classes as `currentManifest`. The object appears to represent the current repair fingerprint, not only a manifest, which makes the migration logic harder to follow.  
**Suggestion:** Rename `observedCurrent` and the newer `currentManifest` usages to `currentFingerprint` or `currentRepairFingerprint`, especially in `commitRepairStateMigration()` and `RepairMigrationEvidenceReplacement`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `observedCurrent` is produced by `buildRepairFingerprint()`, then stored in `currentManifest` and passed through classes as `currentManifest`. The object appears to represent the current repair fingerprint, not only a manifest, which makes the migration logic harder to follow.  
**Suggestion:** Rename `observedCurrent` and the newer `currentManifest` usages to `currentFingerprint` or `currentRepairFingerprint`, especially in `commitRepairStateMigration()` and `RepairMigrationEvidenceReplacement`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 4. Simplify MigrationEvidenceInspection
**Finding key:** loop-c810d717281758765db9
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection` stores `failure`, but callers only read `.current`. This adds an object type and retained state without useful behavior in the current code path.  
**Suggestion:** Replace it with a small helper such as `inspectMigrationEvidence(reader)` that emits the warning and returns a boolean, unless future callers need the failure detail.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection` stores `failure`, but callers only read `.current`. This adds an object type and retained state without useful behavior in the current code path.  
**Suggestion:** Replace it with a small helper such as `inspectMigrationEvidence(reader)` that emits the warning and returns a boolean, unless future callers need the failure detail.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Bound dirty diff hashing
**Finding key:** loop-fab3ae066a8ef526f2f6
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R7  
**Issue:** `runGit(["diff", "--binary", "HEAD"])` captures the full binary diff in memory with no explicit size bound. This violates the bounded-resource-usage guardrail for bulk data loading, especially because `--binary` can include large blobs.  
**Suggestion:** Add an explicit upper bound before hashing, for example by using a capped git output helper, streaming the diff into the hash with a byte limit, or rejecting diffs above a configured maximum with `REVIEW_TARGET_TREE_UNAVAILABLE`.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R7  
**Issue:** `runGit(["diff", "--binary", "HEAD"])` captures the full binary diff in memory with no explicit size bound. This violates the bounded-resource-usage guardrail for bulk data loading, especially because `--binary` can include large blobs.  
**Suggestion:** Add an explicit upper bound before hashing, for example by using a capped git output helper, streaming the diff into the hash with a byte limit, or rejecting diffs above a configured maximum with `REVIEW_TARGET_TREE_UNAVAILABLE`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Rename tree SHA resolver to reflect fingerprint semantics
**Finding key:** loop-5c79f9ac4f900a651212
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** `resolveCurrentReviewTreeSha()` no longer always returns a Git tree SHA. When the worktree has uncommitted changes, it returns a synthetic SHA-1 digest of `treeSha + diff`. The current name is now misleading and may encourage callers to treat the value as a real Git object ID.  
**Suggestion:** Rename it to something like `resolveCurrentReviewTargetFingerprint()` or split the behavior into `resolveCurrentReviewTreeSha()` and `resolveCurrentReviewTargetFingerprint()` so the synthetic-digest case is explicit.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** `resolveCurrentReviewTreeSha()` no longer always returns a Git tree SHA. When the worktree has uncommitted changes, it returns a synthetic SHA-1 digest of `treeSha + diff`. The current name is now misleading and may encourage callers to treat the value as a real Git object ID.  
**Suggestion:** Rename it to something like `resolveCurrentReviewTargetFingerprint()` or split the behavior into `resolveCurrentReviewTreeSha()` and `resolveCurrentReviewTargetFingerprint()` so the synthetic-digest case is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Bound execution summary scanning
**Finding key:** loop-e6b4a09eb2cfa60fa4fd
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `IntegrationExecutionEvidence.entriesFor()` scans `this.result.summary` with `.find()` and the constructor accepts any array size. This introduces unbounded bulk processing for externally loaded JSON, violating the bounded-resource-usage guardrail.  
**Suggestion:** Enforce an explicit maximum summary length in the constructor before storing `result`, or build a bounded lookup map while validating. For example, reject `result.summary.length > MAX_TEST_EXECUTION_SUMMARY_ENTRIES`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `IntegrationExecutionEvidence.entriesFor()` scans `this.result.summary` with `.find()` and the constructor accepts any array size. This introduces unbounded bulk processing for externally loaded JSON, violating the bounded-resource-usage guardrail.  
**Suggestion:** Enforce an explicit maximum summary length in the constructor before storing `result`, or build a bounded lookup map while validating. For example, reject `result.summary.length > MAX_TEST_EXECUTION_SUMMARY_ENTRIES`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Avoid repeated execution evidence entries per requirement
**Finding key:** loop-72f5a4d78ab6d7048d8d
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `entriesFor(requirementId)` adds `[TEST-REVIEW]` and `[REGRESSION]` for every requirement context. These entries are requirement-independent, so the same text is duplicated across all rendered requirement contexts.  
**Suggestion:** Split requirement-specific and global execution evidence. Add `[TEST:<id>]` per requirement, and attach `[TEST-REVIEW]` / `[REGRESSION]` once at a higher-level prompt context if available. If the existing prompt shape requires per-requirement context, extract helper methods like `testReviewEntry()` and `regressionEntry()` to make the intentional duplication explicit.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `entriesFor(requirementId)` adds `[TEST-REVIEW]` and `[REGRESSION]` for every requirement context. These entries are requirement-independent, so the same text is duplicated across all rendered requirement contexts.  
**Suggestion:** Split requirement-specific and global execution evidence. Add `[TEST:<id>]` per requirement, and attach `[TEST-REVIEW]` / `[REGRESSION]` once at a higher-level prompt context if available. If the existing prompt shape requires per-requirement context, extract helper methods like `testReviewEntry()` and `regressionEntry()` to make the intentional duplication explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Extract integration artifact path construction
**Finding key:** loop-fcf42fad8b43e5eb14b7
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** The integration artifact filenames are hardcoded inline where evidence is loaded: `test-execute-result.json` and `test-result-review.json`. Similar artifact names are likely already used by `checkIntegrationTestArtifacts()`, so this risks drift.  
**Suggestion:** Reuse existing constants if present in this file, or introduce local constants/helper such as `readIntegrationExecutionEvidence(root, state)` so validation and prompt evidence load from a single naming source.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** The integration artifact filenames are hardcoded inline where evidence is loaded: `test-execute-result.json` and `test-result-review.json`. Similar artifact names are likely already used by `checkIntegrationTestArtifacts()`, so this risks drift.  
**Suggestion:** Reuse existing constants if present in this file, or introduce local constants/helper such as `readIntegrationExecutionEvidence(root, state)` so validation and prompt evidence load from a single naming source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Rename `latestFingerprint` for precision
**Finding key:** loop-302895a1309f0e3a1a6f
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `latestFingerprint` sounds like the latest finding fingerprint, but it actually stores `latestArtifact.repairFingerprint`. In a function already dealing with finding fingerprints, this is ambiguous.  
**Suggestion:** Rename it to `latestRepairFingerprint` and use that name in the artifact filtering condition.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `latestFingerprint` sounds like the latest finding fingerprint, but it actually stores `latestArtifact.repairFingerprint`. In a function already dealing with finding fingerprints, this is ambiguous.  
**Suggestion:** Rename it to `latestRepairFingerprint` and use that name in the artifact filtering condition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 5. Prefer a `Set` for supported stage membership
**Finding key:** loop-abf2823971c33af3a938
**Failure mode:** refactor
**File:** src/flow/lib/run-reopen-draft.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R2  
**Issue:** `SPEC_CORRECTION_SUPPORTED_STAGES.includes(activeStep)` performs linear membership checks and exposes array semantics at the call site. The name reads like a constant membership policy, not an ordered list.  
**Suggestion:** If ordering is not meaningful, define/export the supported stages as a `Set` or add a helper such as `isSpecCorrectionSupportedStage(activeStep)`. That keeps the reopen command aligned with policy-level naming and hides representation details.
**Suggestion:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R2  
**Issue:** `SPEC_CORRECTION_SUPPORTED_STAGES.includes(activeStep)` performs linear membership checks and exposes array semantics at the call site. The name reads like a constant membership policy, not an ordered list.  
**Suggestion:** If ordering is not meaningful, define/export the supported stages as a `Set` or add a helper such as `isSpecCorrectionSupportedStage(activeStep)`. That keeps the reopen command aligned with policy-level naming and hides representation details.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract the rewind intent check
**Finding key:** loop-4184b5a572a0905ef825
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R7  
**Issue:** The condition `state?.planRewinds?.at(-1)?.category !== "spec-correction"` is embedded directly in the preflight file selection, making the business rule harder to scan.  
**Suggestion:** Introduce a named local such as `const isSpecCorrectionRewind = state.planRewinds?.at(-1)?.category === "spec-correction";` and use it to choose `changedFiles`.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R7  
**Issue:** The condition `state?.planRewinds?.at(-1)?.category !== "spec-correction"` is embedded directly in the preflight file selection, making the business rule harder to scan.  
**Suggestion:** Introduce a named local such as `const isSpecCorrectionRewind = state.planRewinds?.at(-1)?.category === "spec-correction";` and use it to choose `changedFiles`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Avoid unnecessary optional chaining on required state
**Finding key:** loop-b5a030700912ccb15130
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R7  
**Issue:** The new code uses `state?.planRewinds`, but nearby code already assumes `state` exists via `state.baseBranch`. This creates inconsistent expectations about whether `state` can be nullish.  
**Suggestion:** Use `state.planRewinds?.at(-1)?.category` unless `state` is genuinely optional in this method.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R7  
**Issue:** The new code uses `state?.planRewinds`, but nearby code already assumes `state` exists via `state.baseBranch`. This creates inconsistent expectations about whether `state` can be nullish.  
**Suggestion:** Use `state.planRewinds?.at(-1)?.category` unless `state` is genuinely optional in this method.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Clarify the deferred tree SHA callback name
**Finding key:** loop-d420ec89b983e95d56c0
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `resolveNextTreeSha` is passed as a callback, but the name reads like a value-producing helper with no hint that it is intentionally deferred.  
**Suggestion:** Consider a name such as `loadNextTreeSha` or `getNextTreeSha` if this matches the naming style inside `ReviewToolingRecoveryMutation`. This makes the lazy evaluation clearer at the call site.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `resolveNextTreeSha` is passed as a callback, but the name reads like a value-producing helper with no hint that it is intentionally deferred.  
**Suggestion:** Consider a name such as `loadNextTreeSha` or `getNextTreeSha` if this matches the naming style inside `ReviewToolingRecoveryMutation`. This makes the lazy evaluation clearer at the call site.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Bound Recursive Test Discovery
**Finding key:** loop-18ec2959bd17d97d78ae
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `#existingTestFile()` uses `fs.readdirSync(testsDir, { recursive: true, withFileTypes: true })` without an explicit depth, file-count, or size bound. This violates the `bounded-resource-usage` guardrail if a producer fixture has a very large or deeply nested `tests/` tree.  
**Suggestion:** Replace the recursive bulk read with a bounded walker, for example cap max depth and max scanned entries, then throw a fixture-specific error if the cap is exceeded.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `#existingTestFile()` uses `fs.readdirSync(testsDir, { recursive: true, withFileTypes: true })` without an explicit depth, file-count, or size bound. This violates the `bounded-resource-usage` guardrail if a producer fixture has a very large or deeply nested `tests/` tree.  
**Suggestion:** Replace the recursive bulk read with a bounded walker, for example cap max depth and max scanned entries, then throw a fixture-specific error if the cap is exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Remove Impossible Raw Evidence Check
**Finding key:** loop-1a47852998c63f74d79b
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `const rawEndLine = Math.max(1, this.requirementIds.length);` followed by `if (rawEndLine < 1)` is dead code because `rawEndLine` can never be less than `1`.  
**Suggestion:** Remove `rawEndLine` and the final check, or replace it with a meaningful boundary validation such as checking `this.requirementIds.length > 0` near constructor input normalization.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `const rawEndLine = Math.max(1, this.requirementIds.length);` followed by `if (rawEndLine < 1)` is dead code because `rawEndLine` can never be less than `1`.  
**Suggestion:** Remove `rawEndLine` and the final check, or replace it with a meaningful boundary validation such as checking `this.requirementIds.length > 0` near constructor input normalization.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Avoid Repeated Requirement Lookup
**Finding key:** loop-fed243d139bc54bf79e8
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Inside `#createFixtureRepository()`, each requirement performs `existingSpec.requirements?.find(...)` three separate times for `desc`, `priority`, and `status`. This duplicates lookup logic and makes the fixture assembly noisier.  
**Suggestion:** Store the existing requirement once inside the map callback:
```js
requirements: this.requirementIds.map((id) => {
  const existingRequirement = existingSpec.requirements?.find((requirement) => requirement.id === id);
  return {
    id,
    desc: existingRequirement?.desc || `${id} fixture requirement`,
    priority: existingRequirement?.priority || "must",
    status: existingRequirement?.status || "pending",
  };
}),
```
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Inside `#createFixtureRepository()`, each requirement performs `existingSpec.requirements?.find(...)` three separate times for `desc`, `priority`, and `status`. This duplicates lookup logic and makes the fixture assembly noisier.  
**Suggestion:** Store the existing requirement once inside the map callback:
```js
requirements: this.requirementIds.map((id) => {
  const existingRequirement = existingSpec.requirements?.find((requirement) => requirement.id === id);
  return {
    id,
    desc: existingRequirement?.desc || `${id} fixture requirement`,
    priority: existingRequirement?.priority || "must",
    status: existingRequirement?.status || "pending",
  };
}),
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Extract Repeated Test Evidence Builders
**Finding key:** loop-9e2fe5d07743744dcafb
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** The fixture repeats the same test name, command, and raw output line structure across test file generation, scenario validity summaries, test execution summaries, and retro notes. This makes future acceptance fixture changes easy to apply inconsistently.  
**Suggestion:** Add small private helpers such as `#fixtureTestName(id)`, `#testCommand()`, and `#testEvidence(id, index)`, then reuse them in `#createFixtureRepository()` and `#writeMechanicalEvidence()`.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** The fixture repeats the same test name, command, and raw output line structure across test file generation, scenario validity summaries, test execution summaries, and retro notes. This makes future acceptance fixture changes easy to apply inconsistently.  
**Suggestion:** Add small private helpers such as `#fixtureTestName(id)`, `#testCommand()`, and `#testEvidence(id, index)`, then reuse them in `#createFixtureRepository()` and `#writeMechanicalEvidence()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 5. Factor Duplicate Readiness Evaluation Setup
**Finding key:** loop-101ce728f0cbdad3d847
**Failure mode:** refactor
**File:** tests/unit/flow/finding-gate-readiness.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R9  
**Issue:** The added test calls `evaluateReviewFindingGateReadiness()` twice with the same `root`, `state`, `phase`, and `issueLog` object shape. The repetition obscures that the only behavioral difference is deleting the legacy fingerprint.  
**Suggestion:** Extract a local helper inside the test, for example `const evaluate = () => evaluateReviewFindingGateReadiness({ ... });`, then assert the fresh and legacy cases through that helper.
**Suggestion:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R9  
**Issue:** The added test calls `evaluateReviewFindingGateReadiness()` twice with the same `root`, `state`, `phase`, and `issueLog` object shape. The repetition obscures that the only behavioral difference is deleting the legacy fingerprint.  
**Suggestion:** Extract a local helper inside the test, for example `const evaluate = () => evaluateReviewFindingGateReadiness({ ... });`, then assert the fresh and legacy cases through that helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Extract a Complete Empty Spec Fixture Helper
**Finding key:** loop-9c5b47a9103cf2ff1016
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R1  
**Issue:** The test now inlines a full “empty spec” object with many default fields. This is likely to be duplicated as more tests need the current spec shape, and it obscures the scenario-specific field, `goal`.  
**Suggestion:** Add a small helper in this test file, such as `emptySpecFixture(overrides = {})`, returning the required default spec shape plus overrides. Use it here as `writeJson(root, TASK_GATE_SPEC, emptySpecFixture({ goal: "Validate task gate evidence." }))`.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R1  
**Issue:** The test now inlines a full “empty spec” object with many default fields. This is likely to be duplicated as more tests need the current spec shape, and it obscures the scenario-specific field, `goal`.  
**Suggestion:** Add a small helper in this test file, such as `emptySpecFixture(overrides = {})`, returning the required default spec shape plus overrides. Use it here as `writeJson(root, TASK_GATE_SPEC, emptySpecFixture({ goal: "Validate task gate evidence." }))`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Narrow the Prompt Assertion Regex
**Finding key:** loop-e771749fbf6d2cc88335
**Failure mode:** refactor
**File:** tests/unit/flow/gate-noop-rerun-guard.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/gate-noop-rerun-guard.test.js`  
**Requirement:** R5  
**Issue:** The new assertion uses `/MUST:[\s\S]*full-regression-deferred[\s\S]*final-regression/i`, which can match across unrelated prompt sections. That makes the test easier to satisfy accidentally if the terms appear far apart.  
**Suggestion:** Match the specific MUST item more tightly, for example by anchoring to one bullet/paragraph boundary or by extracting the relevant MUST lines first and asserting that one line contains both `full-regression-deferred` and `final-regression`.
**Suggestion:** **File:** `tests/unit/flow/gate-noop-rerun-guard.test.js`  
**Requirement:** R5  
**Issue:** The new assertion uses `/MUST:[\s\S]*full-regression-deferred[\s\S]*final-regression/i`, which can match across unrelated prompt sections. That makes the test easier to satisfy accidentally if the terms appear far apart.  
**Suggestion:** Match the specific MUST item more tightly, for example by anchoring to one bullet/paragraph boundary or by extracting the relevant MUST lines first and asserting that one line contains both `full-regression-deferred` and `final-regression`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Avoid Recomputing Prompt Text
**Finding key:** loop-5cb900c5b376d3d536c1
**Failure mode:** refactor
**File:** tests/unit/flow/gate-requirement-context.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R6  
**Issue:** `context.toPromptText()` is called twice in the new test, duplicating prompt rendering work and making later assertions slightly harder to extend consistently.  
**Suggestion:** Store it once, e.g. `const promptText = context.toPromptText();`, then assert against `promptText`.
**Suggestion:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R6  
**Issue:** `context.toPromptText()` is called twice in the new test, duplicating prompt rendering work and making later assertions slightly harder to extend consistently.  
**Suggestion:** Store it once, e.g. `const promptText = context.toPromptText();`, then assert against `promptText`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Ensure Temporary Directory Cleanup On Assertion Failure
**Finding key:** loop-6bdc2c676aab1f4fa34c
**Failure mode:** refactor
**File:** tests/unit/flow/reopen-draft-spec-correction.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R6  
**Issue:** The loop manually calls `removeTmpDir(tmp)` at the end of each iteration. If any assertion throws before cleanup, the temporary directory can be left behind and `tmp` remains set until outer cleanup behavior runs.  
**Suggestion:** Wrap each iteration body in `try/finally` so `removeTmpDir(tmp)` and `tmp = null` always happen for that iteration.
**Suggestion:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R6  
**Issue:** The loop manually calls `removeTmpDir(tmp)` at the end of each iteration. If any assertion throws before cleanup, the temporary directory can be left behind and `tmp` remains set until outer cleanup behavior runs.  
**Suggestion:** Wrap each iteration body in `try/finally` so `removeTmpDir(tmp)` and `tmp = null` always happen for that iteration.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 3. Make Repeated In-Progress Step Extraction Easier To Read
**Finding key:** loop-e7d9b2f3f8ef1a863788
**Failure mode:** refactor
**File:** tests/unit/flow/reopen-draft-spec-correction.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R6  
**Issue:** The assertion chains `flattenSteps(...).filter(...).map(...)` inline, which makes the expected behavior less immediately visible.  
**Suggestion:** Assign the result to a named local such as `const inProgressStepIds = ...;` and assert `assert.deepEqual(inProgressStepIds, ["draft"]);`.
**Suggestion:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R6  
**Issue:** The assertion chains `flattenSteps(...).filter(...).map(...)` inline, which makes the expected behavior less immediately visible.  
**Suggestion:** Assign the result to a named local such as `const inProgressStepIds = ...;` and assert `assert.deepEqual(inProgressStepIds, ["draft"]);`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 1. Extract retained-migration replay setup
**Finding key:** loop-c75b7c6760b71dac248e
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Several new tests repeat the same post-migration setup: call `migrateBaselineBearingLegacyV2()`, optionally recreate evidence, set `state.steps[0]` / `state.steps[1]`, then call `ensureRepairFingerprintContract()` with the same options.  
**Suggestion:** Add a small helper such as `runRetainedMigrationContract({ recreateEvidence = false, mutateEvidence, mutateState } = {})` that performs the common setup and returns `{ state, flowManager, result, manifest }`. This would make each replay scenario focus only on what it invalidates.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Several new tests repeat the same post-migration setup: call `migrateBaselineBearingLegacyV2()`, optionally recreate evidence, set `state.steps[0]` / `state.steps[1]`, then call `ensureRepairFingerprintContract()` with the same options.  
**Suggestion:** Add a small helper such as `runRetainedMigrationContract({ recreateEvidence = false, mutateEvidence, mutateState } = {})` that performs the common setup and returns `{ state, flowManager, result, manifest }`. This would make each replay scenario focus only on what it invalidates.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Replace positional step mutation with named helper
**Finding key:** loop-bafcfa404a9c60dda90d
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R4  
**Issue:** The new tests mutate `state.steps[0]` and `state.steps[1]` directly. That couples the assertions to array order rather than the semantic step IDs, even though the setup already names steps as `"test-execute"` and `"test-result-review"`.  
**Suggestion:** Introduce a helper like `setStepStatus(state, "test-execute", "done")` or reuse an existing local pattern if present. This improves readability and avoids brittle test failures if step order changes.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R4  
**Issue:** The new tests mutate `state.steps[0]` and `state.steps[1]` directly. That couples the assertions to array order rather than the semantic step IDs, even though the setup already names steps as `"test-execute"` and `"test-result-review"`.  
**Suggestion:** Introduce a helper like `setStepStatus(state, "test-execute", "done")` or reuse an existing local pattern if present. This improves readability and avoids brittle test failures if step order changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Name helper by observable behavior
**Finding key:** loop-c2a0d65c83b614ebd11e
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2()` does more than migrate: it initializes a repository, writes legacy fingerprint/evidence, executes `RunGateCommand`, mutates flow state, and returns the recovery result. The name hides the important side effect that the gate command has already run.  
**Suggestion:** Rename it to something more explicit, for example `recoverBaselineBearingLegacyV2Fingerprint()` or `runLegacyV2BaselineRecovery()`, so callers understand they receive post-recovery state.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2()` does more than migrate: it initializes a repository, writes legacy fingerprint/evidence, executes `RunGateCommand`, mutates flow state, and returns the recovery result. The name hides the important side effect that the gate command has already run.  
**Suggestion:** Rename it to something more explicit, for example `recoverBaselineBearingLegacyV2Fingerprint()` or `runLegacyV2BaselineRecovery()`, so callers understand they receive post-recovery state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Extract review evidence fixture construction
**Finding key:** loop-a7ae4446fad1f1cc47e2
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The new acceptance-review test manually constructs two `ReviewEvidence` instances with mostly fixture metadata. Similar review evidence construction appears common in this test file, and the new block is long enough to obscure the behavior under test.  
**Suggestion:** Add or reuse a helper such as `createReviewEvidence({ phase = "impl", treeSha, invocationId, disposition })`. The test would then emphasize the retained historical rejection followed by the current pass.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The new acceptance-review test manually constructs two `ReviewEvidence` instances with mostly fixture metadata. Similar review evidence construction appears common in this test file, and the new block is long enough to obscure the behavior under test.  
**Suggestion:** Add or reuse a helper such as `createReviewEvidence({ phase = "impl", treeSha, invocationId, disposition })`. The test would then emphasize the retained historical rejection followed by the current pass.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Avoid hard-coded repeated semantic attempt count
**Finding key:** loop-e2c79239bf1ef0f7842b
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R5  
**Issue:** The value `4` is repeated in `configuredSemanticMaxAttempts`, `attempts`, and `round`. These values are intentionally linked, but the test does not make that relationship explicit.  
**Suggestion:** Introduce `const semanticMaxAttempts = 4;` and use it for all related fields. This reduces accidental drift if the fixture changes.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R5  
**Issue:** The value `4` is repeated in `configuredSemanticMaxAttempts`, `attempts`, and `round`. These values are intentionally linked, but the test does not make that relationship explicit.  
**Suggestion:** Introduce `const semanticMaxAttempts = 4;` and use it for all related fields. This reduces accidental drift if the fixture changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 1. Add Timeouts To Synchronous Git Calls
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

### 50. 2. Extract Fixture Setup For Readability
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

### 51. 1. Standardize Acceptance Review Fixture Invocation Helpers
**Finding key:** loop-a4ae109fea641ce3ccb7
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Multiple files introduce or request local helpers around `runAcceptanceReviewFixture`, but with different proposed names and argument shapes: `runAcceptance`, `runDeferredAcceptanceFixture`, and similar fixture-specific wrappers. This risks divergent mini-interfaces for the same test operation.  
**Suggestion:** Use one shared helper shape across acceptance-review tests, for example `runAcceptanceFixture(fixture, overrides = {})`, with common fields filled from the fixture and test-specific fields supplied through `overrides`.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Multiple files introduce or request local helpers around `runAcceptanceReviewFixture`, but with different proposed names and argument shapes: `runAcceptance`, `runDeferredAcceptanceFixture`, and similar fixture-specific wrappers. This risks divergent mini-interfaces for the same test operation.  
**Suggestion:** Use one shared helper shape across acceptance-review tests, for example `runAcceptanceFixture(fixture, overrides = {})`, with common fields filled from the fixture and test-specific fields supplied through `overrides`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 2. Consolidate JSON Artifact Fixture Writers
**Finding key:** loop-e538e97ea57ea71dfa5e
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Several reviews identify repeated JSON artifact writing across different test files, but proposed helpers are local and differently named: `writeFixtureArtifact`, `writeSpecArtifact`, `writeFlowFindingsFile`, and existing `writeRetrySource`. This creates duplicate helper concepts across the test suite.  
**Suggestion:** Introduce or consistently reuse a neutral artifact writer helper such as `writeSpecArtifact(specDir, fileName, artifact)`, and reserve schema-specific helpers like `writeFlowFindingsArtifact` only when defaults or validation are intentionally applied.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Several reviews identify repeated JSON artifact writing across different test files, but proposed helpers are local and differently named: `writeFixtureArtifact`, `writeSpecArtifact`, `writeFlowFindingsFile`, and existing `writeRetrySource`. This creates duplicate helper concepts across the test suite.  
**Suggestion:** Introduce or consistently reuse a neutral artifact writer helper such as `writeSpecArtifact(specDir, fileName, artifact)`, and reserve schema-specific helpers like `writeFlowFindingsArtifact` only when defaults or validation are intentionally applied.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 3. Align Repair Fingerprint Naming Across Source And Tests
**Finding key:** loop-96cc9f524b51147aedf4
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** Source code proposals note `currentManifest` actually represents a repair fingerprint, while test proposals also discuss repair fingerprint setup and legacy recovery helpers. Keeping “manifest”, “fingerprint”, and “legacy recovery” terminology mixed across files makes the same concept harder to follow.  
**Suggestion:** Rename source variables/classes around the current value to `currentRepairFingerprint`, and mirror that terminology in test helpers such as `runLegacyV2RepairFingerprintRecovery()` or `buildTestRepairFingerprint()`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** Source code proposals note `currentManifest` actually represents a repair fingerprint, while test proposals also discuss repair fingerprint setup and legacy recovery helpers. Keeping “manifest”, “fingerprint”, and “legacy recovery” terminology mixed across files makes the same concept harder to follow.  
**Suggestion:** Rename source variables/classes around the current value to `currentRepairFingerprint`, and mirror that terminology in test helpers such as `runLegacyV2RepairFingerprintRecovery()` or `buildTestRepairFingerprint()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 4. Use Consistent Latest-Record Naming For Review Evidence
**Finding key:** loop-71cf83d40a689ad9018f
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** Review-related files introduce “latest” concepts with inconsistent precision: `reviewHandoffs` means latest handoffs, `historicalReviewHandoffs` means all records, and `latestFingerprint` elsewhere means `latestArtifact.repairFingerprint`. These names can mislead callers because “latest” is applied to different artifact types.  
**Suggestion:** Use explicit names that include the artifact domain, such as `latestReviewHandoffs`, `allReviewHandoffs`, and `latestRepairFingerprint`.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** Review-related files introduce “latest” concepts with inconsistent precision: `reviewHandoffs` means latest handoffs, `historicalReviewHandoffs` means all records, and `latestFingerprint` elsewhere means `latestArtifact.repairFingerprint`. These names can mislead callers because “latest” is applied to different artifact types.  
**Suggestion:** Use explicit names that include the artifact domain, such as `latestReviewHandoffs`, `allReviewHandoffs`, and `latestRepairFingerprint`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 5. Share Bounded Traversal Patterns
**Finding key:** loop-46650c6ae8bb8b3456bd
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple files independently propose adding resource bounds for recursive traversal or bulk processing: source scanning, test discovery, evidence resolution, dirty diff hashing, and execution summary scanning. If each file invents its own limits and error style, behavior will drift.  
**Suggestion:** Define a small shared bounded traversal or capped-read pattern where appropriate, with named limits and consistent failure messages. For test-only scanners, use a common fixture helper; for production artifact/evidence reads, use production constants or existing capped IO utilities.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple files independently propose adding resource bounds for recursive traversal or bulk processing: source scanning, test discovery, evidence resolution, dirty diff hashing, and execution summary scanning. If each file invents its own limits and error style, behavior will drift.  
**Suggestion:** Define a small shared bounded traversal or capped-read pattern where appropriate, with named limits and consistent failure messages. For test-only scanners, use a common fixture helper; for production artifact/evidence reads, use production constants or existing capped IO utilities.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
