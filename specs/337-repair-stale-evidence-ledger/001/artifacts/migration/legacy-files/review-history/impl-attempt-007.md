# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Bound nested test execution resources
**Finding key:** loop-8e982e671fb61301d710
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** The `spawnSync` call has no explicit `timeout` or `maxBuffer`, so nested test execution and captured output are not explicitly bounded. This conflicts with the `bounded-resource-usage` guardrail.  
**Suggestion:** Add explicit limits, for example:

```js
const result = spawnSync(process.execPath, ["--test", ...AFFECTED_SHARED_SUITES], {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
  timeout: 120_000,
  maxBuffer: 1024 * 1024,
});
```
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** The `spawnSync` call has no explicit `timeout` or `maxBuffer`, so nested test execution and captured output are not explicitly bounded. This conflicts with the `bounded-resource-usage` guardrail.  
**Suggestion:** Add explicit limits, for example:

```js
const result = spawnSync(process.execPath, ["--test", ...AFFECTED_SHARED_SUITES], {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
  timeout: 120_000,
  maxBuffer: 1024 * 1024,
});
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Remove redundant environment forwarding
**Finding key:** loop-9fabeabc52fe246c8a7f
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `env: process.env` repeats the default behavior of `spawnSync`, adding noise without changing behavior.  
**Suggestion:** Remove the `env` property unless the test intentionally needs a curated or modified environment.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `env: process.env` repeats the default behavior of `spawnSync`, adding noise without changing behavior.  
**Suggestion:** Remove the `env` property unless the test intentionally needs a curated or modified environment.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Make suite list naming more specific
**Finding key:** loop-fa1b383ab555ddea772d
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` is broad, while the test specifically covers shared recovery regression suites.  
**Suggestion:** Rename it to something like `AFFECTED_SHARED_RECOVERY_SUITES` to match the test purpose and reduce ambiguity.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`  
**Requirement:** R9  
**Issue:** `AFFECTED_SHARED_SUITES` is broad, while the test specifically covers shared recovery regression suites.  
**Suggestion:** Rename it to something like `AFFECTED_SHARED_RECOVERY_SUITES` to match the test purpose and reduce ambiguity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Extract Repeated Stale Recovery Entry Point Assertions
**Finding key:** loop-097cec395d6dc7da6eee
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The tests for gate/final-regression/acceptance recovery repeat the same setup and assertions in both `R3` and `R8`, including `createFixture()`, recovery invocation, `updateCalls`, and transition checks.  
**Suggestion:** Add a small helper such as `recoverViaEntrypoints()` or table-drive the entrypoints with `{ name, recover, assertResult }`. This would reduce duplication and make it harder for future entrypoints to be tested inconsistently.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The tests for gate/final-regression/acceptance recovery repeat the same setup and assertions in both `R3` and `R8`, including `createFixture()`, recovery invocation, `updateCalls`, and transition checks.  
**Suggestion:** Add a small helper such as `recoverViaEntrypoints()` or table-drive the entrypoints with `{ name, recover, assertResult }`. This would reduce duplication and make it harder for future entrypoints to be tested inconsistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Consolidate Transaction File Existence Assertions
**Finding key:** loop-1943706e9bf6943fdbc4
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R5
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** `fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE))` appears many times with repeated true/false assertions. This obscures the intent of the tests and makes failure messages less specific.  
**Suggestion:** Add helpers like `assertTransactionFileExists(fixture)` and `assertTransactionFileRemoved(fixture)`, similar to `assertPendingOwnedTransaction()`. Use them wherever the test only cares about the transaction file lifecycle.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** `fs.existsSync(path.join(fixture.specDir, TRANSACTION_FILE))` appears many times with repeated true/false assertions. This obscures the intent of the tests and makes failure messages less specific.  
**Suggestion:** Add helpers like `assertTransactionFileExists(fixture)` and `assertTransactionFileRemoved(fixture)`, similar to `assertPendingOwnedTransaction()`. Use them wherever the test only cares about the transaction file lifecycle.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Use a Named Durable Failure Phase List
**Finding key:** loop-cc94a3210339df500d23
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R5
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** The durable failure boundary list is embedded directly inside the `R5` test. If another test needs the same boundary matrix, it risks drift or copy/paste duplication.  
**Suggestion:** Extract the phase array to a constant such as `DURABLE_FAILURE_PHASES`. This also documents that the list is the authoritative retry boundary matrix for the spec test.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R5  
**Issue:** The durable failure boundary list is embedded directly inside the `R5` test. If another test needs the same boundary matrix, it risks drift or copy/paste duplication.  
**Suggestion:** Extract the phase array to a constant such as `DURABLE_FAILURE_PHASES`. This also documents that the list is the authoritative retry boundary matrix for the spec test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Simplify Repeated Fixture Path Construction
**Finding key:** loop-0b2076aca445890c02a4
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The file repeatedly builds paths like `${SPEC_DIR}/test-execute-result.json`, `path.join(fixture.specDir, LEDGER_FILE)`, and rewind-specific `specs/${REWIND_SPEC_ID}/...`. This makes the test longer and slightly more error-prone.  
**Suggestion:** Add focused helpers such as `specFile(name)`, `fixtureFile(fixture, name)`, or constants for common artifact names. Keep the helpers local to this test file so the fixture remains readable.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** The file repeatedly builds paths like `${SPEC_DIR}/test-execute-result.json`, `path.join(fixture.specDir, LEDGER_FILE)`, and rewind-specific `specs/${REWIND_SPEC_ID}/...`. This makes the test longer and slightly more error-prone.  
**Suggestion:** Add focused helpers such as `specFile(name)`, `fixtureFile(fixture, name)`, or constants for common artifact names. Keep the helpers local to this test file so the fixture remains readable.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Rename `recover` To Clarify It Performs Direct Stale Evidence Recovery
**Finding key:** loop-6936affb25e083a728b2
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R1
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R1  
**Issue:** The helper name `recover` is very generic in a file that also has recovery through integration gate, final regression, acceptance review, and rewind entrypoints.  
**Suggestion:** Rename it to something more specific, for example `recoverStaleEvidenceDirectly` or `recoverDirectStaleEvidence`. This improves readability at call sites, especially in retry and fault-injection tests.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R1  
**Issue:** The helper name `recover` is very generic in a file that also has recovery through integration gate, final regression, acceptance review, and rewind entrypoints.  
**Suggestion:** Rename it to something more specific, for example `recoverStaleEvidenceDirectly` or `recoverDirectStaleEvidence`. This improves readability at call sites, especially in retry and fault-injection tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 6. Remove Unused Local Variable In `createFixture`
**Finding key:** loop-6b7e53e9bc56f53678e2
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** `const specDir = path.join(root, SPEC_DIR);` is only used for `prepareImplTriageArtifact` and returned as `specDir`, so it is useful. However, `createFixture()` returns `current` and `repaired` but not `baseline`, while intermediate artifacts directly encode baseline/repaired fingerprints. The fixture construction is dense enough that this makes it harder to see which values are intentionally exposed.  
**Suggestion:** Group fixture-only intermediate values closer to where they are used, or add a short helper like `writeInitialImplReviewArtifacts(...)` so the returned fixture shape is visually separated from setup internals.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R9  
**Issue:** `const specDir = path.join(root, SPEC_DIR);` is only used for `prepareImplTriageArtifact` and returned as `specDir`, so it is useful. However, `createFixture()` returns `current` and `repaired` but not `baseline`, while intermediate artifacts directly encode baseline/repaired fingerprints. The fixture construction is dense enough that this makes it harder to see which values are intentionally exposed.  
**Suggestion:** Group fixture-only intermediate values closer to where they are used, or add a short helper like `writeInitialImplReviewArtifacts(...)` so the returned fixture shape is visually separated from setup internals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 7. Bound The Spawned Shared Suite Runtime
**Finding key:** loop-08dda34da8b2f94bc7e0
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R7
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R7  
**Issue:** `runSharedSuites()` calls `spawnSync()` without an explicit timeout. This violates the bounded-resource-usage guardrail because a hung shared test suite can block indefinitely.  
**Suggestion:** Pass a finite timeout to `spawnSync`, for example `{ timeout: 120_000 }`, or define a named `SHARED_SUITE_TIMEOUT_MS` constant and use it in `runSharedSuites()`.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`  
**Requirement:** R7  
**Issue:** `runSharedSuites()` calls `spawnSync()` without an explicit timeout. This violates the bounded-resource-usage guardrail because a hung shared test suite can block indefinitely.  
**Suggestion:** Pass a finite timeout to `spawnSync`, for example `{ timeout: 120_000 }`, or define a named `SHARED_SUITE_TIMEOUT_MS` constant and use it in `runSharedSuites()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Replace JSON String Equality With a Shared Deep Equality Helper
**Finding key:** loop-2e3c8fdc978e69b8b3e2
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `ImplRepairTargetIdentity.equals()`, `ImplRepairTransaction.equals()`, and `CommittedImplRepairEffects.reconcileJournal()` still compare serialized JSON strings directly. This repeats the same pattern and makes equality depend on property order.  
**Suggestion:** Add a local helper such as `sameJsonValue(left, right)` or a domain helper like `sameTransactionPayload(left, right)` and use it consistently for transaction, target, ledger, and manifest comparisons.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `ImplRepairTargetIdentity.equals()`, `ImplRepairTransaction.equals()`, and `CommittedImplRepairEffects.reconcileJournal()` still compare serialized JSON strings directly. This repeats the same pattern and makes equality depend on property order.  
**Suggestion:** Add a local helper such as `sameJsonValue(left, right)` or a domain helper like `sameTransactionPayload(left, right)` and use it consistently for transaction, target, ledger, and manifest comparisons.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Simplify Target Equality
**Finding key:** loop-d94bd598d8284f1d63b5
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `ImplRepairTargetIdentity.equals()` constructs another identity and serializes both objects just to compare three scalar fields. This is heavier than needed and obscures the actual authority check.  
**Suggestion:** Compare fields directly:

```js
return this.runId === other.runId
  && this.spec === other.spec
  && this.hasIssue === other.hasIssue
  && this.issue === other.issue;
```
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `ImplRepairTargetIdentity.equals()` constructs another identity and serializes both objects just to compare three scalar fields. This is heavier than needed and obscures the actual authority check.  
**Suggestion:** Compare fields directly:

```js
return this.runId === other.runId
  && this.spec === other.spec
  && this.hasIssue === other.hasIssue
  && this.issue === other.issue;
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Extract Transaction Journal Path Helper
**Finding key:** loop-5618bb2ceb0a85abadc1
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `path.join(specDir, REPAIR_TRANSACTION_FILE)` is repeated across the new transaction resume, commit, authority, and reconciliation paths. This increases the chance of future drift around journal handling.  
**Suggestion:** Introduce a small helper like `repairTransactionPath(specDir)` and use it everywhere in this file.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `path.join(specDir, REPAIR_TRANSACTION_FILE)` is repeated across the new transaction resume, commit, authority, and reconciliation paths. This increases the chance of future drift around journal handling.  
**Suggestion:** Introduce a small helper like `repairTransactionPath(specDir)` and use it everywhere in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 4. Remove Unused Invalidation Planning Branch Artifacts
**Finding key:** loop-da55329f732b7290199c
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `completeTestEvidenceRefresh()` still accepts `reason` and `additionalArtifacts`, but the new manifest-missing branch now throws before using them. In this diff, `additionalArtifacts` appears to be dead for the refresh path.  
**Suggestion:** If no remaining caller needs these parameters for refresh recovery, remove them from `completeTestEvidenceRefresh()` and its call sites. If callers still pass them for API consistency, add a short comment explaining why they remain intentionally unused.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `completeTestEvidenceRefresh()` still accepts `reason` and `additionalArtifacts`, but the new manifest-missing branch now throws before using them. In this diff, `additionalArtifacts` appears to be dead for the refresh path.  
**Suggestion:** If no remaining caller needs these parameters for refresh recovery, remove them from `completeTestEvidenceRefresh()` and its call sites. If callers still pass them for API consistency, add a short comment explaining why they remain intentionally unused.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 5. Name `CommittedImplRepairEffects` More Precisely
**Finding key:** loop-86cc229816fb6bcbdd27
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `CommittedImplRepairEffects` sounds like a value object representing already committed effects, but it performs journal reconciliation and partial-commit detection.  
**Suggestion:** Rename it to something behavior-oriented, such as `ImplRepairJournalReconciler` or `CommittedImplRepairReconciler`, to match its responsibility.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `CommittedImplRepairEffects` sounds like a value object representing already committed effects, but it performs journal reconciliation and partial-commit detection.  
**Suggestion:** Rename it to something behavior-oriented, such as `ImplRepairJournalReconciler` or `CommittedImplRepairReconciler`, to match its responsibility.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 6. Extract Lifecycle State Predicate
**Finding key:** loop-596c7a78006d47d4386a
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The lifecycle verification logic inside `CommittedImplRepairEffects.reconcileJournal()` is dense and mixes step status checks with acceptance-review cleanup checks.  
**Suggestion:** Extract a helper like `hasCommittedRepairLifecycle(state, transaction)` so reconciliation reads as a set of durable marker checks and the lifecycle rule can be tested or reviewed independently.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The lifecycle verification logic inside `CommittedImplRepairEffects.reconcileJournal()` is dense and mixes step status checks with acceptance-review cleanup checks.  
**Suggestion:** Extract a helper like `hasCommittedRepairLifecycle(state, transaction)` so reconciliation reads as a set of durable marker checks and the lifecycle rule can be tested or reviewed independently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 7. Avoid Duplicate Authority Construction
**Finding key:** loop-58c7c4df53e4631e0c59
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `commitOwnedTestEvidenceRefresh()` constructs `TestEvidenceRefreshTransitionAuthority` once for `updateStepStatus()` and again for `commitOwnedImplRepairEffects()`. Both instances carry identical root/specDir/transaction authority.  
**Suggestion:** Create the authority once before the pending check and reuse it for both the transition intent and effect precommit validation.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `commitOwnedTestEvidenceRefresh()` constructs `TestEvidenceRefreshTransitionAuthority` once for `updateStepStatus()` and again for `commitOwnedImplRepairEffects()`. Both instances carry identical root/specDir/transaction authority.  
**Suggestion:** Create the authority once before the pending check and reuse it for both the transition intent and effect precommit validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Align abstract method signature and error wording
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

### 19. 1. Extract the repeated lifecycle step sequence
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

### 20. 2. Name the recovery gate result more specifically
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

### 21. 3. Avoid embedding the repair source content inline
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

### 22. 1. Centralize repair state fixture creation
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

### 27. 1. Consolidate shared-suite execution bounds
**Finding key:** loop-5554f20c194403e9f198
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js
**Requirement:** R9
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`
**Requirement:** R9
**Issue:** Two spec tests independently introduce nested shared-suite execution via `spawnSync`, and both reviewers flagged missing runtime/resource bounds. If each file patches this separately, timeout and buffer behavior can drift.
**Suggestion:** Define shared constants such as `SHARED_SUITE_TIMEOUT_MS` and `SHARED_SUITE_MAX_BUFFER` in the relevant spec test helper area, or at least use the same constant names and values in both `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js`.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/shared-recovery-regressions.test.js`
**Requirement:** R9
**Issue:** Two spec tests independently introduce nested shared-suite execution via `spawnSync`, and both reviewers flagged missing runtime/resource bounds. If each file patches this separately, timeout and buffer behavior can drift.
**Suggestion:** Define shared constants such as `SHARED_SUITE_TIMEOUT_MS` and `SHARED_SUITE_MAX_BUFFER` in the relevant spec test helper area, or at least use the same constant names and values in both `shared-recovery-regressions.test.js` and `stale-evidence-repair-transaction.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Align recovery entrypoint naming across tests
**Finding key:** loop-04c65f60e132d35ffa8e
**Failure mode:** refactor
**File:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Requirement:** R1
**Issue:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`
**Requirement:** R1
**Issue:** Multiple files now refer to stale evidence recovery through generic or slightly different names: `recover`, `recoveredGate`, shared recovery suites, and stale evidence refresh tests. The inconsistent vocabulary makes it harder to distinguish direct repair from gate/final-regression/acceptance entrypoint recovery.
**Suggestion:** Standardize on explicit names such as `recoverStaleEvidenceDirectly`, `staleEvidenceRecoveryGate`, and `SHARED_STALE_EVIDENCE_RECOVERY_SUITES` so direct recovery, integration-gate recovery, and shared regression execution are consistently named.
**Suggestion:** **File:** `specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js`
**Requirement:** R1
**Issue:** Multiple files now refer to stale evidence recovery through generic or slightly different names: `recover`, `recoveredGate`, shared recovery suites, and stale evidence refresh tests. The inconsistent vocabulary makes it harder to distinguish direct repair from gate/final-regression/acceptance entrypoint recovery.
**Suggestion:** Standardize on explicit names such as `recoverStaleEvidenceDirectly`, `staleEvidenceRecoveryGate`, and `SHARED_STALE_EVIDENCE_RECOVERY_SUITES` so direct recovery, integration-gate recovery, and shared regression execution are consistently named.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Centralize repair-state fixture construction pattern
**Finding key:** loop-ff1c21ce751aaa349098
**Failure mode:** refactor
**File:** tests/unit/flow/repair-state-identity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/repair-state-identity.test.js`
**Requirement:** R9
**Issue:** Several unit tests independently duplicate repair-related state objects with `runId`, `spec`, `steps`, `tasks`, and transition fields. Reviewers proposed local helpers in multiple files, but separate helper shapes could still drift across test files.
**Suggestion:** Introduce a shared test fixture helper for repair flow state, or align local helpers around the same API shape, for example `createRepairState(overrides = {})`. Use it in `repair-state-identity.test.js`, `set-step-impl-repair.test.js`, and related stale evidence refresh tests.
**Suggestion:** **File:** `tests/unit/flow/repair-state-identity.test.js`
**Requirement:** R9
**Issue:** Several unit tests independently duplicate repair-related state objects with `runId`, `spec`, `steps`, `tasks`, and transition fields. Reviewers proposed local helpers in multiple files, but separate helper shapes could still drift across test files.
**Suggestion:** Introduce a shared test fixture helper for repair flow state, or align local helpers around the same API shape, for example `createRepairState(overrides = {})`. Use it in `repair-state-identity.test.js`, `set-step-impl-repair.test.js`, and related stale evidence refresh tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Reuse transition application semantics in tests
**Finding key:** loop-2f32063ab8f32670dd90
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R3
**Issue:** Transition application behavior is being duplicated across test doubles: `updateStepStatus()` applies commit intent logic, while `set-step-impl-repair.test.js` also needs a `flowManager` double with `completeStepTransitionIntent`. These mocks model the same cross-file interface contract differently.
**Suggestion:** Extract or standardize a test helper for applying `StepTransitionCommitIntent` objects to in-memory flow state, then use it from both repository and flow-manager doubles.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R3
**Issue:** Transition application behavior is being duplicated across test doubles: `updateStepStatus()` applies commit intent logic, while `set-step-impl-repair.test.js` also needs a `flowManager` double with `completeStepTransitionIntent`. These mocks model the same cross-file interface contract differently.
**Suggestion:** Extract or standardize a test helper for applying `StepTransitionCommitIntent` objects to in-memory flow state, then use it from both repository and flow-manager doubles.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 5. Align repair journal naming with behavior
**Finding key:** loop-5a8afbcb7965e0befa8c
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** Production code uses `CommittedImplRepairEffects` for journal reconciliation, while tests and proposals refer to transactions, repair recovery, stale evidence refresh, and committed effects interchangeably. This creates a naming mismatch between the domain object and its cross-file usage.
**Suggestion:** Rename the production class to a behavior-focused name such as `ImplRepairJournalReconciler`, then update test/helper names to use “journal” for durable transaction files and “effects” only for the actual committed state changes.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** Production code uses `CommittedImplRepairEffects` for journal reconciliation, while tests and proposals refer to transactions, repair recovery, stale evidence refresh, and committed effects interchangeably. This creates a naming mismatch between the domain object and its cross-file usage.
**Suggestion:** Rename the production class to a behavior-focused name such as `ImplRepairJournalReconciler`, then update test/helper names to use “journal” for durable transaction files and “effects” only for the actual committed state changes.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
