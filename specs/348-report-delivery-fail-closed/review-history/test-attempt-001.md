# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/348-report-delivery-fail-closed/test-coverage.json`

## Blocking Findings

### 1. R2 delivery-failure modes are undercovered
**Target:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Issue:** R2 requires linked-Issue `gh` unavailability, failed comment operation, and any other required delivery failure to return non-success and prevent the report step from reaching done. The tests only exercise `gh` unavailability via `PATH`; there is no spec-local test for a reachable `gh` whose comment operation fails, nor an assertion that the flow/report step is not marked done.
**Required change:** Add a spec-local test that stubs `gh` as available but returns a failed comment operation, then asserts the command is non-success and the report/finalization step is not completed.
**Why blocking:** A required failure path and completion-state guarantee have no corresponding executable coverage.

### 2. R4 idempotent resume behavior is not actually exercised
**Target:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Issue:** The R4 test asserts only that `resumeDelivery` returns the same idempotency key and preserves report bytes. It does not verify at most one delivery attempt per resumed invocation, that only missing Issue delivery is attempted, or that duplicate Issue comments are not published.
**Required change:** Instrument/stub Issue delivery so the test can count comment attempts across resume calls and assert no duplicate publication while the existing report artifact is reused.
**Why blocking:** The test can pass even if resume publishes duplicate comments or retries more than once, so it does not exercise the core production behavior required by R4.

### 3. R5 binding hash coverage does not verify consumed artifacts
**Target:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Issue:** The R5 test checks hash shape and that some path ends with `issue-log.json`, but it does not verify `path` is project-relative, `sha256` equals the bytes actually consumed, all present optional artifacts are listed, or absent optional artifacts are omitted.
**Required change:** Create present optional artifacts with known contents, compute expected SHA-256 values from disk bytes, and assert exact project-relative sourceArtifacts membership and hashes, including omission of absent optional artifacts.
**Why blocking:** R5's central contract is correctness of the binding contents; the current assertions would pass with arbitrary hashes or incomplete artifact membership.

### 4. R6 freshness rejection cases are mostly missing
**Target:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Issue:** The R6 test only covers one malformed binding returning `REPORT_BINDING_INVALID`. It does not cover a missing binding, changed current HEAD OID, changed tree SHA, or changed recorded source-artifact SHA-256 returning `REPORT_BINDING_STALE`.
**Required change:** Add spec-local tests for missing binding invalidation and stale detection for changed HEAD, changed tree SHA, and changed source artifact SHA-256, asserting the required stable error codes.
**Why blocking:** Critical freshness validation paths have no regression coverage.

### 5. R7 preservation requirements are incomplete
**Target:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Issue:** The R7 test omits required preserved data key `upgrade`, omits required text sections `Tasks` and `Issue Log Summary`, and does not cover successful linked-Issue comment behavior when delivery completes.
**Required change:** Assert `report.data.upgrade`, the `Tasks` and `Issue Log Summary` text sections, and a successful linked-Issue delivery path that verifies the comment behavior remains successful.
**Why blocking:** The coverage artifact marks R7 covered, but multiple explicit R7 requirements have no corresponding assertions.


## Advisory Findings

No advisory findings.