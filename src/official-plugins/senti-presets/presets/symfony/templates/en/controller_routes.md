<!-- {%extends%} -->

<!-- {%block "routing"%} -->
### Routing Configuration

<!-- {{text({prompt: "Describe the Symfony routing approach. Include the roles of #[Route] attributes and config/routes.yaml.", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("symfony.routes.list", {labels: "Method|Path|Controller|Name"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "controller-list"%} -->
<!-- {{data("symfony.controllers.list", {header: "### Controller List\n", labels: "Controller|File|Primary Responsibility", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.controllers.actions", {header: "### Controller-Action List\n", labels: "Controller|Action", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "controller-deps"%} -->
<!-- {{data("symfony.controllers.di", {header: "### DI Dependencies\n", labels: "Controller|Dependency Service", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.entities.relations", {header: "### Doctrine Relations\n", labels: "Entity|Relations", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "components"%} -->
<!-- {{data("symfony.commands.list", {header: "### Console Commands\n", labels: "Command|File|Description", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
