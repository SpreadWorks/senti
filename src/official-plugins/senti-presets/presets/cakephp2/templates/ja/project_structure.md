<!-- {%extends%} -->

<!-- {%block "directory-tree"%} -->
### ディレクトリ構成

<!-- {{text({prompt: "プロジェクトのディレクトリ一覧をツリー形式で出力してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "directory-roles"%} -->
### 各ディレクトリの責務

<!-- {{text({prompt: "主要ディレクトリ（Config/Console/Controller/Model/View/Lib/Plugin）の責務をファイル数とともに表形式で記述してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "libraries"%} -->
<!-- {{data("cakephp2.libs.list", {header: "### 共通ライブラリ (Lib/)\n", labels: "クラス|ファイル|責務", ignoreError: true})}} -->
<!-- {{/data}} -->

### View 層

<!-- {{data("cakephp2.views.helpers", {header: "#### ヘルパー\n", labels: "ヘルパー|継承元|責務", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.views.layouts", {header: "#### レイアウト\n", labels: "ファイル|用途", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.views.elements", {header: "#### エレメント\n", labels: "ファイル|用途", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
