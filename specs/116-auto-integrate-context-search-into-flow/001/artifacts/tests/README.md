# Tests for #116 auto-integrate-context-search-into-flow

## What is tested
- `collectAllKeywords(analysis)` — keyword collection from analysis.json
- `buildKeywordSelectionPrompt(keywords, query)` — AI prompt construction
- `fallbackSearch(entries, query)` — space-split OR search fallback

## Test location
- Formal test: `tests/unit/flow/get-context-ai-search.test.js` (public API contract)

## How to run
```bash
node --test tests/unit/flow/get-context-ai-search.test.js
```

## Expected results
- All tests should fail initially (functions not yet exported)
- After implementation, all tests should pass
