# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Confined sub-worktree can still return a mismatched source root
**Failure mode:** spec_behavior_contradiction
**File:** src/lib/plugin-registry.js
**Requirement:** R7
**Issue:** hasConfinedGitMetadata accepts a Git worktree whose rev-parse --show-toplevel is merely under the cache directory. A managed cache can have .git inside dest but core.worktree pointed at a subdirectory; fetch/reset/checkout then operate on that sub-worktree while syncGitUrlSource returns root: dest, so find/add/install can read stale or untracked plugin.json and package files outside the resolved commit tree.
**Suggestion:** In hasConfinedGitMetadata, require the realpath of git rev-parse --show-toplevel to exactly equal the realpath of dest. Treat any non-exact top-level as invalid and reclone before fetch, reset, clean, checkout, or returning { root: dest }.
**Rationale:** R7 requires metadata consumers to inspect files from a tree matching the resolved target commit. Allowing a nested worktree recreates the old-tree/new-commit mixed behavior even though the Git metadata is technically confined under the cache directory.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
