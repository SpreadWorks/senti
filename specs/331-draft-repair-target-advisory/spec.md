# Feature Specification: 331-draft-repair-target-advisory

**Feature Branch**: `feature/331-draft-repair-target-advisory`
**Created**: 2026-07-24
**Status**: Draft
**Input**: GitHub Issue #454

## Goal
draft-questions と draft-coverage の repairTargets を raw ADVISORY と整合する canonical advisory findings として一度だけ記録し、既存の disposition invariant、triage 伝播、duplicate protection を維持したまま result_recording を成功させる。

## Background
A raw draft artifact becomes ADVISORY when repairTargets exist, but canonical result_recording previously ignored that bucket. The resulting ADVISORY had no advisory findings and failed closed. After including repairTargets, multiple anonymous findings also shared the fallback findingId review-finding; draft-scoped deterministic IDs are required while duplicate fingerprints remain rejected.

## Scope
- src/flow/lib/run-review.js の draft-questions と draft-coverage に限定した canonical bucket mapping。
- 複数の draft canonical findings に対する deterministic fallback findingId。
- src/flow/commands/review.js が保持する repair_target category、target、evidence、rationale と review-history contract の統合確認。
- tests/unit/flow/commands/review.test.js の focused producer-to-canonical matrix と Issue #453 checkpoint-shaped fixture。
- specs/331-draft-repair-target-advisory/tests/ の requirement-header 付き spec-local behavior verification。
- 既存 review-convergence negative matrix と duplicate fingerprint rejection の維持確認。

## Out of Scope
- Issue #453 の Acceptance Criteria 自体の実装または checkpoint worktree・artifact・flow state の変更。
- review retry 上限、counter reset、一般 recovery、同一 target の duplicate review permission の変更。
- provider、prompt、sandbox、OS permission、autoApprove の変更。
- active flow の pause、park、checkpoint lifecycle 機能の変更。
- src/flow/lib/review-convergence.js の disposition validation 緩和。
- Issue #454 と無関係な既存不具合の修正。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- PASS は finding 0件、ADVISORY は blocking 0件かつ advisory 1件以上、REJECTED は blocking 1件以上の既存 invariant を維持する。
- 同一 artifact、同一 phase・tree・evidence、同一 content fingerprint の duplicate protection を緩和しない。
- repairTargets は draft-questions と draft-coverage だけで advisory input へ追加し、他 phase の mapping を変更しない。
- test skip、assertion 削減、allowlist、期待値の弱体化で検証を通さない。
- full regression は focused verification と独立 review 後の必須 final-regression step で一度だけ実行し、全 project test の PASS を完了条件とする。
- project-test-integrity: task-gate は後続の spec-level test-execute と final-regression より前に実行されるため両 step を完了扱いにしない。test-execute の focused verification と mandatory final-regression の全 project test PASS をそれぞれ定義順に実行し、finalize 前に必ず検証する。

## Design Principles
- Raw verdict に寄与する producer bucket は canonical disposition input にも同じ意味で反映する。
- Fallback identity は artifact 内で一意かつ deterministic にし、content fingerprint による真の重複拒否を残す。
- Raw artifact、review history、canonical convergence、triage の各責務を混同しない。
- Issue #454 の修正に必要な module と test だけを変更する。

## Overview
### Modules
- src/flow/commands/review.js builds raw draft review artifacts and review-history records while preserving repair_target metadata.
- src/flow/lib/run-review.js promotes raw artifact buckets into canonical blocking and advisory findings before result_recording.
- src/flow/lib/review-convergence.js owns immutable PASS, ADVISORY, REJECTED, finding identity, and duplicate fingerprint invariants.
- tests/unit/flow/commands/review.test.js exercises both draft phases, empty and mixed buckets, multiple identities, duplicate rejection, and checkpoint replay.
- src/flow/lib/run-review.js now promotes repairTargets into canonical advisory inputs only for draft-questions and draft-coverage and assigns deterministic phase-and-bucket fallback finding IDs.

### Data Flow
- Draft review emits blockingFindings, advisoryFindings, and repairTargets with a PASS, ADVISORY, or REJECTED raw verdict.
- Review history stores repairTargets as non-blocking records with category=repair_target and authored target, evidence, and rationale.
- Canonical promotion combines draft repairTargets with advisory findings and assigns phase-and-bucket-scoped fallback findingId values.
- ReviewDisposition validates the unchanged invariant, records evidence once, and routes the raw repairTargets to existing draft triage.
- During result_recording, draft repairTargets join advisory findings, are canonicalized once, validated by the unchanged ReviewDisposition invariant, and become finalized review evidence while the raw artifact remains the triage source.

### Decisions
- [VERIFY] DraftReviewArtifact maps empty buckets to PASS, advisoryFindings or repairTargets to ADVISORY, and blockingFindings to REJECTED; result=match.
- [CORRECTION] Draft assigned canonical normalization to commands/review.js; source verification assigns result_recording bucket promotion to run-review.js.
- [VERIFY] ReviewDisposition already rejects invalid PASS, ADVISORY, REJECTED, duplicate findingId, and duplicate fingerprint combinations; result=match.
- User authorized a direct Issue #454 fix because the bug blocked its own planning review and explicitly prohibited changes outside this issue.
- Existing-feature impact is limited to draft-questions and draft-coverage result_recording when repairTargets are present; other phases, public CLI behavior, retry policy, providers, and disposition validation remain unchanged.
- Keep raw history normalization and ReviewDisposition validation unchanged; repair the producer-to-canonical mismatch only in run-review.js.

## Clarifications (Q&A)
- Q: Does canonical recording replace the raw repairTargets bucket?
  - A: No. Canonical promotion consumes repairTargets as advisory inputs; the raw artifact remains the existing triage source.
- Q: Does assigning unique fallback IDs permit duplicate content?
  - A: No. findingId collisions are removed for distinct anonymous findings, while identical content still collides on fingerprint and fails closed.
- Q: Must final-regression already be complete at task-gate?
  - A: No. task-gate precedes spec-level test execution by definition. When the task-gate retry limit is reached, acceptance-review owns the final disposition of the deferred finding. project-test-integrity remains mandatory: focused verification and final-regression run in their defined downstream steps, and every project test must pass before finalize.

## Alternatives Considered
- Relax ReviewDisposition so ADVISORY may contain no advisory findings. — Rejected because it weakens the canonical invariant instead of aligning producer inputs.
- Reset tooling counters or permit a duplicate review on the unchanged target. — Rejected as explicitly out of scope and unnecessary after recording the fix on a new target tree.
- Copy repairTargets into raw advisoryFindings. — Rejected because it duplicates raw artifact meaning and can pollute advisory memory; canonical promotion should combine the buckets.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-24T05:50:12.483Z
- Notes: User selected [1] and approved the gate-passed Issue #454 specification.

## Requirements
- R1 [must]: A draft-questions repairTargets-only artifact shall record each repair target once as a canonical advisory finding and complete result_recording.
- R2 [must]: A draft-coverage repairTargets-only artifact shall use the same canonical advisory contract.
- R3 [must]: advisoryFindings and repairTargets shall both be preserved as advisory inputs without producing blocking findings.
- R4 [must]: Repair targets shall retain category=repair_target, target, evidence, and rationale in review history and remain available to the existing triage route.
- R5 [must]: An artifact with all finding buckets empty shall remain PASS with zero canonical findings.
- R6 [must]: ADVISORY with blocking findings, PASS with findings, and REJECTED without blocking findings shall continue to fail closed.
- R7 [must]: Multiple distinct draft findings shall receive unique deterministic fallback findingId values while duplicate content fingerprints and duplicate review evidence remain rejected.
- R8 [must]: An Issue #453 checkpoint-shaped repair-target artifact shall be processed once and advance through canonical recording to triage without invoking review AI.

## Acceptance Criteria
- [AC1/R1] draft-questions repairTargets-only produces ADVISORY, one or more canonical advisory findings, and successful result_recording.
- [AC2/R2] draft-coverage repairTargets-only follows the same successful canonical recording path.
- [AC3/R3] advisoryFindings plus repairTargets are both retained as advisory findings and produce no blocking findings.
- [AC4/R4] repair_target category and authored target, evidence, and rationale remain in review history and the raw triage source.
- [AC5/R5] empty buckets produce PASS and zero canonical findings.
- [AC6/R6] invalid PASS, ADVISORY, and REJECTED combinations remain rejected by ReviewDisposition.
- [AC7/R7] distinct anonymous draft findings receive unique fallback IDs, identical content still fails duplicate fingerprint validation, and completed evidence cannot be registered twice.
- [AC8/R8] the checkpoint-shaped fixture records once, does not call review AI, and advances the production review hook to triage.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Normalize draft canonical findings
  - Align canonical promotion with raw draft ADVISORY semantics for both draft routes and preserve fail-closed identity invariants.
  - see `tasks/T-1.md` for full spec
