# Feature Specification: 268-flow-observation-report

**Feature Branch**: `feature/268-flow-observation-report`
**Created**: 2026-05-29
**Status**: Draft
**Input**: GitHub Issue #344

## Goal
Add `sdd-forge metrics review` to aggregate flow artifacts across specs and report review finding trends, guardrail violations, repair effectiveness, and searchable finding history.

## Background
Flow runs already persist guardrail and process issues in `issue-log.json`, while review phases persist human-readable and JSON review artifacts. These artifacts are useful within a single spec, but there is no command that scans all specs to show recurring guardrail violations, recurring review finding categories, or whether repair attempts removed findings. Because some existing review artifacts are latest snapshots, historical repair analysis must distinguish recorded history from missing data.

## Scope
- [must] Add `sdd-forge metrics review` as the primary user-facing metrics command for this report.
- [must] Read `specs/*/issue-log.json` and `specs/*/flow.json` and aggregate guardrail violation counts, phase distribution, and specs that reached gate or review attempt limits.
- [must] Read review artifacts for impl, spec, test, draft-questions, and draft-coverage review phases and aggregate blocking / non-blocking findings by phase, category, and spec.
- [must] Support `--format text|json|csv` output for the report.
- [must] Preserve latest review artifacts at `review.md`, `impl-review.json`, `spec-review.md`, `spec-review.json`, `test-review.md`, `test-review.json`, `draft-review-questions.json`, and `draft-review-coverage.json`; add separate attempt-level history artifacts under `review-history/<phase>-attempt-<NNN>.<ext>` for each new review attempt.
- [must] Record repair actions with the corresponding normalized finding id when a repair step addresses a review finding.
- [must] Display missing historical data as `unknown` or `not recorded`; do not reconstruct prior attempts from overwritten latest artifacts.
- [should] Report finding disappearance rate, same-category reappearance rate, and specs that exited at an attempt limit.
- [should] Support keyword plus category matching for searching past review findings.
- [should] Display repair diff / finding correspondence only when both a normalized finding id and a repair commit or changed file reference are recorded; otherwise display `unknown`.

## Out of Scope
- Automatic guardrail generation from frequent findings.
- AI-generated guardrail or prompt improvement proposals.
- Automatic application of low-risk improvements.
- External search engines, vector databases, or new npm dependencies.
- Project-specific logic tied to this repository's spec names or local directory layout beyond the generic `specs/*` flow artifact contract.

## Constraints
- Use only Node.js built-in modules; do not add npm dependencies.
- Keep `src/` generic for package distribution; do not hardcode repository-specific spec names, issue numbers, or local paths.
- Represent meaningful report values with classes that enforce invariants and own formatting or serialization behavior.
- Do not add backward-compatibility readers for older, overwritten review history. Existing specs without history must report `unknown` or `not recorded` for attempt-level metrics.
- Do not change `sdd-forge metrics token` output or behavior.

## Design Principles
- Prefer a small metrics command surface with explicit missing-data reporting over inferred historical data.
- Keep latest review artifacts human-readable and stable while adding machine-readable attempt history beside them.
- Separate data collection, aggregation, and output formatting so each layer can be tested independently.

## Overview
### Modules
- src/metrics.js and src/lib/command-registry.js — register and dispatch metrics subcommands.
- src/metrics/commands/token.js — existing text/json/csv metrics command pattern to follow without changing token behavior.
- src/flow/commands/review.js — writes review.md plus impl-review.json / spec-review.json latest artifacts and owns review artifact persistence.
- src/flow/commands/report.js — reads issue-log.json for finalized flow reporting and provides an existing issue-log summary pattern.

### Data Flow
- Review execution writes latest artifacts plus `review-history/<phase>-attempt-<NNN>.<ext>` history artifacts under the current spec directory.
- Repair or triage execution records finding ids and repair references in issue-log entries when a finding is addressed.
- `metrics review` scans `specs/*`, loads issue-log, flow.json retry metrics, and review artifacts, normalizes entries into domain objects, aggregates metrics, then formats text/json/csv.
- `metrics review --search <text>` filters normalized findings by keyword and category fields before formatting results.

### Decisions
- [VERIFY] Command name uses `metrics review` as the report's main subject.
- [VERIFY] Initial report scope includes guardrail violations, review finding aggregation, repair metrics, and keyword search; diff correspondence is supplemental.
- [VERIFY] Missing prior attempt history is reported as unknown rather than reconstructed.
- [VERIFY] Search is keyword plus category matching in the first version.
- [VERIFY] Required repair metrics are disappearance rate, same-category reappearance rate, and attempt-limit spec list.
- [CORRECTION] Attempt history covers impl, spec, test, draft-questions, and draft-coverage phases.
- [CORRECTION] Attempt-limit detection reads both issue-log and flow.json retry state.

## Clarifications (Q&A)
- Q: What command name is primary?
  - A: `sdd-forge metrics review`.
- Q: How are specs without historical review attempts handled?
  - A: They remain in the report, but attempt-level metrics that need missing history show `unknown` or `not recorded`.
- Q: Which review phases are included in attempt-level history?
  - A: Impl, spec, test, draft-questions, and draft-coverage review phases are included. The history filename pattern is `review-history/<phase>-attempt-<NNN>.<ext>`.
- Q: Is automatic guardrail generation included?
  - A: No. This spec only provides observation data for human judgment.

## Alternatives Considered
- `sdd-forge metrics guardrail` as the primary command — Rejected because the report covers review findings, repair effectiveness, and search in addition to guardrail violations.
- Reconstruct overwritten review history from latest artifacts and issue-log text — Rejected because the reconstructed attempt sequence would be unverifiable and would make repair metrics unreliable.
- Include fuzzy semantic search in the first version — Rejected because the project forbids external dependencies and keyword/category matching is easier to explain and test.
- Make repair diff correspondence mandatory for every repair metric — Rejected because commit history and changed-file references are not guaranteed for existing specs; absence is represented as `unknown` instead.
- Persist attempt history only for impl and spec review — Rejected because the report aggregates by review phase and would otherwise omit test and draft review retry/repair behavior.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-29T00:43:13.725Z
- Notes:

## Requirements
- R1 [must]: `sdd-forge metrics review` is registered in the metrics command registry and appears in `sdd-forge metrics --help`. It accepts `--format text|json|csv` with `text` as the default and `--search <text>` as an optional filter. `--search` values are trimmed strings from 1 to 256 characters; missing, empty, or longer values are rejected. The command exits 0 when argument validation passes, artifact scanning completes, and output is written, including runs with no specs or missing optional artifacts. It exits non-zero for unsupported formats, invalid search values, unreadable required paths, or JSON read/parse failures that prevent scanning.
- R2 [must]: The report scans `specs/*/issue-log.json` and `specs/*/flow.json` files. It aggregates guardrail violation counts by guardrail id, phase distribution by step or phase, and specs whose issue-log or flow retry metrics show gate/review attempt-limit exit or retry exhaustion.
- R3 [must]: The report scans latest and attempt-level review artifacts for impl, spec, test, draft-questions, and draft-coverage phases. It normalizes blocking findings and non-blocking improvements, then aggregates counts by review phase, normalized category, and spec.
- R4 [must]: Each new review attempt writes attempt-level history artifacts without removing latest artifacts. Latest artifacts remain at `review.md`, `impl-review.json`, `spec-review.md`, `spec-review.json`, `test-review.md`, `test-review.json`, `draft-review-questions.json`, and `draft-review-coverage.json`. History artifacts use `review-history/<phase>-attempt-<NNN>.<ext>` where `<phase>` is `impl`, `spec`, `test`, `draft-questions`, or `draft-coverage`, and `<NNN>` is a zero-padded per-phase attempt number.
- R5 [must]: Repair-related issue-log entries can reference a normalized review finding id and a repair reference. The repair reference is either a commit hash or a changed file path list. Entries without both sides remain valid but are reported as `unknown` for diff correspondence.
- R6 [must]: Repair effectiveness output includes finding disappearance rate between adjacent recorded attempts, same-category reappearance rate between adjacent recorded attempts, and a list of specs that exited at an attempt limit. Metrics that require missing history are displayed as `unknown` or `not recorded`.
- R7 [should]: `metrics review --search <text>` filters review findings by case-insensitive keyword matches in title/body/category fields and by exact category matches when category data exists. Search uses only local artifacts and Node.js built-in modules.
- R8 [must]: Every new attempt-level finding record includes a stable normalized id, phase, source artifact basename, attempt number, severity (`blocking` or `non-blocking`), title/body text, and category. Category source is `failureMode` for impl findings, `classification` for draft findings, existing category-like fields for test/spec findings when present, and `unknown` when no source category exists.
- R9 [must]: Text output includes named sections for guardrail violations, review finding trends, repair effectiveness, missing-data summary, and search results when `--search` is provided. Count tables are sorted by descending count, rate rows show numerator, denominator, percentage, and status, and unknown values use the literal `unknown` or `not recorded`.
- R10 [must]: JSON output includes structured arrays and summary objects for specs, guardrails, findings, repair metrics, missing-data counts, and optional search results. Unknown values are represented as JSON null plus an explanatory status field.
- R11 [must]: CSV output includes stable columns for section, spec, phase, category, count, rate, status, and detail. Unknown values use the literal `unknown` in the status column and leave numeric columns empty.
- R12 [must]: The implementation uses dedicated classes for loaded specs, findings, repair outcomes, aggregate rows, and formatters instead of untyped discriminated object literals for report domain values.
- R13 [must]: Automated tests cover metrics review command dispatch, artifact loading, unknown missing-history behavior, repair metrics, search filtering, text/json/csv formatting, and preservation of metrics token behavior.

## Acceptance Criteria
- `sdd-forge metrics --help` lists `review` without changing the existing `token` command.
- `sdd-forge metrics review --format text` prints guardrail, review finding, repair effectiveness, missing-data, and search sections when fixture data contains those records.
- `sdd-forge metrics review --format json` returns valid JSON with explicit `unknown` / `not recorded` status for missing attempt history.
- `sdd-forge metrics review --format csv` returns stable headers and rows that distinguish numeric values from unknown status.
- A new review attempt preserves the latest review artifact names and also writes `review-history/<phase>-attempt-<NNN>.<ext>` history artifacts for each included review phase.
- New attempt-level finding records include normalized finding ids and category values, using `unknown` when a phase has no source category.
- Repair metrics compute disappearance and same-category reappearance only from adjacent recorded attempts and do not infer overwritten history.
- Attempt-limit reporting includes retry exhaustion detected from both issue-log entries and flow.json retry state.
- `sdd-forge metrics review --search <text>` returns only findings matching the keyword or category rules.
- Project tests for the new command and affected review artifact persistence pass, and existing metrics token tests continue to pass.

## Implementation Targets
- src/lib/command-registry.js
- src/metrics.js
- src/metrics/commands/review.js
- src/flow/commands/review.js
- src/flow/lib/set-issue-log.js
- tests/unit/metrics
- tests/unit/flow

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add metrics review command
  - Register `sdd-forge metrics review` and implement option parsing for `--format` and `--search`.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Persist review attempt history
  - Extend review artifact writing so each new review attempt preserves the latest artifact names and also writes deterministic attempt-level history artifacts.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Record repair finding references
  - Allow repair issue-log entries to store the finding id and repair reference needed for repair correspondence reporting.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Load review metrics artifacts
  - Build the artifact scanner and domain classes that load specs, issue-log entries, review findings, repair references, and missing-data states.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Aggregate review metrics
  - Compute guardrail trend, review finding trend, repair effectiveness, and search result datasets from loaded artifacts.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Format review metrics output
  - Render the metrics review report in text, JSON, and CSV formats with stable missing-data representation.
  - see `tasks/T-6.md` for full spec
