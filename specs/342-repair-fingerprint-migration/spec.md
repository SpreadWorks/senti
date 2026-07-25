# Feature Specification: 342-repair-fingerprint-migration

**Feature Branch**: `feature/342-repair-fingerprint-migration`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #464

## Goal
既存 active flow の旧 canonical 規則で hash 済みの repair fingerprint version 2 artifact を version 3 へ移行し、integration gate が guarded recovery として test-execute を再実行できるようにする。

## Background
旧 implementation は statuses と indexOid を含む canonical input で repair-fingerprint.json version 2 を hash した。current code は同じ version 2 のまま両 field を canonical input から除外したため、rebase 後の existing active flow が旧 manifest を読むと hash mismatch で integration gate が stale-evidence recovery 前に停止する。既存 legacy migration は repairBaseline がない flow を対象にするため、baseline を持つ flow を version 3 へ変換し、downstream evidence を再生成する recovery が必要である。

## Scope
- repair fingerprint manifest の format version 3 と旧 version 2 migration input の定義
- baseline を持つ active flow の guarded migration、migration record、downstream evidence invalidation、test-execute 復帰
- repair-state migration と integration gate recovered 結果の unit / integration regression coverage

## Out of Scope
- version 2 以外の historical artifact format の対応
- 利用者に hash mismatch artifact の手編集または手削除を求める回避策
- repair fingerprint と無関係な flow lifecycle、docs 生成、外部依存の変更

## Constraints
- Node.js built-in modules と既存の atomicWriteJson、RepairRunLock、FlowManager mutation を使用し、外部依存を追加しない。
- 旧 version 2 は migration input としてのみ受け入れ、migration 完了後の current contract は version 3 とする。
- migration が完了しない場合は既存 manifest と downstream evidence を削除せず、破損・未対応 artifact は fail closed にする。
- migration state と manifest の構造は専用 class の constructor invariant で表現する。

## Design Principles
- canonical hash input を変更する場合は manifest format version を同時に変更し、旧 version の変換を明示する。
- migration record は source/target format、対象 run、無効化した evidence、復帰 step を保存し、flow state transition と一致させる。
- existing flow の public recovery surface である senti flow run gate は、migration 後に recovered と test-execute を返す。

## Overview
### Modules
- src/flow/lib/repair-state-identity.js: versioned RepairFingerprintManifest と legacy version 2 canonical hash の検証・version 3 manifest 生成を所有する。
- src/flow/lib/impl-repair-artifacts.js: active flow の migration record、evidence invalidation、guarded test-execute recovery を所有する。
- tests/unit/flow/repair-state-identity.test.js と integration gate lifecycle coverage: legacy v2 migration と user-facing gate recovery を検証する。
- src/flow/lib/repair-state-identity.js owns v3 repair-fingerprint manifests and verified legacy-v2 migration inputs.
- src/flow/lib/impl-repair-artifacts.js records and resumes guarded v2-to-v3 repair-fingerprint migrations.
- src/flow/lib/run-gate.js short-circuits integration gating with a recovered/test-execute result after a successful fingerprint migration.
- tests/unit/flow/repair-state-identity.test.js exercises the shared integration-gate recovery contract.

### Data Flow
- 旧 version 2 manifest → legacy canonical hash 検証 → version 3 manifest と migration record の保存 → stale downstream evidence の invalidation → flow state の test-execute in_progress → integration gate の recovered output
- repair-fingerprint.json flows through a version-specific manifest class to either current v3 evidence or a verified v2 migration input.
- Verified v2 manifest -> prepared migration record and v3 manifest -> flow-state reset plus evidence invalidation -> completed audit record.
- Integration gate -> guarded repair-fingerprint migration -> recovered result with next=test-execute, without semantic gate evaluation.

### Decisions
- [VERIFY] repair fingerprint の current version は 2 で、CanonicalRepairEntry.canonicalParts() は statuses と indexOid を hash 入力から除外している。format version を変えないため、旧 v2 artifact は新 constructor で hash mismatch になる。
- [VERIFY] ensureRepairFingerprintContract() は migration file がなく repairBaseline がある active flow を未移行として返す。そのため v2→v3 migration は existing baseline を持つ flow を明示的に処理し、既存 migration の invalidation と test-execute reset を利用する。
- Impact on existing features: current repair-fingerprint.json readers move from version 2 to version 3; old v2 active flows with repairBaseline change from integration-gate hash-mismatch failure to recovered/test-execute; current v3 flows retain normal manifest reading; malformed or unsupported artifacts retain fail-closed behavior.
- 旧 v2 の継続読取を current contract に残さない。v2 は migration input、v3 は migration 後の current manifest として区別する。
- Version 2 parsing is migration-only; current evidence readers accept only version 3 to keep one canonical current contract.
- A version-2 migration record remains after successful baseline-bearing recovery; old baseline-less recovery continues to use a removable journal.
- The recovered result uses the existing evidenceRefresh.recovered hook shape so lifecycle post-hooks do not advance the repaired flow.

## Clarifications (Q&A)
- Q: 旧 format の対応範囲は何か。
  - A: version 2 の旧 canonical hash 規則だけを migration input とする。version 1 や未定義の format は対応範囲外である。
- Q: migration failure 時の evidence はどう扱うか。
  - A: current manifest と migration record の保存前に downstream evidence を削除しない。破損・未対応 artifact は fail closed にして operator action を要求する。

## Alternatives Considered
- version 2 のまま旧・新 canonical hash rules を同時に受け入れる。 — 同じ format version に複数の canonical contract が残り、artifact の解釈と将来 migration の基準が不定になるため採用しない。
- 利用者が hash mismatch artifact を削除して flow を再開する。 — migration record と guarded recovery を残せず、Issue #464 が禁止する手編集・手削除に依存するため採用しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T08:29:45.570Z
- Notes: auto: preflight accepted by user; spec and gate checks passed.

## Requirements
- R1 [must]: Repair fingerprint の current format を version 3 とし、version 2 artifact を legacy canonical hash 規則で検証して migration input として識別する。
- R2 [must]: readable な version 2 manifest を version 3 manifest へ変換する migration record は、runId、specPath、sourceVersion、targetVersion、invalidated artifact paths、reset step を保存する。
- R3 [must]: repairBaseline を持つ active flow が旧 version 2 artifact を検出した場合、guarded mutation で stale downstream evidence を無効化し、test-execute を in_progress にし、integration gate は recovered と next=test-execute を返す。
- R4 [should]: migration が current format manifest、破損 artifact、未対応 format を区別し、current format は従来どおり読取でき、破損または未対応 artifact は evidence を削除せずエラーにする。
- R5 [must]: specs/342-repair-fingerprint-migration/tests/ 配下の test file に // spec: R1 から // spec: R5 の header を付け、version 2 migration、migration record、guarded integration gate recovery、current format regression を shared regression tests と併せて検証する。

## Acceptance Criteria
- A fixture with a legacy canonical-hash version 2 manifest produces a readable version 3 manifest whose hash matches the current canonical state.
- The persisted migration record contains runId, specPath, sourceVersion=2, targetVersion=3, invalidated artifact paths, and resetStep=test-execute.
- An existing active flow with repairBaseline reaches integration gate recovery without manually editing or deleting repair-fingerprint.json; gate output reports recovered and next=test-execute, and flow state marks test-execute in_progress.
- A current version 3 manifest remains readable, while malformed or unsupported manifests fail without removing existing evidence files.
- specs/342-repair-fingerprint-migration/tests/ の test file は // spec: R1 から // spec: R5 の header を持ち、spec-local tests と shared migration/integration gate regressions が pass する。

## Implementation Targets
- src/flow/lib/repair-state-identity.js
- src/flow/lib/impl-repair-artifacts.js
- specs/342-repair-fingerprint-migration/tests/repair-fingerprint-migration.test.js (// spec: R1 through R5)
- tests/unit/flow/repair-state-identity.test.js
- integration gate lifecycle regression tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Version repair fingerprint manifests
  - 旧 canonical hash 規則で作成された version 2 manifest を migration input として検証し、current contract を version 3 として表現する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Migrate legacy repair state
  - repairBaseline を持つ active flow の v2 artifact を guarded migration で v3 と migration record に置換し、test-execute へ復帰させる。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover migration recovery
  - legacy v2 artifact を含む existing active flow が integration gate から recovered/test-execute に到達する回帰証跡を追加する。
  - see `tasks/T-3.md` for full spec
