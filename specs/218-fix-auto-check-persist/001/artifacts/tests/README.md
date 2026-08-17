# Tests for spec 218: fix auto-check persist/trust

## What was tested

Spec 218 resolves the split-brain between `flow run auto-check` (rich issue-body input) and `flow set auto on` (thin state-rebuilt input). The fix persists the verdict once and has `set auto on` trust it. These tests cover both the new persistence path and the new trust path plus fallback.

- **Persistence (run auto-check)** — `tests/unit/flow/run-auto-check.test.js`
  - verdict is written to `.active-flow.<runId>` when no active flow exists (auto-resolve single preparing flow)
  - verdict is written to the `--run-id`-targeted preparing flow when multiple preparing flows exist
- **Trust (set auto on)** — `tests/unit/flow/set-auto.test.js`
  - preparing flow with `autoCheck.eligible:true` → AI not invoked, `autoApprove` set to true
  - preparing flow with `autoCheck.eligible:false` → AI not invoked, non-zero exit with `AUTO_CHECK_INELIGIBLE`
  - active flow with `autoCheck.eligible:true` → AI not invoked (symmetric behavior)
  - preparing flow without `autoCheck` → fallback, AI invoked once (existing behavior preserved)

## Where tests live

- **`tests/unit/flow/run-auto-check.test.js`** — persistence test cases were appended to the existing formal suite.
- **`tests/unit/flow/set-auto.test.js`** — trust/fallback cases were appended to the existing formal suite.

Placement decision: both suites verify public CLI contracts (`flow run auto-check` and `flow set auto on`). Future regressions in either contract are always bugs regardless of which spec introduced them, so these tests belong in `tests/` (run by `npm test`) rather than under `specs/218-.../tests/`.

## How to run

```bash
node --test tests/unit/flow/set-auto.test.js tests/unit/flow/run-auto-check.test.js
```

Or the full unit suite:

```bash
npm test
```

## Expected results

All new test cases pass. The relevant assertion pattern is that a capturing stub agent's capture file either does not exist (trust path — agent never invoked) or exists (fallback path — agent invoked once).
