# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Existing cache can keep using an old Git remote
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/plugin-registry.js
**Issue:** syncGitUrlSource only checks whether dest/.git exists before fetching. For an existing managed cache, fetchGitUrlSource runs git fetch against whatever origin is already configured, without verifying or resetting it to sourceLocation(source). If a plugin source keeps the same source.id but changes its Git URL, resolveSource can return content from the previous repository.
**Suggestion:** In syncGitUrlSource or fetchGitUrlSource, verify that the existing cache's origin URL matches sourceLocation(source) before fetching. If it differs, either set origin to sourceLocation(source) before fetch or remove and reclone the cache, then resolve and clean the tree from that repository.
**Rationale:** The cache directory is keyed by source.id, but the configured Git URL is part of the source identity for data integrity. Returning a source root from a stale remote can install or validate a plugin from a repository the current configuration no longer references.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
