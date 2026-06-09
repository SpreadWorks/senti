<!-- {%extends%} -->

<!-- {%block "setup"%} -->
### Docker セットアップ

```bash
# 初回セットアップ
npm run docker:init

# 通常起動
npm run docker:up

# コンテナ停止
npm run docker:stop
```

### npm scripts（Docker 操作）

<!-- {{text({prompt: "package.json に定義されている Docker 操作コマンドを表形式で記述してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "dev-workflow"%} -->
### ローカル開発手順

<!-- {{text({prompt: "Docker 環境でのローカル開発手順（起動→コーディング→テスト→確認）を記述してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "testing"%} -->
### テスト構成

<!-- {{text({prompt: "テストフレームワークとテスト実行方法を説明してください。"})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.tests.list", {labels: "項目|件数|ディレクトリ"})}} -->
<!-- {{/data}} -->

### 設定定数リファレンス

<!-- {{data("cakephp2.config.constants", {header: "#### スカラー定数\n", labels: "定数名|値|説明", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.config.constantsSelect", {header: "#### 選択肢定数\n", labels: "定数名|選択肢", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
