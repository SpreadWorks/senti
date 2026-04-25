# Spec 230: Guardrail False Positive Fix Tests

## What was tested
- REQ-1: draft-scope-boundary body permits file path/function name mentions
- REQ-2: complete-context body does not mandate when/if/shall syntax
- REQ-3: T-pending-spec is filtered from gate evaluation input
- REQ-4: prioritize-requirements uses 'more than three' wording
- REQ-5: exit-code-contract phase is restricted to task-impl only

## Location
`specs/230-fix-guardrail-false-positives/tests/guardrail-false-positive-fix.test.js`

## How to run
```bash
node --test specs/230-fix-guardrail-false-positives/tests/guardrail-false-positive-fix.test.js
```

## Expected results
All tests pass after implementation of REQ-1 through REQ-5.
