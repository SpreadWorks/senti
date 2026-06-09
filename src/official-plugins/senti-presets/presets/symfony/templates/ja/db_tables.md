<!-- {%extends%} -->

<!-- {%block "table-list"%} -->
<!-- {{data("symfony.tables.list", {header: "### テーブル一覧（マイグレーションから抽出）\n", labels: "テーブル名|カラム数|主な用途", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "entity-columns"%} -->
<!-- {{data("symfony.entities.columns", {header: "### エンティティ・カラム一覧\n", labels: "エンティティ|カラム|型|NULL|PK", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "fk"%} -->
<!-- {{data("symfony.tables.fk", {header: "### 外部キー関係（FK）\n", labels: "テーブル|カラム|参照先", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "relations"%} -->
<!-- {{data("symfony.entities.relations", {header: "### Doctrine リレーション\n", labels: "エンティティ|リレーション", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
