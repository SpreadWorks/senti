<!-- {%extends%} -->

<!-- {%block "dependencies"%} -->
<!-- {{data("symfony.config.composer", {header: "### PHP 依存パッケージ (composer.json)\n", labels: "パッケージ|バージョン|用途", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.config.bundles", {header: "### Symfony Bundles\n", labels: "Bundle|完全修飾名|用途", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.config.packages", {header: "### 設定ファイル (config/packages/)\n", labels: "ファイル|主要キー", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.config.services", {header: "### サービス設定\n", labels: "autowire|autoconfigure", ignoreError: true})}} -->
<!-- {{/data}} -->

### docker-compose.yml 構成

<!-- {{text({prompt: "docker-compose.yml のサービス構成を表形式で記述してください。サービス名、コンテナ名、ポート、イメージを含めること。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "deploy"%} -->
### デプロイフロー

<!-- {{text({prompt: "Symfony プロジェクトのデプロイ手順を説明してください。bin/console コマンド（doctrine:migrations:migrate, cache:clear, assets:install 等）を含めること。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "operations"%} -->
### 運用フロー

<!-- {{text({prompt: "Symfony プロジェクトの運用手順を説明してください。Messenger ワーカー、スケジューラ、ログ（Monolog）等を含めること。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
