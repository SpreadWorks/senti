# Spec #102 Tests — text command responsibility separation

## What was tested and why

- **`--files` option**: Verifies that the new `--files` CLI option correctly filters which files are processed by the `text` command
- **Fallback behavior**: Verifies that without `--files`, all chapter files are processed (backward compatibility)
- **`resolveTargetFiles` removal**: Verifies that `resolveTargetFiles` is no longer exported from `text.js`

## Where tests are located

- `specs/102-refactor-text-command-to-separate-responsibiliti/tests/text-files-option.test.js`

## How to run

```bash
node --test specs/102-refactor-text-command-to-separate-responsibiliti/tests/text-files-option.test.js
```

## Expected results

- All tests should fail initially (before implementation):
  - `--files` option tests fail because the option doesn't exist yet
  - `resolveTargetFiles` removal test fails because the function is still exported
- After implementation, all tests should pass
