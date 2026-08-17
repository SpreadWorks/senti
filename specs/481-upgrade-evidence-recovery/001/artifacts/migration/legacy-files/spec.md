# Feature Specification: 481-upgrade-evidence-recovery

**Feature Branch**: `feature/481-upgrade-evidence-recovery`
**Created**: 2026-07-28
**Status**: Draft
**Input**: GitHub Issue #481

## Goal
stale test evidence recovery の後、upgrade-required な変更に対する current upgrade evidence を正規 lifecycle で回復し、手動の senti upgrade なしで impl-gate へ到達可能にする。

## Background
stale recovery は downstream artifact として upgrade-result.json と raw upgrade log を無効化する。しかし canonical lifecycle は test-execute へ戻るだけで、upgrade-required source change に必要な evidence を再生成する owner を持たない。このため impl-gate の validateUpgradeEvidenceForGate が missing artifact を fail-closed で返し、利用者が毎回手動で senti upgrade を実行する状態になっている。既存の artifact validation と stale recovery owner を保ったまま、current state に必要な upgrade evidence を canonical path が復元する必要がある。

## Scope
- stale recovery が無効化した upgrade-result.json と tests/.raw/upgrade.log の再利用、再公開、または再生成責務。
- test-execute から impl-gate へ戻る canonical path と upgrade evidence validation の整合。
- recovery decision の監査 evidence、および preserve、reuse、regenerate、missing、stale の回帰テスト。

## Out of Scope
- upgrade-required source detection の緩和。
- stale、missing、malformed upgrade evidence の fail-open 化。
- Issue #458 が扱う repair manifest、ledger、delta の transaction continuity。
- 外部 dependency の追加。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- upgrade evidence の再利用は、current repair fingerprint、current checkedPaths、flow target authority が一致し、upgrade-result.json が schema-valid で参照する raw upgrade log が存在する場合だけ許可する。
- upgrade-required source path がない場合は upgrade command を実行せず、upgrade result artifact を impl-gate の前提にしない。
- missing、malformed、failed、stale、または authority が一致しない upgrade evidence は fail-closed のまま扱い、旧 evidence を current evidence として受理しない。
- recovery decision と artifact mutation は同じ canonical owner の下で記録し、呼び出し側に手動 senti upgrade を要求しない。
- 意味のある recovery decision、evidence authority、result は専用クラスで invariant と振る舞いを表現する。

## Design Principles
- upgrade evidence の必要性判定、検証、再生成、監査を 1 つの lifecycle responsibility にまとめ、gate 側に手作業 fallback を追加しない。
- 既存の validateUpgradeEvidenceForGate が持つ checkedPaths と raw log の fail-closed contract を保持し、再利用可否を結果の存在だけで判断しない。
- recovery 後の canonical path は current state の evidence を再構築し、古い artifact を保存して gate を通過させない。

## Overview
### Modules
- src/flow/lib/impl-repair-artifacts.js owns repair transactions, artifact invalidation, lifecycle reset, and issue-log evidence.
- src/flow/lib/stale-test-evidence-refresh.js validates stale fingerprint pairs and delegates the owned recovery operation.
- src/flow/lib/test-artifacts.js detects upgrade-required changed paths, writes upgrade result/raw-log artifacts, and validates gate evidence.
- src/flow/lib/run-gate.js owns integration precheck orchestration before semantic impl-gate evaluation.
- src/flow/definition.js defines test-execute before impl-gate in the canonical lifecycle.
- UpgradeEvidenceRecovery owns current upgrade-evidence validation, regeneration authority binding, and durable recovery audit records.

### Data Flow
- Stale recovery invalidates downstream artifacts and returns the active lifecycle to test-execute.
- The canonical recovery path determines whether upgrade-required source paths remain for the current state.
- No required paths bypass upgrade execution; required paths reuse only evidence whose authority is current, otherwise regenerate upgrade-result.json and tests/.raw/upgrade.log before impl-gate.
- impl-gate validates the regenerated or reused artifact through the existing fail-closed evidence contract and reads the persisted recovery decision for audit.
- test-execute restores required upgrade evidence before impl-gate, bypassing upgrade execution when no required source paths remain.

### Decisions
- [VERIFY] upgrade evidence validation currently requires a non-empty sorted checkedPaths array, a schema-valid result, and an existing raw log; result=match.
- [VERIFY] stale test evidence recovery delegates invalidation to the impl-repair owner and makes test-execute active; result=match.
- [CORRECTION] current upgrade artifact validation has no repair fingerprint field, so the recovery decision must bind current fingerprint authority separately while retaining the artifact's checkedPaths and raw-log checks.
- The test-execute-to-impl-gate route becomes the single owner for restoring required upgrade evidence after stale invalidation; manual senti upgrade remains unnecessary.
- Existing-feature impact is limited to upgrade-required recovery paths; non-upgrade changes, malformed evidence, and stale authority retain their existing no-upgrade or fail-closed outcomes.
- Raw upgrade logs are authenticated with SHA-256 and reused only with matching current fingerprint, target authority, and checked paths.

## Clarifications (Q&A)
- Q: 既存 upgrade evidence を reuse できる条件は何か。
  - A: current repair fingerprint、current checkedPaths、flow target authority が一致し、result が既存 schema を通過し、result が指す raw upgrade log が存在する場合だけである。
- Q: upgrade-required path が存在しない場合に upgrade-result.json は必要か。
  - A: 不要である。既存の validateUpgradeEvidenceForGate と同じく、current required paths が空なら artifact を要求しない。
- Q: 不正または古い artifact を保持して gate を通過させるか。
  - A: 通過させない。該当 artifact は reuse authority を持たず、canonical regeneration を行えない失敗は fail-closed のまま返す。

## Alternatives Considered
- stale invalidation の対象から upgrade artifacts を除外する。 — Rejected because source change 後に古い evidence を残すと current state と evidence の対応を保証できない。
- impl-gate が missing evidence を検出した時点で利用者に手動 senti upgrade を要求する。 — Rejected because Issue #481 の反復的な閉塞を残し、canonical lifecycle の責務を利用者へ移す。
- missing または stale upgrade evidence を validation なしで再利用する。 — Rejected because checkedPaths、raw log、target authority、current state の fail-closed contract を破る。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-28T12:48:55.630Z
- Notes: User approved the gate-passed Issue #481 spec.

## Requirements
- R1 [must]: stale test evidence recovery の完了後、canonical path は current state の upgrade-required changed paths を判定し、空の場合は upgrade command を実行せず upgrade artifact なしで次の lifecycle step へ進む。
- R2 [must]: upgrade-required changed paths が存在する場合、canonical path は current repair fingerprint、current checkedPaths、flow target authority、schema-valid upgrade-result.json、および既存 raw upgrade log が一致する evidence だけを reuse または preserve する。
- R3 [must]: R2 の一致条件を満たす evidence が存在しない場合、canonical path は impl-gate 前に senti upgrade を実行し、current checkedPaths を持つ upgrade-result.json と tests/.raw/upgrade.log を再生成する。
- R4 [must]: recovery owner は preserve、reuse、regenerate、missing、stale のいずれを選んだか、current fingerprint、checkedPaths、artifact paths、次の active step を flow audit evidence に記録する。
- R5 [must]: impl-gate は current required paths と一致しない checkedPaths、missing raw log、malformed artifact、failed upgrade result、または authority mismatch を fail-closed で拒否し、旧 upgrade evidence を current evidence として受理しない。
- R6 [must]: stale recovery を複数回実行しても、R3 の canonical regeneration が current state 用 evidence を供給し、upgrade-result.json missing を理由に impl-gate が再閉塞しない。
- R7 [must]: spec-local tests は preserve、reuse、regenerate、missing、stale、複数 recovery、upgrade 非対象 path、旧 evidence 拒否を要件ごとに検証し、変更された shared lifecycle contract の回帰テストも更新する。

## Acceptance Criteria
- [AC1/R1] upgrade-required changed paths が空の stale recovery scenario は upgrade command を呼ばず、upgrade artifact を要求せずに進行する。
- [AC2/R2] current fingerprint、checkedPaths、target authority、result schema、raw log が一致する evidence は command を再実行せずに使用され、audit evidence に preserve または reuse と記録される。
- [AC3/R3] required path があり artifact が missing、stale、または authority mismatch の scenario は current checkedPaths を含む upgrade-result.json と tests/.raw/upgrade.log を再生成してから impl-gate へ進む。
- [AC4/R4] recovery audit record は decision、current fingerprint、checkedPaths、artifact paths、次の active step を含む。
- [AC5/R5] malformed result、missing raw log、failed result、stale checkedPaths、または authority mismatch は upgrade evidence validation failure を返し、旧 artifact で gate を通過しない。
- [AC6/R6] 同じ flow で 2 回の stale recovery を起こしても、各 recovery 後の canonical path は impl-gate に必要な current evidence を用意し、manual senti upgrade を要求しない。
- [AC7/R7] specs/481-upgrade-evidence-recovery/tests/ の // spec: R1 ... R7 header を持つ Node test が各 requirement の振る舞いを検証し、変更対象の shared flow lifecycle tests も pass する。

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Restore upgrade evidence recovery
  - Stale recovery 後の test-execute-to-impl-gate canonical path に、current upgrade evidence の reuse 判定または再生成責務を追加する。既存の fail-closed artifact validation と recovery transaction authority を維持する。
  - see `tasks/T-1.md` for full spec
