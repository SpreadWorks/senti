<!-- {%extends "layout"%} -->
<!-- {%block "content"%} -->
# プロジェクト構成

<!-- {{data("monorepo.monorepo.apps", {labels: "project_structure", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {%block "description"%} -->
## 説明

<!-- {{text({prompt: "この章の概要を1〜2文で記述してください。主要ディレクトリの数と役割を踏まえること。"})}} -->
<!-- {{/text}} -->

## 内容
<!-- {%/block%} -->

<!-- {%block "directory-tree"%} -->
### ディレクトリ構成

<!-- {{data("base.structure.tree")}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "directory-roles"%} -->
<!-- {{data("base.structure.directories", {header: "### 各ディレクトリの責務\n", labels: "ディレクトリ|ファイル数|役割", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "libraries"%} -->
### 共通ライブラリ

<!-- {{text({prompt: "共通ライブラリの一覧をクラス名・ファイルパス・責務の表形式で記述してください。"})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
<!-- {%/block%} -->
