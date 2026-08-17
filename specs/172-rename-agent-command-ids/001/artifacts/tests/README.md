# Tests: 172-rename-agent-command-ids

## What was tested

エージェントコマンドIDのリネームが正しく行われたことを検証する。

1. **旧ID不在**: 対象ファイルに旧コマンドID文字列が残っていないこと
2. **新ID配置**: 新コマンドIDが正しいファイルに存在すること
3. **config.example.json**: テンプレートが新IDを使用していること

## Test location

- `specs/172-rename-agent-command-ids/tests/verify-rename.test.js`

## How to run

```bash
node --test specs/172-rename-agent-command-ids/tests/verify-rename.test.js
```

## Expected results

実装完了後、3テスト全てが PASS すること。
