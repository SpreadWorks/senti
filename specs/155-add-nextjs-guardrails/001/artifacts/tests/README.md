# Spec Verification Tests: 155-add-nextjs-guardrails

## What was tested and why

This spec adds 9 new guardrail entries to `src/presets/nextjs/guardrail.json` and creates `src/presets/nextjs/NOTICE`. These tests verify that the spec requirements are met after implementation.

## Test location

`specs/155-add-nextjs-guardrails/tests/verify-guardrails.test.js`

These are spec verification tests (not formal tests), placed here because they verify requirements specific to this spec. They are not added to `tests/` as they do not represent invariants that must hold across all future changes.

## How to run

```bash
cd /path/to/sdd-forge
node --test specs/155-add-nextjs-guardrails/tests/verify-guardrails.test.js
```

## Expected results

All tests should PASS after implementation:

- guardrail.json has exactly 12 entries (3 existing + 9 new)
- All 3 existing guardrails are preserved
- All 9 new guardrails are present with required fields (id, title, body, meta.phase)
- `await-async-request-apis` body mentions "Next.js 15"
- NOTICE file exists and lists all 9 article names and both source licenses
