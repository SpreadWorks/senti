# Spec 228 Tests

## What was tested
- gateRetry counter invariants: issue-log recording and pre-rejection checks do not increment gateRetry
- Counter breakdown display: warnGateRetryBudget includes AI-FAIL count in stderr
- Exhaustion message: checkRetryBelowMax includes counter breakdown in Envelope messages
- Budget-not-consumed hints: pre-rejection checks output a hint in stderr

## Where tests are located
- `tests/unit/flow/gate-retry-counter-transparency.test.js` (formal test, run by `npm test`)

## How to run
```bash
npm test -- --grep "gate-retry-counter-transparency"
```

## Expected results
- All tests fail initially (before implementation)
- After implementation, all tests pass with no regression in existing tests
