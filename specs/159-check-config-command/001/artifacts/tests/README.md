# Spec 159: check-config-command — Test Notes

## What Was Tested

`sdd-forge check config` コマンドの全要件（spec 159 Requirements 1〜8）を検証。

- 正常 config での exit 0 / "config is valid" 出力
- config.json 不存在・無効 JSON での exit 1
- スキーマエラー（必須フィールド欠損）での exit 1 + エラー列挙
- 存在しないプリセット名での exit 1 + プリセット名出力
- `type` 配列で一部 unknown の場合
- `--format json` での JSON 出力（ok フィールド）
- `-h` でのヘルプ表示

## Test Location

`specs/159-check-config-command/tests/check-config.test.js`

（`npm test` の対象外。このスペックの要件検証専用）

## How to Run

```bash
node --test specs/159-check-config-command/tests/check-config.test.js
```

## Expected Results

実装後に全テストが pass すること（事前実行では `src/check/commands/config.js` が存在しないため全 fail が正常）。
