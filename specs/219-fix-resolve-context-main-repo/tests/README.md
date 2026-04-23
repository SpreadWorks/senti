# Tests for spec 219 (fix-resolve-context-main-repo)

## What is tested
- Regression test for the bug where `sdd-forge flow get resolve-context` and
  `sdd-forge flow run resume` returned `data.mainRepoPath` pointing to the
  worktree itself when invoked from inside a `flow prepare --worktree`
  worktree. Both commands must return the primary repository path instead.

## Location
- Formal (run by `npm test`): `tests/unit/flow/resolve-context-worktree-main-repo.test.js`
- No spec-local tests; the invariant is general and must fail whenever it
  regresses, which matches the formal-test rule ("if a future change breaks
  this test, is that always a bug?" → YES).

## How to run
```sh
node --test tests/unit/flow/resolve-context-worktree-main-repo.test.js
# or via the full suite
npm test
```

## Expected results
- Pre-fix: both test cases fail with `mainRepoPath` equal to the worktree
  path.
- Post-fix: both test cases pass; `mainRepoPath !== worktreePath` and
  `mainRepoPath` equals the primary repository root returned by
  `getMainRepoPath()`.
