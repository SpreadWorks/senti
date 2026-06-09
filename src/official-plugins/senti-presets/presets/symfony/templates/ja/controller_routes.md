<!-- {%extends%} -->

<!-- {%block "routing"%} -->
### ルーティング設定

<!-- {{text({prompt: "Symfony のルーティング方式を説明してください。#[Route] attribute と config/routes.yaml の役割を含めること。", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("symfony.routes.list", {labels: "メソッド|パス|コントローラ|名前"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "controller-list"%} -->
<!-- {{data("symfony.controllers.list", {header: "### コントローラ一覧\n", labels: "コントローラ名|ファイル|主な責務", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.controllers.actions", {header: "### コントローラ–アクション一覧\n", labels: "コントローラ|アクション", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "controller-deps"%} -->
<!-- {{data("symfony.controllers.di", {header: "### DI 依存一覧\n", labels: "コントローラ|依存サービス", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.entities.relations", {header: "### Doctrine リレーション一覧\n", labels: "エンティティ|リレーション", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "components"%} -->
<!-- {{data("symfony.commands.list", {header: "### Console コマンド\n", labels: "コマンド|ファイル|説明", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
