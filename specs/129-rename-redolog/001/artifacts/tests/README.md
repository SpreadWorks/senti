# Tests for spec 129-rename-redolog

## What was tested

- `flow set issue-log` コマンドが `issue-log.json` を正しく作成・追記すること
- JSON エンベロープのキーが `issue-log` に更新されていること
- 旧コマンド `flow set redo` が削除されていること

## Test location

- `tests/unit/flow/set-issue-log.test.js` — 既存の `set-redo.test.js` をリネーム・更新（formal test）

## How to run

```bash
node --test tests/unit/flow/set-issue-log.test.js
```

## Expected results

- 全テストが PASS すること
- テスト実行時に `issue-log.json` が生成されること（`redolog.json` ではない）
