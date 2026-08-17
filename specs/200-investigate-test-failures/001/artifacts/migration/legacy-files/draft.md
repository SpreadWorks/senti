# Draft: investigate-test-failures

**開発種別:** bug

**目的:** main ブランチで既発生の 4 件のテスト失敗について原因を特定し修正する。`node tests/run.js` の既存失敗を解消しクリーンに通る状態を回復する。

## 背景

issue #191 にて、spec 199 作業中に main baseline で以下 4 件のテスト失敗が記録された:

1. `runPipeline returns step timing for each pipeline step`
2. `report JSON is written to .sdd-forge/output/acceptance-report.json`（親: `acceptance report: pipeline traceability`）
3. `acceptance report: JSON output`
4. `sdd-forge dispatcher: rejects 'spec' with no args as unknown command`

## 原因調査結果（要件レベル）

### acceptance 系 3 件（上記 1-3）

テストが利用するパイプライン実行ヘルパーが、commands モジュールからエクスポートされていない関数シンボルを参照している。commands モジュールは過去のリファクタで関数ベースからクラスベースへ移行したが、テストヘルパー側がこの変更に追随していない。結果として helper 呼び出し時に TypeError が発生し、helper を使う全テストが失敗する。

### dispatcher 系 1 件（上記 4）

当該テストは `sdd-forge spec` が「未知のコマンド」として拒否されることを期待しているが、現状 `spec` は有効な dispatcher（サブコマンド付）として動作している。テストのシナリオ前提が製品現状と乖離している。

## 要件（Given/When/Then 形式）

### R1: acceptance 系 3 件の修復

- When 該当 3 テストを実行した When、Then いずれも pass となる shall。
- If テストヘルパー側の不整合が原因である If、Then ヘルパー側を製品 API に追随させて解消する shall。製品コード (`src/`) は変更しない。

### R2: dispatcher 系 1 件の置換

- When `sdd-forge spec`（無引数）を実行した When、Then 製品が現在実装している挙動（サブコマンド usage 表示 + 非ゼロ終了）を検証するテストに差し替えられている shall。
- When 製品の現状仕様と当該テストのシナリオ前提が乖離していると確認された When、Then 失効したシナリオ（「unknown command」期待）はテストファイルから削除される shall。

### R3: 全体回帰の確認

- When `node tests/run.js` を実行した When、Then `# fail 0` が出力される shall。
- When 既存 pass 件数を比較した When、Then 4 件の失敗解消分だけ pass が増加する（差し替えテストは新規扱い）shall。

## スコープ

- テストヘルパーの製品 API 追随修正
- 失効した dispatcher テストの現状仕様検証への置換
- 全テスト pass 確認

## スコープ外

- 製品コード (`src/`) の変更
- acceptance-report.json のスキーマ変更
- その他の既存テストの改善
- pipeline 実行ロジックの改修

## 影響範囲

- 影響を受ける既存機能: なし（テストインフラのみ）
- プロダクトコード挙動に変更なし

## 制約

- CLAUDE.md: 「テストを通すためにテストコードを修正してはならない」— 本 spec における該当性:
  - acceptance 系 3 件: テストヘルパーの**製品 API 追随**であり、シナリオ改変ではない。制約には抵触しない。
  - dispatcher 系 1 件: シナリオ前提が失効済（製品の現状と不一致）。まずシナリオ妥当性を確認した結果、妥当でないと判断したため置換する。制約の想定通り。
- alpha 版ポリシー: 後方互換コードは書かない

## Q&A

### Q1: 本 issue の目的は「調査」か「調査＋修正」か

- 推奨: `[2] 調査＋修正`
- 根拠: 既存コードパターン — 類似の「既知失敗を記録→修正」スペック (例: spec 199 issue-log) では修正まで含めて完結させる運用。修正範囲が小さく分割価値が低い。
- A: `[2] 調査＋修正` で確定

### Q2: draft 内容のレビュー

- 推奨: `[1] 承認`
- 根拠: 4 件全ての根本原因を特定済、修正方針はテストインフラ側に限定されプロダクトリスク最小。
- A: `[1] 承認` で確定

## User Confirmation

- [x] User approved this draft
- Date: 2026-04-20
- Note: 調査結果提示後 [1] 承認、auto mode 指示
