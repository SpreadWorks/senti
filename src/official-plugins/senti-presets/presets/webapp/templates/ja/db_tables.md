<!-- {%extends "layout"%} -->
<!-- {%block "content"%} -->
# DB テーブル定義

<!-- {%block "description"%} -->
## 説明

<!-- {{text({prompt: "この章の概要を1〜2文で記述してください。テーブル総数、FK関係を踏まえること。"})}} -->
<!-- {{/text}} -->

## 内容
<!-- {%/block%} -->

<!-- {%block "table-list"%} -->
<!-- {{data("webapp.tables.list", {header: "### テーブル一覧\n", labels: "テーブル名|DB|主な用途", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "fk"%} -->
<!-- {{data("webapp.tables.fk", {header: "### 外部キー関係（FK）\n", labels: "親テーブル|子テーブル|FK カラム|備考", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "indexes"%} -->
### INDEX

※ インデックス定義は DB スキーマから直接確認が必要。
<!-- {%/block%} -->
<!-- {%/block%} -->
