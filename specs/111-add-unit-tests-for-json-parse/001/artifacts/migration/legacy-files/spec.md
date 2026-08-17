# Feature Specification: 111-add-unit-tests-for-json-parse

**Feature Branch**: `feature/111-add-unit-tests-for-json-parse`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #45

## Goal

`src/lib/json-parse.js` の `fixUnescapedQuotes` と `extractBalancedJson` にユニットテストを追加し、複雑なステートマシンロジックの正しさを検証可能にする。

## Scope

- `tests/unit/lib/json-parse.test.js` を新規作成
- `fixUnescapedQuotes` のテスト: Issue #45 記載のケース + エッジケース
- `extractBalancedJson` のテスト: Issue #45 記載のケース + エッジケース

## Out of Scope

- プロダクトコード（`src/lib/json-parse.js`）の変更
- json-parse.js 以外のテスト追加

## Clarifications (Q&A)

- Q: テスト配置は `tests/` か `specs/<spec>/tests/` か？
  - A: `tests/unit/lib/json-parse.test.js`。公開 API のインターフェース契約テストであり、将来壊れたらバグ。

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-03-31
- Notes: autoApprove mode

## Requirements

1. (P1) `fixUnescapedQuotes` のテストを作成する。テストケース: 正常な JSON がそのまま返る、文字列値内の unescaped ダブルクォートが修復される、不正エスケープシーケンス（`\`` 等）が除去される、空文字列入力で空文字列が返る
2. (P1) `extractBalancedJson` のテストを作成する。テストケース: `{` を含まないテキストで null が返る、前後に余分なテキストがある場合に JSON 部分のみ抽出される、ネストした JSON が正しく抽出される、文字列内の `{` `}` が無視される、閉じ括弧が不足している場合に null が返る、minified JSON が抽出される
3. (P2) テストは `tests/unit/lib/json-parse.test.js` に配置し、`npm test` で実行される
4. (P2) 既存テストがパスする

## Acceptance Criteria

- `tests/unit/lib/json-parse.test.js` が存在する
- `fixUnescapedQuotes` に少なくとも4つのテストケースがある
- `extractBalancedJson` に少なくとも6つのテストケースがある
- `node --test tests/unit/lib/json-parse.test.js` が全てパスする
- `npm test` が全てパスする

## Open Questions

- なし
