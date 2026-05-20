# Test Review Results

## Verdict: ADVISORY

Coverage artifact: `specs/262-final-regression-evidence/test-coverage.json`

## Blocking Findings

No blocking findings.

## Advisory Findings

### 1. R7 raw-log format encodes an unstated nextAction value
**Target:** specs/262-final-regression-evidence/tests/final-regression-evidence.test.js — R7 test
**Improvement:** The assertion `assert.match(raw, /^nextAction: user-confirmation$/m)` pins the flow-transition string for `unattributed_existing_failure` to `user-confirmation`, but no requirement (R1–R9) names that exact value. Consider asserting via the FAILURE_NEXT_ACTION mapping or by checking that `nextAction` is a non-empty string distinct from `stop`, leaving the canonical token to a single source of truth.
**Why non-blocking:** The test still validates the separate-entries contract demanded by R7; only the specific token is over-specified, which can be tightened later without changing executable behavior.

### 2. R8 raw-log retention regex is overly permissive
**Target:** specs/262-final-regression-evidence/tests/final-regression-evidence.test.js — R8 test
**Improvement:** `/final-regression-attempt-\*\.log|final-regression-attempt-/` collapses to a substring match on `final-regression-attempt-`, so any mention (even a code identifier) satisfies it. Tighten to require the durable path form, e.g. `tests/\.raw/final-regression-attempt-\*\.log`, to actually exercise the R8 guidance.
**Why non-blocking:** It still rejects an implementation that drops the attempt-log naming entirely, so coverage of R8 is present though weak.

### 3. R5 only inspects the first issue-log entry
**Target:** specs/262-final-regression-evidence/tests/final-regression-evidence.test.js — R5 test
**Improvement:** R5 says "each final-regression failure issue-log entry must set `rawOutputPath`". The test only checks `issueLog.entries[0]`. After multiple failure invocations are added (R4 already runs twice), iterate over all final-regression failure entries and assert each has a matching `rawOutputPath`.
**Why non-blocking:** The single-entry case is still meaningful and the requirement is exercised; extending to N entries is a strengthening, not a correctness fix.

### 4. R6 implicitly assumes `flowState.worktreePath` is the resolved active root
**Target:** specs/262-final-regression-evidence/tests/final-regression-evidence.test.js — R6 test
**Improvement:** R6 says "resolved active worktree root differs from the resolved `ctx.root`" without prescribing the resolution source. The test fabricates the mismatch purely via `flowState.worktreePath`. If the production resolver also consults `git worktree list`, ensure the fixture reflects both inputs (e.g., a real detached worktree or a documented helper) so the test is robust to either resolution strategy.
**Why non-blocking:** The minimal premise still detects the headline failure of running project tests under a root mismatch; hardening the resolution surface is an improvement.
