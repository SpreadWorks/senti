# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Nested generated spec evidence is still scanned
**Finding key:** nested-specs-exclusion-not-applied
**Failure mode:** missing_acceptance_requirement
**File:** src/lib/file-tree-walker.js
**Requirement:** R1
**Issue:** `FreshnessSourcePolicy.shouldEnterDirectory()` only excludes `review-history`, `review-evidence`, and `tests/.raw` when those paths appear at fixed indexes under a top-level `specs/<id>/...` path. If `srcRoot` is `specs/480` or another nested subtree, walker relative paths become `review-history`, `review-evidence`, or `tests/.raw`, so those generated directories are not excluded and can make freshness stale or hit traversal limits.
**Suggestion:** Update `FreshnessSourcePolicy.shouldEnterDirectory()` to identify these generated spec directories by path shape relative to the current scan root as well as repository-root paths, for example by excluding `review-history`, `review-evidence`, and `tests/.raw` when they appear as the scanned directory itself or as the expected child path.
**Disposition:** must-fix
**Rationale:** R1 is mapped to `src/lib/file-tree-walker.js` and requires the named generated source boundaries to be excluded. The current fixed-index check misses the same boundaries when the source scan root is inside a spec subtree, making generated evidence part of the source freshness surface.

### 2. Nested docs under source is not excluded from source scan
**Finding key:** docs-directory-exclusion-only-direct-child
**Failure mode:** missing_acceptance_requirement
**File:** src/check/commands/freshness.js
**Requirement:** R2
**Issue:** `newestMtime()` excludes the documentation directory from the source scan only when `relativePath === excludedDirectory`. Descendants such as `docs/generated/page.md` are still passed to `sourcePolicy.shouldEnterDirectory()` if the walker reaches them through a nested traversal path, so docs files under `srcRoot` can still count as source files or limits.
**Suggestion:** Change the source docs exclusion predicate to exclude the docs directory and all descendants, such as `relativePath === excludedDirectory || relativePath.startsWith(`${excludedDirectory}/`)` after normalizing separators.
**Disposition:** must-fix
**Rationale:** R2 covers `src/check/commands/freshness.js` and `src/lib/file-tree-walker.js` and requires closed, policy-aware traversal of source and documentation surfaces. Counting the generated documentation tree as source contradicts the intended separation of source and docs scans and can produce false stale results or false indeterminate limits.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
