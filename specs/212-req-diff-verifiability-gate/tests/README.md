# Tests for spec 212 (req-diff-verifiability-gate)

## What is tested
Verifies that the new `req-diff-verifiability` guardrail is registered in
`src/presets/base/guardrail.json` with the correct phase / category / schema, and
that the phase filter includes it only for `spec` phase (not `draft` or
`task-impl`). Also checks that existing base guardrails are preserved (regression
sentinel for R4).

## Location
- `tests/unit/presets/base/req-diff-verifiability-guardrail.test.js`
  (formal tests under `tests/`, run by `npm test` — breakage always indicates
  a bug in the base guardrail registry, independent of spec 212.)

## How to run
```
node --test tests/unit/presets/base/req-diff-verifiability-guardrail.test.js
```
or full suite:
```
npm test
```

## Expected results
- Initially (before implementation): all assertions about the new guardrail FAIL.
- After implementation (guardrail entry added): all tests PASS, including phase
  filter inclusion/exclusion and regression checks on existing ids.

## Mapping to spec requirements
- R1 → `is included in spec phase filter`, `declares phase=['spec'] only`
- R2 → `is excluded from draft phase filter`, `is excluded from task-impl phase filter`
- R3 → `has non-empty title and body strings`, `declares category='process'`
- R4 → `base guardrail regression (R4)` suite (spot-checks pre-existing ids)
