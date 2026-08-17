# Feature Specification: 279-retry-recovery-evidence

**Feature Branch**: `feature/279-retry-recovery-evidence`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub Issue #364

## Goal
retry exhausted 後の recovery evidence 判定を、impl-review / impl-gate が実際に修正先として扱う spec.json acknowledgement と一致させる。

## Background
Issue #364 identifies a mismatch between retry recovery guidance and recovery eligibility. The impl-review and impl-gate prompts can direct users to fix intentional guardrail exceptions by editing spec.json acknowledgement surfaces, but retry recovery currently fingerprints only src for review impl and gate task-impl. This means the correct prompt-guided fix can be rejected as unchanged evidence after retry exhaustion.

## Scope
- src/flow/lib/retry-recovery.js の phase 別 recovery evidence source
- review impl の recovery evidence source
- gate task-impl の retry exhausted recovery evidence source
- issue-log.json の単純追記だけでは意図しない retry reset を許可しない境界
- spec-local unit tests による recovery eligibility の検証

## Out of Scope
- retry counter の最大回数、reset grant 数、CLI コマンド名の変更
- draft / spec / test review など Issue #364 が対象にしていない phase の recovery policy 変更
- issue-log-import や workflow board 操作の仕様変更
- guardrail article 本文や acknowledged-exception の成立条件変更
- field-level JSON diff parser の追加

## Constraints
- No external dependencies may be added; implementation and tests must use Node.js built-ins and existing local helpers.
- The retry reset command contract must remain unchanged: `sdd-forge flow set retry reset <gate|review> <phase> --reason <text> --yes`.
- A simple append-only change to issue-log.json must not be sufficient changed evidence for review impl or gate task-impl recovery.
- Recovery evidence source changes must stay phase-scoped; unrelated recovery phases must retain their current source meaning unless explicitly covered by this spec.

## Design Principles
- Align recovery evidence with the artifacts that prompts instruct users to modify.
- Keep retry recovery fingerprinting file-based to fit the existing EvidenceFingerprint model.
- Prefer adding phase-specific paths over adding special-case reset behavior.
- Preserve issue-log as an audit trail, not as a standalone unlock mechanism.

## Overview
### Modules
- `src/flow/lib/retry-recovery.js` owns retry recovery targets, phase evidence sources, fingerprints, eligibility checks, and reset grants.
- `src/flow/lib/set-retry.js` invokes recovery eligibility before applying an exhausted retry reset grant.
- `src/flow/prompts/impl/impl-review.md` and `impl-gate.md` instruct operators to record intentional guardrail exception acknowledgements in spec.json.

### Data Flow
- On retry exhaustion, run-review or run-gate persists a recovery baseline fingerprint. `flow set retry reset` later builds the current fingerprint from the phase evidence source and grants one re-evaluation only when the source hash changes.
- After this change, review impl and gate task-impl fingerprints include both implementation files under src and the active spec.json file. issue-log.json remains excluded for these phases.

### Decisions
- [VERIFY] Current review impl evidence source excludes spec.json.
- [VERIFY] Current gate task-impl evidence source excludes spec.json.
- [VERIFY] Prompt guidance names spec.json as a valid repair surface.
- Use file-level spec.json evidence rather than field-level acknowledgement parsing.
- Keep issue-log.json excluded for review impl and gate task-impl recovery.

## Clarifications (Q&A)
- Q: Should acknowledgement evidence be limited to specific spec.json fields?
  - A: No for this change. The implementation should add the active spec.json file to the phase evidence source and verify acknowledgement-field changes through tests. Field-level parsing is out of scope.
- Q: Should issue-log.json become a recovery evidence source?
  - A: No for review impl and gate task-impl. issue-log.json is an audit trail here, and a simple append-only change must not unlock retry reset.
- Q: Does this change alter retry limits or grant count?
  - A: No. The command contract, configured max attempts, and one-attempt recovery grant remain unchanged.

## Alternatives Considered
- Parse spec.json and only hash acknowledgement fields — Rejected because the existing retry recovery model selects file paths and hashes files. Field-level parsing adds policy complexity outside Issue #364.
- Include issue-log.json as changed evidence for all retry recovery phases — Rejected because it would allow retry reset by appending audit text, contradicting the requirement that issue-log-only changes not unlock unintended phases.
- Keep src-only evidence and update prompts to require source changes — Rejected because prompt-guided spec.json acknowledgement is the correct repair surface for intentional guardrail exceptions.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-05T00:46:48.542Z
- Notes: Auto-approved after spec-gate PASS with autoApprove enabled for Issue #364.

## Requirements
- R1 [must]: For review impl retry recovery, the phase evidence source must include the active spec.json file in addition to src, so a spec.json acknowledgement change can produce changed evidence without an unrelated src change.
- R2 [must]: For gate task-impl retry-exhausted recovery, the phase evidence source must include the active spec.json file in addition to src, so a spec.json acknowledgement change can produce changed evidence without an unrelated src change.
- R3 [must]: For review impl and gate task-impl, issue-log.json must not be part of the phase evidence source, so an issue-log-only append does not satisfy changed evidence for those phases.
- R4 [should]: Spec-local tests under specs/279-retry-recovery-evidence/tests/ must cover R1, R2, and R3 through recovery evidence source and eligibility behavior.

## Acceptance Criteria
- For kind=review and canonicalPhase=impl, resolveRecoveryEvidenceSource returns paths containing src and the active spec.json path.
- For kind=gate and canonicalPhase=task-impl, resolveRecoveryEvidenceSource returns paths containing src and the active spec.json path.
- A recovery baseline captured before a spec.json acknowledgement change and evaluated after that change reports changed-evidence for review impl.
- A recovery baseline captured before a spec.json acknowledgement change and evaluated after that change reports changed-evidence for gate task-impl.
- Changing only issue-log.json does not make review impl or gate task-impl recovery eligible when src and spec.json are unchanged.
- Existing evidence sources for draft question review, draft coverage review, spec review, test review, and integration gate remain unchanged unless already covered by this spec.

## Implementation Targets
- src/flow/lib/retry-recovery.js
- specs/279-retry-recovery-evidence/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Extend recovery evidence
  - Update retry recovery evidence source selection so review impl and gate task-impl include spec.json while continuing to exclude issue-log.json as a standalone unlock path.
  - see `tasks/T-1.md` for full spec
