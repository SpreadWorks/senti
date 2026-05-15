# Test Design

### Test Design

- **TC-1: Pre-spec plan reopen succeeds with empty tasks**
  - Type: integration
  - Input: Active plan flow before spec writing, `flow.json.tasks[] = []`, run `sdd-forge flow run reopen-draft --reason "missing decision"`
  - Expected: Command succeeds; does not return `NO_TASKS` or `NO_DONE_TASK`; `draft` becomes `in_progress`; required downstream steps become `pending`.

- **TC-2: Pre-spec plan reopen succeeds with tasks but none done**
  - Type: integration
  - Input: Active flow before implementation, tasks exist but all are non-done, run reopen with non-empty reason.
  - Expected: Command succeeds; no done-task precondition is enforced; plan matrix reset matches R2.

- **TC-3: Post-approval pre-implementation reopen succeeds with no done tasks**
  - Type: integration
  - Input: Flow has passed approval but implementation tasks have not started; no task is done; run reopen-draft.
  - Expected: Command succeeds; no `NO_DONE_TASK`; `draft` is `in_progress`; all R2 steps are reset to `pending`.

- **TC-4: Full plan matrix reset for pre-spec reopen**
  - Type: unit
  - Input: Flow step statuses contain mixed `done`, `in_progress`, and `pending` values before implementation.
  - Expected: `draft = in_progress`; `review-draft-questions`, `draft-refine`, `review-draft-coverage`, `gate-draft`, `spec`, `review-spec`, `spec-repair`, `gate`, `approval`, `test`, and `review-test` are exactly `pending`.

- **TC-5: Full plan matrix reset for post-approval reopen**
  - Type: unit
  - Input: Approved flow with spec/test/review steps previously completed.
  - Expected: Same R2 reset is applied; no implementation-specific task-addition behavior is used.

- **TC-6: Plan reopen preserves spec artifacts**
  - Type: integration
  - Input: Pre-implementation flow containing `spec.json`, `spec.md`, `draft.json`, `issue.md`, review reports, and test design files; run reopen-draft.
  - Expected: All existing artifacts remain present and unchanged unless explicitly expected metadata is updated elsewhere.

- **TC-7: Plan reopen records stale planning artifacts**
  - Type: integration
  - Input: Pre-implementation reopen with existing planning artifacts.
  - Expected: `issue-log.json` records that planning artifacts became stale because draft was reopened.

- **TC-8: Successful reopen records non-empty reason**
  - Type: unit
  - Input: Any successful reopen with `--reason "Need missing user decision"`.
  - Expected: `issue-log.json` includes the exact provided reason text.

- **TC-9: Successful reopen handles empty reason**
  - Type: unit
  - Input: Successful reopen with empty or omitted reason, if CLI permits it.
  - Expected: Command succeeds only if allowed by CLI validation; issue log does not invent reason text, but still records command context and resolution summary.

- **TC-10: Successful reopen records trigger command context**
  - Type: integration
  - Input: Run `sdd-forge flow run reopen-draft --reason "x"` from CLI.
  - Expected: `issue-log.json` includes trigger context identifying reopen-draft command execution and relevant command metadata.

- **TC-11: Resolution summary distinguishes pre-implementation regression**
  - Type: unit
  - Input: Successful pre-implementation plan reopen.
  - Expected: `issue-log.json` resolution summary clearly identifies draft regression / stale planning artifacts, not implementation task addition.

- **TC-12: Resolution summary distinguishes implementation task addition**
  - Type: unit
  - Input: Successful implementation-phase reopen with at least one done task.
  - Expected: `issue-log.json` resolution summary identifies implementation-phase task addition, not full plan reset.

- **TC-13: Implementation-phase reopen fails without done task**
  - Type: integration
  - Input: Flow is in implementation phase or later; tasks exist but none are done; run reopen-draft.
  - Expected: Command fails with `NO_DONE_TASK`; no plan matrix reset is applied.

- **TC-14: Implementation-phase reopen fails with empty tasks**
  - Type: integration
  - Input: Flow is in implementation phase or later; `flow.json.tasks[] = []`; run reopen-draft.
  - Expected: Command fails with `NO_DONE_TASK` or existing documented implementation-phase task precondition error; must not use pre-implementation success path.

- **TC-15: Implementation-phase reopen succeeds with one done task**
  - Type: integration
  - Input: Flow is in implementation phase; at least one task is done; run reopen-draft with reason.
  - Expected: Command succeeds; draft is reopened for task additions; full R2 plan matrix reset is not applied.

- **TC-16: Implementation-phase successful reopen preserves unrelated step statuses**
  - Type: unit
  - Input: Implementation-phase flow with done task and mixed step statuses.
  - Expected: Only statuses required for task-addition reopen change; full pre-implementation reset does not occur.

- **TC-17: Boundary transition immediately before first implementation task**
  - Type: integration
  - Input: Flow is approved/test-reviewed but no implementation task has executed.
  - Expected: Treated as pre-implementation; succeeds without done task and applies R2 reset.

- **TC-18: Boundary transition immediately after first done implementation task**
  - Type: integration
  - Input: Flow has exactly one done implementation task.
  - Expected: Treated as implementation-phase; done-task reopen succeeds without full plan matrix reset.

- **TC-19: Spec prompt instructs reopen-draft for missing draft QA decision**
  - Type: unit
  - Input: Read `src/flow/prompts/plan/spec.md`.
  - Expected: Prompt instructs agents to run `sdd-forge flow run reopen-draft --reason "<reason>"` when spec writing discovers a missing user decision that belongs in draft QA.

- **TC-20: Spec prompt preserves Choice Format exception**
  - Type: unit
  - Input: Read `src/flow/prompts/plan/spec.md`.
  - Expected: Prompt preserves exception for command failure or recovery choices that still require Choice Format handling.

- **TC-21: Source skill documents phase-aware reopen-draft**
  - Type: unit
  - Input: Read `src/templates/skills/sdd-forge.flow/SKILL.md`.
  - Expected: Skill explains that pre-implementation plan reopen does not require a done task and resets the plan matrix.

- **TC-22: Source skill documents implementation-phase done-task requirement**
  - Type: unit
  - Input: Read `src/templates/skills/sdd-forge.flow/SKILL.md`.
  - Expected: Skill explains implementation-phase task additions still require at least one done task.

- **TC-23: Generated skill copy matches reopen-draft guidance**
  - Type: integration
  - Input: Run template generation or `sdd-forge upgrade`, then inspect generated `sdd-forge.flow` skill copy.
  - Expected: Generated copy contains the same phase-aware reopen-draft guidance as the source template.

- **TC-24: Acceptance coverage for required reopen phases**
  - Type: acceptance
  - Input: End-to-end scenarios for pre-spec, post-approval, and implementation-phase reopen.
  - Expected: All required paths behave correctly: status changes, issue-log reason/stale recording, artifact preservation, `NO_DONE_TASK` non-regression, and successful done-task reopen.
