# Spec 229: Plan Gate Eval Stabilize — Tests

## What was tested
- `buildGuardrailPrompt` with pass history parameter (REQ-1, REQ-2, REQ-3)
- `findPreviousPassedGuardrails` issue-log retrieval
- `buildPassedGuardrails` evaluation extraction

## Test location
- `tests/unit/flow/gate-pass-history-prompt.test.js` — formal tests (run by `npm test`)

## How to run
```bash
node --test tests/unit/flow/gate-pass-history-prompt.test.js
```

## Expected results
- All tests pass after implementation of T-1 (prompt builder) and T-2 (wiring)
- Before implementation: test 1 ("includes Previously Passed Guardrails section") fails; all others pass
