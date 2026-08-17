# Tests for spec 107: yes auto-approve mode

## What was tested

- `mutateFlowState` で `autoApprove` フィールドの読み書きが正しく動作すること
- `flow set auto on` が flow.json の `autoApprove` を `true` に設定すること
- `flow set auto off` が flow.json の `autoApprove` を `false` に設定すること
- 引数なしで `flow set auto` を実行するとエラーが返ること
- `autoApprove` が他の mutation で上書きされないこと

## Where tests are located

- `tests/unit/lib/flow-state-auto.test.js` — flow-state.js の autoApprove 読み書きテスト
- `tests/unit/flow/set-auto.test.js` — `flow set auto` コマンドの E2E テスト

## How to run

```bash
node --test tests/unit/lib/flow-state-auto.test.js
node --test tests/unit/flow/set-auto.test.js
```

## Expected results

- `flow-state-auto.test.js` は実装前でもパスする（mutateFlowState は汎用関数）
- `set-auto.test.js` は `src/flow/set/auto.js` 実装後にパスする
