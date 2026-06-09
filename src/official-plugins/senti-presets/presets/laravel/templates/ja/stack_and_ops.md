<!-- {%extends%} -->

<!-- {%block "dependencies"%} -->
<!-- {{data("laravel.config.composer", {header: "### PHP 依存パッケージ (composer.json)\n", labels: "パッケージ|バージョン|用途", ignoreError: true})}} -->
<!-- {{/data}} -->

### docker-compose.yml 構成

<!-- {{text({prompt: "docker-compose.yml のサービス構成を表形式で記述してください。サービス名、コンテナ名、ポート、イメージを含めること。"})}} -->
<!-- {{/text}} -->

<!-- {{data("laravel.config.middleware", {header: "### ミドルウェア\n", labels: "クラス|ファイル|用途", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("laravel.config.providers", {header: "### サービスプロバイダ\n", labels: "プロバイダ|ファイル|register|boot", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("laravel.config.files", {header: "### 設定ファイル\n", labels: "ファイル|主要キー", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "deploy"%} -->
### デプロイフロー

<!-- {{text({prompt: "Laravel プロジェクトのデプロイ手順を説明してください。php artisan コマンド（migrate, config:cache, route:cache 等）を含めること。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "operations"%} -->
### 運用フロー

<!-- {{text({prompt: "Laravel プロジェクトの運用手順を説明してください。キューワーカー、スケジューラ、ログ等を含めること。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
