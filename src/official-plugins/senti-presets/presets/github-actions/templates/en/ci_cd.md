<!-- {%extends%} -->

<!-- {%block "pipelines"%} -->
<!-- {{data("github-actions.pipelines.list", {header: "## Pipelines\n", labels: "Name|File|Triggers|Jobs", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "jobs"%} -->
<!-- {{data("github-actions.pipelines.jobs", {header: "## Job Details\n", labels: "Pipeline|Job|Runner|Steps|Dependencies", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "env"%} -->
<!-- {{data("github-actions.pipelines.env", {header: "## Secrets & Environment Variables\n", labels: "Pipeline|Secrets|Env Vars", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
