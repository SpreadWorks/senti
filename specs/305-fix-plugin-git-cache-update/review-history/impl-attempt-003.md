# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Symlinked cache path can be reset outside plugin-sources
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/plugin-registry.js
**Issue:** assertManagedGitCachePath only compares path.resolve(dest) with path.resolve(pluginSourcesDir(root)). If .senti/plugin-sources/<source.id> is a symlink to another Git worktree, fs.existsSync(path.join(dest, ".git")) and all later git commands follow that symlink, so fetch/reset/clean/checkout can operate on a directory outside the managed cache even though the textual path is under plugin-sources.
**Suggestion:** In syncGitUrlSource/assertManagedGitCachePath, reject or remove a symlink cache entry before running any git command, and verify existing cache directories with lstat/realpath confinement against the real pluginSourcesDir(root). Only run fetch/reset/clean/checkout after the actual directory is confirmed to be inside the managed cache; otherwise reclone into a normal directory at dest.
**Rationale:** R3 requires destructive reset/clean/delete/reclone to be confined to the current root's .senti/plugin-sources area. Following a symlink lets a config-controlled cache entry perform destructive git operations on an arbitrary external worktree, which is a data integrity bug.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
