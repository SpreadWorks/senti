# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Missing target state for unknown preparing run guards
**Target:** R1/R2/AC2/AC5/AC6
**Issue:** The spec requires guarded commands with an explicit unknown preparing run to return ACTIVE_FLOW_MISMATCH before command loading or side effects, but the proposed selection rule is only `preparingFlowState ?? flowState`. In the current code, `FlowTargetExpectation.mismatchAgainst()` in `src/lib/flow-target-guard.js` returns no mismatch when the selected state is null, and that file is not in the allowed product-change list. An unknown `--run-id` therefore has no concrete target state for dispatcher/base-command guards to compare against.
**Required change:** Specify the smallest missing-run representation or guard path: either define an isolated null-valued preparing target snapshot that `preparingFlowState ?? flowState` will compare against, or include `src/lib/flow-target-guard.js` in scope and require target expectations to mismatch when an explicit preparing selection resolves to no state.
**Why blocking:** Without this, AC2/AC5/AC6 cannot be implemented or tested as written: guarded unknown-run calls will not produce ACTIVE_FLOW_MISMATCH at the shared pre-command boundary and can fall through to command-specific PREPARING_FLOW_NOT_FOUND/ERROR paths or command loading.

### 2. Unknown run error contract conflicts with guard-free preservation
**Target:** AC5/AC6 and Constraints
**Issue:** AC5 and AC6 say an unknown run returns ACTIVE_FLOW_MISMATCH, while the constraints also require preserving documented behavior when no target guard is supplied. Existing preparing command paths use `resolvePreparingRunId()` for request/note/auto/auto-check and currently return PREPARING_FLOW_NOT_FOUND for guard-free unknown `--run-id`; prepare currently throws from `resolvePreparingInputs()` for guard-free unknown `--run-id`. The spec does not say whether AC5/AC6 apply only when `--expect-*` guards are supplied.
**Required change:** Constrain the unknown-run ACTIVE_FLOW_MISMATCH requirement to guarded invocations, or explicitly state that guard-free unknown `--run-id` behavior is intentionally changing and include the affected command error contracts in scope.
**Why blocking:** Tests cannot be designed consistently: preserving guard-free behavior expects existing command-specific errors, while AC5/AC6 can be read to require ACTIVE_FLOW_MISMATCH for the same guard-free unknown-run inputs.


## Non-blocking Improvements

No non-blocking improvements.