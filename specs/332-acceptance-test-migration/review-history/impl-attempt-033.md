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

### 6. 1. Remove now-unused local import
**Finding key:** loop-1b83c2822a85d9a728d3
**Failure mode:** refactor
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R9
**Issue:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R9  
**Issue:** `resolveRetryExhaustionForFlowStep` is still loaded inside `"R6: exhausted semantic findings..."`, but its assertions were moved to the new dedicated test. The local binding is now dead code.  
**Suggestion:** Delete the unused `const resolveRetryExhaustionForFlowStep = requireExport(...)` line from that test.
**Suggestion:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R9  
**Issue:** `resolveRetryExhaustionForFlowStep` is still loaded inside `"R6: exhausted semantic findings..."`, but its assertions were moved to the new dedicated test. The local binding is now dead code.  
**Suggestion:** Delete the unused `const resolveRetryExhaustionForFlowStep = requireExport(...)` line from that test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Extract deferred-finding identity mapping
**Finding key:** loop-26b4f76c1d158630a09f
**Failure mode:** refactor
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R5
**Issue:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The same projection of `artifact.entries` into `{ findingId, sourceStep, sourceArtifact, sourceFindingId }` is duplicated when creating the acceptance fixture and when building the expected assertion payload.  
**Suggestion:** Add a small helper such as `deferredFindingIdentity(entry)` and reuse it in both places. This keeps the aggregation contract assertion easier to read and less brittle.
**Suggestion:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The same projection of `artifact.entries` into `{ findingId, sourceStep, sourceArtifact, sourceFindingId }` is duplicated when creating the acceptance fixture and when building the expected assertion payload.  
**Suggestion:** Add a small helper such as `deferredFindingIdentity(entry)` and reuse it in both places. This keeps the aggregation contract assertion easier to read and less brittle.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Reuse `writeRetrySource` consistently
**Finding key:** loop-4e3de56270a30a417948
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The file defines `writeRetrySource`, but the single-surface review and gate tests still inline `fs.writeFileSync(path.join(...), JSON.stringify(...))`.  
**Suggestion:** Replace those inline writes with `writeRetrySource(fixture.specDir, "...json", artifact)`. This matches the later table-driven tests and removes duplicate serialization boilerplate.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The file defines `writeRetrySource`, but the single-surface review and gate tests still inline `fs.writeFileSync(path.join(...), JSON.stringify(...))`.  
**Suggestion:** Replace those inline writes with `writeRetrySource(fixture.specDir, "...json", artifact)`. This matches the later table-driven tests and removes duplicate serialization boilerplate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Extract common acceptance-review runner arguments
**Finding key:** loop-7c1c5b5a01eb98dc555e
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Many tests repeat the same `runAcceptanceReviewFixture` argument block: `root`, `state`, `diff`, and `requirementJudgments`, with only dispositions or persistence options changing.  
**Suggestion:** Add a helper like `runFixtureAcceptance(fixture, overrides = {})` that fills the common fields and spreads overrides. This would simplify the acceptance routing and persistence tests without weakening assertions.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Many tests repeat the same `runAcceptanceReviewFixture` argument block: `root`, `state`, `diff`, and `requirementJudgments`, with only dispositions or persistence options changing.  
**Suggestion:** Add a helper like `runFixtureAcceptance(fixture, overrides = {})` that fills the common fields and spreads overrides. This would simplify the acceptance routing and persistence tests without weakening assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 5. Extract invalid `FlowFinding` fixture data
**Finding key:** loop-dc4de9f86bb8b138f193
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The two `new FlowFinding({...})` negative tests duplicate most required fields, differing only in the invalid field under test.  
**Suggestion:** Add a helper such as `flowFindingData(overrides)` and use `new FlowFinding(flowFindingData({ sourceArtifact: "../outside.json" }))` / `flowFindingData({ finalDisposition: "unsupported" })`. This makes each schema-boundary test emphasize the specific invariant being tested.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The two `new FlowFinding({...})` negative tests duplicate most required fields, differing only in the invalid field under test.  
**Suggestion:** Add a helper such as `flowFindingData(overrides)` and use `new FlowFinding(flowFindingData({ sourceArtifact: "../outside.json" }))` / `flowFindingData({ finalDisposition: "unsupported" })`. This makes each schema-boundary test emphasize the specific invariant being tested.
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

### 24. 1. Bound diff materialization before hashing
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

### 25. 2. Extract review target fingerprint construction
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

### 26. 3. Rename latest artifact variables for clarity
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

### 27. 4. Bound authoritative specification prompt size
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

### 39. 2. Avoid overly broad prompt regex matching
**Finding key:** loop-419d969e8b5225dac61b
**Failure mode:** refactor
**File:** tests/unit/flow/gate-noop-rerun-guard.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/gate-noop-rerun-guard.test.js`  
**Requirement:** R5  
**Issue:** `/MUST:[\s\S]*full-regression-deferred[\s\S]*final-regression/i` can match across unrelated prompt sections, so the test may pass even if the required relationship is not in the same MUST item.  
**Suggestion:** Narrow the assertion to a single bullet/paragraph, or extract the relevant MUST block first and assert that it contains both `full-regression-deferred` and `final-regression`.
**Suggestion:** **File:** `tests/unit/flow/gate-noop-rerun-guard.test.js`  
**Requirement:** R5  
**Issue:** `/MUST:[\s\S]*full-regression-deferred[\s\S]*final-regression/i` can match across unrelated prompt sections, so the test may pass even if the required relationship is not in the same MUST item.  
**Suggestion:** Narrow the assertion to a single bullet/paragraph, or extract the relevant MUST block first and assert that it contains both `full-regression-deferred` and `final-regression`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Ensure temp directories are cleaned up on assertion failure
**Finding key:** loop-e1423210352bc54a9b68
**Failure mode:** refactor
**File:** tests/unit/flow/reopen-draft-spec-correction.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R5  
**Issue:** The new loop calls `removeTmpDir(tmp)` only after all assertions pass. If any assertion fails before cleanup, the current temp directory can be left behind unless another hook handles it.  
**Suggestion:** Wrap each loop body in `try/finally` and clear `tmp` in the `finally` block after `removeTmpDir(tmp)`.
**Suggestion:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R5  
**Issue:** The new loop calls `removeTmpDir(tmp)` only after all assertions pass. If any assertion fails before cleanup, the current temp directory can be left behind unless another hook handles it.  
**Suggestion:** Wrap each loop body in `try/finally` and clear `tmp` in the `finally` block after `removeTmpDir(tmp)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Extract Repeated Step Status Setup
**Finding key:** loop-60293b05a0932518a170
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Several tests repeat direct mutation of `state.steps[0]` and `state.steps[1]` to simulate completed test execution and review in progress. This makes the scenario setup index-dependent and a little brittle.  
**Suggestion:** Add a small helper such as `markTestExecutionComplete(state)` or `setStepStatus(state, id, status)` and use step IDs instead of positional indexes.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Several tests repeat direct mutation of `state.steps[0]` and `state.steps[1]` to simulate completed test execution and review in progress. This makes the scenario setup index-dependent and a little brittle.  
**Suggestion:** Add a small helper such as `markTestExecutionComplete(state)` or `setStepStatus(state, id, status)` and use step IDs instead of positional indexes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Name Migration Helper By Observable Test State
**Finding key:** loop-4830debc7c5f6bfbc933
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2` describes the internal setup, but it also executes `RunGateCommand` and returns a post-recovery state. The name does not make that side effect obvious.  
**Suggestion:** Rename it to something like `recoverBaselineBearingLegacyV2()` or `runLegacyV2Recovery()` so tests read closer to the behavior being prepared.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2` describes the internal setup, but it also executes `RunGateCommand` and returns a post-recovery state. The name does not make that side effect obvious.  
**Suggestion:** Rename it to something like `recoverBaselineBearingLegacyV2()` or `runLegacyV2Recovery()` so tests read closer to the behavior being prepared.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 3. Avoid Duplicated Contract Invocation Blocks
**Finding key:** loop-cf3bd844b7922d15f1a0
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Multiple tests call `ensureRepairFingerprintContract` with the same `{ root: tmp, state, flowManager, continueAfterMigration: true }` shape.  
**Suggestion:** Extract a helper such as `continueAfterRetainedMigration(state, flowManager)` to reduce repetition and make the intent of those assertions clearer.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** Multiple tests call `ensureRepairFingerprintContract` with the same `{ root: tmp, state, flowManager, continueAfterMigration: true }` shape.  
**Suggestion:** Extract a helper such as `continueAfterRetainedMigration(state, flowManager)` to reduce repetition and make the intent of those assertions clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 4. Replace Raw Git Test Setup With Local Helper
**Finding key:** loop-67b34f10133422690dd9
**Failure mode:** refactor
**File:** tests/unit/flow/review-evidence-tree.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/review-evidence-tree.test.js`  
**Requirement:** R3  
**Issue:** The test embeds repeated git repository initialization details inline: `git init`, config, add, commit. Similar setup is likely needed by future review evidence tree tests.  
**Suggestion:** Extract `initGitRepository()` and possibly `commitFile(name, contents, message)` within this file to keep the test focused on tree SHA behavior.
**Suggestion:** **File:** `tests/unit/flow/review-evidence-tree.test.js`  
**Requirement:** R3  
**Issue:** The test embeds repeated git repository initialization details inline: `git init`, config, add, commit. Similar setup is likely needed by future review evidence tree tests.  
**Suggestion:** Extract `initGitRepository()` and possibly `commitFile(name, contents, message)` within this file to keep the test focused on tree SHA behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 5. Split Multi-Behavior Test Case
**Finding key:** loop-5799b2250ca154714862
**Failure mode:** refactor
**File:** tests/unit/flow/review-evidence-tree.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/review-evidence-tree.test.js`  
**Requirement:** R4  
**Issue:** The single test covers three behaviors: clean tree SHA, unstaged tracked changes, and staged tracked changes. This is compact, but the assertion failure location will be less diagnostic.  
**Suggestion:** Split into separate `it` blocks or use subtests for clean, unstaged, and staged states while sharing setup helpers. This improves failure readability without changing coverage.
**Suggestion:** **File:** `tests/unit/flow/review-evidence-tree.test.js`  
**Requirement:** R4  
**Issue:** The single test covers three behaviors: clean tree SHA, unstaged tracked changes, and staged tracked changes. This is compact, but the assertion failure location will be less diagnostic.  
**Suggestion:** Split into separate `it` blocks or use subtests for clean, unstaged, and staged states while sharing setup helpers. This improves failure readability without changing coverage.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 1. Cover the “latest rewind” behavior explicitly
**Finding key:** loop-09274023b38a26e64eff
**Failure mode:** refactor
**File:** tests/unit/flow/run-scenario-validity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/run-scenario-validity.test.js`  
**Requirement:** R1  
**Issue:** The test name says the bypass applies “only for the latest spec-correction rewind,” but the test only covers `[]` and `[{ category: "spec-correction" }]`. It does not prove that an older `spec-correction` followed by another rewind category is blocked.  
**Suggestion:** Add a negative assertion such as `context([{ category: "spec-correction" }, { category: "implementation" }])` or whatever non-spec-correction category is valid, and assert it still raises `SCENARIO_VALIDITY_BLOCKED`.
**Suggestion:** **File:** `tests/unit/flow/run-scenario-validity.test.js`  
**Requirement:** R1  
**Issue:** The test name says the bypass applies “only for the latest spec-correction rewind,” but the test only covers `[]` and `[{ category: "spec-correction" }]`. It does not prove that an older `spec-correction` followed by another rewind category is blocked.  
**Suggestion:** Add a negative assertion such as `context([{ category: "spec-correction" }, { category: "implementation" }])` or whatever non-spec-correction category is valid, and assert it still raises `SCENARIO_VALIDITY_BLOCKED`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 2. Extract repeated artifact path construction
**Finding key:** loop-3350a5729410d4aa9398
**Failure mode:** refactor
**File:** tests/unit/flow/run-scenario-validity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/run-scenario-validity.test.js`  
**Requirement:** R1  
**Issue:** The test derives `specDir` and later manually builds the scenario validity result path inline. As this fixture grows, repeated `path.join(specDir, ...)` calls make the scenario harder to scan.  
**Suggestion:** Introduce a named constant near `specDir`, for example `const resultPath = path.join(specDir, "scenario-validity-result.json");`, and use it in the read assertion.
**Suggestion:** **File:** `tests/unit/flow/run-scenario-validity.test.js`  
**Requirement:** R1  
**Issue:** The test derives `specDir` and later manually builds the scenario validity result path inline. As this fixture grows, repeated `path.join(specDir, ...)` calls make the scenario harder to scan.  
**Suggestion:** Introduce a named constant near `specDir`, for example `const resultPath = path.join(specDir, "scenario-validity-result.json");`, and use it in the read assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 1. Standardize Acceptance Review Fixture Helpers
**Finding key:** loop-a431e39b1c03450400d9
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple test files independently propose local wrappers around `runAcceptanceReviewFixture` and acceptance artifact writing. This suggests the shared fixture API is too verbose across files, and local helper names may diverge.  
**Suggestion:** Add shared helper methods in `tests/helpers/acceptance-review-fixture.js` for common acceptance execution and artifact writing defaults, then update the affected specs to use the shared API instead of per-file wrappers.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple test files independently propose local wrappers around `runAcceptanceReviewFixture` and acceptance artifact writing. This suggests the shared fixture API is too verbose across files, and local helper names may diverge.  
**Suggestion:** Add shared helper methods in `tests/helpers/acceptance-review-fixture.js` for common acceptance execution and artifact writing defaults, then update the affected specs to use the shared API instead of per-file wrappers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 2. Centralize Repair Fingerprint Test Setup
**Finding key:** loop-9883f06e0a785897d910
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R3
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R3  
**Issue:** Several files repeat repair fingerprint setup or contract invocation patterns, including dynamic `buildRepairFingerprint` calls and repeated `ensureRepairFingerprintContract` argument blocks. This creates inconsistent naming and setup style around the same migration contract.  
**Suggestion:** Introduce shared test helpers for building fixture repair fingerprints and continuing after retained migration, with names based on observable behavior rather than internal migration details.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R3  
**Issue:** Several files repeat repair fingerprint setup or contract invocation patterns, including dynamic `buildRepairFingerprint` calls and repeated `ensureRepairFingerprintContract` argument blocks. This creates inconsistent naming and setup style around the same migration contract.  
**Suggestion:** Introduce shared test helpers for building fixture repair fingerprints and continuing after retained migration, with names based on observable behavior rather than internal migration details.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 3. Use Consistent Raw vs Parsed Artifact Naming
**Finding key:** loop-cfe505f29100d9f06051
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** Review summaries flag ambiguous “artifact” naming in both production and tests, where “artifact” sometimes means raw JSON and sometimes a parsed domain object. This cross-file ambiguity makes interface expectations harder to follow.  
**Suggestion:** Adopt a consistent convention such as `rawArtifact` for JSON payloads and domain-specific names like `gateArtifact` or `reviewArtifact` for parsed objects, then apply it across production code and fixtures.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** Review summaries flag ambiguous “artifact” naming in both production and tests, where “artifact” sometimes means raw JSON and sometimes a parsed domain object. This cross-file ambiguity makes interface expectations harder to follow.  
**Suggestion:** Adopt a consistent convention such as `rawArtifact` for JSON payloads and domain-specific names like `gateArtifact` or `reviewArtifact` for parsed objects, then apply it across production code and fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 4. Share Flow Finding Fixture Builders
**Finding key:** loop-2d3014de6b9042589fa3
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R5
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R5  
**Issue:** Multiple files duplicate deferred or flow finding identity and schema fixture data, including repeated `FlowFinding` required fields and repeated identity projections from artifact entries.  
**Suggestion:** Add shared fixture builders such as `flowFindingData(overrides)` and `deferredFindingIdentity(entry)` in the relevant test helper module so schema-boundary and aggregation tests use the same contract shape.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R5  
**Issue:** Multiple files duplicate deferred or flow finding identity and schema fixture data, including repeated `FlowFinding` required fields and repeated identity projections from artifact entries.  
**Suggestion:** Add shared fixture builders such as `flowFindingData(overrides)` and `deferredFindingIdentity(entry)` in the relevant test helper module so schema-boundary and aggregation tests use the same contract shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 5. Align Bounded Resource Guardrails
**Finding key:** loop-a75f9094ba6cab5953eb
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** Several independent proposals identify unbounded operations: recursive source traversal, recursive associated evidence resolution, full diff materialization, and prompt expansion. These are the same cross-cutting bounded-resource concern handled inconsistently across files.  
**Suggestion:** Define shared limits or local constants with consistent naming for max depth, max files, max bytes, and max hops. Apply deterministic failure behavior where limits are exceeded.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** Several independent proposals identify unbounded operations: recursive source traversal, recursive associated evidence resolution, full diff materialization, and prompt expansion. These are the same cross-cutting bounded-resource concern handled inconsistently across files.  
**Suggestion:** Define shared limits or local constants with consistent naming for max depth, max files, max bytes, and max hops. Apply deterministic failure behavior where limits are exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
