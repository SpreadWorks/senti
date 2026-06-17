# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Symlinked .senti can move destructive cache repair outside the project
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/plugin-registry.js
**Issue:** assertManagedGitCachePath validates the final cache directory and the plugin-sources path, but it does not reject symlinked ancestors such as root/.senti. If .senti points outside the current project, syncGitUrlSource can run fs.rmSync, git clone, reset, clean, and reclone against an external plugin-sources directory while still passing the lexical under-plugin-sources checks.
**Suggestion:** In assertManagedGitCachePath, validate the real plugin-sources base against the real current root and reject symlinked managed-cache ancestors before any mkdir, rm, reset, clean, or reclone. Re-run the realpath confinement check after creating the plugin-sources directory when it did not already exist.
**Rationale:** R3 requires destructive managed-cache repair only when the resolved cache path is under the current root's .senti/plugin-sources directory. Allowing an ancestor symlink lets the repair path escape that managed area and can delete or overwrite unrelated files.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
