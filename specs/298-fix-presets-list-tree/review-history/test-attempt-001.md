# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/298-fix-presets-list-tree/test-coverage.json`

## Blocking Findings

### 1. Multi-level chain nesting is not actually asserted
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js R2
**Issue:** The R2 test checks only relative string order and a loose js-webapp-before-nextjs regex. A flat tree or otherwise incorrectly nested output could satisfy these assertions as long as the names appear in order.
**Required change:** Assert the concrete tree relationship/indentation/connectors showing webapp as a child of base, js-webapp as a child of webapp, and nextjs as a child of js-webapp.
**Why blocking:** R2 requires the displayed multi-level chain, and the current test can pass without exercising that structural behavior.

### 2. Registry load failure fallback is uncovered
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js R3
**Issue:** R3 covers the no-plugin-registry case, but does not cover registry loading failure in non-strict inspection mode.
**Required change:** Add a spec-local test that creates a project whose plugin registry/config exists but fails to load, then verifies presets list exits successfully and renders the base-only tree.
**Why blocking:** R3 explicitly requires graceful fallback for registry loading failures, and that acceptance path has no corresponding test coverage.

### 3. Missing-base fallback formatting is uncovered
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js R4
**Issue:** The coverage artifact marks R4 covered, but the test does not exercise the missing-base fallback behavior listed in R4.
**Required change:** Add a focused renderer test where the preset inventory lacks a base entry and assert the expected missing-base fallback output behavior.
**Why blocking:** R4 includes missing-base fallback as retained public output behavior, and the current tests do not cover it.

### 4. Depth bound is not validated
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js R6
**Issue:** The R6 test checks the 512 preset limit and that one disconnected cycle does not throw, but it never creates a chain deeper than 16 or asserts rendering is capped at depth 16.
**Required change:** Add a focused renderer test with a chain deeper than 16 and assert traversal/rendering stops at the required depth bound.
**Why blocking:** R6 explicitly requires rendering at most depth 16, and this bound has no test coverage.

### 5. Cycle prevention test does not exercise reachable cycle traversal
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js R6
**Issue:** The cyclic fixture has a, b, and c disconnected from base, so a base-rooted tree traversal may never visit the cycle. The test can pass without implementing visited-key cycle protection.
**Required change:** Use a cycle scenario that is reachable from the rendered root or otherwise directly exercises traversal of cyclic parent relationships, and assert it terminates without repeated traversal.
**Why blocking:** R6 requires preventing cycle traversal with visited preset keys, and the current fixture can pass without testing that behavior.


## Advisory Findings

### 1. Setup ownership guard is broad
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js R5
**Improvement:** The R5 setup smoke test checks that setup still writes type base, but it does not isolate preset chain resolution semantics, plugin installation behavior, or official-presets package contents. Consider narrower static or fixture-based guards if those areas are easy to snapshot locally.
**Why non-blocking:** R5 is a non-regression boundary, and the existing test gives some protection against accidental setup coupling; fuller guardrails would improve confidence but are not strictly required before implementation.
