# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-explicit-task-render-context/test-coverage.json`

## Blocking Findings

### 1. R2 lookup exposure is untested
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Issue:** The R2 test verifies TaskCollection size, rejection cases, forward parent acceptance, and iteration identities, but it never exercises the public lookup API. An implementation could keep lookup entries as raw strings or expose unvalidated identities through lookup while still passing these tests.
**Required change:** Add a spec-local R2 assertion that uses TaskCollection's public lookup method/API and verifies returned task identities and parent identities are TaskId-backed validated values.
**Why blocking:** R2 explicitly requires public iteration and lookup to expose validated task identities, and the coverage artifact marks R2 covered by this file.

### 2. R4 ambient active-flow fallback is not isolated
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Issue:** The R4 SpecRenderContext test covers absent colocated flow metadata only in a root with no ambient active flow. It does not reproduce the pre-fix risk that absent or mismatched colocated metadata might read ambient active-flow state and use its featureBranch/Issue metadata.
**Required change:** Add a spec-local R4 case with an ambient active flow for a different spec and no matching colocated flow for the selected spec, then assert SpecRenderContext uses feature/<selected-directory> and User request.
**Why blocking:** R4 specifically forbids reading ambient active-flow state for absent or mismatched colocated metadata; current tests could pass while that forbidden behavior remains.

### 3. R6 invalid ID and duplicate rejection are not covered for flow sync
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Issue:** R6 requires syncSpecTasksToFlow to leave flow.json unchanged for invalid ID, duplicate, or unknown parent. The tests only cover unknown parent rejection and valid sync behavior.
**Required change:** Add R6 spec-local flow snapshot tests for an invalid task ID and a duplicate task ID, asserting syncSpecTasksToFlow throws and flow.json bytes are unchanged.
**Why blocking:** The requirement names three rejection classes for FlowStore mutation safety, but two have no corresponding spec-local coverage despite the artifact marking R6 covered.


## Advisory Findings

### 1. R3 complexity constraints are only indirectly checked
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Improvement:** Consider adding a static or instrumentation-oriented assertion that render planning does not perform recursive or pairwise task scans, if the production API exposes a practical hook.
**Why non-blocking:** The existing tests cover path confinement, write cardinality, and side-effect ordering; algorithmic complexity is difficult to prove with executable tests and this is a helpful strengthening rather than a concrete contradiction.
