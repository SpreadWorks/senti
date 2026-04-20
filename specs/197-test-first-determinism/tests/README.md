# 197-test-first-determinism — Tests

Test-first tests for spec 197 (cac6/T4). These were written before implementation and should fail on initial run.

## What is tested

1. **`tests/unit/lib/flow-helpers-task-steps-v2.test.js`** — Constants and helpers
   - `TASK_STEPS_PLAN` / `TASK_STEPS_ADDITION` contain `write-tests`, `impl`, `run-tests` in order
   - Legacy single `test` step is removed
   - `TASK_PHASE_MAP` maps `write-tests` / `impl` / `run-tests` to `"task-impl"`
   - `buildInitialTaskSteps` produces step arrays with the new ids for each origin
   - `derivePhase(state)` returns `"task-impl"` when the current task's `write-tests` or `run-tests` step is in_progress
   - `FLOW_STEPS` contains `integration-write-tests`, `integration-run-tests`, `integration-run-all-tests`, `integration-evaluate` before `review`
   - `PHASE_MAP` assigns all integration steps to the `impl` phase

2. **`tests/unit/lib/test-summary-aggregate.test.js`** — task→parent summary aggregation
   - `completeTask(taskId)` adds the task's `test.summary` counts (unit / integration / acceptance) into parent `state.test.summary`
   - Sum across multiple completed tasks is correct
   - Null task summary is a no-op; parent state is not corrupted
   - `setTestSummary` without a current task writes directly to the parent scope (existing T2 contract, re-asserted here)

## Location

Placed in `tests/unit/lib/` (formal tests — public API contract). Spec-local tests are not created because these tests define contracts that must continue to hold for future changes, not one-off spec verifications.

## How to run

```bash
node tests/run.js --scope unit --filter "task-steps-v2|test-summary-aggregate"
```

Redirect to a log file when checking results:

```bash
node tests/run.js --scope unit > .tmp/logs/test-output.log 2>&1
```

Then inspect failures via `grep "not ok"`.

## Expected results

**Initial (pre-impl)**: all 22 new subtests fail. Other existing tests remain PASS (no regression from fixture / schema changes in this test-writing step).

**Post-impl**: all tests PASS. Failures here indicate a broken implementation of the requirements in `specs/197-test-first-determinism/spec.md` (REQ-1, REQ-2, REQ-4, REQ-5, REQ-6).

## Requirements to implementation coverage

- REQ-1 (task step 列 3 段階) — covered by `flow-helpers-task-steps-v2.test.js`
- REQ-4 (task→親 summary 合算) — covered by `test-summary-aggregate.test.js`
- REQ-5 (integration 段階は親スコープ直接) — covered by `setTestSummary without current task writes to parent scope`
- REQ-6 (integration 段階 FLOW_STEPS) — covered by `FLOW_STEPS integration phase`

REQ-2 (CLI 駆動テスト実行), REQ-3 (context フィルタ), REQ-7 (addition auto-draft), REQ-8/9 (全体 PASS) are covered in additional tests added during the implementation phase once the corresponding modules exist.
