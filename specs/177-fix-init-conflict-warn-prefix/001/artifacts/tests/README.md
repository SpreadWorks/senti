# Spec 177 Tests — fix-init-conflict-warn-prefix

## 目的

Issue #149 の回帰検証。`sdd-forge docs init` の conflict 検出時通知メッセージが
`ERROR:` ではなく `WARN:` プレフィックスで出力されることを保証する。

## 配置方針

本テストは spec ローカルテスト（`specs/177-*/tests/`）として配置している。
理由: この spec の bug 再現テストであり、長期メンテ対象の formal test ではない
（SDD テスト配置ルールに従う）。`npm test` からは除外される。

## 検証内容

- `src/locale/ja/messages.json` の `init.conflictsExist` が `ERROR:` で始まらず `WARN:` で始まる
- `src/locale/en/messages.json` の `init.conflictsExist` が `ERROR:` で始まらず `WARN:` で始まる
- ja / en のプレフィックストークンが一致する

## 実行方法

```sh
node --test specs/177-fix-init-conflict-warn-prefix/tests/conflict-warn-prefix.test.js
```

## 期待結果

全 5 テストケース PASS。
