# Tests for 162-improve-choice-format-enforcement

## What was tested and why
- Verified that deployed `sdd-forge.flow-plan` skill content enforces Choice Format for every user question.
- Verified the rule explicitly applies to confirmation questions after user-requested changes.
- Verified the rule explicitly disallows free-form questions with no exceptions.

These checks prevent regression to ambiguous wording such as "as default".

## Test locations
- Formal test (maintained by `npm test`):
  - `tests/unit/lib/skills-include.test.js`
- Spec-local tests:
  - None (this spec uses formal contract tests only).

## How to run
- `npm run test:unit -- tests/unit/lib/skills-include.test.js`
- Or run the whole unit suite: `npm run test:unit`

## Expected results
- The updated assertions in `skills-include.test.js` pass.
- The deployed flow-plan skill text contains strict wording for Choice Format enforcement.
