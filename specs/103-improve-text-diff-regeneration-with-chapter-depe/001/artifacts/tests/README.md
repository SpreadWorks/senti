# Spec #103 Tests

## What was tested and why

### entry-id.test.js
Tests the persistent entry ID mechanism in scan:
- First scan assigns unique `id` to every entry
- Re-scan with unchanged files preserves the same `id`
- Re-scan with changed file content preserves the `id` (content changes, identity stays)
- New files get new IDs while existing IDs are preserved
- All IDs are unique across entries

### text-diff.test.js
Tests the change detection and chapter targeting logic for text:
- Identifies changed entries by comparing stored hash vs current file hash
- Detects no changes when all hashes match
- Maps changed entries to their chapters (only affected chapters flagged)
- Treats missing source files as changed (chapter flagged for regeneration)

## Where tests are located

`specs/103-improve-text-diff-regeneration-with-chapter-depe/tests/`

## How to run

```bash
node --test specs/103-improve-text-diff-regeneration-with-chapter-depe/tests/entry-id.test.js
node --test specs/103-improve-text-diff-regeneration-with-chapter-depe/tests/text-diff.test.js
```

## Expected results

- `entry-id.test.js`: All tests should **fail** before implementation (entries lack `id` field)
- `text-diff.test.js`: Detection logic tests pass (they test the algorithm directly), integration tests will fail until text command implements diff-based regeneration
