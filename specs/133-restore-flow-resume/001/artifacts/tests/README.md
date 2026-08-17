# Tests for 133-restore-flow-resume

## What was tested

- `resolveActiveFlow()` shared helper: 3-stage fallback (flowState → activeFlows → scanAllFlows), null return, multiple flow error
- `sdd-forge flow resume` command: JSON envelope output, goal/scope extraction, notes/requirements, error on no flow, help output

## Test locations

- **Formal tests** (`tests/unit/flow/resolve-active-flow.test.js`): `resolveActiveFlow` helper — public API contract test, breakage always indicates a bug
- **Spec verification** (`specs/133-restore-flow-resume/tests/resume-command.test.js`): resume command behavior verification

## How to run

```bash
# Formal test (included in npm test)
node --test tests/unit/flow/resolve-active-flow.test.js

# Spec verification test
node --test specs/133-restore-flow-resume/tests/resume-command.test.js
```

## Expected results

All tests should fail initially (command and helper not yet implemented).
After implementation, all tests should pass.
