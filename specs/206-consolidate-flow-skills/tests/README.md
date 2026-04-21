# Tests for spec 206: consolidate flow skills

## What is tested

- **R8 / R9 / R4** — `package-shape.test.js` (spec-local)
  - consolidated skill template (`sdd-forge.flow/`) presence + frontmatter
  - legacy skill templates (`sdd-forge.flow-plan|impl|finalize/`) absence
  - AGENTS.sdd.md doc templates (ja/en) contain no legacy skill refs
  - `flow/prompts/plan/test.md` + `flow/prompts/impl/finalize.md` contain no `/sdd-forge.flow-{plan,impl,finalize}` refs

- **R10** — `tests/unit/lib/cleanup-obsolete-skills.test.js` (formal)
  - `cleanupObsoleteSkills()` removes legacy 3 flow skills when templates only contain the consolidated one
  - preserves unrelated and auxiliary skills
  - dry-run mode reports but does not modify filesystem
  - ignores non-`sdd-forge.*` skills

## Locations

- `specs/206-consolidate-flow-skills/tests/package-shape.test.js` — this spec only; package shape assertions
- `tests/unit/lib/cleanup-obsolete-skills.test.js` — formal regression test, run by `npm test`

## How to run

```
# spec-local tests
node --test specs/206-consolidate-flow-skills/tests/package-shape.test.js

# formal test (also picked up by npm test)
node --test tests/unit/lib/cleanup-obsolete-skills.test.js
```

## Expected results before implementation

`package-shape.test.js` — **FAIL** (consolidated skill does not yet exist; legacy skills still present; doc templates still reference legacy names).

`cleanup-obsolete-skills.test.js` — **PASS** (this test exercises existing `cleanupObsoleteSkills` behavior with a fixture that mirrors the upgrade scenario; it guards against future regressions of the cleanup mechanism).

## Expected results after implementation

Both test files **PASS**.
