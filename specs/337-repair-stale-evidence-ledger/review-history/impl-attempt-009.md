# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Add an execution timeout to the spawned test run
**Finding key:** loop-e197ef1a985b00fa6cdd
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `spawnSync()` can wait indefinitely if one of the nested test suites hangs. This violates the bounded-resource-usage guardrail because the subprocess execution has no explicit upper bound.  
**Suggestion:** Add a reasonable `timeout` option to `spawnSync`, for example:

```js
const result = spawnSync(process.execPath, ["--test", ...AFFECTED_SHARED_SUITES], {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
  env: standaloneTestEnvironment(),
  timeout: 120_000,
});
```
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `spawnSync()` can wait indefinitely if one of the nested test suites hangs. This violates the bounded-resource-usage guardrail because the subprocess execution has no explicit upper bound.  
**Suggestion:** Add a reasonable `timeout` option to `spawnSync`, for example:

```js
const result = spawnSync(process.execPath, ["--test", ...AFFECTED_SHARED_SUITES], {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
  env: standaloneTestEnvironment(),
  timeout: 120_000,
});
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Improve the suite list name to reflect paths, not suite objects
**Finding key:** loop-824fc7e07cd8b3365cf3
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` sounds like it may contain suite definitions, but it actually contains file paths passed to `node --test`.  
**Suggestion:** Rename it to something more precise, such as `AFFECTED_SHARED_SUITE_PATHS`, and update the spread usage accordingly.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` sounds like it may contain suite definitions, but it actually contains file paths passed to `node --test`.  
**Suggestion:** Rename it to something more precise, such as `AFFECTED_SHARED_SUITE_PATHS`, and update the spread usage accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Add a Timeout to Shared Suite Execution
**Finding key:** loop-cf6d882289128fd35620
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** `runSharedSuites()` invokes `spawnSync()` without a timeout. If the shared lifecycle suite hangs, this test can block indefinitely, violating the bounded-resource-usage guardrail.  
**Suggestion:** Pass an explicit `timeout` option to `spawnSync`, for example `timeout: 120_000`, and include timeout diagnostics in the assertion message.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** `runSharedSuites()` invokes `spawnSync()` without a timeout. If the shared lifecycle suite hangs, this test can block indefinitely, violating the bounded-resource-usage guardrail.  
**Suggestion:** Pass an explicit `timeout` option to `spawnSync`, for example `timeout: 120_000`, and include timeout diagnostics in the assertion message.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Extract Recovery Entrypoint Assertions
**Finding key:** loop-cee3b0b6949f67118890
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R4
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R4  
**Issue:** The gate/final-regression/acceptance recovery setup and assertions are repeated in the R3 and R8 tests: create fixture, recover through entrypoint, assert one lifecycle update, no mutation, transaction cleared, and next step is `test-execute`.  
**Suggestion:** Introduce a helper such as `assertEntrypointRecovery({ recover, expectedShape })` or separate focused helpers for gate/final/acceptance to centralize the common lifecycle authority checks.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R4  
**Issue:** The gate/final-regression/acceptance recovery setup and assertions are repeated in the R3 and R8 tests: create fixture, recover through entrypoint, assert one lifecycle update, no mutation, transaction cleared, and next step is `test-execute`.  
**Suggestion:** Introduce a helper such as `assertEntrypointRecovery({ recover, expectedShape })` or separate focused helpers for gate/final/acceptance to centralize the common lifecycle authority checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Centralize Transaction File Existence Checks
**Finding key:** loop-03b35e773cd54246ace2
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R5
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** `fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE))` appears repeatedly with both `true` and `false` expectations, making the tests noisy and slightly inconsistent.  
**Suggestion:** Add small helpers like `assertTransactionFileExists(fixture)` and `assertTransactionFileAbsent(fixture)`, or extend `assertPendingOwnedTransaction()` with a paired committed-state helper.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** `fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE))` appears repeatedly with both `true` and `false` expectations, making the tests noisy and slightly inconsistent.  
**Suggestion:** Add small helpers like `assertTransactionFileExists(fixture)` and `assertTransactionFileAbsent(fixture)`, or extend `assertPendingOwnedTransaction()` with a paired committed-state helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 4. Split the Large R9 Matrix Test
**Finding key:** loop-66eec433c3ae0b9a2c7f
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The R9 test covers current evidence, inconsistent fingerprints, malformed JSON, and failed transaction state in one long test body. This makes failures harder to localize and increases setup duplication inside one broad scenario.  
**Suggestion:** Split it into focused tests, for example current evidence path, inconsistent fingerprint rejection, malformed evidence fail-closed behavior, and pending transaction recovery state. Shared setup can remain in `createFixture()`.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The R9 test covers current evidence, inconsistent fingerprints, malformed JSON, and failed transaction state in one long test body. This makes failures harder to localize and increases setup duplication inside one broad scenario.  
**Suggestion:** Split it into focused tests, for example current evidence path, inconsistent fingerprint rejection, malformed evidence fail-closed behavior, and pending transaction recovery state. Shared setup can remain in `createFixture()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 5. Replace Hard-Coded Spec Directory Strings in Rewind Fixture
**Finding key:** loop-ab7a8809d63be4b183da
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R8
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R8  
**Issue:** `createRewindFixture()` mixes `REWIND_SPEC_PATH`, `REWIND_SPEC_ID`, and repeated template strings like ``specs/${REWIND_SPEC_ID}/...``. This duplicates path construction and makes future fixture changes error-prone.  
**Suggestion:** Add a helper such as `rewindSpecFile(name)` or derive paths from a single `REWIND_SPEC_DIR` constant. Use it for `impl-review.json`, `test-result-review.json`, raw output, issue log, and related artifacts.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R8  
**Issue:** `createRewindFixture()` mixes `REWIND_SPEC_PATH`, `REWIND_SPEC_ID`, and repeated template strings like ``specs/${REWIND_SPEC_ID}/...``. This duplicates path construction and makes future fixture changes error-prone.  
**Suggestion:** Add a helper such as `rewindSpecFile(name)` or derive paths from a single `REWIND_SPEC_DIR` constant. Use it for `impl-review.json`, `test-result-review.json`, raw output, issue log, and related artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Replace JSON String Equality With Shared Artifact Equality Helper
**Finding key:** loop-8768c59b03e8d03c1525
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** The change adds `equals()` methods for transactions and targets, but `CommittedImplRepairEffects.reconcileJournal()` still performs repeated `JSON.stringify(...toJSON())` comparisons for ledger and manifest equality. This keeps two equality styles in the same file and makes future schema changes easier to miss.  
**Suggestion:** Add a small helper such as `sameJsonArtifact(left, right)` or add `equals()` methods to `ImplRepairLedger` / manifest classes if consistent with existing patterns, then use it in `reconcileJournal()` and the existing transaction comparisons.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** The change adds `equals()` methods for transactions and targets, but `CommittedImplRepairEffects.reconcileJournal()` still performs repeated `JSON.stringify(...toJSON())` comparisons for ledger and manifest equality. This keeps two equality styles in the same file and makes future schema changes easier to miss.  
**Suggestion:** Add a small helper such as `sameJsonArtifact(left, right)` or add `equals()` methods to `ImplRepairLedger` / manifest classes if consistent with existing patterns, then use it in `reconcileJournal()` and the existing transaction comparisons.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Extract Repeated Flow State Reload Logic
**Finding key:** loop-a82a08d2c4c03a5e95b5
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The load fallback logic appears in both `commitOwnedTestEvidenceRefresh()` and `commitOwnedImplRepairEffects()`:
`loadReadOnly` if present, otherwise `load`. This duplication is small but lifecycle recovery correctness depends on consistently reloading committed state.  
**Suggestion:** Extract a helper like `loadRepairState(flowManager, specId, fallbackState)` and use it in both places. That would centralize the read-only preference and reduce drift in recovery paths.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The load fallback logic appears in both `commitOwnedTestEvidenceRefresh()` and `commitOwnedImplRepairEffects()`:
`loadReadOnly` if present, otherwise `load`. This duplication is small but lifecycle recovery correctness depends on consistently reloading committed state.  
**Suggestion:** Extract a helper like `loadRepairState(flowManager, specId, fallbackState)` and use it in both places. That would centralize the read-only preference and reduce drift in recovery paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Avoid JSON Serialization In `ImplRepairTargetIdentity.equals`
**Finding key:** loop-df8e10545b8d8718a498
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `ImplRepairTargetIdentity.equals()` compares `toJSON()` output via `JSON.stringify()`. For this fixed identity shape, serialization is heavier and less explicit than direct field comparison. It also hides the important distinction between “no issue” and issue values behind object construction order.  
**Suggestion:** Compare fields directly:
`runId`, `spec`, `hasIssue`, and `issue`. Keep construction normalization, but make equality reflect the identity invariant plainly.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `ImplRepairTargetIdentity.equals()` compares `toJSON()` output via `JSON.stringify()`. For this fixed identity shape, serialization is heavier and less explicit than direct field comparison. It also hides the important distinction between “no issue” and issue values behind object construction order.  
**Suggestion:** Compare fields directly:
`runId`, `spec`, `hasIssue`, and `issue`. Keep construction normalization, but make equality reflect the identity invariant plainly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Remove Or Justify The `removeJournal` Flag
**Finding key:** loop-60860dd7c964144a979f
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `commitRepairTransaction()` now has both `commitFlowState` and `removeJournal` flags. The `removeJournal: false` mode is only used by `commitOwnedImplRepairEffects()`, which immediately removes the journal after clearing the intent. This increases the number of partial-commit states the reader has to reason about.  
**Suggestion:** Consider splitting the low-level effect commit into a journal-preserving helper instead of adding another boolean mode to `commitRepairTransaction()`, or rename the function to make the journal lifecycle explicit. This would make retry and failure-boundary behavior easier to audit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `commitRepairTransaction()` now has both `commitFlowState` and `removeJournal` flags. The `removeJournal: false` mode is only used by `commitOwnedImplRepairEffects()`, which immediately removes the journal after clearing the intent. This increases the number of partial-commit states the reader has to reason about.  
**Suggestion:** Consider splitting the low-level effect commit into a journal-preserving helper instead of adding another boolean mode to `commitRepairTransaction()`, or rename the function to make the journal lifecycle explicit. This would make retry and failure-boundary behavior easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 5. Extract Current-Effect Checks From `CommittedImplRepairEffects`
**Finding key:** loop-fd01e091220cb8750d84
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `CommittedImplRepairEffects.reconcileJournal()` computes delta, ledger, manifest, lifecycle, and invalidation freshness inline. The method mixes several independent checks with recovery behavior, making it harder to see which durable effect failed.  
**Suggestion:** Extract named methods such as `isDeltaCurrent()`, `isLedgerCurrent()`, `isManifestCurrent()`, `isLifecycleCurrent()`, and `areInvalidationsCurrent()`. This keeps the reconciliation policy compact and improves diagnosability without changing behavior.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `CommittedImplRepairEffects.reconcileJournal()` computes delta, ledger, manifest, lifecycle, and invalidation freshness inline. The method mixes several independent checks with recovery behavior, making it harder to see which durable effect failed.  
**Suggestion:** Extract named methods such as `isDeltaCurrent()`, `isLedgerCurrent()`, `isManifestCurrent()`, `isLifecycleCurrent()`, and `areInvalidationsCurrent()`. This keeps the reconciliation policy compact and improves diagnosability without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Align abstract method signature and error wording
**Finding key:** loop-7fca8c393043b6448f80
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R3  
**Issue:** `applyTo()` documents the expected implementation shape in its error message (`applyTo(state)`), but the new `completeIn()` method does not. That makes the abstract API less self-documenting and inconsistent with the existing pattern.  
**Suggestion:** Change the default method/error to mirror `applyTo`, for example `completeIn(state)` and `"step transition commit intent must implement completeIn(state)"`, assuming completion also mutates or derives from transition state.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R3  
**Issue:** `applyTo()` documents the expected implementation shape in its error message (`applyTo(state)`), but the new `completeIn()` method does not. That makes the abstract API less self-documenting and inconsistent with the existing pattern.  
**Suggestion:** Change the default method/error to mirror `applyTo`, for example `completeIn(state)` and `"step transition commit intent must implement completeIn(state)"`, assuming completion also mutates or derives from transition state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Extract the repeated lifecycle step sequence
**Finding key:** loop-5a91576a7f46fd6c9542
**Failure mode:** refactor
**File:** tests/e2e/231-task-e2e-full-lifecycle.test.js
**Requirement:** R7
**Issue:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R7  
**Issue:** The test now contains a repeated pattern of `runEnvelope(...)` followed by `assertNext(...)` for lifecycle progression. The newly added recovery path adds another inline sequence for `test-execute -> test-result-review -> impl-review -> impl-gate`, making the test longer and harder to scan.  
**Suggestion:** Extract a small helper inside this test file, such as `runStepAndAssertNext(tmp, command, next)` or a lifecycle-specific helper like `runRecoveredEvidenceRefresh(tmp)`, to remove repetition while keeping the scenario intent clear.
**Suggestion:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R7  
**Issue:** The test now contains a repeated pattern of `runEnvelope(...)` followed by `assertNext(...)` for lifecycle progression. The newly added recovery path adds another inline sequence for `test-execute -> test-result-review -> impl-review -> impl-gate`, making the test longer and harder to scan.  
**Suggestion:** Extract a small helper inside this test file, such as `runStepAndAssertNext(tmp, command, next)` or a lifecycle-specific helper like `runRecoveredEvidenceRefresh(tmp)`, to remove repetition while keeping the scenario intent clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Name the recovery gate result more specifically
**Finding key:** loop-cd400d0dd0cd09dc5ca7
**Failure mode:** refactor
**File:** tests/e2e/231-task-e2e-full-lifecycle.test.js
**Requirement:** R7
**Issue:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R7  
**Issue:** `recoveredGate` is understandable locally, but it does not communicate that this is the integration gate result after stale evidence recovery. In a long lifecycle test, more precise naming would make the assertion block easier to follow.  
**Suggestion:** Rename `recoveredGate` to something like `staleEvidenceRecoveryGate` or `integrationRecoveryGateResult`.
**Suggestion:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R7  
**Issue:** `recoveredGate` is understandable locally, but it does not communicate that this is the integration gate result after stale evidence recovery. In a long lifecycle test, more precise naming would make the assertion block easier to follow.  
**Suggestion:** Rename `recoveredGate` to something like `staleEvidenceRecoveryGate` or `integrationRecoveryGateResult`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Avoid embedding the repair source content inline
**Finding key:** loop-825af36c4cb35bc8bc72
**Failure mode:** refactor
**File:** tests/e2e/231-task-e2e-full-lifecycle.test.js
**Requirement:** R7
**Issue:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R7  
**Issue:** The added `writeFile(..., "src/value.js", [...].join("\n"))` block embeds fixture source text directly in the middle of the lifecycle assertions. This distracts from the test flow and makes future fixture edits more error-prone.  
**Suggestion:** Extract the repaired implementation text to a local constant with a descriptive name, for example `const repairedValueImplementation = [...]`, or a small helper like `writeMaterialImplementationChange(tmp)`.
**Suggestion:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R7  
**Issue:** The added `writeFile(..., "src/value.js", [...].join("\n"))` block embeds fixture source text directly in the middle of the lifecycle assertions. This distracts from the test flow and makes future fixture edits more error-prone.  
**Suggestion:** Extract the repaired implementation text to a local constant with a descriptive name, for example `const repairedValueImplementation = [...]`, or a small helper like `writeMaterialImplementationChange(tmp)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Centralize repair state fixture creation
**Finding key:** loop-014cbce5948c84543560
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The newly added `runId` fields are embedded in repeated inline `state` fixtures. This makes future state-shape changes easy to miss across tests and increases fixture drift.  
**Suggestion:** Extract a small helper such as `createRepairState({ runId, spec = "specs/demo/spec.json" })` in this test file and use it for these repair-state setups. This keeps `runId`, `spec`, and common `steps` structure consistent while still allowing each test to override the run identity it needs.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** The newly added `runId` fields are embedded in repeated inline `state` fixtures. This makes future state-shape changes easy to miss across tests and increases fixture drift.  
**Suggestion:** Extract a small helper such as `createRepairState({ runId, spec = "specs/demo/spec.json" })` in this test file and use it for these repair-state setups. This keeps `runId`, `spec`, and common `steps` structure consistent while still allowing each test to override the run identity it needs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Extract shared impl-repair test state setup
**Finding key:** loop-3da0ab4f37f01d98be27
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** The same `state` shape is duplicated across tests, and the newly added `runId: "run-impl-repair-intent-recovery"` repeats a long scenario-specific literal. This makes future fixture changes easy to miss in one test.  
**Suggestion:** Add a small helper such as `createImplRepairState(overrides = {})` that returns the common state object, including `runId`, `spec`, `steps`, `tasks`, and `transitions`. Tests can override only the fields relevant to each scenario.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** The same `state` shape is duplicated across tests, and the newly added `runId: "run-impl-repair-intent-recovery"` repeats a long scenario-specific literal. This makes future fixture changes easy to miss in one test.  
**Suggestion:** Add a small helper such as `createImplRepairState(overrides = {})` that returns the common state object, including `runId`, `spec`, `steps`, `tasks`, and `transitions`. Tests can override only the fields relevant to each scenario.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Extract the flow manager test double
**Finding key:** loop-a6c4de288c031d5c2b89
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** The inline `flowManager` stub now needs coordinated methods: `load`, `loadReadOnly`, `mutate`, and `completeStepTransitionIntent`. Keeping this inline makes the intent less clear and increases duplication if other tests need the same recovery behavior.  
**Suggestion:** Introduce a helper such as `createFlowManagerDouble(state)` in this test file. It can encapsulate the shared behavior and make each test focus on the recovery scenario being asserted.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** The inline `flowManager` stub now needs coordinated methods: `load`, `loadReadOnly`, `mutate`, and `completeStepTransitionIntent`. Keeping this inline makes the intent less clear and increases duplication if other tests need the same recovery behavior.  
**Suggestion:** Introduce a helper such as `createFlowManagerDouble(state)` in this test file. It can encapsulate the shared behavior and make each test focus on the recovery scenario being asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Extract shared transition-application logic
**Finding key:** loop-ec6c727f9c4ff135ca19
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R1  
**Issue:** The inline `updateStepStatus()` mock now contains several behavior details: commit assertion, step lookup, status mutation, timestamp cleanup, and commit application. This makes the fixture harder to scan and duplicates production-like transition semantics inside the test body.  
**Suggestion:** Extract a small local helper such as `applyStepTransition(state, transition, commitIntent)` near the test fixtures, then call it from `updateStepStatus()`. This keeps the mock focused on repository shape while making the transition behavior reusable if the test needs another repository method later.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R1  
**Issue:** The inline `updateStepStatus()` mock now contains several behavior details: commit assertion, step lookup, status mutation, timestamp cleanup, and commit application. This makes the fixture harder to scan and duplicates production-like transition semantics inside the test body.  
**Suggestion:** Extract a small local helper such as `applyStepTransition(state, transition, commitIntent)` near the test fixtures, then call it from `updateStepStatus()`. This keeps the mock focused on repository shape while making the transition behavior reusable if the test needs another repository method later.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Collapse identical state-loading methods
**Finding key:** loop-72c975eb828262e63daa
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R2  
**Issue:** `load()` and `loadReadOnly()` both return the same mutable `state` object. The duplication is minor, but it obscures that the test intentionally treats read-only loading as the same in-memory fixture behavior.  
**Suggestion:** Define one local function, for example `const loadState = () => state;`, and assign both `load: loadState` and `loadReadOnly: loadState`. This makes the intentional equivalence explicit.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R2  
**Issue:** `load()` and `loadReadOnly()` both return the same mutable `state` object. The duplication is minor, but it obscures that the test intentionally treats read-only loading as the same in-memory fixture behavior.  
**Suggestion:** Define one local function, for example `const loadState = () => state;`, and assign both `load: loadState` and `loadReadOnly: loadState`. This makes the intentional equivalence explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Centralize spawned shared-suite execution
**Finding key:** loop-efada7cfdbd3b3b80dfb
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** Two test files introduce `spawnSync(process.execPath, ["--test", ...])` style shared-suite execution, and both reviews independently flag the missing timeout. This is a cross-file duplication that can drift in timeout, env, cwd, and diagnostics behavior.  
**Suggestion:** Extract a shared test helper for running affected shared suites with a fixed timeout and consistent failure output, then use it from both stale-evidence regression test files.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** Two test files introduce `spawnSync(process.execPath, ["--test", ...])` style shared-suite execution, and both reviews independently flag the missing timeout. This is a cross-file duplication that can drift in timeout, env, cwd, and diagnostics behavior.  
**Suggestion:** Extract a shared test helper for running affected shared suites with a fixed timeout and consistent failure output, then use it from both stale-evidence regression test files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Use one naming convention for shared-suite path collections
**Finding key:** loop-1ee3951cf2dcf2953da7
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` is proposed for rename because it contains paths, while `runSharedSuites()` in the companion test file also uses “suites” wording around path-based execution. The naming ambiguity exists across files, not just locally.  
**Suggestion:** Standardize on `*SUITE_PATHS` for arrays of file paths and reserve `*Suites` for executable helpers or suite definitions.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` is proposed for rename because it contains paths, while `runSharedSuites()` in the companion test file also uses “suites” wording around path-based execution. The naming ambiguity exists across files, not just locally.  
**Suggestion:** Standardize on `*SUITE_PATHS` for arrays of file paths and reserve `*Suites` for executable helpers or suite definitions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Share repair-state fixture builders across unit tests
**Finding key:** loop-9b6aec4c0715aba2bd49
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Multiple unit tests now duplicate repair flow state shapes with `runId`, `spec`, `steps`, `tasks`, and `transitions`. Per-file helpers would reduce local noise, but separate helpers in each file may still drift as the repair-state interface evolves.  
**Suggestion:** Add a small shared unit-test fixture factory, for example under `tests/unit/flow/helpers/`, and let repair-state identity and impl-repair step tests override only scenario-specific fields.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Multiple unit tests now duplicate repair flow state shapes with `runId`, `spec`, `steps`, `tasks`, and `transitions`. Per-file helpers would reduce local noise, but separate helpers in each file may still drift as the repair-state interface evolves.  
**Suggestion:** Add a small shared unit-test fixture factory, for example under `tests/unit/flow/helpers/`, and let repair-state identity and impl-repair step tests override only scenario-specific fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Share flow-manager recovery doubles across tests
**Finding key:** loop-30319f7befe41198b467
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** Several tests model the same flow manager contract: `load`, `loadReadOnly`, mutation, and transition completion. Keeping separate inline doubles risks inconsistent behavior around read-only reload and commit intent completion.  
**Suggestion:** Introduce a shared flow-manager test double that implements the recovery-facing interface once, with optional hooks for scenario-specific assertions.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** Several tests model the same flow manager contract: `load`, `loadReadOnly`, mutation, and transition completion. Keeping separate inline doubles risks inconsistent behavior around read-only reload and commit intent completion.  
**Suggestion:** Introduce a shared flow-manager test double that implements the recovery-facing interface once, with optional hooks for scenario-specific assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Align production and test naming around transition completion
**Finding key:** loop-0a796e9113174a01af98
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R3  
**Issue:** The production interface adds `completeIn()`, while tests and doubles refer to `completeStepTransitionIntent`. The concepts are related but named at different abstraction levels, making it harder to tell which object owns transition completion semantics.  
**Suggestion:** Keep the names intentionally distinct only if one is policy-level and one is flow-manager-level; otherwise align terminology in method names, test helpers, and assertion labels so “complete transition intent” means the same thing across files.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R3  
**Issue:** The production interface adds `completeIn()`, while tests and doubles refer to `completeStepTransitionIntent`. The concepts are related but named at different abstraction levels, making it harder to tell which object owns transition completion semantics.  
**Suggestion:** Keep the names intentionally distinct only if one is policy-level and one is flow-manager-level; otherwise align terminology in method names, test helpers, and assertion labels so “complete transition intent” means the same thing across files.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
