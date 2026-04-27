# Spec 234: Test Guardrail Reorganization — Tests

## What is tested
Verifies that `src/presets/base/guardrail.json` reflects the guardrail reorganization specified in spec 234:
- R1: 4 obsolete entries deleted
- R2: `no-disabling-existing-tests` body enhanced with MUST-level language
- R3: `impl-test-conflict-escalation` renamed to `pre-existing-test-failure-escalation`
- R4: `spec-test-coverage` added with correct phases
- R5: `project-test-integrity` added with correct phase
- R6: `spec-includes-test-strategy` unchanged

## Location
`specs/234-test-guardrail-reorg/tests/guardrail-reorg.test.js`

## How to run
```bash
node --test specs/234-test-guardrail-reorg/tests/guardrail-reorg.test.js
```

## Expected results
All tests pass after implementation of the guardrail changes. Tests will fail before implementation (deleted entries still exist, new entries not yet added).
