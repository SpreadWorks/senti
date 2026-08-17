# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/279-reduce-gate-impl-prompt-size/test-coverage.json`

## Blocking Findings

### 1. R1 file-map path is not exercised
**Target:** specs/279-reduce-gate-impl-prompt-size/tests/gate-impl-prompt-batches.test.js
**Issue:** The R1 test calls buildImplCheckPrompt with a manually constructed RequirementPromptExcerpt, so it only proves that an excerpt-only input renders without unrelated text. It would still pass if the actual file-map gate-impl path continued to build requirements from full specJsonToPromptText output before calling the prompt builder.
**Required change:** Add spec-local coverage that exercises the file-map gate-impl planning/path entry point with full spec text plus related file-map context, and asserts the generated requirement agent prompt contains only the target requirement excerpt and omits unrelated full spec text.
**Why blocking:** R1's core acceptance requirement is about behavior when a file-map exists in gate-impl. The current test does not cover that production path and can pass without exercising the required behavior.

### 2. R4 fallback prompt content and parsed evaluations are undercovered
**Target:** specs/279-reduce-gate-impl-prompt-size/tests/gate-impl-prompt-batches.test.js
**Issue:** The R4 test only asserts that the no-file-map task-impl plan has one call and usesFullSpec=true. It does not verify that the fallback call includes the full spec text and full diff, nor that evaluations are parsed for all usable requirement ids.
**Required change:** Extend the R4 spec-local test to inspect/build the fallback prompt and assert it includes the full spec text and full diff, and add a fake agent response path or parser-level assertion proving evaluations for all usable requirement ids are parsed.
**Why blocking:** R4 explicitly preserves existing bulk requirement check behavior. Without these assertions, an implementation could satisfy the current test while omitting the full diff or failing to parse all requirement evaluations.


## Advisory Findings

### 1. Full-spec regex assertion is malformed
**Target:** specs/279-reduce-gate-impl-prompt-size/tests/gate-impl-prompt-batches.test.js
**Improvement:** Replace the FULL_SPEC_TEXT RegExp construction with a normal escaped literal or a direct substring assertion where possible. The current replacement string inserts a placeholder for regex metacharacters, so it does not accurately represent the full fixture text.
**Why non-blocking:** Other R1 assertions still check important unrelated-text omission, but this specific assertion is weaker and may give false confidence.
