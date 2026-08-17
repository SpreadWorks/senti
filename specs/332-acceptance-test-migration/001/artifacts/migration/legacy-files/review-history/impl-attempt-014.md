# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Align Test Name With Covered Requirement
**Finding key:** loop-3511b058c71a540577ee
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R3
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The updated test still starts with `"R8:"`, but the provided requirement contract only allows R1, R3, and R9, and this scenario maps to R3.  
**Suggestion:** Rename the test to start with `"R3:"` so the test intent matches the requirement being validated.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The updated test still starts with `"R8:"`, but the provided requirement contract only allows R1, R3, and R9, and this scenario maps to R3.  
**Suggestion:** Rename the test to start with `"R3:"` so the test intent matches the requirement being validated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Avoid Re-importing Existing Verdict Helper In Test Body
**Finding key:** loop-1f7a50e5f856f2c3564e
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R9
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R9  
**Issue:** `deriveAcceptanceReviewVerdict` appears to already be available in the surrounding test file, while the new test destructures it again from `loadArtifactModule()`. This adds unnecessary local shadowing and makes the test setup noisier.  
**Suggestion:** Only destructure `artifactFromAcceptanceJudgments` and `buildAcceptanceReviewContext` in this test, and use the existing `deriveAcceptanceReviewVerdict` binding if one is already present in the file.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R9  
**Issue:** `deriveAcceptanceReviewVerdict` appears to already be available in the surrounding test file, while the new test destructures it again from `loadArtifactModule()`. This adds unnecessary local shadowing and makes the test setup noisier.  
**Suggestion:** Only destructure `artifactFromAcceptanceJudgments` and `buildAcceptanceReviewContext` in this test, and use the existing `deriveAcceptanceReviewVerdict` binding if one is already present in the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Extract Repeated Fixture Invocation Arguments
**Finding key:** loop-af4c422b285119d0e799
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R9
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** The updated tests repeat the same `runAcceptanceReviewFixture` wiring: `root`, `state`, `diff`, and `requirementJudgments`. This duplicates fixture plumbing and makes future fixture shape changes more error-prone.  
**Suggestion:** Add a small local helper in this test file, for example `runAcceptanceReviewForFixture(fixture, overrides)`, that supplies the common fields and spreads test-specific overrides.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R9  
**Issue:** The updated tests repeat the same `runAcceptanceReviewFixture` wiring: `root`, `state`, `diff`, and `requirementJudgments`. This duplicates fixture plumbing and makes future fixture shape changes more error-prone.  
**Suggestion:** Add a small local helper in this test file, for example `runAcceptanceReviewForFixture(fixture, overrides)`, that supplies the common fields and spreads test-specific overrides.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Rename `dispositions` To Clarify Domain Meaning
**Finding key:** loop-f33e312f04f7a16cf4bc
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R4
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The variable name `dispositions` is generic, while the test specifically verifies deferred finding final dispositions.  
**Suggestion:** Rename it to `finalDispositions` or `deferredFinalDispositions` so the fixture setup and persisted assertion read closer to the acceptance-review domain being tested.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`  
**Requirement:** R4  
**Issue:** The variable name `dispositions` is generic, while the test specifically verifies deferred finding final dispositions.  
**Suggestion:** Rename it to `finalDispositions` or `deferredFinalDispositions` so the fixture setup and persisted assertion read closer to the acceptance-review domain being tested.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Destructure fixture inputs before running acceptance review
**Finding key:** loop-3b0df5855c28d9ef279b
**Failure mode:** refactor
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R5
**Issue:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The new fixture block repeatedly dereferences `acceptanceFixture` for every `runAcceptanceReviewFixture` input, which makes the test harder to scan inside an already long regression case.  
**Suggestion:** Destructure the fixture once before the call, for example `const { state, diff, requirementJudgments } = acceptanceFixture;`, then pass those locals. Keep `root` explicit if needed to avoid shadowing the outer temp root.
**Suggestion:** **File:** `specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js`  
**Requirement:** R5  
**Issue:** The new fixture block repeatedly dereferences `acceptanceFixture` for every `runAcceptanceReviewFixture` input, which makes the test harder to scan inside an already long regression case.  
**Suggestion:** Destructure the fixture once before the call, for example `const { state, diff, requirementJudgments } = acceptanceFixture;`, then pass those locals. Keep `root` explicit if needed to avoid shadowing the outer temp root.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Extract repeated acceptance review runner setup
**Finding key:** loop-0404e0d4b527e8b30fb0
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The same `runAcceptanceReviewFixture` argument block is repeated several times with `root`, `state`, `diff`, and `requirementJudgments`. This makes the test noisier and increases maintenance cost if the fixture API changes.  
**Suggestion:** Add a local helper inside each test, or a small file-level helper, such as `runAcceptance(fixture, overrides)`, that spreads the common fixture fields and accepts only scenario-specific overrides like `deferredFindingDispositions`, `persist`, `apply`, or `flowManager`.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The same `runAcceptanceReviewFixture` argument block is repeated several times with `root`, `state`, `diff`, and `requirementJudgments`. This makes the test noisier and increases maintenance cost if the fixture API changes.  
**Suggestion:** Add a local helper inside each test, or a small file-level helper, such as `runAcceptance(fixture, overrides)`, that spreads the common fixture fields and accepts only scenario-specific overrides like `deferredFindingDispositions`, `persist`, `apply`, or `flowManager`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Avoid state coupling between disposition and missing-source checks
**Finding key:** loop-2bd3a6235f647c80f07f
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** In `R7: acceptance-review consumes deferred findings and mirrors finalDisposition`, the `stillOpen` scenario applies workflow state changes before the missing-source scenario reuses the same `acceptanceFixture.state`. That creates hidden coupling between two assertions that are testing different behaviors.  
**Suggestion:** Use a fresh adopted fixture for the missing-source branch, or reset/recreate the fixture state before renaming the source artifact. This keeps the missing-source assertion focused on missing-source blocking rather than depending on prior routing side effects.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** In `R7: acceptance-review consumes deferred findings and mirrors finalDisposition`, the `stillOpen` scenario applies workflow state changes before the missing-source scenario reuses the same `acceptanceFixture.state`. That creates hidden coupling between two assertions that are testing different behaviors.  
**Suggestion:** Use a fresh adopted fixture for the missing-source branch, or reset/recreate the fixture state before renaming the source artifact. This keeps the missing-source assertion focused on missing-source blocking rather than depending on prior routing side effects.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Rename `entry` to reflect deferred finding semantics
**Finding key:** loop-3b1ba09cfdec73786c4b
**Failure mode:** refactor
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Variables named `entry` are pulled from `flow-findings.json`, but later used as deferred-finding source metadata. The generic name makes the assertions harder to read.  
**Suggestion:** Rename `entry` to `deferredFinding` or `flowFinding` in both affected tests. This better communicates why `findingId` and `sourceArtifact` are being asserted or used.
**Suggestion:** **File:** `specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Variables named `entry` are pulled from `flow-findings.json`, but later used as deferred-finding source metadata. The generic name makes the assertions harder to read.  
**Suggestion:** Rename `entry` to `deferredFinding` or `flowFinding` in both affected tests. This better communicates why `findingId` and `sourceArtifact` are being asserted or used.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Validate the persisted acceptance artifact directly
**Finding key:** loop-f0b9c967d764a9ad4592
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R7
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** The test writes the acceptance artifact and checks the persisted `verdict`, but `validateAcceptanceReviewArtifact` still validates the in-memory `acceptance` object. That leaves the serialized artifact path less covered.  
**Suggestion:** Read the persisted artifact once and validate that object:

```js
const persistedAcceptance = readJson(written.path);
assert.equal(persistedAcceptance.verdict, "pass");
assert.doesNotThrow(() => validateAcceptanceReviewArtifact(persistedAcceptance, {
  requirementIds: fixture.requirementIds,
}));
```
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** The test writes the acceptance artifact and checks the persisted `verdict`, but `validateAcceptanceReviewArtifact` still validates the in-memory `acceptance` object. That leaves the serialized artifact path less covered.  
**Suggestion:** Read the persisted artifact once and validate that object:

```js
const persistedAcceptance = readJson(written.path);
assert.equal(persistedAcceptance.verdict, "pass");
assert.doesNotThrow(() => validateAcceptanceReviewArtifact(persistedAcceptance, {
  requirementIds: fixture.requirementIds,
}));
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Avoid reconstructing the fixture spec directory path
**Finding key:** loop-82bfa3dfdefa2c1906e3
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R9
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R9  
**Issue:** `const fixtureSpecDir = \`specs/${fixture.specId}\`;` duplicates path knowledge that already exists in the fixture via `fixture.specPath` / `fixture.specDir`. This makes the test slightly more brittle if the fixture layout changes.  
**Suggestion:** Derive the durable pathspec prefix from the fixture’s spec path, for example:

```js
const fixtureSpecDir = path.dirname(fixture.specPath);
```

Then keep the durable pathspec assertions based on `fixtureSpecDir`.
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R9  
**Issue:** `const fixtureSpecDir = \`specs/${fixture.specId}\`;` duplicates path knowledge that already exists in the fixture via `fixture.specPath` / `fixture.specDir`. This makes the test slightly more brittle if the fixture layout changes.  
**Suggestion:** Derive the durable pathspec prefix from the fixture’s spec path, for example:

```js
const fixtureSpecDir = path.dirname(fixture.specPath);
```

Then keep the durable pathspec assertions based on `fixtureSpecDir`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Extract acceptance-review fixture lifecycle helper
**Finding key:** loop-3ea7b7088ecfb719a1cf
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** The two new R8 tests duplicate the same `producerFixture` setup, `runFinalSemanticFail`, `readFlowFindingsArtifact`, `adoptAcceptanceReviewFixture`, and `try/finally cleanup` lifecycle.  
**Suggestion:** Add a small helper such as `withDeferredAcceptanceFixture({ findingId }, fn)` that creates the producer fixture, adopts the acceptance fixture, passes `{ entry, acceptanceFixture }` to the callback, and guarantees cleanup.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** The two new R8 tests duplicate the same `producerFixture` setup, `runFinalSemanticFail`, `readFlowFindingsArtifact`, `adoptAcceptanceReviewFixture`, and `try/finally cleanup` lifecycle.  
**Suggestion:** Add a small helper such as `withDeferredAcceptanceFixture({ findingId }, fn)` that creates the producer fixture, adopts the acceptance fixture, passes `{ entry, acceptanceFixture }` to the callback, and guarantees cleanup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Rename `blocking` result variable for clarity
**Finding key:** loop-9dd9c1d60ed87d2a537e
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** The variable `blocking` holds the result of `runAcceptanceReviewFixture`, but the asserted verdict is `user_decision_required`. The name can imply the whole acceptance result is blocked, which is not what the test now verifies.  
**Suggestion:** Rename it to something more precise, for example `blockingDeferredFinding` or `blockingDispositionResult`.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R8  
**Issue:** The variable `blocking` holds the result of `runAcceptanceReviewFixture`, but the asserted verdict is `user_decision_required`. The name can imply the whole acceptance result is blocked, which is not what the test now verifies.  
**Suggestion:** Rename it to something more precise, for example `blockingDeferredFinding` or `blockingDispositionResult`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Remove unused imports if still present after migration
**Finding key:** loop-9645c27b533c621d6cea
**Failure mode:** refactor
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R1
**Issue:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R1  
**Issue:** The diff removes `prepareAcceptanceEvidence`, but `fs` and `path` remain imported at the top. If they are no longer used elsewhere in the file, they are now dead imports.  
**Suggestion:** Run the file through lint/static inspection and remove `fs` and/or `path` if unused.
**Suggestion:** **File:** `specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js`  
**Requirement:** R1  
**Issue:** The diff removes `prepareAcceptanceEvidence`, but `fs` and `path` remain imported at the top. If they are no longer used elsewhere in the file, they are now dead imports.  
**Suggestion:** Run the file through lint/static inspection and remove `fs` and/or `path` if unused.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Add Cycle Protection For Associated Evidence Freshness
**Finding key:** loop-3113be2f31cbd443471e
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R8  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself when `associatedPrimaryEvidencePath()` returns a primary artifact. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or maps an associated path back through another association, freshness checking can recurse without an explicit bound. This violates the bounded-resource-usage guardrail.  
**Suggestion:** Replace recursion with a bounded loop or pass a `visited` set/depth counter. For example, resolve the primary path once with cycle detection, then evaluate freshness on the resolved artifact.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R8  
**Issue:** `isFreshMigrationArtifact()` recursively calls itself when `associatedPrimaryEvidencePath()` returns a primary artifact. If `ASSOCIATED_EVIDENCE_PATHS` ever contains a cycle or maps an associated path back through another association, freshness checking can recurse without an explicit bound. This violates the bounded-resource-usage guardrail.  
**Suggestion:** Replace recursion with a bounded loop or pass a `visited` set/depth counter. For example, resolve the primary path once with cycle detection, then evaluate freshness on the resolved artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Avoid Duplicate Step Lookup Fallbacks
**Finding key:** loop-fc25da041b679fe05438
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `hasAppliedRepairMigration()` repeatedly uses `state.steps || []` inline. This duplicates fallback logic and makes the function slightly harder to scan.  
**Suggestion:** Introduce a local `const steps = state.steps || [];` and use it for `findStepById(steps, "test-execute")`. This also keeps the function consistent with nearby code that normalizes inputs once before operating on them.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `hasAppliedRepairMigration()` repeatedly uses `state.steps || []` inline. This duplicates fallback logic and makes the function slightly harder to scan.  
**Suggestion:** Introduce a local `const steps = state.steps || [];` and use it for `findStepById(steps, "test-execute")`. This also keeps the function consistent with nearby code that normalizes inputs once before operating on them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Clarify Artifact Freshness Naming
**Finding key:** loop-1200b8bb4970a2cb48a7
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `isFreshMigrationArtifact()` returns `true` when the file does not exist. That makes sense for invalidation records, but the name reads as if it checks whether an existing artifact is fresh. This can mislead future callers.  
**Suggestion:** Rename it to something closer to the behavior, such as `isInvalidationSatisfied()` or `isMigrationInvalidationSatisfied()`, since it treats missing artifacts and fresh artifacts as acceptable migration states.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `isFreshMigrationArtifact()` returns `true` when the file does not exist. That makes sense for invalidation records, but the name reads as if it checks whether an existing artifact is fresh. This can mislead future callers.  
**Suggestion:** Rename it to something closer to the behavior, such as `isInvalidationSatisfied()` or `isMigrationInvalidationSatisfied()`, since it treats missing artifacts and fresh artifacts as acceptable migration states.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Extract Repeated Fingerprint Comparison
**Finding key:** loop-ca89421e580842962049
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `currentFingerprint.hash` is accessed in multiple branches of `isFreshMigrationArtifact()`, and each branch encodes its own freshness comparison.  
**Suggestion:** Store `const currentHash = currentFingerprint.hash;` near the top and use that consistently. If this pattern expands, extract a tiny helper such as `hasCurrentRepairFingerprint(artifact, currentHash)` for the direct `repairFingerprint` comparison.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `currentFingerprint.hash` is accessed in multiple branches of `isFreshMigrationArtifact()`, and each branch encodes its own freshness comparison.  
**Suggestion:** Store `const currentHash = currentFingerprint.hash;` near the top and use that consistently. If this pattern expands, extract a tiny helper such as `hasCurrentRepairFingerprint(artifact, currentHash)` for the direct `repairFingerprint` comparison.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Bound diff capture before hashing
**Finding key:** loop-b86bde011046f5f30e7f
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `runGit(["diff", "--binary", "HEAD"])` captures the full binary diff into memory with no explicit size bound. This violates the bounded-resource-usage guardrail for bulk data loading, especially because `--binary` can include large file contents.  
**Suggestion:** Add an explicit maximum diff size before hashing, or compute the hash through a bounded/streaming git invocation that aborts after the configured byte limit. Return a clear `REVIEW_TARGET_TREE_UNAVAILABLE`-style error when the working tree diff exceeds that limit.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R1  
**Issue:** `runGit(["diff", "--binary", "HEAD"])` captures the full binary diff into memory with no explicit size bound. This violates the bounded-resource-usage guardrail for bulk data loading, especially because `--binary` can include large file contents.  
**Suggestion:** Add an explicit maximum diff size before hashing, or compute the hash through a bounded/streaming git invocation that aborts after the configured byte limit. Return a clear `REVIEW_TARGET_TREE_UNAVAILABLE`-style error when the working tree diff exceeds that limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Clarify synthetic review target naming
**Finding key:** loop-2b303d3680f33ed399a6
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** `resolveCurrentReviewTreeSha` now sometimes returns the real Git tree SHA and sometimes a synthetic SHA derived from `treeSha + diff`. The function name still implies it always resolves a tree object SHA, which is no longer accurate.  
**Suggestion:** Rename the function to reflect the mixed clean/dirty behavior, for example `resolveCurrentReviewTargetSha` or `resolveCurrentReviewEvidenceSha`, and update call sites in the touched change set if present.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** `resolveCurrentReviewTreeSha` now sometimes returns the real Git tree SHA and sometimes a synthetic SHA derived from `treeSha + diff`. The function name still implies it always resolves a tree object SHA, which is no longer accurate.  
**Suggestion:** Rename the function to reflect the mixed clean/dirty behavior, for example `resolveCurrentReviewTargetSha` or `resolveCurrentReviewEvidenceSha`, and update call sites in the touched change set if present.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Defer `nextTreeSha` Resolution Until Needed
**Finding key:** loop-8b439279521c90e19a1d
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R8  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is evaluated before `reviewToolingRecoveryMutation()` decides whether a recovery mutation is needed. If the guard returns `null`, the tree SHA lookup was unnecessary.  
**Suggestion:** Move `resolveCurrentReviewTreeSha(ctx.root)` inside `reviewToolingRecoveryMutation()` after the early-return checks, or pass a lazy callback such as `resolveNextTreeSha`. This keeps the helper’s resource usage proportional to actual mutation creation.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R8  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is evaluated before `reviewToolingRecoveryMutation()` decides whether a recovery mutation is needed. If the guard returns `null`, the tree SHA lookup was unnecessary.  
**Suggestion:** Move `resolveCurrentReviewTreeSha(ctx.root)` inside `reviewToolingRecoveryMutation()` after the early-return checks, or pass a lazy callback such as `resolveNextTreeSha`. This keeps the helper’s resource usage proportional to actual mutation creation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Rename Factory-Like Helper for Clarity
**Finding key:** loop-07ef2b53be787abb478b
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R8  
**Issue:** `reviewToolingRecoveryMutation()` sounds like an object/value, but it conditionally constructs and returns a `ReviewToolingRecoveryMutation` or `null`.  
**Suggestion:** Rename it to `createReviewToolingRecoveryMutation()` to match its behavior and make the call site easier to read.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R8  
**Issue:** `reviewToolingRecoveryMutation()` sounds like an object/value, but it conditionally constructs and returns a `ReviewToolingRecoveryMutation` or `null`.  
**Suggestion:** Rename it to `createReviewToolingRecoveryMutation()` to match its behavior and make the call site easier to read.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Remove Dead `rawEndLine` Check
**Finding key:** loop-a5dc5e0989f0d116b727
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `rawEndLine` is assigned as `Math.max(1, this.requirementIds.length)`, so `if (rawEndLine < 1)` can never be true. This is dead code and does not actually guard fixture validity.  
**Suggestion:** Remove `rawEndLine` and the unreachable check, or replace it with a meaningful boundary check on `this.requirementIds.length` if empty requirements are invalid for the fixture.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `rawEndLine` is assigned as `Math.max(1, this.requirementIds.length)`, so `if (rawEndLine < 1)` can never be true. This is dead code and does not actually guard fixture validity.  
**Suggestion:** Remove `rawEndLine` and the unreachable check, or replace it with a meaningful boundary check on `this.requirementIds.length` if empty requirements are invalid for the fixture.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Avoid Repeated `existingSpec.requirements.find(...)`
**Finding key:** loop-93afd989940f97d16875
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `#prepareRepository()` calls `existingSpec.requirements?.find(...)` three times per requirement to read `desc`, `priority`, and `status`. This duplicates lookup logic and makes the requirement mapping noisier than needed.  
**Suggestion:** Build a `Map` of existing requirements by id once, then read the matched requirement inside the mapper:

```js
const existingRequirements = new Map(
  existingSpec.requirements?.map((requirement) => [requirement.id, requirement]) || [],
);
```

Then use `const existingRequirement = existingRequirements.get(id);`.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `#prepareRepository()` calls `existingSpec.requirements?.find(...)` three times per requirement to read `desc`, `priority`, and `status`. This duplicates lookup logic and makes the requirement mapping noisier than needed.  
**Suggestion:** Build a `Map` of existing requirements by id once, then read the matched requirement inside the mapper:

```js
const existingRequirements = new Map(
  existingSpec.requirements?.map((requirement) => [requirement.id, requirement]) || [],
);
```

Then use `const existingRequirement = existingRequirements.get(id);`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Extract Shared Test Evidence Construction
**Finding key:** loop-edf13b8278f428155fde
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Scenario validity and test execution summaries independently construct nearly identical evidence objects containing `test_file`, `test_name`, `command`, and `raw_output_lines`. This duplicates fixture assembly logic and increases the chance the two artifacts drift.  
**Suggestion:** Add a small helper such as `testEvidenceFor(requirementId, index)` or a private method on `AcceptanceReviewFixture`, and use it in both summary builders.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** Scenario validity and test execution summaries independently construct nearly identical evidence objects containing `test_file`, `test_name`, `command`, and `raw_output_lines`. This duplicates fixture assembly logic and increases the chance the two artifacts drift.  
**Suggestion:** Add a small helper such as `testEvidenceFor(requirementId, index)` or a private method on `AcceptanceReviewFixture`, and use it in both summary builders.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Replace Repeated Artifact Omission Checks With Helper
**Finding key:** loop-4fa02e8cd9e96ac40347
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `#writeMechanicalEvidence()` repeatedly uses `!this.omitArtifacts.includes(...)`. This scatters the omission policy and performs repeated linear scans.  
**Suggestion:** Normalize `omitArtifacts` to a `Set` in the constructor and add a helper like `#shouldWriteArtifact(fileName)`, then use `if (this.#shouldWriteArtifact("retro.json"))`.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `#writeMechanicalEvidence()` repeatedly uses `!this.omitArtifacts.includes(...)`. This scatters the omission policy and performs repeated linear scans.  
**Suggestion:** Normalize `omitArtifacts` to a `Set` in the constructor and add a helper like `#shouldWriteArtifact(fileName)`, then use `if (this.#shouldWriteArtifact("retro.json"))`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Rename `input` in `#writeDeferredEvidence`
**Finding key:** loop-d9b534ae3094f8e264f5
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** The parameter name `input` is vague in a method whose behavior depends on source finding metadata. The surrounding code uses clearer domain terms such as `deferredFindings` and `entries`.  
**Suggestion:** Rename `input` to `deferredFindings` or `findingSpecs` to make the fixture’s intent clearer.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** The parameter name `input` is vague in a method whose behavior depends on source finding metadata. The surrounding code uses clearer domain terms such as `deferredFindings` and `entries`.  
**Suggestion:** Rename `input` to `deferredFindings` or `findingSpecs` to make the fixture’s intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Extract repeated repair fingerprint paths
**Finding key:** loop-be686268794a2bb0e732
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The new tests repeat `path.join(tmp, "specs/demo/test-execute-result.json")` and `path.join(tmp, "specs/demo/repair-fingerprint.json")` several times, mixing fixture setup with path construction noise.  
**Suggestion:** Add small local helpers/constants inside the `describe`, e.g. `repairFingerprintPath()` and `testExecuteResultPath()`, then use them for `fs.existsSync`, `fs.readFileSync`, and writes.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The new tests repeat `path.join(tmp, "specs/demo/test-execute-result.json")` and `path.join(tmp, "specs/demo/repair-fingerprint.json")` several times, mixing fixture setup with path construction noise.  
**Suggestion:** Add small local helpers/constants inside the `describe`, e.g. `repairFingerprintPath()` and `testExecuteResultPath()`, then use them for `fs.existsSync`, `fs.readFileSync`, and writes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Name the migration helper around observable behavior
**Finding key:** loop-5b9653415a5b14d06f62
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2` describes implementation details, but the helper also initializes repo state, writes stale legacy artifacts, runs `RunGateCommand`, and returns post-recovery state. The name undersells the side effects.  
**Suggestion:** Rename it to something like `recoverBaselineBearingLegacyV2Fingerprint()` or `runBaselineBearingLegacyV2Recovery()` so each test reads as operating on a recovered migrated state.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2` describes implementation details, but the helper also initializes repo state, writes stale legacy artifacts, runs `RunGateCommand`, and returns post-recovery state. The name undersells the side effects.  
**Suggestion:** Rename it to something like `recoverBaselineBearingLegacyV2Fingerprint()` or `runBaselineBearingLegacyV2Recovery()` so each test reads as operating on a recovered migrated state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Extract repeated post-migration state setup
**Finding key:** loop-52373b0dde8be51a15d4
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Two tests repeat the same state transition after migration: `state.steps[0].status = "done"; state.steps[1].status = "in_progress";`, then restore evidence.  
**Suggestion:** Add a focused helper such as `markTestExecuteCompleted(state)` or `restoreCompletedTestExecutionEvidence(state, fingerprintHash)` to keep the tests centered on their distinct assertions.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Two tests repeat the same state transition after migration: `state.steps[0].status = "done"; state.steps[1].status = "in_progress";`, then restore evidence.  
**Suggestion:** Add a focused helper such as `markTestExecuteCompleted(state)` or `restoreCompletedTestExecutionEvidence(state, fingerprintHash)` to keep the tests centered on their distinct assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Centralize Acceptance Review Fixture Runner
**Finding key:** loop-0085ed0359f4099791cd
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple test files independently repeat or propose local helpers around the same `runAcceptanceReviewFixture` argument shape: `root`, `state`, `diff`, and `requirementJudgments`. This duplication appears in `specs/293`, `specs/295`, and `specs/296`, so solving it per file would still leave inconsistent helper names and call patterns.  
**Suggestion:** Add a shared helper exported from `tests/helpers/acceptance-review-fixture.js`, such as `runAcceptanceReviewForFixture(fixture, overrides = {})`, and migrate the touched tests to use that single interface.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Multiple test files independently repeat or propose local helpers around the same `runAcceptanceReviewFixture` argument shape: `root`, `state`, `diff`, and `requirementJudgments`. This duplication appears in `specs/293`, `specs/295`, and `specs/296`, so solving it per file would still leave inconsistent helper names and call patterns.  
**Suggestion:** Add a shared helper exported from `tests/helpers/acceptance-review-fixture.js`, such as `runAcceptanceReviewForFixture(fixture, overrides = {})`, and migrate the touched tests to use that single interface.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Rename Review Tree SHA Interface Consistently
**Finding key:** loop-441656cf650c54e55289
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** `resolveCurrentReviewTreeSha` now represents either a real Git tree SHA or a synthetic dirty-worktree review target. `src/flow/lib/set-retry.js` still consumes that interface under the old tree-specific name, which creates a cross-file contract mismatch.  
**Suggestion:** Rename the exported function to `resolveCurrentReviewTargetSha` or similar, and update all imports/call sites, including `src/flow/lib/set-retry.js`, so the interface name matches its actual semantics.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R2  
**Issue:** `resolveCurrentReviewTreeSha` now represents either a real Git tree SHA or a synthetic dirty-worktree review target. `src/flow/lib/set-retry.js` still consumes that interface under the old tree-specific name, which creates a cross-file contract mismatch.  
**Suggestion:** Rename the exported function to `resolveCurrentReviewTargetSha` or similar, and update all imports/call sites, including `src/flow/lib/set-retry.js`, so the interface name matches its actual semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Standardize Deferred Finding Variable Names
**Finding key:** loop-f7e411061f96e52da6ec
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** Deferred finding concepts are named inconsistently across touched files: `dispositions`, `entry`, `input`, `blocking`, and `blockingDeferredFinding` are all used or proposed for related data. This makes the deferred-review flow harder to follow across fixture setup and consuming tests.  
**Suggestion:** Adopt consistent domain names: use `deferredFindings` or `findingSpecs` for fixture inputs, `deferredFinding` for a single persisted finding, and `finalDispositions` for disposition maps/results. Update the touched tests to follow the same vocabulary.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** Deferred finding concepts are named inconsistently across touched files: `dispositions`, `entry`, `input`, `blocking`, and `blockingDeferredFinding` are all used or proposed for related data. This makes the deferred-review flow harder to follow across fixture setup and consuming tests.  
**Suggestion:** Adopt consistent domain names: use `deferredFindings` or `findingSpecs` for fixture inputs, `deferredFinding` for a single persisted finding, and `finalDispositions` for disposition maps/results. Update the touched tests to follow the same vocabulary.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
