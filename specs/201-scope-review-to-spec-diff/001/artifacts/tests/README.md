# Tests — spec 201 scope-review-to-spec-diff

## 何をテストしたか

issue #193 の修正で `flow run review` が spec diff スコープを無視してスコープ外ファイルへ提案を出す問題を止めるため、以下の振る舞いを検証する。

- `parseProposals` が提案 body から `**File:** <path>` を抽出し、`file` フィールドを提案オブジェクトに持つ（R-P1 / R-P3）
- `buildDraftSystemPrompt` の返すプロンプトに「提案は diff 対象ファイルのみを対象とせよ」相当の指示が含まれる（R-P2）
- `filterProposalsByScope(proposals, touchedFiles)` が、touched ファイル集合外の提案を除外し、ファイル情報なしの提案も除外し、除外件数を返す（R-P1 / R-P3）
- `collectTouchedFiles(root, baseBranch)` が committed diff + staged diff から触れられたファイルの Set を返す（R-P4）

## テスト配置

- `tests/unit/flow/commands/review.test.js` — 恒常仕様として維持する振る舞いなので `tests/` に配置した。
  - 追加ブロック: `parseProposals extracts file from **File:** marker`, `buildDraftSystemPrompt enforces scope`, `filterProposalsByScope`, `collectTouchedFiles`

本 spec 固有の追加テストファイルは作成していない（既存テストファイル内への追加で完結するため）。

## 実行方法

```bash
# 本 spec の追加分を含め review 関連ユニットテストを実行
node --test tests/unit/flow/commands/review.test.js

# 全ユニットテスト
npm test
```

## 期待結果

- `parseProposals extracts file from **File:** marker` 配下のすべてがパス
- `buildDraftSystemPrompt enforces scope` がパス
- `filterProposalsByScope` の 3 ケースすべてパス
- `collectTouchedFiles` の 2 ケースすべてパス
- 既存ブロック（FLOW_STEPS / flow run review CLI / resolveAgent 等）は引き続きパス
