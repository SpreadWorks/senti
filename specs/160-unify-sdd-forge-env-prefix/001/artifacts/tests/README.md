# Spec 160 Tests: env var prefix unification

## What was tested and why

`src/lib/cli.js` の `repoRoot()` / `sourceRoot()` が `SDD_FORGE_WORK_ROOT` / `SDD_FORGE_SOURCE_ROOT` を読み取ること、および旧変数名（`SDD_WORK_ROOT` / `SDD_SOURCE_ROOT`）がフォールバックなしで無視されることを検証する。

## Test location

`specs/160-unify-sdd-forge-env-prefix/tests/env-prefix.test.js` — spec 検証テスト（`npm test` では実行されない）

spec 検証テストとして配置した理由: このテストは spec 160 の要件が満たされているかを確認するもの。将来の変更でこのテストが壊れても「常にバグ」とは言えないため。

## How to run

```bash
# worktree 内から
node --test specs/160-unify-sdd-forge-env-prefix/tests/env-prefix.test.js
```

## Expected results

実装前: 全テスト FAIL（旧変数名が依然として有効なため）

実装後:
- `repoRoot()` — `SDD_FORGE_WORK_ROOT` 設定時にその値を返す ✓
- `repoRoot()` — `SDD_WORK_ROOT` のみ設定しても影響しない ✓
- `sourceRoot()` — `SDD_FORGE_SOURCE_ROOT` 設定時にその値を返す ✓
- `sourceRoot()` — `SDD_SOURCE_ROOT` のみ設定しても影響しない ✓
