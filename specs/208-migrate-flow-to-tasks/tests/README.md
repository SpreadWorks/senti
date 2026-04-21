# Spec 208 tests

Verification tests for `migrate-flow-to-tasks.js` (one-time migration script).

## What is tested
- `migrateFlowJson`: adds `tasks`/`currentTaskId`, converts `notes: string[]` and `metrics` dict, preserves T10 shape, hoists per-task metrics/notes (R1, R3, R4, R5, R6, R7).
- `parseSpecMd`: extracts H2 sections (goal, scope, requirements, clarifications, alternatives) into structured form (R8).
- `migrateSpecMd`: fills missing required fields with empty defaults, emits warnings, produces spec.json that validates against `src/flow/schemas/spec.schema.json` (R2, R9, R10).

## Location rationale
These tests live under `specs/208-migrate-flow-to-tasks/tests/` (not `tests/`) because the migration script is a one-shot tool. A future change to these tests is not automatically a bug — it depends on the script's historical state. Kept as history, not maintained long-term.

## How to run
```bash
node --test specs/208-migrate-flow-to-tasks/tests/migrate-flow-to-tasks.test.js
```

## Expected result
All test cases pass. Coverage of unit-level behavior. Smoke verification (dry-run against the full `specs/` tree) is done separately after implementation.
