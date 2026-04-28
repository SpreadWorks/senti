# Spec 237 Tests — definition-driven gate ops

## What is tested

- **definition-gate-phase.test.js**: R1/R2 — FlowNode の gatePhase 属性と collectGatePhaseEntries() の戻り値
- **gate-step-derivation.test.js**: R3 — PHASE_TO_STEP_ENTRIES が definition から導出され、外部 API の戻り値が不変であること
- **gate-side-effects.test.js**: R4/R5 — executeGateSideEffects() が definition の sideEffects に基づいて副作用を実行すること

## Location

`specs/237-definition-driven-gate-ops/tests/`

## How to run

```bash
node --test specs/237-definition-driven-gate-ops/tests/*.test.js
```

## Expected results

All tests pass after implementation of T-1, T-2, T-3.
