# Feature Specification: 258-draft-review-repair-flow

**Feature Branch**: `feature/258-draft-review-repair-flow`
**Created**: 2026-05-18
**Status**: Draft
**Input**: GitHub Issue #324

## Goal
Separate draft/spec review responsibilities so review records findings, triage decides disposition, repair applies accepted changes, and gates perform mechanical readiness checks. Add the missing draft-side triage/repair path and machine-readable review artifacts without renaming the existing review or gate concepts.

## Background
Issue #324 identifies that draft/spec review currently mixes finding detection, accept/reject decisions, repair, and gate readiness checks. The spec side already has explicit spec-review-triage and spec-repair phases, and gate validates those artifacts. The draft side still performs draft.json repair during review execution, which makes review responsible for both detecting findings and applying changes. This spec extends the existing phase separation to draft review and moves gate-draft toward mechanical artifact validation.

## Scope
- [must] Make review-draft-questions and review-draft-coverage write machine-readable JSON review artifacts without mutating draft.json.
- [must] Add explicit draft-side triage and repair steps for the questions and coverage review stages.
- [must] Move draft repair audit generation from the review command into the draft repair steps.
- [must] Split draft review findings into blocking findings, advisory findings, and repair targets with deterministic routing rules.
- [must] Extend gate-draft to validate draft review, triage, and repair artifact existence, schema shape, source linkage, and item count consistency.
- [must] Update flow definition, next-action instructions, registry post hooks, active-flow migration, and generated flow skill guidance.
- [must] Add tests proving review no longer repairs draft.json, draft triage/repair artifacts are validated, and PASS/ADVISORY/FAIL routing differs.

## Out of Scope
- Renaming the review or gate concepts.
- Creating a generic check framework shared by every phase.
- Changing GitHub Projects workflow or experimental workflow behavior.
- Adding external dependencies.
- Preserving long-term compatibility with old draft review markdown or old draft repair audit formats.

## Constraints
- Use Node.js built-in modules only; do not add dependencies.
- Do not place project-specific values in src/ files, prompts, or templates.
- Represent meaningful structured artifacts with dedicated classes where new production code models values or behavior.
- No new user-facing CLI option is introduced. Existing `sdd-forge flow run review --phase draft` and `sdd-forge flow run gate --phase draft` keep their command syntax.
- Exit-code contract: review/gate commands continue to return ok envelopes with process exit 0 for completed PASS/ADVISORY/FAIL evaluations; invalid input, missing active flow, malformed artifacts, and subprocess errors return fail envelopes with non-zero exit.
- User-facing argument validation remains at existing entry points: `--phase` is an optional string without whitespace or NUL bytes. When omitted, `flow run review` resolves its phase from the active step and `flow run gate` resolves its phase from the active gate step. When provided, review allowed values are draft, spec, and test; gate allowed values are draft, spec, task-spec, task-impl, and integration. New draft triage/repair steps are internal flow step ids, not CLI arguments.
- When changing src/templates/skills/sdd-forge.flow/SKILL.md or flow prompt templates, run sdd-forge upgrade so generated .agents/.claude skill files are refreshed.
- spec-test-coverage is acknowledged because the required behavior coverage lives in specs/258-draft-review-repair-flow/tests/, while the touched tests/unit files are existing regression tests that must be updated so the repository's default npm test suite remains consistent with the new flow step order and routing contracts.

## Design Principles
- Make each phase own one responsibility: review detects, triage classifies, repair mutates, gate verifies readiness.
- Use JSON artifacts as the contract between phases so gates and tests can validate behavior without parsing prose.
- Mirror the existing spec-review-triage/spec-repair pattern for draft review where practical, while preserving the two draft review stages.
- Keep migration bounded to active flow state and artifact references needed for the new flow shape; do not keep legacy fallback paths.

## Overview
### Modules
- src/flow/definition.js — add draft question/coverage triage and repair leaves after each draft review leaf.
- src/flow/commands/review.js and src/flow/lib/run-review.js — change draft review to write JSON findings and stop mutating draft.json.
- src/flow/lib/run-gate.js — validate draft review, triage, and repair artifact contracts during gate-draft.
- src/flow/lib/get-step-instructions.js and src/flow/prompts/plan/*.md — add instructions for draft triage/repair leaves and revise review/gate prompts.
- src/templates/skills/rules.json — add new draft triage/repair step ids to the same persistent rule coverage as adjacent plan steps.
- src/flow/registry.js — update review post hooks and step post hooks so draft routing matches PASS/ADVISORY/FAIL and repair completion.
- src/templates/skills/sdd-forge.flow/SKILL.md and generated skill copies — document the new draft triage/repair responsibilities.
- specs/258-draft-review-repair-flow/tests/ — spec-local tests for artifact contracts, routing, and non-mutation behavior.

### Data Flow
- draft.json → review-draft-questions → draft-review-questions.json; review does not edit draft.json.
- draft-review-questions.json → draft-questions-triage.json → draft-questions-repair.json; repair applies accepted structural fixes before draft-refine.
- draft-refine → review-draft-coverage → draft-review-coverage.json; review records coverage findings without editing draft.json.
- draft-review-coverage.json → draft-coverage-triage.json → draft-coverage-repair.json; repair applies accepted coverage fixes before gate-draft.
- When coverage review has no unresolved blocking findings, draft-coverage-repair sets draft.json approval.approved and confirmedAt before gate-draft. Empty PASS paths still write an empty repair audit before approving.
- gate-draft reads draft.json and the draft review/triage/repair artifacts, then validates schema, sourceReview links, item counts, and unresolved blocking state.

### Decisions
- [VERIFY] Current draft review mutates draft.json and writes repair audit inside review execution.
- [VERIFY] Current flow has draft review leaves but no draft-side triage/repair leaves.
- [VERIFY] Spec repair validation already provides the artifact consistency model to mirror.
- Draft review JSON is the source of truth; markdown reports may remain only as human-readable summaries.
- Use separate question-stage and coverage-stage triage/repair leaves because the existing draft flow has two distinct review points.
- Migration replaces old draft review markdown/repair audit references with new JSON review/triage/repair references and does not keep old-format fallback behavior.
- Draft triage decisions are apply, invalid, already_resolved, downgraded_to_non_blocking, and requires_user_decision.
- New draft leaf ids are draft-questions-triage, draft-questions-repair, draft-coverage-triage, and draft-coverage-repair.

## Clarifications (Q&A)
- Q: Are review and gate renamed?
  - A: No. The concepts and public wording remain review and gate. This spec changes responsibilities and artifacts, not the names.
- Q: Does this add a generic review framework?
  - A: No. The implementation may share small helpers between draft and spec artifact validation, but the scope is limited to draft/spec review responsibility separation.
- Q: Does this add a new user-facing CLI option?
  - A: No. Existing review and gate phase options remain the user-facing entry points. New draft triage/repair ids are internal flow steps.
- Q: How are old draft review markdown artifacts handled?
  - A: They are not a compatibility contract. Migration updates active flow references to the new JSON artifacts and does not add old-format fallback logic.
- Q: Which step owns draft approval after review no longer mutates draft.json?
  - A: draft-coverage-repair owns approval. It writes an empty repair audit and sets approval on a PASS/no-repair path, and sets approval after applying coverage repair when no requires_user_decision item remains.
- Q: What are the exact new draft step ids?
  - A: The new internal step ids are draft-questions-triage, draft-questions-repair, draft-coverage-triage, and draft-coverage-repair.

## Alternatives Considered
- Keep repair inside draft review and only add clearer logs — Rejected because Issue #324 requires review to record findings and moves accept/reject plus repair into explicit phases.
- Add one generic draft-review-triage/draft-repair pair after both draft reviews — Rejected because the existing draft flow has two review points with different consumers; question-stage repair must happen before draft-refine, while coverage-stage repair must happen before gate-draft.
- Parse markdown review reports in gate-draft — Rejected because Issue #324 requires machine-readable JSON artifacts and gate readiness checks should not depend on prose parsing.
- Build a generic check framework for all phases — Rejected because Issue #324 explicitly excludes generic check framework work.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-16T12:45:52.538Z
- Notes: autoApprove: approved gate-passed spec for Issue #324

## Requirements
- R1 [must]: Draft review execution shall not write draft.json or draft repair audit files. `review-draft-questions` and `review-draft-coverage` shall write a JSON review artifact for their stage. If a markdown summary is kept, no downstream command shall read it for machine decisions.
- R2 [must]: Each draft review JSON artifact shall include version, phase, sourceDraft, generatedAt, verdict, summary, blockingFindings[], advisoryFindings[], and repairTargets[]. Each of those arrays shall contain at most 20 items. Each finding/target shall include title, target, rationale, evidence, and classification. classification shall be exactly one of blocking, advisory, or repair_target and shall match the array that contains the item.
- R3 [must]: The plan flow shall include explicit draft question triage/repair leaves between review-draft-questions and draft-refine, and explicit draft coverage triage/repair leaves between review-draft-coverage and gate-draft.
- R4 [must]: Draft triage artifacts shall include version, phase, sourceReview, summary, and items[]. items[] shall contain at most 40 entries. Each item shall correspond to a blocking finding or repair target from the source review artifact and record title, target, decision, rationale, and evidence. Allowed decisions are apply, invalid, already_resolved, downgraded_to_non_blocking, and requires_user_decision.
- R5 [must]: Draft repair artifacts shall include version, phase, sourceTriage, summary, and items[]. items[] shall contain at most 40 entries. Each item shall correspond to a triage item with decision apply and record title, target, rationale, evidence, and changed draft.json field paths. If coverage repair has no unresolved requires_user_decision item, it shall set draft.json approval.approved to true and confirmedAt to the repair time before gate-draft.
- R6 [must]: Draft repair steps shall be the only draft review path that mutates draft.json after a draft review finding. Review and triage steps shall not mutate draft.json.
- R7 [must]: Draft review routing shall distinguish PASS, ADVISORY, and FAIL: PASS has no blocking findings and no repair targets; ADVISORY has advisory findings or repair targets that can proceed through triage/repair; FAIL has at least one blocking finding. Triage decision apply requires a repair item, invalid/already_resolved/downgraded_to_non_blocking resolves the item without repair, and requires_user_decision leaves gate-draft blocked until draft QA is reopened or answered.
- R8 [must]: gate-draft shall validate draft review, triage, and repair artifact JSON shape, phase/source links, item count consistency, allowed decisions, unresolved requires_user_decision items, and draft approval after coverage repair. It shall fail when a required artifact is missing or inconsistent.
- R9 [must]: Active-flow migration shall insert draft-questions-triage, draft-questions-repair, draft-coverage-triage, and draft-coverage-repair leaves when missing. Consumer mapping is draft-questions-triage -> draft-questions-repair, draft-questions-repair -> draft-refine, draft-coverage-triage -> draft-coverage-repair, and draft-coverage-repair -> gate-draft. If a mapped consumer step is already done or in_progress, the inserted leaf shall be marked done and an empty JSON artifact shall be generated when gate-draft would validate it; otherwise the inserted leaf shall be pending. Migration shall update old draft review artifact references to the new JSON names and shall not preserve old markdown-only fallback behavior.
- R10 [must]: next-action instructions, registry hooks, flow prompts, and generated flow skill guidance shall describe review as detection only, triage as disposition, repair as mutation/audit, and gate as mechanical readiness validation.
- R11 [must]: Spec-local tests shall cover draft review non-mutation, draft triage/repair artifact shape, gate-draft artifact validation failures, and PASS/ADVISORY/FAIL routing through the new draft steps.

## Acceptance Criteria
- A spec-local test proves `sdd-forge flow run review --phase draft` for draft questions writes a JSON review artifact and leaves draft.json byte-for-byte unchanged.
- A spec-local test proves draft question triage and repair write their audit artifacts and only the repair step changes draft.json.
- A spec-local test proves draft coverage triage and repair write their audit artifacts and only the repair step changes draft.json.
- A spec-local test proves draft-coverage-repair sets draft.json approval before gate-draft on PASS/no-repair and repaired ADVISORY paths.
- A gate-draft test fails when a draft review artifact references a missing triage or repair artifact required by a non-PASS review verdict.
- A gate-draft test fails when triage item counts or repair item counts do not match the source review/triage artifacts.
- A gate-draft test fails when any triage item has decision requires_user_decision.
- A migration test proves inserted draft triage/repair leaves are done with empty JSON artifacts when their following consumer step is already in_progress or done, and pending otherwise.
- A routing test shows PASS skips or completes empty triage/repair artifacts, ADVISORY proceeds through triage/repair without blocking, and FAIL leaves a blocking state that gate-draft reports.
- Existing spec-review-triage and spec-repair behavior remains covered by existing tests or by a non-regression assertion.
- `src/templates/skills/sdd-forge.flow/SKILL.md` changes are followed by `sdd-forge upgrade`, and generated `.agents` / `.claude` skill files reflect the new draft triage/repair guidance.
- npm test passes.

## Implementation Targets
- src/flow/definition.js
- src/flow/commands/review.js
- src/flow/lib/run-review.js
- src/flow/lib/run-gate.js
- src/flow/lib/get-step-instructions.js
- src/flow/registry.js
- src/flow/prompts/plan
- src/templates/skills/rules.json
- src/templates/skills/sdd-forge.flow/SKILL.md
- specs/258-draft-review-repair-flow/tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Model draft artifacts
  - Define draft review, draft triage, and draft repair JSON artifact contracts with validation helpers and dedicated value classes where production code represents artifact behavior.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add draft steps
  - Add draft question triage/repair and draft coverage triage/repair leaves to the flow definition, next-action prompts, and registry routing.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Stop review mutation
  - Change draft review execution so it records findings in JSON artifacts and never writes draft.json or repair audit artifacts.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Implement draft repair
  - Implement triage and repair execution for draft review findings, including repair audit writing and draft.json mutation only during repair leaves.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Validate draft readiness
  - Extend gate-draft so it validates draft review, triage, and repair artifacts as mechanical readiness checks.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Update guidance
  - Update flow prompts and generated skill guidance so agents follow the new review/triage/repair/gate responsibility split.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Cover draft flow
  - Add spec-local regression tests for the new draft review, triage, repair, gate, and routing behavior.
  - see `tasks/T-7.md` for full spec
