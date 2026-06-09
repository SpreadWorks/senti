# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/283-flow-definition-lifecycle/test-coverage.json`

## Blocking Findings

### 1. R7 compatibility is marked covered without behavioral compatibility tests
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js, test "R7: registry keeps command metadata while lifecycle ownership changes"
**Issue:** The test only regex-checks registry source for command keys, helpKey, args, lazy imports, and lifecycle delegation. It does not exercise or snapshot existing flow CLI command names/options/help text, JSON envelope shapes, status transitions, or exit behavior, which R7 explicitly requires to remain user-visible compatible.
**Required change:** Add spec-local compatibility coverage that invokes or otherwise verifies representative existing flow commands/options/help and JSON/exit/status behavior, not just registry source tokens.
**Why blocking:** The coverage artifact marks R7 covered, but the actual test can pass while user-visible CLI behavior regresses.

### 2. R6 raw definition dependency test encodes an overbroad implementation premise
**Target:** specs/283-flow-definition-lifecycle/tests/definition-boundary.test.js, test "R6: production, helper, and shared tests do not import raw definition data"
**Issue:** The test scans every src and shared test file for any occurrence of FLOW_DEFINITION or TASK_DEFINITION. R1/R6 require raw exported data and caller dependencies to be removed, but this test would also fail a valid implementation that keeps private internal constants with those names inside definition.js.
**Required change:** Narrow the assertion to exported symbols and external imports/references, or exclude definition.js private implementation details from the raw-name scan.
**Why blocking:** This would block a valid refactor that satisfies the public boundary while retaining private implementation names.

### 3. Draft PASS artifact preservation is not actually tested
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js, test "R4: resolveLifecycle returns executable draft review PASS artifact actions"
**Issue:** The test asserts that a RunLifecycleHook named writeEmptyDraftReviewRouteArtifacts is returned and can be dispatched to a recorder, but it does not verify that empty triage/repair artifacts are generated or that existing draft PASS artifacts are preserved.
**Required change:** Add an executable regression around the lifecycle helper/hook behavior that proves draft PASS triage/repair artifacts are created only as needed and existing artifacts are not overwritten.
**Why blocking:** R8 explicitly requires draft PASS artifact preservation coverage; checking only a hook name can pass without exercising the production behavior.

### 4. Implementation-review evidence reset coverage only checks strings
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js, test "R4: resolveLifecycle covers impl proposal reset and finalize downstream behavior"
**Issue:** The proposal reset case only asserts a hook handler name and that serialized actions contain test-execute and finalize-cleanup somewhere. It does not verify the concrete downstream reset range or that evidence is actually reset from test-execute through finalize-cleanup.
**Required change:** Assert a structured reset action or execute the shared lifecycle hook/helper against representative state to verify the exact downstream steps and evidence reset behavior.
**Why blocking:** R4/R8 require regression coverage for proposal evidence reset; the current string check can pass without the required lifecycle behavior.

### 5. Finalize lifecycle status transitions are incomplete
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js
**Issue:** The lifecycle tests cover finalize-merge success/error and delegation checks for finalize-sync/finalize-cleanup hooks, but they do not verify the post-transition behavior for finalize-sync and finalize-cleanup themselves.
**Required change:** Add resolveLifecycle assertions for finalize-sync post and finalize-cleanup post that verify the expected status transitions and any lifecycle hooks/side effects.
**Why blocking:** R4 requires finalize status transition coverage for the lifecycle cases named in the issue; delegation-only assertions do not cover those transitions.

### 6. Registry hardcode prohibition can pass with renamed hardcoded maps
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js, test "R5: registry hooks delegate definition-derived lifecycle decisions"
**Issue:** The static checks reject only specific old names and a few tryUpdateStepStatus patterns. A registry implementation could still hardcode review/gate phase maps or downstream step id lists under different names while calling resolveLifecycle/applyLifecycleActions somewhere, and this test would pass.
**Required change:** Add mutation-resistant assertions that lifecycle hook bodies do not contain definition-derived step id literals or phase-to-step/downstream-list structures, or verify delegation through a shared helper boundary instead of matching only old symbol names.
**Why blocking:** R5 explicitly forbids hardcoded flow step ids, phase maps, and finalize downstream leaf lists for definition-derived decisions; the current test does not enforce that acceptance requirement.


## Advisory Findings

No advisory findings.