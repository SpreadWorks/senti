<!-- {%extends%} -->

<!-- {%block "pipelines"%} -->
<!-- {{data("github-actions.pipelines.list", {header: "## パイプライン\n", labels: "名前|ファイル|トリガー|ジョブ数", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "jobs"%} -->
<!-- {{data("github-actions.pipelines.jobs", {header: "## ジョブ詳細\n", labels: "パイプライン|ジョブ|ランナー|ステップ数|依存", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "env"%} -->
<!-- {{data("github-actions.pipelines.env", {header: "## シークレットと環境変数\n", labels: "パイプライン|シークレット|環境変数", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
