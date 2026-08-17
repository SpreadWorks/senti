# Test: 124-guardrail-output-format

## What was tested and why
- R1: Default Markdown output — verifies `flow get guardrail <phase>` outputs Markdown headings with title and body
- R1: Empty output — verifies empty string when no guardrails match the phase
- R2: JSON format — verifies `--format json` returns JSON envelope
- R3: Error output — verifies invalid/missing phase returns JSON error

## Test location
`specs/124-guardrail-output-format/tests/guardrail-output.test.js`

Spec verification tests (not added to `npm test`).

## How to run
```bash
node --test specs/124-guardrail-output-format/tests/guardrail-output.test.js
```

## Expected results
- Before implementation: tests will fail (output is JSON, not Markdown)
- After implementation: all tests should pass
