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

### 16. 1. Bound recursive source traversal
**Finding key:** loop-44fc1f77391aefbaa785
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth or file-count bound. This violates the `bounded-resource-usage` guardrail, even though the current tree is likely small.  
**Suggestion:** Add explicit limits, for example `maxDepth` and `maxFiles`, and fail clearly if either is exceeded. A simple signature like `productionSourceFiles(relativeDir = "src", depth = 0, files = [])` with constants such as `MAX_SOURCE_SCAN_DEPTH` and `MAX_SOURCE_FILES` would make the guardrail contract explicit.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth or file-count bound. This violates the `bounded-resource-usage` guardrail, even though the current tree is likely small.  
**Suggestion:** Add explicit limits, for example `maxDepth` and `maxFiles`, and fail clearly if either is exceeded. A simple signature like `productionSourceFiles(relativeDir = "src", depth = 0, files = [])` with constants such as `MAX_SOURCE_SCAN_DEPTH` and `MAX_SOURCE_FILES` would make the guardrail contract explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Extract repeated migration evidence freshness assertions
**Finding key:** loop-f84b4fb6d27702cd7412
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R10
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** The R10 test repeatedly mutates `test-execute-result.json` or the repair delta file, then immediately asserts `isCompletedRepairMigrationCurrent(...) === false`. The repetition obscures the individual cases and makes future additions noisy.  
**Suggestion:** Add a local helper such as `assertMigrationStaleAfter(writeMutation)` or `assertMigrationCurrent(expected)` that centralizes the repeated call arguments. Keep each scenario’s mutation inline, but remove the repeated multi-line assertion blocks.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** The R10 test repeatedly mutates `test-execute-result.json` or the repair delta file, then immediately asserts `isCompletedRepairMigrationCurrent(...) === false`. The repetition obscures the individual cases and makes future additions noisy.  
**Suggestion:** Add a local helper such as `assertMigrationStaleAfter(writeMutation)` or `assertMigrationCurrent(expected)` that centralizes the repeated call arguments. Keep each scenario’s mutation inline, but remove the repeated multi-line assertion blocks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 5. Use a clearer type for `runtimeRepairTestFiles`
**Finding key:** loop-a64a606b05808c8dde5c
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R10
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** `runtimeRepairTestFiles` is a `Map` whose keys are descriptive labels, but only `.values()` are used. The labels are dead data in this file.  
**Suggestion:** Change it to a plain array of paths, or use the labels in assertion messages if they are intended to aid diagnostics. An array is simpler if the labels are not needed.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R10  
**Issue:** `runtimeRepairTestFiles` is a `Map` whose keys are descriptive labels, but only `.values()` are used. The labels are dead data in this file.  
**Suggestion:** Change it to a plain array of paths, or use the labels in assertion messages if they are intended to aid diagnostics. An array is simpler if the labels are not needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Bound or de-recursify associated evidence resolution
**Finding key:** loop-0cfc13bf55405fb2bbc1
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself when `associatedPrimaryEvidencePath()` returns a primary path. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or self-reference, this can recurse indefinitely.  
**Suggestion:** Replace the recursive call with an iterative resolver that tracks visited paths and enforces a small maximum hop count. If a cycle or hop limit is hit, return `false` through `MigrationEvidenceInspection` or throw a targeted validation error.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself when `associatedPrimaryEvidencePath()` returns a primary path. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or self-reference, this can recurse indefinitely.  
**Suggestion:** Replace the recursive call with an iterative resolver that tracks visited paths and enforces a small maximum hop count. If a cycle or hop limit is hit, return `false` through `MigrationEvidenceInspection` or throw a targeted validation error.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Rename `currentManifest` where it now represents the observed fingerprint
**Finding key:** loop-76f6a5010cb48cae940c
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `ensureRepairFingerprintContract()` sets `currentManifest = observedCurrent`, where `observedCurrent` is produced by `buildRepairFingerprint()`. The name `currentManifest` now blurs two concepts: migrated manifest input and freshly observed current fingerprint state.  
**Suggestion:** Rename the variable and parameter to something like `currentFingerprintManifest` or `currentRepairFingerprint`. This will make `RepairMigrationEvidenceReplacement` and `commitRepairStateMigration()` easier to follow, especially around `previousFingerprint` selection.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `ensureRepairFingerprintContract()` sets `currentManifest = observedCurrent`, where `observedCurrent` is produced by `buildRepairFingerprint()`. The name `currentManifest` now blurs two concepts: migrated manifest input and freshly observed current fingerprint state.  
**Suggestion:** Rename the variable and parameter to something like `currentFingerprintManifest` or `currentRepairFingerprint`. This will make `RepairMigrationEvidenceReplacement` and `commitRepairStateMigration()` easier to follow, especially around `previousFingerprint` selection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Clarify stage-set naming
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

### 22. 1. Validate resolver type before invocation
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

### 23. 2. Extract exhausted-attempt predicate
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

### 24. 1. Bound the dirty diff hashing input
**Finding key:** loop-83faa56eab2a4bc989b0
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `resolveCurrentReviewTreeSha()` loads the full `git diff --binary HEAD` output into memory and hashes it without an explicit size bound. Large binary diffs can produce unbounded stdout, violating the bounded-resource-usage guardrail.  
**Suggestion:** Use a bounded diff strategy, such as hashing streamed git output with a byte limit, rejecting oversized diffs with a clear `REVIEW_TARGET_TREE_UNAVAILABLE` error, or hashing a bounded file-status/index representation if full binary patch content is not required.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `resolveCurrentReviewTreeSha()` loads the full `git diff --binary HEAD` output into memory and hashes it without an explicit size bound. Large binary diffs can produce unbounded stdout, violating the bounded-resource-usage guardrail.  
**Suggestion:** Use a bounded diff strategy, such as hashing streamed git output with a byte limit, rejecting oversized diffs with a clear `REVIEW_TARGET_TREE_UNAVAILABLE` error, or hashing a bounded file-status/index representation if full binary patch content is not required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Extract integration evidence artifact path construction
**Finding key:** loop-68a822799bcd4e122de4
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** The integration evidence filenames are embedded directly where `IntegrationExecutionEvidence` is constructed, while related integration artifact handling already exists nearby. This makes the artifact contract easier to duplicate or drift later.  
**Suggestion:** Extract a small helper such as `readIntegrationExecutionEvidence(root, state)` or constants for `test-execute-result.json` and `test-result-review.json`, then construct `IntegrationExecutionEvidence` through that helper.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** The integration evidence filenames are embedded directly where `IntegrationExecutionEvidence` is constructed, while related integration artifact handling already exists nearby. This makes the artifact contract easier to duplicate or drift later.  
**Suggestion:** Extract a small helper such as `readIntegrationExecutionEvidence(root, state)` or constants for `test-execute-result.json` and `test-result-review.json`, then construct `IntegrationExecutionEvidence` through that helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Clarify latest artifact naming
**Finding key:** loop-b087d8f8b65b4eb2d7a6
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `latestArtifact` stores the raw JSON object, while `reviewedArtifacts` stores `{ artifact, raw }`. The name makes it easy to confuse the raw artifact with a `ReviewFindingGateArtifact` instance.  
**Suggestion:** Rename `latestArtifact` to `latestRawArtifact` or store the same shaped object used in `reviewedArtifacts` for consistency.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `latestArtifact` stores the raw JSON object, while `reviewedArtifacts` stores `{ artifact, raw }`. The name makes it easy to confuse the raw artifact with a `ReviewFindingGateArtifact` instance.  
**Suggestion:** Rename `latestArtifact` to `latestRawArtifact` or store the same shaped object used in `reviewedArtifacts` for consistency.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 4. Avoid repeated execution entries per requirement
**Finding key:** loop-95e2f7eaf47920cf03bf
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `IntegrationExecutionEvidence.entriesFor()` emits `[TEST-REVIEW]` and `[REGRESSION]` entries for every requirement context. Those entries are global execution facts, not requirement-specific facts, so they may unnecessarily duplicate prompt content across all requirements.  
**Suggestion:** Either include global execution evidence once in the shared prompt context, or make `entriesFor()` return only requirement-specific `[TEST:<id>]` entries and add a separate method for global execution evidence.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `IntegrationExecutionEvidence.entriesFor()` emits `[TEST-REVIEW]` and `[REGRESSION]` entries for every requirement context. Those entries are global execution facts, not requirement-specific facts, so they may unnecessarily duplicate prompt content across all requirements.  
**Suggestion:** Either include global execution evidence once in the shared prompt context, or make `entriesFor()` return only requirement-specific `[TEST:<id>]` entries and add a separate method for global execution evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Preserve a specific unsupported-stage message
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

### 29. 1. Name the category check by intent
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

### 30. 2. Avoid repeating the `"spec-correction"` string literal
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

### 31. 1. Extract Repeated Requirement Lookup
**Finding key:** loop-d213b66a1b51936b2781
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#createFixtureRepository()` calls `existingSpec.requirements?.find(...)` three times per requirement when building `requirements`, duplicating lookup logic and making the fixture harder to scan.  
**Suggestion:** Build a `Map` of existing requirements once, then reuse it:

```js
const existingRequirements = new Map(
  (existingSpec.requirements || []).map((requirement) => [requirement.id, requirement]),
);
```

Then read `const existingRequirement = existingRequirements.get(id);` inside the map.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#createFixtureRepository()` calls `existingSpec.requirements?.find(...)` three times per requirement when building `requirements`, duplicating lookup logic and making the fixture harder to scan.  
**Suggestion:** Build a `Map` of existing requirements once, then reuse it:

```js
const existingRequirements = new Map(
  (existingSpec.requirements || []).map((requirement) => [requirement.id, requirement]),
);
```

Then read `const existingRequirement = existingRequirements.get(id);` inside the map.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Extract Shared Test Evidence Builders
**Finding key:** loop-21ffc4cfd50b23fc6ec4
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** The fixture repeatedly constructs the same test file content, raw output strings, test command, test name, and `raw_output_lines` shape across `#createFixtureRepository()` and `#writeMechanicalEvidence()`. This makes future acceptance fixture changes error-prone because the same behavioral evidence format must be updated in multiple places.  
**Suggestion:** Add small private helpers such as `#fixtureTestContent()`, `#scenarioRawOutput()`, `#executionRawOutput()`, `#testCommand()`, and `#requirementEvidence(id, index)`, then use them in both repository creation and mechanical evidence writing.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** The fixture repeatedly constructs the same test file content, raw output strings, test command, test name, and `raw_output_lines` shape across `#createFixtureRepository()` and `#writeMechanicalEvidence()`. This makes future acceptance fixture changes error-prone because the same behavioral evidence format must be updated in multiple places.  
**Suggestion:** Add small private helpers such as `#fixtureTestContent()`, `#scenarioRawOutput()`, `#executionRawOutput()`, `#testCommand()`, and `#requirementEvidence(id, index)`, then use them in both repository creation and mechanical evidence writing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Remove Dead `rawEndLine`
**Finding key:** loop-ba01cc20fe0f118c64ac
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `rawEndLine` is computed as `Math.max(1, this.requirementIds.length)`, then checked with `if (rawEndLine < 1)`. That condition can never be true, so the check is dead code.  
**Suggestion:** Remove `rawEndLine` and the unreachable throw, or replace it with a meaningful boundary check on `this.requirementIds.length` if empty requirements are invalid for this fixture.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `rawEndLine` is computed as `Math.max(1, this.requirementIds.length)`, then checked with `if (rawEndLine < 1)`. That condition can never be true, so the check is dead code.  
**Suggestion:** Remove `rawEndLine` and the unreachable throw, or replace it with a meaningful boundary check on `this.requirementIds.length` if empty requirements are invalid for this fixture.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 4. Avoid Duplicate `fs.existsSync(sourcePath)` Calls
**Finding key:** loop-6fb1756d48af1beb1908
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `#writeDeferredSourceEvidence()` checks `fs.existsSync(sourcePath)` twice in the same loop. The second check repeats filesystem work and slightly obscures the control flow.  
**Suggestion:** Store the result once:

```js
const sourceExists = fs.existsSync(sourcePath);
const existing = sourceExists ? JSON.parse(fs.readFileSync(sourcePath, "utf8")) : {};
...
if (sourceExists && additions.length === 0) continue;
```
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `#writeDeferredSourceEvidence()` checks `fs.existsSync(sourcePath)` twice in the same loop. The second check repeats filesystem work and slightly obscures the control flow.  
**Suggestion:** Store the result once:

```js
const sourceExists = fs.existsSync(sourcePath);
const existing = sourceExists ? JSON.parse(fs.readFileSync(sourcePath, "utf8")) : {};
...
if (sourceExists && additions.length === 0) continue;
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 5. Clarify `input` Parameter Name
**Finding key:** loop-f63e42a0435ebc177177
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `#writeDeferredEvidence(input)` uses a generic parameter name even though the method specifically expects deferred finding descriptors.  
**Suggestion:** Rename `input` to `deferredFindingInputs` or `findingInputs` to match the domain language used elsewhere in the fixture.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `#writeDeferredEvidence(input)` uses a generic parameter name even though the method specifically expects deferred finding descriptors.  
**Suggestion:** Rename `input` to `deferredFindingInputs` or `findingInputs` to match the domain language used elsewhere in the fixture.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Extract repeated readiness evaluation setup
**Finding key:** loop-d5333f240caa7638c854
**Failure mode:** refactor
**File:** tests/unit/flow/finding-gate-readiness.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The new test calls `evaluateReviewFindingGateReadiness` twice with the same `root`, `state`, `phase`, and empty `issueLog`, differing only in timing. The duplicated object setup obscures the actual assertion being tested.  
**Suggestion:** Add a small local helper inside the test or file, for example `evaluateIntegrationReadiness(root, specPath)`, and reuse it for both readiness checks.
**Suggestion:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The new test calls `evaluateReviewFindingGateReadiness` twice with the same `root`, `state`, `phase`, and empty `issueLog`, differing only in timing. The duplicated object setup obscures the actual assertion being tested.  
**Suggestion:** Add a small local helper inside the test or file, for example `evaluateIntegrationReadiness(root, specPath)`, and reuse it for both readiness checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Name the legacy artifact mutation by behavior
**Finding key:** loop-ff96665be1fcc9270834
**Failure mode:** refactor
**File:** tests/unit/flow/finding-gate-readiness.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** `legacyReview` and `originalReviewPath` are understandable, but the key behavioral step is deleting `repairFingerprint`; that intent is only visible from the implementation line.  
**Suggestion:** Wrap the mutation in a helper such as `removeRepairFingerprintFromReview(originalReviewPath)` or rename the variables around “fingerprintless historical review” so the test reads closer to the scenario it is validating.
**Suggestion:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** `legacyReview` and `originalReviewPath` are understandable, but the key behavioral step is deleting `repairFingerprint`; that intent is only visible from the implementation line.  
**Suggestion:** Wrap the mutation in a helper such as `removeRepairFingerprintFromReview(originalReviewPath)` or rename the variables around “fingerprintless historical review” so the test reads closer to the scenario it is validating.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Extract a spec fixture helper
**Finding key:** loop-18cd2c75d322f07cce97
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R1  
**Issue:** The expanded spec fixture now lists many empty default fields inline. This makes the setup noisier and creates a likely duplication point if other tests need a structurally complete spec object.  
**Suggestion:** Extract a local helper such as `createTaskGateSpec(overrides = {})` or `completeSpecFixture(overrides = {})` in this test file, returning the default full spec shape with overrides applied. Use it in `setupTaskGateRepository`.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R1  
**Issue:** The expanded spec fixture now lists many empty default fields inline. This makes the setup noisier and creates a likely duplication point if other tests need a structurally complete spec object.  
**Suggestion:** Extract a local helper such as `createTaskGateSpec(overrides = {})` or `completeSpecFixture(overrides = {})` in this test file, returning the default full spec shape with overrides applied. Use it in `setupTaskGateRepository`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Narrow the prompt assertion to the intended rule
**Finding key:** loop-8fedfacf846eeb605e9e
**Failure mode:** refactor
**File:** tests/unit/flow/gate-noop-rerun-guard.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/gate-noop-rerun-guard.test.js`  
**Requirement:** R5  
**Issue:** The regex `/MUST:[\s\S]*full-regression-deferred[\s\S]*final-regression/i` is very broad. It can pass if any earlier `MUST:` appears before unrelated later mentions of `full-regression-deferred` and `final-regression`, so it does not strongly verify that one coherent MUST rule owns the stage boundary.  
**Suggestion:** Match a single line or bounded paragraph instead, for example by asserting the exact MUST sentence or splitting `readGateImplPrompt()` into lines and checking one line contains both `full-regression-deferred` and `final-regression`.
**Suggestion:** **File:** `tests/unit/flow/gate-noop-rerun-guard.test.js`  
**Requirement:** R5  
**Issue:** The regex `/MUST:[\s\S]*full-regression-deferred[\s\S]*final-regression/i` is very broad. It can pass if any earlier `MUST:` appears before unrelated later mentions of `full-regression-deferred` and `final-regression`, so it does not strongly verify that one coherent MUST rule owns the stage boundary.  
**Suggestion:** Match a single line or bounded paragraph instead, for example by asserting the exact MUST sentence or splitting `readGateImplPrompt()` into lines and checking one line contains both `full-regression-deferred` and `final-regression`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Avoid recomputing prompt text in assertions
**Finding key:** loop-3fee7dfa68ca2ae986ad
**Failure mode:** refactor
**File:** tests/unit/flow/gate-requirement-context.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R1  
**Issue:** The new test calls `context.toPromptText()` twice. This is minor duplication and makes the test slightly noisier than necessary.  
**Suggestion:** Store the rendered text once, e.g. `const promptText = context.toPromptText();`, then assert against `promptText`. This also makes it clearer that both assertions inspect the same rendered context.
**Suggestion:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R1  
**Issue:** The new test calls `context.toPromptText()` twice. This is minor duplication and makes the test slightly noisier than necessary.  
**Suggestion:** Store the rendered text once, e.g. `const promptText = context.toPromptText();`, then assert against `promptText`. This also makes it clearer that both assertions inspect the same rendered context.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Ensure Per-Iteration Temp Cleanup
**Finding key:** loop-830a746c58bc2b208303
**Failure mode:** refactor
**File:** tests/unit/flow/reopen-draft-spec-correction.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R8  
**Issue:** The new loop creates and removes a temp directory inside each iteration, but cleanup happens after assertions. If an assertion fails mid-iteration, the loop-local cleanup is skipped.  
**Suggestion:** Wrap each iteration body in `try/finally` and call `removeTmpDir(tmp)` in the `finally` block, then reset `tmp = null`. This matches the intent of isolating each supported stage while keeping cleanup reliable.
**Suggestion:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R8  
**Issue:** The new loop creates and removes a temp directory inside each iteration, but cleanup happens after assertions. If an assertion fails mid-iteration, the loop-local cleanup is skipped.  
**Suggestion:** Wrap each iteration body in `try/finally` and call `removeTmpDir(tmp)` in the `finally` block, then reset `tmp = null`. This matches the intent of isolating each supported stage while keeping cleanup reliable.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 1. Extract Replay Assertion Helper
**Finding key:** loop-2a55251bb5a27c93e8c6
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Several new tests repeat the same `ensureRepairFingerprintContract({ root, state, flowManager, continueAfterMigration: true })` call plus `result.migrated` and `state.steps[0].status` assertions.  
**Suggestion:** Add a small helper such as `assertRetainedMigrationReplay({ state, flowManager })` to centralize the call and shared assertions, leaving each test focused on only the condition it invalidates.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Several new tests repeat the same `ensureRepairFingerprintContract({ root, state, flowManager, continueAfterMigration: true })` call plus `result.migrated` and `state.steps[0].status` assertions.  
**Suggestion:** Add a small helper such as `assertRetainedMigrationReplay({ state, flowManager })` to centralize the call and shared assertions, leaving each test focused on only the condition it invalidates.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 2. Rename Migration Fixture Helper
**Finding key:** loop-d42966c38537e3222155
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R4  
**Issue:** `migrateBaselineBearingLegacyV2()` sounds like it only prepares or migrates data, but it also executes `RunGateCommand` and returns the command result.  
**Suggestion:** Rename it to something more explicit, such as `runIntegrationGateWithBaselineBearingLegacyV2()` or `recoverBaselineBearingLegacyV2()`, so the helper’s side effects are clear at call sites.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R4  
**Issue:** `migrateBaselineBearingLegacyV2()` sounds like it only prepares or migrates data, but it also executes `RunGateCommand` and returns the command result.  
**Suggestion:** Rename it to something more explicit, such as `runIntegrationGateWithBaselineBearingLegacyV2()` or `recoverBaselineBearingLegacyV2()`, so the helper’s side effects are clear at call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 3. Avoid Step Array Index Coupling
**Finding key:** loop-b017bc9a2bb96dbefb52
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R5  
**Issue:** The new tests repeatedly mutate and assert `state.steps[0]` and `state.steps[1]`, coupling the assertions to fixture ordering rather than the step identities.  
**Suggestion:** Use the existing step lookup pattern, or add local helpers like `setStepStatus(state, "test-execute", "done")` and `assertStepStatus(state, "test-execute", "in_progress")`. This makes the tests more robust and easier to read.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R5  
**Issue:** The new tests repeatedly mutate and assert `state.steps[0]` and `state.steps[1]`, coupling the assertions to fixture ordering rather than the step identities.  
**Suggestion:** Use the existing step lookup pattern, or add local helpers like `setStepStatus(state, "test-execute", "done")` and `assertStepStatus(state, "test-execute", "in_progress")`. This makes the tests more robust and easier to read.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 1. Add Timeouts To Synchronous Git Calls
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

### 46. 2. Extract Fixture Setup For Readability
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

### 47. 1. Centralize Acceptance Review Fixture Invocation
**Finding key:** loop-ea8480c605f348ea4508
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R8
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R8  
**Issue:** Multiple files introduce or repeat local wrappers around `runAcceptanceReviewFixture` with the same `root`, `state`, `diff`, `requirementJudgments`, `flowManager`, `apply`, and disposition wiring. This appears in `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js` and `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`, creating parallel helper conventions that can drift if the fixture API changes.  
**Suggestion:** Add a shared helper in `tests/helpers/acceptance-review-fixture.js`, such as `runDeferredAcceptanceReviewFixture(fixture, options = {})`, and update both spec files to use it instead of creating separate local variants.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R8  
**Issue:** Multiple files introduce or repeat local wrappers around `runAcceptanceReviewFixture` with the same `root`, `state`, `diff`, `requirementJudgments`, `flowManager`, `apply`, and disposition wiring. This appears in `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js` and `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`, creating parallel helper conventions that can drift if the fixture API changes.  
**Suggestion:** Add a shared helper in `tests/helpers/acceptance-review-fixture.js`, such as `runDeferredAcceptanceReviewFixture(fixture, options = {})`, and update both spec files to use it instead of creating separate local variants.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 2. Standardize JSON Artifact Fixture Writers
**Finding key:** loop-7c9db0a679dbb85e9137
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Several test files independently propose local JSON artifact writer helpers for related artifacts: acceptance review artifacts, retry source artifacts, `flow-findings.json`, and generic spec artifacts. If each file adds its own helper, artifact writing behavior and defaults may diverge across the acceptance/retry/defer test suite.  
**Suggestion:** Introduce a shared test helper for writing spec-scoped JSON artifacts, with artifact-specific wrappers only where schema defaults are intentional, for example `writeSpecJsonArtifact(specDir, fileName, artifact)` plus `writeFlowFindingsArtifact(...)`.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Several test files independently propose local JSON artifact writer helpers for related artifacts: acceptance review artifacts, retry source artifacts, `flow-findings.json`, and generic spec artifacts. If each file adds its own helper, artifact writing behavior and defaults may diverge across the acceptance/retry/defer test suite.  
**Suggestion:** Introduce a shared test helper for writing spec-scoped JSON artifacts, with artifact-specific wrappers only where schema defaults are intentional, for example `writeSpecJsonArtifact(specDir, fileName, artifact)` plus `writeFlowFindingsArtifact(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 3. Normalize Deferred Finding Identity Helpers
**Finding key:** loop-361be08bd4ed6d91ca2c
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R5
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R5  
**Issue:** Deferred finding identity projection is repeated across producer artifact and deferred acceptance tests, using the same fields: `findingId`, `sourceStep`, `sourceArtifact`, and `sourceFindingId`. Keeping this projection local to each file risks inconsistent expected identity shape as the deferred finding contract evolves.  
**Suggestion:** Add a shared helper such as `deferredFindingIdentity(entry, overrides = {})` near the deferred finding fixture utilities, then use it in `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js` and related R8/R6 defer tests.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R5  
**Issue:** Deferred finding identity projection is repeated across producer artifact and deferred acceptance tests, using the same fields: `findingId`, `sourceStep`, `sourceArtifact`, and `sourceFindingId`. Keeping this projection local to each file risks inconsistent expected identity shape as the deferred finding contract evolves.  
**Suggestion:** Add a shared helper such as `deferredFindingIdentity(entry, overrides = {})` near the deferred finding fixture utilities, then use it in `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js` and related R8/R6 defer tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 4. Align Spec-Correction Rewind Naming
**Finding key:** loop-683895ed295ea20ed506
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** The summaries point to related naming drift around spec-correction rewind behavior: `SPEC_CORRECTION_SUPPORTED_STAGES` in `plan-rewind.js`, raw `"spec-correction"` usage in `run-scenario-validity.js`, and error wording in `run-reopen-draft.js`. These files expose the same concept with slightly different names and levels of specificity.  
**Suggestion:** Define a shared constant set with explicit names, for example `SPEC_CORRECTION_REWIND_CATEGORY` and `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, and import them where needed so stage validation, skip logic, and error messages use the same vocabulary.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** The summaries point to related naming drift around spec-correction rewind behavior: `SPEC_CORRECTION_SUPPORTED_STAGES` in `plan-rewind.js`, raw `"spec-correction"` usage in `run-scenario-validity.js`, and error wording in `run-reopen-draft.js`. These files expose the same concept with slightly different names and levels of specificity.  
**Suggestion:** Define a shared constant set with explicit names, for example `SPEC_CORRECTION_REWIND_CATEGORY` and `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, and import them where needed so stage validation, skip logic, and error messages use the same vocabulary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 5. Use Role-Based Fixture Names Consistently
**Finding key:** loop-68ccea8b1dd7b708ba2b
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** Generic names like `fixture`, `blockingFixture`, and `acceptanceFixture` conflict with broader fixture naming across the acceptance migration tests, where a fixture may mean producer setup, review setup, or repository setup depending on the file. This makes cross-file test intent harder to follow.  
**Suggestion:** Adopt role-based names consistently across the acceptance/defer tests, such as `producerFixture`, `reviewFixture`, `migrationFixture`, and `repoFixture`, reserving disposition names like `blockingResult` for outputs.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** Generic names like `fixture`, `blockingFixture`, and `acceptanceFixture` conflict with broader fixture naming across the acceptance migration tests, where a fixture may mean producer setup, review setup, or repository setup depending on the file. This makes cross-file test intent harder to follow.  
**Suggestion:** Adopt role-based names consistently across the acceptance/defer tests, such as `producerFixture`, `reviewFixture`, `migrationFixture`, and `repoFixture`, reserving disposition names like `blockingResult` for outputs.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
