# Tests for spec 217-finalize-report-wiring

## What is tested

- REQ-1: `src/templates/skills/sdd-forge.flow/SKILL.md` carries a MUST-level instruction to run `sdd-forge flow report show` after finalize, anchored to the Worktree boundary section.
- REQ-2: On finalize success (`result === "ok"`, `dryRun === false`), the success envelope's `data.nextCommand` equals the literal string `"sdd-forge flow report show"`.
- REQ-3: On `preflight_failed` / `merge_failed` / dry-run envelopes, `data.nextCommand` is absent.

## Where tests live

Formal tests (run by `npm test`):

- `tests/unit/flow/run-finalize-next-command.test.js` — REQ-2, REQ-3
- `tests/unit/flow/skill-report-show-wiring.test.js` — REQ-1

Both are placed under `tests/` (not `specs/<spec>/tests/`) because their breakage always signals a regression of the finalize → Report display wiring contract, regardless of which spec introduces the change.

## How to run

```bash
node --test tests/unit/flow/run-finalize-next-command.test.js
node --test tests/unit/flow/skill-report-show-wiring.test.js
```

Or via the full suite:

```bash
npm test
```

## Expected results

- Before implementation: both test files FAIL (the source has no `nextCommand` field; SKILL.md has no report-show mention).
- After implementation: both test files PASS; `npm test` stays green.
