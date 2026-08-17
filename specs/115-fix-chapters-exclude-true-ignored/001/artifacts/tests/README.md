# Tests for #115 fix-chapters-exclude-true-ignored

## What is tested
- `resolveChaptersOrder()` filters out chapters with `exclude: true`
- Old string format configChapters still work

## Test location
- Formal test: `tests/unit/docs/lib/template-merger.test.js` (added to existing describe block)

## How to run
```bash
node --test tests/unit/docs/lib/template-merger.test.js
```

## Expected results
- New exclude:true tests should fail initially (filter not yet implemented)
- After implementation, all tests should pass
