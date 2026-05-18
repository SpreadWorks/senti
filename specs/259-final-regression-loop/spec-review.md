# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Pass nextAction conflicts with existing finalize step
**Target:** R3 / R7
**Issue:** R3 requires pass artifacts to use nextAction=finalize, but R7 routes a passing final-regression to finalize-commit and the existing flow has finalize-commit as the executable finalize leaf rather than a finalize run step.
**Required change:** Change R3's pass artifact nextAction to finalize-commit, or explicitly define a separate artifact value and flow routing value if both are intended.
**Why blocking:** Implementers and tests cannot determine the correct final-regression-result.json nextAction value; using finalize would not match the existing finalization integration point.

### 2. Final-regression repair can stale prior evidence
**Target:** R5 / final-regression failure repair path
**Issue:** The spec allows a retryable final-regression repair after retro while keeping review and gate-impl out of the retry path, but existing trusted evidence artifacts are produced earlier by test-execute, test-result-review, and retro. The spec does not define what happens if the repair changes files after those artifacts were created.
**Required change:** Add the minimal spec requirement for post-final-regression repair changes: either disallow automatic code edits and stop, or define how fresh spec-local evidence is produced, recorded, and consumed before finalize without re-entering review/gate-impl.
**Why blocking:** Without this, finalize can commit code changed after test-result-review/gate/retro using stale requirement evidence, and tests cannot assert the safe retry path.

### 3. invalid_project_test retry route is ambiguous
**Target:** R4 / R5
**Issue:** R4 lists invalid_project_test as a retryable=false stop category when there is no changedFiles link, while the existing final-regression routing model treats invalid_project_test as a test-repair path bounded by the one-retry rule.
**Required change:** State whether invalid_project_test is a one-retry repair path or a non-retryable stop path, and align R4/R5 wording with that choice.
**Why blocking:** The artifact fields retryable and nextAction for invalid command or test-contract failures would be implemented and tested in opposite ways.


## Non-blocking Improvements

### 1. Canonicalize EPERM failure kind spelling
**Target:** R4 / final-regression failureKind enum
**Improvement:** Clarify whether the canonical artifact value is child_process_eperm or the existing child_process_eprem spelling, and update examples consistently.
**Why non-blocking:** The implementation can still follow the current spec by renaming the enum, but an explicit note would prevent avoidable schema, prompt, and test churn.

### 2. Clarify full policy for targeted changes
**Target:** R1 / T-3
**Improvement:** State whether test.testExecuteRegression=full forces the root command without target paths even for changes classified as targeted, or only enables full execution when classification is already full.
**Why non-blocking:** The core default deferral behavior is still implementable and testable; this only tightens a secondary configuration case.
