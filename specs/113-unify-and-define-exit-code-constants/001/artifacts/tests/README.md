# Tests for spec #113: Unify and define exit code constants

## What was tested and why
- EXIT_SUCCESS and EXIT_ERROR constant values and types

## Where tests are located
- `specs/113-unify-and-define-exit-code-constants/tests/exit-codes.test.js`

## How to run
```bash
node --test specs/113-unify-and-define-exit-code-constants/tests/exit-codes.test.js
```

## Expected results
- Tests fail initially (exit-codes.js does not exist yet)
- After implementation, all tests pass
