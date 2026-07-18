# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-explicit-task-render-context/test-coverage.json`

## Blocking Findings

### 1. Schema-side TaskId rejection coverage is incomplete
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js R1 test
**Issue:** The R1 test checks the exact pattern string and one invalid parent value through validateSchema, but it does not exercise schema rejection for tasks[].id and non-null tasks[].parent across the required invalid classes: empty, over-100-character, slash, backslash, dot-segment, drive-prefix, UNC-style, whitespace, and non-ASCII.
**Required change:** Add spec-local schema validation assertions for both tasks[].id and non-null tasks[].parent covering the required invalid identity classes, while keeping the existing TaskId constructor parity checks.
**Why blocking:** R1 explicitly requires both the schema and TaskId constructor to reject the full invalid set; the current schema test could pass with most schema-side invalid cases untested.

### 2. R3 planning-order and cardinality behavior is not exercised through production entry points
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js R3 tests
**Issue:** The production CLI test only asserts the final task files and bytes. It would still pass if runSpecRender created directories or wrote files before completing all TaskOutputPath planning, constructed extra TaskOutputPath values, produced more than n markdown bodies or write-plan entries transiently, or used recursive/pairwise scans. The internal renderSpecView entry point is not covered for the R3 planning contract.
**Required change:** Add production-entry coverage that observes planning-before-write behavior and cardinality for runSpecRender and renderSpecView, such as instrumenting fs side effects and exported contract constructors/renderers so the test fails if any directory creation or write occurs before exactly n confined task paths are planned.
**Why blocking:** R3 is primarily about pre-side-effect planning, cardinality, and algorithm shape; the current final-file assertions can pass without exercising that production behavior.

### 3. SpecRenderContext title and creation-date derivation is not covered at the owning contract
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js R4 test
**Issue:** The R4 test verifies colocated flow metadata selection and fallback feature/input values, but it does not assert that SpecRenderContext itself derives the title and creation date from the selected spec.json.
**Required change:** Extend the R4 SpecRenderContext test to assert toRenderMeta().title and toRenderMeta().created are derived from the selected spec.json path/stat data, including in the absent or mismatched metadata cases.
**Why blocking:** R4 specifically requires SpecRenderContext to derive title and creation date from the selected spec.json; without direct assertions, that acceptance requirement has no corresponding spec-local coverage at the target API.


## Advisory Findings

No advisory findings.