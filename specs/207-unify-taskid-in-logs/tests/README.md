# Spec 207 verification tests

Spec: [../spec.md](../spec.md) — Unify taskId field across append-only logs.

## What is tested

- **R1.1 / R1.2** — `state.metrics` / `state.notes` are append-only entry arrays. Per-task branching (`task.metrics` / `task.notes`) is gone.
- **R1.3** — flow-scope entries carry `taskId=null`.
- **R1.4** — `issue-log.json` entries carry a `taskId` field.
- **R1.5** — Logger JSONL entries (agent end, git, event) carry a `taskId` field resolved via the injected FlowManager.
- **R2.1 – R2.4** — CLI `--task-id` inference, override, and error-on-unknown-id.
- **R3.1 / R3.2** — `flow get status` returns raw arrays plus a `metricsSummary: { flow, tasks, total }` aggregate view.
- **R4.1** — legacy flow.json schemas (nested `metrics` map or per-task `task.metrics` / `task.notes`) are rejected on load.
- **Integration** — task lifecycle: flow → task → completeTask → flow, with metricsSummary partitioning preserved.

## Where

- Location: `specs/207-unify-taskid-in-logs/tests/` (spec verification tests — not run by `npm test`).
- Files:
  - `flat-taskid.test.js` — R1, R2, R3, R4 unit-level coverage.
  - `logger-taskid.test.js` — R1.5 Logger coverage.
  - `integration-task-lifecycle.test.js` — end-to-end task lifecycle.

## How to run

```bash
node --test specs/207-unify-taskid-in-logs/tests/
```

Formal tests that also reflect the new structure (e.g. `tests/unit/flow/set-metric.test.js`, `tests/unit/lib/flow-manager-tasks.test.js`, `tests/unit/lib/log.test.js`) were updated as part of this spec and run via `npm test`.

## Expected results

All tests should pass once implementation is complete. They initially fail because:

- `state.metrics` is still stored as a nested counter map.
- `state.notes` and `task.notes` are plain string arrays.
- `metricsSummary` is not yet emitted by `flow get status`.
- Logger entries do not yet include `taskId`.
- `--task-id` CLI option is not yet accepted by `set metric` / `set note` / `set issue-log`.
- Legacy-schema rejection for metrics / notes is not yet enforced.
