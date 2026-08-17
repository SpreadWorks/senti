# Tests for #112 context-search-layer-keyword-index

## What is tested
- `searchEntries(entries, query)` — keyword matching logic against analysis entries' keywords arrays

## Test location
- Formal test: `tests/unit/flow/get-context-search.test.js` (public API contract — breakage = bug)

## How to run
```bash
node --test tests/unit/flow/get-context-search.test.js
```

## Expected results
- All tests should fail initially (searchEntries not yet exported from context.js)
- After implementation, all tests should pass
