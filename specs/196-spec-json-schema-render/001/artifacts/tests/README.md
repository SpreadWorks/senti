# Spec 196 — Test Notes

このディレクトリには spec 固有の再現テストを置かない方針。本 spec のテストは以下の共通 formal tests として配置する:

- `tests/unit/spec/schema.test.js` — `src/flow/schemas/spec.schema.json` が `validateSchema` で期待通り振る舞うこと（11 フィールド定義、必須フィールド欠落検出、型違反検出）。
- `tests/unit/spec/render.test.js` — `sdd-forge spec render` の内部関数 `renderSpecMarkdown` が、spec.json + meta から skeleton 互換の spec.md を決定論的に生成すること。

## 実行方法

```
npm test                    # 全テスト
npm run test:unit           # unit テストのみ
node tests/run.js --scope unit --filter spec
```

## 期待結果

いずれも happy path と主要エッジ（必須欠落 / 型違反 / 冪等性 / セクション順）をカバーする。将来どの spec で壊れてもバグ（= spec 196 固有の検証ではない）と言える性質のため、tests/ 配下に配置した。
