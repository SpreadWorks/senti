# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-expose-semantic-deferral-exhausted-plan-gates/test-coverage.json`

## Blocking Findings

### 1. R6 recovery command contract is not fully asserted
**Target:** specs/318-expose-semantic-deferral-exhausted-plan-gates/tests/plan-gate-semantic-deferral.test.js:354
**Issue:** R6 requires the exhausted retry recovery command to remain `senti flow set retry reset gate <phase> --reason <text> --yes`, but the test only matches a substring containing `flow set retry reset gate ${phase}`, checks that `--reason` appears, and checks that the command ends with `--yes`. This would pass if the command omitted the `senti` executable, inserted extra flags, changed argument ordering materially, or used the wrong reason text.
**Required change:** Assert the full expected recoveryCommand string for task-impl and integration, including `senti`, the phase, the exact reason text, and `--yes`.
**Why blocking:** An explicit acceptance requirement for R6 has no corresponding precise executable coverage, despite the coverage artifact marking R6 covered.

### 2. R6 guard mismatch coverage only checks run ID
**Target:** specs/318-expose-semantic-deferral-exhausted-plan-gates/tests/plan-gate-semantic-deferral.test.js:385
**Issue:** R6 requires target mismatch rejection with `ACTIVE_FLOW_MISMATCH` before retry recovery writes, but the set-retry continuation test exercises only a mismatched run ID. It does not cover mismatched Issue or spec guards for this command path.
**Required change:** Add R6 set-retry mismatch cases for `--expect-issue` and `--expect-spec`, asserting `ACTIVE_FLOW_MISMATCH` and no retry-recovery writes or retry metric changes.
**Why blocking:** The run-gate mismatch coverage in R4 does not exercise the R6 `senti flow set retry reset gate` command path, so part of R6's guard contract is uncovered.


## Advisory Findings

No advisory findings.