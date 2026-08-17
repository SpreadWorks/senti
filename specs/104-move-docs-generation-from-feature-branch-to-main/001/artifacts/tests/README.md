# Spec #104 Tests

## What was tested and why

### finalize-step-order.test.js
Tests the finalize pipeline step order and sync behavior:
- STEP_MAP reflects new order (sync=5, cleanup=6)
- Sync is skipped when merge strategy is PR
- All mode uses --auto for merge without requiring --merge-strategy

### finalize-prompt.test.js
Tests prompt definition updates:
- finalize.steps prompt has sync before cleanup
- finalize.merge-strategy prompt removes duplicate merge/squash, keeps only squash merge and pull request

## Where tests are located

`specs/104-move-docs-generation-from-feature-branch-to-main/tests/`

## How to run

```bash
node --test specs/104-move-docs-generation-from-feature-branch-to-main/tests/finalize-step-order.test.js
node --test specs/104-move-docs-generation-from-feature-branch-to-main/tests/finalize-prompt.test.js
```

## Expected results

- All tests should **fail** before implementation (step order and prompts not yet changed)
