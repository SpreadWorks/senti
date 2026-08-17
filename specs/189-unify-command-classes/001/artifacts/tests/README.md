# Spec 189 Tests

## Purpose

Spec 189 固有の静的検査。過渡期の橋渡しコード (spec 188 Phase D で導入された
`legacyMainToCommand` adapter および `runModuleMain` runner への参照) が
src ツリーから完全に除去されていることを検証する。

## Placement

spec 固有テストのため `specs/189-unify-command-classes/tests/` に配置する
(`npm test` には含まれない)。実装後の AC2 判定目的で spec 限定のテスト。

## What is tested

- `src/lib/command-adapter.js` ファイル自体が存在しないこと。
- `legacyMainToCommand` 識別子への参照が src 全体で 0 件であること。
- `runModuleMain` 識別子への参照が src 全体で 0 件であること。

合わせて spec 188 の既存静的検査 (`specs/188-.../tests/static-checks.test.js`)
を AC1 判定に流用する。そちらは commands/ 配下の `main` export 0 件、
`repoRoot()` / `loadConfig()` 直呼び 0 件、dispatcher の `process.argv` 書換 0 件
等を検証する。

## How to run

```bash
node --test specs/189-unify-command-classes/tests/static-checks.test.js
node --test specs/188-unify-command-architecture/tests/static-checks.test.js
```

## Expected results

- 実装完了前 (本 spec 着手時点): FAIL。
- 実装完了後: PASS。
