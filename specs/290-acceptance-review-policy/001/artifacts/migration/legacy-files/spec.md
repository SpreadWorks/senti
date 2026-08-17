# Feature Specification: 290-acceptance-review-policy

**Feature Branch**: `feature/290-acceptance-review-policy`
**Created**: 2026-06-12
**Status**: Draft
**Input**: GitHub Issue #380

## Goal
Add phase/step failurePolicy metadata and an acceptance-review step to the Spec-Driven Development flow so the flow can holistically verify whether the original request was satisfied before final regression.

## Background
The current Spec-Driven Development flow relies on review and gate retry loops to discover and fix issues within phases. That can still miss broad request-level gaps until late. Issue #380 adds acceptance-review as a holistic check after retro and before final-regression, and introduces failurePolicy metadata so retry, record, amend-spec, and block behavior is declared in the flow definition rather than scattered through command-specific assumptions.

## Scope
- Add failurePolicy to the flow node model and to phase/step definitions in src/flow/definition.js.
- Define initial policies: review-family steps retry, gate-family steps block, acceptance-review amend-spec, normal impl-review retry-compatible, and finalize-family behavior preserved.
- Add an acceptance-review leaf after retro and before final-regression, with maxAttempts 1.
- Add next-action, prompt, schema, command, artifact, lifecycle, and transition support needed for acceptance-review.
- Acceptance-review must evaluate original request, spec, goal, implementation diff, test evidence, issue-log, retro, and report context when report.json already exists; missing report.json before finalize must not be a blocker.
- Acceptance-review must write findings and requirementAmendmentProposals as its primary output and map findings to existing requirements when possible.
- Support verdicts pass, amend_required, user_decision_required, and blocked.
- Route amend_required through a spec amendment/retry path using requirementAmendmentProposals without modifying spec.json inside acceptance-review itself.
- Route user_decision_required through amend_and_retry, abort, and accept_risk_and_continue choices, with the choice saved in the artifact.
- Route blocked through repair_and_reevaluate or abort, and never offer accept_risk_and_continue while mechanicalBlockers exist.
- Keep normal impl-review runtime behavior retry-compatible while adding a structure that can represent record policy for later comparative validation.
- Define migration parity for public CLI, next-action, review/gate artifacts, flow state, metrics, hooks, final-regression, and finalize surfaces.

## Out of Scope
- Do not split Issue #380 into multiple specs.
- Do not introduce a roundLimit control term.
- Do not add another acceptance-review after final-regression.
- Do not let the acceptance-review step directly mutate spec.json.
- Do not change normal-flow impl-review to record/no-loop behavior in this initial implementation.
- Do not run or complete the separate comparative-validation research item for review/gate no-loop behavior.
- Do not replace finalize prerequisites or finalize leaf behavior wholesale.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- src/ changes must stay generic and must not include project-specific values, local paths, issue-specific IDs beyond tests/spec artifacts, or environment-specific assumptions.
- Meaningful values such as policies, verdicts, findings, proposals, blockers, and decisions should be represented with classes or existing model patterns when they carry invariants or behavior.
- Acceptance retry control must use existing maxAttempts, retry counter, and attempt terminology; the word roundLimit must not appear as a new control term.
- Acceptance-review must treat tests and evidence as mechanical preconditions and judgment support, not as an independent averaged pass/fail score.
- If src/skills, src/presets, or upgrade-deployed templates are changed, run senti upgrade and preserve the generated upgrade evidence artifact.
- No existing review/gate/test/retro/report artifact meaning may be removed or repurposed; acceptance-review artifacts are additive.
- No accepted risk path may bypass blocked mechanical evidence such as failed tests, missing required artifacts, invalid schemas, or missing required tests.

## Design Principles
- Keep src/flow/definition.js as the single source of truth for flow structure and step metadata.
- Make acceptance-review a holistic goal-satisfaction review, not a requirements-only checklist.
- Separate semantic review from mechanical blocking checks so missing evidence stops before scoring.
- Preserve current-compatible intermediate retry behavior before introducing later no-loop comparative behavior.
- Represent amendment proposals as structured handoff data; apply them in a separate amendment/retry path.

## Overview
### Modules
- src/flow/definition.js owns FlowNode metadata, flow order, maxAttempts, lifecycle resolution, side effects, gate phases, and next-action derivation.
- src/flow/lib/get-next-action.js derives action, instructions, context, output_schema, requires_approval, and maxAttempts for the public next-action envelope.
- src/flow/lib/run-review.js owns current review retry handling and impl-review parsing; this behavior must remain retry-compatible for normal flow.
- New acceptance-review runtime code should live under src/flow/lib or src/flow/commands following existing command/schema/prompt patterns.
- src/flow/lib/flow-judgment-contract.js owns artifact-backed step completion validation and must cover acceptance-review completion.
- specs/290-acceptance-review-policy/tests/ must contain spec-local tests with requirement headers for the new behavior.

### Data Flow
- After impl-gate passes, retro runs and writes its existing artifacts. The new acceptance-review step then reads request/spec/diff/test/issue-log/retro evidence before final-regression, and reads report evidence only if report.json already exists.
- Acceptance-review first checks mechanicalBlockers. If any exist, it returns verdict blocked and records repair target information without semantic score pass-through.
- When semantic review finds reimplementation-valid critical or blocking gaps, acceptance-review writes findings and requirementAmendmentProposals, then routes to spec amendment/retry.
- When semantic review needs a product or scope decision, acceptance-review records userDecision and stops for the explicit user choice before changing spec or proceeding.
- Non-pass choices are handled through acceptanceReview state in flow.json and a dedicated decision command. amend_and_retry resets spec through acceptance-review; repair_and_reevaluate resets from the recorded repair target.
- When verdict pass has no mechanical or hard blockers, final-regression remains the final mechanical project check before finalize leaves.

### Decisions
- [VERIFY] definition.js is the correct owner for failurePolicy and acceptance-review ordering.
- [VERIFY] get-next-action can consume new FlowNode metadata once definition.js exposes it.
- [VERIFY] normal impl-review must keep retry behavior.
- Acceptance-review is placed before final-regression.
- Pass/fail is not an average of scores.
- Migration parity retains existing public surfaces.
- Report context is optional before finalize.
- Acceptance completion requires artifact-backed validation.
- No extra user decision is pending.

## Clarifications (Q&A)
- Q: Does acceptance-review replace impl-review or impl-gate?
  - A: No. impl-review remains retry-compatible in the normal flow, and impl-gate remains the mechanical blocking gate.
- Q: Does acceptance-review directly rewrite spec.json?
  - A: No. It writes findings and requirementAmendmentProposals, then routes amend_required to a separate spec amendment/retry path.
- Q: Is report.json required before acceptance-review can run?
  - A: No. acceptance-review reads reportRefs only when report.json already exists. The existing finalize report remains generated later and must not be moved just to satisfy acceptance-review input.
- Q: Which commands integrate non-pass acceptance-review choices?
  - A: `senti flow run acceptance-review` writes the review result, and `senti flow set acceptance-decision --choice <value>` records user_decision_required or blocked choices and applies the matching reset or continuation semantics.
- Q: Can accept_risk_and_continue be selected when tests or artifacts are missing?
  - A: No. Missing or failed mechanical evidence creates verdict blocked, and blocked exposes only repair_and_reevaluate or abort.
- Q: Is record/no-loop behavior enabled for normal impl-review now?
  - A: No. The initial implementation only adds structure that can represent record policy; normal impl-review remains retry-compatible.

## Alternatives Considered
- Place acceptance-review after final-regression. — Rejected because Issue #380 places acceptance-review before final-regression to catch goal gaps before the costly final mechanical check.
- Convert normal impl-review to record/no-loop behavior immediately. — Rejected because Issue #380 explicitly preserves current-compatible retry behavior and limits record/no-loop behavior to later comparative validation.
- Let acceptance-review directly edit spec.json when it detects gaps. — Rejected because Issue #380 requires acceptance-review to structure findings and proposals, then hand them to a separate amendment retry.
- Use an averaged acceptanceScore as the pass criterion. — Rejected because a high implementationQualityScore or requirementAlignmentScore must not dilute an unmet goal.
- Offer accept_risk_and_continue for blocked mechanical evidence. — Rejected because mechanicalBlockers make the state unevaluable and must be repaired or aborted.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-12T07:14:09.175Z
- Notes:

## Requirements
- R1 [must]: FlowNode must expose failurePolicy metadata whose accepted values include retry, record, amend-spec, and block, and invalid policy values must fail during definition construction or validation.
- R2 [must]: The flow definition must assign initial failurePolicy values: review-family steps retry, gate-family steps block, acceptance-review amend-spec, normal impl-review retry, and other normal steps preserving their existing maxAttempts/retry behavior.
- R3 [must]: The impl branch must contain acceptance-review after retro and before final-regression, and acceptance-review must resolve maxAttempts to 1.
- R4 [must]: senti flow get next-action must preserve existing public snake_case fields for acceptance-review, including output_schema and requires_approval false, and may expose failurePolicy amend-spec only as an additive field.
- R5 [must]: Acceptance-review must write a schema-validated artifact containing goalSatisfactionScore, requirementAlignmentScore, implementationQualityScore, acceptanceScore, thresholds, mechanicalBlockers, hardBlockers, attempt, findings, requirementAmendmentProposals, userDecision, blockedDecision, verdict, and optional reportRefs used only when report.json already exists.
- R6 [must]: Each acceptance-review finding must include findingId, summary, severity, category, mappedRequirementIds, linkedRequirementAmendmentProposalIds, evidenceRefs, confidence, shouldReimplement, reimplementationReason, and requiresUserDecision.
- R7 [must]: Each requirementAmendmentProposal must include proposalId, proposalType, targetRequirementIds, proposedRequirementSummary, reason, relationToOriginalRequest, linkedFindingIds, and shouldReimplementAfterAmendment.
- R8 [must]: Acceptance-review must classify missing tests, failed tests, missing required artifacts, invalid schemas, and missing required tests as mechanicalBlockers that produce verdict blocked before semantic scoring can pass.
- R9 [must]: Verdict pass must require goal satisfaction, zero mechanicalBlockers, and zero hardBlockers; acceptanceScore, requirementAlignmentScore, and implementationQualityScore must not offset an unmet goal.
- R10 [must]: Verdict amend_required from `senti flow run acceptance-review` must record acceptanceReview.verdict and requirementAmendmentProposals in flow state/artifact, reset spec through acceptance-review leaves for amendment retry, skip routine approval unless user_decision_required was recorded, and avoid editing spec.json inside acceptance-review.
- R11 [must]: `senti flow set acceptance-decision --choice amend_and_retry|abort|accept_risk_and_continue` must persist userDecision for verdict user_decision_required; amend_and_retry resets spec through acceptance-review, abort records an aborted acceptanceReview state and does not promote final-regression, and accept_risk_and_continue records issue-log risk then promotes final-regression only when no mechanicalBlockers exist.
- R12 [must]: `senti flow set acceptance-decision --choice repair_and_reevaluate|abort` must persist blockedDecision for verdict blocked; repair_and_reevaluate resets from the recorded repairTargetStep through acceptance-review, abort records an aborted acceptanceReview state, and accept_risk_and_continue must not be accepted.
- R13 [must]: Normal-flow impl-review must keep current-compatible retry behavior while the code structure can represent record policy for later comparative-validation use.
- R14 [must]: Migration parity must preserve existing next-action envelope shape, review/gate artifact meanings, retro artifact meaning, final-regression as the final mechanical check after acceptance-review, finalize leaf order and approval behavior, flow state promotion, retry metrics, plugin hooks, and side effects.
- R15 [must]: Acceptance-review step completion must be guarded by its artifact and verdict/decision state so manual completion or hook promotion cannot advance final-regression when the artifact is missing, blocked, amend_required, or waiting for user decision.
- R16 [must]: The implementation must add spec-local tests under specs/290-acceptance-review-policy/tests/ with // spec: R<N> headers covering R1 through R15, and may update shared tests only where public flow contracts change.

## Acceptance Criteria
- AC1: FlowNode construction or flow definition validation rejects an unknown failurePolicy value.
- AC2: collect/derive helpers can show review-family steps as retry, gate-family steps as block, acceptance-review as amend-spec, and finalization behavior preserved.
- AC3: getFlowBranchLeafIds("impl") places acceptance-review immediately after retro and immediately before final-regression.
- AC4: resolveMaxAttempts for acceptance-review returns 1 in both manual and auto contexts.
- AC5: get-next-action for acceptance-review returns instructions, context, output_schema, requires_approval false, maxAttempts 1, and additive amend-spec policy metadata if exposed by the envelope.
- AC6: A valid acceptance-review artifact with verdict pass and empty mechanicalBlockers/hardBlockers passes schema validation.
- AC7: An acceptance-review artifact missing required finding or requirementAmendmentProposal fields fails schema validation.
- AC8: Mechanical blocker input such as missing test evidence produces verdict blocked before any pass result is accepted.
- AC9: A low goalSatisfactionScore or unmet goal with high secondary scores cannot produce verdict pass.
- AC10: amend_required stores findings and requirementAmendmentProposals in acceptance-review artifact/state, resets spec through acceptance-review leaves for amendment retry, and does not let acceptance-review directly change spec.json.
- AC11: user_decision_required persists the user's selected acceptance-decision choice and routes amend_and_retry, abort, or accept_risk_and_continue according to R11.
- AC12: blocked persists the repair target, accepts only repair_and_reevaluate or abort through the acceptance-decision command, and rejects accept_risk_and_continue.
- AC13: Existing impl-review retry tests still pass, and no normal-flow test expects impl-review to become record/no-loop.
- AC14: Existing final-regression and finalize leaf order tests are updated to account for acceptance-review while preserving final-regression and finalize semantics.
- AC15: flow set step acceptance-review done fails or refuses promotion when required acceptance-review artifact/verdict state is missing, blocked, amend_required, or waiting for user decision.
- AC16: Spec-local tests with requirement headers cover acceptance-review ordering, policy assignment, artifact schema, verdict transitions, completion guard, and migration parity for retained public surfaces.

## Implementation Targets
- src/flow/definition.js
- src/flow/lib/get-next-action.js
- src/flow/lib/run-review.js
- src/flow/lib/run-retro.js
- src/flow/lib/run-final-regression.js
- src/flow/lib/flow-judgment-contract.js
- src/flow/lib/run-reopen-draft.js
- src/flow/prompts/impl/
- src/flow/schemas/
- tests/unit/flow/
- specs/290-acceptance-review-policy/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add failurePolicy model
  - Represent phase and step failure policy in the flow definition while preserving existing retry and maxAttempts behavior.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Insert acceptance-review
  - Add the acceptance-review leaf to the implementation flow after retro and before final-regression.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Define acceptance artifact
  - Create the acceptance-review artifact contract for scores, blockers, findings, amendment proposals, decisions, and verdicts.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Implement verdict routing
  - Route pass, amend_required, user_decision_required, and blocked verdicts through the correct next flow steps and persisted decisions.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Preserve flow parity
  - Prove existing review, gate, retro, final-regression, finalize, artifact, state, metric, hook, and side-effect behavior remains compatible after acceptance-review is inserted.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add spec coverage
  - Add requirement-headered spec-local tests and any needed shared regression updates for the complete Issue #380 behavior.
  - see `tasks/T-6.md` for full spec
