# Tests for spec 177-fix-datasource-silent-fail

## 概要

本 spec では DataSource ローダーのロード失敗の握りつぶしを撤廃し、fail-fast な挙動にする。そのリグレッションを防ぐためのコントラクトテストを追加する。

## 追加したテスト

- `tests/unit/docs/lib/data-source-loader.test.js`
  - 正常モジュールのみの場合、全件ロードされる。
  - 壊れたモジュール（構文エラー）を含む場合、`loadDataSources()` が例外を throw し、エラーに該当ファイル名が含まれる。
  - 存在しないディレクトリを渡した場合、空 Map を返す（既存挙動）。

## 配置方針

公開 API（`loadDataSources`）のコントラクトテストであり、将来にわたって壊れていれば常にバグ。よって `tests/unit/` 配下に配置し `npm test` の対象とする。`specs/<spec>/tests/` は採用しない。

## 実行方法

```bash
# 本テストのみ
node --test tests/unit/docs/lib/data-source-loader.test.js

# 既存含む全テスト
npm test
```

## 期待結果

- 実装完了前（try-catch を削除する前）: fail-fast テストが失敗する（現コードは例外を握りつぶすため）。
- 実装完了後: 全テストがパスする。
