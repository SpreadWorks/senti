# spec 198 — spec-local tests

## What

End-to-end scenario for spec 198 (test-first determinism core).
Verifies the integration of the new pieces introduced by the spec:

- `flow run tests` task-level test.summary aggregates into parent.
- Canonical task step sequence is `gate → approval → write-tests → impl → run-tests → review → update-overview`.

## Where

- `e2e-task-complete-run.test.js` (this directory, **not** under `tests/unit/`).
  Kept spec-local because this scenario is spec-specific — a future change
  that alters the scenario is not automatically a bug.

## How to run

Spec-local tests are not discovered by `npm test`. Run directly:

```
node --test specs/198-test-first-determinism-core/tests/e2e-task-complete-run.test.js
```

## Expected result

All tests pass once spec 198 implementation lands.
Initial (test-first) state: expected to FAIL because implementation is
not yet present.

## Related unit tests (permanent regression tests)

Recorded under `tests/unit/`:

- `tests/unit/flow/flow-run-tests.test.js` — REQ-P1-1..6 (tool CLI)
- `tests/unit/lib/config-schema-commands-test.test.js` — REQ-P1-3 (schema)
- `tests/unit/lib/flow-helpers-integration-skip.test.js` — REQ-P4-1,3
- `tests/unit/flow/get-context-write-tests-filter.test.js` — REQ-P2-1..4
- `tests/unit/flow/flow-run-draft-task.test.js` — REQ-P3-1..5
