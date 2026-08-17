# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-canonical-regression-snapshots/test-coverage.json`

## Blocking Findings

### 1. Source grep does not test RunTestExecuteCommand artifact behavior
**Target:** specs/316-canonical-regression-snapshots/tests/regression-artifact-gate.test.js
**Issue:** The R2 test proves save-path migration by reading run-test-execute.js and counting textual RegressionFileSnapshotList.fromChangedFiles occurrences. This can pass with dead code or comments and does not execute the required or skipped RunTestExecuteCommand artifact builders.
**Required change:** Replace the source-text assertions with an executable test of the required and skipped test-execute save paths, asserting changed_files and trigger_relevant_changed_files are canonical fingerprinted snapshot JSON.
**Why blocking:** R2 requires production artifact behavior, but the current test can pass without exercising that behavior.

### 2. Bounded hashing test is source-text only
**Target:** specs/316-canonical-regression-snapshots/tests/regression-file-snapshot.test.js
**Issue:** The R1 bounded-buffer hashing test reads regression-file-snapshot.js and matches openSync/createReadStream/readSync text while rejecting readFileSync text. This can pass without the hashing path using bounded reads and can fail valid implementations that delegate to another bounded helper.
**Required change:** Use an executable hashing test with a real file and a behavior-level guard or spy that fails whole-file reads, then assert the resulting SHA-256 fingerprint.
**Why blocking:** R1 requires fingerprint computation behavior; the current test is a static anti-pattern that can pass without exercising production hashing.

### 3. R1 path normalization and malformed-entry rejection are not covered
**Target:** specs/316-canonical-regression-snapshots/tests/regression-file-snapshot.test.js
**Issue:** The R1 tests use already-normal POSIX paths and only cover missing fingerprint, duplicate path, and over-limit rejection. They do not verify POSIX path normalization or rejection of malformed status/path/old_path/fingerprint inputs.
**Required change:** Add spec-local cases for normalized path/old_path output and malformed entries such as invalid status, empty or non-string path, unsafe path, invalid old_path usage, and invalid fingerprint.
**Why blocking:** The coverage artifact marks R1 covered, but required normalization and malformed-entry rejection behavior can be omitted while these tests still pass.

### 4. Legacy no-fingerprint rerun reason is not asserted
**Target:** specs/316-canonical-regression-snapshots/tests/regression-artifact-gate.test.js
**Issue:** The R2 legacy rejection assertion uses /fingerprint|rerun test-execute/i, so a generic missing-field error mentioning fingerprint passes without the required rerun-test-execute reason.
**Required change:** Tighten the assertion to require the rerun-test-execute reason or code, not just the word fingerprint.
**Why blocking:** R2 explicitly requires legacy no-fingerprint items to be rejected with a rerun-test-execute reason.

### 5. R4 preservation coverage is mostly absent
**Target:** specs/316-canonical-regression-snapshots/tests/regression-artifact-gate.test.js
**Issue:** The artifact marks R4 covered, but the tests only cover small classifyRegression and planTestExecuteRegression targeted/skipped cases plus a source-text assertion. They do not cover test-execute and integration-gate command behavior, flow hooks, test.command, test.testExecuteRegression config, full planning, process execution, raw log, summary, review, file-map, or step-transition preservation.
**Required change:** Add behavior-level spec-local coverage for the preserved command and flow surfaces, or narrow the coverage artifact so R4 is not claimed covered by these tests.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, and the coverage artifact contradicts the actual tests.


## Advisory Findings

No advisory findings.