# Feature Specification: 277-approval-before-draft-gate

**Feature Branch**: `feature/277-approval-before-draft-gate`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #357

## Goal
draft-gate 前に draft approval metadata の設定確認が明示され、QA 解決後の不要な gate 失敗を防ぐ。

## Background
Issue #357 reports that draft-gate can fail after QA entries are resolved because `draft.json.approval.approved` remains false. The source validation already requires draft approval, and the repair path already documents approval setup. The missing behavior is a clear pre-gate instruction for the normal PASS path so draft-gate is run only after approval metadata has been explicitly set or confirmed.

Impact on existing features: this change affects SDD flow prompt guidance only. Existing draft lifecycle validation, draft schema, generated skill dispatcher behavior, and spec approval metadata behavior remain unchanged.

## Scope
- draft-gate 前後の flow step guidance
- approval metadata setup/check を明示する prompt または skill source
- draft-gate next-action guidance の runtime 表示確認
- approval metadata guidance と draft-gate validation contract を固定する spec-local tests

## Out of Scope
- draft-gate の approval validation を緩めること
- 未解決 user decision がある draft を自動承認すること
- draft lifecycle schema または approval data shape の変更
- spec approval step の user_approval metadata 変更

## Constraints
- `DraftApproval.validate()` の approval.approved 必須契約は維持する。
- `src/skills/` の skill source を変更した場合のみ `sdd-forge upgrade` を実行し、生成済み skill artifacts に反映する。
- 未解決の user decision が残る draft を自動承認する手順は追加しない。approval metadata を設定するのは unresolved decision がない場合に限定する。

## Design Principles
- Fix the procedure that prepares draft-gate inputs rather than weakening draft-gate validation.
- Keep the guidance close to the step that runs draft-gate so users see the required setup immediately before the gate command.

## Overview
### Modules
- `src/flow/prompts/plan/draft-gate.md` owns the per-step instructions shown immediately before running the draft gate.
- `src/flow/prompts/plan/draft-coverage-review.md` describes the PASS path from coverage review into draft-gate.
- `src/flow/prompts/plan/draft-coverage-repair.md` already owns approval metadata setup for the repair path.
- `src/flow/lib/draft-lifecycle.js` validates draft approval and rejects draft artifacts whose approval.approved is not true.

### Data Flow
- After draft-refine resolves QA, draft coverage review writes detection artifacts. If no unresolved user decision remains, the flow proceeds toward draft-gate, where draft lifecycle validation checks approval metadata before spec writing.

### Decisions
- [VERIFY] Checked draft approval validation: draft-gate still requires approval.approved.
- [VERIFY] Checked existing repair path: approval metadata is already set after draft coverage repair when no unresolved user decision remains.
- Add missing guidance to the pre-gate procedure rather than changing validation.
- [VERIFY] Checked dispatcher architecture: generated skill artifacts do not inline draft-gate prompt text.
- Impact on existing features: only SDD flow prompt guidance changes; draft schema, approval validation, generated skill dispatcher behavior, and spec approval metadata behavior remain unchanged.

## Clarifications (Q&A)
- Q: Should the fix change draft-gate validation so approval is optional?
  - A: No. The issue is the missing setup instruction before draft-gate, and validation remains the source of truth.
- Q: Should a draft with unresolved user decisions be auto-approved?
  - A: No. Approval metadata setup is allowed only after unresolved user decisions are absent.
- Q: Should generated skill artifacts be updated?
  - A: Only when `src/skills/` source changes. Draft-gate per-step guidance is loaded from `src/flow/prompts/plan/draft-gate.md`, so generated skill artifacts are not the runtime location for this prompt text.

## Alternatives Considered
- Loosen `DraftApproval.validate()` so draft-gate passes without approval metadata — Rejected because this bypasses the gate contract and can let unapproved drafts proceed to spec writing.
- Update only `draft-coverage-repair.md` — Rejected because that path already documents approval setup; the reported gap is the pre-gate procedure visible before `draft-gate`, including the PASS path.
- Require `.agents/skills/sdd-forge.flow/SKILL.md` to contain the draft-gate approval setup text — Rejected because generated `sdd-forge.flow` remains a dispatcher; per-step instructions are loaded by next-action from prompt files, so that artifact is not the correct runtime target.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T14:16:46.325Z
- Notes: User selected option 1 to approve the gate-passed spec.

## Requirements
- R1 [must]: `draft-gate` step guidance must instruct the operator to confirm `draft.json.approval.approved` is true and `approval.confirmedAt` is set before running `sdd-forge flow run gate --phase draft` when no unresolved user decision remains.
- R2 [must]: The guidance must preserve the existing validation contract: it must not tell users to bypass `DraftApproval.validate()`, loosen draft-gate approval checks, or approve a draft while a `requires_user_decision` item remains unresolved.
- R3 [must]: The corrected pre-draft-gate approval setup guidance must be verifiable through `src/flow/prompts/plan/draft-gate.md` and the `sdd-forge flow get next-action` instructions for the `draft-gate` step.

## Acceptance Criteria
- `src/flow/prompts/plan/draft-gate.md` contains a pre-gate approval setup/check instruction that names `approval.approved`, `approval.confirmedAt`, and `sdd-forge flow run gate --phase draft`.
- The guidance explicitly limits automatic approval metadata setup to the case where no unresolved user decision remains.
- The implementation does not modify `src/flow/lib/draft-lifecycle.js` to weaken approval validation.
- `sdd-forge flow get next-action` for the `draft-gate` step includes the corrected approval setup guidance rendered from the prompt source.
- Spec-local tests verify the guidance text and verify that draft lifecycle validation still rejects an unapproved draft while accepting an approved draft.

## Implementation Targets
- src/flow/prompts/plan/draft-gate.md
- src/flow/lib/get-step-instructions.js
- specs/277-approval-before-draft-gate/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add approval setup guidance
  - Update the draft-gate procedure so it explicitly tells operators to set or confirm draft approval metadata before running the gate when no unresolved user decision remains.
  - see `tasks/T-1.md` for full spec
