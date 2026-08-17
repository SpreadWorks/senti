# Feature Specification: 168-fix-flow-status-spec-mismatch

**Feature Branch**: `feature/168-fix-flow-status-spec-mismatch`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User request

## Goal

`sdd-forge flow get status` を「現在の作業コンテキスト自身の flow 状態を返す専用コマンド」として明確化し、未定義オプション利用による誤作動を防止する。

## Scope

- `flow get` サブコマンドで未定義オプションを受け付けない挙動に統一する。
- `sdd-forge flow get status` に未定義オプションが指定された場合、ERROR（exit code 1）で終了する。
- エラーメッセージで `flow get status` の正しい使い方と `--help` を案内する。
- `flow get status` が「自身状態専用」であることを help / skill 文言に明記する。
- `flow resume` との責務分離（探索・復旧 vs 現在状態表示）を文書化する。

## Out of Scope

- `flow get status --spec` の新規サポート追加。
- `resume` の探索ロジック変更。
- guardrail 判定ロジックそのものの仕様変更。

## Clarifications (Q&A)

- Q: `flow get status` に `--spec` を正式追加するか？
  - A: しない。`get status` は自身状態専用とする。
- Q: 未定義オプション発生時の扱いは？
  - A: ERROR + help案内。終了コードは 1。
- Q: `resume` との関係は？
  - A: `resume` は探索・復旧、`get status` は現在状態表示に限定。
- Q: まず優先すべき防止策は？
  - A: エージェントが勝手に未定義オプションを付与しない運用/文言の厳格化。

## Alternatives Considered

- `get status --spec` を正式対応する案
  - 不採用理由: `resume` と責務が重複し、コマンド責務の境界が曖昧になるため。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: approved by user in flow-plan approval step.

## Requirements

- R1. `flow get` 実行時、登録されていないオプションが指定された場合は失敗し、コマンドは実行されないこと。
- R2. `sdd-forge flow get status` に未定義オプションが与えられた場合、ERROR を返しプロセス終了コードが 1 になること。
- R3. R2 のエラーメッセージには、`sdd-forge flow get status` と `sdd-forge flow get status --help` の案内を含めること。
- R4. `sdd-forge flow get status` の help および関連 skill 文言に「自身状態専用（対象 spec の切替不可）」を明記すること。
- R5. `flow resume` の説明に `get status` との責務分離を記載し、用途混同を防ぐこと。

## Acceptance Criteria

- AC1. `sdd-forge flow get status --spec xxx` 実行時、コマンドは失敗し `ok:false` + 終了コード 1 となる。
- AC2. AC1 のエラーメッセージに help 案内が含まれる。
- AC3. `sdd-forge flow get status`（オプションなし）は従来どおり active flow の状態を返す。
- AC4. `flow-plan` / `flow-impl` で `get status` の用途が自身状態確認として一貫して記述される。

## Open Questions

- None.
