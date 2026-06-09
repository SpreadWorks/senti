<!-- {%extends%} -->

<!-- {%block "stack"%} -->
<!-- {{data("cakephp2.config.stack", {header: "### 技術スタック\n", labels: "カテゴリ|技術|バージョン", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "dependencies"%} -->
<!-- {{data("cakephp2.config.composer", {header: "### PHP 依存パッケージ (composer.json)\n", labels: "パッケージ|バージョン|用途", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.docker.list", {header: "### docker-compose.yml 構成\n", labels: "サービス|コンテナ名|ポート|イメージ", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.config.assets", {header: "### フロントエンドライブラリ\n", labels: "ライブラリ|バージョン|用途", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.libs.errors", {header: "### エラーハンドリング\n", labels: "クラス|ファイル|責務", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.config.bootstrap", {header: "### アプリケーション初期化 (bootstrap.php)\n", labels: "設定項目|値", ignoreError: true})}} -->
<!-- {{/data}} -->

### メール通知仕様

<!-- {{text({prompt: "メール送信設定のデフォルト値（送信元、トランスポート）を説明してください。", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.email.list", {labels: "送信元ファイル|件名パターン|CC"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "deploy"%} -->
### デプロイフロー

※ デプロイ手順は本番運用チームに確認が必要。ソースコード内にデプロイスクリプトは含まれない。
<!-- {%/block%} -->

<!-- {%block "operations"%} -->
### 運用フロー

※ 運用手順は本番運用チームに確認が必要。
<!-- {%/block%} -->
