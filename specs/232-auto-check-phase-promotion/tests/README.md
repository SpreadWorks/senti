# Spec 232: auto-check-phase-promotion Tests

## What was tested

Spec 232 introduces autoDesired flag persistence, failed verdict non-persistence, and autoUpgrade signal in next-action envelope.

### Formal tests (`tests/unit/flow/`)

These are interface contract tests that should break if future changes introduce regressions:

| Test file | Covers |
|---|---|
| `auto-desired-persistence.test.js` | T-1: autoDesired flag persistence in set-auto (R1, AC1/AC2/AC8) |
| `failed-verdict-non-persistence.test.js` | T-2: failed verdict not saved to flow.json (R5, AC6) |
| `auto-upgrade-next-action.test.js` | T-4: autoUpgrade signal in next-action envelope (R3, AC5) |

### Not covered in pre-implementation tests

| Task | Reason |
|---|---|
| T-3 (re-eval hook in set-step) | Requires AI agent stub + async post-hook wiring. Written during impl phase. |
| T-5 (autoDesired inheritance in prepare) | Requires prepare command integration. Written during impl phase. |
| T-6 (skill template) | Template-only change, no code test. Verified by `sdd-forge upgrade`. |

## How to run

```bash
npm test -- --test-name-pattern "spec 232"
```

## Expected results

Before implementation: all tests FAIL (expected — tests are written before code).
After implementation: all tests PASS.
