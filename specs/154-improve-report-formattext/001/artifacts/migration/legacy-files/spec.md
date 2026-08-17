# Feature Specification: 154-improve-report-formattext

**Feature Branch**: `feature/154-improve-report-formattext`
**Created**: 2026-04-07
**Status**: Draft
**Input**: Issue #107

## Goal

Improve the text output of `formatText()` in `src/flow/commands/report.js` by removing a section that is always meaningless at report generation time, clarifying ambiguous metric labels, reducing clutter in the Issue Log, and ensuring the Tests section is always present.

## Scope

- `formatText()` function in `src/flow/commands/report.js`
- No changes to `generateReport()`, `aggregateMetrics()`, `saveReport()`, or the `data` object structure

## Out of Scope

- Changes to `report.json` structure
- Changes to `generateReport()` data logic
- Changes to callers of `generateReport()` (finalize, issue comment)

## Clarifications (Q&A)

- Q: Does removing the Documents section affect `report.json`?
  - A: No. `data.sync` remains in the data object; only the text rendering is removed.
- Q: Should Issue Log still be hidden when there are no entries?
  - A: Yes. The `if (data.issueLog.count > 0)` guard is retained.

## Alternatives Considered

- **Documents section**: Show "n/a" instead of removing — Rejected. Always-skipped content adds noise with no benefit.
- **Issue Log**: Add `--verbose` flag for full resolution display — Rejected. `report.json` already provides full data; text output is for quick human review.

## Why This Approach

Each change is a minimal, targeted edit to `formatText()` with no structural impact. The text output is the human-facing summary; `report.json` remains the authoritative data source. Removing/simplifying output that is always absent or too verbose improves signal-to-noise without any data loss.

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-07 (autoApprove)
- Notes: auto mode — all 4 improvements to formatText() confirmed.

## Requirements

1. **(P1) Remove Documents section**: `formatText()` shall not output the `Documents` section header or any `data.sync`-derived content.
2. **(P2) Clarify Metrics labels**: The metrics line shall use `docs read`, `src read`, `Q&A`, `issue-log` labels instead of `docs`, `src`, `Q&A`, `issues`.
3. **(P3) Issue Log summary display**: When issue log entries exist, each entry shall display only `[step] reason` on a single line. The `-> resolution` suffix shall be omitted.
4. **(P4) Always show Tests section**: The `Tests` section shall be rendered even when `data.tests` is `null`, showing `-` as the content.

## Acceptance Criteria

- AC1: Text output does not contain the string `Documents`.
- AC2: Metrics line contains `docs read`, `src read`, and `issue-log` (not `docs`, `src`, or `issues` as standalone labels).
- AC3: Issue log entries appear as `[step] reason` with no `->` suffix.
- AC4: Text output always contains the string `Tests`, even when no test data exists.
- AC5: Existing `generateReport()` behavior (data structure, other text sections) is unchanged.

## Test Strategy

Unit tests via `generateReport()` in `specs/154-improve-report-formattext/tests/verify.test.js`. These are spec-verification tests (not in `tests/`) since they verify this spec's requirements specifically. Future changes to report format would intentionally break them, not unconditionally indicate a bug.

Test cases map 1:1 to AC1–AC4, plus AC5 (regression).

## Open Questions

- (none)
