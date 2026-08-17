# Feature Specification: 190-fix-pipeline-os-import

**Feature Branch**: `feature/190-fix-pipeline-os-import`
**Created**: 2026-04-18
**Status**: Approved
**Input**: Issue #170 — tests/acceptance/lib/pipeline.js の Node.js 標準 module (`os`) の import 漏れにより、baseline で 2 受け入れテストが `ReferenceError` で失敗している問題の修正。

## Goal
- `tests/acceptance/lib/pipeline.js` が参照する Node.js 標準 module の import 不備を解消し、baseline で失敗している受け入れテスト 2 件 (`acceptance report: pipeline traceability` / `acceptance report: JSON output`) を PASS 状態に復旧させる。

## Scope
- 受け入れテストヘルパー `tests/acceptance/lib/pipeline.js` における Node.js 標準 module 参照の不備解消。

## Impact on Existing Features
- **production code (`src/`)**: 影響なし。参照もないため差分は発生しない。
- **他テストファイル**: 影響なし。本修正はヘルパー 1 ファイルの import 追加のみで、他テストの挙動・期待値は変更しない。
- **CI / acceptance スイート全体**: 影響なし (むしろ従来 baseline で失敗していた 2 件が復旧する改善方向)。
- **ドキュメント / API / CLI**: 影響なし。

## Out of Scope
- production code (`src/`) への変更。
- 他テストファイル全般の import 監査。
- テストフレームワーク・実行環境の整備。
- Issue #170 報告以外の既存テストの挙動変更。

## Clarifications (Q&A)
- Q: 検証方法は該当 2 テストのみで十分か、全体スイート実行まで行うか。
  - A: 該当 2 テストのみで十分 (ユーザ選択 Q2=[1])。本 spec のスコープはヘルパーの import 不備解消に限定され、全体スイートはリグレッション検出目的の別活動となるため。

## Alternatives Considered
- **代替1 (不採用)**: 標準 module 参照を排し、テンポラリディレクトリ取得を別手段 (環境変数等) に置き換える。
  - 却下理由: 既存実装は標準 module 利用を前提としており、本件は欠陥補修であって設計変更ではない。影響範囲を最小に保つべき。
- **採用**: 不足している標準 module の import を補う最小修正。
  - 採用理由: Issue #170 の指示、CLAUDE.md の過剰変更回避方針、alpha 版ポリシーのいずれとも整合する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-18
- Notes: draft 承認後、ユーザは「後は任せた」と追加指示。auto 継続の方針で進行。

## Requirements
- **R1**: 受け入れテストヘルパー `tests/acceptance/lib/pipeline.js` は、本文中で参照している Node.js 標準 module の import がすべて揃った状態でなければならない。
  - Trigger: `node tests/run.js` もしくは該当テスト単独実行時
  - Shall: ファイル内で参照される標準 module について `ReferenceError` を発生させない。
- **R2**: baseline (main) で失敗していた受け入れテスト 2 件 (`acceptance report: pipeline traceability` / `acceptance report: JSON output`) は、本修正後に PASS しなければならない。
  - Trigger: 修正適用後にテストランナーで該当 2 テストを実行
  - Shall: 両テストとも PASS し、`ReferenceError: os is not defined` を再現してはならない。
- **R3**: production code (`src/`) には変更が波及してはならない。
  - Trigger: 変更差分レビュー時
  - Shall: `src/` 配下のファイル差分は 0 でなければならない。

## Acceptance Criteria
- [ ] `tests/acceptance/lib/pipeline.js` の import 群に不足が無く、本文参照との整合性が取れていること。
- [ ] `acceptance report: pipeline traceability` テストが PASS する。
- [ ] `acceptance report: JSON output` テストが PASS する。
- [ ] `src/` 配下の差分が 0 であること (`git diff --stat main -- src/` で確認)。
- [ ] テスト実行ログが `.tmp/logs/` 配下の指定ファイルに保存されていること。

## Open Questions
- (なし)
