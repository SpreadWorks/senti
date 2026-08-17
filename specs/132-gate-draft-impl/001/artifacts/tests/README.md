# Tests for 132-gate-draft-impl

## What was tested

- R6: `FLOW_STEPS` and `PHASE_MAP` contain `gate-draft` and `gate-impl` in correct positions
- R1: `checkDraftText` function is exported from `run-gate.js`
- R2: `checkDraftText` validates draft structure (Q&A, approval, dev type, goal)
- R5: gate FAIL returns structured result instead of throwing

## Test locations

- **Formal tests** (`tests/unit/`):
  - `tests/unit/specs/commands/gate-draft.test.js` — `checkDraftText` unit tests
  - `tests/unit/specs/commands/gate.test.js` — existing spec gate tests (to be updated for R5)
- **Spec verification** (`specs/132-gate-draft-impl/tests/`):
  - `gate-draft-impl.test.js` — verifies step IDs and exports exist

## How to run

```bash
npm test                                          # all tests
node --test tests/unit/specs/commands/gate-draft.test.js  # draft gate tests only
node --test specs/132-gate-draft-impl/tests/      # spec verification tests
```

## Expected results

- All `checkDraftText` tests should fail initially (function not yet implemented)
- Spec verification tests for R6 should fail initially (step IDs not yet added)
- After implementation, all tests should pass
