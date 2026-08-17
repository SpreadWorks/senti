# Test: 128-remove-guardrail-exemption

## What was tested and why
- extractExemptions is no longer exported from gate.js
- buildGuardrailPrompt includes all spec-phase guardrails without exemption filtering (even when spec has Exemptions section)
- buildGuardrailPrompt includes "inapplicable → PASS" instruction

## Test location
`specs/128-remove-guardrail-exemption/tests/exemption-removed.test.js`

## How to run
```bash
node --test specs/128-remove-guardrail-exemption/tests/exemption-removed.test.js
```

## Expected results
- Before implementation: 2 of 3 tests fail (extractExemptions still exported, Rule B still filtered)
- After implementation: all tests pass
