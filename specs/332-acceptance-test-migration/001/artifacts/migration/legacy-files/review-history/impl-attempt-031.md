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

### 16. 1. Add an explicit bound to recursive source traversal
**Finding key:** loop-c96c8f7bf7db118e2ccb
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth, file count, or directory count bound. This violates the `bounded-resource-usage` guardrail even though the current tree is likely small.  
**Suggestion:** Add explicit limits, for example `maxDepth`, `maxFiles`, and/or `maxDirectories`, and fail the test with a clear message if the traversal exceeds them.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth, file count, or directory count bound. This violates the `bounded-resource-usage` guardrail even though the current tree is likely small.  
**Suggestion:** Add explicit limits, for example `maxDepth`, `maxFiles`, and/or `maxDirectories`, and fail the test with a clear message if the traversal exceeds them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Avoid ad hoc export parsing with fragile regex helpers
**Finding key:** loop-8e715baab1cc875ae721
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `exportedNames()` manually parses JavaScript exports with regexes. This is brittle for multiline exports, comments, string literals, re-exports with `from`, and other valid syntax shapes.  
**Suggestion:** Prefer runtime module namespace inspection for known production modules where possible, or simplify the check to text-level compatibility name detection across bounded source files. If full export parsing is required, keep the helper narrowly named to reflect its limitations, such as `approximateExportedNames()`.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `exportedNames()` manually parses JavaScript exports with regexes. This is brittle for multiline exports, comments, string literals, re-exports with `from`, and other valid syntax shapes.  
**Suggestion:** Prefer runtime module namespace inspection for known production modules where possible, or simplify the check to text-level compatibility name detection across bounded source files. If full export parsing is required, keep the helper narrowly named to reflect its limitations, such as `approximateExportedNames()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Consolidate repeated fixture context construction
**Finding key:** loop-6817fcfcd7df7d4ba466
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat the same `acceptance.buildAcceptanceReviewContext({ root: fixture.root, state: fixture.state, diff: fixture.diff })` block.  
**Suggestion:** Add a local helper such as `buildFixtureAcceptanceContext(fixture)` and use it across the file. This reduces noise and makes future fixture input changes less error-prone.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat the same `acceptance.buildAcceptanceReviewContext({ root: fixture.root, state: fixture.state, diff: fixture.diff })` block.  
**Suggestion:** Add a local helper such as `buildFixtureAcceptanceContext(fixture)` and use it across the file. This reduces noise and makes future fixture input changes less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Consolidate deferred finding disposition construction
**Finding key:** loop-35c51357aed037c7dc15
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** Several tests repeat construction of `{ findingId, finalDisposition, evidenceRefs: [...] }` from a deferred finding.  
**Suggestion:** Add a helper like `deferredDisposition(finding, finalDisposition)` and use it in R2, R4, R5, R6, and R8.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** Several tests repeat construction of `{ findingId, finalDisposition, evidenceRefs: [...] }` from a deferred finding.  
**Suggestion:** Add a helper like `deferredDisposition(finding, finalDisposition)` and use it in R2, R4, R5, R6, and R8.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 5. Bound recursive migration artifact freshness checks
**Finding key:** loop-e28b346908ebd5a80e02
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself through `associatedPrimaryEvidencePath()` without an explicit depth or visited-set bound. This violates the `bounded-resource-usage` guardrail and could loop if associated evidence mappings become cyclic.  
**Suggestion:** Replace recursion with an iterative resolver that tracks visited paths and caps hops, or pass a `visited` set plus a small `maxDepth`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself through `associatedPrimaryEvidencePath()` without an explicit depth or visited-set bound. This violates the `bounded-resource-usage` guardrail and could loop if associated evidence mappings become cyclic.  
**Suggestion:** Replace recursion with an iterative resolver that tracks visited paths and caps hops, or pass a `visited` set plus a small `maxDepth`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 6. Simplify duplicate current-hash ledger checks
**Finding key:** loop-15ac424300d56f1ffca2
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** The expression `readImplRepairLedger(specDir)?.entries.at(-1)?.currentHash === currentFingerprint.hash` appears in `isFreshMigrationArtifact()`, while `hasCurrentRepairDelta()` performs a closely related latest-ledger-entry check with validation.  
**Suggestion:** Extract a helper such as `latestRepairLedgerEntryMatchesFingerprint(specDir, currentFingerprint, { validateDelta })` and reuse it in both places.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** The expression `readImplRepairLedger(specDir)?.entries.at(-1)?.currentHash === currentFingerprint.hash` appears in `isFreshMigrationArtifact()`, while `hasCurrentRepairDelta()` performs a closely related latest-ledger-entry check with validation.  
**Suggestion:** Extract a helper such as `latestRepairLedgerEntryMatchesFingerprint(specDir, currentFingerprint, { validateDelta })` and reuse it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 7. Rename `currentManifest` to reflect the new value semantics
**Finding key:** loop-feecb61ad90126b9b139
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `currentManifest` is now assigned from `observedCurrent = buildRepairFingerprint(...)`, but the name still suggests it is the migration input manifest. This makes `RepairMigrationEvidenceReplacement` harder to read because it uses `currentManifest.hash` and `currentManifest.entries` as current fingerprint evidence.  
**Suggestion:** Rename the parameter/property to `currentFingerprint` or `currentRepairFingerprint` throughout the touched code.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `currentManifest` is now assigned from `observedCurrent = buildRepairFingerprint(...)`, but the name still suggests it is the migration input manifest. This makes `RepairMigrationEvidenceReplacement` harder to read because it uses `currentManifest.hash` and `currentManifest.entries` as current fingerprint evidence.  
**Suggestion:** Rename the parameter/property to `currentFingerprint` or `currentRepairFingerprint` throughout the touched code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 8. Remove unused `failure` state from `MigrationEvidenceInspection`
**Finding key:** loop-b320e15f8b0c3fe936a8
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection.failure` is stored but never read by the new code. The warning is emitted immediately, so retaining the failure string adds object surface without current value.  
**Suggestion:** Either remove the `failure` property and return only `{ current }`, or use the failure value in callers. If no caller needs it, simplify the class accordingly.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection.failure` is stored but never read by the new code. The warning is emitted immediately, so retaining the failure string adds object surface without current value.  
**Suggestion:** Either remove the `failure` property and return only `{ current }`, or use the failure value in callers. If no caller needs it, simplify the class accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Clarify stage-set naming
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

### 25. 1. Validate resolver type before invocation
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

### 26. 2. Extract exhausted-attempt predicate
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

### 27. 1. Bound diff materialization before hashing
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

### 28. 2. Extract review target fingerprint construction
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

### 29. 3. Rename latest artifact variables for clarity
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

### 30. 4. Bound authoritative specification prompt size
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

### 31. 3. Preserve a specific unsupported-stage message
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

### 32. 1. Name the category check by intent
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

### 33. 2. Avoid repeating the `"spec-correction"` string literal
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

### 39. 2. Extract the complete empty spec fixture
**Finding key:** loop-707911b539d77c37710d
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The added empty spec shape is verbose fixture data embedded inline in `setupTaskGateRepository`. If other tests need the same current spec shape, this invites drift as required fields change.  
**Suggestion:** Extract a local helper such as `makeEmptyTaskGateSpec()` or a constant fixture near the other task-gate helpers, then spread/override `goal` where needed. This keeps required spec-field updates centralized within the touched test file.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The added empty spec shape is verbose fixture data embedded inline in `setupTaskGateRepository`. If other tests need the same current spec shape, this invites drift as required fields change.  
**Suggestion:** Extract a local helper such as `makeEmptyTaskGateSpec()` or a constant fixture near the other task-gate helpers, then spread/override `goal` where needed. This keeps required spec-field updates centralized within the touched test file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Add cleanup safety around per-stage temp dirs
**Finding key:** loop-54e6978c51d4e124c20f
**Failure mode:** refactor
**File:** tests/unit/flow/reopen-draft-spec-correction.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R7  
**Issue:** The new loop removes `tmp` only after all assertions pass. If any assertion fails, the temp dir remains and `tmp` still points at that iteration’s directory until the outer cleanup runs, which makes the test cleanup path less explicit.  
**Suggestion:** Wrap each iteration body in `try/finally` and call `removeTmpDir(tmp); tmp = null;` in the `finally` block.
**Suggestion:** **File:** `tests/unit/flow/reopen-draft-spec-correction.test.js`  
**Requirement:** R7  
**Issue:** The new loop removes `tmp` only after all assertions pass. If any assertion fails, the temp dir remains and `tmp` still points at that iteration’s directory until the outer cleanup runs, which makes the test cleanup path less explicit.  
**Suggestion:** Wrap each iteration body in `try/finally` and call `removeTmpDir(tmp); tmp = null;` in the `finally` block.
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

### 48. 1. Duplicate bounded traversal logic across production and test helpers
**Finding key:** loop-f6dfd6449f844acdd9e9
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`
**Requirement:** R9
**Issue:** Both `productionSourceFiles()` and `tests/helpers/acceptance-review-fixture.js` introduce recursive filesystem traversal concerns that need explicit depth/count bounds. Handling those limits separately risks inconsistent caps, error messages, and future drift.
**Suggestion:** Extract or reuse a shared bounded walker helper for test-side filesystem scans, then apply it to both source traversal and fixture test discovery.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`
**Requirement:** R9
**Issue:** Both `productionSourceFiles()` and `tests/helpers/acceptance-review-fixture.js` introduce recursive filesystem traversal concerns that need explicit depth/count bounds. Handling those limits separately risks inconsistent caps, error messages, and future drift.
**Suggestion:** Extract or reuse a shared bounded walker helper for test-side filesystem scans, then apply it to both source traversal and fixture test discovery.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 2. Inconsistent naming for synthetic review target identity
**Finding key:** loop-6de75fc6ec499e067386
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R3
**Issue:** `resolveCurrentReviewTreeSha()` can now return a synthetic tree-plus-diff fingerprint, while related review/gate files still use names like `treeSha`, `artifact`, and `latestArtifact` ambiguously. Across files, “SHA” and “artifact” no longer consistently describe whether the value is a Git tree SHA, a synthetic fingerprint, raw JSON, or a parsed domain object.
**Suggestion:** Rename the exported review identity API and related variables toward explicit terms such as `reviewTargetFingerprint`, `rawArtifact`, and `gateArtifact`, then update call sites consistently.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R3
**Issue:** `resolveCurrentReviewTreeSha()` can now return a synthetic tree-plus-diff fingerprint, while related review/gate files still use names like `treeSha`, `artifact`, and `latestArtifact` ambiguously. Across files, “SHA” and “artifact” no longer consistently describe whether the value is a Git tree SHA, a synthetic fingerprint, raw JSON, or a parsed domain object.
**Suggestion:** Rename the exported review identity API and related variables toward explicit terms such as `reviewTargetFingerprint`, `rawArtifact`, and `gateArtifact`, then update call sites consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 3. Repeated deferred finding/disposition fixture construction
**Finding key:** loop-0799b0b7f3ebd1d6729d
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`
**Requirement:** R9
**Issue:** Deferred finding identity and disposition objects are being constructed repeatedly across `specs/295`, `specs/296`, `specs/310`, and `specs/332`. The repeated shapes include `findingId`, `sourceStep`, `sourceArtifact`, `sourceFindingId`, `finalDisposition`, and `evidenceRefs`, which makes the artifact contract easy to update inconsistently.
**Suggestion:** Add shared test helpers for deferred finding identity and disposition construction, then use them across the acceptance, producer, retry exhaustion, and migration tests.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`
**Requirement:** R9
**Issue:** Deferred finding identity and disposition objects are being constructed repeatedly across `specs/295`, `specs/296`, `specs/310`, and `specs/332`. The repeated shapes include `findingId`, `sourceStep`, `sourceArtifact`, `sourceFindingId`, `finalDisposition`, and `evidenceRefs`, which makes the artifact contract easy to update inconsistently.
**Suggestion:** Add shared test helpers for deferred finding identity and disposition construction, then use them across the acceptance, producer, retry exhaustion, and migration tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 4. Inconsistent fixture naming for producer vs acceptance review roles
**Finding key:** loop-6d080fde61422a48178e
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** Several files use generic names such as `fixture`, `producerFixture`, `acceptanceFixture`, `reviewFixture`, and `blockingFixture` for related but distinct fixture roles. Cross-file naming is inconsistent enough that it obscures whether a test is producing deferred findings or consuming them in acceptance review.
**Suggestion:** Standardize on role-based names across these tests, for example `producerFixture` for artifact-producing setup and `reviewFixture` for acceptance-review execution setup.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`
**Requirement:** R8
**Issue:** Several files use generic names such as `fixture`, `producerFixture`, `acceptanceFixture`, `reviewFixture`, and `blockingFixture` for related but distinct fixture roles. Cross-file naming is inconsistent enough that it obscures whether a test is producing deferred findings or consuming them in acceptance review.
**Suggestion:** Standardize on role-based names across these tests, for example `producerFixture` for artifact-producing setup and `reviewFixture` for acceptance-review execution setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 5. Duplicate acceptance review fixture execution wrappers
**Finding key:** loop-ef18c2ea5cc763285fdc
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`
**Requirement:** R6
**Issue:** `runAcceptanceReviewFixture` argument blocks are duplicated in both `specs/296` and `specs/310`, with the same common fields and only small variations in dispositions, persistence, or apply behavior.
**Suggestion:** Introduce a reusable helper in the shared acceptance fixture utilities, such as `runAcceptanceReviewFixtureWithDefaults(fixture, overrides)`, and replace local copies where the defaults match.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`
**Requirement:** R6
**Issue:** `runAcceptanceReviewFixture` argument blocks are duplicated in both `specs/296` and `specs/310`, with the same common fields and only small variations in dispositions, persistence, or apply behavior.
**Suggestion:** Introduce a reusable helper in the shared acceptance fixture utilities, such as `runAcceptanceReviewFixtureWithDefaults(fixture, overrides)`, and replace local copies where the defaults match.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
