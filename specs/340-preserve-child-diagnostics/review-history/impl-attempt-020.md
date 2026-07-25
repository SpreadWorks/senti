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

### 4. 1. Extract Repeated Invocation Count Assertions
**Finding key:** loop-82bcc7878712a1505616
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The assertion `fs.readFileSync(path.join(..., "invocation-count.txt"), "utf8") === "1"` is repeated across several tests, with a similar `"2"` variant elsewhere. This makes the intent noisier and duplicates path/read logic.  
**Suggestion:** Add a small helper such as `assertInvocationCount(project, expected)` and use it in all invocation-count checks.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The assertion `fs.readFileSync(path.join(..., "invocation-count.txt"), "utf8") === "1"` is repeated across several tests, with a similar `"2"` variant elsewhere. This makes the intent noisier and duplicates path/read logic.  
**Suggestion:** Add a small helper such as `assertInvocationCount(project, expected)` and use it in all invocation-count checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Extract Common Current-Change Setup
**Finding key:** loop-bb375124013552385fc8
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R7
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** Multiple tests repeat `writeFile(tmpOrProject, "src/current-change.js", "export const changed = true;\n")`. This is setup intent, but the literal path and content are duplicated.  
**Suggestion:** Add a helper like `writeCurrentChange(project)` to make tests easier to scan and reduce duplication.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** Multiple tests repeat `writeFile(tmpOrProject, "src/current-change.js", "export const changed = true;\n")`. This is setup intent, but the literal path and content are duplicated.  
**Suggestion:** Add a helper like `writeCurrentChange(project)` to make tests easier to scan and reduce duplication.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Extract Final Regression Execution Helper
**Finding key:** loop-c3e7c331250a677eb73c
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R5
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** Many tests repeat `await new RunFinalRegressionCommand().execute(ctx)` followed by `readArtifact(...)`. This mixes execution mechanics with assertions and increases test boilerplate.  
**Suggestion:** Add a helper such as `async function runFinalRegression(ctx, project = ctx.root) { ... }` returning `{ result, artifact }`.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** Many tests repeat `await new RunFinalRegressionCommand().execute(ctx)` followed by `readArtifact(...)`. This mixes execution mechanics with assertions and increases test boilerplate.  
**Suggestion:** Add a helper such as `async function runFinalRegression(ctx, project = ctx.root) { ... }` returning `{ result, artifact }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Replace Boolean Equality Assertion
**Finding key:** loop-f6741b7cf40a44e95cec
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R3
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R3  
**Issue:** `assert.equal(stream.capturedByteLength <= 8, true);` is less direct than the surrounding assertions and gives weaker failure output.  
**Suggestion:** Use `assert.ok(stream.capturedByteLength <= 8);` or `assert.equal(stream.capturedByteLength, 8)` if the exact expected captured byte length is deterministic.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R3  
**Issue:** `assert.equal(stream.capturedByteLength <= 8, true);` is less direct than the surrounding assertions and gives weaker failure output.  
**Suggestion:** Use `assert.ok(stream.capturedByteLength <= 8);` or `assert.equal(stream.capturedByteLength, 8)` if the exact expected captured byte length is deterministic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Avoid Cross-Test Cleanup Style Mixing
**Finding key:** loop-ae74384487cfa154bdf9
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** Most tests rely on the shared `tmp` plus `afterEach`, while grouped matrix tests manually maintain `projects` and clean them in `finally`. The mixed cleanup pattern makes resource ownership less consistent.  
**Suggestion:** Introduce a helper like `createTrackedTmpDir(prefix, bucket = defaultBucket)` and let `afterEach` remove all tracked directories. This would also make the multi-project tests shorter and less error-prone.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** Most tests rely on the shared `tmp` plus `afterEach`, while grouped matrix tests manually maintain `projects` and clean them in `finally`. The mixed cleanup pattern makes resource ownership less consistent.  
**Suggestion:** Introduce a helper like `createTrackedTmpDir(prefix, bucket = defaultBucket)` and let `afterEach` remove all tracked directories. This would also make the multi-project tests shorter and less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Extract rejected review triage loading
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

### 10. 1. Reuse Stored Triage Validation With a Source-Step Option
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

### 11. 2. Isolate Source Artifact Loading for Impl Triage
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

### 12. 3. Name `previous` More Specifically
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

### 13. 1. Remove Unused Classification Parameters
**Finding key:** loop-df186ee792210b58b815
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` no longer uses `root`, `state`, or `config`, but the call site still passes them. This creates stale API surface from the old `classifyRegression` path and makes it look like source-based attribution is still happening.  
**Suggestion:** Remove `root`, `state`, and `config` from the call at the bottom of the file. The function signature already omits them, so this is a call-site cleanup only.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` no longer uses `root`, `state`, or `config`, but the call site still passes them. This creates stale API surface from the old `classifyRegression` path and makes it look like source-based attribution is still happening.  
**Suggestion:** Remove `root`, `state`, and `config` from the call at the bottom of the file. The function signature already omits them, so this is a call-site cleanup only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Simplify Redundant Child Failure Branching
**Finding key:** loop-3f8c473316ea17b884db
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` computes `childFailure`, then checks `childProcesses.some((entry) => entry.kind !== "passed") && childFailure`, and later checks `if (childFailure) return childFailure`. Since `classifyChildProcessFailure` returns `null` only when there are no child processes, these two branches encode the same distinction indirectly.  
**Suggestion:** Replace the pair with clearer single-flow logic, for example by having `classifyChildProcessFailure` return `null` for “all children passed” and a failure only for actual child failure evidence. Then `classifyFinalRegressionFailure` can simply use `if (childFailure) return childFailure`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure` computes `childFailure`, then checks `childProcesses.some((entry) => entry.kind !== "passed") && childFailure`, and later checks `if (childFailure) return childFailure`. Since `classifyChildProcessFailure` returns `null` only when there are no child processes, these two branches encode the same distinction indirectly.  
**Suggestion:** Replace the pair with clearer single-flow logic, for example by having `classifyChildProcessFailure` return `null` for “all children passed” and a failure only for actual child failure evidence. Then `classifyFinalRegressionFailure` can simply use `if (childFailure) return childFailure`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Avoid Ambiguous “Failures” Naming For Passed-Child Anomaly
**Finding key:** loop-67fefe92101ed33a279d
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** In `classifyChildProcessFailure`, `const failures = childProcesses.filter((entry) => entry.kind !== "passed")` is clear, but the next branch `if (failures.length === 0) return new UnknownRegressionFailure()` means “child records exist, but none failed.” That is not a failure list case and makes the function’s intent harder to read.  
**Suggestion:** Rename or restructure around an explicit condition, such as `const failedChildProcesses = ...` and `if (failedChildProcesses.length === 0) return null` or a named helper like `classifyInconsistentChildProcessState(...)` if that unknown result is intentional.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** In `classifyChildProcessFailure`, `const failures = childProcesses.filter((entry) => entry.kind !== "passed")` is clear, but the next branch `if (failures.length === 0) return new UnknownRegressionFailure()` means “child records exist, but none failed.” That is not a failure list case and makes the function’s intent harder to read.  
**Suggestion:** Rename or restructure around an explicit condition, such as `const failedChildProcesses = ...` and `if (failedChildProcesses.length === 0) return null` or a named helper like `classifyInconsistentChildProcessState(...)` if that unknown result is intentional.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 4. Extract Repeated Classifier Application
**Finding key:** loop-60c1ee744af807a46fad
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** The loop over `TEXT_FAILURE_CLASSIFIERS` appears twice with the same “first matching classifier wins” behavior. This duplicates classification mechanics and makes future classifier behavior changes easier to miss.  
**Suggestion:** Add a small helper, e.g. `classifyTextFailure(text)`, that normalizes the loop and returns the first failure or `null`. Use it in both child-process and parent-process classification paths.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** The loop over `TEXT_FAILURE_CLASSIFIERS` appears twice with the same “first matching classifier wins” behavior. This duplicates classification mechanics and makes future classifier behavior changes easier to miss.  
**Suggestion:** Add a small helper, e.g. `classifyTextFailure(text)`, that normalizes the loop and returns the first failure or `null`. Use it in both child-process and parent-process classification paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 5. Tighten Raw Output Decoding Input Construction
**Finding key:** loop-83d58341cac07a83334d
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `decodeChildProcessRecords` builds one combined string from full `result.stdout` and `result.stderr`. If those fields can contain large output before process-level bounding, this duplicates stream content in memory during decode. The guardrail requires bounded resource usage, and this path should make the bound obvious.  
**Suggestion:** Decode from already-bounded process output if available, or introduce an explicit maximum decode input size near `decodeChildProcessRecords`. If full stream decoding is required by the codec contract, document/enforce the bound at this function boundary.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `decodeChildProcessRecords` builds one combined string from full `result.stdout` and `result.stderr`. If those fields can contain large output before process-level bounding, this duplicates stream content in memory during decode. The guardrail requires bounded resource usage, and this path should make the bound obvious.  
**Suggestion:** Decode from already-bounded process output if available, or introduce an explicit maximum decode input size near `decodeChildProcessRecords`. If full stream decoding is required by the codec contract, document/enforce the bound at this function boundary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Extract Shared Enum Constants for Final Regression Outcomes
**Finding key:** loop-dec7b63c6eff7b9e482b
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** The allowed outcome/kind lists are embedded directly inside validators, and this change adds more string literals in multiple places. That makes future schema changes easier to miss or apply inconsistently.  
**Suggestion:** Move arrays such as final-regression failure kinds, record-and-proceed values, and child process kinds into named constants near the validators, e.g. `FINAL_REGRESSION_FAILURE_KINDS`, `FINAL_REGRESSION_RECORD_AND_PROCEED_VALUES`, and `FINAL_REGRESSION_CHILD_PROCESS_KINDS`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** The allowed outcome/kind lists are embedded directly inside validators, and this change adds more string literals in multiple places. That makes future schema changes easier to miss or apply inconsistently.  
**Suggestion:** Move arrays such as final-regression failure kinds, record-and-proceed values, and child process kinds into named constants near the validators, e.g. `FINAL_REGRESSION_FAILURE_KINDS`, `FINAL_REGRESSION_RECORD_AND_PROCEED_VALUES`, and `FINAL_REGRESSION_CHILD_PROCESS_KINDS`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Simplify Repeated Nullable String Validation
**Finding key:** loop-7655961a07e989c283f3
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `validateFinalRegressionChildProcesses` repeats inline nullable-string validation for `signal`, `errorCode`, and `spawnError`. The same pattern is likely to grow if child process metadata expands.  
**Suggestion:** Add a small helper such as `assertNullableString(value, label)` and use it for those fields. This keeps the child validator focused on child-process structure rather than low-level field checks.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `validateFinalRegressionChildProcesses` repeats inline nullable-string validation for `signal`, `errorCode`, and `spawnError`. The same pattern is likely to grow if child process metadata expands.  
**Suggestion:** Add a small helper such as `assertNullableString(value, label)` and use it for those fields. This keeps the child validator focused on child-process structure rather than low-level field checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Extract Child Command Validation
**Finding key:** loop-76fa3e73ee71269bca1d
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** The command validation condition is long and combines array shape, emptiness, item type, and item length in one expression. It is correct but harder to scan than the surrounding validation code.  
**Suggestion:** Extract it to `validateFinalRegressionChildCommand(child.command, label)` or an `isNonEmptyStringArray` helper, then throw the existing error message from the caller.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** The command validation condition is long and combines array shape, emptiness, item type, and item length in one expression. It is correct but harder to scan than the surrounding validation code.  
**Suggestion:** Extract it to `validateFinalRegressionChildCommand(child.command, label)` or an `isNonEmptyStringArray` helper, then throw the existing error message from the caller.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 4. Name the Child Process Count Bound
**Finding key:** loop-c51d3a26df846d1c2c05
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** The `128` child-process limit is a magic number inside `validateFinalRegressionChildProcesses`. The bound is important for the bounded-resource-usage guardrail, so it should be named.  
**Suggestion:** Introduce a constant such as `MAX_FINAL_REGRESSION_CHILD_PROCESS_RECORDS = 128` and use it in both the comparison and error message. This makes the resource bound explicit and easier to reuse in tests.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R3  
**Issue:** The `128` child-process limit is a magic number inside `validateFinalRegressionChildProcesses`. The bound is important for the bounded-resource-usage guardrail, so it should be named.  
**Suggestion:** Introduce a constant such as `MAX_FINAL_REGRESSION_CHILD_PROCESS_RECORDS = 128` and use it in both the comparison and error message. This makes the resource bound explicit and easier to reuse in tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Avoid Unbounded Line Splitting In Record Decoding
**Finding key:** loop-d291e0d4a28586173a3d
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R1  
**Issue:** `ChildProcessExecutionRecordCodec.decodeAll()` calls `text.split(/\r?\n/)`, which materializes every line before enforcing `recordLimit`. Very large output with few or no child markers can still allocate unbounded memory, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Parse incrementally by scanning newline offsets, and add an explicit input byte limit or scanned-line limit. Keep `recordLimit` for matched records, but bound total decoded text processing as well.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R1  
**Issue:** `ChildProcessExecutionRecordCodec.decodeAll()` calls `text.split(/\r?\n/)`, which materializes every line before enforcing `recordLimit`. Very large output with few or no child markers can still allocate unbounded memory, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Parse incrementally by scanning newline offsets, and add an explicit input byte limit or scanned-line limit. Keep `recordLimit` for matched records, but bound total decoded text processing as well.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Deduplicate Child Process Field Validation
**Finding key:** loop-018ff99bb903eef6e22b
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R1  
**Issue:** `ChildProcessExecutionResult` and `ChildProcessExecutionRecord` duplicate validation for `kind`, `command`, `started`, `completed`, `exitCode`, `signal`, `errorCode`, `timedOut`, and `spawnError`. This makes future invariant changes easy to apply to one class but miss in the other.  
**Suggestion:** Extract shared validation into a helper such as `assertChildProcessExecutionFields(value, label)` and keep each constructor focused on class-specific stream validation.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R1  
**Issue:** `ChildProcessExecutionResult` and `ChildProcessExecutionRecord` duplicate validation for `kind`, `command`, `started`, `completed`, `exitCode`, `signal`, `errorCode`, `timedOut`, and `spawnError`. This makes future invariant changes easy to apply to one class but miss in the other.  
**Suggestion:** Extract shared validation into a helper such as `assertChildProcessExecutionFields(value, label)` and keep each constructor focused on class-specific stream validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Centralize Completed Exit Kind Logic
**Finding key:** loop-33135bef45d55d93624e
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** The set of kinds that have `completed=true` and a meaningful `exitCode` is repeated in `childProcessResult()` as chained comparisons: `"passed" || "assertion-failure" || "nonzero-exit"`.  
**Suggestion:** Add a helper like `isCompletedExitKind(kind)` or a frozen `COMPLETED_EXIT_KINDS` set, and use it for both `completed` and `exitCode` assignment.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** The set of kinds that have `completed=true` and a meaningful `exitCode` is repeated in `childProcessResult()` as chained comparisons: `"passed" || "assertion-failure" || "nonzero-exit"`.  
**Suggestion:** Add a helper like `isCompletedExitKind(kind)` or a frozen `COMPLETED_EXIT_KINDS` set, and use it for both `completed` and `exitCode` assignment.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Remove Duplicate Capture Computation During Classification
**Finding key:** loop-958c8e51844fbddb0654
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R3  
**Issue:** `childProcessResult()` computes `capturedStdout` and `capturedStderr` with `boundedDiagnosticContent()`, then `ChildProcessExecutionResult` constructs `ProcessStreamCapture` and computes the same bounded content again.  
**Suggestion:** Either construct `ProcessStreamCapture` once before classification and classify from its `.content`, or extract a classification helper that receives already bounded stream content.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R3  
**Issue:** `childProcessResult()` computes `capturedStdout` and `capturedStderr` with `boundedDiagnosticContent()`, then `ChildProcessExecutionResult` constructs `ProcessStreamCapture` and computes the same bounded content again.  
**Suggestion:** Either construct `ProcessStreamCapture` once before classification and classify from its `.content`, or extract a classification helper that receives already bounded stream content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Clarify `toJSON()` Semantics On Execution Result
**Finding key:** loop-a25cf3bb82ff305e0925
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R1  
**Issue:** `ChildProcessExecutionResult.toJSON()` serializes a `ChildProcessExecutionRecord`, not the full result object, even though the result also contains raw `stdout`, `stderr`, and summaries. That naming can mislead callers into assuming all result fields are serialized.  
**Suggestion:** Rename or supplement with a more explicit method such as `toExecutionRecordJSON()`, and have call sites use that when emitting machine-readable child records.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R1  
**Issue:** `ChildProcessExecutionResult.toJSON()` serializes a `ChildProcessExecutionRecord`, not the full result object, even though the result also contains raw `stdout`, `stderr`, and summaries. That naming can mislead callers into assuming all result fields are serialized.  
**Suggestion:** Rename or supplement with a more explicit method such as `toExecutionRecordJSON()`, and have call sites use that when emitting machine-readable child records.
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

### 35. 1. Centralize Child Process Record Schema Constants
**Finding key:** loop-45e67546e0400acf9242
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R5
**Issue:** Child process kind and field semantics are being introduced and validated across `src/flow/lib/test-artifacts.js`, `src/flow/lib/test-regression.js`, and exercised in multiple tests. The summaries show repeated string sets such as `"passed"`, `"assertion-failure"`, `"nonzero-exit"`, `"spawn-error"`, plus duplicated validation expectations. This creates cross-file drift risk between production construction, artifact validation, and tests.
**Suggestion:** Define shared constants/helpers for child process kinds and completed-exit semantics in the production module that owns the child process execution model, then import or reuse them from validators and tests where appropriate.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R5
**Issue:** Child process kind and field semantics are being introduced and validated across `src/flow/lib/test-artifacts.js`, `src/flow/lib/test-regression.js`, and exercised in multiple tests. The summaries show repeated string sets such as `"passed"`, `"assertion-failure"`, `"nonzero-exit"`, `"spawn-error"`, plus duplicated validation expectations. This creates cross-file drift risk between production construction, artifact validation, and tests.
**Suggestion:** Define shared constants/helpers for child process kinds and completed-exit semantics in the production module that owns the child process execution model, then import or reuse them from validators and tests where appropriate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Consolidate Child Process Fixture Builders Across Tests
**Finding key:** loop-1a4193c0f8c21c7d61c4
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`
**Requirement:** R8
**Issue:** Several test files now independently construct synthetic child process records or spawn-error results: `final-regression.test.js`, `final-regression-record-and-proceed.test.js`, `step-outcome.test.js`, and spec evidence tests. The fixture shape is duplicated across files, so future codec/schema changes will require scattered test updates.
**Suggestion:** Add a shared test fixture helper for child process execution records, assertion stderr payloads, and spawn errors, then use it across these test files instead of local ad hoc builders.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`
**Requirement:** R8
**Issue:** Several test files now independently construct synthetic child process records or spawn-error results: `final-regression.test.js`, `final-regression-record-and-proceed.test.js`, `step-outcome.test.js`, and spec evidence tests. The fixture shape is duplicated across files, so future codec/schema changes will require scattered test updates.
**Suggestion:** Add a shared test fixture helper for child process execution records, assertion stderr payloads, and spawn errors, then use it across these test files instead of local ad hoc builders.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Align Rejected Impl Review Triage Loading Behavior
**Finding key:** loop-ebd490a588397ac92b27
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R6
**Issue:** Rejected impl-review triage loading appears in both `acceptance-review-artifacts.js` and `impl-repair-artifacts.js`, with related validation and source-step handling split across modules. The per-file proposals indicate duplicated predicate/header validation and inconsistent read-failure behavior.
**Suggestion:** Introduce one shared helper for reading rejected impl-review triage artifacts, including source-step filtering, header validation, and failure policy. Use it from both acceptance review and impl repair code paths.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R6
**Issue:** Rejected impl-review triage loading appears in both `acceptance-review-artifacts.js` and `impl-repair-artifacts.js`, with related validation and source-step handling split across modules. The per-file proposals indicate duplicated predicate/header validation and inconsistent read-failure behavior.
**Suggestion:** Introduce one shared helper for reading rejected impl-review triage artifacts, including source-step filtering, header validation, and failure policy. Use it from both acceptance review and impl repair code paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Share Final Regression Execution Helpers Across Regression Tests
**Finding key:** loop-d21ee09fe1d38eb0e612
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R7
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`
**Requirement:** R7
**Issue:** Final regression execution and artifact-reading boilerplate appears in both spec-level diagnostics tests and unit regression tests. The summaries show repeated `RunFinalRegressionCommand().execute(ctx)`, artifact reads, invocation-count checks, and current-change setup across files.
**Suggestion:** Move common final-regression test setup into a shared test helper, such as `runFinalRegressionAndReadArtifact`, `assertInvocationCount`, and `writeCurrentChange`, then reuse it from both spec and unit regression tests.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`
**Requirement:** R7
**Issue:** Final regression execution and artifact-reading boilerplate appears in both spec-level diagnostics tests and unit regression tests. The summaries show repeated `RunFinalRegressionCommand().execute(ctx)`, artifact reads, invocation-count checks, and current-change setup across files.
**Suggestion:** Move common final-regression test setup into a shared test helper, such as `runFinalRegressionAndReadArtifact`, `assertInvocationCount`, and `writeCurrentChange`, then reuse it from both spec and unit regression tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Use One Naming Convention For Child Failure Evidence
**Finding key:** loop-c7bf17a5d3f2c8932476
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R4
**Issue:** Naming around child failure evidence is inconsistent across the changed area: summaries mention `failures`, `childFailure`, `failedChildProcesses`, `truncatedPrefix`, and tail-preserved assertion evidence. The mixed terminology obscures whether code is referring to failed child records, captured diagnostic output, or truncation behavior.
**Suggestion:** Standardize names around explicit concepts such as `failedChildProcesses`, `childFailureEvidence`, and `tailPreservedAssertionEvidence`, and apply the convention consistently in production code and tests.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R4
**Issue:** Naming around child failure evidence is inconsistent across the changed area: summaries mention `failures`, `childFailure`, `failedChildProcesses`, `truncatedPrefix`, and tail-preserved assertion evidence. The mixed terminology obscures whether code is referring to failed child records, captured diagnostic output, or truncation behavior.
**Suggestion:** Standardize names around explicit concepts such as `failedChildProcesses`, `childFailureEvidence`, and `tailPreservedAssertionEvidence`, and apply the convention consistently in production code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
