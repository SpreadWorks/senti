# Spec Verification Tests — 191-add-scannable-match-jsdoc

このディレクトリは spec #191 の受入条件を検証するためのテストを格納する。`npm test`（`tests/` 配下の formal テスト）からは独立しており、このスペックの合否判定の目的にのみ使う。

## テスト内容

`jsdoc-contract.test.js` — `src/docs/lib/scan-source.js` の `Scannable` mixin 内 `match(relPath)` メソッドの JSDoc ブロックに、以下の必須キーワードがすべて含まれることを文字列検査する。

- `SDD_SOURCE_ROOT` — スキャンルートの起点識別子
- `POSIX` — 区切り文字の形式名
- `./` — 先頭記法（相対パス先頭の `./` を付けない旨の記述）

テストは `match(relPath)` の直前にある `/** ... */` JSDoc ブロックを正規表現で抽出し、その内部のみをキーワード検査する。ファイル冒頭のモジュール説明 JSDoc は対象外。

## 実行方法

```bash
node specs/191-add-scannable-match-jsdoc/tests/jsdoc-contract.test.js
```

## 期待結果

- PASS: `Scannable.match() JSDoc contains all required keywords` と出力し exit code 0。
- FAIL: 欠落キーワードを列挙して exit code 1。

## 対象外

- プロダクトコードの挙動テストは追加しない（本 spec は JSDoc のみ変更、ランタイム挙動変更なし）。
- 既存 `tests/` 配下の formal テストは `npm test` により別途実行され、回帰検知の役割を担う。
