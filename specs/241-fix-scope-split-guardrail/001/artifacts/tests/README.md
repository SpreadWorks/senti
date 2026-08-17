# Tests for spec 241-fix-scope-split-guardrail

## What is tested

- **R1**: `single-responsibility` guardrail body in `src/presets/base/guardrail.json` contains user-scope-respecting language and a prohibition on AI-initiated scope splitting. Also verifies id/title/meta are unchanged.
- **R2**: `src/flow/prompts/plan/draft.md` first line (a) does not suggest spec splitting, (b) references task decomposition, (c) references `task-single-responsibility` guardrail.

## Location

`specs/241-fix-scope-split-guardrail/tests/guardrail-body.test.js`

## How to run

```bash
node --test specs/241-fix-scope-split-guardrail/tests/guardrail-body.test.js
```

## Expected results

All 6 assertions pass after implementation of T-1 and T-2.
