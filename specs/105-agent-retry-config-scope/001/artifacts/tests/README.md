# Tests for spec 105: agent retry config scope

## What was tested

- `callAgentAsync` retry behavior when `options.retryCount` / `options.retryDelayMs` are provided
- Empty response retry
- Non-zero exit code retry
- No retry when `retryCount` is 0 (backward compatibility)
- No retry on signal kill / timeout
- Error propagation after all retries exhausted

## Where tests are located

- `tests/unit/lib/agent.test.js` — "callAgentAsync retry" describe block

## How to run

```bash
node --test tests/unit/lib/agent.test.js
```

## Expected results

- All tests in "callAgentAsync retry" block should pass after implementation.
- Existing `callAgent`, `callAgentAsync`, and `resolveAgent` tests should continue to pass.
