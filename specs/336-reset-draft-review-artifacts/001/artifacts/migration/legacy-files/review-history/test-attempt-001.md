# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/336-reset-draft-review-artifacts/test-coverage.json`

## Blocking Findings

### 1. R6 does not prove FAIL/ADVISORY artifact creation
**Target:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js:32
**Issue:** The harness seeds triage and repair artifacts with stale items before the first ADVISORY/REJECTED review. The later assertions read those seeded files, so the test can pass even if FAIL/ADVISORY artifact creation never writes canonical artifacts.
**Required change:** Have the first ADVISORY/REJECTED lifecycle review create the stale triage/repair artifacts from supplied findings, then assert those created artifacts exist before rewind instead of pre-seeding the same canonical artifacts.
**Why blocking:** R6 explicitly requires focused tests to exercise FAIL or ADVISORY artifact creation; the current static design can pass without exercising that production behavior.

### 2. R6 rewind coverage is only a test-local simulation
**Target:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js:72
**Issue:** The rewind behavior is implemented as a helper method inside the test harness that directly mutates step statuses and issue-log history. This does not exercise the actual rewind/reset path that must retain history before the later PASS.
**Required change:** Drive the rewind/reset through the spec-local lifecycle command or hook used by production, and assert the retained audit/history after that real path runs.
**Why blocking:** R6 requires the rewind step reset with retained history to be exercised through the lifecycle path, but the current test can pass if production rewind behavior is missing or wrong.

### 3. R5 unchanged guards and retry accounting are marked covered without executable checks
**Target:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js:205
**Issue:** The R5 test checks artifact preservation, audit bytes, and schema key order, but it does not cover retry accounting, verdict routing, route metadata, artifact path invariants, or Issue #443 transition guards despite the coverage artifact marking R5 fully covered.
**Required change:** Add focused assertions or reference existing spec-local tests for the unchanged retry accounting, verdict routing, route metadata/artifact paths, and Issue #443 transition guard behavior affected by this change.
**Why blocking:** The requirement-to-test coverage artifact claims R5 is covered, but concrete acceptance clauses have no corresponding spec-local executable coverage.


## Advisory Findings

No advisory findings.