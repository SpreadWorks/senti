# Feature Specification: 318-impl-repair-acceptance

**Feature Branch**: `feature/318-impl-repair-acceptance`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #413

## Goal
Close the SDD implementation repair through semantic acceptance lifecycle so every repair re-enters test-execute, downstream evidence is accepted only for the current repair fingerprint, and acceptance judges every requirement before final regression.

## Background
Issue #413 closes two coupled correctness gaps. Implementation review currently resets downstream leaves and deletes selected files when proposals exist, but the flow has no explicit triage/repair lifecycle or domain evidence tying regenerated artifacts to repaired inputs. Acceptance-review currently validates mechanical artifact presence and aggregate scores, but it does not judge the original request, each requirement, the resulting diff, repair audit, and test evidence as one semantic chain. The result is that stale evidence can survive or be reconstructed without a recorded cause, and aggregate acceptance can pass without proving each requirement.

## Scope
- Add impl-triage and impl-repair flow leaves and lifecycle routing for implementation-review and acceptance-review findings.
- Return every completed implementation repair to test-execute before test-result-review, implementation review, gate, retro, or acceptance can proceed.
- Record a repair fingerprint on evidence produced from test-execute through acceptance-review and invalidate artifacts whose fingerprint is missing or differs after repair.
- Persist repair disposition, changed paths, invalidation reason, previous fingerprint, current fingerprint, and invalidated artifact paths in an implementation repair ledger.
- Evaluate the original request, every explicit requirement, the produced diff, repair audit evidence, and fingerprint-matched test evidence once per requirement during acceptance-review.
- Route notMet requirement outcomes to impl-triage and route notVerifiable outcomes only to an approval-required acceptance decision.
- Preserve existing command names, target guards, envelope fields, no-repair PASS behavior, and retained artifact consumers.
- Add failing-first spec-local coverage and a CLI-only FAIL to repair to retest to PASS behavior test.

## Out of Scope
- Campaign findings other than F-002 and F-003.
- Changes to project flow configuration keys or introduction of new user-facing CLI commands.
- Automatic selection of risk acceptance or abort for notVerifiable acceptance outcomes.
- Direct test mutation of flow.json, step status, fingerprint fields, or evidence artifacts to force a passing scenario.
- test:ci integration before the Issue-stated D-03 dependency is complete.
- npm publish, npm dist-tag, or formal release execution.

## Constraints
- Use Node.js built-in modules only; add no external dependency.
- Represent repair fingerprints, triage decisions, ledger entries, requirement judgments, and acceptance outcomes with dedicated classes that enforce invariants in constructors.
- Apply alpha policy: replace incomplete acceptance and repair artifact contracts directly instead of preserving compatibility parsing for superseded formats.
- Fingerprint inputs are additions, removals, and content changes under src/, plugins/, .senti/config.json, the active spec.json, and the active spec tests/ tree; generated evidence and logs are excluded.
- Fingerprint collection is bounded to 500 normalized paths and 300 characters per path. Exceeding either bound fails closed before evidence is accepted; a truncated fingerprint cannot authorize acceptance.
- Every repair that changes the repair fingerprint invalidates evidence from test-execute through acceptance-review before test-execute is promoted.
- A notVerifiable result requires an explicit user decision. accept_risk_and_continue and abort are never selected by autoApprove, default choice, or a no-input code path.
- Tests exercise CLI commands and public lifecycle hooks; they do not write flow state or evidence artifacts to manufacture success.
- Run senti upgrade after changing src/skills or src/presets prompt sources. Run senti build after changing documented flow behavior and include every generated docs/ diff.
- Do not add this suite to test:ci until D-03 is complete.

## Design Principles
- Make repair a first-class domain lifecycle: review detects, triage disposes findings, repair changes implementation inputs, and test-execute regenerates evidence.
- Treat evidence identity as content equality, not timestamp ordering: every consumer compares the artifact repair fingerprint with the current fingerprint.
- Keep one append-only repair audit source that explains each fingerprint transition and artifact invalidation.
- Separate mechanical evidence validity from semantic requirement judgment. Missing, malformed, or fingerprint-mismatched evidence blocks semantic acceptance; valid evidence is then judged per requirement.
- Derive aggregate acceptance routing from exhaustive requirement-unit judgments so one unmet requirement cannot be hidden by an aggregate score.
- Fail closed at safety boundaries: unknown judgment status, duplicate or missing requirement ids, truncated fingerprints, and unapproved notVerifiable choices cannot advance final regression.

## Overview
### Modules
- src/flow/definition.js owns impl-triage and impl-repair node order, PASS skip behavior, FAIL routing, downstream reset ranges, and approval metadata for acceptance decisions.
- src/flow/lib/run-review.js routes implementation review findings into impl-triage without treating artifact deletion as the repair audit contract.
- Implementation triage/repair flow libraries validate triage decisions, compute repair fingerprints, append the impl-repair ledger, invalidate mismatched evidence, and promote test-execute.
- src/flow/lib/run-acceptance-review.js and acceptance-review-artifacts.js assemble request, requirements, diff, repair ledger, and test evidence; validate requirement judgments; and apply the derived route.
- src/flow/schemas/acceptance-review.schema.json and implementation prompt sources define the machine-readable requirement judgment and repair interaction contracts.
- Spec-local tests exercise public CLI transitions, evidence invalidation, semantic acceptance, explicit decision safety, and retained PASS behavior.

### Data Flow
- Implementation review emits findings. PASS marks impl-triage and impl-repair complete and proceeds to impl-gate; FAIL completes impl-review and promotes impl-triage.
- impl-triage records one disposition per source finding. Apply dispositions promote impl-repair; dispositions that require user judgment remain at an approval boundary.
- impl-repair compares the pre-repair and post-repair fingerprints, appends an audit entry, invalidates every test-execute-through-acceptance-review artifact with a missing or different fingerprint, resets downstream leaves, and promotes test-execute.
- Each downstream evidence producer records the current repair fingerprint. Each consumer validates equality before using the artifact.
- acceptance-review validates mechanical evidence, then produces exactly one met, notMet, or notVerifiable judgment for every spec requirement from the request, diff, repair ledger, and test evidence.
- All met judgments promote final-regression. Any notMet judgment promotes impl-triage. With no notMet judgment, any notVerifiable judgment exposes only an approval-required acceptance decision.

### Decisions
- [VERIFY] Current implementation review proposals reset test-execute through finalize-cleanup and delete a fixed artifact list, but no impl-triage or impl-repair leaf exists; result=match.
- [VERIFY] Current run-review delegates proposal-triggered evidence reset to definition lifecycle behavior without a fingerprint or append-only repair record; result=match.
- [VERIFY] Current acceptance evaluation is aggregate and artifact-presence driven rather than requirement-unit semantic evaluation; result=match.
- [VERIFY] Existing retry recovery supplies a bounded content fingerprint pattern that can be reused without inventing a second unbounded scanner; result=match.
- Use one repair fingerprint across test-execute-through-acceptance evidence, covering product source, plugin source, flow config, approved spec, and spec tests while excluding generated evidence.
- Model semantic acceptance with exhaustive requirement judgments and derive routing by precedence: mechanical blocker, notMet, notVerifiable, then pass.
- Preserve public command and envelope surfaces while replacing unsafe evidence semantics.
- Retained owner map: registry.js and existing command handlers continue to own command names, options, target guards, envelope fields, and ACTIVE_FLOW_MISMATCH; get-next-action.js and get-status.js continue to project definition-owned state.
- Retained owner map: review.js/run-review.js continue to produce review findings; definition.js owns routing into impl-triage; impl-triage owns disposition; impl-repair owns repair audit, fingerprint transition, invalidation, and test-execute re-entry.
- Retained owner map: existing step producers keep their JSON/Markdown/raw artifacts; a shared repair-fingerprint validator owns identity checks; existing gate, retro, report, and acceptance consumers reject missing or mismatched fingerprints before reading semantic content.
- Retained owner map: run-acceptance-review.js owns evidence assembly; acceptance-review-artifacts.js and its schema own exhaustive judgment validation/routing; set-acceptance-decision.js remains the only owner that records explicit risk acceptance or abort.
- Explicit removals: review-time unaudited deletion and aggregate-score acceptance are removed. Users now see impl-triage/impl-repair and must regenerate mismatched evidence; no command/config surface is removed, and alpha policy permits the artifact contract replacement.

## Clarifications (Q&A)
- Q: Does every implementation review require an interactive repair?
  - A: No. PASS marks impl-triage and impl-repair complete. Only findings selected for repair enter impl-repair.
- Q: What makes evidence stale?
  - A: An artifact in the test-execute-through-acceptance-review range is stale when its recorded repair fingerprint is missing or differs from the current fingerprint computed from the defined product, config, spec, and test inputs.
- Q: Can an aggregate score compensate for one notMet requirement?
  - A: No. Any notMet judgment routes to impl-triage regardless of aggregate scores.
- Q: Can autoApprove resolve notVerifiable?
  - A: No. notVerifiable requires an explicit acceptance decision, and risk acceptance or abort cannot be selected automatically.
- Q: Does this spec add or change project configuration keys?
  - A: No. Existing configuration remains unchanged; .senti/config.json content participates only as a fingerprint input.

## Alternatives Considered
- Keep direct artifact deletion inside implementation review. — Rejected because deletion has no explicit triage/repair boundary, fingerprint comparison, or append-only explanation of which repair invalidated which evidence.
- Use timestamps to decide whether evidence is stale. — Rejected because timestamp order does not prove content identity and can accept copied or rewritten evidence for different implementation inputs.
- Retain aggregate acceptance scores as the deciding contract. — Rejected because an aggregate can pass while one explicit requirement remains unmet or unverifiable.
- Route both notMet and notVerifiable directly to repair. — Rejected because notVerifiable may reflect an evidence boundary that repair cannot resolve and Issue #413 requires an approval decision.
- Automatically choose risk acceptance or abort when autoApprove is enabled. — Rejected because either choice can irreversibly advance or terminate work without the explicit human decision required by Issue #413.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T14:13:41.202Z
- Notes: Parent preapproved this gate-passed Issue #413 spec because it preserves the refined repair, fingerprint, semantic acceptance, approval-safety, and verification scope.

## Requirements
- R1 [must]: The flow definition shall add impl-triage and impl-repair leaves. Implementation review PASS shall mark both leaves complete and proceed to impl-gate; implementation review FAIL shall complete impl-review and promote impl-triage; completed impl-repair shall reset and promote test-execute before any downstream implementation leaf can complete.
- R2 [must]: impl-triage shall persist one validated disposition for every finding from impl-review or a notMet acceptance judgment, and impl-repair shall append a versioned audit entry containing source finding ids, changed paths, reason, previous fingerprint, current fingerprint, invalidated artifact paths, and timestamp. Dedicated classes shall reject missing, duplicate, or unknown finding ids and empty audit fields.
- R3 [must]: The repair fingerprint shall change for any addition, removal, or content change under src/, plugins/, .senti/config.json, the active spec.json, or active spec tests/, and shall exclude generated evidence and logs. Collection shall fail closed when more than 500 paths are required, a normalized path exceeds 300 characters, or the fingerprint is truncated.
- R4 [must]: Every artifact produced by test-execute, test-result-review, impl-review, impl-gate, retro, and acceptance-review shall record the current repair fingerprint. After repair, the flow shall invalidate every artifact in that step range whose recorded fingerprint is missing or differs, record each invalidated path with the reason and previous fingerprint, retain plan artifacts and spec tests, reset downstream implementation leaves through finalize-cleanup, and promote test-execute.
- R5 [must]: Acceptance-review shall validate mechanical evidence and then emit exactly one requirement judgment for every spec requirement id. Each judgment shall use the original request, requirement text, produced base-branch diff, impl-repair audit or an explicit no-repair record, and fingerprint-matched test evidence; its status shall be met, notMet, or notVerifiable with non-empty evidence references or missing-evidence reasons required by that status.
- R6 [must]: Acceptance routing shall fail closed on mechanical blockers, route any notMet judgment to impl-triage, route notVerifiable judgments to an acceptance decision only when no notMet judgment exists, and promote final-regression only when all requirements are met or the user explicitly accepts risk. The notVerifiable decision shall require approval and shall never auto-select accept_risk_and_continue or abort.
- R7 [must]: flow run review, flow run acceptance-review, flow set acceptance-decision, flow get next-action, and flow get status shall retain their command names, target guard options, ok/type/key/data/errors envelope fields, matching-target success behavior, ACTIVE_FLOW_MISMATCH behavior, and no-repair PASS path while consuming the refined lifecycle and artifact contracts.
- R8 [must]: Spec-local tests shall first demonstrate the pre-fix gaps and then verify public CLI behavior for FAIL to impl-triage to impl-repair to test-execute to PASS, fingerprint-mismatch invalidation, ledger contents, exhaustive requirement judgments, notMet repair routing, notVerifiable approval safety, matching-target envelopes, and the retained no-repair PASS path without directly mutating flow state or evidence to force success.

## Acceptance Criteria
- Flow status and next-action expose impl-triage and impl-repair; an implementation review FAIL reaches impl-triage, an applied triage reaches impl-repair, and repair completion reaches test-execute before impl-gate.
- An impl-review PASS path marks impl-triage and impl-repair complete without requiring a repair command and continues to impl-gate.
- The implementation repair audit contains source finding ids, changed paths, reason, previous fingerprint, current fingerprint, invalidated artifact paths, and timestamp for each repair round.
- Changing one fingerprint input causes every test-execute-through-acceptance-review artifact with a missing or different fingerprint to be rejected and invalidated while draft.json, spec.json, and spec tests remain present.
- A fingerprint input set exceeding 500 paths, a normalized input path exceeding 300 characters, or a truncated scan returns a mechanical failure and cannot satisfy acceptance.
- Acceptance-review rejects missing, duplicate, and unknown requirement judgments and writes one validated met, notMet, or notVerifiable judgment for every spec requirement.
- Each acceptance judgment references the original request, requirement, diff, repair audit or explicit no-repair evidence, and fingerprint-matched test evidence, or records the exact missing evidence for notVerifiable.
- Any notMet judgment routes to impl-triage. With no notMet judgment, any notVerifiable judgment exposes an approval-required acceptance decision.
- autoApprove and no-input execution cannot select accept_risk_and_continue or abort; only an explicit acceptance-decision command can record either choice.
- The CLI-only FAIL to repair to retest to PASS scenario regenerates evidence under the post-repair fingerprint and proves a pre-repair artifact cannot satisfy acceptance.
- The no-repair PASS path continues from impl-review through impl-gate, retro, acceptance-review, and final-regression with existing command envelope fields and retained artifact consumers.
- Spec-local tests under specs/318-impl-repair-acceptance/tests/ cover R1 through R8 with // spec: R<N> headers, while full project regression remains owned by final-regression.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add implementation repair states
  - Add impl-triage and impl-repair as first-class flow leaves with review PASS/FAIL routing and unconditional post-repair test-execute re-entry.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Track repair evidence validity
  - Create the bounded repair fingerprint and append-only repair audit that invalidate mismatched downstream evidence before retesting.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Evaluate semantic acceptance
  - Replace aggregate-only acceptance with exhaustive requirement-unit judgments over request, requirements, diff, repair audit, and fingerprint-matched test evidence.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Guard acceptance decisions
  - Derive acceptance routing from requirement outcomes and enforce an explicit approval boundary for notVerifiable risk or abort decisions.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Verify repair closure
  - Prove the repaired lifecycle through public commands and retain command, envelope, artifact-consumer, and no-repair PASS behavior.
  - see `tasks/T-5.md` for full spec
