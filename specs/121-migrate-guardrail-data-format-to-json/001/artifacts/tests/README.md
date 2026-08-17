# Test: 121-migrate-guardrail-data-format-to-json

## What was tested and why
- JSON guardrail loading: verifies that `loadMergedGuardrails()` correctly reads `guardrail.json` files
- lint string → RegExp conversion: verifies that string-form lint patterns are converted to RegExp on load
- Default phase application: verifies that missing `meta.phase` defaults to `["spec"]`
- id-based merge: verifies that child guardrails with the same `id` override parent, and new `id`s are appended
- Rename verification: verifies that old function names (`loadMergedArticles`, `parseGuardrailArticles`, `serializeArticle`, `loadGuardrailTemplate`) are removed and `loadMergedGuardrails` is exported

## Test location
`specs/121-migrate-guardrail-data-format-to-json/tests/guardrail-json.test.js`

These are spec verification tests (not added to `npm test`) because they validate this specific migration's requirements. The existing formal tests in `tests/unit/specs/commands/guardrail*.test.js` will be updated as part of R7 to work with the new JSON format.

## How to run
```bash
node --test specs/121-migrate-guardrail-data-format-to-json/tests/guardrail-json.test.js
```

## Expected results
- Before implementation: tests will fail (import errors for renamed functions)
- After implementation: all tests should pass
