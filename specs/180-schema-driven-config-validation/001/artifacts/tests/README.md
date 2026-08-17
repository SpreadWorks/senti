# Tests for spec-180: schema-driven-config-validation

## What was tested and why

- Acceptance criteria from the spec: valid config acceptance, unknown field rejection, deprecated field rejection, error message quality, cross-field validation (defaultLanguage, provider references), removal of old code/files, and validator generality.

## Where tests are located

- **Formal tests (run by `npm test`)**: `tests/unit/lib/schema-validate.test.js` — public API contract tests for the generic schema validator
- **Spec verification tests**: `specs/180-schema-driven-config-validation/tests/verify.test.js` — acceptance criteria verification

## How to run

```bash
# Formal tests
node tests/run.js --scope unit

# Spec verification tests
node --test specs/180-schema-driven-config-validation/tests/verify.test.js
```

## Expected results

- All tests should fail initially (implementation not yet done)
- After implementation, all tests should pass
