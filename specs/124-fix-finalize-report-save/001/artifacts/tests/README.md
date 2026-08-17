# Tests for spec #124: Fix finalize report save

## What was tested
This spec modifies file I/O paths and git commands in finalize.js that depend on worktree state, which cannot be unit-tested without full git/worktree setup. Verification is done via spec-implementation alignment check and manual finalize execution.

## Verification method
- Spec-implementation alignment check after coding
- Manual verification: run `sdd-forge flow run finalize --mode all` in worktree mode and confirm:
  1. `specs/NNN/report.json` exists in main repo after finalize
  2. `git worktree remove` succeeds without `--force`
  3. Report text is displayed by SKILL.md

## Test location
No automated test files (alignment check only).

## Expected results
- AC1: report.json in main repo after worktree finalize
- AC2: cleanup succeeds without untracked files
- AC3: report text displayed on screen
- AC4: retro failure does not block report commit
