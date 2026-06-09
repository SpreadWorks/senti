<!-- {%extends%} -->

<!-- {%block "dependencies"%} -->
<!-- {{data("symfony.config.composer", {header: "### PHP Dependencies (composer.json)\n", labels: "Package|Version|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.config.bundles", {header: "### Symfony Bundles\n", labels: "Bundle|Fully Qualified Name|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.config.packages", {header: "### Configuration Files (config/packages/)\n", labels: "File|Key Settings", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("symfony.config.services", {header: "### Service Configuration\n", labels: "autowire|autoconfigure", ignoreError: true})}} -->
<!-- {{/data}} -->

### docker-compose.yml Configuration

<!-- {{text({prompt: "Describe the docker-compose.yml service configuration in table format. Include service name, container name, ports, and image."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "deploy"%} -->
### Deployment Flow

<!-- {{text({prompt: "Describe the Symfony project deployment procedure. Include bin/console commands (doctrine:migrations:migrate, cache:clear, assets:install, etc.)."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "operations"%} -->
### Operations Flow

<!-- {{text({prompt: "Describe the Symfony project operations procedures. Include Messenger workers, scheduler, logging (Monolog), etc."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
