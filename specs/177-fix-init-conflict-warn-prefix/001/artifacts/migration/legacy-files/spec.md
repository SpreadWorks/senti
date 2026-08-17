# Feature Specification: 177-fix-init-conflict-warn-prefix

**Feature Branch**: `feature/177-fix-init-conflict-warn-prefix`
**Created**: 2026-04-14
**Status**: Ready for Approval
**Input**: Issue #149 — init conflictsExist メッセージの ERROR プレフィックス不整合

## Goal
- `sdd-forge docs init` が既存ファイルと conflict を検出した際に出力する通知メッセージを、sdd-forge 内の「既に存在する」系通知の既存慣習と整合させ、CI 等の汎用的なログスキャンで「エラー」として誤検知されないようにする。

## Scope
- conflict 検出時通知メッセージのプレフィックス文字列を、全サポートロケールで警告レベル表記（`WARN:`）に揃える。
- プレフィックスが期待通りであることを保証する spec ローカル検証テストの追加。

## Out of Scope
- プロセスを停止する真のエラーメッセージ（`noType`, `noTemplates` 等）のプレフィックス見直し。
- ログ出力ヘルパーの再設計、構造化ログレベル API の導入。
- conflict 検出・スキップ・終了コード等、通知出力以外のロジック変更。

## Clarifications (Q&A)
- Q: `INFO:` / `NOTE:` 等のレビュアー提案プレフィックスではなく `WARN:` を選ぶ理由は？
  - A: sdd-forge 内には既に「既に存在する」系通知を `WARN:` で出す慣習が存在し、既存慣習との整合性を優先するため。
- Q: 全ロケールを同時に変更する必要があるか？
  - A: ある。ロケール間でプレフィックス表記が割れることは、ログスキャンの一貫性を損なう。

## Alternatives Considered
- `INFO:` / `NOTE:` プレフィックス（レビュアー提案）— 最終決定: 却下。既存慣習との不整合。
- プレフィックスなし — 最終決定: 却下。他 notification 系との混在を生む。
- 構造化ログレベル API 導入 — 最終決定: 却下。スコープ外の大規模変更で、issue のゴール（誤検知解消）を超える。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-14
- Notes: autoApprove モードで承認。gate PASS 済み。

## Requirements
- **R1 (P1 / Must):** When `sdd-forge docs init` が既存ファイルとの conflict を検出し通知メッセージを出力するとき, the system shall 当該メッセージのプレフィックスとして「エラー」を示す語（`ERROR:`）を使用しない。
- **R2 (P1 / Must):** If conflict 検出時の通知メッセージを出力する, the system shall プロジェクト内の他の「既に存在する」系通知と同じ警告プレフィックス（`WARN:`）を使用する。
- **R3 (P1 / Must):** If 通知メッセージが複数ロケールで提供される, the system shall 全ロケールで同一のプレフィックス表記を使用する。
- **R4 (P1 / Must):** When conflict を検出してもプロセスが正常終了する, the system shall 既存の検出・スキップ・書き込み・終了コードの振る舞いを変更しない。

## Acceptance Criteria
- AC1: conflict 検出時通知の ja ロケール文字列が `ERROR:` で始まらず、`WARN:` で始まる。
- AC2: conflict 検出時通知の en ロケール文字列が `ERROR:` で始まらず、`WARN:` で始まる。
- AC3: ja / en の conflict 検出時通知が同一のプレフィックス表記を持つ。
- AC4: conflict 検出シナリオでプロセスの終了コード・スキップ動作・書き込み対象が変更前と同一である。

## Test Strategy

### テストレベル
- **Unit レベル（spec ローカル）:** i18n メッセージテーブルから conflict 通知文字列を読み出し、プレフィックスの検査を直接行う。プロダクトコードの関数を単体で検査するレベル。

### テスト配置
- `specs/177-fix-init-conflict-warn-prefix/tests/` 配下に spec 検証テストとして配置する。このテストは本 spec の要件充足を確認する bug 再現テストであり、長期メンテ対象の formal test ではないため（SDD テスト配置ルールに従う）。
- 実行: `node specs/177-fix-init-conflict-warn-prefix/tests/<filename>` の形で直接実行できること。
- 公式テストスイート（`npm test`）からは除外される。

### テスト手法
- Node.js 標準 `node:test` / `node:assert` を使用（プロジェクト方針: 外部依存禁止）。
- ja / en の locale メッセージファイルを直接読み込み、`conflictsExist` キーの値文字列に対して以下を検証する:
  - `ERROR:` で始まらない
  - `WARN:` で始まる
  - ja / en のプレフィックス表記が完全一致する

### テスト実行タイミング
- 実装直後に手動実行し、全ケース PASS を確認する。
- 実行ログは `<workDir>/logs/test-output.log` にリダイレクトして保存する。

### 既存機能への影響検証
- AC4（既存の終了コード・スキップ動作の不変性）は、文言変更のみで動作ロジックが変わらないことが自明であるため、追加の統合テストは行わない。変更差分レビューで十分。

## Open Questions
- なし
