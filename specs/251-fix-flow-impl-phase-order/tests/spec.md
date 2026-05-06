# Test Design

### Test Design

- **TC-1: FLOW_DEFINITION impl children order is exact**
  - Type: unit
  - Input: Load `FLOW_DEFINITION`, locate impl branch children.
  - Expected: child ids equal exactly `["implement", "review", "gate-impl", "finalize"]`.

- **TC-2: Impl node attributes are unchanged after reorder**
  - Type: unit
  - Input: Inspect `implement`, `review`, `gate-impl`, and `finalize` nodes.
  - Expected: only array position changes; `id`, `label`, `action`, `instructionsKey`, `contextKinds`, `outputSchemaRef`, `maxAttempts`, `sideEffects`, and `gatePhase` remain unchanged except R9 gate phase reorder.

- **TC-3: FLOW gate-impl gatePhase order**
  - Type: unit
  - Input: Load FLOW `gate-impl` node.
  - Expected: `gatePhase` equals exactly `["integration", "task-impl"]`.

- **TC-4: Flow-level gate-impl phase inference**
  - Type: unit
  - Input: Resolve phase for flow-level step `gate-impl` without explicit `--phase`.
  - Expected: phase resolves to `"integration"`.

- **TC-5: Task-level gate-impl phase inference**
  - Type: unit
  - Input: Resolve phase for task-level step `gate-impl` without explicit `--phase`.
  - Expected: phase resolves to `"task-impl"`.

- **TC-6: Implement done advances to review**
  - Type: unit
  - Input: Flow state where impl branch `implement` is done and `review` is not done; call CLI envelope or `GetNextActionCommand.execute`.
  - Expected: next action is `review`.

- **TC-7: Review done advances to gate-impl**
  - Type: unit
  - Input: Flow state where `implement` and `review` are done, `gate-impl` is not done.
  - Expected: next action is `gate-impl`.

- **TC-8: Gate-impl done advances to finalize-commit**
  - Type: unit
  - Input: Flow state where `implement`, `review`, and `gate-impl` are done.
  - Expected: next action is `finalize-commit`.

- **TC-9: Review runner returns gate-impl next step**
  - Type: unit
  - Input: Execute or isolate impl review success result from `run-review.js`.
  - Expected: envelope/result contains `next: "gate-impl"`.

- **TC-10: Task-impl gate PASS completes task step**
  - Type: unit
  - Input: Gate PASS result with phase `"task-impl"`.
  - Expected: PASS_NEXT resolves to `null`; task is treated as complete, not advanced to `review`.

- **TC-11: Integration gate PASS advances to finalize-commit**
  - Type: unit
  - Input: Gate PASS result with phase `"integration"`.
  - Expected: envelope/result contains `next: "finalize-commit"`.

- **TC-12: Flow-level gate-impl auto phase e2e**
  - Type: integration
  - Input: Run `sdd-forge flow run gate` for flow-level `gate-impl` without `--phase`, with a PASS gate result.
  - Expected: command runs integration phase and returns envelope `next: "finalize-commit"`.

- **TC-13: Task-level gate-impl auto phase integration**
  - Type: integration
  - Input: Run task-scoped `gate-impl` without `--phase`, with a PASS gate result.
  - Expected: command runs task-impl phase and does not advance to flow finalize.

- **TC-14: Explicit phase still works**
  - Type: integration
  - Input: Run `sdd-forge flow run gate --phase integration` at flow-level `gate-impl`.
  - Expected: explicit phase is honored and PASS returns `next: "finalize-commit"`.

- **TC-15: Invalid phase is rejected**
  - Type: unit
  - Input: Run or validate `flow run gate --phase impl`.
  - Expected: command rejects the phase because valid phases are `draft`, `spec`, `task-spec`, `task-impl`, `integration`.

- **TC-16: Prompt no longer hardcodes task-impl phase**
  - Type: unit
  - Input: Read `src/flow/prompts/impl/gate-impl.md`.
  - Expected: contains `sdd-forge flow run gate` without fixed `--phase task-impl`.

- **TC-17: Implement prompt test-only autoApprove wording matches new order**
  - Type: unit
  - Input: Read `src/flow/prompts/impl/implement.md`.
  - Expected: no stale `Skip to step 3 (review)` wording; review is described consistently as the second impl-phase step.

- **TC-18: Task review prompt points to gate-impl**
  - Type: unit
  - Input: Read `src/flow/prompts/task/review.md`.
  - Expected: says next-action CLI advances to `gate-impl`, not `task.update-overview`.

- **TC-19: Flow skill description uses new order**
  - Type: unit
  - Input: Read `src/templates/skills/sdd-forge.flow/SKILL.md` frontmatter.
  - Expected: description contains `implementation (code → review → gate)` and does not contain old `code → gate → review`.

- **TC-20: Flow skill hard stop wording removes old workaround**
  - Type: unit
  - Input: Read `src/templates/skills/sdd-forge.flow/SKILL.md` Hard Stops.
  - Expected: contains `Do not finalize before the impl-phase gate has PASSed.` and does not mention re-PASS after review auto-corrections.

- **TC-21: Gate help text matches valid phases**
  - Type: unit
  - Input: Inspect `src/flow/registry.js` help text for `flow run gate`.
  - Expected: help lists `<draft|spec|task-spec|task-impl|integration>` and documents default as auto-resolve.

- **TC-22: Skill commands reference lists valid phases**
  - Type: unit
  - Input: Read Commands reference in flow skill template.
  - Expected: command shows `sdd-forge flow run gate [--phase <draft|spec|task-spec|task-impl|integration>]`.

- **TC-23: Generated skills are synchronized**
  - Type: integration
  - Input: After `sdd-forge upgrade`, compare `.claude/skills/sdd-forge.flow/SKILL.md` and `.agents/skills/sdd-forge.flow/SKILL.md` with template-relevant content.
  - Expected: both generated skill files contain the updated description, hard stop, and command reference.

- **TC-24: Existing e2e literals use new order**
  - Type: unit
  - Input: Search target tests for old literal order `"implement", "gate-impl", "review"`.
  - Expected: no old-order literals remain; expected order is `"implement", "review", "gate-impl"`.

- **TC-25: Full impl phase acceptance path**
  - Type: acceptance
  - Input: Execute a representative flow from implementation through review, gate PASS, and finalize.
  - Expected: user-visible progression is `implement → review → gate-impl → finalize-commit`; no finalize action appears before gate PASS.

- **TC-26: Gate failure does not finalize**
  - Type: acceptance
  - Input: Run flow-level `gate-impl` with a failing integration gate result.
  - Expected: no `finalize-commit` next action is returned; flow remains blocked at gate remediation.

- **TC-27: Review corrections still require gate before finalize**
  - Type: acceptance
  - Input: Complete `review` with corrections applied, then request next action.
  - Expected: next action is `gate-impl`; finalize is unavailable until gate PASS.
