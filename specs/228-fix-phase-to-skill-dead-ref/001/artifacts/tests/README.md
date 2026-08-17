# Tests: 228-fix-phase-to-skill-dead-ref

## What was tested

phaseToSkill() mapping returns current skill names instead of removed ones.

## Location

`specs/228-fix-phase-to-skill-dead-ref/tests/phase-to-skill.test.js`

## How to run

```bash
node --test specs/228-fix-phase-to-skill-dead-ref/tests/phase-to-skill.test.js
```

## Expected results

All 5 tests pass after the mapping fix is applied.
