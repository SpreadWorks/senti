<!-- {%extends%} -->

<!-- {%block "routing"%} -->
### ルーティング設定

<!-- {{text({prompt: "Laravel のルーティング方式を説明してください。routes/web.php と routes/api.php の役割を含めること。", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("laravel.routes.list", {labels: "メソッド|URI|コントローラ|アクション"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "controller-config"%} -->
<!-- {{data("laravel.controllers.middleware", {header: "### ミドルウェア\n", labels: "ミドルウェア|適用コントローラ", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "controller-list"%} -->
<!-- {{data("laravel.controllers.list", {header: "### コントローラ一覧\n", labels: "コントローラ名|ファイル|主な責務", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("laravel.controllers.actions", {header: "### コントローラ–アクション一覧\n", labels: "コントローラ|アクション", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "controller-deps"%} -->
<!-- {{data("laravel.models.relations", {header: "### Eloquent リレーション一覧\n", labels: "モデル|リレーション", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "components"%} -->
<!-- {{data("laravel.commands.list", {header: "### Artisan コマンド\n", labels: "コマンド|ファイル|説明", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
