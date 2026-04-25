# Spec 228: stabilize-plan-phase-gate — Tests

## What was tested

- **plan-phase-gate-guards.test.js**: REQ-1〜REQ-4, REQ-7 — retry counter, no-progress guard, repeated-fail detection for plan phase (draft/spec), passedGuardrails recording, and gate-impl/integration backward compatibility
- **flip-detection.test.js**: REQ-4〜REQ-5 — buildPassedGuardrails, findPreviousPassedGuardrails, applyFlipOverride (PASS→FAIL flip detection and override)

## Location

`specs/228-stabilize-plan-phase-gate/tests/` (spec verification tests, not run by `npm test`)

## How to run

```bash
node --test specs/228-stabilize-plan-phase-gate/tests/
```

## Expected results

All tests should pass after implementation of T-1 and T-2.
