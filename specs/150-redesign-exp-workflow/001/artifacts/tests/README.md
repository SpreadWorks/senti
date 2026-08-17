# Tests for spec 150-redesign-exp-workflow

## Test Layout

このスペックのテストは2箇所に配置されている：

### Unit tests — `experimental/tests/`
- `workflow-config-validation.test.js` — `src/lib/types.js` の `validateConfig()` が `experimental.workflow` セクションを正しく検証することを確認
- `workflow-category.test.js` — `experimental/workflow/lib/category.js` の `prefixCategory()` 関数と `VALID_CATEGORIES` をテスト
- `workflow-dispatcher.test.js` — `experimental/workflow/registry.js` のコマンド定義（add, update, show, search, list, publish）と各コマンドの args 定義、モジュールロード可能性をテスト

### Command-level E2E tests — `specs/150-redesign-exp-workflow/tests/`
- `workflow-cli-e2e.test.js` — `experimental/workflow.js` の CLI 動作をテスト
  - `experimental.workflow` 未設定時のエラー
  - `enable: false` 時のエラー
  - `--help` 出力
  - 未知サブコマンド時の非ゼロ終了
  - JSON envelope 形式の出力

## 実行方法

```bash
# 個別実行
node --test experimental/tests/workflow-config-validation.test.js
node --test experimental/tests/workflow-category.test.js
node --test experimental/tests/workflow-dispatcher.test.js
node --test specs/150-redesign-exp-workflow/tests/workflow-cli-e2e.test.js

# 一括実行
node --test experimental/tests/workflow-*.test.js specs/150-redesign-exp-workflow/tests/*.test.js
```

## 期待結果（実装前）

すべてのテストは失敗する。理由：
- `experimental/workflow.js` が未作成
- `experimental/workflow/registry.js` が未作成
- `experimental/workflow/lib/category.js` が未作成
- `src/lib/types.js` の `validateConfig()` に `experimental.workflow` 検証が未実装

## 期待結果（実装後）

すべてのテストがパスする。

## 注意

`experimental/tests/` 配下のテストは `npm test` の対象外（`tests/run.js` が `experimental/` を見ない）。
そのため `node --test` で直接実行する。
