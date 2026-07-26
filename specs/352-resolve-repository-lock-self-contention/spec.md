# Feature Specification: 352-resolve-repository-lock-self-contention

**Feature Branch**: `feature/352-resolve-repository-lock-self-contention`
**Created**: 2026-07-26
**Status**: Draft
**Input**: GitHub Issue #474

## Goal
flow の一回の実行が自分自身の repository operation lock と競合して停止しないようにし、draft review の完了状態も gate が一意に判定できるようにする。

## Background
Issue #474 では、dispatcher が repository operation lock を保持して command lifecycle を実行中に runtime log metadata を保存すると、内側の AtomicFlowStateWriter が別の RepositoryFlowOperationLock を取得しようとする。operation owner token が伝播されないため、自分自身が保持する live lock を外部競合として扱い flow が停止した。調査中、draft review artifact が review step 名で保存される一方で parent promotion と gate が retry phase を要求する不整合、および coverage PASS で approval が確定しない不整合も確認された。これらは #474 の正常な flow 続行を妨げる同一の control path 上の停止要因である。

## Scope
- 同一 Node.js process 内で入れ子に取得される repository flow operation lock の所有権共有
- dispatcher が command body、post-condition、outbox、runtime metadata を永続化する経路での lock 再取得
- draft questions/coverage review artifact の正規 phase 名と gate validator の整合
- coverage review が finding なしで完了したときの draft approval 確定
- lock 競合と draft lifecycle を対象にした回帰テスト

## Out of Scope
- 他 process が保持する live lock を待機または強制解放する仕様変更
- repository maintenance lock 以外の lock 実装の統合
- 外部依存の追加
- Issue #474 と無関係な flow の操作手順変更

## Constraints
- 外部 process、未知の owner token、破損した lock file は従来どおり fail-closed で拒否する。
- 同一 process の借用は、現在の lock file の owner token と process 内で記録した owner token が一致するときに限る。
- retry は既存 flow の step ごとの最大試行回数を超えて追加実行せず、同じ outbox entry の再開でも command body、commit、同期、outbox の durable side effect を重複させない。
- Node.js 組み込みモジュールだけを使用する。

## Design Principles
- lock の所有権と借用可否は RepositoryFlowOperationLock に閉じ込め、呼び出し側が lock file を直接解釈しない。
- artifact の phase は lifecycle が定義する正規の retry phase を唯一の保存値にする。
- approval は coverage route が完全に解決された事実から決定し、gate が推測しない。
- 競合エラーは owner、requester、operation boundary を診断可能な構造で保持する。

## Overview
### Modules
- src/lib/repository-maintenance-lock.js: repository operation lock の取得、同一 process 内借用、解放、競合診断を一元管理する。
- src/lib/dispatcher.js: command lifecycle の runtime metadata 永続化を、現在の operation ownership と同じ境界で実行する。
- src/flow/commands/review.js: draft review artifact を lifecycle が再実行に使う正規 phase で保存する。
- src/flow/lib/run-gate.js: draft review artifact を正規 phase で検証し、古い UI 用 step 名を要求しない。
- src/flow/definition.js: coverage review が finding なしで終了した事実を draft approval に反映する。
- draft review lifecycle persists artifacts by retry phase and confirms resolved coverage approval.
- RepositoryFlowOperationLock tracks per-path process ownership and borrows only a matching visible owner.
- RepositoryLockContention carries the owner, requester, operation, and acquisition boundary for live foreign operation-lock conflicts.

### Data Flow
- dispatcher が repository operation lock を取得して command lifecycle を開始する。
- command body、post-condition、outbox、runtime metadata の各 durable mutation は同じ process owner を借用し、外部 owner には競合エラーを返す。
- draft review は route の retry phase を artifact に保存し、gate は同じ phase を使って artifact の完全性を検証する。
- coverage route が finding なしで終了し、未解決の draft question がなければ definition hook が approval を確定し、draft gate が通過する。
- A finding-free coverage route writes empty route artifacts and commits approval only when draft QA is resolved.
- A dispatcher-owned operation lock remains visible while nested durable runtime metadata mutations borrow that same owner token.
- A foreign live operation owner is inspected before acquisition, and its conflict is enriched with a fresh requester identity without weakening unknown or corrupt lock rejection.

### Decisions
- [VERIFY] draft の owner-token borrowing 方針を確認した。RepositoryFlowOperationLock は既存 owner と token が一致する場合だけ borrowed として扱うため、process-local registry でこの既存契約を dispatcher の入れ子操作へ適用する。
- [VERIFY] draft review artifact は lifecycle の retry phase を唯一の保存識別子にする。review step 名を保存すると parent promotion と gate が参照する phase と一致しない。
- [VERIFY] coverage PASS による approval は definition hook で確定する。gate は状態遷移を推測せず、完了済み draft の検証だけを行う。
- 既存の foreign/unknown/corrupt lock の fail-closed 動作と既存 flow の step retry 上限は維持する。影響範囲は同一 invocation の正当な lock 再入、draft artifact phase、coverage approval の停止解消に限定する。
- Draft route artifact identity uses retry phase consistently across review persistence and gate validation.
- Process-local ownership is keyed by the repository operation lock path, and only the owning release removes the registry entry.
- Structured contention diagnostics are attached only to live repository flow-operation busy errors so fail-closed unknown and corrupt owner outcomes remain authoritative.

## Clarifications (Q&A)
- Q: 同一 process の再入だけを許可する根拠は何か。
  - A: runtime metadata 永続化は dispatcher が保持する同一 invocation の後続 mutation である。process 外の owner を許可すると実行中 command の排他性を失うため、registry に記録された owner token との一致を必須にする。
- Q: coverage PASS で approval を確定してよい条件は何か。
  - A: draft question に pending または approved が残らず、coverage route が finding なしで完了した場合に限る。

## Alternatives Considered
- runtime metadata 保存の前後で外側 lock を解放してから再取得する — 解放中に外部 process が割り込めるため、command lifecycle の排他性と retry idempotency を保証できない。
- すべての lock 競合を同一 process とみなして借用する — stale または外部 owner の live lock を誤って突破し、repository state を同時更新する危険がある。
- gate が artifact の review step 名と retry phase の両方を受け入れる — alpha 版で旧フォーマットを残さず、lifecycle の単一正規識別子を守るため。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-26T02:30:08.737Z
- Notes:

## Requirements
- R1 [must]: RepositoryFlowOperationLock は、同一 Node.js process が保持中の lock file と同じ owner token を確認できる場合に限り、入れ子の operation を借用として取得できる。借用を解放しても外側の owner が解放するまで lock file は残る。
- R2 [must]: dispatcher の command lifecycle における runtime metadata を含む durable mutation は、同じ invocation の operation ownership を維持して完了する。lock 再入のためだけに command body、post-condition、outbox、commit、同期を再実行してはならない。
- R3 [must]: 他 process の live lock、未知の owner token、または破損した lock file に対する取得は成功してはならず、競合エラーから lock path、保持 owner、要求 owner、発生した operation boundary を判別できる。
- R4 [must]: draft questions と draft coverage の review artifact は lifecycle の retry phase で保存・検証され、review step 名との不一致で STALE_REVIEW_TARGET にならない。
- R5 [must]: coverage review が finding なしで完了し、pending または approved の draft question が残っていない場合、draft approval は coverage route の完了時刻で approved に遷移し、draft gate はその状態を通過させる。
- R6 [must]: lock 借用、外部競合拒否、draft artifact phase、coverage PASS approval を自動テストで検証し、各テストは対応する requirement ID を宣言する。

## Acceptance Criteria
- 同一 process の外側と内側の RepositoryFlowOperationLock を順に取得しても例外にならず、内側の release 後は外側が解放するまで lock file が残る。
- 別 process 相当の owner token を持つ live lock は借用されず、競合エラーに診断情報が含まれる。
- dispatcher の runtime metadata 保存を含む command lifecycle の回帰テストが RepositoryLockError なしで成功し、再試行時の durable side effect が一度だけであることを確認する。
- draft questions/coverage review artifact の phase と gate validator の期待値が一致し、artifact promotion が STALE_REVIEW_TARGET で失敗しない。
- finding のない coverage review route の hook 実行後、未解決 question がなければ draft.json の approval.approved が true で confirmedAt が route 完了時刻になる。
- 対象ユニットテストと spec 配下の requirement traceability test がすべて成功する。

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T1** [pending]: Normalize draft review lifecycle metadata
  - draft review artifact の保存値、gate 検証値、coverage PASS の approval 遷移を lifecycle の正規状態に統一する。
  - see `tasks/T1.md` for full spec
- **T2** [pending]: Coordinate in-process repository operation ownership
  - 同一 invocation の入れ子 durable mutation が repository operation lock を安全に借用できるようにする。
  - see `tasks/T2.md` for full spec
- **T3** [pending]: Diagnose repository lock contention boundaries
  - 拒否された repository operation lock が、復旧判断に必要な owner と operation boundary を一貫して報告するようにする。
  - see `tasks/T3.md` for full spec
