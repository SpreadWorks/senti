# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Extract Shared Boundary Cases
**Finding key:** loop-b4a58ca01ff66c2f0c43
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R5
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests, which makes the finite retry/failure inventory harder to maintain consistently.  
**Suggestion:** Define a top-level constant such as `const PRE_COMMIT_BOUNDARIES = [...]` and reuse it in the R3, R5, and R6 dispatcher tests.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests, which makes the finite retry/failure inventory harder to maintain consistently.  
**Suggestion:** Define a top-level constant such as `const PRE_COMMIT_BOUNDARIES = [...]` and reuse it in the R3, R5, and R6 dispatcher tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Extract Shared Semantic Result Cases
**Finding key:** loop-6445fcdf6d1ed320364a
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The semantic result list `["pass", "fail"]` is repeated in several tests. If result coverage changes, multiple loops must be updated manually.  
**Suggestion:** Define `const SEMANTIC_RESULTS = ["pass", "fail"];` and reuse it for judgment parity, artifact parity, and dispatcher callback tests.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The semantic result list `["pass", "fail"]` is repeated in several tests. If result coverage changes, multiple loops must be updated manually.  
**Suggestion:** Define `const SEMANTIC_RESULTS = ["pass", "fail"];` and reuse it for judgment parity, artifact parity, and dispatcher callback tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Split the Large Parity Test
**Finding key:** loop-0a1fc5c749d657910935
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The test `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` covers provider configuration, artifact persistence, retry accounting, routing, and CLI option registration in one broad test. This makes failures less localized and obscures which parity contract broke.  
**Suggestion:** Split it into focused tests, for example provider parity, artifact/result parity, retry-counter parity, and routing/registry parity.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The test `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` covers provider configuration, artifact persistence, retry accounting, routing, and CLI option registration in one broad test. This makes failures less localized and obscures which parity contract broke.  
**Suggestion:** Split it into focused tests, for example provider parity, artifact/result parity, retry-counter parity, and routing/registry parity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Name the Fixture Manager Around Its Role
**Finding key:** loop-9e313970379a09f20698
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R3
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** `PersistedStaleGateManager` describes one scenario, but the helper is used broadly for persisted gate atomicity, retries, dispatcher callbacks, and artifact checks. The name makes the test utility sound narrower than it is.  
**Suggestion:** Rename it to something like `AtomicGateTestFlowManager` or `PersistedGateTestManager` to reflect that it is a test double for persisted flow manager behavior across multiple gate scenarios.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** `PersistedStaleGateManager` describes one scenario, but the helper is used broadly for persisted gate atomicity, retries, dispatcher callbacks, and artifact checks. The name makes the test utility sound narrower than it is.  
**Suggestion:** Rename it to something like `AtomicGateTestFlowManager` or `PersistedGateTestManager` to reflect that it is a test double for persisted flow manager behavior across multiple gate scenarios.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 5. Simplify Repeated JSON File Reads
**Finding key:** loop-e25775a56556f12eba02
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The file repeatedly performs `JSON.parse(fs.readFileSync(path.join(...), "utf8"))`, which adds noise and makes artifact assertions harder to scan.  
**Suggestion:** Add a small helper such as `readJson(file)` or `readSpecJson(specDir, name)` and use it for persisted result and issue-log reads.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** The file repeatedly performs `JSON.parse(fs.readFileSync(path.join(...), "utf8"))`, which adds noise and makes artifact assertions harder to scan.  
**Suggestion:** Add a small helper such as `readJson(file)` or `readSpecJson(specDir, name)` and use it for persisted result and issue-log reads.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Assert Both Issue Guard Options Explicitly
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

### 7. 1. Bound scoped diff expansion
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

### 8. 2. Rename `normalizeUniqueTestReviewFindings`
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

### 9. 1. Bound step-tree traversal
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

### 10. 2. Clarify method intent
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

### 11. 1. Centralize Deferred Gate Persistence And Commit Logic
**Finding key:** loop-ef71539a2055ec52c4a6
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RunGateCommand.run()` and `runGatePhaseWithDependencies()` now both implement the same checkpoint, semantic-result validation, artifact persistence, transition commit, and rollback sequence. The duplication makes failure-boundary behavior easy to drift.  
**Suggestion:** Extract a small helper such as `persistThenCommitInferredGateTransition(...)` that owns checkpoint creation, artifact writing, `completedSemanticGateResult()`, `transition.commit()`, and rollback. Use it from both call sites.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RunGateCommand.run()` and `runGatePhaseWithDependencies()` now both implement the same checkpoint, semantic-result validation, artifact persistence, transition commit, and rollback sequence. The duplication makes failure-boundary behavior easy to drift.  
**Suggestion:** Extract a small helper such as `persistThenCommitInferredGateTransition(...)` that owns checkpoint creation, artifact writing, `completedSemanticGateResult()`, `transition.commit()`, and rollback. Use it from both call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Add Explicit Bounds Around Step Flattening
**Finding key:** loop-65bd2d141ad87f539540
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `InferredGateTransition` calls `flattenSteps(flowState.steps || [])` on potentially nested flow state without an explicit depth or node-count limit. This conflicts with the `bounded-resource-usage` guardrail for recursive or bulk processing.  
**Suggestion:** Add a bounded flatten wrapper for this file, for example enforcing a maximum step count and/or maximum nesting depth before constructing the `Map`, and throw a clear validation error when exceeded.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `InferredGateTransition` calls `flattenSteps(flowState.steps || [])` on potentially nested flow state without an explicit depth or node-count limit. This conflicts with the `bounded-resource-usage` guardrail for recursive or bulk processing.  
**Suggestion:** Add a bounded flatten wrapper for this file, for example enforcing a maximum step count and/or maximum nesting depth before constructing the `Map`, and throw a clear validation error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Simplify Repeated Spec Path Resolution
**Finding key:** loop-45998c3f90a326c4438d
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `executeDiffBasedGate()` repeatedly computes `path.resolve(root, state.spec)` and `resolveSpecDir(...)` while building requirement/file scope. This adds noise around the review-target construction and artifact path behavior.  
**Suggestion:** Introduce local constants such as `const specPath = path.resolve(root, state.spec);` and `const specDir = resolveSpecDir(specPath);`, then reuse them for `loadSpecJson(...)`, `loadFileMap(...)`, and any related path operations.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `executeDiffBasedGate()` repeatedly computes `path.resolve(root, state.spec)` and `resolveSpecDir(...)` while building requirement/file scope. This adds noise around the review-target construction and artifact path behavior.  
**Suggestion:** Introduce local constants such as `const specPath = path.resolve(root, state.spec);` and `const specDir = resolveSpecDir(specPath);`, then reuse them for `loadSpecJson(...)`, `loadFileMap(...)`, and any related path operations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Extract Artifact Completion Gate Helper
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

### 15. 2. Clarify Step Variable Names
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

### 16. 1. Fix Regex Escaping Helper
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

### 17. 2. Extract Requirement ID Presence Check
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

### 18. 3. Add Explicit Bounds Around Requirement/File Scope Inputs
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

### 19. 1. Remove Duplicate “No Discovery” Help Wording
**Finding key:** loop-e1ad505e5c68b56fbcc3
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The resume help now states “with no discovery” in the summary line and also says “performs no discovery” two lines later. This repeats the same concept in a short help block.  
**Suggestion:** Keep the new R7 wording in the summary line, and simplify the later line to avoid repetition, e.g. “Parked resume requires runId, spec, and Issue identity guards.”
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The resume help now states “with no discovery” in the summary line and also says “performs no discovery” two lines later. This repeats the same concept in a short help block.  
**Suggestion:** Keep the new R7 wording in the summary line, and simplify the later line to avoid repetition, e.g. “Parked resume requires runId, spec, and Issue identity guards.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Extract a finding factory for repeated test-review fixtures
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

### 21. 2. Rename `complete` and `incomplete` to describe scope behavior
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

### 22. 3. Split cumulative prompt assertions into a named expected phrase list
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

### 23. 1. Clarify Snapshot Variable Name
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

### 24. 2. Align Test Title With Current Requirement Language
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

### 25. 1. Extract Fixture File Setup Helper
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

### 26. 2. Use Consistent JSON Fixture Construction
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

### 27. 1. Centralize Shared JSON Fixture Helpers
**Finding key:** loop-9d92ed5465cff7f2425d
**Failure mode:** refactor
**File:** tests/unit/flow/set-step.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step.test.js`
**Requirement:** R1
**Issue:** Multiple test files introduce repeated JSON fixture/read/write patterns: `gate-failure-atomicity.test.js` repeats JSON reads, while `set-step.test.js` repeats and mixes JSON fixture writes. This creates cross-file inconsistency in test fixture handling.
**Suggestion:** Add or reuse a shared test helper for `readJson`/`writeJson` fixture operations, then use it consistently in both files.
**Suggestion:** **File:** `tests/unit/flow/set-step.test.js`
**Requirement:** R1
**Issue:** Multiple test files introduce repeated JSON fixture/read/write patterns: `gate-failure-atomicity.test.js` repeats JSON reads, while `set-step.test.js` repeats and mixes JSON fixture writes. This creates cross-file inconsistency in test fixture handling.
**Suggestion:** Add or reuse a shared test helper for `readJson`/`writeJson` fixture operations, then use it consistently in both files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Align Requirement Naming In Test Titles
**Finding key:** loop-2917b1b156e9c11a955f
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R6
**Issue:** One test still uses `AC3` terminology while adjacent new tests and review summaries consistently use `R3`/`R6`. This creates cross-file naming drift in the requirement language.
**Suggestion:** Rename the test title to use the same `R*` requirement terminology used elsewhere, such as `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R6
**Issue:** One test still uses `AC3` terminology while adjacent new tests and review summaries consistently use `R3`/`R6`. This creates cross-file naming drift in the requirement language.
**Suggestion:** Rename the test title to use the same `R*` requirement terminology used elsewhere, such as `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Consolidate Bounded Traversal Guardrails
**Finding key:** loop-32257787401c33540e1f
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R2
**Issue:** Both `run-gate.js` and `gate-mutation-owner.js` introduce or rely on recursive step traversal helpers (`flattenSteps`, `findStepById`) without explicit bounds. Addressing these independently could produce inconsistent limits and error behavior.
**Suggestion:** Define shared traversal bounds for step-tree helpers, such as max depth and max node count, and apply them consistently through `flattenSteps` and `findStepById` call paths.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R2
**Issue:** Both `run-gate.js` and `gate-mutation-owner.js` introduce or rely on recursive step traversal helpers (`flattenSteps`, `findStepById`) without explicit bounds. Addressing these independently could produce inconsistent limits and error behavior.
**Suggestion:** Define shared traversal bounds for step-tree helpers, such as max depth and max node count, and apply them consistently through `flattenSteps` and `findStepById` call paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Use Consistent “Owned Step” Naming
**Finding key:** loop-671c9c362e456cb4f433
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`
**Requirement:** R1
**Issue:** `resolveStep()` is proposed for rename because it resolves a step within ownership scope, while related files use broader step lookup naming. Without a consistent naming convention, call sites may obscure whether resolution is global, scoped, or ownership-aware.
**Suggestion:** Rename this method to `resolveOwnedStep()` or `findOwnedStep()`, and use that convention anywhere ownership-scoped step resolution is introduced.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`
**Requirement:** R1
**Issue:** `resolveStep()` is proposed for rename because it resolves a step within ownership scope, while related files use broader step lookup naming. Without a consistent naming convention, call sites may obscure whether resolution is global, scoped, or ownership-aware.
**Suggestion:** Rename this method to `resolveOwnedStep()` or `findOwnedStep()`, and use that convention anywhere ownership-scoped step resolution is introduced.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
