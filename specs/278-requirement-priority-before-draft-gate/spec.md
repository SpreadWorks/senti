# Feature Specification: 278-requirement-priority-before-draft-gate

**Feature Branch**: `feature/278-requirement-priority-before-draft-gate`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #358

## Goal
draft QA 作成時と draft-gate 実行前に requirement priority marker の扱いを明示し、priority 欠落による draft-gate 失敗を防ぐ。

## Background
Issue #358 reports that requirement-like QA entries can be created without `must`, `should`, or `nice-to-have` markers. The draft gate then applies the `prioritize-requirements` guardrail and can fail on a problem that the draft procedure should have prevented. The fix is procedural: teach draft authors to add accepted markers while creating requirement-like draft text, and teach draft-gate operators to scan for missing markers before invoking the gate.

## Scope
- draft QA rules と draft prompt の rendered next-action guidance
- draft-gate 前の priority 欠落 preflight guidance
- accepted priority markers `must`, `should`, `nice-to-have` の明示
- spec-local tests による source prompt と rendered next-action guidance の検証

## Out of Scope
- draft schema に新しい priority field を追加すること
- guardrail article `prioritize-requirements` の評価条件を変更すること
- spec requirements priority schema または spec-gate behavior の変更
- CLI command / option / exit-code contract の変更

## Constraints
- Requirement-like draft text must use existing marker text: `must`, `should`, or `nice-to-have`.
- The fix must not weaken draft-gate guardrail validation or remove the `prioritize-requirements` article from draft evaluation.
- No external dependencies may be added; tests must use Node.js built-ins and existing local helpers.
- `src/skills/` is not in scope unless implementation changes skill source; if skill source changes, `sdd-forge upgrade` must be run.

## Design Principles
- Prevent the failure at the authoring procedure layer instead of loosening gate validation.
- Keep shared QA creation rules in the partial that draft next-action already includes.
- Keep pre-gate checks in the draft-gate prompt so the operator sees them immediately before running the gate command.
- Frame shared QA rule text as authoring and preflight guidance; draft coverage review must not report missing priority markers as unresolved user-decision blockers.

## Overview
### Modules
- `src/flow/prompts/partials/draft-qa-rules.md` defines shared QA creation rules and is included by the draft prompt.
- `src/flow/prompts/plan/draft.md` renders draft-step next-action instructions through the shared QA rules partial.
- `src/flow/prompts/plan/draft-gate.md` defines checks to perform immediately before `sdd-forge flow run gate --phase draft`.
- `src/flow/lib/get-step-instructions.js` resolves prompt includes, so rendered next-action tests can verify partial text appears in step instructions.

### Data Flow
- During draft, next-action renders `plan.draft`, which includes the shared QA rules partial. After draft refinement and coverage review, next-action renders `plan.draft-gate`, where preflight checks are shown before the draft gate command.

### Decisions
- [VERIFY] Checked draft prompt include path: shared QA rules are included by draft next-action guidance.
- [VERIFY] Checked draft-gate prompt ownership: pre-gate instructions live beside the gate command.
- Use marker-based guidance instead of adding draft schema fields.
- Impact on existing features: SDD flow prompt guidance changes; draft schema, guardrail evaluator behavior, CLI command syntax, and spec priority schema remain unchanged.

## Clarifications (Q&A)
- Q: Should draft QA entries get a new `priority` property?
  - A: No. The issue asks for marker procedure, and existing guardrail wording uses textual markers.
- Q: Should draft-gate validation be loosened to ignore missing priorities?
  - A: No. The missing priority must be prevented before the gate instead of bypassing the guardrail.
- Q: Which draft fields are considered requirement-like for the preflight scan?
  - A: Any authored draft text that expresses a required outcome, including QA question/answer/why text, scopeVerification entries, impactOnExisting entries, decisionMap decision points, and openQuestions.
- Q: Should draft coverage review report missing priority markers as blocking user-decision gaps?
  - A: No. Missing priority markers are authoring/preflight issues handled by draft creation guidance, draft-gate preflight, and draft-gate guardrail validation. Coverage review remains limited to unresolved user decisions.

## Alternatives Considered
- Add a new persisted `priority` field to each draft QA entry — Rejected because it changes draft schema and does not match Issue #358's marker-based improvement direction.
- Change the `prioritize-requirements` guardrail to ignore draft QA text — Rejected because the guardrail is correctly identifying unprioritized requirements; the procedure should create prioritized text.
- Only update `draft-gate.md` — Rejected because the issue asks for priority to be mandatory when creating draft QA, so the draft creation guidance must also change.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T14:53:04.867Z
- Notes: Auto-approved after spec-gate PASS with autoApprove enabled.

## Requirements
- R1 [must]: When the draft step renders its QA creation rules, the instructions must state that every requirement-like draft QA, scope, impact, decision, or open-question entry that expresses a requirement uses exactly one accepted priority marker: `must`, `should`, or `nice-to-have`.
- R2 [must]: Before `sdd-forge flow run gate --phase draft`, the draft-gate instructions must require a scan of requirement-like draft fields for entries missing `must`, `should`, or `nice-to-have` markers.
- R3 [should]: The priority guidance must preserve existing validation behavior: it must not add a persisted draft priority field, relax the `prioritize-requirements` guardrail, or change spec requirement priority schema.
- R4 [should]: Spec-local tests under `specs/278-requirement-priority-before-draft-gate/tests/` must verify the source prompt text and rendered `sdd-forge flow get next-action` instructions for R1 and R2.

## Acceptance Criteria
- `src/flow/prompts/partials/draft-qa-rules.md` or the draft prompt text reachable from it names `must`, `should`, and `nice-to-have` as required markers for requirement-like draft entries.
- `src/flow/prompts/plan/draft-gate.md` contains a pre-gate missing-priority check before the `sdd-forge flow run gate --phase draft` instruction.
- `sdd-forge flow get next-action` for the draft step renders the priority marker guidance inherited from the shared QA rules.
- `sdd-forge flow get next-action` for the draft-gate step renders the missing-priority preflight guidance.
- If shared QA rule text is visible to draft coverage review, that text does not instruct coverage review to create blocking findings or repair targets for missing priority markers.
- No implementation diff changes `src/flow/schemas/spec.schema.json`, the draft artifact schema, or guardrail article text for `prioritize-requirements`.

## Implementation Targets
- src/flow/prompts/partials/draft-qa-rules.md
- src/flow/prompts/plan/draft-gate.md
- src/flow/lib/get-step-instructions.js
- specs/278-requirement-priority-before-draft-gate/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add draft priority guidance
  - Update draft and draft-gate guidance so requirement-like draft text receives priority markers during authoring and is checked before the draft gate.
  - see `tasks/T-1.md` for full spec
