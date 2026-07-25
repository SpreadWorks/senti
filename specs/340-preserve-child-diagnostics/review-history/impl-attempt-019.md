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

### 13. 1. Bound child record decoding
**Finding key:** loop-4804839bc1be60d360b8
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `decodeChildProcessRecords()` concatenates `stdout` and `stderr` and decodes all child records without an explicit record/count bound. That conflicts with the bounded-resource-usage guardrail for bulk data loading.  
**Suggestion:** Add an explicit maximum child-record count, stop decoding once reached, and surface a typed `childRecordError` or truncation marker in the artifact/raw log.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R3  
**Issue:** `decodeChildProcessRecords()` concatenates `stdout` and `stderr` and decodes all child records without an explicit record/count bound. That conflicts with the bounded-resource-usage guardrail for bulk data loading.  
**Suggestion:** Add an explicit maximum child-record count, stop decoding once reached, and surface a typed `childRecordError` or truncation marker in the artifact/raw log.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Extract repeated text-classifier loop
**Finding key:** loop-0fe6df609982188f7175
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** The loop over `TEXT_FAILURE_CLASSIFIERS` is duplicated for child execution failures and top-level process failures. This makes future classifier ordering or behavior changes easy to apply inconsistently.  
**Suggestion:** Introduce a helper such as `classifyTextFailure(normalizedText)` and use it in both places.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** The loop over `TEXT_FAILURE_CLASSIFIERS` is duplicated for child execution failures and top-level process failures. This makes future classifier ordering or behavior changes easy to apply inconsistently.  
**Suggestion:** Introduce a helper such as `classifyTextFailure(normalizedText)` and use it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Remove unused classification parameters
**Finding key:** loop-d675c03a2954794c68b2
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `classifyFinalRegressionFailure()` still accepts and is called with `root`, `state`, and `config`, but the new implementation no longer uses them after removing `classifyChangeScope()`.  
**Suggestion:** Remove those parameters from the function signature and call site to keep the API aligned with the evidence-based classifier design.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `classifyFinalRegressionFailure()` still accepts and is called with `root`, `state`, and `config`, but the new implementation no longer uses them after removing `classifyChangeScope()`.  
**Suggestion:** Remove those parameters from the function signature and call site to keep the API aligned with the evidence-based classifier design.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 4. Clarify child failure classifier naming
**Finding key:** loop-6702a2fadd7eedaed0d3
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyChildProcessFailure()` can return `UnknownRegressionFailure` even when all child processes passed. The name suggests it only classifies failed child processes, which makes the later `childFailure` logic harder to reason about.  
**Suggestion:** Rename it to something like `classifyChildProcessEvidence()` or split the “all children passed but parent failed” case into the caller.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyChildProcessFailure()` can return `UnknownRegressionFailure` even when all child processes passed. The name suggests it only classifies failed child processes, which makes the later `childFailure` logic harder to reason about.  
**Suggestion:** Rename it to something like `classifyChildProcessEvidence()` or split the “all children passed but parent failed” case into the caller.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 5. Simplify child failure return flow
**Finding key:** loop-82e08c5c6992a13c825a
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure()` checks `childFailure` twice: once only when any child failed, then again later unconditionally. This obscures the intended precedence between child evidence and top-level process evidence.  
**Suggestion:** Compute `failedChildProcesses` once, classify them explicitly, and handle the “children all passed but parent failed” case in a clearly named fallback branch.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R6  
**Issue:** `classifyFinalRegressionFailure()` checks `childFailure` twice: once only when any child failed, then again later unconditionally. This obscures the intended precedence between child evidence and top-level process evidence.  
**Suggestion:** Compute `failedChildProcesses` once, classify them explicitly, and handle the “children all passed but parent failed” case in a clearly named fallback branch.
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

### 35. 1. Centralize Child Process Record Limits
**Finding key:** loop-c46bed1e39d89c176e0e
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** Child process record bounding is discussed separately in `run-final-regression.js`, `test-artifacts.js`, and `test-regression.js`, with `128` appearing as a validator-local magic number while decoding/classification paths may use separate or missing limits. This can make producer, decoder, and artifact validation drift.
**Suggestion:** Define one shared constant such as `MAX_FINAL_REGRESSION_CHILD_PROCESS_RECORDS` and use it across decoding, artifact construction, validation, and tests.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R3
**Issue:** Child process record bounding is discussed separately in `run-final-regression.js`, `test-artifacts.js`, and `test-regression.js`, with `128` appearing as a validator-local magic number while decoding/classification paths may use separate or missing limits. This can make producer, decoder, and artifact validation drift.
**Suggestion:** Define one shared constant such as `MAX_FINAL_REGRESSION_CHILD_PROCESS_RECORDS` and use it across decoding, artifact construction, validation, and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Align Child Process Record Serialization Naming
**Finding key:** loop-5e220f42793cb2e3a583
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-regression.js`
**Requirement:** R1
**Issue:** `ChildProcessExecutionResult.toJSON()` appears to serialize a child execution record, while downstream files such as `run-final-regression.js`, `test-artifacts.js`, and tests reason about “records” explicitly. The naming mismatch can mislead callers across files about whether raw result fields or artifact-safe record fields are emitted.
**Suggestion:** Rename the method to `toExecutionRecordJSON()` or introduce a dedicated record conversion method, then update all record emission/decoding call sites and fixture helpers to use the same terminology.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`
**Requirement:** R1
**Issue:** `ChildProcessExecutionResult.toJSON()` appears to serialize a child execution record, while downstream files such as `run-final-regression.js`, `test-artifacts.js`, and tests reason about “records” explicitly. The naming mismatch can mislead callers across files about whether raw result fields or artifact-safe record fields are emitted.
**Suggestion:** Rename the method to `toExecutionRecordJSON()` or introduce a dedicated record conversion method, then update all record emission/decoding call sites and fixture helpers to use the same terminology.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Share Final Regression Failure Classification Helpers
**Finding key:** loop-7b9bef96f5afd54f6bb0
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R6
**Issue:** Failure classification logic is being duplicated or separately named across child evidence and top-level process evidence, while tests introduce multiple child assertion/spawn-error fixtures that encode the same classifier assumptions. This increases the chance that child evidence and parent process evidence diverge in behavior.
**Suggestion:** Extract shared helpers such as `classifyTextFailure()` and clearly named child evidence classification functions, then update tests to build fixtures through helper names that match those classifier concepts.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R6
**Issue:** Failure classification logic is being duplicated or separately named across child evidence and top-level process evidence, while tests introduce multiple child assertion/spawn-error fixtures that encode the same classifier assumptions. This increases the chance that child evidence and parent process evidence diverge in behavior.
**Suggestion:** Extract shared helpers such as `classifyTextFailure()` and clearly named child evidence classification functions, then update tests to build fixtures through helper names that match those classifier concepts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Centralize Rejected Impl Review Triage Loading
**Finding key:** loop-0da37f1cd20848a04f85
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R6
**Issue:** Rejected impl-review triage loading is proposed in both `acceptance-review-artifacts.js` and `impl-repair-artifacts.js`, with overlapping validation/source-step concerns and inconsistent failure behavior. This is a cross-file interface risk because both files depend on the same artifact semantics.
**Suggestion:** Create a shared helper in the impl-repair artifact layer, for example `readRejectedImplReviewTriageIfRejected(specDir, verdict)`, and have acceptance review code call it instead of duplicating predicate, loading, and validation behavior.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R6
**Issue:** Rejected impl-review triage loading is proposed in both `acceptance-review-artifacts.js` and `impl-repair-artifacts.js`, with overlapping validation/source-step concerns and inconsistent failure behavior. This is a cross-file interface risk because both files depend on the same artifact semantics.
**Suggestion:** Create a shared helper in the impl-repair artifact layer, for example `readRejectedImplReviewTriageIfRejected(specDir, verdict)`, and have acceptance review code call it instead of duplicating predicate, loading, and validation behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
