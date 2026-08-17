# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Untracked directory evidence has no content identity
**Target:** R1/R3, AC2/AC6
**Issue:** Existing regression changed-file input includes untracked paths: listRegressionChangedFiles() delegates to listChangedFilesDetailed(), whose default git status mode includes status="untracked" entries and can return an untracked directory path. The spec covers modified/add/delete/rename and says missing or non-regular paths get fingerprint null, but it does not define how untracked entries, especially untracked directories, are canonicalized or tested.
**Required change:** Add explicit snapshot behavior and acceptance coverage for status="untracked", including untracked directories: either enumerate untracked files before snapshot creation or define deterministic directory expansion/hashing within the 2000-entry bound, so content edits under an untracked directory change the canonical snapshot.
**Why blocking:** If implemented as written, an untracked directory can be saved with fingerprint null and later compare equal after a one-byte edit inside that directory, allowing integration gate to trust stale evidence. If an implementer instead treats untracked as malformed, test-execute breaks on a data path the existing git helper already produces.


## Non-blocking Improvements

No non-blocking improvements.