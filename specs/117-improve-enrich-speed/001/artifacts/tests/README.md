# Tests for #117 improve-enrich-speed

## What is tested
- `minify(code, filePath, { mode: "essential" })` — Essential extraction mode
- `splitIntoBatches` token-based splitting (existing tests will be updated to match new signature)

## Test location
- Formal test (minify essential): `tests/unit/docs/lib/minify.test.js` (added describe block)
- Formal test (splitIntoBatches): existing `tests/unit/docs/commands/enrich.test.js` (will be updated during impl)

## How to run
```bash
node --test tests/unit/docs/lib/minify.test.js
node --test tests/unit/docs/commands/enrich.test.js
```

## Expected results
- minify essential tests should fail initially (mode option not yet implemented)
- After implementation, all tests should pass
