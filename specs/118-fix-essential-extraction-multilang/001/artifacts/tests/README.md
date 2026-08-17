# Tests for #118 fix-essential-extraction-multilang

## What is tested
- `minify(code, "file.js", { mode: "essential" })` — JS Essential extraction via js.js handler
- `minify(code, "file.php", { mode: "essential" })` — PHP Essential extraction via php.js handler
- `minify(code, "file.py", { mode: "essential" })` — Python Essential extraction via py.js handler
- Fallback to regular minify for YAML and unknown extensions

## Test location
- Formal test: `tests/unit/docs/lib/minify.test.js`

## How to run
```bash
node --test tests/unit/docs/lib/minify.test.js
```

## Expected results
- PHP and Python Essential tests should fail initially (extractEssential not yet in handlers)
- After implementation, all tests should pass
