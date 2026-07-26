# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/345-required-hook-failure-policy/test-coverage.json`

## Blocking Findings

### 1. R8 matrix coverage is incomplete
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Issue:** The tests cover required failures for throw, ok:false, malformed result, and artifact write failure, but advisory behavior is only exercised for a thrown error. Success cases and advisory ok:false, malformed result, and artifact/context write failure are not covered, despite R8 requiring the required/advisory matrix for all listed outcomes.
**Required change:** Add executable cases that exercise both required and advisory policies for success, throw, ok:false, malformed result, and artifact/context write failure.
**Why blocking:** R8 is an explicit acceptance requirement and has no corresponding complete spec-local coverage.

### 2. R1 missing-policy rejection is not tested
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Issue:** R1 requires discovered hooks and persisted snapshot entries to reject a missing failure policy, but the test only checks a valid discovered policy, an unknown discovered policy, and an invalid snapshot policy. There is no missing-policy rejection case for registration or snapshot loading.
**Required change:** Add tests that omit failurePolicy from a discovered hook and from a snapshot entry and assert rejection before hook execution.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for the missing-policy branch.

### 3. R5 integrity hard-failure cases are largely uncovered
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Issue:** R5 lists import failure, invalid register(api), invalid FlowCommandHook inheritance, missing snapshot module, and snapshot metadata mismatch as hard failures. The current test only checks invalid snapshot policy, which is not one of those listed integrity cases.
**Required change:** Add executable tests for each R5 integrity failure category, or at minimum representative cases that directly prove these integrity failures remain hard failures regardless of policy.
**Why blocking:** Critical integrity behavior required by R5 has no regression coverage.

### 4. R6 command atomicity is tested by source-text regex only
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Issue:** The R6 test reads plugin-registry.js and matches a broad regex around required and main(). This can pass without exercising prepare or finalize-cleanup, and it does not verify that spec source, draft, flow state, issue-log, plugin artifact files, teardown transaction, finalize commit, worktree, feature branch, last-finalized-spec, or active flow state remain unchanged.
**Required change:** Replace or supplement the regex with executable command-level tests for prepare and finalize-cleanup that induce a required pre-hook failure and assert the listed durable side effects do not occur.
**Why blocking:** This is a static anti-pattern that can pass without exercising production behavior, and R6 requires command-level atomicity coverage.

### 5. R7 structured outcome usage is only checked by absence of one warning-scan string
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Issue:** The R7 test only asserts that one exact PLUGIN_HOOK_FAILED find() expression is absent from run-finalize-cleanup.js. It does not execute run-prepare-spec or run-finalize-cleanup, does not prove they consume the structured runner outcome, and can pass if warning scanning is rewritten in another form.
**Required change:** Add executable tests that drive required lifecycle failure through run-prepare-spec and run-finalize-cleanup and assert they consume the structured failure outcome and stop before teardown/main work.
**Why blocking:** R7 requires caller behavior, but the test encodes a brittle implementation premise and can pass without exercising production behavior.

### 6. R4 data and follow-up preservation is incomplete
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Issue:** R4 requires advisory business failures to preserve warning, issue-log, and follow-up information while continuing, and successful advisory or required hooks to preserve hook data and follow-ups. The current advisory test checks warning and issue-log entries for a thrown error only, and does not check follow-ups or successful hook data/follow-up preservation for either policy.
**Required change:** Add tests for advisory failure follow-up preservation and successful required/advisory hook data plus follow-up preservation.
**Why blocking:** Required preservation behavior in R4 lacks direct regression coverage.


## Advisory Findings

No advisory findings.