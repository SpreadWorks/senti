# Spec 152 Tests

## What is tested

### Formal tests (`tests/unit/lib/log.test.js`)
- **Logger singleton**: getInstance, init, log, uninitialized warning
- **Log finalize hook**: base class no-op, AgentLog sets endAt/time
- **AgentLog constructor**: auto-sets executeStartAt, accepts prompt

### Spec verification tests (`specs/152-add-logger-to-callsites/tests/`)
- **callsite-coverage.test.js**: Static analysis that all 19 call sites import AgentLog and use Logger.getInstance()

## Where tests are located
- `tests/unit/lib/log.test.js` — formal tests (run by `npm test`)
- `specs/152-add-logger-to-callsites/tests/` — spec verification (not run by `npm test`)

## How to run

```bash
# Formal tests
npm test -- --scope unit

# Spec verification
node --test specs/152-add-logger-to-callsites/tests/callsite-coverage.test.js
```

## Expected results
- All formal tests should pass after R1-R3 implementation
- Callsite coverage tests should pass after R5-R6 implementation
