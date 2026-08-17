# Spec #101 Tests

## What was tested and why

`spec.js` ディスパッチャ廃止とコマンド構造整理に伴い、以下を検証する:

1. **`lib/guardrail.js`** — `spec/commands/guardrail.js` から抽出した共有関数（`parseGuardrailArticles`, `filterByPhase`, `matchScope`）が正しく動作すること
2. **`flow run lint`** — registry に登録され、JSON envelope を返すこと
3. **dispatcher** — `sdd-forge spec` が unknown command になること、help に spec コマンドが表示されないこと

## Where tests are located

- `specs/101-remove-spec-js-dispatcher-and-clean-up-command-s/tests/lib-guardrail.test.js`
- `specs/101-remove-spec-js-dispatcher-and-clean-up-command-s/tests/flow-run-lint.test.js`
- `specs/101-remove-spec-js-dispatcher-and-clean-up-command-s/tests/dispatcher-no-spec.test.js`

## How to run

```bash
node --test specs/101-remove-spec-js-dispatcher-and-clean-up-command-s/tests/*.test.js
```

## Expected results

- 実装前: `lib/guardrail.js` が存在しないため lib-guardrail.test.js は失敗する
- 実装後: 全テスト PASS
