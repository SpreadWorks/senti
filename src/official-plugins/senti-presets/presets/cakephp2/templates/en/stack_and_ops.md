<!-- {%extends%} -->

<!-- {%block "stack"%} -->
<!-- {{data("cakephp2.config.stack", {header: "### Technology Stack\n", labels: "Category|Technology|Version", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "dependencies"%} -->
<!-- {{data("cakephp2.config.composer", {header: "### PHP Dependencies (composer.json)\n", labels: "Package|Version|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.docker.list", {header: "### docker-compose.yml Configuration\n", labels: "Service|Container|Port|Image", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.config.assets", {header: "### Frontend Libraries\n", labels: "Library|Version|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.libs.errors", {header: "### Error Handling\n", labels: "Class|File|Responsibility", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.config.bootstrap", {header: "### Application Initialization (bootstrap.php)\n", labels: "Setting|Value", ignoreError: true})}} -->
<!-- {{/data}} -->

### Email Notification Specifications

<!-- {{text({prompt: "Describe the email sending configuration defaults (sender, transport).", mode: "deep"})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.email.list", {labels: "Source File|Subject Pattern|CC"})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "deploy"%} -->
### Deployment Flow

Deployment procedures should be confirmed with the production operations team. No deployment scripts are included in the source code.
<!-- {%/block%} -->

<!-- {%block "operations"%} -->
### Operations Flow

Operations procedures should be confirmed with the production operations team.
<!-- {%/block%} -->
