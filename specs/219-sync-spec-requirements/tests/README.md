# Tests for spec 219 — sync-spec-requirements

All tests are added to the formal `tests/unit/flow/` tree because they verify
public API / CLI behavior: breakage indicates a regression regardless of which
spec introduces future changes.

## Test files (all in `tests/unit/flow/`)

| File | Requirements covered | What it checks |
|---|---|---|
| `requirements-single-source.test.js` | R1, R4, R6, R7 | retro / impl-confirm / resume / resolve-context do not touch `state.requirements`; `flow get status` uses spec.json; missing `status` treated as `pending`. |
| `set-req-spec-writeback.test.js` | R3 | `flow set req <i> <status>` writes to `spec.json.requirements[i].status` and keeps `flow.json.requirements` unchanged. |
| `set-summary-deprecated.test.js` | R5 | `flow set summary ...` returns non-zero with a `DEPRECATED` error envelope and does not mutate spec.json. |
| `run-retro-no-missing-requirements.test.js` | R2 | dry-run retro succeeds when `spec.json.requirements` is populated even if `flow.json.requirements` is empty; missing-requirements error no longer mentions `flow.json`. |
| `approval-prompt-no-transfer.test.js` | R8 | `src/flow/prompts/plan/approval.md` no longer contains `flow set summary`. |

## Running

```bash
npm test -- --test-name-pattern="spec 219"
# or run the whole suite
npm test
```

## Expected results

- All five test files must PASS after the spec 219 implementation.
- Running the tests against the current (pre-implementation) codebase makes
  them FAIL, confirming they exercise the behavior the spec introduces.
