# Spec 231: show-report step tests

## What was tested
- R1: FLOW_STEPS includes show-report after docs-commit; buildInitialSteps output contains show-report entry
- R2: PHASE_MAP maps show-report to sync phase
- R3: context-rules.json has flow.show-report entry with correct instructions_key and valid output_schema_ref
- R5: sync/show-report.md prompt file exists

## Where tests are located
- `specs/231-show-report-step/tests/show-report-step.test.js` — spec verification tests
- `tests/unit/flow/flow-steps.test.js` — formal test (existing, show-report ordering assertion)
- `tests/unit/flow/instructions-coverage.test.js` — formal test (auto-validates prompt file coverage)

## How to run
```bash
node --test specs/231-show-report-step/tests/show-report-step.test.js
```

## Expected results
All tests pass after implementation of T-1, T-2, and T-3.
