# Tests — 211-finalize-auto-recovery

Formal tests for this spec's behavior live under `tests/unit/` (run by `npm test`) because the behavior is a first-class contract of the finalize pipeline: breakage at any point is always a bug, regardless of which spec introduced it.

## Files

| Path | Covers |
|---|---|
| `tests/unit/lib/git-sync-helpers.test.js` | New helpers in `src/lib/git-helpers.js`: `fetchBranch`, `rebaseOnto`, `abortRebase`, `countCommitsBetween`, `listUncommittedFiles` |
| `tests/unit/flow/run-finalize-early-stop.test.js` | Preflight additions for R2 (no-commits early stop) and R4 (dirty-worktree early stop), plus R6 spec-only skip |
| `tests/unit/flow/commands/merge-pre-sync.test.js` | Pre-sync rebase behavior in `src/flow/commands/merge.js`: R1 (success), R3 (conflict abort), R6 (PR / spec-only exclusions) |

## How to run

```
npm test -- --grep "git-sync-helpers"
npm test -- --grep "run-finalize-early-stop"
npm test -- --grep "merge-pre-sync"
```

Or run all: `npm test`.

## Expected results

Before implementation, all new tests should FAIL (helpers / exports do not yet exist). After implementation, all should PASS.
