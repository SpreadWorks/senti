# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Clarify Suite Constant Naming
**Finding key:** loop-166939529a09110449dd
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` contains file paths, not suite objects or suite names. The name slightly obscures what is passed to `node --test`.  
**Suggestion:** Rename it to `AFFECTED_SHARED_TEST_FILES` or `AFFECTED_SHARED_REGRESSION_FILES` to match the value shape and improve readability.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` contains file paths, not suite objects or suite names. The name slightly obscures what is passed to `node --test`.  
**Suggestion:** Rename it to `AFFECTED_SHARED_TEST_FILES` or `AFFECTED_SHARED_REGRESSION_FILES` to match the value shape and improve readability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Avoid CWD-Dependent Project Root
**Finding key:** loop-b4e3d1de521e413fb94c
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `const PROJECT_ROOT = path.resolve(".");` assumes the test process is launched from the repository root. If this spec-local test is run from another working directory, the shared test paths may resolve incorrectly.  
**Suggestion:** Derive the project root relative to `import.meta.url`, or remove `PROJECT_ROOT` and rely on the parent runner’s cwd only if that is an intentional test contract.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `const PROJECT_ROOT = path.resolve(".");` assumes the test process is launched from the repository root. If this spec-local test is run from another working directory, the shared test paths may resolve incorrectly.  
**Suggestion:** Derive the project root relative to `import.meta.url`, or remove `PROJECT_ROOT` and rely on the parent runner’s cwd only if that is an intentional test contract.
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

### 8. 1. Replace JSON String Equality With a Shared Artifact Equality Helper
**Finding key:** loop-3f526a3f7e96c3ea3f91
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** The new `sameSerializedValue()` assumes both operands implement `toJSON()`, but nearby code still repeats raw `JSON.stringify(...toJSON())` comparisons for ledger and manifest reconciliation. This keeps equality behavior split across multiple patterns.  
**Suggestion:** Reuse a single helper for JSON-serializable artifact equality, for example `sameSerializedValue(left, right)`, in `CommittedImplRepairEffects.reconcileJournal()` for ledger and manifest checks as well. If plain JSON objects must be supported, make the helper normalize either class instances or raw objects before stringifying.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** The new `sameSerializedValue()` assumes both operands implement `toJSON()`, but nearby code still repeats raw `JSON.stringify(...toJSON())` comparisons for ledger and manifest reconciliation. This keeps equality behavior split across multiple patterns.  
**Suggestion:** Reuse a single helper for JSON-serializable artifact equality, for example `sameSerializedValue(left, right)`, in `CommittedImplRepairEffects.reconcileJournal()` for ledger and manifest checks as well. If plain JSON objects must be supported, make the helper normalize either class instances or raw objects before stringifying.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Rename `sameSerializedValue` to Reflect Transaction/Artifact Equality
**Finding key:** loop-c5dd1b903ffe3e7c26dc
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `sameSerializedValue()` is generic but only works for objects with `toJSON()`. The name suggests broader value comparison than the implementation actually supports.  
**Suggestion:** Rename it to something narrower like `sameRepairArtifactJson()` or make it genuinely generic by accepting raw JSON values and `toJSON()` instances.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `sameSerializedValue()` is generic but only works for objects with `toJSON()`. The name suggests broader value comparison than the implementation actually supports.  
**Suggestion:** Rename it to something narrower like `sameRepairArtifactJson()` or make it genuinely generic by accepting raw JSON values and `toJSON()` instances.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Remove Duplicate Authority Construction in Test Evidence Refresh Commit
**Finding key:** loop-d9c961ba82fd2ba3bd44
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `commitOwnedTestEvidenceRefresh()` constructs `TestEvidenceRefreshTransitionAuthority` twice with identical arguments: once before `updateStepStatus()` and again before `commitOwnedImplRepairEffects()`.  
**Suggestion:** Create the authority once before the pending check path and reuse it for both lifecycle transition and effect precommit validation.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `commitOwnedTestEvidenceRefresh()` constructs `TestEvidenceRefreshTransitionAuthority` twice with identical arguments: once before `updateStepStatus()` and again before `commitOwnedImplRepairEffects()`.  
**Suggestion:** Create the authority once before the pending check path and reuse it for both lifecycle transition and effect precommit validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Extract Current State Loader Used by Repair Effect Commit
**Finding key:** loop-58c7bd4d43e3348cc6a8
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `commitOwnedImplRepairEffects()` contains inline fallback logic for `flowManager.loadReadOnly`, `flowManager.load`, or the provided `state`. Similar state-loading behavior appears elsewhere in this file.  
**Suggestion:** Extract a small helper such as `loadCommittedRepairState(flowManager, state, specId)` to centralize the read-only/load fallback and keep ownership checks easier to audit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `commitOwnedImplRepairEffects()` contains inline fallback logic for `flowManager.loadReadOnly`, `flowManager.load`, or the provided `state`. Similar state-loading behavior appears elsewhere in this file.  
**Suggestion:** Extract a small helper such as `loadCommittedRepairState(flowManager, state, specId)` to centralize the read-only/load fallback and keep ownership checks easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 5. Simplify `CommittedImplRepairEffects.reconcileJournal` Marker Logic
**Finding key:** loop-7c0f8a22d644f87f43d9
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `reconcileJournal()` computes several booleans inline, then groups only some of them into `durableMarkers`, while `invalidationsCurrent` is handled separately. This makes the partial-commit decision harder to reason about.  
**Suggestion:** Use explicitly named groups, for example `durableArtifactsCurrent`, `lifecycleCurrent`, and `invalidationsCurrent`, or include all committed-effect checks in a single named object and derive `allCurrent` / `someCurrent` from its values.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `reconcileJournal()` computes several booleans inline, then groups only some of them into `durableMarkers`, while `invalidationsCurrent` is handled separately. This makes the partial-commit decision harder to reason about.  
**Suggestion:** Use explicitly named groups, for example `durableArtifactsCurrent`, `lifecycleCurrent`, and `invalidationsCurrent`, or include all committed-effect checks in a single named object and derive `allCurrent` / `someCurrent` from its values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 6. Avoid Rebuilding `ImplRepairTransaction` During Equality Checks
**Finding key:** loop-b9c77eb37774b8c1604a
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `ImplRepairTransaction.equals()` and `ImplRepairTargetIdentity.equals()` construct new instances when passed raw values. That is convenient, but it means equality can throw validation errors and has allocation side effects in paths that conceptually only compare already-normalized objects.  
**Suggestion:** Keep `equals()` instance-only, and normalize at call sites that read external JSON. Alternatively, rename the current method to `equalsSerializedTransaction()` or document that it validates/coerces raw input.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `ImplRepairTransaction.equals()` and `ImplRepairTargetIdentity.equals()` construct new instances when passed raw values. That is convenient, but it means equality can throw validation errors and has allocation side effects in paths that conceptually only compare already-normalized objects.  
**Suggestion:** Keep `equals()` instance-only, and normalize at call sites that read external JSON. Alternatively, rename the current method to `equalsSerializedTransaction()` or document that it validates/coerces raw input.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Align abstract method signature and error wording
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

### 15. 1. Extract the repeated lifecycle step sequence
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

### 16. 2. Name the recovery gate result more specifically
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

### 17. 3. Avoid embedding the repair source content inline
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

### 18. 1. Centralize repair state fixture creation
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

### 19. 1. Extract FlowManager Fixture Setup
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

### 20. 2. Use More Specific State Variable Names
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

### 21. 3. Consider a Helper for Stale Recovery Assertions
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

### 22. 1. Reuse the stale artifact file list
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

### 23. 2. Reduce repeated step status assertions
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

### 24. 1. Extract shared impl-repair test state setup
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

### 25. 2. Extract the flow manager test double
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

### 26. 1. Extract shared transition-application logic
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

### 27. 2. Collapse identical state-loading methods
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

### 28. 1. Centralize stale-evidence recovery assertions
**Finding key:** loop-9bef2c7e9ef476d85aa0
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple files introduce similar stale-recovery expectations: recovery returns to `test-execute`, the originating gate/review step is reset, transaction state is cleared or pending state is reconciled, and lifecycle status is asserted manually. This appears in `retry-exhaustion-defer.test.js`, `run-review-advisory.test.js`, and `stale-evidence-repair-transaction.test.js`, creating assertion drift risk.
**Suggestion:** Add a shared test helper for recovery transition assertions, or at least mirror a consistent local helper shape such as `assertRecoveredToTestExecute(state, sourceStepId)` across these files.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple files introduce similar stale-recovery expectations: recovery returns to `test-execute`, the originating gate/review step is reset, transaction state is cleared or pending state is reconciled, and lifecycle status is asserted manually. This appears in `retry-exhaustion-defer.test.js`, `run-review-advisory.test.js`, and `stale-evidence-repair-transaction.test.js`, creating assertion drift risk.
**Suggestion:** Add a shared test helper for recovery transition assertions, or at least mirror a consistent local helper shape such as `assertRecoveredToTestExecute(state, sourceStepId)` across these files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Consolidate persisted flow-state fixture setup
**Finding key:** loop-5f6a8be4e1dd4805c3b0
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Several tests now construct near-identical flow state objects with `runId`, `spec`, `steps`, `tasks`, and transition-related fields. The repeated fixture shape appears across `repair-state-identity.test.js`, `retry-exhaustion-defer.test.js`, and `set-step-impl-repair.test.js`, which makes future state schema changes easy to miss.
**Suggestion:** Introduce a shared fixture builder in the test support layer, or use consistently named local builders such as `createRepairState()` / `createImplRepairState()` that accept overrides and preserve one canonical state shape.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`  
**Requirement:** R1  
**Issue:** Several tests now construct near-identical flow state objects with `runId`, `spec`, `steps`, `tasks`, and transition-related fields. The repeated fixture shape appears across `repair-state-identity.test.js`, `retry-exhaustion-defer.test.js`, and `set-step-impl-repair.test.js`, which makes future state schema changes easy to miss.
**Suggestion:** Introduce a shared fixture builder in the test support layer, or use consistently named local builders such as `createRepairState()` / `createImplRepairState()` that accept overrides and preserve one canonical state shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Align flow manager test double interfaces
**Finding key:** loop-19e86458e64b794cccef
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests define ad hoc `flowManager` doubles with overlapping but slightly different method sets: `load`, `loadReadOnly`, `mutate`, `updateStepStatus`, and `completeStepTransitionIntent`. This can hide interface drift between production expectations and test doubles.
**Suggestion:** Extract a reusable test double factory such as `createFlowManagerDouble(state, overrides)` and use it across stale recovery and repair-state tests so new required methods fail consistently.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests define ad hoc `flowManager` doubles with overlapping but slightly different method sets: `load`, `loadReadOnly`, `mutate`, `updateStepStatus`, and `completeStepTransitionIntent`. This can hide interface drift between production expectations and test doubles.
**Suggestion:** Extract a reusable test double factory such as `createFlowManagerDouble(state, overrides)` and use it across stale recovery and repair-state tests so new required methods fail consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Normalize transition intent method naming in tests and production
**Finding key:** loop-af3b38c5ec7b8f34877b
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R3  
**Issue:** The production abstract API has `applyTo(state)` and `completeIn()` with inconsistent signature/error wording, while tests mock transition application and completion semantics in several places. This weakens the contract between `step-transition-policy.js`, `stale-test-evidence-refresh.test.js`, and `set-step-impl-repair.test.js`.
**Suggestion:** Make the abstract method contract explicit as `completeIn(state)` and update test doubles/helpers to use the same naming and argument shape.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R3  
**Issue:** The production abstract API has `applyTo(state)` and `completeIn()` with inconsistent signature/error wording, while tests mock transition application and completion semantics in several places. This weakens the contract between `step-transition-policy.js`, `stale-test-evidence-refresh.test.js`, and `set-step-impl-repair.test.js`.
**Suggestion:** Make the abstract method contract explicit as `completeIn(state)` and update test doubles/helpers to use the same naming and argument shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 5. Use one naming convention for affected shared regression files
**Finding key:** loop-e99f5895d23987d6adea
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** The summaries show mixed terminology for the same concept: “shared suites”, “shared regression files”, and “shared suite execution”. Across `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js`, the values being passed are file paths, not suite objects.
**Suggestion:** Standardize on names like `AFFECTED_SHARED_REGRESSION_FILES` and `runSharedRegressionFiles()` wherever this shared test execution path is referenced.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** The summaries show mixed terminology for the same concept: “shared suites”, “shared regression files”, and “shared suite execution”. Across `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js`, the values being passed are file paths, not suite objects.
**Suggestion:** Standardize on names like `AFFECTED_SHARED_REGRESSION_FILES` and `runSharedRegressionFiles()` wherever this shared test execution path is referenced.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
