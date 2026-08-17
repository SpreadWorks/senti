# Spec 158: scan-coverage-report — テスト

## テスト概要

| テストファイル | 種別 | 検証内容 |
|---|---|---|
| `tests/unit/lib/formatter.test.js` | formal (npm test) | `src/lib/formatter.js` の `pushSection` / `DIVIDER` のユニットテスト |
| `specs/158-scan-coverage-report/tests/scan-check.test.js` | spec verification | `sdd-forge check scan` の CLI 動作テスト |

## テスト配置の理由

- **`tests/unit/lib/formatter.test.js`** → `src/lib/formatter.js` は汎用ユーティリティ。将来変更があれば常にバグとなるため formal tests に配置。
- **`specs/158-scan-coverage-report/tests/scan-check.test.js`** → この spec の要件検証用テスト。他の spec が future で `check scan` の動作を変更しても壊れる可能性があるため、spec verification tests に配置。

## 実行方法

```bash
# formatter ユニットテスト（npm test に含まれる）
npm test

# spec 検証テスト（単体実行）
node --test specs/158-scan-coverage-report/tests/scan-check.test.js
```

## 期待結果

実装前は全テストが失敗する（`src/lib/formatter.js` と `src/check/commands/scan.js` が未存在）。
実装後は全テストがパスすることを確認する。
