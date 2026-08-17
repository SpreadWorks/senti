# Spec Verification Tests — 192-inline-resolveoutputconfig

## テスト内容

`removal.test.js` — `src/` 配下を再帰的に走査し、識別子 `resolveOutputConfig` が残存していないことを検証する（R1, R2）。

## 実行方法

```bash
node specs/192-inline-resolveoutputconfig/tests/removal.test.js
```

## 期待結果

- PASS: `identifier "resolveOutputConfig" has been fully removed from src/`（exit 0）。
- FAIL: 残存ファイル一覧を出力（exit 1）。

## 対象外

- 挙動同値性は既存の `npm test` 回帰スイートで担保（本 spec では新規挙動テストを追加しない）。
