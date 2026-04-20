# spec 199 spec-scoped tests

## What is tested

- **skill-has-addition-task-step.test.js**: Verifies REQ-P3 by static-checking that `src/templates/skills/sdd-forge.flow-impl/SKILL.md` contains an addition-task detection step in the Required Sequence and invokes `sdd-forge flow run draft-task --task-id <id>`.

## Location rationale

This test only verifies this spec's specific addition to SKILL.md. It is not a general contract check, so it lives here (not in `tests/`) and is not run by `npm test`.

## How to run

```
node --test specs/199-draft-task-production-wiring/tests/
```

## Expected result

- Initially FAILS (before implementation) because the SKILL.md Required Sequence does not yet contain the addition-task step.
- After implementation: PASSES.

## Related formal tests (run by `npm test`)

- `tests/unit/flow/flow-run-draft-task-prompt.test.js` — REQ-P4: `buildDraftPrompt` export + reasons injection contract.
- `tests/unit/flow/flow-run-draft-task-reasons-feedback.test.js` — REQ-P2: retry loop propagates FAIL reasons into the next prompt.
- `tests/unit/lib/agent-service.test.js` — REQ-P5: `agent.resolve("flow.draft-task")` falls back to `agent.default`.
- `tests/unit/flow/flow-run-draft-task.test.js` — pre-existing REQ-P3-1..5 (spec 198 scaffold), kept green by this change.
