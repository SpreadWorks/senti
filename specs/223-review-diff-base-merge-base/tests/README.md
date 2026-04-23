# Spec 223 tests

## What and why

This spec changes `flow run review` so that its diff base is the common
ancestor between the current branch HEAD and `flow.baseBranch`, not the
tip of `baseBranch`. The tests verify:

1. **REQ-P1 / REQ-P3** — When `baseBranch` has advanced beyond the
   common ancestor, the touched-files set computed from the merge-base
   SHA excludes upstream-only changes. The old behaviour (baseBranch
   tip) is also exercised as a sanity check to confirm the bug scenario
   we are eliminating.
2. **REQ-P2** — When no common ancestor exists (orphan branch) or the
   base ref cannot be resolved, `resolveMergeBase` throws an error
   whose message names `merge-base`.
3. **REQ-P4** — Regression test for the baseBranch-advanced scenario is
   included in the formal suite so it runs under `npm test`.

## Location

All tests live in the formal project-wide suite because each one is a
public-API contract check of `src/flow/commands/review.js` — breaking
any of them would always be a bug regardless of spec provenance.

- `tests/unit/flow/commands/review.test.js`:
  - `describe("collectTouchedFiles (spec 201 R-P4)")` — existing tests
    updated to pass the merge-base SHA (second-arg semantics change).
  - `describe("collectTouchedFiles with merge-base starting point (spec 223)")` — new.
  - `describe("resolveMergeBase (spec 223)")` — new.

## How to run

```bash
npm test -- tests/unit/flow/commands/review.test.js
# or, full suite:
npm test
```

## Expected results

- Before implementing `src/flow/commands/review.js` changes: the new
  tests fail at import time (`resolveMergeBase` is not exported).
- After implementing: all tests pass.
