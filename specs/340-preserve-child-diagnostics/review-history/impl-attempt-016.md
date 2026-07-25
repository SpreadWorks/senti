# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Rename misleading truncation case variable
**Finding key:** loop-1a33b2da3fe6a2740c14
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js
**Requirement:** R2
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R2  
**Issue:** `truncatedPrefix` is misleading because the test verifies late `ERR_ASSERTION` evidence is retained under a byte limit, which appears to be suffix/tail-preserving behavior.  
**Suggestion:** Rename it to something like `truncatedAssertionEvidence` or `tailPreservedAssertion` so the test intent matches the behavior being asserted.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R2  
**Issue:** `truncatedPrefix` is misleading because the test verifies late `ERR_ASSERTION` evidence is retained under a byte limit, which appears to be suffix/tail-preserving behavior.  
**Suggestion:** Rename it to something like `truncatedAssertionEvidence` or `tailPreservedAssertion` so the test intent matches the behavior being asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Add a helper for encoded diagnostic records
**Finding key:** loop-128b5dbc5d979bab4090
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R8  
**Issue:** Several codec tests repeat the same setup: load `ChildProcessExecutionRecordCodec`, instantiate it, build a child result, and encode it.  
**Suggestion:** Extract a small helper such as `encodedRecord(spawnOptions, processOptions)` returning `{ codec, line, result }`. This would reduce duplication and make the overflow tests easier to scan.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R8  
**Issue:** Several codec tests repeat the same setup: load `ChildProcessExecutionRecordCodec`, instantiate it, build a child result, and encode it.  
**Suggestion:** Extract a small helper such as `encodedRecord(spawnOptions, processOptions)` returning `{ codec, line, result }`. This would reduce duplication and make the overflow tests easier to scan.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Make the spawn-count guard fail at the point of violation
**Finding key:** loop-786031f08c090d59c2f2
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js
**Requirement:** R4
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R4  
**Issue:** The runner test checks `spawnCount` only after execution. If an unexpected third spawn happens, `planned.shift()` returns `undefined`, producing an indirect failure.  
**Suggestion:** In the fake `spawn`, assert or throw before shifting when `planned.length === 0`, e.g. `assert.ok(planned.length > 0, "unexpected extra spawn")`. This directly enforces the “zero additional spawns” behavior.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R4  
**Issue:** The runner test checks `spawnCount` only after execution. If an unexpected third spawn happens, `planned.shift()` returns `undefined`, producing an indirect failure.  
**Suggestion:** In the fake `spawn`, assert or throw before shifting when `planned.length === 0`, e.g. `assert.ok(planned.length > 0, "unexpected extra spawn")`. This directly enforces the “zero additional spawns” behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Extract Shared Invocation Counter Fixture
**Finding key:** loop-469eeb6989a8ea75ef0a
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The invocation counter setup is duplicated in `fixturePrinting()` and the pass-behavior fixture. This makes the “zero additional invocations” coverage harder to maintain consistently.  
**Suggestion:** Extract a small helper such as `counterFixtureLines()` or `fixtureWithInvocationCounter(extraLines)` and reuse it for both failure and pass fixtures.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The invocation counter setup is duplicated in `fixturePrinting()` and the pass-behavior fixture. This makes the “zero additional invocations” coverage harder to maintain consistently.  
**Suggestion:** Extract a small helper such as `counterFixtureLines()` or `fixtureWithInvocationCounter(extraLines)` and reuse it for both failure and pass fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Replace Magic Child Process Limit With Named Constant
**Finding key:** loop-723575ca7dc48b617fcc
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The overflow test hard-codes `129` and expects an error mentioning `128`. The bound is important guardrail behavior, but the relationship between these values is implicit.  
**Suggestion:** Define `const MAX_CHILD_PROCESS_RECORDS = 128;` in the test file and use `MAX_CHILD_PROCESS_RECORDS + 1` for the overflow case and the expected error text.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The overflow test hard-codes `129` and expects an error mentioning `128`. The bound is important guardrail behavior, but the relationship between these values is implicit.  
**Suggestion:** Define `const MAX_CHILD_PROCESS_RECORDS = 128;` in the test file and use `MAX_CHILD_PROCESS_RECORDS + 1` for the overflow case and the expected error text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Extract Repeated Invocation Count Assertion
**Finding key:** loop-ef2261eb876cb3bcc2b7
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R7
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** `fs.readFileSync(path.join(..., "invocation-count.txt"), "utf8")` is repeated across multiple tests. The repeated low-level file read obscures the behavioral assertion being made.  
**Suggestion:** Add a helper like `assertInvocationCount(project, expected)` and use it wherever the test verifies no extra command invocations.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** `fs.readFileSync(path.join(..., "invocation-count.txt"), "utf8")` is repeated across multiple tests. The repeated low-level file read obscures the behavioral assertion being made.  
**Suggestion:** Add a helper like `assertInvocationCount(project, expected)` and use it wherever the test verifies no extra command invocations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Extract Final Regression Execution Helper
**Finding key:** loop-361b4605aa2e81b79c14
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R5
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** Many tests repeat the same sequence: create project, build context, write a current-change file, execute `RunFinalRegressionCommand`, then read the artifact. This makes the tests longer and increases setup drift risk.  
**Suggestion:** Introduce a focused helper such as `runFinalRegressionWithFixture(tmp, fixtureBody, options)` returning `{ result, artifact, ctx }`, while keeping per-test setup explicit where behavior differs.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** Many tests repeat the same sequence: create project, build context, write a current-change file, execute `RunFinalRegressionCommand`, then read the artifact. This makes the tests longer and increases setup drift risk.  
**Suggestion:** Introduce a focused helper such as `runFinalRegressionWithFixture(tmp, fixtureBody, options)` returning `{ result, artifact, ctx }`, while keeping per-test setup explicit where behavior differs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Rename `marker` To Reflect Encoded Child Record
**Finding key:** loop-2ccfc302e66931c1a0fe
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R5
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** The name `marker` is vague; most values are encoded child process execution records printed into stderr.  
**Suggestion:** Rename local variables from `marker` to `childRecord` or `encodedChildRecord` to make the test intent clearer.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** The name `marker` is vague; most values are encoded child process execution records printed into stderr.  
**Suggestion:** Rename local variables from `marker` to `childRecord` or `encodedChildRecord` to make the test intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 6. Avoid Manual Temp Cleanup Divergence
**Finding key:** loop-3fdbc427a7ffc3658959
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** Some tests use the global `tmp` plus `afterEach`, while matrix tests manage `projects` manually. This creates two cleanup patterns in one file.  
**Suggestion:** Add a helper like `createTrackedTmpDir(prefix, collection = trackedTmpDirs)` and have `afterEach` clean all tracked directories. This keeps cleanup consistent and reduces duplicated `try/finally` cleanup loops.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** Some tests use the global `tmp` plus `afterEach`, while matrix tests manage `projects` manually. This creates two cleanup patterns in one file.  
**Suggestion:** Add a helper like `createTrackedTmpDir(prefix, collection = trackedTmpDirs)` and have `afterEach` clean all tracked directories. This keeps cleanup consistent and reduces duplicated `try/finally` cleanup loops.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Extract rejected review triage loading
**Finding key:** loop-f23e4578594965adec71
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** The `implReview?.verdict === "REJECTED"` / `implReviewVerdict === "REJECTED"` triage-loading logic now appears in both `mechanicalArtifactState` and `buildAcceptanceReviewContext`, with inconsistent error handling: one path catches read failures and returns `null`, while the other lets failures propagate.  
**Suggestion:** Introduce a small helper such as `readRejectedImplReviewTriageIfRejected(specDir, verdict)` that centralizes the predicate and failure behavior. This removes duplication and makes the intended behavior after `impl-repair.json` exists explicit in one place.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** The `implReview?.verdict === "REJECTED"` / `implReviewVerdict === "REJECTED"` triage-loading logic now appears in both `mechanicalArtifactState` and `buildAcceptanceReviewContext`, with inconsistent error handling: one path catches read failures and returns `null`, while the other lets failures propagate.  
**Suggestion:** Introduce a small helper such as `readRejectedImplReviewTriageIfRejected(specDir, verdict)` that centralizes the predicate and failure behavior. This removes duplication and makes the intended behavior after `impl-repair.json` exists explicit in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Reuse Stored Triage Validation With a Source-Step Option
**Finding key:** loop-33b6c60c27a20e41cd61
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `readRejectedImplReviewTriage` now duplicates part of the stored impl-triage validation logic: JSON object check, `version`, `phase`, and `sourceStep` validation. This creates two validation paths that can drift.  
**Suggestion:** Extract a helper such as `readStoredImplTriageArtifactHeader(file)` or extend `validateStoredImplTriageArtifact` with an option that permits checking `sourceStep` before loading/validating the source artifact. Then have both call sites share the same header validation.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `readRejectedImplReviewTriage` now duplicates part of the stored impl-triage validation logic: JSON object check, `version`, `phase`, and `sourceStep` validation. This creates two validation paths that can drift.  
**Suggestion:** Extract a helper such as `readStoredImplTriageArtifactHeader(file)` or extend `validateStoredImplTriageArtifact` with an option that permits checking `sourceStep` before loading/validating the source artifact. Then have both call sites share the same header validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Isolate Source Artifact Loading for Impl Triage
**Finding key:** loop-e7e4e3a1d3d4ff0e9710
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** The function now mixes three responsibilities: reading the triage artifact, validating source linkage/fingerprint, and applying the “all rejected” predicate.  
**Suggestion:** Move the source artifact read and fingerprint consistency check into a small helper, for example `validateImplTriageSourceArtifact({ specDir, triage })`. That keeps `readRejectedImplReviewTriage` focused on selecting rejected impl-review triage artifacts.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** The function now mixes three responsibilities: reading the triage artifact, validating source linkage/fingerprint, and applying the “all rejected” predicate.  
**Suggestion:** Move the source artifact read and fingerprint consistency check into a small helper, for example `validateImplTriageSourceArtifact({ specDir, triage })`. That keeps `readRejectedImplReviewTriage` focused on selecting rejected impl-review triage artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Name `previous` More Specifically
**Finding key:** loop-b0e990048ca7c33164ad
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The variable name `previous` is vague in a function that handles multiple artifacts and references. It specifically represents the parsed previous fingerprint reference.  
**Suggestion:** Rename it to `previousFingerprintRef` to make the manifest/hash comparison self-documenting.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The variable name `previous` is vague in a function that handles multiple artifacts and references. It specifically represents the parsed previous fingerprint reference.  
**Suggestion:** Rename it to `previousFingerprintRef` to make the manifest/hash comparison self-documenting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Remove unused parameters from `classifyFinalRegressionFailure`
**Finding key:** loop-1234f51bcb3dd40f5544
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` no longer uses `root`, `state`, or `config`, but the call site still passes them. This leaves stale API shape from the previous classification path and makes the evidence-based attribution rules harder to audit.  
**Suggestion:** Remove `root`, `state`, and `config` from the call at the bottom of the file and from any remaining function signature assumptions.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` no longer uses `root`, `state`, or `config`, but the call site still passes them. This leaves stale API shape from the previous classification path and makes the evidence-based attribution rules harder to audit.  
**Suggestion:** Remove `root`, `state`, and `config` from the call at the bottom of the file and from any remaining function signature assumptions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Simplify redundant child failure branching
**Finding key:** loop-dbd4deca9044eeb0c4dc
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` computes `childFailure`, then checks both `childProcesses.some((entry) => entry.kind !== "passed") && childFailure` and later `if (childFailure) return childFailure`. Since `classifyChildProcessFailure` returns non-null whenever `childProcesses.length > 0`, the first branch is redundant and splits related logic.  
**Suggestion:** Collapse this to a single `if (childFailure) return childFailure;` after timeout handling, or adjust `classifyChildProcessFailure` to return `null` when all children passed if that is the intended distinction.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` computes `childFailure`, then checks both `childProcesses.some((entry) => entry.kind !== "passed") && childFailure` and later `if (childFailure) return childFailure`. Since `classifyChildProcessFailure` returns non-null whenever `childProcesses.length > 0`, the first branch is redundant and splits related logic.  
**Suggestion:** Collapse this to a single `if (childFailure) return childFailure;` after timeout handling, or adjust `classifyChildProcessFailure` to return `null` when all children passed if that is the intended distinction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Rename `childRecordError` for consistency with persisted artifact wording
**Finding key:** loop-c8f22475e97cb6a8eedc
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** The code uses `childRecordError`, while the domain language elsewhere is `childProcesses`, `ChildProcessExecutionRecord`, and “child diagnostics.” The shorter name makes it less clear that this is a decoding/parsing failure, not a child process failure.  
**Suggestion:** Rename `childRecordError` to `childProcessRecordDecodeError` or `childRecordDecodeError`, and update the raw log line accordingly.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** The code uses `childRecordError`, while the domain language elsewhere is `childProcesses`, `ChildProcessExecutionRecord`, and “child diagnostics.” The shorter name makes it less clear that this is a decoding/parsing failure, not a child process failure.  
**Suggestion:** Rename `childRecordError` to `childProcessRecordDecodeError` or `childRecordDecodeError`, and update the raw log line accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Avoid misleading `UnknownRegressionFailure` when all child records passed
**Finding key:** loop-38d39992a56ed2e9e5f3
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyChildProcessFailure` returns `UnknownRegressionFailure` when child process records exist but all are passed. That means a failing parent process with only passed child records is classified through child diagnostics even though the child evidence does not support a failure attribution.  
**Suggestion:** Return `null` when `failures.length === 0`, allowing parent process evidence to drive classification. Use `UnknownRegressionFailure` only after evaluating actual failing child records and finding insufficient attribution evidence.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyChildProcessFailure` returns `UnknownRegressionFailure` when child process records exist but all are passed. That means a failing parent process with only passed child records is classified through child diagnostics even though the child evidence does not support a failure attribution.  
**Suggestion:** Return `null` when `failures.length === 0`, allowing parent process evidence to drive classification. Use `UnknownRegressionFailure` only after evaluating actual failing child records and finding insufficient attribution evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 5. Extract repeated text-classifier loop
**Finding key:** loop-b2b5f4f0093714033f9b
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** The loop over `TEXT_FAILURE_CLASSIFIERS` appears in both child execution failure classification and parent process failure classification. The duplicate pattern can drift and makes future classifier ordering changes easier to apply inconsistently.  
**Suggestion:** Add a small helper such as `classifyTextFailure(normalizedText)` that returns the first matching failure or `null`, and use it in both places.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** The loop over `TEXT_FAILURE_CLASSIFIERS` appears in both child execution failure classification and parent process failure classification. The duplicate pattern can drift and makes future classifier ordering changes easier to apply inconsistently.  
**Suggestion:** Add a small helper such as `classifyTextFailure(normalizedText)` that returns the first matching failure or `null`, and use it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Enforce the configured stream capture bound
**Finding key:** loop-c6c58addfa5ee9b8472d
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionStreamCapture()` verifies byte-length consistency and truncation state, but it does not verify that `capturedByteLength` is within the configured capture bound. A malformed artifact could include very large `content` while still passing validation.  
**Suggestion:** Add an explicit maximum check against the same capture bound used when writing child stream artifacts, for example `capturedByteLength <= FINAL_REGRESSION_CHILD_STREAM_CAPTURE_BYTES`, and fail validation when exceeded.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** `validateFinalRegressionStreamCapture()` verifies byte-length consistency and truncation state, but it does not verify that `capturedByteLength` is within the configured capture bound. A malformed artifact could include very large `content` while still passing validation.  
**Suggestion:** Add an explicit maximum check against the same capture bound used when writing child stream artifacts, for example `capturedByteLength <= FINAL_REGRESSION_CHILD_STREAM_CAPTURE_BYTES`, and fail validation when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Bound child command metadata size
**Finding key:** loop-da06ca0739239a12c650
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `child.command` is required to be a non-empty array of non-empty strings, but neither the argument count nor individual string length is bounded. This leaves a bulk metadata field unbounded even though child process records are otherwise capped.  
**Suggestion:** Add explicit limits such as max command entries and max bytes/chars per entry, ideally using named constants near the `childProcesses.length > 128` limit.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `child.command` is required to be a non-empty array of non-empty strings, but neither the argument count nor individual string length is bounded. This leaves a bulk metadata field unbounded even though child process records are otherwise capped.  
**Suggestion:** Add explicit limits such as max command entries and max bytes/chars per entry, ideally using named constants near the `childProcesses.length > 128` limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Extract child process validation constants
**Finding key:** loop-a5a6225ead85897b8359
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R8  
**Issue:** The valid child `kinds` array and the hard-coded `128` child process limit are embedded inside `validateFinalRegressionChildProcesses()`. This makes the validation contract harder to reuse in tests and easier to accidentally diverge from artifact-writing code.  
**Suggestion:** Move these to named module-level constants, e.g. `FINAL_REGRESSION_CHILD_PROCESS_LIMIT` and `FINAL_REGRESSION_CHILD_PROCESS_KINDS`, then use those constants in validation and related tests/writer code where applicable within this file.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R8  
**Issue:** The valid child `kinds` array and the hard-coded `128` child process limit are embedded inside `validateFinalRegressionChildProcesses()`. This makes the validation contract harder to reuse in tests and easier to accidentally diverge from artifact-writing code.  
**Suggestion:** Move these to named module-level constants, e.g. `FINAL_REGRESSION_CHILD_PROCESS_LIMIT` and `FINAL_REGRESSION_CHILD_PROCESS_KINDS`, then use those constants in validation and related tests/writer code where applicable within this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Avoid unbounded line splitting in record decoding
**Finding key:** loop-24055aebbf347ac621de
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R8  
**Issue:** `ChildProcessExecutionRecordCodec.decodeAll()` calls `text.split(/\r?\n/)`, which materializes every line before enforcing `recordLimit`. A large log with few or no matching markers can still cause unbounded memory use, violating `bounded-resource-usage`.  
**Suggestion:** Parse incrementally with an explicit input byte limit, or scan line boundaries without allocating the full line array. Enforce a maximum decoded source size in addition to `recordLimit` and `lineByteLimit`.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R8  
**Issue:** `ChildProcessExecutionRecordCodec.decodeAll()` calls `text.split(/\r?\n/)`, which materializes every line before enforcing `recordLimit`. A large log with few or no matching markers can still cause unbounded memory use, violating `bounded-resource-usage`.  
**Suggestion:** Parse incrementally with an explicit input byte limit, or scan line boundaries without allocating the full line array. Enforce a maximum decoded source size in addition to `recordLimit` and `lineByteLimit`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Attach durable raw-log references to truncated stream captures
**Finding key:** loop-161582419d0386f6f57e
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R3  
**Issue:** `ProcessStreamCapture` records byte lengths, truncation state, and content, but the durable reference is stored only as optional `ChildProcessExecutionRecord.rawOutputPath`. That makes the reference record-level rather than stream-level, even though each captured child stream is required to carry the durable attempt-log reference when content exceeds the capture bound.  
**Suggestion:** Add an optional raw-log reference field to `ProcessStreamCapture` or introduce a small stream-reference value object, then require it when `truncated === true`.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R3  
**Issue:** `ProcessStreamCapture` records byte lengths, truncation state, and content, but the durable reference is stored only as optional `ChildProcessExecutionRecord.rawOutputPath`. That makes the reference record-level rather than stream-level, even though each captured child stream is required to carry the durable attempt-log reference when content exceeds the capture bound.  
**Suggestion:** Add an optional raw-log reference field to `ProcessStreamCapture` or introduce a small stream-reference value object, then require it when `truncated === true`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Centralize completed exit outcome checks
**Finding key:** loop-3bc2dbe9ba5988a72d21
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** The condition for completed numeric exit outcomes is duplicated across `"assertion-failure"` and `"nonzero-exit"` invariants, and the same kind set is duplicated in `childProcessResult()` for `completed` and `exitCode`.  
**Suggestion:** Introduce a helper such as `isCompletedExitKind(kind)` or a frozen set containing `"passed"`, `"assertion-failure"`, and `"nonzero-exit"`. Use it in both invariant validation and result construction.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** The condition for completed numeric exit outcomes is duplicated across `"assertion-failure"` and `"nonzero-exit"` invariants, and the same kind set is duplicated in `childProcessResult()` for `completed` and `exitCode`.  
**Suggestion:** Introduce a helper such as `isCompletedExitKind(kind)` or a frozen set containing `"passed"`, `"assertion-failure"`, and `"nonzero-exit"`. Use it in both invariant validation and result construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Avoid pre-truncation duplication before constructing captures
**Finding key:** loop-98fd5e6393b2df610cf4
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** `childProcessResult()` calls `boundedDiagnosticContent()` for classification, and `ChildProcessExecutionResult` then constructs `ProcessStreamCapture`, which applies the same bounding logic again. This duplicates capture policy in two places.  
**Suggestion:** Construct temporary `ProcessStreamCapture` instances once in `childProcessResult()` or extract a shared `classifyChildProcessKind()` helper that accepts already-bounded stream content.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** `childProcessResult()` calls `boundedDiagnosticContent()` for classification, and `ChildProcessExecutionResult` then constructs `ProcessStreamCapture`, which applies the same bounding logic again. This duplicates capture policy in two places.  
**Suggestion:** Construct temporary `ProcessStreamCapture` instances once in `childProcessResult()` or extract a shared `classifyChildProcessKind()` helper that accepts already-bounded stream content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Rename `lineByteLimit` for clarity
**Finding key:** loop-a2bb25b0bbd7fca4d404
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R8  
**Issue:** `lineByteLimit` sounds like a generic line parser limit, but it specifically limits encoded child execution marker lines.  
**Suggestion:** Rename it to `recordLineByteLimit` or `encodedRecordLineByteLimit` to match `DEFAULT_CHILD_PROCESS_RECORD_LINE_BYTES` and make the constraint easier to understand.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R8  
**Issue:** `lineByteLimit` sounds like a generic line parser limit, but it specifically limits encoded child execution marker lines.  
**Suggestion:** Rename it to `recordLineByteLimit` or `encodedRecordLineByteLimit` to match `DEFAULT_CHILD_PROCESS_RECORD_LINE_BYTES` and make the constraint easier to understand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Restore fixture construction helper
**Finding key:** loop-5854ec85a7ed6c4c7a5d
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression-record-and-proceed.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The test now builds a multi-line shell fixture inline, which makes the scenario harder to scan and mixes fixture mechanics with the assertion setup.  
**Suggestion:** Replace the inline `[].join("\n")` block with a small helper such as `failingFixtureBodyWithChildProcess(message, recordOptions)`, reusing the previous `failingFixtureBody` pattern while including `shellPrintChildProcessRecord`.
**Suggestion:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The test now builds a multi-line shell fixture inline, which makes the scenario harder to scan and mixes fixture mechanics with the assertion setup.  
**Suggestion:** Replace the inline `[].join("\n")` block with a small helper such as `failingFixtureBodyWithChildProcess(message, recordOptions)`, reusing the previous `failingFixtureBody` pattern while including `shellPrintChildProcessRecord`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Use a named child-process fixture constant
**Finding key:** loop-5a8c3ee08436473078fc
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression-record-and-proceed.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The same child process stderr fixture is embedded in both the expected artifact and the shell fixture setup. If the diagnostic text changes, the test can drift or require duplicated edits.  
**Suggestion:** Define a shared constant/helper for the child process record payload, for example `existingFailureChildProcessRecord`, and use it in both `failedRecordedArtifact()` and the test fixture body.
**Suggestion:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The same child process stderr fixture is embedded in both the expected artifact and the shell fixture setup. If the diagnostic text changes, the test can drift or require duplicated edits.  
**Suggestion:** Define a shared constant/helper for the child process record payload, for example `existingFailureChildProcessRecord`, and use it in both `failedRecordedArtifact()` and the test fixture body.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Extract repeated typed child evidence fixture helper
**Finding key:** loop-e3c383f84975f7a3215f
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R8  
**Issue:** Several tests now inline `shellPrintChildProcessRecord({ stderr: ... })` with similar `ERR_ASSERTION\n<path>: <message>\n` payload construction. This duplicates the typed child evidence shape and makes future changes to the synthetic child-process record format more error-prone.  
**Suggestion:** Add a small local helper in this test file, for example `childAssertionStderr(lines)` or `typedAssertionFailure(stderrLines)`, and use it in the affected fixtures.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R8  
**Issue:** Several tests now inline `shellPrintChildProcessRecord({ stderr: ... })` with similar `ERR_ASSERTION\n<path>: <message>\n` payload construction. This duplicates the typed child evidence shape and makes future changes to the synthetic child-process record format more error-prone.  
**Suggestion:** Add a small local helper in this test file, for example `childAssertionStderr(lines)` or `typedAssertionFailure(stderrLines)`, and use it in the affected fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Avoid unclear `error` mutation in EPERM fixture
**Finding key:** loop-023a2524ddfed02fc572
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R8  
**Issue:** The EPERM test creates `const error = new Error("spawn EPERM"); error.code = "EPERM";`. Mutating a built-in `Error` object inline is less clear than naming the fixture intent, especially because this is test data for child-process serialization.  
**Suggestion:** Extract this into a local helper such as `makeChildProcessError(message, code)` or `makeEpermError()`, so the fixture reads as intentional test setup rather than incidental object mutation.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R8  
**Issue:** The EPERM test creates `const error = new Error("spawn EPERM"); error.code = "EPERM";`. Mutating a built-in `Error` object inline is less clear than naming the fixture intent, especially because this is test data for child-process serialization.  
**Suggestion:** Extract this into a local helper such as `makeChildProcessError(message, code)` or `makeEpermError()`, so the fixture reads as intentional test setup rather than incidental object mutation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract repeated impl triage fixture setup
**Finding key:** loop-822e09e8b041fef82192
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new tests add another inline `impl-triage.json` construction. This file already has many fixture-oriented helpers, and keeping JSON artifact shapes inline makes future schema changes harder to update consistently.  
**Suggestion:** Add a small local helper such as `writeImplTriage(fixture.specDir, overrides)` or `writeRejectedImplReviewTriage(...)` in this test file, then use it in both new tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new tests add another inline `impl-triage.json` construction. This file already has many fixture-oriented helpers, and keeping JSON artifact shapes inline makes future schema changes harder to update consistently.  
**Suggestion:** Add a small local helper such as `writeImplTriage(fixture.specDir, overrides)` or `writeRejectedImplReviewTriage(...)` in this test file, then use it in both new tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Avoid hard-coded blocker summary assertion
**Finding key:** loop-a59848f826b6c9587e73
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The assertion checks the exact string `"Required artifact is invalid: impl-repair.json."`. That couples the test to presentation text rather than the blocker identity, making naming/message cleanups unnecessarily brittle.  
**Suggestion:** Assert on stable structured fields if available, such as blocker `kind`, artifact path, or error code. If only `summary` exists, consider using a narrower helper that documents this as a presentation-level assertion.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The assertion checks the exact string `"Required artifact is invalid: impl-repair.json."`. That couples the test to presentation text rather than the blocker identity, making naming/message cleanups unnecessarily brittle.  
**Suggestion:** Assert on stable structured fields if available, such as blocker `kind`, artifact path, or error code. If only `summary` exists, consider using a narrower helper that documents this as a presentation-level assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Use a bounded artifact count assertion for triage lookup behavior
**Finding key:** loop-be121888a498f299be0d
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** The bounded-resource guardrail is relevant to rejected triage/artifact lookup, but the added tests only cover source-step filtering and stale/current behavior. They do not verify that lookup or evidence handling remains count-bounded.  
**Suggestion:** Add a focused test in this file that creates more candidate repair/triage artifacts than the intended limit and asserts only the bounded latest/relevant set is considered, or that excess records are rejected/truncated according to the implementation contract.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R6  
**Issue:** The bounded-resource guardrail is relevant to rejected triage/artifact lookup, but the added tests only cover source-step filtering and stale/current behavior. They do not verify that lookup or evidence handling remains count-bounded.  
**Suggestion:** Add a focused test in this file that creates more candidate repair/triage artifacts than the intended limit and asserts only the bounded latest/relevant set is considered, or that excess records are rejected/truncated according to the implementation contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Extract Spawn Error Fixture Helper
**Finding key:** loop-c3d412265a7bf6f8260c
**Failure mode:** refactor
**File:** tests/unit/flow/step-outcome.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/step-outcome.test.js`  
**Requirement:** R8  
**Issue:** The new `spawn-error` result objects duplicate the same structure for permission and sandbox cases, differing only in `errorCode` and `spawnError`. This makes future policy cases more verbose and easier to update inconsistently.  
**Suggestion:** Add a small local helper in this test block, such as `spawnErrorResult({ errorCode = null, message })`, and use it for both cases. This keeps the table focused on the behavior being tested.
**Suggestion:** **File:** `tests/unit/flow/step-outcome.test.js`  
**Requirement:** R8  
**Issue:** The new `spawn-error` result objects duplicate the same structure for permission and sandbox cases, differing only in `errorCode` and `spawnError`. This makes future policy cases more verbose and easier to update inconsistently.  
**Suggestion:** Add a small local helper in this test block, such as `spawnErrorResult({ errorCode = null, message })`, and use it for both cases. This keeps the table focused on the behavior being tested.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Centralize Child Process Record Limits
**Finding key:** loop-a1eca44a7f9a52f99e63
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R8  
**Issue:** The child-process record limit appears as a hard-coded `128` in validation and is also asserted indirectly in `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`. This creates cross-file drift risk between the artifact contract and regression coverage.  
**Suggestion:** Define/export a named constant such as `FINAL_REGRESSION_CHILD_PROCESS_LIMIT` from the artifact/test-regression layer, use it in validation/writing code, and import or mirror it through a dedicated test helper instead of duplicating `128`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R8  
**Issue:** The child-process record limit appears as a hard-coded `128` in validation and is also asserted indirectly in `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`. This creates cross-file drift risk between the artifact contract and regression coverage.  
**Suggestion:** Define/export a named constant such as `FINAL_REGRESSION_CHILD_PROCESS_LIMIT` from the artifact/test-regression layer, use it in validation/writing code, and import or mirror it through a dedicated test helper instead of duplicating `128`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Share Synthetic Child Process Record Test Helpers
**Finding key:** loop-d43d8f762dc6e2ff9359
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R8  
**Issue:** Multiple test files introduce similar child-process record fixture construction: encoded records, `shellPrintChildProcessRecord(...)`, assertion stderr payloads, and expected persisted child records. The same synthetic record shape is being recreated across spec and unit tests.  
**Suggestion:** Add a shared test helper for encoded child execution records, for example `makeChildAssertionRecord(...)` / `printChildProcessRecordFixture(...)`, and reuse it across `specs/340-preserve-child-diagnostics/tests/*` and `tests/unit/flow/final-regression*.test.js`.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R8  
**Issue:** Multiple test files introduce similar child-process record fixture construction: encoded records, `shellPrintChildProcessRecord(...)`, assertion stderr payloads, and expected persisted child records. The same synthetic record shape is being recreated across spec and unit tests.  
**Suggestion:** Add a shared test helper for encoded child execution records, for example `makeChildAssertionRecord(...)` / `printChildProcessRecordFixture(...)`, and reuse it across `specs/340-preserve-child-diagnostics/tests/*` and `tests/unit/flow/final-regression*.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Align Child Record Naming Across Implementation And Tests
**Finding key:** loop-dbcadf8c22d01453c417
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** Naming varies across files for the same concept: `marker`, `childRecord`, `encodedChildRecord`, `childRecordError`, `ChildProcessExecutionRecord`, and `childProcesses`. This makes it harder to distinguish encoded marker lines, decoded records, and decode failures.  
**Suggestion:** Standardize names by role: use `encodedChildProcessRecord` for marker/log lines, `childProcessRecord` for decoded records, and `childProcessRecordDecodeError` for parsing failures. Apply the same convention in implementation and tests.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** Naming varies across files for the same concept: `marker`, `childRecord`, `encodedChildRecord`, `childRecordError`, `ChildProcessExecutionRecord`, and `childProcesses`. This makes it harder to distinguish encoded marker lines, decoded records, and decode failures.  
**Suggestion:** Standardize names by role: use `encodedChildProcessRecord` for marker/log lines, `childProcessRecord` for decoded records, and `childProcessRecordDecodeError` for parsing failures. Apply the same convention in implementation and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Unify Rejected Impl Review Triage Loading
**Finding key:** loop-2395a0dae648832fc856
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** Rejected impl-review triage lookup appears in both acceptance-review and impl-repair artifact paths, while related tests in `retry-exhaustion-defer.test.js` construct inline triage artifacts. The predicate, source-step filtering, stale/current handling, and error behavior can drift across files.  
**Suggestion:** Centralize rejected impl-review triage loading/validation in `src/flow/lib/impl-repair-artifacts.js` or a shared artifact helper, then have acceptance-review code and tests go through that helper or a matching fixture writer.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** Rejected impl-review triage lookup appears in both acceptance-review and impl-repair artifact paths, while related tests in `retry-exhaustion-defer.test.js` construct inline triage artifacts. The predicate, source-step filtering, stale/current handling, and error behavior can drift across files.  
**Suggestion:** Centralize rejected impl-review triage loading/validation in `src/flow/lib/impl-repair-artifacts.js` or a shared artifact helper, then have acceptance-review code and tests go through that helper or a matching fixture writer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Make Stream Capture Raw-Log References Consistent
**Finding key:** loop-a4a77152d65c7a2816d3
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R3  
**Issue:** `ProcessStreamCapture` stores truncation metadata and content, while durable raw-log references live on `ChildProcessExecutionRecord.rawOutputPath`. `src/flow/lib/test-artifacts.js` validates stream captures separately, so the stream-level truncation contract is split across two files and object levels.  
**Suggestion:** Put the durable raw-log reference on the stream capture value object, or add a dedicated stream reference object, then update artifact validation to require it whenever a stream capture is truncated.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R3  
**Issue:** `ProcessStreamCapture` stores truncation metadata and content, while durable raw-log references live on `ChildProcessExecutionRecord.rawOutputPath`. `src/flow/lib/test-artifacts.js` validates stream captures separately, so the stream-level truncation contract is split across two files and object levels.  
**Suggestion:** Put the durable raw-log reference on the stream capture value object, or add a dedicated stream reference object, then update artifact validation to require it whenever a stream capture is truncated.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
