<!-- {%extends%} -->

<!-- {%block "setup"%} -->
### Docker Setup

```bash
# Initial setup
npm run docker:init

# Start containers
npm run docker:up

# Stop containers
npm run docker:stop
```

### npm scripts (Docker Operations)

<!-- {{text({prompt: "Describe the Docker operation commands defined in package.json in table format."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "dev-workflow"%} -->
### Local Development Workflow

<!-- {{text({prompt: "Describe the local development workflow in a Docker environment (start -> code -> test -> verify)."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->

<!-- {%block "testing"%} -->
### Test Configuration

<!-- {{text({prompt: "Describe the test framework and test execution methods."})}} -->
<!-- {{/text}} -->

<!-- {{data("cakephp2.tests.list", {labels: "Item|Count|Directory"})}} -->
<!-- {{/data}} -->

### Configuration Constants Reference

<!-- {{data("cakephp2.config.constants", {header: "#### Scalar Constants\n", labels: "Constant|Value|Description", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{data("cakephp2.config.constantsSelect", {header: "#### Selection Constants\n", labels: "Constant|Choices", ignoreError: true})}} -->
<!-- {{/data}} -->
<!-- {%/block%} -->
