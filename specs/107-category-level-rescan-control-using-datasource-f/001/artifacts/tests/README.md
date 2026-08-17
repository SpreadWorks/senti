# Tests for spec #107: Category-level rescan control using DataSource file hashes

## What was tested and why
- MD5 hash computation for DataSource files
- Detection of dataSourceHash mismatch between stored and current values
- Entry hash clearing when DataSource file changes
- Preservation of entry hashes when DataSource file is unchanged
- Handling of missing dataSourceHash (first run after feature)

## Where tests are located
- `tests/unit/docs/commands/scan-datasource-hash.test.js`

## How to run
```bash
node --test tests/unit/docs/commands/scan-datasource-hash.test.js
```

## Expected results
- All tests pass (tests verify the hash computation and comparison logic, not the full scan pipeline integration)
