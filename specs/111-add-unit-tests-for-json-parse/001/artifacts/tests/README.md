# Tests for spec 111: add-unit-tests-for-json-parse

## What was tested

- `fixUnescapedQuotes`: 正常 JSON、unescaped quote 修復、不正エスケープ除去、空入力、構造文字判定、有効エスケープ保持
- `extractBalancedJson`: null 返却、周辺テキスト除去、ネスト、文字列内ブレース無視、不完全 JSON、minified、エスケープ済み引用符、複数オブジェクト

## Where tests are located

- `tests/unit/lib/json-parse.test.js`（正式テスト、`npm test` で実行）

## How to run

```bash
node --test tests/unit/lib/json-parse.test.js
```

## Expected results

- fixUnescapedQuotes: 6 テスト PASS
- extractBalancedJson: 8 テスト PASS
