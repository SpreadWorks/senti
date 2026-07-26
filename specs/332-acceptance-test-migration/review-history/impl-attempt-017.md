# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Align test names with declared requirement coverage
**Finding key:** loop-f35ce1ee71e6ca39045d
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R3
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The updated test still starts with `R8:` even though the related requirements for this change list R1, R3, and R9. That makes traceability inconsistent and can mislead future reviewers about what contract the test protects.  
**Suggestion:** Rename `R8: production context derives missing tests...` to `R3: production context derives missing tests...`, since the assertion directly validates persisted evidence producing `missing_tests` and `missing_required_tests`.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The updated test still starts with `R8:` even though the related requirements for this change list R1, R3, and R9. That makes traceability inconsistent and can mislead future reviewers about what contract the test protects.  
**Suggestion:** Rename `R8: production context derives missing tests...` to `R3: production context derives missing tests...`, since the assertion directly validates persisted evidence producing `missing_tests` and `missing_required_tests`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Extract repeated minimal artifact construction
**Finding key:** loop-57582be37a480430ac21
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R9
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R9  
**Issue:** The verdict policy test repeats the same artifact shape four times with `mechanicalBlockers`, `hardBlockers`, and `requirementJudgments`. This makes the important policy difference harder to scan and increases maintenance noise if the minimal verdict input changes.  
**Suggestion:** Add a small local helper inside the test or describe block, for example `verdictInput({ mechanicalBlockers = [], hardBlockers = [], requirementJudgments = [] } = {})`, and use it for each assertion.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R9  
**Issue:** The verdict policy test repeats the same artifact shape four times with `mechanicalBlockers`, `hardBlockers`, and `requirementJudgments`. This makes the important policy difference harder to scan and increases maintenance noise if the minimal verdict input changes.  
**Suggestion:** Add a small local helper inside the test or describe block, for example `verdictInput({ mechanicalBlockers = [], hardBlockers = [], requirementJudgments = [] } = {})`, and use it for each assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Avoid unused artifact details in missing-test assertion
**Finding key:** loop-6edd2b6e805b9cc3e1c0
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Requirement:** R3
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The test creates a full artifact mainly to assert the verdict, but the missing blocker checks come from `context.mechanicalBlockers`. The mixed focus makes it slightly unclear whether missing test derivation belongs to context construction or artifact generation.  
**Suggestion:** Split the assertions into clearer phases: first assert `buildAcceptanceReviewContext` derives both blocker kinds from fixture evidence, then separately create the artifact only for the verdict assertion. A short blank-line separation or local variable name like `artifactWithContextBlockers` would make the contract clearer.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Requirement:** R3  
**Issue:** The test creates a full artifact mainly to assert the verdict, but the missing blocker checks come from `context.mechanicalBlockers`. The mixed focus makes it slightly unclear whether missing test derivation belongs to context construction or artifact generation.  
**Suggestion:** Split the assertions into clearer phases: first assert `buildAcceptanceReviewContext` derives both blocker kinds from fixture evidence, then separately create the artifact only for the verdict assertion. A short blank-line separation or local variable name like `artifactWithContextBlockers` would make the contract clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Extract Repeated Fixture Invocation Arguments
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

### 5. 2. Rename `dispositions` To Clarify Domain Meaning
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

### 6. 1. Destructure fixture inputs before running acceptance review
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

### 7. 1. Extract repeated acceptance review runner setup
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

### 8. 2. Avoid state coupling between disposition and missing-source checks
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

### 9. 3. Rename `entry` to reflect deferred finding semantics
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

### 10. 1. Derive fixture path from fixture metadata
**Finding key:** loop-83a601b62f58e85f6fde
**Failure mode:** refactor
**File:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js
**Requirement:** R7
**Issue:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** The test introduces `const fixtureSpecDir = \`specs/${fixture.specId}\`;` even though the fixture already exposes `specDir` and `specPath`. This duplicates path construction logic and can drift if the fixture changes its directory layout.  
**Suggestion:** Derive durable path assertions from existing fixture metadata, e.g. `path.dirname(fixture.specPath)`, or expose a `fixture.specPathspecDir` from the helper if that pattern is reused. This keeps the test coupled to the fixture contract instead of reconstructing paths locally.
**Suggestion:** **File:** `specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js`  
**Requirement:** R7  
**Issue:** The test introduces `const fixtureSpecDir = \`specs/${fixture.specId}\`;` even though the fixture already exposes `specDir` and `specPath`. This duplicates path construction logic and can drift if the fixture changes its directory layout.  
**Suggestion:** Derive durable path assertions from existing fixture metadata, e.g. `path.dirname(fixture.specPath)`, or expose a `fixture.specPathspecDir` from the helper if that pattern is reused. This keeps the test coupled to the fixture contract instead of reconstructing paths locally.
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

### 20. 1. Avoid retaining all review artifacts in memory
**Finding key:** loop-b37574c47c268f1f82af
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R9
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R9  
**Issue:** The new `reviewedArtifacts` array stores every parsed `ReviewFindingGateArtifact` and raw artifact before filtering by `repairFingerprint`. This adds bulk retention where the previous code streamed findings directly into `obligations`.  
**Suggestion:** Split the work into two passes over `candidates`: first identify `latestArtifact` and its `repairFingerprint`, then re-read matching candidates and add findings directly to `obligations`. This keeps memory bounded to the current artifact and avoids accumulating all findings/artifacts at once.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R9  
**Issue:** The new `reviewedArtifacts` array stores every parsed `ReviewFindingGateArtifact` and raw artifact before filtering by `repairFingerprint`. This adds bulk retention where the previous code streamed findings directly into `obligations`.  
**Suggestion:** Split the work into two passes over `candidates`: first identify `latestArtifact` and its `repairFingerprint`, then re-read matching candidates and add findings directly to `obligations`. This keeps memory bounded to the current artifact and avoids accumulating all findings/artifacts at once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Clarify raw artifact naming
**Finding key:** loop-0b6b4f61f06bda24f4ca
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `latestArtifact` now stores the raw parsed artifact, while `artifact` stores a `ReviewFindingGateArtifact` instance. The names are easy to confuse in the same function.  
**Suggestion:** Rename `latestArtifact` to `latestRawArtifact` or `latestReviewRaw` so the distinction between raw JSON and wrapped artifact is explicit.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `latestArtifact` now stores the raw parsed artifact, while `artifact` stores a `ReviewFindingGateArtifact` instance. The names are easy to confuse in the same function.  
**Suggestion:** Rename `latestArtifact` to `latestRawArtifact` or `latestReviewRaw` so the distinction between raw JSON and wrapped artifact is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Defer `nextTreeSha` Resolution Until Needed
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

### 23. 2. Rename Factory-Like Helper for Clarity
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

### 24. 1. Remove ineffective rawEndLine guard
**Finding key:** loop-e4fd3043725d009fd3ed
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `rawEndLine` is computed as `Math.max(1, this.requirementIds.length)`, so `if (rawEndLine < 1)` can never be true. This is dead defensive code and does not actually validate whether raw evidence was generated.  
**Suggestion:** Remove `rawEndLine` and the final guard, or replace it with a real boundary check before fixture assembly, such as rejecting an empty `requirementIds` list if the fixture cannot support it.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** `rawEndLine` is computed as `Math.max(1, this.requirementIds.length)`, so `if (rawEndLine < 1)` can never be true. This is dead defensive code and does not actually validate whether raw evidence was generated.  
**Suggestion:** Remove `rawEndLine` and the final guard, or replace it with a real boundary check before fixture assembly, such as rejecting an empty `requirementIds` list if the fixture cannot support it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Avoid repeated spec requirement lookups
**Finding key:** loop-5e22c42a2a0fcc498346
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Inside `#prepareRepository()`, each requirement does three separate `existingSpec.requirements?.find(...)` calls for `desc`, `priority`, and `status`. This duplicates lookup logic and scales poorly as fixture requirements grow.  
**Suggestion:** Build a `Map` once, for example `const existingRequirements = new Map((existingSpec.requirements || []).map((r) => [r.id, r]));`, then use `const existingRequirement = existingRequirements.get(id)` inside the mapper.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R9  
**Issue:** Inside `#prepareRepository()`, each requirement does three separate `existingSpec.requirements?.find(...)` calls for `desc`, `priority`, and `status`. This duplicates lookup logic and scales poorly as fixture requirements grow.  
**Suggestion:** Build a `Map` once, for example `const existingRequirements = new Map((existingSpec.requirements || []).map((r) => [r.id, r]));`, then use `const existingRequirement = existingRequirements.get(id)` inside the mapper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Extract repeated evidence object construction
**Finding key:** loop-027a5f15c27c6cd77a80
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** The same test evidence shape is built in both `scenario-validity-result.json` and `test-execute-result.json`: `test_file`, `test_name`, `command`, and `raw_output_lines`. This duplication makes future artifact-shape changes easy to miss in one location.  
**Suggestion:** Add a small helper such as `testEvidenceFor(id, index)` or an instance method that returns the shared evidence object, and reuse it in both summaries.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** The same test evidence shape is built in both `scenario-validity-result.json` and `test-execute-result.json`: `test_file`, `test_name`, `command`, and `raw_output_lines`. This duplication makes future artifact-shape changes easy to miss in one location.  
**Suggestion:** Add a small helper such as `testEvidenceFor(id, index)` or an instance method that returns the shared evidence object, and reuse it in both summaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 4. Extract repeated repair evidence writes
**Finding key:** loop-0092a67469acc556c89a
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#writeMechanicalEvidence()` repeats the same `if (!this.omitArtifacts.includes(...)) writeRepairEvidenceArtifact({ specDir, stepId, fingerprint, artifact })` structure for each artifact. The repeated wrapper obscures the differences between artifacts.  
**Suggestion:** Add a private helper like `#writeRepairArtifactUnlessOmitted(fileName, stepId, artifact)` and keep each artifact payload focused on its domain data.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R2  
**Issue:** `#writeMechanicalEvidence()` repeats the same `if (!this.omitArtifacts.includes(...)) writeRepairEvidenceArtifact({ specDir, stepId, fingerprint, artifact })` structure for each artifact. The repeated wrapper obscures the differences between artifacts.  
**Suggestion:** Add a private helper like `#writeRepairArtifactUnlessOmitted(fileName, stepId, artifact)` and keep each artifact payload focused on its domain data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 5. Name `deferredSourceEvidence` for what it returns
**Finding key:** loop-92f9f343852068f12291
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `deferredSourceEvidence()` returns an array of advisory finding objects, not generic evidence. The current name is broad and easy to confuse with flow-finding evidence or mechanical evidence elsewhere in the fixture.  
**Suggestion:** Rename it to `deferredAdvisoryFindings()` or `advisoryFindingsFromDeferredEntries()` and update the call in `#writeDeferredSourceEvidence()`.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `deferredSourceEvidence()` returns an array of advisory finding objects, not generic evidence. The current name is broad and easy to confuse with flow-finding evidence or mechanical evidence elsewhere in the fixture.  
**Suggestion:** Rename it to `deferredAdvisoryFindings()` or `advisoryFindingsFromDeferredEntries()` and update the call in `#writeDeferredSourceEvidence()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 6. Preserve optional fingerprint input in deferred findings
**Finding key:** loop-019eb38190b174438af3
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `#writeDeferredEvidence()` always replaces `finding.fingerprint` with `String(index + 1).padStart(64, "0")`, even when callers provide explicit deferred finding fingerprints. That weakens fixture configurability for tests that need exact source identity and evidence binding.  
**Suggestion:** Use `finding.fingerprint || String(index + 1).padStart(64, "0")` so default fingerprints remain deterministic while explicit inputs are preserved.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`  
**Requirement:** R4  
**Issue:** `#writeDeferredEvidence()` always replaces `finding.fingerprint` with `String(index + 1).padStart(64, "0")`, even when callers provide explicit deferred finding fingerprints. That weakens fixture configurability for tests that need exact source identity and evidence binding.  
**Suggestion:** Use `finding.fingerprint || String(index + 1).padStart(64, "0")` so default fingerprints remain deterministic while explicit inputs are preserved.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Extract Review Artifact Fixtures
**Finding key:** loop-073e5ec6985b54460925
**Failure mode:** refactor
**File:** tests/unit/flow/finding-gate-readiness.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The new test repeats fairly verbose review artifact JSON construction inline, including the same `blockingFindings` / `nonBlockingImprovements` shape used by nearby tests. This makes the test harder to scan and increases maintenance cost if the artifact schema changes.  
**Suggestion:** Introduce a small local helper in this test file, such as `reviewOutput({ blockingFindings = [], nonBlockingImprovements = [] })`, and optionally a fixture helper for the common R1 blocking finding. Then the test can focus on the behavior: historical must-fix evidence is superseded by a fresh clean review.
**Suggestion:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The new test repeats fairly verbose review artifact JSON construction inline, including the same `blockingFindings` / `nonBlockingImprovements` shape used by nearby tests. This makes the test harder to scan and increases maintenance cost if the artifact schema changes.  
**Suggestion:** Introduce a small local helper in this test file, such as `reviewOutput({ blockingFindings = [], nonBlockingImprovements = [] })`, and optionally a fixture helper for the common R1 blocking finding. Then the test can focus on the behavior: historical must-fix evidence is superseded by a fresh clean review.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Name The Test Around The Gate Decision
**Finding key:** loop-34e1b3b2898ed2a2a041
**Failure mode:** refactor
**File:** tests/unit/flow/finding-gate-readiness.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The title “supersedes historical obligations after review evidence changes” is understandable, but slightly indirect. The behavior being asserted is that the gate passes after a newer clean review artifact replaces an older blocking one.  
**Suggestion:** Rename the test to something more outcome-specific, for example: `finding gate passes when a newer clean review supersedes prior blocking findings`. This aligns the name with the final assertions on `verdict` and `allowsPass()`.
**Suggestion:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The title “supersedes historical obligations after review evidence changes” is understandable, but slightly indirect. The behavior being asserted is that the gate passes after a newer clean review artifact replaces an older blocking one.  
**Suggestion:** Rename the test to something more outcome-specific, for example: `finding gate passes when a newer clean review supersedes prior blocking findings`. This aligns the name with the final assertions on `verdict` and `allowsPass()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Extract repeated repair artifact path helpers
**Finding key:** loop-3aaa7c91c4a5f61761b5
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The new tests repeat `path.join(tmp, "specs/demo/test-execute-result.json")`, `path.join(tmp, "specs/demo/repair-fingerprint.json")`, and JSON read/write logic several times. This makes the test intent harder to scan and increases maintenance cost if fixture paths change.  
**Suggestion:** Add small local helpers such as `repairFingerprintPath()`, `testExecuteResultPath()`, and `readRepairManifest()` near the existing test helpers, then use them in the migrated and new assertions.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The new tests repeat `path.join(tmp, "specs/demo/test-execute-result.json")`, `path.join(tmp, "specs/demo/repair-fingerprint.json")`, and JSON read/write logic several times. This makes the test intent harder to scan and increases maintenance cost if fixture paths change.  
**Suggestion:** Add small local helpers such as `repairFingerprintPath()`, `testExecuteResultPath()`, and `readRepairManifest()` near the existing test helpers, then use them in the migrated and new assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Split setup helper from command execution
**Finding key:** loop-2008a8b08ae498728c4e
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2()` both constructs a legacy v2 fixture and executes `RunGateCommand`. The name sounds like setup, but it performs the behavior under test and mutates/removes evidence before returning. This makes follow-up tests depend on side effects that are not obvious from the call site.  
**Suggestion:** Rename it to something explicit like `recoverBaselineBearingLegacyV2()` or split it into `createBaselineBearingLegacyV2Fixture()` plus a separate `runIntegrationGateRecovery()` helper. The latter would make tests that need the post-recovery state more intentional.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R2  
**Issue:** `migrateBaselineBearingLegacyV2()` both constructs a legacy v2 fixture and executes `RunGateCommand`. The name sounds like setup, but it performs the behavior under test and mutates/removes evidence before returning. This makes follow-up tests depend on side effects that are not obvious from the call site.  
**Suggestion:** Rename it to something explicit like `recoverBaselineBearingLegacyV2()` or split it into `createBaselineBearingLegacyV2Fixture()` plus a separate `runIntegrationGateRecovery()` helper. The latter would make tests that need the post-recovery state more intentional.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Return only the fixture state each test needs
**Finding key:** loop-203a8e98a5943abfecff
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** The helper always returns `{ state, legacy, flowManager, result }`, but most tests only use a subset. This loosely couples all tests to implementation details of the fixture.  
**Suggestion:** If the helper remains combined, return a named fixture object with clearer properties, or split setup/execution so each test receives only the objects it needs. This would reduce incidental coupling and make unused values disappear naturally.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R3  
**Issue:** The helper always returns `{ state, legacy, flowManager, result }`, but most tests only use a subset. This loosely couples all tests to implementation details of the fixture.  
**Suggestion:** If the helper remains combined, return a named fixture object with clearer properties, or split setup/execution so each test receives only the objects it needs. This would reduce incidental coupling and make unused values disappear naturally.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 4. Centralize recreated evidence writing
**Finding key:** loop-7a1e18836b8bebdb27f6
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The new tests duplicate the evidence recreation pattern: set step statuses, then write `test-execute-result.json` with either `manifest.hash` or `legacy.hash`.  
**Suggestion:** Add a focused helper such as `writeTestExecuteEvidence(hash)` and optionally `markTestExecutionRetained(state)`. This keeps the tests focused on the scenario names: recreated current evidence versus restored stale evidence.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The new tests duplicate the evidence recreation pattern: set step statuses, then write `test-execute-result.json` with either `manifest.hash` or `legacy.hash`.  
**Suggestion:** Add a focused helper such as `writeTestExecuteEvidence(hash)` and optionally `markTestExecutionRetained(state)`. This keeps the tests focused on the scenario names: recreated current evidence versus restored stale evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Standardize acceptance review fixture runner helpers
**Finding key:** loop-96090799996bb55c125a
**Failure mode:** refactor
**File:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs
**Requirement:** R9
**Issue:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`
**Requirement:** R9
**Issue:** Multiple spec files introduce or request local helpers for the same `runAcceptanceReviewFixture` wiring: `root`, `state`, `diff`, and `requirementJudgments`. The proposed helper names vary across files (`runAcceptanceReviewForFixture`, `runAcceptance`, inline destructuring), which would preserve duplication and create inconsistent test patterns.
**Suggestion:** Add one shared helper to `tests/helpers/acceptance-review-fixture.js`, for example `runAdoptedAcceptanceReviewFixture(fixture, overrides)`, and use it from `specs/293-*`, `specs/295-*`, and `specs/296-*`.
**Suggestion:** **File:** `specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs`
**Requirement:** R9
**Issue:** Multiple spec files introduce or request local helpers for the same `runAcceptanceReviewFixture` wiring: `root`, `state`, `diff`, and `requirementJudgments`. The proposed helper names vary across files (`runAcceptanceReviewForFixture`, `runAcceptance`, inline destructuring), which would preserve duplication and create inconsistent test patterns.
**Suggestion:** Add one shared helper to `tests/helpers/acceptance-review-fixture.js`, for example `runAdoptedAcceptanceReviewFixture(fixture, overrides)`, and use it from `specs/293-*`, `specs/295-*`, and `specs/296-*`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Align review target SHA naming across producer and consumer code
**Finding key:** loop-1aeb8e403f9d7f248811
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R2
**Issue:** `resolveCurrentReviewTreeSha()` now represents either a real tree SHA or a synthetic dirty-worktree review identity. Other files, such as `src/flow/lib/set-retry.js`, still refer to this value as `nextTreeSha`, which compounds the misleading interface name across call sites.
**Suggestion:** Rename the API and locals consistently to review-target terminology, for example `resolveCurrentReviewTargetSha()` and `nextReviewTargetSha`, so clean and dirty review identities use the same vocabulary.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R2
**Issue:** `resolveCurrentReviewTreeSha()` now represents either a real tree SHA or a synthetic dirty-worktree review identity. Other files, such as `src/flow/lib/set-retry.js`, still refer to this value as `nextTreeSha`, which compounds the misleading interface name across call sites.
**Suggestion:** Rename the API and locals consistently to review-target terminology, for example `resolveCurrentReviewTargetSha()` and `nextReviewTargetSha`, so clean and dirty review identities use the same vocabulary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Consolidate raw versus wrapped review artifact naming
**Finding key:** loop-3babc11ad2f71f2c1450
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R2
**Issue:** The review summaries identify naming ambiguity around raw parsed artifacts versus `ReviewFindingGateArtifact` instances. If only `latestArtifact` is renamed locally, other files may still use generic `artifact` names for different artifact representations, keeping the interface unclear across the review pipeline.
**Suggestion:** Use a consistent convention across review evidence code: `rawReviewArtifact` for parsed JSON and `reviewArtifact` for wrapped domain objects. Apply that naming in `run-gate.js` and any touched producer/consumer code.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R2
**Issue:** The review summaries identify naming ambiguity around raw parsed artifacts versus `ReviewFindingGateArtifact` instances. If only `latestArtifact` is renamed locally, other files may still use generic `artifact` names for different artifact representations, keeping the interface unclear across the review pipeline.
**Suggestion:** Use a consistent convention across review evidence code: `rawReviewArtifact` for parsed JSON and `reviewArtifact` for wrapped domain objects. Apply that naming in `run-gate.js` and any touched producer/consumer code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 4. Centralize deferred finding terminology
**Finding key:** loop-23037748f63b682643b4
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`
**Requirement:** R4
**Issue:** Deferred finding data is named inconsistently across tests and helpers: `entry`, `dispositions`, `blocking`, and `deferredSourceEvidence()` all refer to related deferred-review concepts at different abstraction levels. This makes cross-file test intent harder to follow.
**Suggestion:** Adopt a small naming convention: `deferredFinding` for flow-finding entries, `deferredFinalDispositions` for disposition maps, and `deferredAdvisoryFindings()` for generated advisory finding payloads. Update the affected spec tests and fixture helper together.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`
**Requirement:** R4
**Issue:** Deferred finding data is named inconsistently across tests and helpers: `entry`, `dispositions`, `blocking`, and `deferredSourceEvidence()` all refer to related deferred-review concepts at different abstraction levels. This makes cross-file test intent harder to follow.
**Suggestion:** Adopt a small naming convention: `deferredFinding` for flow-finding entries, `deferredFinalDispositions` for disposition maps, and `deferredAdvisoryFindings()` for generated advisory finding payloads. Update the affected spec tests and fixture helper together.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 5. Extract shared evidence payload builders instead of per-file local helpers
**Finding key:** loop-75fad7626a99219e56d6
**Failure mode:** refactor
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/acceptance-review-fixture.js`
**Requirement:** R2
**Issue:** Several reviews propose local extraction of repeated artifact or evidence shapes, while the fixture helper itself already duplicates evidence payload construction. Adding only local helpers in individual tests would create parallel mini-factories for the same contract.
**Suggestion:** Put shared builders in `tests/helpers/acceptance-review-fixture.js`, such as `testEvidenceForRequirement()` and `reviewArtifactOutput()`, then keep per-test helpers only for scenario-specific setup.
**Suggestion:** **File:** `tests/helpers/acceptance-review-fixture.js`
**Requirement:** R2
**Issue:** Several reviews propose local extraction of repeated artifact or evidence shapes, while the fixture helper itself already duplicates evidence payload construction. Adding only local helpers in individual tests would create parallel mini-factories for the same contract.
**Suggestion:** Put shared builders in `tests/helpers/acceptance-review-fixture.js`, such as `testEvidenceForRequirement()` and `reviewArtifactOutput()`, then keep per-test helpers only for scenario-specific setup.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
