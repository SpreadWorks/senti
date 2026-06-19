# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/311-final-regression-proceed/test-coverage.json`

## Blocking Findings

### 1. R4 final report data is not covered by an executed record-and-proceed artifact
**Target:** specs/311-final-regression-proceed/tests/final-regression-report-and-prompt.test.js
**Issue:** The R4 report test uses a handcrafted reportInput() object instead of the final-regression artifact produced by a record-and-proceed selection. It can pass even if the runner fails to persist the required fields in final-regression-result.json in the shape consumed by final report generation.
**Required change:** Drive generateReport from the actual failed-recorded artifact produced by the runner test path, or add a spec-local test that writes/loads that artifact through the same report data path used in production before asserting selectedAction, remainingRisk, nextAction, and nextRecommendedAction.
**Why blocking:** R4 explicitly requires these fields in final-regression-result.json and final report data; the current report test does not exercise the production handoff between the artifact and final report data.

### 2. R5 CLI flag behavior is not covered
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Issue:** R5 requires `senti flow run final-regression --record-and-proceed` to validate the current failed artifact and return an envelope that allows the post-hook to complete the step. The tests call RunFinalRegressionCommand.execute({ recordAndProceed: true }) directly, which bypasses CLI flag parsing and command dispatch.
**Required change:** Add a spec-local executable test that invokes the flow command path with `final-regression --record-and-proceed` and asserts stale/ineligible rejection plus the validated failed-recorded envelope used by the post-hook.
**Why blocking:** The acceptance requirement names the CLI behavior specifically; direct class invocation does not prove the public command API supports the flag or returns the expected envelope.

### 3. R8 final report integration is only tested with handcrafted data
**Target:** specs/311-final-regression-proceed/tests/final-regression-report-and-prompt.test.js
**Issue:** The report text and JSON assertions use a manually constructed finalRegression object. This can pass even if production status/report collection misreads failed-recorded artifacts or omits required fields before generateReport is called.
**Required change:** Add an integration-style report/status test that starts from a failed-recorded final-regression-result.json artifact and exercises the production report/status input assembly path before asserting category, raw log path, fixAttempts, remainingRisk, selectedAction, and nextRecommendedAction.
**Why blocking:** R8 requires status, final report, report JSON, and human-readable summaries to display failed-recorded final-regression as not passed; handcrafted report input does not cover the production artifact-to-report path.


## Advisory Findings

No advisory findings.