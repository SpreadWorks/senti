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

### 9. 1. Extract Shared Scenario Constants
**Finding key:** loop-a00dc9b27e13d539f139
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R5
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` and semantic result list `["pass", "fail"]` are repeated across multiple tests.  
**Suggestion:** Define top-level constants such as `PRE_COMMIT_BOUNDARIES` and `SEMANTIC_RESULTS`, then reuse them in each loop. This reduces drift if a boundary is added or renamed.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` and semantic result list `["pass", "fail"]` are repeated across multiple tests.  
**Suggestion:** Define top-level constants such as `PRE_COMMIT_BOUNDARIES` and `SEMANTIC_RESULTS`, then reuse them in each loop. This reduces drift if a boundary is added or renamed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Clarify Attempt Semantics
**Finding key:** loop-ce9ca7c955e7ef043a44
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R5
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** `attempt === 1` is overloaded to mean “inject the configured failure,” while `attempt === 2` means “retry after fault removal.” This makes tests harder to read, especially where `attempt: 2` is used for successful non-retry dispatch cases.  
**Suggestion:** Replace the numeric branch condition with an explicit boolean such as `injectFailure`, or derive it once in `runBoundaryAttempt` as `const shouldInjectFailure = attempt === 1 && boundary;`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** `attempt === 1` is overloaded to mean “inject the configured failure,” while `attempt === 2` means “retry after fault removal.” This makes tests harder to read, especially where `attempt: 2` is used for successful non-retry dispatch cases.  
**Suggestion:** Replace the numeric branch condition with an explicit boolean such as `injectFailure`, or derive it once in `runBoundaryAttempt` as `const shouldInjectFailure = attempt === 1 && boundary;`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Consolidate JSON Fixture IO Helpers
**Finding key:** loop-449733c983d7ea47406d
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R3
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** The test repeatedly performs `JSON.parse(fs.readFileSync(..., "utf8"))` and `fs.writeFileSync(..., JSON.stringify(...))` patterns. This adds noise around the actual assertions.  
**Suggestion:** Add small local helpers like `readJson(file)` and `writeJson(file, value)` in this test file, then use them for `flow.json`, gate results, issue logs, and spec fixtures.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** The test repeatedly performs `JSON.parse(fs.readFileSync(..., "utf8"))` and `fs.writeFileSync(..., JSON.stringify(...))` patterns. This adds noise around the actual assertions.  
**Suggestion:** Add small local helpers like `readJson(file)` and `writeJson(file, value)` in this test file, then use them for `flow.json`, gate results, issue logs, and spec fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Rename Generic Helper
**Finding key:** loop-693b378cb99f410f374d
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** The helper name `serialized(value)` is very broad and does not communicate why JSON stringification is being used in these tests.  
**Suggestion:** Rename it to something intent-specific, such as `serializeForByteIdentityCheck` or `snapshotJsonState`, so assertions around mutation/persistence atomicity read more clearly.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** The helper name `serialized(value)` is very broad and does not communicate why JSON stringification is being used in these tests.  
**Suggestion:** Rename it to something intent-specific, such as `serializeForByteIdentityCheck` or `snapshotJsonState`, so assertions around mutation/persistence atomicity read more clearly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 5. Remove Or Assert Recorded Metrics
**Finding key:** loop-929f1f3a45848aa200be
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R5
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** `PersistedStaleGateManager` records metrics in `recordedMetrics`, but no test asserts that field. If metric behavior matters, the test is incomplete; if not, the field is dead state.  
**Suggestion:** Either remove `recordedMetrics` and only preserve the interface behavior needed by hooks, or add focused assertions proving retry/failure paths do not create duplicate or unexpected metrics.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** `PersistedStaleGateManager` records metrics in `recordedMetrics`, but no test asserts that field. If metric behavior matters, the test is incomplete; if not, the field is dead state.  
**Suggestion:** Either remove `recordedMetrics` and only preserve the interface behavior needed by hooks, or add focused assertions proving retry/failure paths do not create duplicate or unexpected metrics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Add a timeout to the help command
**Finding key:** loop-19b6dca7667a501d8305
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/parked-resume-help.test.js
**Requirement:** R7
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The `execFileSync` call has no explicit timeout. If the CLI hangs during help generation, the test can block indefinitely, which violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add a bounded timeout to the command options, for example `{ encoding: "utf8", timeout: 5000 }`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The `execFileSync` call has no explicit timeout. If the CLI hangs during help generation, the test can block indefinitely, which violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add a bounded timeout to the command options, for example `{ encoding: "utf8", timeout: 5000 }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Assert both issue guard options explicitly
**Finding key:** loop-3ce38cb553e2c252af1a
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/parked-resume-help.test.js
**Requirement:** R7
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** `assert.match(help, /--expect-issue|--expect-no-issue/)` passes if only one of the two options is present, so it does not fully verify that existing target-guard option output is retained.  
**Suggestion:** Replace it with two explicit assertions: `assert.match(help, /--expect-issue/)` and `assert.match(help, /--expect-no-issue/)`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** `assert.match(help, /--expect-issue|--expect-no-issue/)` passes if only one of the two options is present, so it does not fully verify that existing target-guard option output is retained.  
**Suggestion:** Replace it with two explicit assertions: `assert.match(help, /--expect-issue/)` and `assert.match(help, /--expect-no-issue/)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Reduce repeated assertion boilerplate
**Finding key:** loop-77d00969c1556a702905
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/parked-resume-help.test.js
**Requirement:** R7
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The test repeats several `assert.match(help, ...)` calls with the same shape, which makes future additions slightly noisier and easier to make inconsistent.  
**Suggestion:** Store the expected patterns in an array and loop over them, especially after splitting the issue guard assertion into two checks.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The test repeats several `assert.match(help, ...)` calls with the same shape, which makes future additions slightly noisier and easier to make inconsistent.  
**Suggestion:** Store the expected patterns in an array and loop over them, especially after splitting the issue guard assertion into two checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Replace Hardcoded Expected Values With Fixture Authority Fields
**Finding key:** loop-ec9ac46830d5ec721a7e
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The test hardcodes `repair-006` and `5` even though those values already exist in the reconciliation authority fixture as `bridgeEntryId` and `preservedEntryCount`. This duplicates fixture knowledge and makes the test more brittle if the fixture changes intentionally.  
**Suggestion:** Use `fixture.authority.bridgeEntryId` and `fixture.authority.preservedEntryCount` in assertions and slice bounds.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The test hardcodes `repair-006` and `5` even though those values already exist in the reconciliation authority fixture as `bridgeEntryId` and `preservedEntryCount`. This duplicates fixture knowledge and makes the test more brittle if the fixture changes intentionally.  
**Suggestion:** Use `fixture.authority.bridgeEntryId` and `fixture.authority.preservedEntryCount` in assertions and slice bounds.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Avoid Misleading No-Write Assertions In Prepare-Only Mismatch Test
**Finding key:** loop-74034713296dad83b5b9
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The mismatch test title says it rejects mismatches “before changing ledger or delta bytes,” but the exercised code path only calls `authority.prepare(...)`. If `prepare` is a pure validation/planning method, the file byte checks do not meaningfully prove the no-write behavior and add noisy repeated disk reads.  
**Suggestion:** Either exercise the actual write/apply path that could mutate `impl-repair.json` or the delta file, or simplify the test name and remove the byte-preservation assertions from this prepare-only validation test.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The mismatch test title says it rejects mismatches “before changing ledger or delta bytes,” but the exercised code path only calls `authority.prepare(...)`. If `prepare` is a pure validation/planning method, the file byte checks do not meaningfully prove the no-write behavior and add noisy repeated disk reads.  
**Suggestion:** Either exercise the actual write/apply path that could mutate `impl-repair.json` or the delta file, or simplify the test name and remove the byte-preservation assertions from this prepare-only validation test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Add Explicit Step Traversal Bounds
**Finding key:** loop-ef09c489fa683e5f3daa
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `#transitionStepMap()` calls `flattenSteps()` over `flowState.steps` and `task.steps` without any explicit maximum depth or count. This may violate `bounded-resource-usage` because recursive/bulk step processing has no local bound.  
**Suggestion:** Add a bounded variant or pass explicit limits to `flattenSteps`, then fail with a clear error if the step tree exceeds the allowed depth/count.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `#transitionStepMap()` calls `flattenSteps()` over `flowState.steps` and `task.steps` without any explicit maximum depth or count. This may violate `bounded-resource-usage` because recursive/bulk step processing has no local bound.  
**Suggestion:** Add a bounded variant or pass explicit limits to `flattenSteps`, then fail with a clear error if the step tree exceeds the allowed depth/count.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Clarify Helper Naming
**Finding key:** loop-a011e9752c83f445ae06
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R2  
**Issue:** `#transitionStepMap()` sounds like it maps transitions, but it actually builds a combined map of flow-level and task-level steps.  
**Suggestion:** Rename it to something more direct, such as `#stepMapForTransition()` or `#combinedStepMap()`, to reflect that it returns steps by ID, not transitions.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R2  
**Issue:** `#transitionStepMap()` sounds like it maps transitions, but it actually builds a combined map of flow-level and task-level steps.  
**Suggestion:** Rename it to something more direct, such as `#stepMapForTransition()` or `#combinedStepMap()`, to reflect that it returns steps by ID, not transitions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Simplify Status Capture Construction
**Finding key:** loop-9643947966dd8c72cd20
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R3  
**Issue:** `captureTransitionStatuses()` validates that all tracked steps are `in_progress`, then reconstructs the same list and reads each status again to build the returned map. Since every captured status must be `"in_progress"`, this adds minor duplication.  
**Suggestion:** Build a single `stepIdsToCapture` array once, validate it in one loop, and populate the returned `Map` in that same pass. This reduces repeated list construction and keeps stale/selected validation behavior together.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R3  
**Issue:** `captureTransitionStatuses()` validates that all tracked steps are `in_progress`, then reconstructs the same list and reads each status again to build the returned map. Since every captured status must be `"in_progress"`, this adds minor duplication.  
**Suggestion:** Build a single `stepIdsToCapture` array once, validate it in one loop, and populate the returned `Map` in that same pass. This reduces repeated list construction and keeps stale/selected validation behavior together.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Add bounded checkpoint reads
**Finding key:** loop-951f92baaa1c7c53e4c6
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `GateArtifactCheckpoint` uses `fs.readFileSync(file)` with no explicit size bound. This violates `bounded-resource-usage` for durable surface rollback because checkpointing can load arbitrarily large artifact files into memory.  
**Suggestion:** Use a bounded read helper, or `fs.statSync` with a project-consistent max artifact size before reading. If the file exceeds the bound, fail before mutation rather than checkpointing unbounded content.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `GateArtifactCheckpoint` uses `fs.readFileSync(file)` with no explicit size bound. This violates `bounded-resource-usage` for durable surface rollback because checkpointing can load arbitrarily large artifact files into memory.  
**Suggestion:** Use a bounded read helper, or `fs.statSync` with a project-consistent max artifact size before reading. If the file exceeds the bound, fail before mutation rather than checkpointing unbounded content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Remove identity probe rethrow
**Finding key:** loop-fd04edeea41a6733a706
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `identityProbeError` is stored during stale-evidence probing and rethrown after `validateIntegrationArtifactTrust()` succeeds. That contradicts the nearby comment saying full trust validation owns malformed, missing, and oversized diagnostics, and it makes control flow harder to reason about.  
**Suggestion:** Treat the stale-evidence probe as best-effort: only return `StaleIntegrationTestEvidence` when both artifacts are read and mismatch detection succeeds. Otherwise, discard the probe error and let `validateIntegrationArtifactTrust()` be the single diagnostic path.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `identityProbeError` is stored during stale-evidence probing and rethrown after `validateIntegrationArtifactTrust()` succeeds. That contradicts the nearby comment saying full trust validation owns malformed, missing, and oversized diagnostics, and it makes control flow harder to reason about.  
**Suggestion:** Treat the stale-evidence probe as best-effort: only return `StaleIntegrationTestEvidence` when both artifacts are read and mismatch detection succeeds. Otherwise, discard the probe error and let `validateIntegrationArtifactTrust()` be the single diagnostic path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Extract repeated gate artifact file inventory
**Finding key:** loop-6121e4e31fb6ad88322b
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** Gate artifact filenames are assembled in multiple places: `GateDurableSurfaceCheckpoint`, `runGatePhaseWithDependencies`, and phase-specific persistence paths. This increases the chance that rollback coverage and write paths drift.  
**Suggestion:** Add a small helper such as `gateDurableSurfaceFilesForPhase(phase)` or `gateResultBasenameForPhase(phase)` and reuse it for checkpointing and writes.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** Gate artifact filenames are assembled in multiple places: `GateDurableSurfaceCheckpoint`, `runGatePhaseWithDependencies`, and phase-specific persistence paths. This increases the chance that rollback coverage and write paths drift.  
**Suggestion:** Add a small helper such as `gateDurableSurfaceFilesForPhase(phase)` or `gateResultBasenameForPhase(phase)` and reuse it for checkpointing and writes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Rename boolean predicate for clarity
**Finding key:** loop-21a214930093956e3f96
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `completedSemanticGateResult(result)` reads like it returns a result object, but it returns a boolean.  
**Suggestion:** Rename it to `isCompletedSemanticGateResult(result)` or `hasCompletedSemanticGateResult(result)` to match predicate naming conventions and make call sites clearer.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `completedSemanticGateResult(result)` reads like it returns a result object, but it returns a boolean.  
**Suggestion:** Rename it to `isCompletedSemanticGateResult(result)` or `hasCompletedSemanticGateResult(result)` to match predicate naming conventions and make call sites clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Simplify transition commit state
**Finding key:** loop-f1d21b228ce78b2f174d
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `InferredGateTransition` has a private `#committed` flag and silently returns `[]` on repeated commits. Since R4 requires committing exactly once, silently accepting a second commit can hide lifecycle bugs.  
**Suggestion:** Throw on a second `commit()` call instead of returning an empty array, or rename the behavior explicitly if idempotency is intentional and covered by tests.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `InferredGateTransition` has a private `#committed` flag and silently returns `[]` on repeated commits. Since R4 requires committing exactly once, silently accepting a second commit can hide lifecycle bugs.  
**Suggestion:** Throw on a second `commit()` call instead of returning an empty array, or rename the behavior explicitly if idempotency is intentional and covered by tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Reduce duplicated `--parked` help phrasing
**Finding key:** loop-9957c057c42c2c2c4d1b
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The new help line repeats details already covered by the following two `--parked` lines: “one exact managed-worktree pointer” and “no discovery.” This makes the help slightly redundant and harder to scan.  
**Suggestion:** Keep the first summary concise, for example: `Show active flow context; --parked restores a saved inactive context.` Then retain the more specific existing lines that explain exact managed-worktree pointer behavior, saved execution root, guards, and no discovery.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The new help line repeats details already covered by the following two `--parked` lines: “one exact managed-worktree pointer” and “no discovery.” This makes the help slightly redundant and harder to scan.  
**Suggestion:** Keep the first summary concise, for example: `Show active flow context; --parked restores a saved inactive context.` Then retain the more specific existing lines that explain exact managed-worktree pointer behavior, saved execution root, guards, and no discovery.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Rename Test To Reflect Atomicity Failure Case
**Finding key:** loop-2d49ad98e3181ae39db8
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** The new test title says “preserves inferred gate steps,” but the asserted behavior is broader: no transitions, byte-identical state, and no stderr claim of a committed transition when downstream validation fails.
**Suggestion:** Rename the test to make the atomicity boundary explicit, for example: `AC3: leaves gate state byte-identical when inferred integration validation fails before commit`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** The new test title says “preserves inferred gate steps,” but the asserted behavior is broader: no transitions, byte-identical state, and no stderr claim of a committed transition when downstream validation fails.
**Suggestion:** Rename the test to make the atomicity boundary explicit, for example: `AC3: leaves gate state byte-identical when inferred integration validation fails before commit`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Replace Ambiguous `before` Name
**Finding key:** loop-196bcb733ce019fe3fda
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** `before` is a vague name and can be confused with Mocha’s `before` hook terminology.
**Suggestion:** Rename it to `preTransitionSnapshot` or `stateBeforeExecute` so the assertion intent is clear: `assert.deepEqual(state, preTransitionSnapshot);`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** `before` is a vague name and can be confused with Mocha’s `before` hook terminology.
**Suggestion:** Rename it to `preTransitionSnapshot` or `stateBeforeExecute` so the assertion intent is clear: `assert.deepEqual(state, preTransitionSnapshot);`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Tighten Unused Outcome Capture
**Finding key:** loop-372596e41bbe4205ad1f
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** `downstreamError` and `downstreamResult` are assigned but not asserted. That makes the test slightly harder to read because those variables imply later validation that never happens.
**Suggestion:** Either assert that one of the two downstream outcomes occurred, or remove the variables and simply swallow the expected downstream failure path. A minimal assertion would be: `assert.ok(downstreamError || downstreamResult, "expected downstream gate path to throw or return");`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** `downstreamError` and `downstreamResult` are assigned but not asserted. That makes the test slightly harder to read because those variables imply later validation that never happens.
**Suggestion:** Either assert that one of the two downstream outcomes occurred, or remove the variables and simply swallow the expected downstream failure path. A minimal assertion would be: `assert.ok(downstreamError || downstreamResult, "expected downstream gate path to throw or return");`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Simplify Stderr Assertion Pattern
**Finding key:** loop-424efa9d5bbcf0b7254d
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** The regex `/gate: stale in_progress step|committed phase=/` relies on alternation precedence and is less readable than it needs to be.
**Suggestion:** Use a grouped alternation: `/(?:gate: stale in_progress step|committed phase=)/`. This keeps the same behavior while making the intended two forbidden stderr fragments explicit.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** The regex `/gate: stale in_progress step|committed phase=/` relies on alternation precedence and is less readable than it needs to be.
**Suggestion:** Use a grouped alternation: `/(?:gate: stale in_progress step|committed phase=)/`. This keeps the same behavior while making the intended two forbidden stderr fragments explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Standardize Authority Metadata Shape
**Finding key:** loop-42773611e7a345a6ec19
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`
**Requirement:** R8
**Issue:** Both `impl-repair.json` and `repair-deltas/repair-006.json` are proposed to add explicit authority binding metadata, but the summaries suggest different possible field shapes: top-level `runId/specId/issueId` versus an `authority` or `evidence` object. Introducing these independently could create inconsistent authority interfaces across the ledger and delta artifact.
**Suggestion:** Define one shared schema, preferably a nested `authority` object with the same required keys in both files, then update tests and reconciliation code to read that exact shape.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`
**Requirement:** R8
**Issue:** Both `impl-repair.json` and `repair-deltas/repair-006.json` are proposed to add explicit authority binding metadata, but the summaries suggest different possible field shapes: top-level `runId/specId/issueId` versus an `authority` or `evidence` object. Introducing these independently could create inconsistent authority interfaces across the ledger and delta artifact.
**Suggestion:** Define one shared schema, preferably a nested `authority` object with the same required keys in both files, then update tests and reconciliation code to read that exact shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Align Delta Digest Naming Across Artifacts
**Finding key:** loop-7dfd8a8bb33ee73822ec
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.json`
**Requirement:** R8
**Issue:** The reconciliation fixture uses `changedPathsDigest`, while other proposals refer to binding a full `delta digest`. If `impl-repair.json`, `repair-deltas/repair-006.json`, and `repair-ledger-reconciliation.json` use different names or meanings for the same integrity value, validation code can drift or bind the wrong evidence.
**Suggestion:** Use distinct, consistent names everywhere, such as `changedPathsDigest` for the path inventory hash and `deltaDigest` for the full delta artifact hash, and require both fields wherever R8 authority binding is represented.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.json`
**Requirement:** R8
**Issue:** The reconciliation fixture uses `changedPathsDigest`, while other proposals refer to binding a full `delta digest`. If `impl-repair.json`, `repair-deltas/repair-006.json`, and `repair-ledger-reconciliation.json` use different names or meanings for the same integrity value, validation code can drift or bind the wrong evidence.
**Suggestion:** Use distinct, consistent names everywhere, such as `changedPathsDigest` for the path inventory hash and `deltaDigest` for the full delta artifact hash, and require both fields wherever R8 authority binding is represented.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Consolidate JSON Serialization Helper Naming
**Finding key:** loop-8057194c1622160b7064
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`
**Requirement:** R8
**Issue:** Both `repair-ledger-reconciliation.js` and `tests/gate-failure-atomicity.test.js` have a broadly named `serialized` helper and separate proposals to rename it. Renaming them independently to different concepts could preserve cross-file naming drift for the same byte/comparable JSON purpose.
**Suggestion:** Pick one convention for deterministic JSON comparison helpers, such as `serializeForExactComparison`, and reuse that naming across production reconciliation code and tests unless the semantics truly differ.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`
**Requirement:** R8
**Issue:** Both `repair-ledger-reconciliation.js` and `tests/gate-failure-atomicity.test.js` have a broadly named `serialized` helper and separate proposals to rename it. Renaming them independently to different concepts could preserve cross-file naming drift for the same byte/comparable JSON purpose.
**Suggestion:** Pick one convention for deterministic JSON comparison helpers, such as `serializeForExactComparison`, and reuse that naming across production reconciliation code and tests unless the semantics truly differ.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 4. Reuse Gate Artifact Inventory Between Runtime And Tests
**Finding key:** loop-7cc20136c5a4cfad5a37
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R3
**Issue:** `run-gate.js` has duplicated gate artifact filename construction, while `gate-failure-atomicity.test.js` also repeatedly reads and writes gate result artifacts directly. If runtime artifact names are centralized but tests keep their own implicit inventory, rollback coverage and assertions can still drift from write paths.
**Suggestion:** Export or locally share a small artifact inventory helper, then have both checkpoint/write logic and relevant tests derive gate result paths from the same source.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R3
**Issue:** `run-gate.js` has duplicated gate artifact filename construction, while `gate-failure-atomicity.test.js` also repeatedly reads and writes gate result artifacts directly. If runtime artifact names are centralized but tests keep their own implicit inventory, rollback coverage and assertions can still drift from write paths.
**Suggestion:** Export or locally share a small artifact inventory helper, then have both checkpoint/write logic and relevant tests derive gate result paths from the same source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 5. Normalize Predicate Naming For Gate Result Semantics
**Finding key:** loop-5cff051fe24d799f99a7
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R4
**Issue:** `completedSemanticGateResult(result)` is proposed to become a predicate, while tests use repeated semantic result lists such as `["pass", "fail"]`. Without a shared naming pattern, boolean helpers and semantic-result fixtures may describe the same concept differently across files.
**Suggestion:** Rename the runtime helper to `isCompletedSemanticGateResult` and consider reusing that semantic terminology in test constants, for example `COMPLETED_SEMANTIC_GATE_RESULTS`, so result-state naming is consistent across runtime and tests.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R4
**Issue:** `completedSemanticGateResult(result)` is proposed to become a predicate, while tests use repeated semantic result lists such as `["pass", "fail"]`. Without a shared naming pattern, boolean helpers and semantic-result fixtures may describe the same concept differently across files.
**Suggestion:** Rename the runtime helper to `isCompletedSemanticGateResult` and consider reusing that semantic terminology in test constants, for example `COMPLETED_SEMANTIC_GATE_RESULTS`, so result-state naming is consistent across runtime and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
