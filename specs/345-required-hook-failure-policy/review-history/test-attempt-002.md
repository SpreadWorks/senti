# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/345-required-hook-failure-policy/test-coverage.json`

## Blocking Findings

### 1. Required post-hook test expects pre-hook control flow
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js: R3 test
**Issue:** The R3 matrix registers hooks with `static hook = "post"` but asserts `mainCalls === 0`. A post-hook failure cannot prove the lifecycle stopped before main execution, and this contradicts the likely pre/post lifecycle contract.
**Required change:** Use a pre-hook for the stop-before-main assertion, or keep post-hook coverage but remove the `mainCalls === 0` premise and assert typed caller failure only.
**Why blocking:** The test encodes an incorrect implementation premise and can force implementation to violate the target lifecycle API.

### 2. Missing snapshot policy rejection is not covered
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js: R1/R5 tests
**Issue:** The tests cover invalid snapshot policy but do not cover a persisted `plugins.flowCommandHooks` snapshot entry with the failure policy omitted.
**Required change:** Add a spec-local test that loads/runs a snapshot entry without `failurePolicy` and asserts rejection before hook execution.
**Why blocking:** R1 explicitly requires persisted snapshot entries to contain one policy and reject missing policy before execution.

### 3. Integrity hard-failure cases are incomplete
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js: R5 test
**Issue:** R5 requires import failure, invalid `register(api)`, invalid `FlowCommandHook` inheritance, missing snapshot module, and snapshot metadata mismatch to remain hard failures. The current test covers missing module and metadata mismatch, but not an importing module that throws, invalid register return/shape, or invalid hook inheritance.
**Required change:** Add spec-local tests for import-time failure, invalid `register(api)`, and a registered class that does not validly inherit `FlowCommandHook`, asserting hard rejection for advisory policy.
**Why blocking:** Several acceptance-required integrity risks have no regression coverage.

### 4. Prepare command atomicity is not covered
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Issue:** R6 requires a required pre-hook failure in prepare to leave spec source, draft, flow state, issue-log, and plugin artifact files untouched. The tests only check generic lifecycle `main` suppression and finalize-cleanup state.
**Required change:** Add a command-level `run-prepare-spec` required pre-hook failure test that asserts the listed prepare files/state are not created or modified.
**Why blocking:** An explicit command-level atomicity acceptance requirement has no corresponding spec-local test coverage.

### 5. run-prepare-spec structured outcome consumption is not covered
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js: R7 coverage
**Issue:** R7 requires both `run-prepare-spec` and `run-finalize-cleanup` to consume the structured runner outcome. The current R7 tests cover finalize-cleanup only.
**Required change:** Add a `run-prepare-spec` test that triggers a required hook failure and asserts the caller exposes/uses the structured required failure outcome rather than warning-code severity inference.
**Why blocking:** A named caller in the acceptance requirement has no direct regression coverage.

### 6. Context write failure is not covered
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js: R3/R8 matrices
**Issue:** The required/advisory matrices cover artifact write failure via `context.artifacts.writeJson('../escape.json', {})`, but do not cover context write failure if the hook API exposes separate context persistence/write behavior.
**Required change:** Add required and advisory matrix cases for the relevant context write failure path, or narrow the spec wording if only artifact writes exist in the target API.
**Why blocking:** R3 and R8 explicitly require artifact/context write failure coverage, but only artifact write failure is exercised.


## Advisory Findings

No advisory findings.