# spec 204 tests

## Files

- `placement-integrity.test.js` — verifies the `ai-question-style.md` partial
  exists and is `include`-wired into every SKILL.md under
  `src/templates/skills/`. Also checks that the partial body covers the
  three rule categories (文体 / 前提知識 / 選択肢) and contains good/bad
  example markers. Step instruction files (`src/flow/prompts/`) are
  intentionally NOT included — the partial reaches the AI via SKILL.md
  at skill-load time.

## Scope

Spec-local verification tests. These live under `specs/204-.../tests/`
because they assert on this spec's specific wiring decisions, not on
long-term public contracts.

Long-term public contracts related to this spec (include directive
parsing, step instruction loader contract) live under the formal test
suite:

- `tests/unit/lib/include.test.js` — `resolveIncludes` contract, now
  extended with max-depth (8) and max-include-count (32) bounds.
- `tests/unit/flow/get-step-instructions.test.js` — loader contract,
  extended with include-expansion cases.

## How to run

```bash
# Full suite (includes placement-integrity via tests/run.js discovery)
node tests/run.js

# Spec-local only
node --test specs/204-unify-ai-prompt-style/tests/placement-integrity.test.js
```

## Expected behavior before implementation

Tests in this directory **fail** until the partial file is created and
include directives are added to SKILL.md and step instruction files.
Tests under `tests/unit/lib/include.test.js` for depth / count bounds
also fail until bounds are added to `src/lib/include.js`.
