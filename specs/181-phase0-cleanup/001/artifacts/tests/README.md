# specs/181-phase0-cleanup/tests

## 検証内容

spec 181 (1877 Phase 0 小規模クリーンアップ) の R1〜R4 が満たされていることを検証する。

| 要件 | 検証 |
|---|---|
| R1 | `src/lib/exit-codes.js` が存在しない / import が 0 件 / `constants.js` が `EXIT_SUCCESS=0` / `EXIT_ERROR=1` を export |
| R2 | `repoRoot` が引数なしシグネチャ / `repoRoot(import.meta.url)` 形式の呼び出しが 0 件 / `SDD_FORGE_WORK_ROOT` env 尊重 |
| R3 | `INDEPENDENT` マップから `help` 除去 / 5 入力パターン（無引数・`-h`・`--help`・`help`・`help <topic>`）で help が表示される / 未知コマンドは exit 1 |
| R4 | `src/` に `writeAgentContext` / `cleanupAgentContext` 参照が 0 件 |

## 配置理由

本テストは spec 181 の受入確認用スモークテストであり、長期保守対象ではない（破壊された場合は spec 181 由来の regression とみなせる）。従って `specs/181-phase0-cleanup/tests/` 配下に置き、`npm test` の `tests/` 走査には含めない。

## 実行方法

```
# repo ルートから
node --test specs/181-phase0-cleanup/tests/cleanup.test.js
```

全テストがパスすれば spec の Acceptance Criteria 相当を満たしている。
