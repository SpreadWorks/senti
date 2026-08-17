# Tests for 217-validate-explicit-run-id

## What is tested

新規ユニットテスト 2 件を `tests/unit/flow/set-auto.test.js` に追加:

1. `fails with PREPARING_FLOW_NOT_FOUND for 'on' when --run-id does not match any preparing flow, without invoking AI`
   - R1 / R2 / R4: `on` 経路で非存在 runId を渡したとき `errors[0].code == "PREPARING_FLOW_NOT_FOUND"` を返し、AI エージェントが呼び出されないことを検証。
2. `fails with PREPARING_FLOW_NOT_FOUND for 'off' when --run-id does not match any preparing flow`
   - R2 / R4: `off` 経路でも同じ code で失敗 envelope を返すことを検証。

AI 未呼び出しの検証は `writeCapturingStubAgentScript` の capture file が作られないことで行う（stub は呼ばれた場合に書き込む）。

既存ユニットテスト（存在する runId、auto-detect の 0 件・1 件・複数件ケース、静的 gate hit、spec 承認後の skip 経路、draft.md 入力経路など）は R3 の回帰検知として維持。

## Where

- Formal tests: `tests/unit/flow/set-auto.test.js`（`npm test` で走る公式スイート）

本 spec は `flow set auto` の CLI 契約に関するバグ修正のため、公式スイートに配置した。将来 `resolvePreparingRunId` に変更が入って壊れれば常にバグであるため、`specs/<spec>/tests/` ではなく `tests/` に置くのが妥当。

## How to run

```bash
node --test tests/unit/flow/set-auto.test.js
# or the whole suite
npm test
```

## Expected results

実装前: 2 件の新規テストは FAIL（PREPARING_FLOW_NOT_FOUND が返らない。plain Error で `code: ERROR` になる or AI が呼ばれる）。
実装後: 全 13 件 PASS。
