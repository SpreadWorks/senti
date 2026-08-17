# Spec 235: Remove Flow Test Management — Tests

## What was tested

Verification that flow test management infrastructure has been correctly removed:

- Deleted files (run-tests.js, summarize-test-log.js, set-test-summary.js, prompts, schemas)
- TASK_STEPS_PLAN reduced to [impl, review, gate-impl]
- TASK_PHASE_MAP cleaned of write-tests/run-tests entries
- Gate-impl test evidence functions removed from run-gate.js exports
- buildImplCheckPrompt no longer accepts testEvidence parameter
- context-rules.json cleaned of test step entries
- spec.schema.json cleaned of authorized_test_modifications and expected_tests
- Registry cleaned of run.tests and set.test-summary entries

## Location

`specs/235-remove-flow-test-management/tests/verify-removal.test.js`

## How to run

```bash
node --test specs/235-remove-flow-test-management/tests/verify-removal.test.js
```

## Expected results

All tests pass after implementation is complete. Tests will fail before implementation (files still exist, exports still present).
