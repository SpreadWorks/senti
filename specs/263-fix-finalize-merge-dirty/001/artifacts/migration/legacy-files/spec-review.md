# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. R3 and R4 do not define the external-dirty retry-reset intersection
**Target:** Requirements R3/R4 and Acceptance Criteria
**Issue:** The spec requires no metadata auto-commit when any target-external dirty path exists, but also requires the existing downstream skipped reset to reset and commit flow.json before runPreSync. In the current code, finalize-merge.pre performs the skipped reset by staging specs/<specId>/flow.json and calling commitOrSkip, which commits the index. The spec does not say what should happen when a prior merge failure left finalize-sync/finalize-cleanup skipped and the retry also has a target-external dirty path.
**Required change:** Add the smallest explicit R3/R4 precedence clause for this combined case, for example: when any target-external dirty path exists, the skipped-downstream reset must also no-op without mutating or committing flow.json, and the existing dirty-worktree stop is preserved; when only allowed metadata paths are dirty, the reset/metadata commit may proceed.
**Why blocking:** Without this, implementers and tests cannot determine whether to skip all pre-hook metadata mutation, create a reset commit despite external dirty paths, or keep the current plain commit behavior. The current plain commit path can also consume pre-staged target-external user work, which contradicts the user-work protection boundary.


## Non-blocking Improvements

### 1. Mention git helper integration
**Target:** Overview / Modules
**Improvement:** Add src/lib/git-helpers.js as a related implementation file because git status parsing and runGit/listUncommittedFiles behavior are the existing integration points for the allowed-path dirty check.
**Why non-blocking:** The current spec already identifies run-finalize.js and registry.js as sufficient implementation targets, so this is a navigation aid rather than a blocker.
