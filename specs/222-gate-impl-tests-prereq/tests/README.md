# Tests for spec 222: gate-impl-tests-prereq

## What was tested

- `checkMissingHeadTestEvidence` — a new helper exported from `src/flow/lib/run-gate.js` that returns a failure `Envelope` when the gate is running on `task-impl` or `integration` phase with no head test evidence recorded in flow state (`state.test.summary`).
- Prompt file contents in `src/flow/prompts/` for the documentation requirements (REQ-4, REQ-5, REQ-6).

## Location

Tests are placed in the formal test suite (`tests/unit/flow/`), because the helper
and prompt contents are public contracts whose breakage always indicates a bug
(not specific to this spec):

- `tests/unit/flow/gate-head-test-evidence-guard.test.js`

## How to run

```bash
npm test -- tests/unit/flow/gate-head-test-evidence-guard.test.js
# or run the full suite:
npm test
```

## Expected results

All tests PASS after the implementation adds:

1. `checkMissingHeadTestEvidence` exported from `src/flow/lib/run-gate.js`
2. Call-site in `executeDiffBasedGate` that returns its envelope when non-null (before the AI invocation path)
3. Prompt text updates in `impl/implement.md`, `impl/gate-impl.md`, `plan/test.md`

Initial run (before implementation) — tests should FAIL (TDD baseline).
