# Spec #102 Tests

## What was tested and why

`enrich.js` の `buildEnrichPrompt()` が `opts.lang` を受け取り、AI への言語指示を明示的に出力するかを検証する。

## Where tests are located

- `specs/102-fix-japanese-text-mixed-into-english-docs-in-cak/tests/enrich-lang.test.js`

## How to run

```bash
node --test specs/102-fix-japanese-text-mixed-into-english-docs-in-cak/tests/enrich-lang.test.js
```

最終検証は acceptance テスト:
```bash
node tests/acceptance/run.js cakephp2
```

## Expected results

- 実装前: `buildEnrichPrompt` が export されていないため import 失敗
- 実装後: 全テスト PASS
