# Draft: 166-cache-hit-ratio-aggregation

**Development Type:** ENHANCE
**Goal:** Add an independent top-level `sdd-forge metrics token` subcommand that aggregates cache/token/cost metrics from `specs/*/flow.json` and outputs `text|csv|json` with file-based cache reuse.

## Context

- Issue #125 requests cache hit ratio aggregation and report output.
- Board memo `8690` expands scope to a standalone metrics command and clarifies persistence via `flow.json`.

## Q&A

1. Q: Should #125 include CLI integration scope?
   A: Yes. Include CLI integration in this scope.
2. Q: Should the command be under `check` or standalone?
   A: Standalone as top-level `sdd-forge metrics` command.
3. Q: What should be the runtime data source?
   A: Use `flow.json` only as the primary source.
4. Q: Should runtime warn when data exists only in `.tmp/logs`?
   A: No warning in runtime command output.
5. Q: Output format scope?
   A: `text` as primary UX, and `csv/json` included in the same release.
6. Q: Cache invalidation trigger?
   A: Regenerate `.sdd-forge/output/metrics.json` when any `specs/*/flow.json` is newer.
7. Q: Acceptance criteria strictness for formats/cache behavior?
   A: Require equivalent aggregation across `text|csv|json` and correct cache reuse/regeneration behavior.
8. Q: Should `metrics` have token/efficiency subcommands now?
   A: Implement only `sdd-forge metrics token` in this spec. `efficiency` is out of scope.
9. Q: What should the `token` text output layout be?
   A: Use per-phase blocks, date as vertical axis, and columns for difficulty, token in/out, cache read/create, call count, and cost.
10. Q: Should `difficulty` be shown in `token` output?
    A: Yes. Include `difficulty` column; render `N/A` when unavailable.

## Requirement Checklist Coverage

- Goal & Scope: command scope and placement fixed (`metrics token` only).
- Impact on existing: adds new top-level command surface, no `check` behavior change.
- Constraints: Node built-ins only, no external dependency additions.
- Edge cases: When any required metric field is missing in `flow.json`, the corresponding output column shall render `N/A` and command execution shall continue.
- Test strategy: verify format parity and cache invalidation logic.
- Alternatives considered: `check` subcommand model rejected.
- Future extensibility: keep aggregation core reusable for future metrics views.

## Prioritized Requirements

- P1: Add standalone `sdd-forge metrics token` command (not under `check`).
- P1: Aggregate only from `specs/*/flow.json`; no runtime `.tmp/logs` read.
- P1: Support `--format text|json|csv` with equivalent aggregation results.
- P1: Text output shall be per-phase blocks with date rows and columns: difficulty, token in/out, cache read/create, call count, cost.
- P1: When any metric field is absent, render `N/A` without failing.
- P2: Reuse `.sdd-forge/output/metrics.json` when fresh; regenerate when any `specs/*/flow.json` is newer.

## Open Questions

- None at draft stage.

## Approval

- [x] User approved this draft
- Notes: approved by user on 2026-04-10
