# Feature Specification: 068-test-restructure

**Feature Branch**: `feature/068-test-restructure`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User request

## Goal
テストディレクトリを unit/e2e に構造化し、SHALLOW/MISSING_COVERAGE テストを改善し、欠落テストを追加することで、テストスイートの品質と保守性を向上させる。

## Scope
1. `tests/unit/` と `tests/e2e/` ディレクトリ作成・53ファイルの振り分け
2. package.json の test スクリプトを `test`, `test:unit`, `test:e2e` に分離
3. SHALLOW テスト5ファイルの書き直し（resolver-factory, data, forge-prompts, forge, process）
4. MISSING_COVERAGE テスト3ファイルの補強（readme, merge, cleanup）
5. 欠落 HIGH の新規テスト3ファイル作成（data-source, text, flow start）

## Out of Scope
- テストフレームワークの導入・変更（Node.js 組み込み test runner を継続使用）
- CakePHP2 preset のテスト追加
- カバレッジツールの導入
- 既存テストのロジック変更（SHALLOW/MISSING_COVERAGE 対象以外）

## Clarifications (Q&A)
- Q: 振り分け基準は？
  - A: Unit=単一モジュール隔離テスト（モック/スタブ使用）、E2E=CLI実行/複数モジュール連携テスト。Mixed は主要な性格で分類。spec 番号付きテストは全て e2e。
- Q: package.json の test スクリプトは？
  - A: `test`（全実行）、`test:unit`（unit のみ）、`test:e2e`（e2e のみ）の3つ。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-17
- Notes: 全要件承認

## Requirements
1. `tests/unit/` を作成し、29ファイルをサブディレクトリ構造を維持して移動する
2. `tests/e2e/` を作成し、25ファイルをサブディレクトリ構造を維持して移動する（新規テスト1ファイル含む）
3. package.json に `test`, `test:unit`, `test:e2e` スクリプトを定義する
4. SHALLOW テスト5ファイルを書き直す
   - `resolver-factory.test.js`: DataSource ロード・overrides マージ・エラーハンドリング
   - `data.test.js`: `{{data}}` ディレクティブ解決の実データ検証
   - `forge-prompts.test.js`: buildForgeFilePrompt アサーション強化
   - `forge.test.js`: プロンプト生成の網羅的テスト
   - `process.test.js`: タイムアウト・大出力テスト
5. MISSING_COVERAGE テスト3ファイルを補強する
   - `readme.test.js`: README 生成の内容検証追加
   - `merge.test.js`: dry-run 以外の実行パス検証
   - `cleanup.test.js`: ブランチ/worktree 削除の正常系・異常系
6. 欠落 HIGH の新規テスト3ファイルを作成する
   - `data-source.test.js` (unit): 基底クラス desc(), toMarkdownTable, カテゴリメタデータ
   - `text.test.js` (e2e): text コマンド main のテンプレート処理→出力検証
   - `flow/commands/start.test.js` (e2e): flow start の状態初期化・ブランチ/worktree 作成
7. `npm test` で全テストがパスする

## Acceptance Criteria
- `tests/` 直下にテストファイルが存在しない（全て `unit/` または `e2e/` 配下）
- `npm run test:unit` で unit テストのみ実行される
- `npm run test:e2e` で e2e テストのみ実行される
- `npm test` で全テストがパスする
- SHALLOW 対象5ファイルが実質的なロジック検証を含む
- MISSING_COVERAGE 対象3ファイルが追加パスをカバーする
- 新規3ファイルが存在し、テストがパスする
- 既存テストの振り分け後、インポートパスが正しく動作する

## Open Questions
- [x] テストファイル内の相対インポートパス — 移動で1階層深くなるため `../` を1つ追加して調整する（例: `../../src/` → `../../../src/`）
