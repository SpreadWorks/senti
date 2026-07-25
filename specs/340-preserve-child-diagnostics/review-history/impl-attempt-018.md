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

### 4. 1. Extract Invocation Counter Fixture Lines
**Finding key:** loop-84773ad6a3cac7ef8b54
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The `invocation-count.txt` setup appears both in `fixturePrinting(..., { counter: true })` and inline in the pass-behavior test. This duplicates fixture construction logic and makes invocation-count parity tests easier to drift.  
**Suggestion:** Add a small helper such as `invocationCounterLines()` and reuse it from both `fixturePrinting` and the inline passing fixture.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R8  
**Issue:** The `invocation-count.txt` setup appears both in `fixturePrinting(..., { counter: true })` and inline in the pass-behavior test. This duplicates fixture construction logic and makes invocation-count parity tests easier to drift.  
**Suggestion:** Add a small helper such as `invocationCounterLines()` and reuse it from both `fixturePrinting` and the inline passing fixture.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Extract Counter Assertion Helper
**Finding key:** loop-72af7575a193fc04a146
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R7
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** The assertion `fs.readFileSync(path.join(..., "invocation-count.txt"), "utf8") === "1"` is repeated across several tests, with one `"2"` variant.  
**Suggestion:** Add `assertInvocationCount(project, expected)` to centralize the path and encoding, improving readability and reducing repetition.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** The assertion `fs.readFileSync(path.join(..., "invocation-count.txt"), "utf8") === "1"` is repeated across several tests, with one `"2"` variant.  
**Suggestion:** Add `assertInvocationCount(project, expected)` to centralize the path and encoding, improving readability and reducing repetition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Extract Run-And-Read Artifact Helper
**Finding key:** loop-cc5607dd5cd4ae83997e
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R5
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** Many tests repeat the sequence `await new RunFinalRegressionCommand().execute(ctx); const artifact = readArtifact(tmp/project);`.  
**Suggestion:** Add a helper like `async function runFinalRegression(ctx) { const result = await new RunFinalRegressionCommand().execute(ctx); return { result, artifact: readArtifact(ctx.root) }; }`. This keeps each test focused on expected behavior.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** Many tests repeat the sequence `await new RunFinalRegressionCommand().execute(ctx); const artifact = readArtifact(tmp/project);`.  
**Suggestion:** Add a helper like `async function runFinalRegression(ctx) { const result = await new RunFinalRegressionCommand().execute(ctx); return { result, artifact: readArtifact(ctx.root) }; }`. This keeps each test focused on expected behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Rename `marker` To Reflect Encoded Child Record
**Finding key:** loop-c00d15fadf1c7a4767da
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R5
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** The name `marker` is vague for values produced by `encodedRecord(...)`; these strings are serialized child-process execution records, not generic markers.  
**Suggestion:** Rename local variables such as `marker`, `retryMarker`, and `proceedMarker` to `childRecord`, `retryChildRecord`, or `encodedChildRecord`.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R5  
**Issue:** The name `marker` is vague for values produced by `encodedRecord(...)`; these strings are serialized child-process execution records, not generic markers.  
**Suggestion:** Rename local variables such as `marker`, `retryMarker`, and `proceedMarker` to `childRecord`, `retryChildRecord`, or `encodedChildRecord`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Replace Boolean Assertion With Direct Predicate Assertion
**Finding key:** loop-82dd7337be33253097b2
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R3
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R3  
**Issue:** `assert.equal(stream.capturedByteLength <= 8, true);` is less idiomatic and gives weaker failure output than a direct assertion message.  
**Suggestion:** Use `assert.ok(stream.capturedByteLength <= 8, "captured byte length should stay within capture limit");`.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R3  
**Issue:** `assert.equal(stream.capturedByteLength <= 8, true);` is less idiomatic and gives weaker failure output than a direct assertion message.  
**Suggestion:** Use `assert.ok(stream.capturedByteLength <= 8, "captured byte length should stay within capture limit");`.
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

### 13. 1. Remove unused parameters from `classifyFinalRegressionFailure`
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

### 14. 2. Simplify redundant child failure branching
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

### 15. 3. Rename `childRecordError` for consistency with persisted artifact wording
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

### 16. 4. Avoid misleading `UnknownRegressionFailure` when all child records passed
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

### 17. 5. Extract repeated text-classifier loop
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

### 35. 1. Centralize Child Process Record Test Fixtures
**Finding key:** loop-7382ca76777b7b3bf411
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js
**Requirement:** R8
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R8  
**Issue:** Multiple test files independently introduce helpers or inline setup for encoded child-process records: `encodedRecord(...)`, `shellPrintChildProcessRecord(...)`, typed assertion stderr fixtures, and child process payload constants. These duplicate the same fixture concept across spec and unit tests, increasing drift risk when the child record format changes.  
**Suggestion:** Create a shared test helper for constructing encoded child-process records and assertion stderr payloads, then reuse it from the affected final-regression and child-diagnostics tests.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js`  
**Requirement:** R8  
**Issue:** Multiple test files independently introduce helpers or inline setup for encoded child-process records: `encodedRecord(...)`, `shellPrintChildProcessRecord(...)`, typed assertion stderr fixtures, and child process payload constants. These duplicate the same fixture concept across spec and unit tests, increasing drift risk when the child record format changes.  
**Suggestion:** Create a shared test helper for constructing encoded child-process records and assertion stderr payloads, then reuse it from the affected final-regression and child-diagnostics tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Unify Rejected Impl Review Triage Loading Semantics
**Finding key:** loop-7bcc93d89c7dd611d218
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** Rejected impl-review triage handling spans `acceptance-review-artifacts.js` and `impl-repair-artifacts.js`, but the proposed per-file fixes point to different helper boundaries and inconsistent read-failure behavior. This is a cross-file interface inconsistency around the same artifact lifecycle.  
**Suggestion:** Define one exported helper in `impl-repair-artifacts.js`, such as `readRejectedImplReviewTriageIfRejected(specDir, verdict)`, with explicit failure semantics. Use it from `acceptance-review-artifacts.js` instead of reimplementing the predicate and artifact read behavior.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** Rejected impl-review triage handling spans `acceptance-review-artifacts.js` and `impl-repair-artifacts.js`, but the proposed per-file fixes point to different helper boundaries and inconsistent read-failure behavior. This is a cross-file interface inconsistency around the same artifact lifecycle.  
**Suggestion:** Define one exported helper in `impl-repair-artifacts.js`, such as `readRejectedImplReviewTriageIfRejected(specDir, verdict)`, with explicit failure semantics. Use it from `acceptance-review-artifacts.js` instead of reimplementing the predicate and artifact read behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Share Child Process Kind Constants Across Codec And Artifact Validation
**Finding key:** loop-1515d987c7ab9186d96a
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** Child process `kind` values are validated in persisted artifacts while related completion/exit-kind logic is encoded separately in `test-regression.js`. Keeping these string sets in separate files can produce schema/runtime drift.  
**Suggestion:** Move child process kind constants and completed-exit-kind helpers into one shared module, then import them from both artifact validation and child execution classification code.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** Child process `kind` values are validated in persisted artifacts while related completion/exit-kind logic is encoded separately in `test-regression.js`. Keeping these string sets in separate files can produce schema/runtime drift.  
**Suggestion:** Move child process kind constants and completed-exit-kind helpers into one shared module, then import them from both artifact validation and child execution classification code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Standardize Child Record Decode Error Naming
**Finding key:** loop-3fc9159e9e604acaba82
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** Naming around serialized child diagnostics varies across files: tests refer to encoded records or markers, runtime uses `childRecordError`, and domain classes use `ChildProcessExecutionRecord`. This makes it harder to distinguish child process failures from child record decoding failures.  
**Suggestion:** Use a consistent term such as `childProcessRecord` for serialized records and `childProcessRecordDecodeError` for parse failures across runtime code and tests.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R5  
**Issue:** Naming around serialized child diagnostics varies across files: tests refer to encoded records or markers, runtime uses `childRecordError`, and domain classes use `ChildProcessExecutionRecord`. This makes it harder to distinguish child process failures from child record decoding failures.  
**Suggestion:** Use a consistent term such as `childProcessRecord` for serialized records and `childProcessRecordDecodeError` for parse failures across runtime code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Consolidate Invocation Counter Test Utilities
**Finding key:** loop-cd65590f2f1f3c67313e
**Failure mode:** refactor
**File:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Requirement:** R7
**Issue:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** Invocation-count fixture setup and assertions appear in the spec test file, while related final-regression unit tests also construct shell fixtures inline. The same “prove no extra child/process invocation” pattern is being recreated rather than shared.  
**Suggestion:** Add a shared test utility for invocation-counter fixture creation and `assertInvocationCount(project, expected)`, then use it across final-regression diagnostics and record-and-proceed style tests.
**Suggestion:** **File:** `specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js`  
**Requirement:** R7  
**Issue:** Invocation-count fixture setup and assertions appear in the spec test file, while related final-regression unit tests also construct shell fixtures inline. The same “prove no extra child/process invocation” pattern is being recreated rather than shared.  
**Suggestion:** Add a shared test utility for invocation-counter fixture creation and `assertInvocationCount(project, expected)`, then use it across final-regression diagnostics and record-and-proceed style tests.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
