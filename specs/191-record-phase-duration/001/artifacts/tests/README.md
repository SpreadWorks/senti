# Tests for spec 191-record-phase-duration

## What was tested

Verification of Requirements R1–R4 for recording per-phase AI agent duration.

- **R1 / R2** (persistence layer): `durationMs` parameter is accumulated into `metrics.<phase>.durationMs` and skipped when phase is null.
- **R1** (agent layer): `Agent.call()` measures spawn start-to-exit time and passes a non-negative integer `durationMs` to `accumulateAgentMetrics`. Retry attempts are included in the total.
- **R3** (flow report): per-phase duration is shown in seconds with one decimal (`12.3s`) in `generateReport` text output; `durationMs` is aggregated in `data.tokenMetrics.durationMs`.
- **R4** (metrics token): `formatText` and `formatCsv` include a duration column; `buildRowsFromMetrics` extracts `durationMs` per phase-date row.

## Test locations

All tests are placed in `tests/` (formal tests, run by `npm test`) because
they verify public contracts (metrics schema, command output) that must
remain stable regardless of which spec introduced them.

- `tests/unit/lib/flow-state-agent-metrics.test.js` — 4 new cases appended.
- `tests/unit/lib/agent-with-logger.test.js` — 2 new cases appended.
- `tests/unit/flow/commands/report-metrics.test.js` — 3 new cases appended.
- `tests/unit/metrics/token-duration.test.js` — new file (4 cases).

## How to run

```
npm test -- --scope unit
```

Or run the specific files:

```
node tests/run.js --scope unit
```

## Expected results

All cases pass after implementation of spec 191. Before implementation,
the new cases fail (durationMs is neither propagated nor displayed).
