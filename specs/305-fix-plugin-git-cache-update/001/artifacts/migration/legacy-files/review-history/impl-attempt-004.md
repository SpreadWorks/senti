# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Git metadata can redirect destructive repair outside the cache
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/plugin-registry.js
**Issue:** assertManagedGitCachePath verifies that the cache directory path itself is under .senti/plugin-sources, but syncGitUrlSource then trusts any existing dest/.git entry. A cache directory can contain a .git file pointing at an external gitdir whose core.worktree is outside the managed cache; subsequent fetch/reset/clean/checkout calls with cwd=dest will operate on that external worktree even though dest is not a symlink.
**Suggestion:** In assertManagedGitCachePath or before cleanGitUrlSourceTree/fetchGitUrlSource, reject .git files or symlinked .git entries, or verify git rev-parse --show-toplevel and the gitdir realpath are confined to the resolved managed cache before running destructive git commands. Reclone the cache only after removing a confirmed safe dest path.
**Rationale:** R3 requires reset/clean/delete/reclone self-heal operations to be confined to the current root's .senti/plugin-sources area. Trusting redirected Git metadata allows a config/cache-controlled entry to run destructive repair against an arbitrary external worktree, which is a data integrity bug.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
