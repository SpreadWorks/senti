# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. R4 conflicts with the existing npm test boundary for spec-local tests
**Target:** R4 / Acceptance Criteria R4 / specs/282-review-test-input-contract/tests/
**Issue:** The spec requires normal `npm test` to detect R1, R2, and R3 through spec-local tests under `specs/282-review-test-input-contract/tests/`, but the existing test runner only discovers default directories `tests/unit`, `tests/e2e`, and `src/presets`; `tests/helpers/test-runner-search-dirs.js` explicitly excludes `specs/`, and `src/flow/prompts/plan/test.md` documents spec-local tests as not run by `npm test`.
**Required change:** Clarify R4 and its acceptance criterion so normal `npm test` detection is provided by shared unit/e2e tests or by an explicitly scoped wrapper test, while spec-local tests remain flow-local; alternatively, explicitly scope a compatible `tests/run.js` change and its impact on existing historical `specs/*/tests`.
**Why blocking:** Left unchanged, implementers cannot know whether to change the global test runner to include `specs/` tests, which would alter existing regression behavior and potentially run many historical spec-local tests, or to add shared tests, which may violate the current wording that spec-local coverage is required for normal `npm test` detection.


## Non-blocking Improvements

### 1. Mention the test runner files for R4
**Target:** Codebase Context / R4
**Improvement:** Add `tests/run.js` and `tests/helpers/test-runner-search-dirs.js` to the related files because R4 depends on how normal `npm test` discovers files.
**Why non-blocking:** Implementation can still find the runner, but naming these files would reduce ambiguity once the R4 npm-test boundary is corrected.

### 2. Name the likely prompt-limit test seam
**Target:** R3
**Improvement:** Clarify whether R3 should be tested through the CLI/provider boundary or by exporting the existing prompt-limit helper/constant for focused unit assertions.
**Why non-blocking:** The spec already permits exposing existing behavior for tests and the provider boundary is observable, so this does not block implementation.
