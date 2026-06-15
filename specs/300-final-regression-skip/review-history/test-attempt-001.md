# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/300-final-regression-skip/test-coverage.json`

## Blocking Findings

### 1. R1 only-if conditions are under-tested
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R1 test covers only the happy path for same-flow full/pass evidence and one command mismatch via R7. It does not exercise fail-closed cases for version, regression.required, regression.mode, regression.result, each command identity key, argv ordering/length, env/metadata key/value equality, or changed-file fingerprint set mismatch. This leaves the 'only when' and 'no subset of command identity keys is sufficient' requirements without spec-local regression coverage.
**Required change:** Add spec-local negative tests proving final-regression runs instead of skipping when any required R1 evidence field, command identity key, argv/env/metadata value, or changed-file fingerprint set does not exactly match.
**Why blocking:** R1 is a must requirement whose core safety property is rejecting stale or partial evidence; the current tests could pass while an implementation skips on incomplete or mismatched evidence.

### 2. R2 fail-closed allowlist behavior is under-tested
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R2 test only covers a docs-only happy path. It does not cover spec directory traversal/resolution, prompt files, skill/template/preset changes with upgrade evidence, generic test-only files requiring exact same-flow path-plus-fingerprint test-execute coverage, or fail-closed behavior for runtime, package/config, test-runner, dependency, external integration, unknown, and uncovered changed test files.
**Required change:** Add spec-local tests for representative allowed categories and negative cases showing full regression runs for non-allowlisted/sensitive/unknown paths and for generic test-only changes lacking exact same-flow path-plus-fingerprint coverage.
**Why blocking:** R2 is a must requirement defining when final regression may be skipped; without negative coverage, an unsafe implementation could skip on runtime or uncovered test changes and still satisfy the existing test suite.

### 3. R3 artifact proof shapes are only partially validated
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R3 test validates a hand-built covered-by-test-execute artifact but does not assert the artifact emitted by RunFinalRegressionCommand contains all required skipped fields, retained raw log path pattern, rawOutputLines range, full commandIdentity keys, changedFileFingerprints, staleCheck, or the risk_based_static_proof proof shape including checkedSensitivePathClasses, evidence paths, and failClosedDecision.
**Required change:** Assert the generated skipped artifacts for both skip kinds contain the complete R3 field set and proof structure, including rawOutputPath/rawOutputLines and all required proof subfields.
**Why blocking:** R3 is a must artifact contract. The current test could pass even if production writes incomplete skipped artifacts, especially for risk_based_static_proof.

### 4. R4 registry post-hook and next-action schema coverage is missing
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R4 test checks validateFinalRegressionResult and contractFromFinalRegressionArtifact on a hand-built skipped artifact, but it does not exercise the final-regression next-action schema or the registry post-hook marking final-regression done.
**Required change:** Add spec-local coverage that a skipped final-regression artifact is accepted by the next-action schema and by the registry post-hook/completion path as done.
**Why blocking:** R4 explicitly requires schema, flow-judgment, and registry post-hook acceptance. Two of those acceptance points currently have no corresponding test coverage.

### 5. Coverage artifact path contradicts supplied test file path
**Target:** Requirement-to-Test Coverage Artifact
**Issue:** The coverage artifact lists tests/final-regression-skip.test.js, but the supplied spec-local test code is under specs/300-final-regression-skip/tests/final-regression-skip.test.js.
**Required change:** Update the coverage artifact file references to the actual spec-local test path, or provide the missing root-level test file if that is the intended executable target.
**Why blocking:** The review artifact contradicts the actual test file location, so the claimed requirement-to-test mapping is not reliable.


## Advisory Findings

### 1. R6 prompt test could be more specific
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Improvement:** The R6 test checks for keywords only. It would be stronger to assert the prompt text mentions the required artifact fields for executed, covered-by-test-execute skip, and risk-based skip outcomes.
**Why non-blocking:** There is some prompt coverage, and wording-level checks are less critical than the executable skip safety gates.
