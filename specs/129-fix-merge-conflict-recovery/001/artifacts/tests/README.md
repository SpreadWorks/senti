# Test: 129-fix-merge-conflict-recovery

## What was tested and why
- R1: git merge --squash conflict scenario creates conflicted state (baseline behavior confirmation)
- R3: loadFlowState returns null for non-existent flow.json (post hook safety)

## Test location
`specs/129-fix-merge-conflict-recovery/tests/merge-conflict-recovery.test.js`

## How to run
```bash
node --test specs/129-fix-merge-conflict-recovery/tests/merge-conflict-recovery.test.js
```

## Expected results
- Before implementation: baseline tests pass (they verify pre-existing behavior)
- After implementation: all tests pass, and merge.js returns abort + error on conflict
