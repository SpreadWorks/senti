# Tests for spec 215-remove-merge-strategy-arg

## What is tested

- **R1**: `sdd-forge flow run finalize` no longer accepts `--merge-strategy`.
  - `registry.js` finalize entry lists no such option.
  - `flow run finalize --help` output does not advertise the option.
- **R3**: `finalize.merge-strategy` prompt kind is removed from `get prompt`.
- **R5**: No user-facing skill or prompt template references `--merge-strategy`
  (checks `src/templates/skills/sdd-forge.flow/SKILL.md` and `src/flow/prompts/**`).
- **R6**: `VALID_MERGE_STRATEGIES` constant and every import referencing it are gone from `src/`.

## Where

- `specs/215-remove-merge-strategy-arg/tests/no-merge-strategy-arg.test.js` (spec-specific, not run by `npm test`).
- `tests/unit/flow/get-prompt.test.js` (formal test; the old `finalize.merge-strategy` case
  is replaced with an assertion that the kind is unknown).

## How to run

```bash
# Formal test (runs automatically in npm test):
node --test tests/unit/flow/get-prompt.test.js

# Spec-specific test:
node --test specs/215-remove-merge-strategy-arg/tests/no-merge-strategy-arg.test.js
```

## Expected result

All assertions pass after the spec's implementation is complete.
Before implementation, tests fail because:
- `registry.js` still lists `--merge-strategy`.
- `finalize.merge-strategy` prompt still exists in `get-prompt.js`.
- `SKILL.md` / `finalize.md` still mention the flag.
- `VALID_MERGE_STRATEGIES` is still exported and imported.
