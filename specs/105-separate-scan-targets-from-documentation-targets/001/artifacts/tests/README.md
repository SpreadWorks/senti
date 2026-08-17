# Tests for spec #105: Separate scan targets from documentation targets

## What was tested and why
- `validateConfig` docs.exclude: Validate new docs.exclude field format (R2)
- `filterByDocsExclude()`: Filter entries by glob patterns before enrich (R4)

## Where tests are located
- `tests/unit/lib/types-docs-exclude.test.js` — validation tests
- `tests/unit/docs/commands/enrich-exclude.test.js` — enrich filter tests

## How to run
```bash
node --test tests/unit/lib/types-docs-exclude.test.js tests/unit/docs/commands/enrich-exclude.test.js
```

## Expected results
- All tests should fail initially (filterByDocsExclude not exported yet, validation not implemented)
- After implementation, all tests should pass
