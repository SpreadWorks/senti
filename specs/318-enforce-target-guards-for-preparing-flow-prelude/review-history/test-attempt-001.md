# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-enforce-target-guards-for-preparing-flow-prelude/test-coverage.json`

## Blocking Findings

### 1. Set command behavior is only checked through registry metadata
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js R3
**Issue:** The R3 test asserts requiresFlow and option strings for request, note, and auto, but never executes those commands. It does not cover matching guarded preparing routes, guard mismatches before mutation, non-null expected spec against a null preparing spec, guarded explicit unknown-run ACTIVE_FLOW_MISMATCH, guard-free unknown-run behavior, or note command class routing parity.
**Required change:** Add executable spec-local tests for flow set request, flow set note, and flow set auto covering guarded success, each guard mismatch before mutation, guarded explicit unknown-run ACTIVE_FLOW_MISMATCH, guard-free unknown-run behavior, and note registry/class routing parity.
**Why blocking:** R3 and R6 require behavioral evidence; metadata-only assertions could pass while production commands still mutate or route incorrectly.

### 2. Auto-check and prepare guard behavior is not exercised
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js R4
**Issue:** The R4 test only checks registry/help text. It never invokes flow run auto-check or flow prepare, so it does not prove guarded mismatches or guarded unknown runs fail before agent execution, branch/worktree/spec creation, nor that guard-free unknown runs keep command-specific failures or matching guarded prepare returns the promoted spec.
**Required change:** Add executable tests for auto-check no-agent rejection, prepare no-worktree/no-branch/no-spec rejection, guard-free unknown-run failures, and successful guarded prepare returning the promoted spec.
**Why blocking:** R4 and R6 are side-effect-ordering requirements; registry/help assertions cannot detect these regressions.

### 3. Post-prepare active-flow guard behavior is not covered
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js R5
**Issue:** The R5 test uses a generic OptionalCommand with a mocked activeState. It does not perform a successful prepare, verify guards after promotion to active flow, check run ID and spec mismatches after prepare, or evidence guard-free public behavior and FlowStore ownership.
**Required change:** Add a prepare-to-active regression that completes prepare, then verifies matching run ID, issue, and spec guards succeed and changing each one independently returns ACTIVE_FLOW_MISMATCH, with retained guard-free behavior/FlowStore ownership evidence.
**Why blocking:** R5 specifically requires post-prepare behavior; the current mock can pass without the prepare promotion path working.

### 4. Shared validation only tests issue mismatch
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js R2/R6
**Issue:** The FlowCommand and dispatcher tests only mismatch --expect-issue. There is no equivalent coverage for --expect-run-id mismatch or --expect-spec mismatch against preparingFlowState ?? flowState, including non-null expected spec when preparing spec is null.
**Required change:** Add targeted FlowCommand and dispatcher validation tests for run ID and spec mismatches, including the preparing spec-null case.
**Why blocking:** An implementation validating only issue expectations could pass the current tests while violating R2 and R6.

### 5. Coverage artifact overstates covered requirements
**Target:** Requirement-to-Test Coverage Artifact
**Issue:** The artifact marks R3, R4, R5, and R6 as covered by this file, but the actual tests omit required behavioral cases for set commands, auto-check, prepare, post-prepare guards, all mismatch types, and side-effect prevention.
**Required change:** Either add the missing executable coverage or change the artifact statuses so they no longer claim full coverage for those requirements.
**Why blocking:** The requirement coverage artifact contradicts the test file and would allow implementation to proceed with required acceptance coverage missing.


## Advisory Findings

No advisory findings.