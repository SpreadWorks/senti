# Draft: 111-add-unit-tests-for-json-parse (autoApprove self-Q&A)

## 1. Goal & Scope
- テスト追加のみ。プロダクトコード変更なし
- 対象: `fixUnescapedQuotes` と `extractBalancedJson`
- Issue #45 のテストケース案に沿う

## 2. Impact on existing
- テスト追加のみなので既存機能への影響なし
- 既存テストへの影響もなし（新規ファイル追加）

## 3. Constraints
- node:test を使用（プロジェクト標準）
- テスト配置: `tests/unit/lib/json-parse.test.js`（公開 API のインターフェース契約テスト → 将来壊れたらバグ）

## 4. Edge cases
- fixUnescapedQuotes:
  - 正常 JSON → そのまま返る
  - 文字列値内の unescaped ダブルクォート
  - 不正エスケープ（`\`` 等）の除去
  - URL 内の `//` がコメント扱いされない（extractBalancedJson の話）
  - 空文字列入力
- extractBalancedJson:
  - `{` を含まないテキスト → null
  - 前後に余分なテキスト → JSON 部分のみ抽出
  - ネストした JSON
  - 文字列内の `{` `}` を無視
  - 閉じ括弧が不足 → null
  - minified JSON

## 5. Test strategy
- `tests/unit/lib/json-parse.test.js` に配置（`npm test` で実行される）
- Issue のテストケース案を全てカバー
- テストのみの spec なので、テスト自体が成果物（plan の test フェーズ = impl の成果物）

- [x] User approved this draft (autoApprove)
