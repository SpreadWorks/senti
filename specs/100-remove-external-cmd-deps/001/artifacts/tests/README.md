# Spec 100: Implementation Verification Tests

## Purpose
Verify that git/gh direct execution is removed from flow skills and replaced with sdd-forge commands.

## Formal Tests (in tests/unit/flow/)

1. **resolve-context-extended.test.js** — Verify resolve-context returns dirty, currentBranch, aheadCount, ghAvailable, lastCommit fields
2. **removed-commands.test.js** — Verify flow run merge/cleanup return "unknown action" error (removed from registry)
3. **skill-no-external-deps.test.js** — Verify all 5 skill templates have no direct git/gh execution instructions

## How to Run
```bash
node --test tests/unit/flow/resolve-context-extended.test.js tests/unit/flow/removed-commands.test.js tests/unit/flow/skill-no-external-deps.test.js
```

## Why Not in specs/<spec>/tests/
All tests fit naturally into the formal test structure under tests/unit/flow/.
