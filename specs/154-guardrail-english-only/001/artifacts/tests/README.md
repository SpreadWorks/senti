# Spec Verification Tests: 154-guardrail-english-only

## What was tested and why

These tests verify that the guardrail file migration (spec #154) is complete:

1. No `templates/en/guardrail.json` or `templates/ja/guardrail.json` files remain in any preset
2. Each preset that previously had guardrail files now has `guardrail.json` at the preset root
3. The content of `base/guardrail.json` contains English titles (regression sample)

These tests are spec-specific migration checks, not general contract tests. They confirm this spec's requirements are met and are kept as history.

## Test location

`specs/154-guardrail-english-only/tests/guardrail-migration.test.js`

These tests are NOT part of `npm test`. Run them manually.

## How to run

```bash
# From the project root (or worktree root)
node --test specs/154-guardrail-english-only/tests/guardrail-migration.test.js
```

## Expected results

All 5 tests pass after implementation:
- `no templates/en/guardrail.json exists in any preset` → PASS
- `no templates/ja/guardrail.json exists in any preset` → PASS
- `each preset that previously had a guardrail has one at its root` → PASS
- `base preset guardrail.json contains English titles` → PASS

Before implementation, tests 1–4 should fail (files still in old location).
