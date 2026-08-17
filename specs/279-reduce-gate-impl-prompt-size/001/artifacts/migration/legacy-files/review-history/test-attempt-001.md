# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/279-reduce-gate-impl-prompt-size/test-coverage.json`

## Blocking Findings

### 1. Missing split coverage for oversized same-context multi-requirement groups
**Target:** specs/279-reduce-gate-impl-prompt-size/tests/gate-impl-prompt-batches.test.js
**Issue:** R2 and R6 require coverage that a same-related-diff multi-requirement group exceeding MAX_IMPL_REQUIREMENT_BATCH_CHARS is split into multiple batches whose non-overflow promptCharCount values stay within 120000. The current R2 tests cover only an in-limit two-requirement batch and a single-requirement overflow batch.
**Required change:** Add a spec-local test that creates multiple requirements sharing one related diff context whose combined excerpt-plus-diff prompt section exceeds 120000, then asserts the planner returns multiple non-overflow batches and each multi-requirement batch stays within the limit.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, while the coverage artifact marks R2/R6 as covered.

### 2. Prompt-volume assertion measures the wrong surface and is likely infeasible
**Target:** specs/279-reduce-gate-impl-prompt-size/tests/gate-impl-prompt-batches.test.js: R6 test
**Issue:** R6 requires verifying target requirement prompt content is less than 50% of the full spec fixture character count, but the test compares the entire built userPrompt length, including prompt instructions and diff, against half of a very small FULL_SPEC_TEXT fixture. This encodes an implementation premise that prompt boilerplate and diff must also fit under that threshold, which is not the stated requirement.
**Required change:** Change the test to measure only the rendered requirement excerpt section, or use an exported prompt/batch property that represents that section, and compare it against a full spec fixture large enough to make the requirement meaningful.
**Why blocking:** The test clearly contradicts the target behavior surface and can fail without indicating a product defect.


## Advisory Findings

No advisory findings.