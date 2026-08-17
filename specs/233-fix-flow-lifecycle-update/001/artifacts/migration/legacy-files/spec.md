# Feature Specification: 233-fix-flow-lifecycle-update

**Feature Branch**: `feature/233-fix-flow-lifecycle-update`
**Created**: 2026-04-27
**Status**: Draft
**Input**: GitHub Issue #268

## Goal
flow.json の lifecycle フィールドを廃止し、finalize step の done 遷移漏れを修正する。

## Background
flow.json の lifecycle フィールドは run-prepare-spec.js で "active" に設定されるが、finalize 完了後に "completed" に更新するコードが存在しない。全 283 件の flow.json で lifecycle: "completed" は 0 件。changelog コマンドが lifecycle を status 列に使用しており、全 spec が "active" と表示される不具合がある。また finalize step が in_progress のまま残るケースが 89 件ある。

調査の結果、lifecycle フィールドは active-flow レジストリと state.finalizedAt の冗長コピーであり、独自の判定根拠を持たないことが判明。遷移を実装するのではなく廃止する。

## Scope
- [must] run-prepare-spec.js — lifecycle: "active" 削除
- [must] run-finalize.js — cleanup 前に finalize step を done に遷移
- [must] changelog.js — state.finalizedAt ベースに変更
- [must] get-status.js — lifecycle 出力削除
- [should] run-reopen-draft.js — lifecycle ガード削除
- [should] run-resume.js — lifecycle 出力削除
- [should] registry.js — help テキスト更新
- [must] テスト更新（flow-state-runid, changelog）

## Out of Scope
- preparing-flow-store.js の lifecycle: "preparing" は変更しない（get-status の preparing 判定で使用中）
- 既存 flow.json の一括修復は行わない（読まなくなるため害なし）

## Constraints
- preparing-flow-store.js の lifecycle: "preparing" は残す（get-status.js:98 の autoApprove 判定で使用中）
- flow.json の既存 lifecycle フィールドは放置（スキーマバリデーションで拒否しない）

## Design Principles
- 冗長な状態フィールドを廃止し、single source of truth (active-flow registry, state.finalizedAt) に統一する

## Overview
### Modules
- src/flow/lib/run-finalize.js — finalize step の done 遷移追加
- src/flow/lib/run-prepare-spec.js — lifecycle フィールド削除
- src/docs/commands/changelog.js — status 判定を finalizedAt ベースに変更
- src/flow/lib/get-status.js — lifecycle 出力削除
- src/flow/lib/run-reopen-draft.js — lifecycle ガード削除
- src/flow/lib/run-resume.js — lifecycle 出力削除

### Data Flow
finalize pipeline: commit → merge → sync → (show-report done) → (finalize done) → cleanup

### Decisions
- D-1: lifecycle フィールドを廃止する。active-flow レジストリと state.finalizedAt が同じ情報を提供しており冗長。全 283 件で一度も正しく遷移していないのに問題が起きなかった事実が裏付け。
- D-2: finalize step の done 遷移を show-report と同パターン（cleanup 前に updateStepStatus）で実装する。

## Clarifications (Q&A)
- Q: lifecycle フィールドは判定に使われているか？
  - A: get-status.js:98 の preparing 判定と run-reopen-draft.js:49 のガードの 2 箇所。いずれも廃止で壊れない。

## Alternatives Considered
- lifecycle 遷移の実装 — 冗長フィールドの維持コストが発生するだけなので廃止を選択
- 既存 flow.json の一括修復コマンド — lifecycle を読まなくなるため不要

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-27
- Notes:

## Requirements
- R1 [must]: run-prepare-spec.js が flow.json 作成時に lifecycle フィールドを書き込まない
- R2 [must]: run-finalize.js の cleanup 実行前に finalize step を done に遷移する
- R3 [must]: changelog.js が state.finalizedAt の有無で status ���判定する（finalizedAt 有 → "completed"、無 → "active"）
- R4 [must]: get-status.js の出力から lifecycle フィールドを削除する
- R5 [should]: run-reopen-draft.js から lifecycle ガードを削除する
- R6 [should]: run-resume.js の出力から lifecycle フィールドを削除する
- R7 [should]: registry.js の help テキストから lifecycle への言及を削除する

## Acceptance Criteria
- flow prepare で作成された flow.json に lifecycle フィールドが存在しない
- flow run finalize 完了後の flow.json で finalize step の status が done である
- sdd-forge docs changelog が state.finalizedAt の有無で status を判定し、finalize 済み spec を completed と表示する
- flow get status の出力に lifecycle フィールドが含まれない
- 既存の lifecycle フィールドを持つ flow.json を読み込んでもエラーにならない

## Implementation Targets
- src/flow/lib/run-finalize.js
- src/flow/lib/run-prepare-spec.js
- src/docs/commands/changelog.js
- src/flow/lib/get-status.js
- src/flow/lib/run-reopen-draft.js
- src/flow/lib/run-resume.js
- src/flow/registry.js

## Impact on Existing Features
- changelog コマンドの status 列が lifecycle ではなく finalizedAt ベースになる
- flow get status の出力から lifecycle フィールドが消える
- flow run resume の出力から lifecycle フィールドが消える

## Test Strategy
- unit: finalize pipeline 実行後に finalize step が done であることを検証
- e2e: changelog.test.js の fixture を更新し finalizedAt ベースの status 判定を検証
- unit: flow-state-runid.test.js の lifecycle 永続化テストを更新

## Open Questions
(none)
