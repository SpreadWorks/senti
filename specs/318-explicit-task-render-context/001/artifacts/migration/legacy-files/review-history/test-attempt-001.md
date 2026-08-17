# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-explicit-task-render-context/test-coverage.json`

## Blocking Findings

### 1. R3 side-effect ordering and plan bounds are not covered
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:139
**Issue:** The R3 test only constructs TaskOutputPath directly and checks path confinement. It does not exercise CLI or internal render entry points to prove exactly n TaskOutputPath values, at most n task Markdown bodies/write-plan entries, and completion of plan construction before the first mkdir/write side effect.
**Required change:** Add spec-local production-entry coverage for runSpecRender and/or renderSpecView that observes the render planning/write boundary and verifies no directory creation or file write occurs until all task paths and bounded write-plan entries have been constructed.
**Why blocking:** R3 explicitly requires entry-point behavior before side effects; the current test can pass even if production rendering creates directories or writes files while still discovering tasks.

### 2. R5 byte-for-byte rollback coverage is incomplete
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:202
**Issue:** The R5 test only checks that new output paths do not appear after an invalid parent. It does not snapshot and verify existing spec.md, existing task files, orphan task files, requested --out contents, or files outside the selected spec directory remain byte-for-byte unchanged for R1-R4 rejections.
**Required change:** Extend R5 coverage to create and snapshot the selected spec.md, tasks directory contents including generated and orphan files, an existing requested --out file, and an outside file, then assert all bytes are unchanged after representative R1-R4 rejection paths through runSpecRender/renderSpecView.
**Why blocking:** R5's core acceptance requirement is preservation of existing filesystem bytes on rejection; absence checks would pass despite truncating or rewriting existing files.

### 3. R6 valid sync construction is not covered
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:221
**Issue:** The R6 test covers unknown-parent rejection preserving flow.json, but does not verify that valid sync appends task IDs, parent values, and tasks/<id>.md paths only from validated values.
**Required change:** Add a valid syncSpecTasksToFlow test that uses valid IDs and parent relationships, then asserts appended flow task IDs, parent fields, and task paths are derived from the validated TaskCollection values.
**Why blocking:** R6 includes both rejection-before-mutation and valid-value construction requirements; only the rejection branch currently has coverage.

### 4. R7 approval-sync compatibility requirements lack coverage
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:236
**Issue:** The R7 test verifies deterministic render bytes without ambient flow metadata, but does not exercise approval sync append-only filtering, assigned_round calculation, field transcription, task-step construction, or pending-task promotion.
**Required change:** Add production-entry coverage for the valid approval sync path asserting append-only behavior, assigned_round, copied fields, constructed task steps, and pending-task promotion remain unchanged.
**Why blocking:** R7 lists these as must-retain behaviors; without tests, implementation could regress sync semantics while the current R7 render-only test still passes.


## Advisory Findings

### 1. R1 negative cases could include parent-specific validation
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:84
**Improvement:** Add a small schema validation case for a non-null tasks[].parent value, not just inspection of the schema pattern string and TaskId constructor behavior.
**Why non-blocking:** The current assertions establish the intended pattern and constructor rejection set, but an executable schema case would make the parent path harder to regress.
