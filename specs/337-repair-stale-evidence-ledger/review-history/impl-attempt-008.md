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

### 3. 1. Add a timeout to shared suite execution
**Finding key:** loop-dba2cb3a0a9764ed8a74
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** `runSharedSuites()` uses `spawnSync()` without a `timeout`, so a hung shared lifecycle test can block this spec indefinitely. This violates the bounded-resource-usage guardrail.  
**Suggestion:** Pass an explicit timeout to `spawnSync`, for example `{ timeout: 120_000 }`, and assert/report timeout failures clearly.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** `runSharedSuites()` uses `spawnSync()` without a `timeout`, so a hung shared lifecycle test can block this spec indefinitely. This violates the bounded-resource-usage guardrail.  
**Suggestion:** Pass an explicit timeout to `spawnSync`, for example `{ timeout: 120_000 }`, and assert/report timeout failures clearly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Extract repeated entrypoint recovery assertions
**Finding key:** loop-adebc073ec2a97fb95d8
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The gate/final-regression/acceptance recovery setup and assertions are duplicated across the R3 and R8 tests. This makes future behavior changes easy to update in one test but miss in the other.  
**Suggestion:** Add a helper such as `assertRecoveryEntrypointsUseLifecycleTransition()` or `recoverAllEntrypoints()` that creates the three fixtures, runs the recoveries, and returns normalized results/counters for assertions.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The gate/final-regression/acceptance recovery setup and assertions are duplicated across the R3 and R8 tests. This makes future behavior changes easy to update in one test but miss in the other.  
**Suggestion:** Add a helper such as `assertRecoveryEntrypointsUseLifecycleTransition()` or `recoverAllEntrypoints()` that creates the three fixtures, runs the recoveries, and returns normalized results/counters for assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Replace repeated transaction-file existence checks with helpers
**Finding key:** loop-6fee219b23d9f95c8e77
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R5
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** The test repeatedly spells out `fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE))` and ledger file reads. This obscures the transaction-state assertions and creates noisy duplication.  
**Suggestion:** Introduce small helpers like `transactionFileExists(fixture)`, `readTransactionFile(fixture)`, and `readLedgerBytes(fixture)` to keep assertions focused on behavior.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** The test repeatedly spells out `fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE))` and ledger file reads. This obscures the transaction-state assertions and creates noisy duplication.  
**Suggestion:** Introduce small helpers like `transactionFileExists(fixture)`, `readTransactionFile(fixture)`, and `readLedgerBytes(fixture)` to keep assertions focused on behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 4. Split the broad R9 regression matrix
**Finding key:** loop-625f04fc5b5abe8b5225
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The R9 test covers current evidence, inconsistent fingerprints, malformed JSON, final regression pass-through, and pending transaction behavior in one long test. Failures will be harder to localize, and setup for unrelated cases is interleaved.  
**Suggestion:** Split it into smaller tests by scenario, for example current evidence pass-through, malformed evidence fail-closed, inconsistent fingerprint rejection, and pending transaction lifecycle recovery.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The R9 test covers current evidence, inconsistent fingerprints, malformed JSON, final regression pass-through, and pending transaction behavior in one long test. Failures will be harder to localize, and setup for unrelated cases is interleaved.  
**Suggestion:** Split it into smaller tests by scenario, for example current evidence pass-through, malformed evidence fail-closed, inconsistent fingerprint rejection, and pending transaction lifecycle recovery.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Replace JSON String Equality With Shared Artifact Equality Helper
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

### 8. 2. Extract Repeated Flow State Reload Logic
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

### 9. 3. Avoid JSON Serialization In `ImplRepairTargetIdentity.equals`
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

### 10. 4. Remove Or Justify The `removeJournal` Flag
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

### 11. 5. Extract Current-Effect Checks From `CommittedImplRepairEffects`
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

### 12. 1. Align abstract method signature and error wording
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

### 13. 1. Extract the repeated lifecycle step sequence
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

### 14. 2. Name the recovery gate result more specifically
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

### 15. 3. Avoid embedding the repair source content inline
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

### 16. 1. Centralize repair state fixture creation
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

### 17. 1. Extract shared impl-repair test state setup
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

### 18. 2. Extract the flow manager test double
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

### 19. 1. Extract shared transition-application logic
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

### 20. 2. Collapse identical state-loading methods
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

### 21. 1. Standardize shared-suite subprocess execution
**Finding key:** loop-3957555458d9ecdbec2e
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** Two spec files independently spawn shared test suites and both omit timeout handling. This duplicates process-runner behavior and makes bounded execution policy easy to apply inconsistently.  
**Suggestion:** Extract a shared helper such as `runSharedTestSuites(paths, { cwd })` that wraps `spawnSync` with `encoding`, `env: standaloneTestEnvironment()`, timeout, and consistent failure reporting. Use it from both `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js`.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** Two spec files independently spawn shared test suites and both omit timeout handling. This duplicates process-runner behavior and makes bounded execution policy easy to apply inconsistently.  
**Suggestion:** Extract a shared helper such as `runSharedTestSuites(paths, { cwd })` that wraps `spawnSync` with `encoding`, `env: standaloneTestEnvironment()`, timeout, and consistent failure reporting. Use it from both `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Align shared-suite naming across tests
**Finding key:** loop-b23d10e02f1a47f4b332
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** One file uses `AFFECTED_SHARED_SUITES` for path strings while another exposes behavior as `runSharedSuites()`. The names disagree on whether the values are suites or suite paths, creating a small cross-file interface ambiguity.  
**Suggestion:** Use path-explicit naming consistently, for example `AFFECTED_SHARED_SUITE_PATHS` and `runSharedSuitePaths()` or `runSharedTestFiles()`.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** One file uses `AFFECTED_SHARED_SUITES` for path strings while another exposes behavior as `runSharedSuites()`. The names disagree on whether the values are suites or suite paths, creating a small cross-file interface ambiguity.  
**Suggestion:** Use path-explicit naming consistently, for example `AFFECTED_SHARED_SUITE_PATHS` and `runSharedSuitePaths()` or `runSharedTestFiles()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 3. Centralize repair-state fixture construction
**Finding key:** loop-67e11abbf6f392c2ff7c
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Multiple unit test files now duplicate repair-state object shapes with `runId`, `spec`, `steps`, `tasks`, and transition-related fields. This risks fixture drift as repair-state identity evolves.  
**Suggestion:** Add a shared test fixture factory, for example under `tests/helpers/flow-repair-state.js`, with helpers like `createRepairState()` and `createImplRepairState()`. Let individual tests override only scenario-specific fields.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Multiple unit test files now duplicate repair-state object shapes with `runId`, `spec`, `steps`, `tasks`, and transition-related fields. This risks fixture drift as repair-state identity evolves.  
**Suggestion:** Add a shared test fixture factory, for example under `tests/helpers/flow-repair-state.js`, with helpers like `createRepairState()` and `createImplRepairState()`. Let individual tests override only scenario-specific fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 4. Share flow-manager recovery test doubles
**Finding key:** loop-25d353559a5e9c84f896
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** Recovery tests are independently modeling `load`, `loadReadOnly`, mutation, and transition completion semantics. Similar behavior appears across stale evidence and impl repair tests, but each file encodes it locally.  
**Suggestion:** Introduce a shared test double factory such as `createFlowManagerDouble(state, options)` that provides consistent `loadReadOnly`/`load` behavior and transition-commit hooks across unit tests.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** Recovery tests are independently modeling `load`, `loadReadOnly`, mutation, and transition completion semantics. Similar behavior appears across stale evidence and impl repair tests, but each file encodes it locally.  
**Suggestion:** Introduce a shared test double factory such as `createFlowManagerDouble(state, options)` that provides consistent `loadReadOnly`/`load` behavior and transition-commit hooks across unit tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 5. Use one artifact equality style across implementation classes
**Finding key:** loop-2e6a7bed6b850381ec6f
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** Newly introduced equality methods coexist with repeated `JSON.stringify(...toJSON())` comparisons. Across artifact classes, callers now have to remember which types expose semantic equality and which require serialization comparison.  
**Suggestion:** Add semantic `equals()` methods to ledger/manifest artifact classes or a single shared artifact equality helper, then use that consistently in reconciliation and transaction comparisons.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** Newly introduced equality methods coexist with repeated `JSON.stringify(...toJSON())` comparisons. Across artifact classes, callers now have to remember which types expose semantic equality and which require serialization comparison.  
**Suggestion:** Add semantic `equals()` methods to ledger/manifest artifact classes or a single shared artifact equality helper, then use that consistently in reconciliation and transaction comparisons.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
