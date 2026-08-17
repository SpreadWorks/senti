# Feature Specification: 166-cache-hit-ratio-aggregation

**Feature Branch**: `feature/166-cache-hit-ratio-aggregation`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User request

## Goal
- Add a standalone `sdd-forge metrics token` subcommand that aggregates token/cache/cost metrics from `specs/*/flow.json` and outputs the same aggregated data in `text`, `json`, and `csv` formats.

## Scope
- Add top-level CLI entry for `sdd-forge metrics`.
- Implement `token` subcommand under `metrics`.
- Support `--format text|json|csv` (`text` default).
- Read metrics only from `specs/*/flow.json`.
- Add cache file `.sdd-forge/output/metrics.json` with freshness check based on `specs/*/flow.json` mtimes.
- Render text output as phase blocks with date rows and metric columns.

## Out of Scope
- `sdd-forge metrics efficiency` subcommand.
- Runtime reading from `.tmp/logs/**`.
- Warning output for data that exists only in `.tmp/logs/**`.

## Clarifications (Q&A)
- Q: Should #125 include CLI integration scope?
  - A: Yes. Include CLI integration in this spec.
- Q: Should the command be under `check`?
  - A: No. Implement as standalone top-level `sdd-forge metrics`.
- Q: Which runtime data source should be used?
  - A: `flow.json` only.
- Q: Should runtime warn when data exists only in `.tmp/logs`?
  - A: No warning.
- Q: Which formats are in scope now?
  - A: `text` (default), `json`, and `csv` in the same release.
- Q: How should cache refresh be decided?
  - A: Regenerate cache when any `specs/*/flow.json` is newer than `.sdd-forge/output/metrics.json`.
- Q: Should metrics command include efficiency view in this spec?
  - A: No. Only `token` view is implemented now.
- Q: What text layout is required?
  - A: Per-phase blocks, date rows, columns for difficulty, token input/output, cache read/create, call count, and cost.
- Q: Should difficulty be shown in token output?
  - A: Yes. Show `difficulty`, `N/A` when unavailable.

## Alternatives Considered
- Alternative: Implement under `sdd-forge check`.
  - Rejected because board memo 8690 requires `sdd-forge metrics` as an independent top-level command.
- Alternative: Runtime fallback to `.tmp/logs/**`.
  - Rejected to keep portable, git-tracked source of truth centered on `flow.json`.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-10
- Notes: Approved by user in plan phase.

## Requirements
Priority: P1 > P2

- P1-R1: When the user runs `sdd-forge metrics token`, the CLI shall execute as an independent top-level command and shall not require `check` subcommands.
- P1-R2: When aggregating runtime data, the command shall read only `specs/*/flow.json` and shall not read `.tmp/logs/**`.
- P1-R3: When `--format` is omitted, output shall default to `text`; when specified as `json` or `csv`, output shall represent the same aggregation values as text output.
- P1-R4: When rendering `text`, output shall be grouped by phase (`PHASE <name>`), rows shall be dates, and columns shall include difficulty, token input, token output, cache read, cache create, call count, and cost.
- P1-R5: When any required source field for a cell is missing in `flow.json`, the command shall render `N/A` for that value and continue successfully.
- P1-R6: When runtime failure occurs (e.g., unreadable `flow.json`, invalid JSON, cache write failure), the command shall print an error and exit with non-zero status.
- P1-R7: When loading source files, the command shall enforce bounded usage: process at most 5000 `specs/*/flow.json` files, and fail with non-zero status if this bound is exceeded.
- P2-R8: When `.sdd-forge/output/metrics.json` is missing or older than any `specs/*/flow.json`, the command shall regenerate cache; otherwise it shall reuse existing cache.

## Impact on Existing Features

- Adds new top-level command surface: `sdd-forge metrics`.
- Existing `sdd-forge check` behavior remains unchanged.
- No migration needed because existing command semantics are not changed.

## Why This Approach

- Aligns with board memo 8690 and #125 direction.
- Uses `flow.json` (git-tracked) as stable cross-environment source.
- Keeps this spec focused on token observability first, while leaving efficiency view for a follow-up spec.

## Test Strategy

- Unit tests:
  - Aggregation from multiple `flow.json` files into per-date/per-phase rows.
  - Missing field handling (`N/A`) for difficulty/token/cache/call/cost cells.
  - Format parity checks for `text`, `json`, and `csv`.
  - Cache freshness decision (reuse vs regenerate by mtime comparison).
  - Non-zero exit behavior on parse/read/write failures and bound overflow.
- E2E/CLI tests:
  - `sdd-forge metrics token` default format is `text`.
  - `--format json` and `--format csv` execute successfully and reflect same metric values.

## Acceptance Criteria
- AC1: `sdd-forge metrics token` runs successfully and supports `--format text|json|csv` (`text` default).
- AC2: For the same input set, `text`, `json`, and `csv` outputs contain equivalent per-date/per-phase metric values.
- AC3: Text output includes per-phase sections and table columns: difficulty, token in, token out, cache read, cache create, call count, cost.
- AC4: Missing fields in source data are rendered as `N/A` without process failure.
- AC5: Cache behavior matches freshness rules:
  - missing/stale cache regenerates
  - fresh cache is reused.
- AC6: Runtime failures return non-zero exit code.
- AC7: If matching `flow.json` count exceeds 5000, command fails with non-zero exit code.

## Open Questions
- None in this spec. `efficiency` is intentionally deferred to a follow-up specification.
