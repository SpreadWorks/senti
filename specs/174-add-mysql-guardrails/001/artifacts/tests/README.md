# Tests: 174-add-mysql-guardrails

## What was tested and why

mysql プリセットの新規作成と webapp プリセットへの guardrail 追記が、Issue #143 の仕様どおりに実装されているかを検証する。

## Test location

`specs/174-add-mysql-guardrails/tests/mysql-guardrails.test.js`

本スペック固有の検証テストのため、`tests/` (formal) ではなく `specs/<spec>/tests/` に配置している。

## How to run

```bash
# worktree ルートから実行
node specs/174-add-mysql-guardrails/tests/mysql-guardrails.test.js
```

## Expected results

- **実装前**: 全テスト FAIL（mysql プリセットが存在しないため）
- **実装後**: 全テスト PASS

## What is verified

1. `src/presets/mysql/preset.json` が存在し `parent: "database"` を持つこと
2. `src/presets/mysql/guardrail.json` が M-1〜M-13 の 13 件を含むこと
3. `src/presets/mysql/NOTICE` が存在し出典を帰属していること
4. `src/presets/webapp/guardrail.json` に W-1〜W-3 の 3 件が追記されていること
5. `src/presets/webapp/NOTICE` が存在し出典を帰属していること
6. すべての guardrail phase が有効な sdd-forge フェーズであること
