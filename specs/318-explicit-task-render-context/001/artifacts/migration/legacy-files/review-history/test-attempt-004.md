# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-explicit-task-render-context/test-coverage.json`

## Blocking Findings

### 1. R7 coverage is incomplete despite being marked covered
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Issue:** The R7 tests cover deterministic render bytes and approval sync behavior, but they do not exercise several required retained behaviors: CLI --out resolution, schema error reporting, rendered stdout paths, additive orphan-file behavior on valid render, or the internal optional-missing result and changed list.
**Required change:** Add spec-local executable coverage for the missing R7 retained behaviors, or narrow the coverage artifact so it does not claim R7 is fully covered.
**Why blocking:** R7 is a must requirement and the coverage artifact says it is covered, but the actual tests omit multiple acceptance surfaces.

### 2. R3 path planning cardinality and complexity are not actually tested
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Issue:** The R3 tests verify produced files and some pre-side-effect reads, but they do not verify that CLI and internal view construct exactly one TaskOutputPath per task, at most n task Markdown bodies/write-plan entries before the first filesystem side effect, or avoid recursive/pairwise collection scans.
**Required change:** Add spec-local tests that instrument the production planning path to prove one TaskOutputPath and bounded planning work per validated task before the first mkdir/write, including both CLI and internal view entry points.
**Why blocking:** R3 explicitly requires these planning/cardinality guarantees; current tests could pass with an implementation that writes the right files while violating the required planning contract.


## Advisory Findings

### 1. Dot-segment examples could be more explicit
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Improvement:** Add direct invalid cases for ".." in both TaskId and schema parent/id checks, since the current list covers "." and "../escape" but not the bare parent-directory segment.
**Why non-blocking:** The existing invalid path examples still exercise dot and slash-based traversal rejection, so this is a useful boundary improvement rather than a coverage blocker.
