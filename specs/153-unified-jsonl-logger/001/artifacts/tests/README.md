# Tests for spec 153-unified-jsonl-logger

## What is tested

3-layer test strategy as defined in `spec.md` § テスト方針:

1. **Logger 単体テスト** — `tests/unit/lib/log.test.js` (formal, run by `npm test`)
   Verifies the Logger public API: `init()`, `agent({phase: "start"|"end"})`, `git()`, `event()`, disabled no-op, prompt-file separation, `spec`/`sddPhase` auto-resolution, `requestId` linkage.

2. **callAgent\* regression tests** — `tests/unit/lib/agent-with-logger.test.js` (formal, run by `npm test`)
   Verifies that the existing helpers `callAgentWithLog` / `callAgentAwaitLog` / `callAgentAsyncWithLog` are rewritten to use `Logger.agent()` internally while preserving their external return values. Also asserts that the `logCtx` argument has been removed (R5).

3. **e2e test** — `specs/153-unified-jsonl-logger/tests/e2e-flow-gate-logger.test.js` (spec verification, NOT in `npm test`)
   Spawns a Node driver script in a temp project directory with a fake `echo` agent, calls `callAgentAwaitLog` twice, and asserts:
   - `.tmp/logs/sdd-forge-YYYY-MM-DD.jsonl` is created
   - `.tmp/logs/prompts/YYYY-MM-DD/<requestId>.json` files exist
   - end-event count == prompt-file count, each `promptFile` path is real
   - end events carry `entryCommand`, `callerFile`, `callerLine`
   - With `cfg.logs.enabled = false`, no log files are created at all

## Why placement matters

| Test file | Location | Reason |
|---|---|---|
| `log.test.js` | `tests/unit/lib/` | Public API contract — breakage is always a bug regardless of which spec touched it |
| `agent-with-logger.test.js` | `tests/unit/lib/` | Helper API contract — same rationale |
| `e2e-flow-gate-logger.test.js` | `specs/153-unified-jsonl-logger/tests/` | Spec verification — heavy, scenario-specific, not maintained long-term beyond this spec |

## How to run

Formal tests (units 1 + 2):
```bash
npm test
# or scope to the changed files:
node --test tests/unit/lib/log.test.js tests/unit/lib/agent-with-logger.test.js
```

E2E (unit 3):
```bash
node --test specs/153-unified-jsonl-logger/tests/e2e-flow-gate-logger.test.js
```

## Expected results

After implementation:
- All units 1 + 2 should pass with `npm test`
- Unit 3 should pass when run manually
- The legacy contents of `tests/unit/lib/log.test.js` (which targeted the deleted `Log`/`AgentLog`/`writeLogEntry` API) have been replaced in-place with the new Logger tests. The file path is preserved so that `git log -- tests/unit/lib/log.test.js` continues to surface the history of the logging tests.

## Pre-implementation state

These tests are written first and are expected to FAIL until the Logger redesign in `src/lib/log.js` and `src/lib/agent.js` is complete.
