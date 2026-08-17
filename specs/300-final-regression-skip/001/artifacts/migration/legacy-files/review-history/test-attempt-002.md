# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/300-final-regression-skip/test-coverage.json`

## Blocking Findings

### 1. R2 allowlist coverage is incomplete
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R2 tests only exercise a docs-only skip, unknown/runtime/package/test-without-evidence fallback, and one covered generic test-only skip. They do not cover spec-directory path eligibility and traversal rejection, docs mdx/top-level patterns, flow prompt paths, skill/template/preset paths requiring upgrade evidence, or sensitive classifications such as config/test-runner/dependency/external-integration exclusions.
**Required change:** Add spec-local tests for each explicit R2 allowlist family and for fail-closed sensitive/excluded path classes, including at least one traversal/outside-spec rejection and one skill/template/preset change without required upgrade evidence.
**Why blocking:** R2 is a broad acceptance gate for when final-regression may be skipped. Missing coverage for several allowed and forbidden path classes could let implementation skip full regression for runtime-sensitive changes or fail to skip valid non-runtime-only changes.

### 2. R1 exact changed-file fingerprint set is under-tested
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The stale-evidence test mutates a single fingerprint value but does not verify exact set equality for changed-file fingerprints. An implementation could compare only the first path, accept subsets, ignore extra evidence entries, or ignore missing current changed files and still pass these tests.
**Required change:** Extend R1 stale cases to cover missing evidence entries, extra evidence entries, path mismatch, and current changed-file set changes that are not exactly represented in the stored full-regression evidence.
**Why blocking:** R1 explicitly requires exact current trigger-relevant changed-file fingerprint set equality. Subset or partial matching is forbidden, and the current tests would not catch that static anti-pattern.

### 3. R3 risk-based proof shape is not validated by schema-level test
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R3 validation test calls validateFinalRegressionResult() only with the covered_by_test_execute_full_regression proof fixture. The risk_based_static_proof helper assertions inspect artifacts produced by command execution, but there is no direct validator test proving skipped artifacts with the required risk-based proof shape are accepted and malformed covered-by proof fields are not mistakenly required.
**Required change:** Add a validateFinalRegressionResult() fixture for skipKind risk_based_static_proof containing allowlistClassifications, checkedSensitivePathClasses, failClosedDecision, upgradeEvidencePath, and testExecuteEvidencePath, and assert it validates without covered-by-only fields.
**Why blocking:** R3 requires two distinct skipped proof schemas. Without validator coverage for the risk-based shape, implementation could incorrectly reject or mis-shape risk-based skipped artifacts while these tests still pass through narrower execution assertions.

### 4. R7 does not exercise prior-flow or prior-invocation reuse
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R7 test mutates command identity inside the current same-flow test-execute artifact. It does not create reusable full-regression evidence in a different flow or prior invocation location and prove final-regression refuses to reuse it.
**Required change:** Add a test where valid full/pass evidence exists only for a different flow or prior invocation while the current flow lacks matching same-flow evidence, then assert full regression runs.
**Why blocking:** R7 specifically keeps cross-flow last-known-green reuse out of scope. The current test only covers stale same-flow identity, so the requirement coverage artifact overstates actual coverage.


## Advisory Findings

### 1. Prompt test is mostly keyword based
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Improvement:** The R6 test could assert short required phrases or headings around each responsibility/outcome instead of isolated terms such as process, proof, and executed.
**Why non-blocking:** The test still gives useful static coverage that the prompt files mention the required concepts, but tighter assertions would reduce false positives from incidental wording.
