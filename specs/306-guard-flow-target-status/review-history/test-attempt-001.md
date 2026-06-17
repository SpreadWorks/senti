# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/306-guard-flow-target-status/test-coverage.json`

## Blocking Findings

### 1. Behavioral flow mismatch is only tested by source-string presence
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js: R1
**Issue:** The test only searches source files for `--expect-issue`, `ACTIVE_FLOW_MISMATCH`, and field names. It does not execute `senti flow get status [runId] --expect-issue <n>`, verify the mismatch integration point, or prove that next-action, flow run, and finalize-cleanup are skipped.
**Required change:** Add a spec-local executable test that drives the status command or the dispatcher path with mismatched Issue/runId state and asserts the ACTIVE_FLOW_MISMATCH result plus absence of downstream actions.
**Why blocking:** R1 is a behavioral guard requirement, and the current test would pass if the strings were present but unused or wired incorrectly.

### 2. autoApprove target-run behavior is not covered by production behavior
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js: R2
**Issue:** The test reads only `src/skills/partials/core-principle.md`, so it does not verify that autoApprove status checks after runId resolution read the target runId status instead of another active context, nor that preparing state uses set-auto envelope and prepare inheritance.
**Required change:** Add an executable test around the flow entry/status-check path with two active contexts and a preparing case, asserting the selected runId is used and preparing does not trust status autoApprove.
**Why blocking:** R2 describes runtime selection and state behavior; documentation string checks can pass while production code still consults the wrong active context.

### 3. Machine-readable mismatch envelope is not actually validated
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js: R4
**Issue:** The test only searches `get-status.js` for field-name strings. It does not invoke the mismatch path or inspect the returned error object/JSON for machine-readable `expectedIssue`, `activeIssue`, `expectedRunId`, and `activeRunId`.
**Required change:** Add a test that triggers the mismatch and asserts the structured error payload contains the required fields when available.
**Why blocking:** R4 requires machine-readable output; source-string matching would pass for comments, dead code, or non-output variables.

### 4. Migration parity is asserted through weak source and doc string checks
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js: R5
**Issue:** The test does not exercise bare status current-context display, runId target lookup, normal requires_approval/autoApprove approval behavior, or finalize recovery exception behavior. It only searches for implementation and documentation tokens.
**Required change:** Add executable parity tests for bare `senti flow get status`, `senti flow get status <runId>`, normal approval behavior, and finalize recovery exceptions, or split them into focused tests that invoke the relevant production APIs/CLI.
**Why blocking:** R5 is explicitly a migration parity requirement; token checks can pass while user-visible behavior regresses.

### 5. Upgrade verification only checks generated output, not that upgrade was run or source-to-generated parity is validated
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js: R6
**Issue:** The test reads `.agents/skills/senti.flow/SKILL.md` for expected text, but it cannot detect whether `senti upgrade` was run after changing `src/skills/`, nor whether generated skill diffs were verified against source changes.
**Required change:** Add a spec-local check that compares the relevant source partial guidance with the generated skill content, or otherwise verifies the generated skill is synchronized with the changed source guidance.
**Why blocking:** R6 requires migration/update parity for generated skills; checking a few generated strings can pass with stale or manually edited generated content.


## Advisory Findings

### 1. Broaden unsafe guidance removal assertion
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js: R3
**Improvement:** Also assert that broader variants such as `no extra options` and an exact bare `senti flow get status` mandate are absent, not only the single full sentence currently matched.
**Why non-blocking:** R3 has direct static coverage for the source guidance and replacement runId-aware guidance; this would make the wording guard more robust without blocking implementation.
