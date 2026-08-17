# 136-github-actions-preset テスト

## テスト内容

ci プリセットから github-actions プリセットへのコード移動が正しく行われたことを検証する。

### verify.test.js

spec の各要件に対応する検証:

1. `github-actions/data/pipelines.js` が存在し、`ci/data/pipelines.js` が削除されていること
2. `github-actions/preset.json` に `scan.include` があり、`ci/preset.json` にないこと
3. ci テンプレートが `{{text}}` を使用し、`{{data}}` を使用していないこと
4. github-actions テンプレートが `{%extends%}` + `{{data("github-actions.pipelines.*")}}` を使用していること
5. ci の aliases に `github-actions` が含まれていないこと
6. テストファイルが `github-actions-pipelines.test.js` にリネームされていること

## テストの場所

- `specs/136-github-actions-preset/tests/verify.test.js` — spec 検証テスト

## 実行方法

```bash
node --test specs/136-github-actions-preset/tests/verify.test.js
```

## 期待結果

実装完了後、全テストが PASS すること。
