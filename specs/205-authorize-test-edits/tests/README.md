# spec 205 tests

## Files

- `end-to-end.test.js` — exercises the integration of
  `parseAuthorizedTestModifications` and `checkTestChanges` against the
  acceptance criteria (AC-1, AC-2, AC-3, AC-5, AC-6).

## Scope

Spec-local verification tests. These assert the wiring of parser + bypass
check end to end, as expected by spec 205.

Long-term public contracts related to this spec live under the formal
test suite:

- `tests/unit/flow/gate-test-change-check.test.js` — contract tests for
  `checkTestChanges`, extended with the spec 205 bypass scenarios
  (R6.1 〜 R6.3).
- `tests/unit/flow/parse-authorized-test-modifications.test.js` — parser
  contract tests (R6.4).

## How to run

```bash
# Full formal suite
node tests/run.js

# Spec-local end-to-end
node --test specs/205-authorize-test-edits/tests/end-to-end.test.js
```

## Expected behavior before implementation

Tests in this directory and the new parser/bypass cases added to the
formal suite **fail** until:

- `checkTestChanges` accepts an optional third argument (authorized file
  list) and excludes matching test hunks from FAIL.
- `parseAuthorizedTestModifications(specText)` is exported from
  `src/flow/lib/run-gate.js` and parses the documented flat-bullet
  syntax.
- `findUnusedAuthorizations(diff, authorizedFiles)` is exported and
  returns warnings for entries not present in the diff.
