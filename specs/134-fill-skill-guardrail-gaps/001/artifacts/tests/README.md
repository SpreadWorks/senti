# Tests: 134-fill-skill-guardrail-gaps

## What was tested
- AC1: flow-plan SKILL.md spec step references `get guardrail spec`
- AC2: flow-plan SKILL.md test step references `get guardrail test` + `run review --phase test`
- AC3: flow-impl SKILL.md has gate impl re-validation after code review
- AC4: `get guardrail test` returns valid result (not error)

## Location
`specs/134-fill-skill-guardrail-gaps/tests/guardrail-gaps.test.js`

## How to run
```bash
node --test specs/134-fill-skill-guardrail-gaps/tests/guardrail-gaps.test.js
```

## Expected results
All tests pass after implementation. AC1-AC3 fail before SKILL.md changes. AC4 fails before get-guardrail.js change.
