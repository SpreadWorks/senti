# Spec 230: auto-check gate threshold tests

## What was tested

- `hardGateFailed()` staged logic: sum of 3 hard-gate keys ≤ 1 → fail, ≥ 2 → pass
- `THRESHOLD` boundary: score 16 → eligible, score 15 → not eligible
- `composeAutoCheck()` reason message reflects staged hard-gate logic
- Interaction: single zero key with sufficient total score passes both gates

## Location

`specs/230-auto-check-gate-threshold/tests/gate-threshold.test.js`

## How to run

```bash
node --test specs/230-auto-check-gate-threshold/tests/gate-threshold.test.js
```

## Expected results

All tests pass after implementation of R1-R3.
