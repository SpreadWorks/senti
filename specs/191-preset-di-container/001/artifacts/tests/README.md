# Tests for spec 191-preset-di-container

本 spec の受け入れ検証のためのテスト群。

## 配置方針

| 配置 | 目的 |
|---|---|
| `specs/191-preset-di-container/tests/` | 本 spec 固有の検証。移行前後 docs build の出力 diff 検証スクリプトが中心 |
| `tests/unit/presets/register-contract.test.js` | 全 preset が `register()` ファクトリ契約を満たすことを検証する公的 contract テスト（実装完了後に promote） |

「将来の変更がこのテストを壊したら必ずバグ？」の観点で:

- register() 契約テスト — YES（preset 公開 API として常に守られるべき）→ `tests/` に置く
- docs build pre/post diff — NO（この spec の移行時だけ意味がある）→ `specs/` 配下に置く
- Container preset registry の key スキーマ — YES → `tests/` に置く

## 実行方法

### spec ローカル（pre/post diff）

```bash
node specs/191-preset-di-container/tests/docs-build-diff.js
# 本 spec ブランチ適用前の出力を baseline として採取し、
# 適用後の出力と比較して差分ゼロであることを確認する
```

### 公的 contract テスト

```bash
npm test -- tests/unit/presets/register-contract.test.js
npm test -- tests/unit/presets/container-preset-registry.test.js
```

## 内容

- `register-contract.test.js`（tests/unit/presets/ に置く、実装時作成）:
  全 preset の `data/*.js` を import し、default export が function で、第一引数に container-like オブジェクトを渡したときに `registerPreset` または `register` が呼ばれ、期待キーが登録されることを確認
- `container-preset-registry.test.js`（tests/unit/presets/ に置く、実装時作成）:
  Container の `registerPreset` / `getPreset` / preset 間継承解決等 API の unit テスト
- `docs-build-diff.js`（specs/ 配下、実装時作成）:
  移行 commit 前後で `sdd-forge docs build` を fixture プロジェクトに対して実行し、出力 `.md` と `analysis.json` の diff を取って差分 0 を assert

## 期待結果

すべて PASS のとき、以下が担保される:

- R1〜R3 の契約（preset エントリ形式、内部 import ゼロ、親継承）
- R4〜R6 の移行（37 プリセット全てが新形式、旧経路削除、ユーティリティが Container 経由で取得可能）
- R9〜R11 の品質（出力不変、契約テスト合格、既存テスト継続合格）

## 実装時の備考

実装フェーズで追加の詳細が明らかになった場合は issue-log に記録する。
