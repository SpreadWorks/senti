# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Overlay update-all reports new commits without persisting the pin
**Failure mode:** security_or_data_integrity_bug
**File:** src/lib/plugin-registry.js
**Issue:** syncInstalledPlugins reads merged config.local packages, but installFromSource only writes .senti/config.json. For an overlay-only package updated by plugin update-all, the command can return updated: true with a new commit and materialize/deploy that commit while leaving .senti/config.local.json pinned to the old commit.
**Suggestion:** Update syncInstalledPlugins or the installFromSource update branch so overlay-owned packages write the new commit back to .senti/config.local.json, or fail before reporting updated: true when the package state cannot be persisted without leaking it to public config.
**Rationale:** A successful update-all must leave installed package state and persisted package metadata consistent. Otherwise subsequent sync/update-all reads the stale overlay pin, can revert the package, and repeatedly reports the same update.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
