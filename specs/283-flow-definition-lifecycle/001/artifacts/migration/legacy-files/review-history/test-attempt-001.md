# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/283-flow-definition-lifecycle/test-coverage.json`

## Blocking Findings

### 1. Lifecycle behavior is only checked by source-text regexes
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js
**Issue:** R4 requires definition-side lifecycle resolution for concrete review/gate/finalize transitions, draft PASS artifacts, proposal evidence reset, downstream skip/reset, sideEffects, maxAttempts, and runtime log step resolution, but the tests only search for tokens in source files. They would pass if the names appeared in comments, dead code, or unrelated helpers without exercising lifecycle behavior.
**Required change:** Add executable spec-local tests that import the lifecycle API and assert representative lifecycle outputs/effects for the named R4 cases.
**Why blocking:** A must requirement for critical lifecycle behavior has no regression test that exercises production behavior.

### 2. Definition API boundary is not verified as an exported runtime contract
**Target:** specs/283-flow-definition-lifecycle/tests/definition-boundary.test.js
**Issue:** R1 and R6 require callers to stop depending on raw FLOW_DEFINITION/TASK_DEFINITION and use definition-side APIs, but the tests mostly inspect definition.js text. They do not import the module namespace to prove raw data exports are absent or that the required APIs are actually exported and callable.
**Required change:** Import src/flow/definition.js in the test, assert FLOW_DEFINITION and TASK_DEFINITION are absent from the module namespace, and assert the required definition-side APIs exist as functions with at least minimal callable behavior.
**Why blocking:** The current test can pass while the public module contract is missing or unusable.

### 3. Step-tree consumer migration is not covered
**Target:** specs/283-flow-definition-lifecycle/tests/definition-boundary.test.js
**Issue:** R2 requires all consumers to import steps-array utilities from the dedicated step-tree module, but the test only checks that step-tree.js exists and definition.js no longer exports some functions. It does not detect consumers still importing those utilities from definition.js or otherwise depending on the old boundary.
**Required change:** Add a scan or executable import-boundary test that fails when src/ or tests/ import flattenSteps, findStepById, findFirstPendingLeaf, or findInProgressLeaf from src/flow/definition.js instead of src/flow/lib/step-tree.js.
**Why blocking:** A required migration could be incomplete while the declared R2 coverage still passes.

### 4. Lifecycle action invariants are not executable tests
**Target:** specs/283-flow-definition-lifecycle/tests/definition-boundary.test.js
**Issue:** R3 requires dedicated action classes with constructor-enforced invariants for multiple lifecycle behaviors, but the test only searches for class-name patterns and any constructor containing throw new Error. It does not instantiate actions or assert invalid inputs are rejected and valid actions produce expected effects.
**Required change:** Expose or otherwise reach the action classes through the definition API and add tests that instantiate representative valid and invalid actions for status transitions, keep-in-progress, metrics, issue-log appends, sideEffects, skip behavior, and hook escape hatches.
**Why blocking:** Constructor invariants are a must requirement, and the current test would pass without enforcing any of them.

### 5. Registry delegation test can pass with hardcoded lifecycle decisions still present
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js
**Issue:** R5 forbids hardcoded flow step ids, review phase maps, gate phase maps, and finalize downstream leaf lists for definition-derived decisions, but the test checks only a few exact identifiers and tryUpdateStepStatus patterns. Equivalent hardcoding under different names or data structures would pass.
**Required change:** Add a behavioral delegation test using the definition-side lifecycle API or a shared lifecycle helper as the source of truth, and verify registry hooks apply those resolved decisions without embedding their own phase/downstream mappings.
**Why blocking:** The current static checks do not reliably cover the required registry/definition ownership boundary.


## Advisory Findings

### 1. CLI compatibility coverage is shallow
**Target:** specs/283-flow-definition-lifecycle/tests/registry-lifecycle.test.js
**Improvement:** R7 is marked covered, but the test only checks registry metadata tokens. Add focused command-level smoke tests for unchanged JSON envelope shape, exit behavior, and a representative help/options path if those are available in the spec harness.
**Why non-blocking:** The existing metadata checks provide some static coverage, and deeper CLI compatibility can be handled as additional confidence unless the affected implementation changes command execution paths directly.
