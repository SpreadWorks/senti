# Spec 229: Test Documentation

## What was tested

- Regression: `npm test` passes after guardrail body text change.
- No new tests needed — the change is to static guardrail text in `src/presets/base/guardrail.json`, not executable logic.

## Test location

- Formal tests: none added (existing `npm test` suite covers guardrail loading).
- Spec-local tests: none (no spec-specific verification needed for a text change).

## How to run

```bash
npm test
```

## Expected results

All existing tests pass with no regressions.
