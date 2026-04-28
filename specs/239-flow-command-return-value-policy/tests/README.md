# Spec 239 Tests — flow command return value policy

## What is tested
- R1: `get-next-action` returns `ok:true` with `{ step: null, action: null }` when no active flow exists
- R2: `get-next-action` returns `ok:true` with `{ step: null, action: 'completed' }` when all steps are done
- R3: `get-check` works without active flow (dirty/gh check) and returns structured empty state for step prerequisites

## Location
`specs/239-flow-command-return-value-policy/tests/return-value-policy.test.js`

## How to run
```bash
node --test specs/239-flow-command-return-value-policy/tests/return-value-policy.test.js
```

## Expected results
All tests pass after implementation of R1-R3.
