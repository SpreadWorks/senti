# Spec 154 Tests

## What was tested and why

Spec verification tests for `formatText()` improvements in `src/flow/commands/report.js`.
Tests verify the 4 acceptance criteria from spec 154:

- **AC1**: Documents section removed from text output
- **AC2**: Metrics labels use `docs read`, `src read`, `issue-log`
- **AC3**: Issue Log entries show only `reason` (no `-> resolution`)
- **AC4**: Tests section always rendered (with `-` placeholder when no data)
- **AC5**: Other sections (Implementation, Retro, Metrics) remain present

## Location

`specs/154-improve-report-formattext/tests/verify.test.js`

These are spec-scoped tests (not in `tests/`). Future format changes to `formatText()` would intentionally change the expected behavior, so they are not maintained as long-term formal tests.

## How to run

From the worktree root:

```bash
node --test specs/154-improve-report-formattext/tests/verify.test.js
```

## Expected results

**Before implementation**: 13 tests fail, 7 pass (AC1–AC4 affected tests fail).

**After implementation**: All 20 tests pass.
