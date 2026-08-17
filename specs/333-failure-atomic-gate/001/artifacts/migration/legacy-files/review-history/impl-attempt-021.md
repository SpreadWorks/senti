# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Add explicit bridge authority metadata
**Finding key:** loop-5aa9c004144e1c386692
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** The `repair-006` bridge entry records hashes, changed paths, and a delta digest, but it does not explicitly bind the authority to the exact run, spec, Issue, changed-path inventory, and delta digest as required. This makes the bridge harder to audit without relying on external context.  
**Suggestion:** Add an explicit authority/evidence object to `repair-006` that records the exact run identifier, spec id/path, Issue identifier, changed-path inventory reference, and `changedPathsDigest`, while leaving prior entries unchanged.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** The `repair-006` bridge entry records hashes, changed paths, and a delta digest, but it does not explicitly bind the authority to the exact run, spec, Issue, changed-path inventory, and delta digest as required. This makes the bridge harder to audit without relying on external context.  
**Suggestion:** Add an explicit authority/evidence object to `repair-006` that records the exact run identifier, spec id/path, Issue identifier, changed-path inventory reference, and `changedPathsDigest`, while leaving prior entries unchanged.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Add Explicit Authority Identity Fields
**Finding key:** loop-3c0eac0553b26347cf08
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-deltas/repair-006.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-deltas/repair-006.json`  
**Requirement:** R8  
**Issue:** The repair delta records hashes, changed paths, and digest, but it does not explicitly bind the authority to the exact run, spec, and Issue as required. The spec is only implicit in the file path and changed paths.  
**Suggestion:** Add explicit fields such as `runId`, `specId`, and `issueId` or an `authority` object containing those values, so validation does not depend on path inference.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-deltas/repair-006.json`  
**Requirement:** R8  
**Issue:** The repair delta records hashes, changed paths, and digest, but it does not explicitly bind the authority to the exact run, spec, and Issue as required. The spec is only implicit in the file path and changed paths.  
**Suggestion:** Add explicit fields such as `runId`, `specId`, and `issueId` or an `authority` object containing those values, so validation does not depend on path inference.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Extract Bridge Delta Construction
**Finding key:** loop-72aee85ebc823f016562
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `RepairDeltaArtifact` is constructed twice with the same field mapping, once in the constructor and once in `prepare`. This duplicates authority-to-delta binding logic.  
**Suggestion:** Add a private helper such as `#createBridgeDelta()` or a local `createBridgeDeltaFromAuthority(authority)` function and reuse it in both places.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `RepairDeltaArtifact` is constructed twice with the same field mapping, once in the constructor and once in `prepare`. This duplicates authority-to-delta binding logic.  
**Suggestion:** Add a private helper such as `#createBridgeDelta()` or a local `createBridgeDeltaFromAuthority(authority)` function and reuse it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Consolidate Positive Integer Validation
**Finding key:** loop-6b978325258581ab4a20
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** Positive safe-integer validation is repeated for `issue` and `preservedEntryCount`, and again in `RepairLedgerReconciliationResult`.  
**Suggestion:** Introduce a small helper like `requirePositiveInteger(value, field)` to reduce duplicate validation code and keep error behavior consistent.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** Positive safe-integer validation is repeated for `issue` and `preservedEntryCount`, and again in `RepairLedgerReconciliationResult`.  
**Suggestion:** Introduce a small helper like `requirePositiveInteger(value, field)` to reduce duplicate validation code and keep error behavior consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Name `serialized` More Precisely
**Finding key:** loop-e6d9d00eb08453f87181
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `serialized` is vague; it is specifically used for exact JSON-form comparison of ledger and delta artifacts.  
**Suggestion:** Rename it to something clearer, such as `toComparableJson` or `serializeForExactComparison`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `serialized` is vague; it is specifically used for exact JSON-form comparison of ledger and delta artifacts.  
**Suggestion:** Rename it to something clearer, such as `toComparableJson` or `serializeForExactComparison`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 4. Extract Changed Path Grouping
**Finding key:** loop-49af7bc650e1efe0817c
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The changed-path grouping logic is embedded inside `prepare`, making the method handle validation, delta creation, grouping, and entry construction.  
**Suggestion:** Extract the grouping block into a named helper like `buildChangedPathGroups(changedPaths)`. This makes `prepare` read as orchestration and makes the grouping rule easier to test or audit.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The changed-path grouping logic is embedded inside `prepare`, making the method handle validation, delta creation, grouping, and entry construction.  
**Suggestion:** Extract the grouping block into a named helper like `buildChangedPathGroups(changedPaths)`. This makes `prepare` read as orchestration and makes the grouping rule easier to test or audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 5. Add an Explicit Bound for Changed Path Processing
**Finding key:** loop-f0e706c9cb32ebdaf90c
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `prepare` iterates over every `delta.changedPaths` entry to build groups. The preview is bounded, but the full grouping pass has no explicit upper bound in this file. This may violate the `bounded-resource-usage` guardrail unless `RepairDeltaArtifact` already enforces a hard maximum.  
**Suggestion:** Define and enforce a maximum changed-path count here, or document and assert the bound exposed by `RepairDeltaArtifact` before grouping.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `prepare` iterates over every `delta.changedPaths` entry to build groups. The preview is bounded, but the full grouping pass has no explicit upper bound in this file. This may violate the `bounded-resource-usage` guardrail unless `RepairDeltaArtifact` already enforces a hard maximum.  
**Suggestion:** Define and enforce a maximum changed-path count here, or document and assert the bound exposed by `RepairDeltaArtifact` before grouping.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Distinguish Changed-Path Digest From Delta Digest
**Finding key:** loop-3826cb74ec8f792e413a
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.json`  
**Requirement:** R8  
**Issue:** The file records `changedPathsDigest`, but R8 requires binding both the changed-path inventory and the delta digest. As named, this field appears to cover only the path inventory, not the actual delta content.  
**Suggestion:** Add an explicit `deltaDigest` field, or rename `changedPathsDigest` only if it truly represents the full delta digest. Keeping both values distinct would make the reconciliation authority clearer and less error-prone.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.json`  
**Requirement:** R8  
**Issue:** The file records `changedPathsDigest`, but R8 requires binding both the changed-path inventory and the delta digest. As named, this field appears to cover only the path inventory, not the actual delta content.  
**Suggestion:** Add an explicit `deltaDigest` field, or rename `changedPathsDigest` only if it truly represents the full delta digest. Keeping both values distinct would make the reconciliation authority clearer and less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Extract Shared Boundary Lists
**Finding key:** loop-b0b72178465ef8fbaf54
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R5
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests. This makes it easier for retry/failure coverage to drift if a boundary is added or renamed.  
**Suggestion:** Define a shared constant such as `const PRE_COMMIT_BOUNDARIES = [...]` near the other test constants and reuse it in all boundary loops.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests. This makes it easier for retry/failure coverage to drift if a boundary is added or renamed.  
**Suggestion:** Define a shared constant such as `const PRE_COMMIT_BOUNDARIES = [...]` near the other test constants and reuse it in all boundary loops.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Extract Repeated Fixture Cleanup Pattern
**Finding key:** loop-0fdaa324963dedb66cb4
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** Many tests repeat the same `const fixture = persistedGateFixture(...); try { ... } finally { removeTmpDir(fixture.root); }` structure. This adds noise and makes the test intent harder to scan.  
**Suggestion:** Add a small helper such as `async function withPersistedGateFixture(prefix, fn)` that creates the fixture, invokes the callback, and always removes the temp directory.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** Many tests repeat the same `const fixture = persistedGateFixture(...); try { ... } finally { removeTmpDir(fixture.root); }` structure. This adds noise and makes the test intent harder to scan.  
**Suggestion:** Add a small helper such as `async function withPersistedGateFixture(prefix, fn)` that creates the fixture, invokes the callback, and always removes the temp directory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Rename `transitionFor` For Clarity
**Finding key:** loop-0ab5547778164a8662e1
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R2
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R2  
**Issue:** `transitionFor(state)` is vague; it hides that the helper constructs an inferred gate transition using phase resolution and a `GateMutationOwner`.  
**Suggestion:** Rename it to something more explicit, such as `inferredGateTransitionForState` or `createInferredGateTransition`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R2  
**Issue:** `transitionFor(state)` is vague; it hides that the helper constructs an inferred gate transition using phase resolution and a `GateMutationOwner`.  
**Suggestion:** Rename it to something more explicit, such as `inferredGateTransitionForState` or `createInferredGateTransition`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Remove Or Justify `PersistedStaleGateManager.appendMetric`
**Finding key:** loop-cc2300a288ec5630ce6f
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `appendMetric()` on `PersistedStaleGateManager` appears unused in this test file, while retry metric behavior is tested using a separate inline `retryContext`.  
**Suggestion:** Remove `recordedMetrics` and `appendMetric()` from the fake manager unless a future test needs manager-backed metrics.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `appendMetric()` on `PersistedStaleGateManager` appears unused in this test file, while retry metric behavior is tested using a separate inline `retryContext`.  
**Suggestion:** Remove `recordedMetrics` and `appendMetric()` from the fake manager unless a future test needs manager-backed metrics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 5. Extract Repeated Persisted JSON Reads
**Finding key:** loop-44dcd44d8bec02dac5d5
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R3
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** The tests repeatedly inline `JSON.parse(fs.readFileSync(path.join(...), "utf8"))` for gate result and issue-log files. This creates duplication and obscures assertions.  
**Suggestion:** Add helpers such as `readJson(specDir, name)` or more specific helpers like `readGateResult(specDir)` and `readIssueLog(specDir)`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** The tests repeatedly inline `JSON.parse(fs.readFileSync(path.join(...), "utf8"))` for gate result and issue-log files. This creates duplication and obscures assertions.  
**Suggestion:** Add helpers such as `readJson(specDir, name)` or more specific helpers like `readGateResult(specDir)` and `readIssueLog(specDir)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 6. Replace Stringly Typed Semantic Results With Constants
**Finding key:** loop-1f7a7253467c6e9f9896
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"pass"` and `"fail"` are repeated throughout helper defaults, loops, and assertions. The values are important protocol literals, so typos would be easy to miss.  
**Suggestion:** Define `const SEMANTIC_RESULTS = ["pass", "fail"]` and optionally `const PASS = "pass"; const FAIL = "fail";` for defaults and comparisons.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"pass"` and `"fail"` are repeated throughout helper defaults, loops, and assertions. The values are important protocol literals, so typos would be easy to miss.  
**Suggestion:** Define `const SEMANTIC_RESULTS = ["pass", "fail"]` and optionally `const PASS = "pass"; const FAIL = "fail";` for defaults and comparisons.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 7. Split Large Parity Test Into Focused Tests
**Finding key:** loop-cb11d8de3a374f057449
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` checks provider config, artifact persistence, retry metrics, routing, and command args in one broad test. This mixes unrelated failure causes and makes regressions harder to localize.  
**Suggestion:** Split it into smaller R6 tests, for example provider config parity, artifact path/result parity, retry counter parity, and lifecycle routing parity.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` checks provider config, artifact persistence, retry metrics, routing, and command args in one broad test. This mixes unrelated failure causes and makes regressions harder to localize.  
**Suggestion:** Split it into smaller R6 tests, for example provider config parity, artifact path/result parity, retry counter parity, and lifecycle routing parity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Assert Both Issue Guard Options Explicitly
**Finding key:** loop-da47251a49a4f3f65902
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/parked-resume-help.test.js
**Requirement:** R7
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The final assertion uses `/--expect-issue|--expect-no-issue/`, so the test passes if only one of the two guard options is present. That weakens coverage for “retaining existing usage and target-guard option output.”  
**Suggestion:** Replace it with two explicit assertions:

```js
assert.match(help, /--expect-issue/);
assert.match(help, /--expect-no-issue/);
```
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The final assertion uses `/--expect-issue|--expect-no-issue/`, so the test passes if only one of the two guard options is present. That weakens coverage for “retaining existing usage and target-guard option output.”  
**Suggestion:** Replace it with two explicit assertions:

```js
assert.match(help, /--expect-issue/);
assert.match(help, /--expect-no-issue/);
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Replace hard-coded bridge expectations with fixture values
**Finding key:** loop-834a3d12d18c5c5d5dec
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The test hard-codes `"repair-006"` and `5` even though those values already exist in the authority fixture as `bridgeEntryId` and `preservedEntryCount`. This duplicates fixture data and makes the test more brittle if the reconciliation fixture is updated.  
**Suggestion:** Assert against `fixture.authority.bridgeEntryId` and `fixture.authority.preservedEntryCount`, including the ledger slice length.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The test hard-codes `"repair-006"` and `5` even though those values already exist in the authority fixture as `bridgeEntryId` and `preservedEntryCount`. This duplicates fixture data and makes the test more brittle if the reconciliation fixture is updated.  
**Suggestion:** Assert against `fixture.authority.bridgeEntryId` and `fixture.authority.preservedEntryCount`, including the ledger slice length.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Avoid `authority` naming collision in the first test
**Finding key:** loop-a0d5663daca64ed27dad
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** `fixture.authority` is the raw authority JSON, while `const authority = new RepairLedgerReconciliationAuthority(...)` is the runtime authority object. The shared name makes the test harder to scan.  
**Suggestion:** Rename the constructed instance to something like `reconciliationAuthority` or `authorityVerifier`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** `fixture.authority` is the raw authority JSON, while `const authority = new RepairLedgerReconciliationAuthority(...)` is the runtime authority object. The shared name makes the test harder to scan.  
**Suggestion:** Rename the constructed instance to something like `reconciliationAuthority` or `authorityVerifier`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Extract repeated byte-preservation assertions
**Finding key:** loop-f641d973bd026590edd5
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The mismatch loop repeats the same ledger and delta byte assertions for every variant. The repetition slightly obscures the purpose of the loop.  
**Suggestion:** Add a small helper such as `assertArtifactsUnchanged(name, { ledgerPath, deltaPath, beforeLedger, beforeDelta })` or inline a local function inside the test to keep the loop focused on mutation and rejection behavior.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The mismatch loop repeats the same ledger and delta byte assertions for every variant. The repetition slightly obscures the purpose of the loop.  
**Suggestion:** Add a small helper such as `assertArtifactsUnchanged(name, { ledgerPath, deltaPath, beforeLedger, beforeDelta })` or inline a local function inside the test to keep the loop focused on mutation and rejection behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Add explicit bounds when flattening step trees
**Finding key:** loop-eb7558a6ed2eb81f771f
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `#transitionStepMap()` calls `flattenSteps()` over `flowState.steps` and `task.steps` without any local bound on depth or total step count. This can violate `bounded-resource-usage` if malformed or unexpectedly large step trees are processed.  
**Suggestion:** Use a bounded traversal or pass explicit limits to `flattenSteps()` if supported. If not supported, add local validation before flattening, such as max depth and max total steps, and throw a clear error when exceeded.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `#transitionStepMap()` calls `flattenSteps()` over `flowState.steps` and `task.steps` without any local bound on depth or total step count. This can violate `bounded-resource-usage` if malformed or unexpectedly large step trees are processed.  
**Suggestion:** Use a bounded traversal or pass explicit limits to `flattenSteps()` if supported. If not supported, add local validation before flattening, such as max depth and max total steps, and throw a clear error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Avoid rebuilding the step map twice during transition commit checks
**Finding key:** loop-551c107379e058c23bb6
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R2  
**Issue:** `captureTransitionStatuses()` builds a full transition step map, and `assertTransitionStatuses()` builds another full map later. This duplicates traversal work across the same flow shape.  
**Suggestion:** Consider returning a small snapshot object that includes only the watched step IDs and a bounded lookup strategy, or add a helper like `#getTransitionStepsById(flowState, stepIds)` so both methods only resolve the relevant step IDs.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R2  
**Issue:** `captureTransitionStatuses()` builds a full transition step map, and `assertTransitionStatuses()` builds another full map later. This duplicates traversal work across the same flow shape.  
**Suggestion:** Consider returning a small snapshot object that includes only the watched step IDs and a bounded lookup strategy, or add a helper like `#getTransitionStepsById(flowState, stepIds)` so both methods only resolve the relevant step IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Rename `#transitionStepMap` to describe what it contains
**Finding key:** loop-2425d2fdaabcea7c4215
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R3  
**Issue:** `#transitionStepMap()` sounds like it maps transitions, but it actually builds a map of step IDs to step objects across the flow and selected task.  
**Suggestion:** Rename it to something more direct, such as `#stepMapForTransitionState()` or `#buildStepMap()`, to reduce ambiguity for future maintainers.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R3  
**Issue:** `#transitionStepMap()` sounds like it maps transitions, but it actually builds a map of step IDs to step objects across the flow and selected task.  
**Suggestion:** Rename it to something more direct, such as `#stepMapForTransitionState()` or `#buildStepMap()`, to reduce ambiguity for future maintainers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Remove unused import
**Finding key:** loop-77fd07a7e3a8884b1f8e
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `flattenSteps` is imported from `./step-tree.js` but is not used anywhere in the diff.  
**Suggestion:** Remove the unused import to keep the module clean and avoid lint noise.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `flattenSteps` is imported from `./step-tree.js` but is not used anywhere in the diff.  
**Suggestion:** Remove the unused import to keep the module clean and avoid lint noise.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Consolidate inferred-transition persistence flow
**Finding key:** loop-f81226ced22124108fab
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** The checkpoint, artifact persistence, semantic-result validation, and inferred-transition commit sequence now exists in two places: `RunGateCommand.execute()` and `runGatePhaseWithDependencies()`. This duplicates failure-boundary logic that must remain byte-identical and atomic.  
**Suggestion:** Extract a shared helper for “persist required gate artifacts, then commit inferred transition, rollback durable surfaces on pre-commit failure” and have both call sites use it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** The checkpoint, artifact persistence, semantic-result validation, and inferred-transition commit sequence now exists in two places: `RunGateCommand.execute()` and `runGatePhaseWithDependencies()`. This duplicates failure-boundary logic that must remain byte-identical and atomic.  
**Suggestion:** Extract a shared helper for “persist required gate artifacts, then commit inferred transition, rollback durable surfaces on pre-commit failure” and have both call sites use it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Rename `identityProbeError`
**Finding key:** loop-5e5787ab6aec90a8d495
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `identityProbeError` is vague; the code is specifically probing stale integration test evidence before full trust validation.  
**Suggestion:** Rename it to `staleEvidenceProbeError` or `artifactIdentityProbeError` so the delayed throw is easier to understand.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `identityProbeError` is vague; the code is specifically probing stale integration test evidence before full trust validation.  
**Suggestion:** Rename it to `staleEvidenceProbeError` or `artifactIdentityProbeError` so the delayed throw is easier to understand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Avoid brittle root reconstruction from `specDir`
**Finding key:** loop-fbd858899a1a7b5351e4
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `runGatePhaseWithDependencies()` derives `root` with `path.dirname(path.dirname(specDir))`, which assumes a fixed spec directory depth. That makes the helper fragile if spec layout changes.  
**Suggestion:** Pass `root` explicitly into `runGatePhaseWithDependencies()` when fingerprint construction may be needed.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `runGatePhaseWithDependencies()` derives `root` with `path.dirname(path.dirname(specDir))`, which assumes a fixed spec directory depth. That makes the helper fragile if spec layout changes.  
**Suggestion:** Pass `root` explicitly into `runGatePhaseWithDependencies()` when fingerprint construction may be needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 5. Simplify semantic result predicate
**Finding key:** loop-3ba05b18ce1ca83692c1
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `completedSemanticGateResult()` encodes `"pass"` and semantic `"fail"` as a custom boolean, but callers use it to decide whether commit is allowed. The function name does not communicate that tooling/artifact failures are intentionally excluded.  
**Suggestion:** Rename it to something more precise, such as `isCommitEligibleSemanticGateResult()`, and keep the PASS/AI semantic FAIL criteria centralized there.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `completedSemanticGateResult()` encodes `"pass"` and semantic `"fail"` as a custom boolean, but callers use it to decide whether commit is allowed. The function name does not communicate that tooling/artifact failures are intentionally excluded.  
**Suggestion:** Rename it to something more precise, such as `isCommitEligibleSemanticGateResult()`, and keep the PASS/AI semantic FAIL criteria centralized there.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Remove Duplicate `--parked` Help Wording
**Finding key:** loop-bc8ecec8c4397963ec30
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The updated summary line and the following `With --parked...` line now both say that parked resume restores one exact managed-worktree pointer. This makes the help text repetitive.  
**Suggestion:** Keep the new R7-compliant summary line, and simplify the next line to only add the distinct detail, for example: `With --parked, restore from the pointer's saved execution root.`
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The updated summary line and the following `With --parked...` line now both say that parked resume restores one exact managed-worktree pointer. This makes the help text repetitive.  
**Suggestion:** Keep the new R7-compliant summary line, and simplify the next line to only add the distinct detail, for example: `With --parked, restore from the pointer's saved execution root.`
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Strengthen Atomicity Assertion
**Finding key:** loop-ee45d86cb9f3c7f72a13
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The test says failed inference must leave persisted step state “byte-identical,” but it captures `before` with `structuredClone(state)` and compares with `assert.deepEqual(state, before)`. That verifies structural equality, not byte-identical persisted state, and `deepEqual` may be looser than intended depending on the imported assert API.  
**Suggestion:** Capture a serialized snapshot before execution and compare the same serialization afterward, e.g. `const beforeJson = JSON.stringify(state);` followed by `assert.equal(JSON.stringify(state), beforeJson);`. This better matches the atomicity contract and simplifies the assertion.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The test says failed inference must leave persisted step state “byte-identical,” but it captures `before` with `structuredClone(state)` and compares with `assert.deepEqual(state, before)`. That verifies structural equality, not byte-identical persisted state, and `deepEqual` may be looser than intended depending on the imported assert API.  
**Suggestion:** Capture a serialized snapshot before execution and compare the same serialization afterward, e.g. `const beforeJson = JSON.stringify(state);` followed by `assert.equal(JSON.stringify(state), beforeJson);`. This better matches the atomicity contract and simplifies the assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Rename Test To Match The Specific Failure Boundary
**Finding key:** loop-125afce88fa53f71d420
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R6  
**Issue:** The new test title says “preserves inferred gate steps,” but the test specifically verifies that inferred stale-step recovery is not committed when downstream integration validation fails. “Preserves inferred gate steps” is slightly vague and could be read as preserving the inferred phase selection rather than preserving the pre-transition step state.  
**Suggestion:** Rename the test to something more direct, such as `AC3: does not commit inferred stale-step recovery when integration validation fails`. This aligns the test name with the asserted behavior: no transitions, unchanged state, and no committed-transition stderr.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R6  
**Issue:** The new test title says “preserves inferred gate steps,” but the test specifically verifies that inferred stale-step recovery is not committed when downstream integration validation fails. “Preserves inferred gate steps” is slightly vague and could be read as preserving the inferred phase selection rather than preserving the pre-transition step state.  
**Suggestion:** Rename the test to something more direct, such as `AC3: does not commit inferred stale-step recovery when integration validation fails`. This aligns the test name with the asserted behavior: no transitions, unchanged state, and no committed-transition stderr.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Standardize repair authority metadata shape
**Finding key:** loop-b12e27daacf9720e6b0d
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** `impl-repair.json`, `repair-deltas/repair-006.json`, and `repair-ledger-reconciliation.json` all describe the same repair authority, but proposed fixes use different field names and scopes: `authority/evidence`, top-level `runId/specId/issueId`, `changedPathsDigest`, and `deltaDigest`. This risks creating three incompatible authority schemas for the same R8 evidence chain.  
**Suggestion:** Define one shared authority object shape, for example `authority: { runId, specId, issueId, changedPathInventoryRef, changedPathsDigest, deltaDigest }`, and use it consistently in all three artifacts.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** `impl-repair.json`, `repair-deltas/repair-006.json`, and `repair-ledger-reconciliation.json` all describe the same repair authority, but proposed fixes use different field names and scopes: `authority/evidence`, top-level `runId/specId/issueId`, `changedPathsDigest`, and `deltaDigest`. This risks creating three incompatible authority schemas for the same R8 evidence chain.  
**Suggestion:** Define one shared authority object shape, for example `authority: { runId, specId, issueId, changedPathInventoryRef, changedPathsDigest, deltaDigest }`, and use it consistently in all three artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Reuse fixture authority values across reconciliation tests
**Finding key:** loop-f9c3db140da8485e9a7f
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The reconciliation test hard-codes `repair-006` and `5` while the JSON artifacts also encode those values. This duplicates cross-file fixture data and can let the test drift from `impl-repair.json` or `repair-deltas/repair-006.json`.  
**Suggestion:** Assert against the loaded fixture authority fields, and ensure those fields are sourced from the same canonical repair authority metadata used by the JSON artifacts.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The reconciliation test hard-codes `repair-006` and `5` while the JSON artifacts also encode those values. This duplicates cross-file fixture data and can let the test drift from `impl-repair.json` or `repair-deltas/repair-006.json`.  
**Suggestion:** Assert against the loaded fixture authority fields, and ensure those fields are sourced from the same canonical repair authority metadata used by the JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Consolidate inferred gate transition commit flow
**Finding key:** loop-5ea86b90e331d2844e16
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RunGateCommand.execute()` and `runGatePhaseWithDependencies()` duplicate the inferred-transition persistence sequence, while `GateMutationOwner` owns transition status capture/assertion. The cross-file interface between artifact persistence and transition mutation is therefore spread across multiple call sites.  
**Suggestion:** Extract one shared helper that persists gate artifacts, validates commit eligibility, captures transition status, commits the inferred transition, and rolls back on pre-commit failure. Have both run-gate paths call that helper through the same `GateMutationOwner` interface.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RunGateCommand.execute()` and `runGatePhaseWithDependencies()` duplicate the inferred-transition persistence sequence, while `GateMutationOwner` owns transition status capture/assertion. The cross-file interface between artifact persistence and transition mutation is therefore spread across multiple call sites.  
**Suggestion:** Extract one shared helper that persists gate artifacts, validates commit eligibility, captures transition status, commits the inferred transition, and rolls back on pre-commit failure. Have both run-gate paths call that helper through the same `GateMutationOwner` interface.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 4. Align transition helper naming across source and tests
**Finding key:** loop-cf2bbdca1711ab018482
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R2
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R2  
**Issue:** The test helper `transitionFor(state)` is vague, while production code uses more specific transition concepts such as `captureTransitionStatuses()` and `assertTransitionStatuses()`. The naming mismatch makes it harder to see that the test is constructing the same inferred gate transition contract exercised by production code.  
**Suggestion:** Rename the test helper to match the production vocabulary, such as `createInferredGateTransition()` or `inferredGateTransitionForState()`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R2  
**Issue:** The test helper `transitionFor(state)` is vague, while production code uses more specific transition concepts such as `captureTransitionStatuses()` and `assertTransitionStatuses()`. The naming mismatch makes it harder to see that the test is constructing the same inferred gate transition contract exercised by production code.  
**Suggestion:** Rename the test helper to match the production vocabulary, such as `createInferredGateTransition()` or `inferredGateTransitionForState()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 5. Centralize semantic gate result literals
**Finding key:** loop-d28fd5c225616648fff9
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"pass"` and `"fail"` are repeated in tests while `run-gate.js` also implements semantic-result commit eligibility around those literals. This duplicates protocol values across source and tests.  
**Suggestion:** Export or define a shared protocol constant for semantic gate results, and use it in both production eligibility checks and tests.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"pass"` and `"fail"` are repeated in tests while `run-gate.js` also implements semantic-result commit eligibility around those literals. This duplicates protocol values across source and tests.  
**Suggestion:** Export or define a shared protocol constant for semantic gate results, and use it in both production eligibility checks and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
