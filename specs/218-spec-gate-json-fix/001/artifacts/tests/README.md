# Tests for spec 218 (spec-gate-json-fix)

## Scope

This spec fixes the parent spec gate (`flow run gate --phase spec`) so that it inspects the primary `spec.json` rather than treating the path as legacy markdown.

## Test Locations

All test changes for this spec live in the **formal test path**, not under `specs/<spec>/tests/`:

- `tests/unit/specs/commands/gate.test.js` — extended in place

Rationale: gate behavior is a public API contract (CLI command output and unit-level checker functions). A future regression in this behavior would always indicate a bug, not just a violation of this spec. Per the placement rule ("If a future change breaks this test, is that always a bug?" → YES → `tests/`), the tests belong in the formal path.

## What Was Tested

### `checkSpecText` (existing function, retained for `phase=task-spec`)
- All existing markdown structural checks (missing sections, unresolved markers, unchecked tasks, table-row exemption, etc.)
- The `strict` parameter and its tests were removed (R6) — production code never set `strict=true` and `spec.json` schema has no equivalent of the User Confirmation approval marker.

### `checkSpecJson` (new function, used for `phase=spec`)
- Returns `[]` for a schema-valid `spec.json`.
- Returns issues when a schema-required field is missing (R2).
- Detects unresolved markers (`NEEDS CLARIFICATION` / `TBD` / `TODO` / `FIXME`, case-insensitive, word-boundary-aware) in human-authored string fields throughout the JSON tree, returning the field path (R3).
- Walks nested arrays of objects (e.g., `requirements[].desc`, `clarifications[].q`/`.a`, `overview.modules[].text`).

### Gate CLI integration
- `phase=task-spec` continues to inspect markdown (regression guard).
- `phase=spec` reads `spec.json` and produces the expected textCheck issues array (R1, R5).
- `phase=spec --spec specs/<id>/spec.md` resolves to the same `spec.json` and yields the same result (R5).
- Failure cases produce `data.result === "fail"` with non-empty issues (R7).

## How to Run

```bash
node --test tests/unit/specs/commands/gate.test.js
# or as part of the full unit suite:
npm test
```

## Expected Results

All tests in `gate.test.js` pass once the production change in `src/flow/lib/run-gate.js` is in place:

- `executeSpec` is split into `executeSpec` (parent → spec.json) and `executeTaskSpec` (task draft → markdown).
- `checkSpecJson(spec)` is exported and performs schema validation + recursive marker scan.
- `checkSpecText` no longer accepts a `strict` parameter.
