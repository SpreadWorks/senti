# Tests for #106 auto-generate-pr-description

## What is tested
- `parseSpec(content)` — extracts Goal, Scope, Requirements sections from spec.md content
- `buildPrTitle(spec, fallback)` — generates PR title from spec Goal, with fallback
- `buildPrBody(state, spec)` — generates structured PR body from spec sections and flow state

## Test location
- `tests/unit/flow/commands/merge.test.js`

## How to run
```bash
node --test tests/unit/flow/commands/merge.test.js
```

## Expected results
- All tests should fail initially (functions not yet exported from merge.js)
- After implementation, all tests should pass
