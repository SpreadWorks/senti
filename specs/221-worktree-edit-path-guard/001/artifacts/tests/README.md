# Tests for spec 221: worktree-edit-path-guard

## What is tested

Regression guard for the Worktree boundary partial (`src/templates/partials/worktree-mode.md`).

The test verifies that the MUST line added by this spec (prohibiting main-repo absolute paths in `Edit` / `Write` tool calls during an active worktree flow) and the existing three MUST lines continue to live in the partial — so a future editor cannot silently delete these lines.

## Test location

Formal test — located under the main test tree (runs with `npm test`):

- `tests/unit/templates/worktree-mode.test.js`

Rationale: a breakage of these assertions is always a bug (the MUST wording disappeared from the skill template), regardless of which spec touches the partial next. This matches the decision rule "YES → `tests/`".

## How to run

```bash
npm test                                          # full suite
node tests/run.js tests/unit/templates/worktree-mode.test.js  # just this file
```

## Expected results

- All assertions pass after spec 221 implementation is applied.
- If the partial is edited and any of `main repo`, `worktreePath`, `resolve-context`, `相対パス` (or `relative path`), `cd`, `git stash`, or `detached worktree` disappears, the corresponding assertion fails and `npm test` exits non-zero.
