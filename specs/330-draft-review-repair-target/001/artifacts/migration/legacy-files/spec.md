# Feature Specification: 330-draft-review-repair-target

**Feature Branch**: `feature/330-draft-review-repair-target`
**Created**: 2026-07-23
**Status**: Draft
**Input**: GitHub Issue #454

## Goal
draft-questions と draft-coverage の repairTargets を raw ADVISORY と整合する canonical advisory finding として一度だけ記録し、既存の disposition、triage、duplicate prevention の invariant を維持する。

## Background
Draft review raw artifacts classify repairTargets-only output as ADVISORY, but writeReviewAttemptHistory currently converts every repair target into a blocking canonical record. ReviewDisposition correctly rejects that combination during result_recording. Issue #453 therefore stopped after producing finalized raw evidence, while duplicate review protections correctly prevented using an identical review rerun as recovery. Issue #454 fixes only the producer-side classification mismatch.

## Scope
- must: src/flow/commands/review.js の draft repair-target canonical normalization を producer 側だけで修正する。
- must: draft-questions と draft-coverage の empty、repairTargets-only、advisory+repair の canonical recording matrixを検証する。
- must: category=repair_target と canonical recording 後の triage handoff を維持する。
- must: src/flow/lib/review-convergence.js の PASS、ADVISORY、REJECTED invariant と duplicate evidence rejection を変更せず focused tests で確認する。
- must: raw disposition=ADVISORY、blockingFindings=[]、advisoryFindings=[]、repairTargets 1件の fixture を review AI を再実行せず producer から canonical recording へ一度だけ入力し、severity=non-blocking、category=repair_target で triage へ渡す。

## Out of Scope
- must: Issue #453 の Acceptance Criteria を実装しない。
- must: review retry 上限、tooling 上限、counter reset を変更しない。
- must: 同一 artifact の再登録または同一 phase・tree・evidence の review 再実行を許可しない。
- must: provider、prompt、sandbox、permission handling を変更しない。
- must: flow state、review artifact、gate artifact を手動変更しない。
- must: active flow の pause、checkpoint、resume lifecycle を追加しない。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- src/flow/lib/review-convergence.js の disposition validation を緩和しない。
- allowlist、test skip、assertion 削減、期待値の弱体化で test を通さない。
- 同一 artifact の再登録と同一 phase・tree・evidence の duplicate review を引き続き拒否する。
- focused tests と関連 tests の PASS 後に fixed commit を作成し、その commit の独立監査が PASS した場合だけ npm test を一度実行する。
- 同じ tree SHA に対して同じ test command を再実行しない。

## Design Principles
- Producer owns classification consistency: raw ADVISORY と canonical advisory bucket の整合は review producer で成立させる。
- PASS は finding 0件、ADVISORY は blocking 0件かつ advisory 1件以上、REJECTED は blocking 1件以上でなければならない。
- Invalid disposition/finding combinations fail closed; validator relaxation is not a recovery mechanism。
- Repair targets retain category=repair_target and pass through the existing triage handoff without duplication。

## Overview
### Modules
- src/flow/commands/review.js builds draft review artifacts and normalizes their buckets into review-history canonical finding records.
- src/flow/lib/review-convergence.js enforces canonical PASS, ADVISORY, and REJECTED disposition invariants and rejects duplicate evidence identity.
- tests/unit/flow/commands/review.test.js and tests/unit/flow/retry-exhaustion-defer.test.js provide the focused producer matrix and unchanged convergence-invariant evidence.
- src/flow/commands/review.js now normalizes draft repairTargets as non-blocking canonical repair_target findings while preserving authored target and evidence fields.

### Data Flow
- A draft-questions or draft-coverage producer emits raw blockingFindings, advisoryFindings, and repairTargets buckets.
- writeReviewAttemptHistory converts each bucket into canonical finding records; repairTargets enter the advisory bucket with category=repair_target.
- Canonical recording validates the disposition, rejects duplicate identity, and hands ADVISORY findings to the existing triage route.
- Draft review repairTargets are normalized into non-blocking canonical records with category, target, and evidence, then continue through the existing disposition and triage handoff.

### Decisions
- [VERIFY] DraftReviewArtifact returns ADVISORY when advisoryFindings or repairTargets is non-empty, for the shared draft review history path; result=match.
- [VERIFY] repairTargets are currently normalized as blocking canonical records while their raw artifact is ADVISORY; result=match with Issue #454 root cause.
- [CORRECTION] The source's canonical token for advisory severity is "non-blocking". Implement the draft's advisory classification as severity=non-blocking, not a new literal "advisory" token.
- [VERIFY] Existing convergence validation already enforces all three required disposition invariants and must remain unchanged; result=match.
- [VERIFY] Existing convergence transition rejects duplicate evidence identity and completed-target re-registration; result=match.
- [VERIFY] The current focused command tests do not contain the repairTargets canonical recording matrix required by Issue #454; add it without weakening existing assertions.
- Keep the Issue #454 fix at the draft review producer boundary: change only repairTargets normalization and leave convergence validation and lifecycle routing unchanged.

## Clarifications (Q&A)
- Q: What literal value represents advisory severity in canonical review-history finding records?
  - A: Use the existing canonical value non-blocking. The finding enters ReviewDisposition.advisoryFindings; no new advisory severity token is introduced.
- Q: May the convergence validator be changed to accept the existing inconsistent artifact?
  - A: No. The producer classification is corrected and the validator remains fail-closed.

## Alternatives Considered
- Change repairTargets-only raw disposition from ADVISORY to REJECTED. — Rejected because Issue #454 requires repair targets to remain advisory and flow to triage without becoming blocking findings.
- Relax ReviewDisposition to allow ADVISORY with blocking findings or no advisory findings. — Rejected because it violates R6 and weakens fail-closed canonical validation.
- Recover by allowing duplicate artifact registration or rerunning the same review evidence. — Rejected because it violates R7 and does not repair the producer-side classification defect.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-23T07:27:32.427Z
- Notes: User selected option 1; parent verified Issue #454 AC1-AC8 mapping, spec review PASS, spec gate PASS, and scope lock.

## Requirements
- R1 [must]: A draft-questions raw ADVISORY containing only repairTargets shall be recorded once as canonical advisory findings with category=repair_target, and result_recording shall succeed.
- R2 [must]: A draft-coverage raw ADVISORY containing only repairTargets shall use the same canonical advisory normalization and record successfully.
- R3 [must]: When advisoryFindings and repairTargets coexist, canonical recording shall preserve both as advisory findings and shall produce no blocking finding.
- R4 [must]: Every normalized repair target shall retain category=repair_target and its title, target, rationale, and evidence through canonical recording and triage handoff.
- R5 [must]: When blockingFindings, advisoryFindings, and repairTargets are all empty, the producer shall record PASS with zero canonical findings.
- R6 [must]: Canonical validation shall continue to reject ADVISORY with a blocking finding, PASS with any finding, and REJECTED without a blocking finding.
- R7 [must]: The change shall not permit registration of the same artifact twice or rerunning review for the same phase, tree, and evidence.
- R8 [must]: A raw fixture with disposition=ADVISORY, blockingFindings=[], advisoryFindings=[], and repairTargets=[{title:"Empty initial QA list", target:"qa[]", rationale:"Initial QA list is empty before answer collection", evidence:"qa[] is empty before any answer exists"}] shall reproduce the current severity=blocking recording failure, then after the fix pass exactly once through producer normalization as severity=non-blocking and category=repair_target and advance to triage without invoking review AI.

## Acceptance Criteria
- [AC1/R1] draft-questions repairTargets-only produces ADVISORY, one non-blocking canonical repair_target finding, and successful result_recording.
- [AC2/R2] draft-coverage repairTargets-only produces the same successful canonical result.
- [AC3/R3] advisory+repair preserves the original advisory finding and repair target as two advisory findings with zero blocking findings.
- [AC4/R4] repair target category and authored fields are identical before and after canonical recording and remain present in triage handoff.
- [AC5/R5] empty input produces PASS and zero canonical findings for both draft routes.
- [AC6/R6] focused invariant tests reject ADVISORY+blocking, PASS+finding, and REJECTED without blocking findings.
- [AC7/R7] focused duplicate tests continue to reject the same evidence digest and a second review for an already completed phase/tree target.
- [AC8/R8] disposition=ADVISORY, empty blocking/advisory buckets, and the single R8 repair target reproduce severity=blocking before the fix; after the fix one recording yields severity=non-blocking, category=repair_target, successful triage handoff, and zero review AI invocations.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Normalize draft repair targets
  - Change only the producer-side canonical normalization so repair targets from both draft routes become non-blocking repair_target findings while all existing disposition and duplicate guards remain unchanged.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add draft route regression matrix
  - Add the finite positive matrix and the raw ADVISORY repairTargets-only fixture defined by R8 for draft-questions and draft-coverage canonical recording.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify convergence invariants
  - Prove that invalid disposition combinations and duplicate evidence remain rejected without relaxing production validation.
  - see `tasks/T-3.md` for full spec
