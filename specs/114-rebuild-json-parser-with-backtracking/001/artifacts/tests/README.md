# Tests for #114 rebuild-json-parser-with-backtracking

## What is tested
- `repairJson(text)` — recursive descent JSON repair with backtracking
  - Valid JSON passthrough
  - Unescaped quotes (including `type=""` pattern)
  - Markdown fence stripping
  - Truncated JSON completion
  - Surrounding text extraction
  - Edge cases (empty strings, null/true/false, numbers, invalid escapes)

## Test location
- Formal test: `tests/unit/lib/json-parse.test.js` (public API contract — breakage = bug)

## How to run
```bash
node --test tests/unit/lib/json-parse.test.js
```

## Expected results
- All tests should fail initially (repairJson not yet implemented)
- After implementation, all tests should pass
