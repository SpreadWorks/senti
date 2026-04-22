# Tests for spec 210 — gate-impl no-op rerun guard

## What is tested and why
- REQ-1: `computeGitState(root)` produces a stable `{ headSha, worktreeHash }` identifier that changes when tracked content or untracked files change.
- REQ-2 / REQ-7 / REQ-8: `findPreviousFailState` walks the issue-log backwards and returns the most recent same-phase FAIL state, honoring the metrics-level PASS reset and skipping legacy entries that lack state identifiers.
- REQ-3 / REQ-4 / REQ-7: `assertNoProgressSinceLastFail` throws `NO_PROGRESS_SINCE_LAST_FAIL` with the prior FAIL reason when the current state matches, and does not throw when identifiers differ or are missing. Because the guard throws before the post-hook runs, the gateRetry counter is not mutated (REQ-4 is satisfied structurally by throwing before `updateGateRetryCounter`).
- REQ-5 / REQ-6: `src/flow/prompts/impl/gate-impl.md` is scanned statically for MUST items about fix evidence and about forbidding re-run on unchanged trees.

## Location
- `tests/unit/flow/gate-noop-rerun-guard.test.js` (formal test — run by `npm test`).
  Rationale: these assertions protect helpers that ship in `src/flow/lib/run-gate.js` and a prompt file in `src/flow/prompts/`. A regression in either should always indicate a bug regardless of spec, so the tests live under `tests/`.

## How to run
```
npm test -- tests/unit/flow/gate-noop-rerun-guard.test.js
```

## Expected results
All sub-tests pass. Initially they fail because `computeGitState`, `findPreviousFailState`, and `assertNoProgressSinceLastFail` are not yet exported and the MUST items are not yet in the prompt — that is the test-first baseline.
