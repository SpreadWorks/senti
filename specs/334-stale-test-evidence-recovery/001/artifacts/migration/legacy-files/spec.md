# Feature Specification: 334-stale-test-evidence-recovery

**Feature Branch**: `feature/334-stale-test-evidence-recovery`
**Created**: 2026-07-24
**Status**: Draft
**Input**: GitHub Issue #457

## Goal
失敗した test evidence の生成後に material な実装修正で repair fingerprint が変わった場合、artifact authority を弱めず、監査可能な guarded integration gate command で test-execute へ戻せるようにする。

## Background
The integration gate currently performs all trust checks, including the final test outcome verdict, before comparing repair fingerprints. A requirement failure therefore returns ARTIFACT_PLACEHOLDER before stale detection even when both test artifacts are structurally valid and refer to the pre-repair fingerprint. The existing direct stale recovery path never runs, while rewind-test-evidence also rejects the situation because no impl-gate ExternalBlockedOutcome was recorded. Separating structural authority from outcome success permits the existing recovery owner to handle a material fingerprint mismatch without accepting malformed evidence.

## Scope
- flow-level integration impl-gate における test artifact trust validation と stale repair fingerprint detection の優先順位。
- schema と ownership を検証できる failed test evidence から既存の stale evidence recovery へ接続する処理。
- stale artifact invalidation、test-execute への lifecycle transition、recovery result の監査情報。
- run-gate、test artifact trust helper、stale evidence recovery、rewind-test-evidence の既存 authority contract に対する回帰確認。
- spec-local tests と関連する shared flow regression tests。

## Out of Scope
- target guard、material repair、artifact ownership の要件緩和。
- malformed、missing、または相互に矛盾する fingerprint evidence からの回復。
- artifact の手編集または手削除を利用手順とする変更。
- task-level gate、acceptance-review、final-regression の recovery policy 変更。
- 外部 dependency の追加。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- test-execute-result.json と test-result-review.json は schema、path ownership、raw evidence、関連 artifact authority を検証できる場合だけ stale recovery の根拠にする。
- 両 test artifacts の repairFingerprint は valid な SHA-256 digest で相互に一致し、現在の material repair fingerprint と異なる場合だけ stale と判定する。
- missing、malformed、invalid、または相互に矛盾する fingerprint evidence は既存の structural trust failure として fail closed にする。
- target guards、material repair、artifact ownership、rewind-test-evidence の blocker authority を弱めない。
- stale artifact invalidation と lifecycle transition は同じ recovery operation の所有下で実行し、以前と現在の fingerprint、無効化した artifact、次の active step を監査可能な result に残す。
- fingerprint が現在値と一致する failed evidence は stale recovery の対象にせず、既存の test artifact validation failure を返す。
- 通常の trusted PASS evidence から semantic integration gate へ進む経路を変更しない。
- 意味のある trust assessment、mismatch、recovery result は専用クラスで invariant と振る舞いを表現する。

## Design Principles
- Artifact の構造的 authority と test outcome の成功可否を分離し、authority を確認した後にだけ stale recovery を outcome failure より優先する。
- 既存の StaleIntegrationTestEvidence recovery を canonical owner とし、同じ mismatch に複数の mutation owner を作らない。
- Trust validation の公開入口には詳細な段階処理を隠し、呼び出し側は success、structural failure、authoritative stale evidence を明確に判別できるようにする。
- 回復不能な artifact を回復可能として扱うより、既存の fail-closed behavior を維持する。

## Overview
### Modules
- src/flow/lib/test-artifacts.js validates required integration inputs, artifact schema, owned paths, raw evidence, placeholder policy, regression evidence, and test outcome.
- src/flow/lib/run-gate.js classifies the integration precheck, computes the current repair fingerprint, detects authoritative stale evidence, and delegates recovery before semantic gate evaluation.
- src/flow/lib/stale-test-evidence-refresh.js owns stale mismatch invariants, evidence invalidation, lifecycle reset, and the structured recovery result.
- src/flow/lib/run-rewind-test-evidence.js remains the explicit recovery command for its existing external-blocked authority path and supplies negative guard regression coverage.
- spec-local and shared flow tests cover failed-but-authoritative evidence, malformed authority, unchanged fingerprints, atomic recovery effects, and unchanged guard behavior.
- src/flow/lib/test-artifacts.js separates structurally authoritative integration evidence from its outcome verdict and owns shared fingerprint consistency validation.
- src/flow/lib/stale-test-evidence-refresh.js stages owned stale artifacts and rolls them back when lifecycle mutation fails.

### Data Flow
- The integration gate loads required trust inputs and validates structural authority without treating requirement failure alone as malformed evidence.
- The gate compares the validated artifacts' common repairFingerprint with the current material repair fingerprint.
- A valid mismatch is delegated to the existing stale recovery owner, which invalidates stale downstream evidence and reactivates test-execute.
- No mismatch continues through the normal outcome trust verdict: PASS evidence enters semantic evaluation and failed evidence remains a structural gate failure.
- Malformed or inconsistent authority stops before recovery and leaves artifacts and lifecycle state unchanged.
- Integration gate structural validation now returns a typed assessment; the gate classifies a current-versus-saved fingerprint mismatch before evaluating failed requirement, review, or regression outcomes.
- Stale recovery stages every planned invalidation, resets lifecycle state through the flow manager, then commits artifact removal; mutation failure restores the staged evidence.

### Decisions
- [VERIFY] checkIntegrationTestArtifacts currently returns validateIntegrationArtifactTrust failure before building the current fingerprint or detecting stale evidence; result=match.
- [VERIFY] requirement failures are outcome failures inside the combined trust validator rather than malformed schema; result=match.
- [VERIFY] the existing gate-owned stale recovery resets test-execute through finalize-cleanup and returns previous/current fingerprints plus invalidated artifacts; result=match.
- [VERIFY] rewind-test-evidence independently requires exact target guards and a latest impl-gate ExternalBlockedOutcome; result=match and remains unchanged.
- Choose gate-owned direct recovery for authoritative stale evidence instead of manufacturing an ExternalBlockedOutcome solely to satisfy the separate rewind command.
- Treat schema and ownership checks as higher authority than stale mismatch, while treating failed test outcomes as lower priority once structural authority is proven.
- Existing-feature impact is limited to the integration precheck when structurally authoritative evidence has a stale fingerprint; trusted current evidence, malformed evidence, and explicit rewind guards retain their previous behavior.
- Keep malformed, unowned, invalid raw, stale regression snapshot, placeholder, and inconsistent fingerprint evidence fail-closed before stale classification.
- Reuse StaleTestEvidenceMismatch and the gate-owned StaleIntegrationTestEvidence recovery path instead of weakening explicit rewind-test-evidence authority.

## Clarifications (Q&A)
- Q: Does a failed requirement summary make the artifact malformed?
  - A: No. A failed outcome may still be structurally authoritative. Recovery is allowed only after schema, ownership, evidence, placeholder, and fingerprint invariants are verified.
- Q: Does every failed artifact rewind to test-execute?
  - A: No. Rewind occurs only when both authoritative artifacts carry the same valid fingerprint and the current material repair fingerprint differs.
- Q: Does the integration gate replace rewind-test-evidence?
  - A: No. The gate uses its existing direct stale recovery owner for this precheck mismatch. rewind-test-evidence retains its separate external-blocked recovery authority and guards.
- Q: Can malformed evidence be deleted automatically to unblock the flow?
  - A: No. Malformed or unauthoritative evidence remains a fail-closed structural error and is not used as mutation authority.
- Q: Must task-gate or integration impl-gate require final-regression evidence?
  - A: No. Project test integrity remains mandatory, but both gates run before final-regression. Task-gate inspects test coverage in the diff, integration impl-gate verifies current test-execute and test-result-review evidence, and final-regression later owns the full project suite. A pending final-regression step is therefore expected at either gate and becomes blocking only if its downstream execution fails.

## Alternatives Considered
- Record every trust failure as an ExternalBlockedOutcome and require rewind-test-evidence. — Rejected because malformed failures do not establish stale evidence authority, and authoritative mismatch already has a gate-owned recovery operation.
- Detect mismatch from unvalidated JSON fields before all structural checks. — Rejected because an attacker or corrupted artifact could supply a plausible fingerprint without proving schema, ownership, raw evidence, or placeholder policy.
- Keep trust validation order and relax rewind-test-evidence to accept ARTIFACT_PLACEHOLDER. — Rejected because a generic placeholder failure does not prove the precise stale fingerprint pair or material repair authority required for invalidation.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-24T22:35:26.366Z
- Notes: Auto-approved after spec review PASS and spec gate PASS; user enabled auto mode at preflight.

## Requirements
- R1 [must]: The integration precheck shall distinguish structurally authoritative test evidence from the test outcome verdict so a requirement failure alone does not prevent stale fingerprint classification.
- R2 [must]: When structurally authoritative test-execute and test-result-review artifacts carry the same valid repairFingerprint and it differs from the current material repair fingerprint, the integration gate shall classify the evidence as stale before returning a failed test outcome verdict.
- R3 [must]: Authoritative stale evidence shall use the existing gate-owned recovery operation to invalidate stale downstream evidence and make flow-level test-execute the active step without semantic gate evaluation.
- R4 [must]: A successful stale recovery shall report the previous fingerprint, current fingerprint, invalidated artifact paths, and active step, and its observable artifact and lifecycle mutations shall complete as one owned recovery operation.
- R5 [must]: Missing required inputs, malformed JSON or schema, invalid or inconsistent repairFingerprint values, unowned paths, invalid raw evidence, and placeholder-policy failures shall remain fail-closed structural trust failures with no stale recovery mutation.
- R6 [must]: Failed test evidence whose repairFingerprint matches the current material repair fingerprint shall retain the existing test artifact validation failure and shall not rewind lifecycle state.
- R7 [must]: Trusted current evidence shall continue to semantic integration gate evaluation, and the explicit rewind-test-evidence command shall retain its exact target guard, ExternalBlockedOutcome, material repair, and artifact ownership requirements.
- R8 [must]: Regression coverage shall exercise failed-but-authoritative stale evidence, malformed and inconsistent authority, unchanged failed evidence, successful recovery effects, trusted current evidence, and unchanged explicit rewind rejection behavior.

## Acceptance Criteria
- [AC1/R1] A schema-valid test-execute artifact containing one or more requirement failures can still reach fingerprint classification after all structural authority checks pass.
- [AC2/R2] Given matching valid artifact fingerprints from before a material implementation repair, the integration precheck identifies stale evidence even though the saved requirement summary or review verdict is failed.
- [AC3/R3] The guarded integration gate command returns a recovered result, skips semantic evaluation, deletes the stale owned evidence set, and promotes test-execute to in_progress while downstream flow leaves become pending.
- [AC4/R4] The recovered result contains the exact previous/current fingerprints, the invalidated artifact list, and activeStep=test-execute; injected mutation failure coverage proves that no successful partial recovery is reported.
- [AC5/R5] Missing files, invalid JSON/schema, missing or invalid fingerprints, different fingerprints between the two test artifacts, invalid evidence ownership, and placeholder-policy violations return structural failure and preserve lifecycle state.
- [AC6/R6] A failed requirement summary with a fingerprint equal to the current repair state returns the existing test artifact validation failure and leaves impl-gate active.
- [AC7/R7] Current trusted PASS evidence still enters semantic gate evaluation, while rewind-test-evidence still rejects missing guards and latest outcomes that are not impl-gate external-blocked.
- [AC8/R8] Spec-local requirement tests and affected shared flow unit tests pass before impl-gate. The downstream final-regression step remains pending at impl-gate by design and must run and pass the full project regression before finalize.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Prioritize authoritative stale recovery
  - Separate structural artifact authority from outcome success in the integration precheck, then route a verified stale fingerprint mismatch through the existing gate-owned recovery while preserving all fail-closed boundaries.
  - see `tasks/T-1.md` for full spec
