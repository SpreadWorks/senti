# Feature Specification: 336-reset-draft-review-artifacts

**Feature Branch**: `feature/336-reset-draft-review-artifacts`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #459

## Goal
rewind 後の draft review が PASS したときに無効化された試行の finding を canonical triage・repair artifact に残さず現在試行の empty state へ必ず置き換え、sealed spec-correction rewind 後に確認された fresh approval を正しく受理する。

## Background
A draft review attempt can create triage and repair artifacts with findings. reopen-draft intentionally retains those planning artifacts for auditability while resetting the route steps. On a later PASS, the lifecycle calls a helper intended to establish empty triage and repair bookkeeping, but the helper writes only when each file is absent. Existing files therefore continue to describe an invalidated attempt even though the current review and all route steps report PASS. During source-verified spec correction, the same flow exposed a second defect: sealed spec-correction audit entries store their occurrence time in timestamp, while isPlanEvidenceFresh reads rewoundAt from every latest record. Date.parse(undefined) makes a later approval appear stale and blocks approval completion.

## Scope
- must: draft-questions route の PASS lifecycle が既存 canonical triage・repair artifact を現在試行の empty state へ置換する。
- must: draft-coverage route に同じ置換 policy を適用する。
- must: FAIL または ADVISORY、rewind、PASS の sequence を両 route で behavior-level focused test により検証する。
- must: canonical artifact の固定パス・schema と rewind audit/history を保持する。
- must: guarded plan rewind の rewoundAt と sealed spec-correction rewind の timestamp を、それぞれの現行 record shape における authoritative occurrence time として freshness 判定へ正規化する。
- must: approval completion guard が最新 rewind occurrence time より後の confirmed_at を受理し、同時刻以前を stale として拒否する。

## Out of Scope
- must not: Issue #443 の transition guard を変更しない。
- must not: draft review 以外の review lifecycle を変更しない。
- must not: rewind 時に planning artifact を削除する方式へ変更しない。
- must not: canonical triage・repair artifact のファイル名または schema を変更しない。
- must not: guarded plan rewind または sealed spec-correction rewind の persisted audit schema と digest chain を変更しない。
- must not: Issue #460 の implement evidence eligibility policy を変更しない。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- 既存の DraftReviewRoute を artifact 名と step id の唯一の owner として使用する。
- PASS 以外の verdict routing、review retry accounting、step transition を変更しない。
- 無効化された試行の情報は rewind audit/history に保持し、current canonical artifact には保持しない。
- テスト失敗時にテスト期待値を弱めず、product code の lifecycle defect を修正する。
- migration-parity owner mapping: artifact の固定パス・phase と route-canonical source reference schema は既存 DraftReviewRoute と writeEmptyDraftReviewRouteArtifacts が継続所有する。
- migration-parity owner mapping: PASS current view の空 triage・repair document は既存 writeEmptyDraftReviewRouteArtifacts が継続所有し、書き込み条件だけを create-if-absent から replace-current-view へ変更する。
- migration-parity owner mapping: PASS の review・triage・repair step completion は既存 resolveDraftReviewLifecycle が継続所有する。
- migration-parity owner mapping: FAIL/ADVISORY finding は既存 review command、triage/repair mutation audit は既存 plan prompt と set-step workflow が継続所有する。
- migration-parity owner mapping: rewind の step reset と audit/history は既存 run-reopen-draft と plan rewind mechanism が継続所有する。
- migration-parity owner mapping: guarded plan rewind の rewoundAt と sealed spec-correction rewind の timestamp は各 producer が継続所有し、plan-rewind freshness abstraction が両 shape の occurrence time を統一して consumer へ提供する。
- migration-parity owner mapping: approval completion と STALE_PLAN_APPROVAL envelope は既存 set-step approval guard が継続所有する。
- migration-parity removal decision: invalidated attempt の finding を later PASS の current canonical view に残す behavior と、sealed spec-correction rewind 後の fresh approval を stale と誤判定する behavior は不具合として削除する。user-visible command、path、schema、audit side effect は削除しない。

## Design Principles
- Current-view artifacts represent the current attempt; historical attempts belong to audit/history.
- The shared PASS lifecycle helper applies one replacement policy to both draft-review routes.
- Migration parity preserves artifact paths, schemas, step completion, non-PASS findings, and rewind audit ownership.
- Freshness compares evidence against one normalized rewind occurrence time while preserving each current audit record shape.

## Overview
### Modules
- src/flow/definition.js owns the draft review PASS lifecycle plan and writes the canonical empty triage and repair artifacts.
- src/flow/lib/draft-review-routes.js owns the questions and coverage route metadata, including artifact names and step ids.
- src/flow/registry.js resolves the lifecycle hook route and invokes the shared artifact writer for the active spec.
- src/flow/lib/run-reopen-draft.js resets plan steps while retaining stale planning artifacts and recording rewind audit information.
- src/flow/lib/plan-rewind.js owns plan evidence freshness and normalizes the occurrence time of guarded and sealed spec-correction rewind records.
- src/flow/lib/set-step.js owns approval completion validation and returns STALE_PLAN_APPROVAL when the persisted confirmation is not newer than the latest rewind.
- src/flow/definition.js models canonical empty draft-review triage and repair documents as invariant-enforcing classes and owns unconditional PASS replacement.
- src/flow/lib/plan-rewind.js models the latest rewind occurrence as an invariant-enforcing value object across guarded and sealed spec-correction record shapes.

### Data Flow
- A FAIL or ADVISORY draft review produces route-specific triage and repair artifacts containing findings or applied mutations.
- reopen-draft resets the affected plan steps but deliberately retains planning artifacts and records the rewind in the issue log or rewind audit.
- A later PASS resolves the same DraftReviewRoute and the lifecycle hook replaces both canonical triage and repair artifacts with empty current-attempt documents.
- Downstream draft-gate and artifact consumers read the fixed canonical paths and observe only the current PASS state.
- When approval completion is requested, the freshness abstraction resolves rewoundAt for a guarded rewind or timestamp for a sealed spec-correction rewind and compares confirmed_at strictly after that occurrence.
- A PASS resolves DraftReviewRoute metadata, creates both canonical empty documents with one generatedAt, and replaces stale current-view files at the fixed paths.
- isPlanEvidenceFresh resolves the latest raw audit record, normalizes its authoritative occurrence time, and accepts evidence only when createdAt is strictly later.

### Decisions
- [VERIFY] PASS marks review, triage, and repair done and invokes the shared empty-artifact lifecycle hook; result=match.
- [CORRECTION] The base helper's create-if-absent behavior is the root cause; the adopted working change replaces both current-view files.
- [VERIFY] questions and coverage share one route model but use separate canonical artifact names; both require the same fix.
- [VERIFY] The registry hook resolves route metadata and delegates current artifact creation to the shared helper; result=match.
- [VERIFY] Pre-implementation reopen retains stale planning artifacts and records the reset, so history must remain separate from the current view.
- Keep the existing helper as PASS current-view owner and change its replacement semantics; do not move ownership into rewind or duplicate route-specific logic.
- [CORRECTION] Regenerate sourceReview and sourceTriage from DraftReviewRoute on every PASS because draft-gate treats them as route-canonical schema invariants.
- [VERIFY] Non-PASS triage and repair artifacts are AI-authored workflow outputs, not products of a dedicated CLI producer.
- [CORRECTION] Freshness must normalize both current rewind record shapes instead of reading rewoundAt from sealed spec-correction entries.
- [VERIFY] Approval remains strict: a confirmation at or before the latest occurrence is stale, and only a later confirmation is fresh.
- Use route-owned reviewArtifact and triageArtifact references on every PASS; retained arbitrary source fields belong to invalidated history, not the current canonical view.
- Preserve both persisted audit schemas and latestPlanRewind raw-record behavior; normalize rewoundAt versus timestamp only at the shared freshness boundary.

## Clarifications (Q&A)
- Q: Does replacement delete rewind history?
  - A: No. Only the current canonical triage and repair files are replaced. Rewind audit/history remains owned by the existing rewind mechanism.
- Q: Does PASS create versioned artifact file names?
  - A: No. Existing fixed paths and version 1 schemas remain the consumer contract; PASS overwrites the current view at those paths.
- Q: Which timestamp represents the replacement?
  - A: Both empty documents use the generatedAt value supplied for the current PASS lifecycle invocation.
- Q: Does PASS preserve arbitrary sourceReview or sourceTriage values from retained files?
  - A: No. DraftReviewRoute owns both canonical references and draft-gate validates them, so PASS regenerates route.reviewArtifact and route.triageArtifact values.
- Q: How do tests represent non-PASS triage and repair creation when no CLI producer exists?
  - A: The fixture derives those AI-authored JSON outputs from the non-PASS findings, then uses the real set-step workflow; reopen-draft and the later PASS use production command and lifecycle paths.
- Q: Why are both rewoundAt and timestamp valid occurrence fields?
  - A: They belong to two current record types: guarded PlanRewindRecord serializes rewoundAt, while sealed spec-correction PlanRewindAuditEntry serializes timestamp. Freshness normalizes these types without changing either persisted schema.
- Q: Is an approval confirmed at exactly the rewind occurrence fresh?
  - A: No. Freshness remains a strict greater-than comparison; equal and earlier confirmations are stale.
- Q: What happens when the latest rewind occurrence time is malformed?
  - A: The freshness boundary fails closed, so approval completion returns STALE_PLAN_APPROVAL instead of accepting unverifiable evidence.

## Alternatives Considered
- Delete triage and repair artifacts during rewind. — Rejected because reopen-draft intentionally retains planning artifacts for auditability, and Issue #459 requires preserving rewind history.
- Write versioned current-artifact file names after every review attempt. — Rejected because it changes existing consumer paths and expands scope beyond correcting the current canonical view.
- Add separate overwrite logic for questions and coverage. — Rejected because both routes already share one helper and route metadata; duplicating the policy would permit drift.
- Manually archive or delete the active planRewinds entry whenever approval is blocked. — Rejected as a product solution because it repairs only one flow state and permits the same false-stale failure to recur.
- Rename sealed spec-correction timestamp to rewoundAt in persisted audit records. — Rejected because it changes the sealed audit schema and digest-chain contract; normalizing the two current record types at the freshness boundary preserves audit integrity.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T04:32:01.210Z
- Notes: autoApprove selected option 1 after the user-approved Issue #459 scope expansion passed spec review and gate; includes R7-R8 approval freshness timestamp normalization.

## Requirements
- R1 [must]: For draft-questions, PASS after a rewind shall replace an existing canonical triage artifact containing stale items with version 1, phase=draft-questions-triage, sourceReview equal to the questions route reviewArtifact, a current generatedAt value, the canonical empty summary, and items=[].
- R2 [must]: For draft-questions, the same PASS shall replace an existing canonical repair artifact containing stale items with version 1, phase=draft-questions-repair, sourceTriage equal to the questions route triageArtifact, a current generatedAt value, the canonical empty summary, and items=[].
- R3 [must]: For draft-coverage, PASS after a rewind shall apply the same canonical empty replacement semantics to its triage and repair artifacts using the coverage route's paths, phases, reviewArtifact sourceReview, and triageArtifact sourceTriage.
- R4 [must]: The PASS lifecycle shall continue to mark the route's review, triage, and repair steps done and shall expose no finding from an invalidated attempt through either current canonical artifact.
- R5 [must]: The change shall preserve FAIL and ADVISORY artifact content until a later PASS, preserve reopen-draft audit/history, and leave route metadata, artifact paths, artifact schemas, verdict routing, retry accounting, and Issue #443 transition guards unchanged.
- R6 [must]: Focused tests shall exercise the actual non-PASS review post hook, derive AI-authored triage and repair fixture artifacts from its findings while advancing through the actual set-step workflow, execute the actual reopen-draft reset with retained history, and run a later PASS through the registry lifecycle hook for each draft-review route.
- R7 [must]: Plan evidence freshness shall compare against the authoritative occurrence time of the latest current rewind record: rewoundAt for guarded plan rewind records and timestamp for sealed spec-correction rewind records; an evidence timestamp must be strictly later to be fresh.
- R8 [must]: The approval completion guard shall accept a valid confirmed_at later than a sealed spec-correction timestamp, reject equal or earlier confirmations with STALE_PLAN_APPROVAL, fail closed for malformed occurrence times, and preserve the persisted audit shapes, digest chains, no-rewind behavior, and Issue #460 implement-evidence scope.

## Acceptance Criteria
- [AC1/R1] A questions-route stale triage artifact with at least one item is replaced after PASS; the resulting fixed-path document has the canonical empty fields, route.reviewArtifact sourceReview, and no stale item.
- [AC2/R2] A questions-route stale repair artifact with at least one item is replaced in the same PASS; the resulting fixed-path document has the canonical empty fields, route.triageArtifact sourceTriage, and no stale item.
- [AC3/R3] The equivalent coverage-route sequence replaces both coverage triage and repair artifacts with route-correct paths, phases, source references, summaries, timestamps, and empty items.
- [AC4/R4] Both route tests assert review, triage, and repair status=done after PASS and assert that neither current artifact contains an invalidated finding.
- [AC5/R5] Both route tests assert stale artifacts remain available after rewind but before PASS, rewind audit/history remains recorded after PASS, and existing paths and schema keys do not change.
- [AC6/R5] Existing FAIL/ADVISORY routing and retry-accounting focused tests pass without assertion removal, skip, allowlist, or expectation weakening.
- [AC7/R6] Spec-local tests connect the non-PASS review post hook, finding-derived AI-authored artifact fixture boundary, actual set-step and reopen-draft commands, and later registry PASS lifecycle for both routes; tests carry // spec: headers covering R1-R6.
- [AC8/R7] Focused tests exercise both current rewind record shapes and prove that evidence before or equal to the normalized occurrence time is stale while evidence after it is fresh.
- [AC9/R8] A focused approval completion test uses a sealed spec-correction entry with timestamp and verifies later confirmed_at succeeds, equal and earlier values return STALE_PLAN_APPROVAL, malformed occurrence time fails closed, and no-rewind approval behavior remains unchanged.
- [AC10/R8] Existing guarded-plan-rewind, reopen-draft audit integrity, and approval tests pass without changing persisted audit fields, digest-chain assertions, or Issue #460 implement evidence policy.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Replace PASS route artifacts
  - Make the shared PASS lifecycle replace stale current triage and repair artifacts for both draft-review routes while preserving rewind history and all existing contracts.
  - see `tasks/T-1.md` for full spec

### Round 1
- **T-2** [pending]: Normalize rewind freshness timestamps
  - Make plan evidence and approval freshness resolve the authoritative occurrence time for both current rewind record types without changing sealed audit persistence.
  - see `tasks/T-2.md` for full spec
