# <!-- {{data("cli.project.name")}} --><!-- {{/data}} -->

<!-- {{data("cli.docs.langSwitcher", {labels: "absolute"})}} -->
<!-- {{/data}} -->

<!-- {{text({prompt: "このプロジェクトの概要を1〜2文で説明してください。"})}} -->
<!-- {{/text}} -->

<!-- {%block "quickstart"%} -->
## クイックスタート

### インストール

<pre>
# npm
npm install -g <!-- {{data("cli.project.name")}} --><!-- {{/data}} -->

# yarn
yarn global add <!-- {{data("cli.project.name")}} --><!-- {{/data}} -->

# pnpm
pnpm add -g <!-- {{data("cli.project.name")}} --><!-- {{/data}} -->
</pre>

### 基本コマンド

<pre>
<!-- {{data("cli.project.name")}} --><!-- {{/data}} --> help
</pre>
<!-- {%/block%} -->

<!-- {%block "docs"%} -->
<!-- {{data("cli.docs.chapters", {header: "## ドキュメント\n", labels: "章|概要", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
