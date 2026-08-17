# Spec 166 Test Plan

## What was tested and why

- `sdd-forge metrics token` CLI contract as a formal test target.
- Format behavior for `text` (default), `json`, and `csv`.
- Output shape requirements needed by this spec (phase section, required columns).

These tests are formal regression targets because this command surface is expected to remain stable beyond this spec.

## Test locations

- Formal tests:
  - `tests/e2e/metrics/token.test.js`
- Spec-local tests:
  - none

## How to run

- Full e2e suite:
  - `npm run test:e2e`
- Single file (node test runner):
  - `node --test tests/e2e/metrics/token.test.js`

## Expected result

- Before implementation: this new test file fails (command not implemented yet).
- After implementation: all tests in `tests/e2e/metrics/token.test.js` pass.
