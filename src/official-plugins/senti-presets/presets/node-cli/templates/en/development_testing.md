<!-- {%extends "layout"%} -->
<!-- {%block "content"%} -->
# Development, Testing, and Distribution

## Description

<!-- {{text({prompt: "Write a 1-2 sentence overview of this chapter. Include local development environment setup, testing strategy, and release flow."})}} -->
<!-- {{/text}} -->

## Content

### Local Development Setup

```bash
git clone <repository>
cd <project>
npm link          # Register as global command
<command> help    # Verify installation
```

<!-- {{text({prompt: "Explain how to run the tool itself during development and how changes are immediately reflected."})}} -->
<!-- {{/text}} -->

### Branch Strategy and Commit Conventions

<!-- {{text({prompt: "Describe branch management and commit message format. Extract from merge settings and commit conventions in the source code."})}} -->
<!-- {{/text}} -->

### Testing

<!-- {{text({prompt: "Describe the testing strategy, framework used, and how to run tests. Extract from the test directory structure and test runner configuration in the source code.", mode: "deep"})}} -->
<!-- {{/text}} -->

### Release Flow

```bash
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.0 → 0.2.0
npm publish         # Publish to npm registry
```

<!-- {{text({prompt: "Describe the release procedure. Derive from publish settings and npm scripts in the source code."})}} -->
<!-- {{/text}} -->

### Technology Stack and Dependencies

<!-- {{text({prompt: "Describe the programming language, runtime version requirements, and dependency policy. Extract from package.json."})}} -->
<!-- {{/text}} -->
<!-- {%/block%} -->
