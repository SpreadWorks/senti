# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Clarify list cell normalization
**Target:** R4 / T-1
**Improvement:** `Table.toMarkdown()` currently normalizes nullish cells to an em dash and escapes pipe characters. Consider stating whether the new Table-owned list rendering should reuse those cell normalization rules or render raw string values.
**Why non-blocking:** The simple two-column list behavior is already observable and testable from the spec; this only tightens edge-case expectations for values not covered by the main acceptance criteria.

### 2. Clarify table format on non-Table renderables
**Target:** R3 / R5
**Improvement:** Existing DataSources can return `Paragraph` and `Blockquote` as well as `Table`. Consider adding one sentence that `format: "table"` is an alias for the current default `toMarkdown()` path, or that it is only meaningful for `Table`.
**Why non-blocking:** The spec explicitly defines the required error path for `format: "list"` on non-Table renderables and gives a safe implementation path; this clarification would only remove a small discretionary choice.
