<!-- {%extends "layout"%} -->
<!-- {%block "content"%} -->
# ビジネスロジック層

<!-- {%block "description"%} -->
## 説明

<!-- {{text({prompt: "この章の概要を1〜2文で記述してください。ロジッククラス数、外部連携先を踏まえること。"})}} -->
<!-- {{/text}} -->

## 内容
<!-- {%/block%} -->

<!-- {%block "logic-list"%} -->
### ロジッククラス一覧

<!-- {{text({prompt: "ロジッククラスの一覧をファイルパスと責務とともに表形式で記述してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "logic-structure"%} -->
### ロジッククラス構成

<!-- {{text({prompt: "ロジッククラスの継承パターンと共通メソッドの役割を説明してください。", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{text({prompt: "ロジッククラスの継承元と主要メソッドを表形式で記述してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "external-integration"%} -->
### 外部連携

<!-- {{text({prompt: "外部システムとの連携を説明してください。", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "model-relations"%} -->
<!-- {{data("webapp.models.relations", {header: "### モデル間の依存関係\n", labels: "モデル|関連 (belongsTo / hasMany / hasOne)", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{text({prompt: "主要なモデル間の関連パターンを説明してください。", mode: "deep"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
<!-- {%/block%} -->
