# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Extract Repeated Boundary Lists
**Finding key:** loop-2c57da8ecce3ada8af5a
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R5
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The same boundary inventory `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests. This makes future boundary additions easy to miss in one loop.  
**Suggestion:** Define a shared constant such as `const PRE_COMMIT_BOUNDARIES = [...]` near the fixtures and reuse it in all boundary-driven tests.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The same boundary inventory `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests. This makes future boundary additions easy to miss in one loop.  
**Suggestion:** Define a shared constant such as `const PRE_COMMIT_BOUNDARIES = [...]` near the fixtures and reuse it in all boundary-driven tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Extract Repeated Fixture Cleanup Pattern
**Finding key:** loop-fe98f39ee40f9d0613ce
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R3
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** Many tests repeat the same `const fixture = persistedGateFixture(...)`, `try`, and `finally { removeTmpDir(fixture.root); }` structure. The repeated cleanup scaffolding makes the actual assertions harder to scan.  
**Suggestion:** Add a small helper like `async function withPersistedGateFixture(prefix, fn)` that creates the fixture, invokes the callback, and always removes the temp directory.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** Many tests repeat the same `const fixture = persistedGateFixture(...)`, `try`, and `finally { removeTmpDir(fixture.root); }` structure. The repeated cleanup scaffolding makes the actual assertions harder to scan.  
**Suggestion:** Add a small helper like `async function withPersistedGateFixture(prefix, fn)` that creates the fixture, invokes the callback, and always removes the temp directory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Simplify Repeated Artifact Reads
**Finding key:** loop-7318d434f4905851eab1
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The test repeatedly reads and parses `impl-gate-result.json`, `issue-log.json`, and other fixture files inline with nested `JSON.parse(fs.readFileSync(...))` calls. This creates visual noise and duplicates path construction.  
**Suggestion:** Add focused helpers such as `readJson(file)`, `readSpecJson(fixture, name)`, or `readGateResult(fixture)` and use them where assertions inspect persisted artifacts.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The test repeatedly reads and parses `impl-gate-result.json`, `issue-log.json`, and other fixture files inline with nested `JSON.parse(fs.readFileSync(...))` calls. This creates visual noise and duplicates path construction.  
**Suggestion:** Add focused helpers such as `readJson(file)`, `readSpecJson(fixture, name)`, or `readGateResult(fixture)` and use them where assertions inspect persisted artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Consolidate Valid Gate Fixture Constants
**Finding key:** loop-7951e296811c0f5e8e17
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** Values like `"integration"`, `"impl-gate-result.json"`, `"impl-gate"`, `"spec-gate"`, and `"specs/001-test/spec.json"` are repeated throughout the file. Since these tests assert exact lifecycle behavior, typo drift would be costly.  
**Suggestion:** Define local constants for the canonical phase, selected step, stale step, spec path, and result artifact name, then use those constants in fixtures and assertions.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** Values like `"integration"`, `"impl-gate-result.json"`, `"impl-gate"`, `"spec-gate"`, and `"specs/001-test/spec.json"` are repeated throughout the file. Since these tests assert exact lifecycle behavior, typo drift would be costly.  
**Suggestion:** Define local constants for the canonical phase, selected step, stale step, spec path, and result artifact name, then use those constants in fixtures and assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 5. Split The Large Parity Test By Concern
**Finding key:** loop-8dcc30c28df35fc345f0
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` covers provider config, artifact paths, retry accounting, review tooling recovery, routing, and command args in one long test. A failure in any subsection obscures which parity contract regressed.  
**Suggestion:** Split it into smaller tests grouped by behavior, for example provider selection, artifact path/result parity, retry accounting, review recovery, and routing/options parity.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` covers provider config, artifact paths, retry accounting, review tooling recovery, routing, and command args in one long test. A failure in any subsection obscures which parity contract regressed.  
**Suggestion:** Split it into smaller tests grouped by behavior, for example provider selection, artifact path/result parity, retry accounting, review recovery, and routing/options parity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 6. Rename Generic Helpers For Test Intent
**Finding key:** loop-fd0086966c93171c0209
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** Helper names like `serialized`, `transitionFor`, and `validGateResult` are technically correct but broad. In a large test file, they do not communicate that they are fixture-specific gate helpers.  
**Suggestion:** Rename them to more explicit names such as `serializeState`, `buildInferredGateTransition`, and `validIntegrationGateResult` to make call sites easier to understand.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** Helper names like `serialized`, `transitionFor`, and `validGateResult` are technically correct but broad. In a large test file, they do not communicate that they are fixture-specific gate helpers.  
**Suggestion:** Rename them to more explicit names such as `serializeState`, `buildInferredGateTransition`, and `validIntegrationGateResult` to make call sites easier to understand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Assert Both Issue Guard Options Explicitly
**Finding key:** loop-2fee60795dd7988336c3
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/parked-resume-help.test.js
**Requirement:** R7
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The assertion `assert.match(help, /--expect-issue|--expect-no-issue/)` passes if only one of the two guard options is present, so it does not fully verify that existing target-guard option output is retained.  
**Suggestion:** Replace it with two explicit assertions:

```js
assert.match(help, /--expect-issue/);
assert.match(help, /--expect-no-issue/);
```
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The assertion `assert.match(help, /--expect-issue|--expect-no-issue/)` passes if only one of the two guard options is present, so it does not fully verify that existing target-guard option output is retained.  
**Suggestion:** Replace it with two explicit assertions:

```js
assert.match(help, /--expect-issue/);
assert.match(help, /--expect-no-issue/);
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Bound scoped diff expansion
**Finding key:** loop-426f9b74c2a35f98b6c7
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `taskFileScope.files.flatMap(...)` can collect diffs for every file inferred from the task scope without an explicit maximum. If the task spec or requirement-file map expands unexpectedly, this can trigger unbounded diff loading, violating `bounded-resource-usage`.  
**Suggestion:** Add an explicit upper bound before collecting per-file diffs, for example a max scoped file count or max combined diff size, and fall back to the existing cumulative diff path or emit a clear review error when exceeded.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `taskFileScope.files.flatMap(...)` can collect diffs for every file inferred from the task scope without an explicit maximum. If the task spec or requirement-file map expands unexpectedly, this can trigger unbounded diff loading, violating `bounded-resource-usage`.  
**Suggestion:** Add an explicit upper bound before collecting per-file diffs, for example a max scoped file count or max combined diff size, and fall back to the existing cumulative diff path or emit a clear review error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Rename `normalizeUniqueTestReviewFindings`
**Finding key:** loop-1f28dbf336721e193a95
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R2
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** `normalizeUniqueTestReviewFindings` does two things: coerces raw items into `TestReviewFinding` instances and deduplicates by fingerprint. “Normalize” is vague and hides the deduplication behavior.  
**Suggestion:** Rename it to something more explicit, such as `dedupeTestReviewFindings` or `coerceAndDedupeTestReviewFindings`, to make call sites self-describing.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** `normalizeUniqueTestReviewFindings` does two things: coerces raw items into `TestReviewFinding` instances and deduplicates by fingerprint. “Normalize” is vague and hides the deduplication behavior.  
**Suggestion:** Rename it to something more explicit, such as `dedupeTestReviewFindings` or `coerceAndDedupeTestReviewFindings`, to make call sites self-describing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Bound step-tree traversal
**Finding key:** loop-898d4c4f1307b636ab27
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R7  
**Issue:** `resolveStep()` calls `findStepById(scope?.steps || [], this.stepId)` with no explicit traversal bound. If `findStepById` walks nested step trees recursively, this introduces unbounded processing over user/spec-controlled structure and may violate `bounded-resource-usage`.  
**Suggestion:** Add an explicit max depth or max node count to the lookup path, either by extending `findStepById` to accept limits and passing them here, or by validating/bounding `scope.steps` before traversal.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R7  
**Issue:** `resolveStep()` calls `findStepById(scope?.steps || [], this.stepId)` with no explicit traversal bound. If `findStepById` walks nested step trees recursively, this introduces unbounded processing over user/spec-controlled structure and may violate `bounded-resource-usage`.  
**Suggestion:** Add an explicit max depth or max node count to the lookup path, either by extending `findStepById` to accept limits and passing them here, or by validating/bounding `scope.steps` before traversal.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Clarify method intent
**Finding key:** loop-8ca8829bc8536f25ceb3
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `resolveStep()` is broad and could be mistaken for resolving any step in the full flow, but it actually resolves `this.stepId` within the owner’s task scope or root flow scope.  
**Suggestion:** Rename it to something more specific, such as `resolveOwnedStep()` or `findOwnedStep()`, to make the scope-sensitive behavior clear at call sites.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `resolveStep()` is broad and could be mistaken for resolving any step in the full flow, but it actually resolves `this.stepId` within the owner’s task scope or root flow scope.  
**Suggestion:** Rename it to something more specific, such as `resolveOwnedStep()` or `findOwnedStep()`, to make the scope-sensitive behavior clear at call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Extract target normalization helper
**Finding key:** loop-f9a7e097dc83e29d0516
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** The new `applyReviewToolingRecovery` repeats the same target normalization block already used in nearby methods: `phase`, `taskId`, and `treeSha` are repeatedly validated into a target object.  
**Suggestion:** Add a small helper such as `normalizeReviewTarget({ phase, taskId, treeSha })` and reuse it in `applyReviewToolingRecovery`, `read`, `recordToolingOutcome`, and other same-file callers.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** The new `applyReviewToolingRecovery` repeats the same target normalization block already used in nearby methods: `phase`, `taskId`, and `treeSha` are repeatedly validated into a target object.  
**Suggestion:** Add a small helper such as `normalizeReviewTarget({ phase, taskId, treeSha })` and reuse it in `applyReviewToolingRecovery`, `read`, `recordToolingOutcome`, and other same-file callers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Align recovery function naming with transition API
**Finding key:** loop-4b6fb31a1472ac2cb237
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `applyReviewToolingRecovery` mutates convergence state like `applyReviewEvidenceTransition`, but its name omits the “Transition” suffix used by the adjacent exported transition helper.  
**Suggestion:** Rename it to `applyReviewToolingRecoveryTransition` or add an alias if external callers already depend on the current name. This keeps same-file mutation helpers easier to identify and search.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `applyReviewToolingRecovery` mutates convergence state like `applyReviewEvidenceTransition`, but its name omits the “Transition” suffix used by the adjacent exported transition helper.  
**Suggestion:** Rename it to `applyReviewToolingRecoveryTransition` or add an alias if external callers already depend on the current name. This keeps same-file mutation helpers easier to identify and search.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Centralize Inferred Gate Commit/Persistence Flow
**Finding key:** loop-ba295bd84ce7356561fb
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** The inferred-transition commit pattern is implemented in two places: `RunGateCommand.execute()` and `runGatePhaseWithDependencies()`. Both create/restore `GateDurableSurfaceCheckpoint`, validate semantic completion, persist artifacts, commit the transition, and return a merged result. This duplicates atomicity-sensitive logic.  
**Suggestion:** Extract a single helper such as `commitInferredGateResult({ result, phase, root, specDir, state, transition, flowManager, persist })` and use it from both call sites. That would reduce drift risk around exactly-once lifecycle commits and artifact rollback.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** The inferred-transition commit pattern is implemented in two places: `RunGateCommand.execute()` and `runGatePhaseWithDependencies()`. Both create/restore `GateDurableSurfaceCheckpoint`, validate semantic completion, persist artifacts, commit the transition, and return a merged result. This duplicates atomicity-sensitive logic.  
**Suggestion:** Extract a single helper such as `commitInferredGateResult({ result, phase, root, specDir, state, transition, flowManager, persist })` and use it from both call sites. That would reduce drift risk around exactly-once lifecycle commits and artifact rollback.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Bound Checkpoint File Reads
**Finding key:** loop-dd6ee5329138575b2436
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `GateArtifactCheckpoint` uses `fs.readFileSync(file)` with no explicit size bound. The checkpoint only targets a finite file list, but each file can still be arbitrarily large, which violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add a max byte limit before reading checkpoint contents, or reuse an existing bounded read helper if available in this file’s imports. Fail before commit if a durable-surface artifact exceeds the configured checkpoint size.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `GateArtifactCheckpoint` uses `fs.readFileSync(file)` with no explicit size bound. The checkpoint only targets a finite file list, but each file can still be arbitrarily large, which violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add a max byte limit before reading checkpoint contents, or reuse an existing bounded read helper if available in this file’s imports. Fail before commit if a durable-surface artifact exceeds the configured checkpoint size.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Avoid Duplicating Artifact Name Logic
**Finding key:** loop-e90b5c649b82b92dbe41
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `runGatePhaseWithDependencies()` derives `basename` with local conditional logic, while the file already uses `GATE_RESULT_ARTIFACT_BY_PHASE[phase]` elsewhere. This creates a second source of truth for gate result artifact paths.  
**Suggestion:** Replace the local basename construction with the existing phase artifact mapping, falling back only if needed. This keeps the “existing phase source/result artifact paths remain unchanged” behavior easier to audit.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `runGatePhaseWithDependencies()` derives `basename` with local conditional logic, while the file already uses `GATE_RESULT_ARTIFACT_BY_PHASE[phase]` elsewhere. This creates a second source of truth for gate result artifact paths.  
**Suggestion:** Replace the local basename construction with the existing phase artifact mapping, falling back only if needed. This keeps the “existing phase source/result artifact paths remain unchanged” behavior easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Rename `completedSemanticGateResult`
**Finding key:** loop-0f232b863186282f777b
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `completedSemanticGateResult()` returns true for semantic PASS and semantic FAIL, but false for tooling/artifact failures. The current name is close, but it does not clearly communicate that tooling failures are intentionally excluded from commit eligibility.  
**Suggestion:** Rename it to something more explicit, such as `isCommitEligibleSemanticGateResult()`, and update both call sites. This makes the pre-commit failure boundary easier to understand.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `completedSemanticGateResult()` returns true for semantic PASS and semantic FAIL, but false for tooling/artifact failures. The current name is close, but it does not clearly communicate that tooling failures are intentionally excluded from commit eligibility.  
**Suggestion:** Rename it to something more explicit, such as `isCommitEligibleSemanticGateResult()`, and update both call sites. This makes the pre-commit failure boundary easier to understand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 5. Simplify `InferredGateTransition.commit()` Idempotency
**Finding key:** loop-b7ec1a3b6dbf6cd91390
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `commit()` silently returns `[]` on a second call. Since the requirement says the pending transition commits exactly once, a silent no-op can hide accidental duplicate commit attempts in tests or future callers.  
**Suggestion:** Throw an explicit error on a second commit attempt, or rename/add a separate `tryCommit()` if silent idempotency is intentional. For this lifecycle path, failing loudly better protects the exactly-once contract.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `commit()` silently returns `[]` on a second call. Since the requirement says the pending transition commits exactly once, a silent no-op can hide accidental duplicate commit attempts in tests or future callers.  
**Suggestion:** Throw an explicit error on a second commit attempt, or rename/add a separate `tryCommit()` if silent idempotency is intentional. For this lifecycle path, failing loudly better protects the exactly-once contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Avoid Repeated Full Record Scans
**Finding key:** loop-a8651602d12f3ff90a70
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R5  
**Issue:** `latestReviewConvergenceTarget` filters all `reviewConvergence.records` for each reset phase, then takes the last match. This allocates an intermediate array and repeats a full scan when multiple phases are reset.  
**Suggestion:** Build a phase-to-latest-target map once for review retries, or scan from the end with `findLast`/reverse iteration to avoid collecting every matching record.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R5  
**Issue:** `latestReviewConvergenceTarget` filters all `reviewConvergence.records` for each reset phase, then takes the last match. This allocates an intermediate array and repeats a full scan when multiple phases are reset.  
**Suggestion:** Build a phase-to-latest-target map once for review retries, or scan from the end with `findLast`/reverse iteration to avoid collecting every matching record.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Clarify Boolean Helper Naming
**Finding key:** loop-902792256fc152c1438d
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `reviewResetRequiresChangedEvidence(current)` returns `true` when `toolingOutcome` is absent. The name reads like it checks evidence state, but the implementation is specifically about whether tooling recovery is unavailable.  
**Suggestion:** Rename it to something closer to the condition, such as `reviewTargetHasNoToolingRecovery` or `shouldBlockUnchangedReviewReset`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `reviewResetRequiresChangedEvidence(current)` returns `true` when `toolingOutcome` is absent. The name reads like it checks evidence state, but the implementation is specifically about whether tooling recovery is unavailable.  
**Suggestion:** Rename it to something closer to the condition, such as `reviewTargetHasNoToolingRecovery` or `shouldBlockUnchangedReviewReset`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Avoid Reapplying All Review Recoveries Per Reset Operation
**Finding key:** loop-e018341d3ef1e1062198
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R5  
**Issue:** `afterReset` loops over every `reviewTargets` entry inside each `RetryResetOperation`. If multiple phases are reset, each operation may attempt recovery for every target, creating duplicate work and making the callback broader than the operation it belongs to.  
**Suggestion:** Associate each reset operation with its own target phase/target record, or run a single post-reset recovery callback after all reset operations complete. This keeps the recovery scope explicit and avoids redundant idempotent calls.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R5  
**Issue:** `afterReset` loops over every `reviewTargets` entry inside each `RetryResetOperation`. If multiple phases are reset, each operation may attempt recovery for every target, creating duplicate work and making the callback broader than the operation it belongs to.  
**Suggestion:** Associate each reset operation with its own target phase/target record, or run a single post-reset recovery callback after all reset operations complete. This keeps the recovery scope explicit and avoids redundant idempotent calls.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Extract Artifact Completion Gate Helper
**Finding key:** loop-fed6b4b4ffe12c50ed3c
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R4  
**Issue:** The same pattern is now repeated for test execution and result review: find a step, check `status === "done"`, check artifact existence, parse JSON, complete artifact-change validation, and add the same issue on failure.  
**Suggestion:** Add a small helper such as `shouldValidateStepArtifact(state, stepId, artifactPath)` or a local validation wrapper to centralize the `findStepById(...)?status === "done" && fs.existsSync(...)` gate. This keeps future artifact gates consistent and reduces duplicated condition logic.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R4  
**Issue:** The same pattern is now repeated for test execution and result review: find a step, check `status === "done"`, check artifact existence, parse JSON, complete artifact-change validation, and add the same issue on failure.  
**Suggestion:** Add a small helper such as `shouldValidateStepArtifact(state, stepId, artifactPath)` or a local validation wrapper to centralize the `findStepById(...)?status === "done" && fs.existsSync(...)` gate. This keeps future artifact gates consistent and reduces duplicated condition logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Clarify Step Variable Names
**Finding key:** loop-9d23122705360cce39bd
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `testExecuteStep` and `testResultReviewStep` are used specifically as completion gates, but their names suggest the full step objects matter beyond `status`.  
**Suggestion:** Rename to intent-focused booleans, for example `isTestExecuteDone` and `isTestResultReviewDone`, computed once from `findStepById(...)?.status === "done"`. The later conditionals become simpler and make the atomic gate behavior explicit.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `testExecuteStep` and `testResultReviewStep` are used specifically as completion gates, but their names suggest the full step objects matter beyond `status`.  
**Suggestion:** Rename to intent-focused booleans, for example `isTestExecuteDone` and `isTestResultReviewDone`, computed once from `findStepById(...)?.status === "done"`. The later conditionals become simpler and make the atomic gate behavior explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Fix Regex Escaping Helper
**Finding key:** loop-024f04d4765a34055d11
**Failure mode:** refactor
**File:** src/flow/lib/task-scope.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/task-scope.js`  
**Requirement:** R1  
**Issue:** The requirement ID escaping logic uses `replace(/[.*+?^${}()|[\]\\]/g, "\\{{PROMPT}}")`, which appears to replace every regex metacharacter with the literal string `\{{PROMPT}}` instead of escaping the matched character. This will make matching unreliable for IDs containing regex-significant characters.  
**Suggestion:** Replace it with the standard escape pattern: `id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.
**Suggestion:** **File:** `src/flow/lib/task-scope.js`  
**Requirement:** R1  
**Issue:** The requirement ID escaping logic uses `replace(/[.*+?^${}()|[\]\\]/g, "\\{{PROMPT}}")`, which appears to replace every regex metacharacter with the literal string `\{{PROMPT}}` instead of escaping the matched character. This will make matching unreliable for IDs containing regex-significant characters.  
**Suggestion:** Replace it with the standard escape pattern: `id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Extract Requirement ID Presence Check
**Finding key:** loop-57441744f2cbc49bad5f
**Failure mode:** refactor
**File:** src/flow/lib/task-scope.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/task-scope.js`  
**Requirement:** R4  
**Issue:** The constructor for `TaskRequirementFileScope` now contains normalization, regex escaping, regex construction, and filtering inline. This makes the constructor harder to scan and gives the class multiple small responsibilities at once.  
**Suggestion:** Extract a small helper such as `taskSpecIncludesRequirementId(taskSpecText, requirementId)` and use it inside the filter. That also gives the regex boundary behavior a named place to test directly.
**Suggestion:** **File:** `src/flow/lib/task-scope.js`  
**Requirement:** R4  
**Issue:** The constructor for `TaskRequirementFileScope` now contains normalization, regex escaping, regex construction, and filtering inline. This makes the constructor harder to scan and gives the class multiple small responsibilities at once.  
**Suggestion:** Extract a small helper such as `taskSpecIncludesRequirementId(taskSpecText, requirementId)` and use it inside the filter. That also gives the regex boundary behavior a named place to test directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Add Explicit Bounds Around Requirement/File Scope Inputs
**Finding key:** loop-87abeb9c3aa13e609740
**Failure mode:** refactor
**File:** src/flow/lib/task-scope.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/task-scope.js`  
**Requirement:** R7  
**Issue:** `TaskRequirementFileScope` processes all `requirementIds`, scans `taskSpecText` once per ID, and flattens all mapped files without an explicit upper bound. This may violate the `bounded-resource-usage` guardrail if these inputs can come from generated specs or external task metadata.  
**Suggestion:** Add explicit limits for requirement count, task spec text length, and mapped files per requirement, or document and enforce those bounds at this class boundary before filtering/scoping.
**Suggestion:** **File:** `src/flow/lib/task-scope.js`  
**Requirement:** R7  
**Issue:** `TaskRequirementFileScope` processes all `requirementIds`, scans `taskSpecText` once per ID, and flattens all mapped files without an explicit upper bound. This may violate the `bounded-resource-usage` guardrail if these inputs can come from generated specs or external task metadata.  
**Suggestion:** Add explicit limits for requirement count, task spec text length, and mapped files per requirement, or document and enforce those bounds at this class boundary before filtering/scoping.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Consolidate duplicated parked-resume help text
**Finding key:** loop-a1bbe80e842301071911
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The updated help now states “no discovery” in the summary line and again in “performs no discovery,” making the `--parked` behavior slightly repetitive.  
**Suggestion:** Keep the precise R7 wording in one place, preferably the summary line, and shorten the later line to focus only on required identity guards. For example: `Parked resume requires runId, spec, and Issue identity guards.`
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The updated help now states “no discovery” in the summary line and again in “performs no discovery,” making the `--parked` behavior slightly repetitive.  
**Suggestion:** Keep the precise R7 wording in one place, preferably the summary line, and shorten the later line to focus only on required identity guards. For example: `Parked resume requires runId, spec, and Issue identity guards.`
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Extract a finding factory for repeated test-review fixtures
**Finding key:** loop-dcbcd582ac8ffda0afc3
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R6  
**Issue:** The new test duplicates the full finding object shape twice, with only a few fields changing. That makes future schema changes noisier and easier to miss in one fixture.  
**Suggestion:** Add a small local helper inside the test or describe block, such as `makeTestFinding(overrides)`, with the common valid defaults and override only `title`, `issue`, `requiredChange`, `whyBlocking`, and `origin`.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R6  
**Issue:** The new test duplicates the full finding object shape twice, with only a few fields changing. That makes future schema changes noisier and easier to miss in one fixture.  
**Suggestion:** Add a small local helper inside the test or describe block, such as `makeTestFinding(overrides)`, with the common valid defaults and override only `title`, `issue`, `requiredChange`, `whyBlocking`, and `origin`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Rename `complete` and `incomplete` to describe scope behavior
**Finding key:** loop-137c6369d5a86a4169d6
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The variable names `complete` and `incomplete` are vague; the test is specifically asserting whether requirement file mappings allow diff scoping.  
**Suggestion:** Rename them to something like `fullyMappedScope` and `partiallyMappedScope` so the expected behavior is clear without reading constructor arguments.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The variable names `complete` and `incomplete` are vague; the test is specifically asserting whether requirement file mappings allow diff scoping.  
**Suggestion:** Rename them to something like `fullyMappedScope` and `partiallyMappedScope` so the expected behavior is clear without reading constructor arguments.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Split cumulative prompt assertions into a named expected phrase list
**Finding key:** loop-3ee3995a805efc303716
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The cumulative diff prompt test repeats several `assert.match(prompt.userPrompt, /.../)` calls, which makes the intent slightly harder to scan and invites copy-paste growth.  
**Suggestion:** Store the expected prompt fragments in an array and iterate with `assert.match`, or use a helper like `assertPromptIncludes(prompt.userPrompt, [...])` if one already exists in this test file.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The cumulative diff prompt test repeats several `assert.match(prompt.userPrompt, /.../)` calls, which makes the intent slightly harder to scan and invites copy-paste growth.  
**Suggestion:** Store the expected prompt fragments in an array and iterate with `assert.match`, or use a helper like `assertPromptIncludes(prompt.userPrompt, [...])` if one already exists in this test file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Clarify Snapshot Variable Name
**Finding key:** loop-e2250e17ea959bb84e7a
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The variable name `before` is vague for a test whose core assertion is atomic preservation of persisted step state.  
**Suggestion:** Rename `before` to something like `preTransitionSnapshot` or `preCommitSnapshot` so the assertion reads directly against the requirement.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The variable name `before` is vague for a test whose core assertion is atomic preservation of persisted step state.  
**Suggestion:** Rename `before` to something like `preTransitionSnapshot` or `preCommitSnapshot` so the assertion reads directly against the requirement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Align Test Title With Current Requirement Language
**Finding key:** loop-134fca0704317b3e3ca3
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R6  
**Issue:** The test name still starts with `AC3`, while the review context and related requirements are expressed as `R3`/`R6`. This creates naming drift in the test suite.  
**Suggestion:** Rename the test to reference the requirement-oriented behavior directly, for example: `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R6  
**Issue:** The test name still starts with `AC3`, while the review context and related requirements are expressed as `R3`/`R6`. This creates naming drift in the test suite.  
**Suggestion:** Rename the test to reference the requirement-oriented behavior directly, for example: `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Extract Fixture File Setup Helper
**Finding key:** loop-3598f7d7e4169d5f1f54
**Failure mode:** refactor
**File:** tests/unit/flow/set-step.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step.test.js`  
**Requirement:** R1  
**Issue:** The new test inlines several `fs.writeFileSync` calls with nested JSON fixtures, making the test harder to scan and increasing maintenance cost if similar completion-validation fixtures are added later.  
**Suggestion:** Extract small helpers such as `writeJson(path, value)` and possibly `writeSpecFixture(specDir, overrides)` within this test file. This would remove repeated `JSON.stringify(...)\n` boilerplate and keep the test focused on the behavior being asserted.
**Suggestion:** **File:** `tests/unit/flow/set-step.test.js`  
**Requirement:** R1  
**Issue:** The new test inlines several `fs.writeFileSync` calls with nested JSON fixtures, making the test harder to scan and increasing maintenance cost if similar completion-validation fixtures are added later.  
**Suggestion:** Extract small helpers such as `writeJson(path, value)` and possibly `writeSpecFixture(specDir, overrides)` within this test file. This would remove repeated `JSON.stringify(...)\n` boilerplate and keep the test focused on the behavior being asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Use Consistent JSON Fixture Construction
**Finding key:** loop-1f580e2ea077940490b0
**Failure mode:** refactor
**File:** tests/unit/flow/set-step.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step.test.js`  
**Requirement:** R1  
**Issue:** The test mixes structured `JSON.stringify(...)` writes with raw JSON string literals, for example `file-map.json` and `test-execute-result.json`. That inconsistency makes fixtures easier to mistype and harder to refactor.  
**Suggestion:** Use one style, preferably object literals passed through a local `writeJson` helper, for all JSON fixture files in this test.
**Suggestion:** **File:** `tests/unit/flow/set-step.test.js`  
**Requirement:** R1  
**Issue:** The test mixes structured `JSON.stringify(...)` writes with raw JSON string literals, for example `file-map.json` and `test-execute-result.json`. That inconsistency makes fixtures easier to mistype and harder to refactor.  
**Suggestion:** Use one style, preferably object literals passed through a local `writeJson` helper, for all JSON fixture files in this test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Gate Artifact Name Source Drift
**Finding key:** loop-bf9eecd8fbdc4f43b97e
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R6
**Issue:** Artifact/result names are repeated across `src/flow/lib/run-gate.js` and `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`, while `run-gate.js` also has `GATE_RESULT_ARTIFACT_BY_PHASE`. This creates cross-file drift risk between production artifact naming and test fixture expectations.
**Suggestion:** Reuse the same exported artifact mapping in tests where feasible, or centralize canonical artifact names in one module imported by both runtime code and tests.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R6
**Issue:** Artifact/result names are repeated across `src/flow/lib/run-gate.js` and `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`, while `run-gate.js` also has `GATE_RESULT_ARTIFACT_BY_PHASE`. This creates cross-file drift risk between production artifact naming and test fixture expectations.
**Suggestion:** Reuse the same exported artifact mapping in tests where feasible, or centralize canonical artifact names in one module imported by both runtime code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Review Tooling Recovery Naming Is Inconsistent Across Callers
**Finding key:** loop-70cfed958cffcb6e1042
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R4
**Issue:** `applyReviewToolingRecovery` mutates convergence state like `applyReviewEvidenceTransition`, but the transition-style naming is not followed. `src/flow/lib/set-retry.js` then builds retry behavior around that recovery API, so the naming inconsistency crosses module boundaries.
**Suggestion:** Rename the exported helper to `applyReviewToolingRecoveryTransition`, or provide that alias and migrate `set-retry.js` callers to it.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R4
**Issue:** `applyReviewToolingRecovery` mutates convergence state like `applyReviewEvidenceTransition`, but the transition-style naming is not followed. `src/flow/lib/set-retry.js` then builds retry behavior around that recovery API, so the naming inconsistency crosses module boundaries.
**Suggestion:** Rename the exported helper to `applyReviewToolingRecoveryTransition`, or provide that alias and migrate `set-retry.js` callers to it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Requirement Scope Bounds Need One Shared Contract
**Finding key:** loop-3eab436545ba58582561
**Failure mode:** refactor
**File:** src/flow/lib/task-scope.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/task-scope.js`
**Requirement:** R7
**Issue:** Both `TaskRequirementFileScope` and `src/flow/commands/review.js` have proposals about bounding scoped file expansion. If each file adds independent limits, the review command and task-scope abstraction may disagree about what is allowed.
**Suggestion:** Define bounds at the `TaskRequirementFileScope` boundary and have `review.js` consume that bounded result, with any command-level fallback keyed off the same constants or error type.
**Suggestion:** **File:** `src/flow/lib/task-scope.js`
**Requirement:** R7
**Issue:** Both `TaskRequirementFileScope` and `src/flow/commands/review.js` have proposals about bounding scoped file expansion. If each file adds independent limits, the review command and task-scope abstraction may disagree about what is allowed.
**Suggestion:** Define bounds at the `TaskRequirementFileScope` boundary and have `review.js` consume that bounded result, with any command-level fallback keyed off the same constants or error type.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Step Lookup Bounds Should Be Centralized
**Finding key:** loop-1d88de80e2b05b4fb98c
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`
**Requirement:** R7
**Issue:** `gate-mutation-owner.js` and `set-step.js` both rely on `findStepById` paths over flow/spec step data. Bounding or wrapping only one use would leave inconsistent traversal behavior across gate ownership and artifact-completion validation.
**Suggestion:** Add bounded lookup behavior to the shared step lookup helper or introduce a common wrapper, then use it from both gate ownership resolution and set-step validation paths.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`
**Requirement:** R7
**Issue:** `gate-mutation-owner.js` and `set-step.js` both rely on `findStepById` paths over flow/spec step data. Bounding or wrapping only one use would leave inconsistent traversal behavior across gate ownership and artifact-completion validation.
**Suggestion:** Add bounded lookup behavior to the shared step lookup helper or introduce a common wrapper, then use it from both gate ownership resolution and set-step validation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
