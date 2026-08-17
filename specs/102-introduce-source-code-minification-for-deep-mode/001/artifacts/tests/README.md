# Tests for spec #102: Source code minification for deep mode

## What was tested and why
- `minify(code, filePath)` function: core minification logic
- Generic minify: blank line removal, trailing whitespace removal
- Language-specific minify: JS/TS, PHP, Python, YAML comment removal and indent normalization
- Edge cases: URL `://` protection, shebang preservation, empty input, comment-only files

## Where tests are located
- Formal test path: `tests/unit/docs/lib/minify.test.js`

## How to run
```bash
node --test tests/unit/docs/lib/minify.test.js
```

## Expected results
- All tests should fail initially (minify.js does not exist yet)
- After implementation, all tests should pass
