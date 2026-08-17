# Spec #119 Tests: Context Search N-gram Mode

## What was tested

- **N-gram 検索関数**: `toBigrams`, `bigramSimilarity`, `ngramSearch` の正確性（AC5, AC6）
- **3段フォールバック**: ngram → fallbackSearch → AI の遷移ロジック（AC1, AC3, AC4, R3）
- **設定バリデーション**: `flow.commands.context.search.mode` の有効値/無効値チェック（AC7, R2）
- **日本語短語**: 2文字キーワードでの bigram 挙動（AC6）

## Test locations

| Test | Location | Run by `npm test` |
|------|----------|-------------------|
| toBigrams, bigramSimilarity, ngramSearch | `tests/unit/flow/get-context-ngram.test.js` | Yes |
| Fallback chain | `specs/119-context-search-ngram-mode/tests/fallback-chain.test.js` | No |
| Config validation | `specs/119-context-search-ngram-mode/tests/config-validation.test.js` | No |

## How to run

```bash
# Formal tests (included in npm test)
node --test tests/unit/flow/get-context-ngram.test.js

# Spec verification tests
node --test specs/119-context-search-ngram-mode/tests/fallback-chain.test.js
node --test specs/119-context-search-ngram-mode/tests/config-validation.test.js
```

## Expected results

All tests should fail initially (functions not yet exported/implemented).
After implementation, all tests should pass.
