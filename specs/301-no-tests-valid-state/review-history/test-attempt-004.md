# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/301-no-tests-valid-state/test-coverage.json`

## Blocking Findings

### 1. R2 negative validation coverage is incomplete
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R2
**Issue:** R2 claims validateSummaryEvidence validates not_applicable reason and raw_output_lines, but the test only calls validateSummaryEvidence on a valid artifact. The malformed reason and malformed range cases are asserted only against validateTestExecuteResultV2, so validateSummaryEvidence could ignore those no-tests checks and the test would still pass.
**Required change:** Add a spec-local negative assertion that validateSummaryEvidence rejects a not_applicable summary whose reason/raw output evidence does not match the raw decision log or valid raw_output_lines contract.
**Why blocking:** This leaves an acceptance requirement without executable coverage for the named validator behavior.

### 2. R3 project regression contract validation is not proved
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R3
**Issue:** R3 requires test-result-review to validate the project regression contract, but the test only checks the passing case and negative cases for summary membership and raw decision log. A review implementation that does not reject malformed regression metadata would still satisfy this test.
**Required change:** Add a failing no-tests artifact case with malformed regression contract metadata and assert test-result-review does not write verdict=pass.
**Why blocking:** A required validation path has no regression test, despite the coverage artifact marking R3 covered.

### 3. R5 skipped artifact contract fields are not asserted
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R5
**Issue:** R5 requires the no-supported-command path to write a skipped artifact with completed=true, nextAction=finalize-commit, and raw attempt log metadata. The test checks result, skipKind, discovery proof, and file existence, but not completed, nextAction, rawOutputPath/rawOutputLines, command, or commandSource.
**Required change:** Extend the no-supported-command R5 case to assert the required skipped artifact contract fields produced by RunFinalRegressionCommand.
**Why blocking:** The test would pass if implementation produced a partial skipped artifact that does not meet the required final-regression contract.

### 4. R6 downstream consumers are not covered
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R6
**Issue:** R6 names impl-gate, acceptance-review, report, and finalize artifact handling, but the test only exercises buildTestResultsFromArtifacts, validateIntegrationArtifactTrust, and durableTestArtifactPathspecs. It does not execute or directly validate those downstream consumers against not_applicable/skipped_by_project_policy artifacts.
**Required change:** Add spec-local coverage for the named downstream artifact consumers, or narrow the coverage artifact/requirement mapping so R6 is not claimed covered by this generic loader test alone.
**Why blocking:** The requirement coverage artifact says R6 is covered, but the actual test does not exercise the required consumers.

### 5. R7 signal failure case is missing
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R7
**Issue:** R7 explicitly requires started tests ending by signal to remain failures, but the test covers non-zero exit, timeout, spawn failure, and missing file only. It does not cover a process terminated by signal.
**Required change:** Add a started-command case that terminates by signal and assert the artifact remains a failure, is not skipped_by_project_policy, and preserves signal failure details.
**Why blocking:** One explicit failure mode in the acceptance requirement has no corresponding regression test.


## Advisory Findings

No advisory findings.