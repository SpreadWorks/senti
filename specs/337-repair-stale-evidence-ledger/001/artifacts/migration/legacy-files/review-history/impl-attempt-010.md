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

### 18. 1. Extract FlowManager Fixture Setup
**Finding key:** loop-3645965cd0e1572a62fc
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Both changed tests now repeat the same `FlowManager` construction, `create(state)`, and `loadReadOnly()` sequence. This duplicates setup mechanics and makes future state-persistence test changes more error-prone.  
**Suggestion:** Add a local helper such as `createPersistedFlowState(fixture, state)` that returns `{ flowManager, activeState }`, and use it in both tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Both changed tests now repeat the same `FlowManager` construction, `create(state)`, and `loadReadOnly()` sequence. This duplicates setup mechanics and makes future state-persistence test changes more error-prone.  
**Suggestion:** Add a local helper such as `createPersistedFlowState(fixture, state)` that returns `{ flowManager, activeState }`, and use it in both tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Use More Specific State Variable Names
**Finding key:** loop-9ac1eff75eff7e8e27f9
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** `activeState` and `recoveredState` are technically correct, but they do not communicate the key behavior being tested: persisted flow state before and after stale-evidence recovery.  
**Suggestion:** Rename them to something like `persistedState` and `reloadedStateAfterRecovery`, or `stateBeforeRecovery` and `stateAfterRecovery`, to make the persistence boundary explicit.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** `activeState` and `recoveredState` are technically correct, but they do not communicate the key behavior being tested: persisted flow state before and after stale-evidence recovery.  
**Suggestion:** Rename them to something like `persistedState` and `reloadedStateAfterRecovery`, or `stateBeforeRecovery` and `stateAfterRecovery`, to make the persistence boundary explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Consider a Helper for Stale Recovery Assertions
**Finding key:** loop-c8b30530d7a8ef011a98
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The two tests assert the same recovery transition shape: recovered result, test-execute becomes `in_progress`, and the original gate/review step becomes `pending`. This pattern is duplicated with only the source step ID differing.  
**Suggestion:** Extract a small assertion helper, for example `assertRecoveredToTestExecute(state, deferredStepId)`, to centralize the transition expectation while keeping each test focused on its entrypoint-specific setup.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** The two tests assert the same recovery transition shape: recovered result, test-execute becomes `in_progress`, and the original gate/review step becomes `pending`. This pattern is duplicated with only the source step ID differing.  
**Suggestion:** Extract a small assertion helper, for example `assertRecoveredToTestExecute(state, deferredStepId)`, to centralize the transition expectation while keeping each test focused on its entrypoint-specific setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Reuse the stale artifact file list
**Finding key:** loop-5540e22b376f39c537e3
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The stale artifact filenames are duplicated in the write loop and in the `removedArtifacts` assertion. This makes the test slightly harder to maintain if the recovery artifact set changes.  
**Suggestion:** Extract a local `const staleArtifactFiles = ["test-execute-result.json", "test-result-review.json"];` and reuse it for writing, asserting `removedArtifacts`, and checking deletion.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The stale artifact filenames are duplicated in the write loop and in the `removedArtifacts` assertion. This makes the test slightly harder to maintain if the recovery artifact set changes.  
**Suggestion:** Extract a local `const staleArtifactFiles = ["test-execute-result.json", "test-result-review.json"];` and reuse it for writing, asserting `removedArtifacts`, and checking deletion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Reduce repeated step status assertions
**Finding key:** loop-d9a4490a0261f73f739d
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The three `findStepById(...).status` assertions repeat the same lookup/assertion pattern.  
**Suggestion:** Use a small local expectation table, for example `[["test-execute", "in_progress"], ...]`, and loop through it. This keeps the recovery state expectation compact while preserving the same coverage.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The three `findStepById(...).status` assertions repeat the same lookup/assertion pattern.  
**Suggestion:** Use a small local expectation table, for example `[["test-execute", "in_progress"], ...]`, and loop through it. This keeps the recovery state expectation compact while preserving the same coverage.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Extract shared impl-repair test state setup
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

### 24. 2. Extract the flow manager test double
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

### 25. 1. Extract shared transition-application logic
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

### 26. 2. Collapse identical state-loading methods
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

### 27. 1. Centralize shared-suite spawn options
**Finding key:** loop-823d2a5309c5fca806a4
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`
**Requirement:** R9
**Issue:** Both `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js` introduce or use subprocess execution for shared suites and both reviews flag the same missing timeout behavior. If each file fixes this independently, timeout values, environment setup, and diagnostics can drift.
**Suggestion:** Extract a shared helper for running affected shared suites, including `cwd`, `env`, `encoding`, `timeout`, and failure diagnostics. Use it from both test files.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`
**Requirement:** R9
**Issue:** Both `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js` introduce or use subprocess execution for shared suites and both reviews flag the same missing timeout behavior. If each file fixes this independently, timeout values, environment setup, and diagnostics can drift.
**Suggestion:** Extract a shared helper for running affected shared suites, including `cwd`, `env`, `encoding`, `timeout`, and failure diagnostics. Use it from both test files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Unify stale-recovery transition assertion helpers
**Finding key:** loop-4306539ea0c3cd077bda
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`
**Requirement:** R9
**Issue:** Several files now assert the same stale-evidence recovery shape: recovery returns to `test-execute`, the source step is reset or deferred, artifacts are removed, and transaction state is cleared. Similar helper proposals appear in `stale-evidence-repair-transaction.test.js`, `retry-exhaustion-defer.test.js`, `run-review-advisory.test.js`, and `stale-test-evidence-refresh.test.js`.
**Suggestion:** Introduce a common test helper for recovery-state assertions, scoped to the test support layer if one exists. At minimum, use consistent local helper names and assertion shape, such as `assertRecoveredToTestExecute(...)`.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`
**Requirement:** R9
**Issue:** Several files now assert the same stale-evidence recovery shape: recovery returns to `test-execute`, the source step is reset or deferred, artifacts are removed, and transaction state is cleared. Similar helper proposals appear in `stale-evidence-repair-transaction.test.js`, `retry-exhaustion-defer.test.js`, `run-review-advisory.test.js`, and `stale-test-evidence-refresh.test.js`.
**Suggestion:** Introduce a common test helper for recovery-state assertions, scoped to the test support layer if one exists. At minimum, use consistent local helper names and assertion shape, such as `assertRecoveredToTestExecute(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Standardize repair-state fixture creation across unit tests
**Finding key:** loop-48cb2162ad10a75fbf3c
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`
**Requirement:** R1
**Issue:** Multiple unit tests duplicate repair flow state objects with `runId`, `spec`, `steps`, `tasks`, and `transitions`: notably `repair-state-identity.test.js`, `set-step-impl-repair.test.js`, and `retry-exhaustion-defer.test.js`. Independent local helpers would reduce per-file noise but still leave the same fixture schema duplicated across files.
**Suggestion:** Add a shared test fixture builder, for example `createRepairFlowState(overrides)`, and use it across these unit tests. Keep scenario-specific values as overrides so each test remains readable.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`
**Requirement:** R1
**Issue:** Multiple unit tests duplicate repair flow state objects with `runId`, `spec`, `steps`, `tasks`, and `transitions`: notably `repair-state-identity.test.js`, `set-step-impl-repair.test.js`, and `retry-exhaustion-defer.test.js`. Independent local helpers would reduce per-file noise but still leave the same fixture schema duplicated across files.
**Suggestion:** Add a shared test fixture builder, for example `createRepairFlowState(overrides)`, and use it across these unit tests. Keep scenario-specific values as overrides so each test remains readable.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Align recovery entrypoint naming
**Finding key:** loop-7b18fd955bcde82bdbe0
**Failure mode:** refactor
**File:** tests/e2e/231-task-e2e-full-lifecycle.test.js
**Requirement:** R7
**Issue:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`
**Requirement:** R7
**Issue:** Naming around recovery results varies across proposals: `recoveredGate`, `activeState`, `recoveredState`, `stateBeforeRecovery`, `stateAfterRecovery`, and `staleEvidenceRecoveryGate`. The underlying concept is the same recovery boundary, but names emphasize different things in different files.
**Suggestion:** Adopt a small naming convention across tests, such as `stateBeforeRecovery`, `stateAfterRecovery`, and `<entrypoint>RecoveryResult`. Rename local variables to match that convention when touching these tests.
**Suggestion:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`
**Requirement:** R7
**Issue:** Naming around recovery results varies across proposals: `recoveredGate`, `activeState`, `recoveredState`, `stateBeforeRecovery`, `stateAfterRecovery`, and `staleEvidenceRecoveryGate`. The underlying concept is the same recovery boundary, but names emphasize different things in different files.
**Suggestion:** Adopt a small naming convention across tests, such as `stateBeforeRecovery`, `stateAfterRecovery`, and `<entrypoint>RecoveryResult`. Rename local variables to match that convention when touching these tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 5. Avoid parallel local abstractions for flow-state loading
**Finding key:** loop-af55526190c511230f4d
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** Production code proposals mention extracting `loadReadOnly`/`load` fallback logic, while test proposals mention collapsing duplicate `load()` and `loadReadOnly()` doubles. This points to a cross-file interface issue: the read-only loading contract is important but currently re-expressed differently in production and tests.
**Suggestion:** Add one production helper for the fallback load behavior, then mirror that contract in test doubles with a consistently named helper such as `createFlowManagerDouble({ state })` or `loadState`. This keeps tests aligned with the production interface instead of hand-encoding slightly different assumptions.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** Production code proposals mention extracting `loadReadOnly`/`load` fallback logic, while test proposals mention collapsing duplicate `load()` and `loadReadOnly()` doubles. This points to a cross-file interface issue: the read-only loading contract is important but currently re-expressed differently in production and tests.
**Suggestion:** Add one production helper for the fallback load behavior, then mirror that contract in test doubles with a consistently named helper such as `createFlowManagerDouble({ state })` or `loadState`. This keeps tests aligned with the production interface instead of hand-encoding slightly different assumptions.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
