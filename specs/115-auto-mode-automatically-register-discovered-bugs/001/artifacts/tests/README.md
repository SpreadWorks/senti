# Spec 115 Tests

## What was tested and why

Verifies that the expanded `redo-recording.md` partial is correctly included in all three flow skill SKILL.md files after `sdd-forge upgrade`, and that the partial contains the required trigger conditions and examples.

## Where tests are located

`specs/115-auto-mode-automatically-register-discovered-bugs/tests/verify-partial-expansion.js`

## How to run

```bash
# First, run upgrade to expand partials into SKILL.md files
sdd-forge upgrade

# Then run the test
node --test specs/115-auto-mode-automatically-register-discovered-bugs/tests/verify-partial-expansion.js
```

## Expected results

- `redo-recording.md` contains a "When to record" section with at least 6 trigger conditions
- `redo-recording.md` contains an "Examples" subsection with at least 2 concrete command invocations
- All three flow skills (plan, impl, finalize) contain the expanded partial content
- No changes exist in `src/flow/`
