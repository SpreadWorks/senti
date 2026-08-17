# Tests for spec #138: fix-review-preamble

## What was tested
- `stripPreamble`: removes AI preamble text before spec headers
- `buildSpecFixPrompt`: includes preamble suppression instruction

## Where tests are located
- `specs/138-fix-review-preamble/tests/preamble.test.js`

## How to run
```bash
node --test specs/138-fix-review-preamble/tests/preamble.test.js
```

## Expected results
All tests pass after implementation.
