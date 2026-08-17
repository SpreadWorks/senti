# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Implementation commit fallback is ambiguous in real finalize history
**Target:** R2 / Data Flow
**Issue:** The spec says to fall back to the feature branch implementation commit subject summary when the spec goal is empty or unreadable, but the existing finalize flow adds non-implementation commits on the feature branch before squash merge. In particular, src/flow/registry.js commits finalize-merge metadata with messages like "chore: record finalize metadata before merge" before runMerge, and src/flow/lib/run-finalize.js can add "chore: add retro and report" after finalize-commit. The spec does not define which git range, ordering, or filtering identifies the implementation commit subject among those commits.
**Required change:** Specify the exact source for the implementation commit subject fallback, including how to exclude or otherwise avoid finalize metadata/report commits in the feature branch history.
**Why blocking:** Without this, an implementation can validly choose the latest or first subject from baseBranch..featureBranch and produce a squash subject like "chore: record finalize metadata before merge" instead of the implementation summary. That makes R2 unsafe to implement and prevents tests from covering the real finalize history shape rather than an artificial single-commit branch.


## Non-blocking Improvements

### 1. Mention finalize hook files in related context
**Target:** Codebase Context / Modules
**Improvement:** Add src/flow/registry.js and src/flow/lib/run-finalize.js as related files because finalize-merge pre/post hooks create commits that affect the fallback commit-subject source.
**Why non-blocking:** The main implementation still belongs in merge.js, but naming these files would make the existing history-shaping behavior easier to account for.

### 2. Add unreadable spec acceptance case
**Target:** Acceptance Criteria
**Improvement:** Add an explicit acceptance criterion for unreadable spec.json falling back to the implementation commit subject summary, matching R2.
**Why non-blocking:** R2 already states the behavior, so implementation and tests can still be derived from the requirement; the extra acceptance item would just make coverage expectations clearer.
