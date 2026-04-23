# Tests for spec 220: auto-check phase-aware input

## What is tested and why
This spec introduces phase-aware input selection for `flow run auto-check`, a
spec-approved skip path, and the removal of the "auto-select single preparing
flow" heuristic. The tests verify each acceptance criterion.

## Test locations (`tests/`, formal)
Tests live in `tests/` (run by `npm test`) because they assert public CLI
contracts. Future regressions in any of these are always bugs.

- `tests/unit/flow/run-auto-check-phase.test.js`
  - A1: spec-approved skip path returns `{eligible:true, skipped:true, reason:"spec approved"}` without invoking the agent.
  - A2: `gate-draft` done → draft body appears in AI prompt.
  - A2 (complement): `gate-draft` not done → draft body excluded.
  - A3: preparing mode + multiple preparing flows + no `--run-id` → `MISSING_RUN_ID`.
  - A4: preparing mode + one preparing flow + no `--run-id` → also `MISSING_RUN_ID` (no auto-select).
  - A6: `--input` rejected as unknown option.

- `tests/unit/flow/resolve-auto-check-input.test.js` (pure function)
  - `isSpecApproved` detection variants.
  - Phase 1 (issue + request), Phase 2 (+ draft body), Phase 3 (skip).
  - Edge cases: missing draft file, preparing mode (specPath null), gate-draft
    + approval precedence.

- `tests/unit/flow/resolve-preparing-run-id.test.js`
  - A7: removal of single auto-select. 1 preparing + no `--run-id` → fail.
  - zero preparing / explicit runId / nonexistent runId paths.

- `tests/e2e/220-auto-check-phase-flow.test.js`
  - A8: preparing phase end-to-end `set init → run auto-check → set auto on`.
  - Approval-phase short-circuit (no agent call).

## How to run
```
node tests/run.js --grep "spec 220"
# or
node tests/run.js
```

## Expected results
All tests must pass after the implementation phase. They are expected to fail
prior to implementation (TDD).
