# Spec 193 Tests

## 何をテストするか

`flow set issue-log` の入力バリデーション強化（P1/P2）と、既存呼び出し箇所の整合（P3）を検証する。placeholder 相当の短文 reason が実 `issue-log.json` に混入するのを防ぐことが目的。

## 配置

本 spec のバリデーションは CLI 契約（`flow set issue-log` の公開仕様）そのものなので、formal テストとして以下に配置している。

- `tests/unit/flow/set-issue-log.test.js`

spec 固有の分離テストは設けない（破壊時は常にバグであり、本 spec に依らず maintain する）。

## 実行

```bash
npm test -- --test tests/unit/flow/set-issue-log.test.js
```

または個別に:

```bash
node --test tests/unit/flow/set-issue-log.test.js
```

## 期待結果

- バリデーション失敗ケース（reason < 20 / optional < 10）は `ok: false` envelope、非ゼロ終了コード、`issue-log.json` 未作成を確認する。
- 境界値ケース（reason = 20 / optional = 10）は成功することを確認する。
- 既存ユースケース（作成・追記・任意フィールド・envelope 形状）は新仕様下でも PASS する。
