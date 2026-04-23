# Tests for spec 221 (default finalize --mode)

## What is tested

公式テストファイル: `tests/unit/flow/run-finalize-default-mode.test.js`

| 観点 | AC | 検証内容 |
|---|---|---|
| `--mode` 既定値適用 | AC1 (REQ-1/REQ-2) | `ctx.mode` が `undefined` / `""` のときに throw される error に `--mode must be 'all' or 'select'` / `--steps required when mode is 'select'` が**含まれない**こと。すなわち defaulting が `all` に向かうこと。 |
| `--mode` エラー維持 | AC2 (REQ-3) | `ctx.mode = "foo"` で `Error: --mode must be 'all' or 'select'` が throw されること。`ctx.mode = "select"` + `ctx.steps = ""` で `Error: --steps required when mode is 'select'` が throw されること。 |
| CLI ヘルプ整合 | AC4 (REQ-5) | `src/flow/registry.js` の finalize help 文字列に `--mode ... default: all` が含まれること。 |
| 実装フェーズ prompt 整合 | AC5 (REQ-6) | `src/flow/prompts/impl/finalize.md` の通常完了パスに `sdd-forge flow run finalize --mode all` が含まれないこと。`--mode select --steps` の例示は残ること。 |

## Why public tests/ and not spec-local

これらのテストは `flow run finalize` という公開 CLI の契約挙動（バリデーションとヘルプ文言）を検証する。将来この挙動が壊れた場合、それは spec 221 の存在有無に関わらずバグである。したがって `tests/` 以下に配置し、`npm test` で常に実行する。

## How to run

```bash
node --test tests/unit/flow/run-finalize-default-mode.test.js
# or
npm test
```

## Expected results

- 実装前（本 spec の gate-impl 到達前）: 4 件 FAIL (AC1×3 + AC4+AC5×1 グループ中 2 assertion)、3 件 PASS (AC2)。
- 実装後: 7 件 PASS。
