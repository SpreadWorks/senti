<!-- {%extends%} -->

<!-- {%block "dependencies"%} -->
<!-- {{data("laravel.config.composer", {header: "### PHP Dependencies (composer.json)\n", labels: "Package|Version|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->

### docker-compose.yml Configuration

<!-- {{text({prompt: "Describe the docker-compose.yml service configuration in table format. Include service name, container name, ports, and image."})}} -->
<!-- {{/text}} -->

<!-- {{data("laravel.config.middleware", {header: "### Middleware\n", labels: "Class|File|Purpose", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("laravel.config.providers", {header: "### Service Providers\n", labels: "Provider|File|register|boot", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("laravel.config.files", {header: "### Configuration Files\n", labels: "File|Key Settings", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->

<!-- {%block "deploy"%} -->
### Deployment Flow

<!-- {{text({prompt: "Describe the Laravel project deployment procedure. Include php artisan commands (migrate, config:cache, route:cache, etc.)."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "operations"%} -->
### Operations Flow

<!-- {{text({prompt: "Describe the Laravel project operations procedures. Include queue workers, scheduler, logging, etc."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
