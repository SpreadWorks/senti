# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 6. Split Dual-Scenario Missing Test Coverage
**Finding key:** loop-f111d8cb3a2d47abe7ea
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R3
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The `R8` test creates two fixtures and verifies both `missing_required_tests` and `missing_tests` in one body. This makes cleanup and failure diagnosis more complex than necessary.  
**Suggestion:** Split it into two focused tests, one for missing required tests and one for missing test evidence, or introduce a small helper to run each scenario independently.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The `R8` test creates two fixtures and verifies both `missing_required_tests` and `missing_tests` in one body. This makes cleanup and failure diagnosis more complex than necessary.  
**Suggestion:** Split it into two focused tests, one for missing required tests and one for missing test evidence, or introduce a small helper to run each scenario independently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Extract Repeated Repair Fingerprint Setup
**Finding key:** loop-55447a271de56dca3ab1
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R1
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R1  
**Issue:** The same dynamic import and `buildRepairFingerprint` setup is duplicated in multiple tests with identical arguments. This adds noise and makes future fixture changes easier to miss.  
**Suggestion:** Add a local helper such as `async function makeRepairFingerprint()` or extend the existing fixture path used in this file, then reuse it in the affected tests.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R1  
**Issue:** The same dynamic import and `buildRepairFingerprint` setup is duplicated in multiple tests with identical arguments. This adds noise and makes future fixture changes easier to miss.  
**Suggestion:** Add a local helper such as `async function makeRepairFingerprint()` or extend the existing fixture path used in this file, then reuse it in the affected tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Avoid Hidden Schema Mutation In Generic JSON Writer
**Finding key:** loop-a544e0dd6d078a9785d8
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R4
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** `writeJsonFile()` now silently rewrites `flow-findings.json` payloads by forcing `version`, `fingerprint`, `disposition`, and `rationale`. A generic writer with filename-specific mutation makes tests harder to reason about and can mask cases that intended to verify malformed or legacy payload behavior.  
**Suggestion:** Move that logic into a dedicated helper like `writeFlowFindingsFile(specDir, entries, overrides)` and keep `writeJsonFile()` as a plain serializer.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** `writeJsonFile()` now silently rewrites `flow-findings.json` payloads by forcing `version`, `fingerprint`, `disposition`, and `rationale`. A generic writer with filename-specific mutation makes tests harder to reason about and can mask cases that intended to verify malformed or legacy payload behavior.  
**Suggestion:** Move that logic into a dedicated helper like `writeFlowFindingsFile(specDir, entries, overrides)` and keep `writeJsonFile()` as a plain serializer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Remove Redundant Steps Assignment
**Finding key:** loop-802d0003d63ec5fcec00
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R9
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** `baseFlowState()` assigns `steps` inside the returned object and again after spreading `...rest`. This is intentional override protection, but the duplicated property makes the object construction less clear.  
**Suggestion:** Build the returned state in two steps or omit `steps` from `rest` explicitly once, then return a single `steps` property.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** `baseFlowState()` assigns `steps` inside the returned object and again after spreading `...rest`. This is intentional override protection, but the duplicated property makes the object construction less clear.  
**Suggestion:** Build the returned state in two steps or omit `steps` from `rest` explicitly once, then return a single `steps` property.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 4. Rename Legacy Test Title
**Finding key:** loop-347ba872568ff4679829
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R4
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The test named `R6: non-pass acceptance-review requires allowlisted nextAction and targetStep` no longer tests `nextAction` or `targetStep` allowlists after the migration. It now verifies derived verdict validation for unmet requirement judgments.  
**Suggestion:** Rename the test to match current behavior, for example `R6: non-pass acceptance-review rejects overridden derived pass verdict`.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The test named `R6: non-pass acceptance-review requires allowlisted nextAction and targetStep` no longer tests `nextAction` or `targetStep` allowlists after the migration. It now verifies derived verdict validation for unmet requirement judgments.  
**Suggestion:** Rename the test to match current behavior, for example `R6: non-pass acceptance-review rejects overridden derived pass verdict`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 5. Consolidate Acceptance Fixture Execution Boilerplate
**Finding key:** loop-ccf2a0ee8b6cfb02e1dc
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R9
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** Several tests repeat the same `createAcceptanceReviewFixture()` plus `try/finally cleanup()` plus `runAcceptanceReviewFixture({ root, state, diff, requirementJudgments })` pattern.  
**Suggestion:** Add a small local helper such as `async function withAcceptanceFixture(options, fn)` or `runDefaultAcceptanceFixture(fixture, overrides)` to reduce duplication while preserving explicit assertions.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** Several tests repeat the same `createAcceptanceReviewFixture()` plus `try/finally cleanup()` plus `runAcceptanceReviewFixture({ root, state, diff, requirementJudgments })` pattern.  
**Suggestion:** Add a small local helper such as `async function withAcceptanceFixture(options, fn)` or `runDefaultAcceptanceFixture(fixture, overrides)` to reduce duplication while preserving explicit assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Extract Retry Exhaustion Resolution Assertion
**Finding key:** loop-6554441d1738652ed2c0
**Failure mode:** refactor
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R9
**Issue:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R9  
**Issue:** The new retry exhaustion handoff test hardcodes the full expected instruction object inline. If similar assertions return in this file, the expected contract will be duplicated and harder to update consistently.  
**Suggestion:** Add a local helper such as `assertPureRetryExhaustionInstruction(resolution, sourceArtifact)` or a small `expectedRetryExhaustionInstruction(sourceArtifact)` factory and use it in the test.
**Suggestion:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R9  
**Issue:** The new retry exhaustion handoff test hardcodes the full expected instruction object inline. If similar assertions return in this file, the expected contract will be duplicated and harder to update consistently.  
**Suggestion:** Add a local helper such as `assertPureRetryExhaustionInstruction(resolution, sourceArtifact)` or a small `expectedRetryExhaustionInstruction(sourceArtifact)` factory and use it in the test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Extract FlowFinding Invalid Fixture Data
**Finding key:** loop-d300079d0be4e8dcaecc
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The two `new FlowFinding({...})` assertions duplicate most of the same required fields, making future schema changes noisy and increasing the chance that the two negative tests drift accidentally.  
**Suggestion:** Add a local helper such as `flowFindingData(overrides = {})` that returns the valid baseline object, then override only `sourceArtifact` or `finalDisposition` in each assertion.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The two `new FlowFinding({...})` assertions duplicate most of the same required fields, making future schema changes noisy and increasing the chance that the two negative tests drift accidentally.  
**Suggestion:** Add a local helper such as `flowFindingData(overrides = {})` that returns the valid baseline object, then override only `sourceArtifact` or `finalDisposition` in each assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Reuse Acceptance Review Run Arguments
**Finding key:** loop-b9a6ab1f5edcecef0ba8
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Multiple tests repeat the same `runAcceptanceReviewFixture` argument shape: `root`, `state`, `diff`, `requirementJudgments`, plus optional `deferredFindingDispositions`.  
**Suggestion:** Add a small local helper, for example `runFixtureAcceptance(fixture, options = {})`, that supplies the common fields and spreads the options. This would reduce duplication and keep the fixture usage consistent.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** Multiple tests repeat the same `runAcceptanceReviewFixture` argument shape: `root`, `state`, `diff`, `requirementJudgments`, plus optional `deferredFindingDispositions`.  
**Suggestion:** Add a small local helper, for example `runFixtureAcceptance(fixture, options = {})`, that supplies the common fields and spreads the options. This would reduce duplication and keep the fixture usage consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Rename `withFixture` for Domain Clarity
**Finding key:** loop-15ac930c583df5b6b167
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** `withFixture` is generic, but the fixture is specifically an acceptance-review fixture. In a regression file that imports multiple flow concepts, the name hides useful intent.  
**Suggestion:** Rename it to `withAcceptanceFixture` or `withAcceptanceReviewFixture` so call sites clearly indicate which fixture lifecycle is being managed.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** `withFixture` is generic, but the fixture is specifically an acceptance-review fixture. In a regression file that imports multiple flow concepts, the name hides useful intent.  
**Suggestion:** Rename it to `withAcceptanceFixture` or `withAcceptanceReviewFixture` so call sites clearly indicate which fixture lifecycle is being managed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Extract repeated feature-branch no-tests setup
**Finding key:** loop-66801d043bfc00f9b429
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R9
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R9  
**Issue:** The R3 cases repeatedly perform `writeSpec(tmp)`, `commitAll(tmp)`, `checkoutFeature(tmp)`, and `writeNoTestsArtifacts(specDir, { root: tmp, review: false })`. The repeated setup obscures what each malformed-artifact case is actually testing.  
**Suggestion:** Add a helper like `prepareNoTestsReviewFixture(tmp, options = {})` that returns `specDir` after committing, checking out the feature branch, and writing the fingerprinted no-tests artifacts.
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R9  
**Issue:** The R3 cases repeatedly perform `writeSpec(tmp)`, `commitAll(tmp)`, `checkoutFeature(tmp)`, and `writeNoTestsArtifacts(specDir, { root: tmp, review: false })`. The repeated setup obscures what each malformed-artifact case is actually testing.  
**Suggestion:** Add a helper like `prepareNoTestsReviewFixture(tmp, options = {})` that returns `specDir` after committing, checking out the feature branch, and writing the fingerprinted no-tests artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Remove redundant `nextAction` override in validation assertion
**Finding key:** loop-f798e606db3605f65493
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R7
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** `validateFinalRegressionResult({ ...skippedByProjectPolicyArtifact(), nextAction: "report" })` overrides `nextAction` to the same value already returned by `skippedByProjectPolicyArtifact()`. This makes the assertion look like it is testing a special case when it is not.  
**Suggestion:** Replace it with `validateFinalRegressionResult(skippedByProjectPolicyArtifact())`.
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** `validateFinalRegressionResult({ ...skippedByProjectPolicyArtifact(), nextAction: "report" })` overrides `nextAction` to the same value already returned by `skippedByProjectPolicyArtifact()`. This makes the assertion look like it is testing a special case when it is not.  
**Suggestion:** Replace it with `validateFinalRegressionResult(skippedByProjectPolicyArtifact())`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Extract repeated acceptance fixture execution setup
**Finding key:** loop-e0d299907934e8dc0024
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** Several R8 tests repeat the same `runAcceptanceReviewFixture` argument bundle: `root`, `state`, `diff`, `requirementJudgments`, and sometimes `flowManager`. This makes the tests noisy and increases maintenance risk if the fixture API changes.  
**Suggestion:** Add a small spec-local helper such as `runAcceptanceFixture(fixture, overrides = {})` that fills the common fields and spreads overrides for `deferredFindingDispositions`, `apply`, and `flowManager`.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** Several R8 tests repeat the same `runAcceptanceReviewFixture` argument bundle: `root`, `state`, `diff`, `requirementJudgments`, and sometimes `flowManager`. This makes the tests noisy and increases maintenance risk if the fixture API changes.  
**Suggestion:** Add a small spec-local helper such as `runAcceptanceFixture(fixture, overrides = {})` that fills the common fields and spreads overrides for `deferredFindingDispositions`, `apply`, and `flowManager`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Remove unused deferred finding entry
**Finding key:** loop-946ae32f794113e84a4c
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** In `R8: unresolved deferred findings route acceptance-review to user decision`, `const [entry] = readFlowFindingsArtifact(...).toJSON().entries;` is no longer used after switching to `acceptanceFixture.dispositionJudgments(...)`.  
**Suggestion:** Remove the unused `entry` read, or assert it explicitly if the test still needs to prove the producer path created a finding.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** In `R8: unresolved deferred findings route acceptance-review to user decision`, `const [entry] = readFlowFindingsArtifact(...).toJSON().entries;` is no longer used after switching to `acceptanceFixture.dispositionJudgments(...)`.  
**Suggestion:** Remove the unused `entry` read, or assert it explicitly if the test still needs to prove the producer path created a finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Consolidate Cached Command Execution
**Finding key:** loop-fe4fcd77d38227acbaf8
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `executeHistoricalFile()` and `executeProjectRegression()` duplicate the same cache/spawn/environment pattern with only args, timeout, and buffer differing.  
**Suggestion:** Extract a shared `executeCached(cacheKey, args, options)` helper and have both functions delegate to it. This keeps timeout/buffer differences explicit while removing repeated spawn setup.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `executeHistoricalFile()` and `executeProjectRegression()` duplicate the same cache/spawn/environment pattern with only args, timeout, and buffer differing.  
**Suggestion:** Extract a shared `executeCached(cacheKey, args, options)` helper and have both functions delegate to it. This keeps timeout/buffer differences explicit while removing repeated spawn setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Add an Explicit Bound to Recursive Source Discovery
**Finding key:** loop-f1f46ea8fe2f008a71db
**Failure mode:** refactor
**File:** specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth or file-count bound, which violates the `bounded-resource-usage` guardrail even though the current repository is expected to be small.  
**Suggestion:** Add conservative limits such as `maxDepth` and `maxFiles`, pass depth through recursion, and throw a clear assertion error if the bounds are exceeded.
**Suggestion:** **File:** `specs/332-acceptance-test-migration/tests/acceptance-test-migration.test.js`  
**Requirement:** R9  
**Issue:** `productionSourceFiles()` recursively walks `src/` without an explicit depth or file-count bound, which violates the `bounded-resource-usage` guardrail even though the current repository is expected to be small.  
**Suggestion:** Add conservative limits such as `maxDepth` and `maxFiles`, pass depth through recursion, and throw a clear assertion error if the bounds are exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Bound or Remove Recursive Evidence Freshness Resolution
**Finding key:** loop-3fbf8fa59a8e33da2ae0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself through `associatedPrimaryEvidencePath()`. If associated evidence mappings ever become cyclic or unexpectedly chained, the recursion has no explicit bound, violating `bounded-resource-usage`.  
**Suggestion:** Replace recursion with a bounded loop using a `visited` set, or pass a small `remainingDepth` counter and fail closed when exceeded.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself through `associatedPrimaryEvidencePath()`. If associated evidence mappings ever become cyclic or unexpectedly chained, the recursion has no explicit bound, violating `bounded-resource-usage`.  
**Suggestion:** Replace recursion with a bounded loop using a `visited` set, or pass a small `remainingDepth` counter and fail closed when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 4. Remove Unused Inspection Failure State
**Finding key:** loop-5b25300d0ee3868d7f57
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection` stores `failure`, but callers only read `.current`; the failure is already emitted via `process.emitWarning()`. This extra property adds state without behavior.  
**Suggestion:** Remove the `failure` field from the class, or use it in callers if later logic needs structured diagnostics. For the current code, the simpler boolean result object is enough.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `MigrationEvidenceInspection` stores `failure`, but callers only read `.current`; the failure is already emitted via `process.emitWarning()`. This extra property adds state without behavior.  
**Suggestion:** Remove the `failure` field from the class, or use it in callers if later logic needs structured diagnostics. For the current code, the simpler boolean result object is enough.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 5. Extract Migration Evidence Entry Construction
**Finding key:** loop-2df04f1b1daf1503481a
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `RepairMigrationEvidenceReplacement.replace()` mixes validation, previous-hash selection, delta creation, ledger-entry construction, and file writes in one long method. The construction logic duplicates concepts already expressed by `RepairDeltaArtifact` and `ImplRepairEntry` setup elsewhere.  
**Suggestion:** Extract small helpers such as `migrationPreviousHash()` and `buildMigrationRepairEntry({ migration, currentManifest, delta, invalidations })`. This keeps `replace()` focused on transaction behavior and makes the fingerprint-selection rules easier to review.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R10  
**Issue:** `RepairMigrationEvidenceReplacement.replace()` mixes validation, previous-hash selection, delta creation, ledger-entry construction, and file writes in one long method. The construction logic duplicates concepts already expressed by `RepairDeltaArtifact` and `ImplRepairEntry` setup elsewhere.  
**Suggestion:** Extract small helpers such as `migrationPreviousHash()` and `buildMigrationRepairEntry({ migration, currentManifest, delta, invalidations })`. This keeps `replace()` focused on transaction behavior and makes the fingerprint-selection rules easier to review.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Clarify stage-set naming
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

### 21. 1. Validate resolver type before invocation
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

### 22. 2. Extract exhausted-attempt predicate
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

### 23. 1. Bound diff materialization before hashing
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

### 24. 2. Extract review target fingerprint construction
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

### 25. 3. Rename latest artifact variables for clarity
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

### 26. 4. Bound authoritative specification prompt size
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

### 27. 3. Preserve a specific unsupported-stage message
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

### 28. 1. Name the category check by intent
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

### 29. 2. Avoid repeating the `"spec-correction"` string literal
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

### 30. 1. Bound Recursive Test Discovery
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

### 31. 2. Remove Impossible Raw Evidence Check
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

### 32. 3. Avoid Repeated Requirement Lookup
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

### 33. 4. Extract Repeated Test Evidence Builders
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

### 34. 5. Factor Duplicate Readiness Evaluation Setup
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

### 35. 2. Extract the complete empty spec fixture
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

### 36. 1. Add cleanup safety around per-stage temp dirs
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

### 37. 1. Extract Repeated Step Status Setup
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

### 38. 2. Name Migration Helper By Observable Test State
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

### 39. 3. Avoid Duplicated Contract Invocation Blocks
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

### 40. 4. Replace Raw Git Test Setup With Local Helper
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

### 41. 5. Split Multi-Behavior Test Case
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

### 42. 1. Cover the “latest rewind” behavior explicitly
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

### 43. 2. Extract repeated artifact path construction
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

### 44. 1. Standardize Acceptance Fixture Helpers
**Finding key:** loop-7b09dfdede967426250f
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple files propose local wrappers for the same `createAcceptanceReviewFixture()` / cleanup / `runAcceptanceReviewFixture()` pattern, with names like `withAcceptanceFixture`, `withAcceptanceReviewFixture`, `runAcceptanceFixture`, and `runFixtureAcceptance`. If each spec adds its own variant, the fixture API and naming will drift across the suite.  
**Suggestion:** Add shared helper methods to `tests/helpers/acceptance-review-fixture.js`, for example `withAcceptanceReviewFixture(options, fn)` and `runAcceptanceReviewFixtureWithDefaults(fixture, overrides)`, then use the same names across affected spec files.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple files propose local wrappers for the same `createAcceptanceReviewFixture()` / cleanup / `runAcceptanceReviewFixture()` pattern, with names like `withAcceptanceFixture`, `withAcceptanceReviewFixture`, `runAcceptanceFixture`, and `runFixtureAcceptance`. If each spec adds its own variant, the fixture API and naming will drift across the suite.  
**Suggestion:** Add shared helper methods to `tests/helpers/acceptance-review-fixture.js`, for example `withAcceptanceReviewFixture(options, fn)` and `runAcceptanceReviewFixtureWithDefaults(fixture, overrides)`, then use the same names across affected spec files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Consolidate Flow Finding Fixture Builders
**Finding key:** loop-93bfcd7fcc2c4bc16eb9
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Several proposals point to repeated FlowFinding or flow-findings artifact setup across files, including repair fingerprints, deferred finding dispositions, invalid FlowFinding constructor payloads, and filename-specific JSON mutation. These are all variations of the same test fixture contract but are being solved locally.  
**Suggestion:** Introduce explicit shared builders such as `flowFindingData(overrides)`, `writeFlowFindingsArtifact(...)`, and `makeRepairFingerprint(...)`, keeping generic JSON writers pure and centralizing the current schema defaults.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Several proposals point to repeated FlowFinding or flow-findings artifact setup across files, including repair fingerprints, deferred finding dispositions, invalid FlowFinding constructor payloads, and filename-specific JSON mutation. These are all variations of the same test fixture contract but are being solved locally.  
**Suggestion:** Introduce explicit shared builders such as `flowFindingData(overrides)`, `writeFlowFindingsArtifact(...)`, and `makeRepairFingerprint(...)`, keeping generic JSON writers pure and centralizing the current schema defaults.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Align Review Target Identity Naming
**Finding key:** loop-5f6be8c19e9eadd42539
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha()` can return a synthetic tree-plus-diff fingerprint, while other files discuss repair fingerprints, migration artifact freshness, and gate artifact identities. Across files, “tree sha”, “fingerprint”, and “artifact” are used inconsistently for identity-like values.  
**Suggestion:** Rename the review evidence API toward `resolveCurrentReviewTargetFingerprint()` and use `fingerprint` terminology in callers where the value is not guaranteed to be a literal Git tree SHA.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha()` can return a synthetic tree-plus-diff fingerprint, while other files discuss repair fingerprints, migration artifact freshness, and gate artifact identities. Across files, “tree sha”, “fingerprint”, and “artifact” are used inconsistently for identity-like values.  
**Suggestion:** Rename the review evidence API toward `resolveCurrentReviewTargetFingerprint()` and use `fingerprint` terminology in callers where the value is not guaranteed to be a literal Git tree SHA.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Centralize Spec-Correction Rewind Vocabulary
**Finding key:** loop-39ba72a1765924f9700a
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** Spec-correction rewind behavior is touched in `plan-rewind.js`, `run-reopen-draft.js`, and `run-scenario-validity.js`, but naming and literals are inconsistent: `SPEC_CORRECTION_SUPPORTED_STAGES`, raw `"spec-correction"`, and helper names that hide rewind-specific intent.  
**Suggestion:** Export or colocate shared constants such as `SPEC_CORRECTION_REWIND_CATEGORY` and `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, then use them consistently in reopen and scenario-validity checks.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R1  
**Issue:** Spec-correction rewind behavior is touched in `plan-rewind.js`, `run-reopen-draft.js`, and `run-scenario-validity.js`, but naming and literals are inconsistent: `SPEC_CORRECTION_SUPPORTED_STAGES`, raw `"spec-correction"`, and helper names that hide rewind-specific intent.  
**Suggestion:** Export or colocate shared constants such as `SPEC_CORRECTION_REWIND_CATEGORY` and `SPEC_CORRECTION_REWIND_SUPPORTED_STAGES`, then use them consistently in reopen and scenario-validity checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Share Bounded Traversal Utilities
**Finding key:** loop-a5b7eb73db051b20efc6
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Both `productionSourceFiles()` in the acceptance migration spec and `#existingTestFile()` in the acceptance fixture helper introduce recursive filesystem discovery without explicit bounds. Solving these independently risks inconsistent depth and file-count limits.  
**Suggestion:** Add a small bounded file walker helper for tests, with shared max-depth and max-entry behavior, and use it for source discovery and fixture test discovery.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Both `productionSourceFiles()` in the acceptance migration spec and `#existingTestFile()` in the acceptance fixture helper introduce recursive filesystem discovery without explicit bounds. Solving these independently risks inconsistent depth and file-count limits.  
**Suggestion:** Add a small bounded file walker helper for tests, with shared max-depth and max-entry behavior, and use it for source discovery and fixture test discovery.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
