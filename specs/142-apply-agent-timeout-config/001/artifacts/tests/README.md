# Tests for spec 142: apply-agent-timeout-config

## What was tested

- `resolveAgent` returns `timeoutMs` from `config.agent.timeout` (seconds to ms conversion)
- `resolveAgent` returns `DEFAULT_AGENT_TIMEOUT_MS` (300000) when `agent.timeout` is not configured

## Test location

- `tests/unit/lib/agent.test.js` — formal tests (public API contract)

## How to run

```bash
node tests/run.js --scope unit -- tests/unit/lib/agent.test.js
```

## Expected results

Both new tests should PASS after implementation of spec requirements.
