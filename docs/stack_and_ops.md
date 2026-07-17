<!-- {{data("base.docs.langSwitcher", {labels: "relative"})}} -->
[日本語](ja/stack_and_ops.md) | **English**
<!-- {{/data}} -->

# Technology Stack and Operations

<!-- {{data("monorepo.monorepo.apps", {labels: "stack_and_ops", ignoreError: true})}} -->
<!-- {{/data}} -->

## Description

<!-- {{text({prompt: "Write a 1-2 sentence overview of this chapter. Include the programming language, framework, and key tool versions."})}} -->

This project is a JavaScript codebase for Node.js, delivered as an ECMAScript module CLI and library through the `senti` package entry point. The analyzed configuration identifies Node.js `18.19.0` or newer as the runtime requirement and uses a specifically pinned `pnpm` version for consistent tooling.
<!-- {{/text}} -->

## Content

### Technology Stack

<!-- {{text({prompt: "Describe the technology stack in table format with category, technology name, and version."})}} -->

| Category | Technology | Version |
| --- | --- | --- |
| Programming language | JavaScript | Not specified in the analysis |
| Runtime | Node.js | `18.19.0` or newer |
| Module format | ECMAScript modules (ESM) | Configured at the package level |
| Package manager | pnpm | Specific version pinned in `package.json` |
| Distribution format | Node.js CLI and library package | Exposes `src/senti.js` as both binary and package entry |
| Test execution | Repository-local Node runners | Versions not specified in the analysis |
<!-- {{/text}} -->

### Dependencies

<!-- {{text({prompt: "Describe the project's dependency management approach."})}} -->

Dependency management is centralized in `package.json`, which defines the package entry points, publish scope, runtime requirements, and the test command set in one place. The project also follows a minimal-runtime approach in the analyzed utilities: the TOML parser and Makefile parser are implemented internally and described as dependency-free, which reduces reliance on external packages for core parsing behavior.

For packaging, the manifest publishes the `src/` tree and explicitly excludes preset test directories from the distributed output. Tooling consistency is reinforced by requiring Node.js `18.19.0` or newer and pinning a specific `pnpm` version.
<!-- {{/text}} -->

### Deployment Flow

<!-- {{text({prompt: "Describe the deployment procedure and flow."})}} -->

The analyzed files do not define a deployment pipeline or release workflow beyond package-level distribution settings. Based on `package.json`, the publish flow is scoped to the `src/` directory, exposes `src/senti.js` as the `senti` executable, and exports the same module as the package root.

The packaged output is controlled by explicitly excluding preset test directories, which keeps test assets out of the published artifact. This indicates that deployment, in the analyzed scope, is centered on preparing and publishing a Node.js package with a controlled file set rather than on a separate application deployment process.
<!-- {{/text}} -->

### Operations Flow

<!-- {{text({prompt: "Describe the operations procedures."})}} -->

Operations in this project are centered on predictable command execution, test orchestration, and lightweight file-based inspection. `package.json` defines unit, end-to-end, acceptance, agent-focused, aggregate, and CI test commands through repository-local Node runners, providing a consistent operational entry point for validation tasks.

At runtime, process handling is standardized in `src/lib/process.js`, where synchronous and asynchronous command execution share one option contract for working directory, environment variables, timeouts, and buffers. Errors are normalized through reusable formatting and assertion utilities, which supports consistent diagnostics and fail-fast behavior.

Supporting utilities keep operational checks simple and dependency-free. The Makefile helper can safely inspect files, enforce a 1 MB size limit, and extract the `test` target, while the TOML parser converts basic configuration fragments into plain JavaScript objects for internal use.
<!-- {{/text}} -->

### Alpha Release Invariant

After every change in a release train is committed and the target worktree is clean, run `npm run release:version:sync`. This updates only `package.json` to `0.1.0-alpha.N`, where `N` is the commit count that the dedicated version commit will create. Commit only that manifest change as the final release commit, then run `npm run release:preflight`.

The preflight and the standalone `npm run release:version:validate` command both compare the package version with `git rev-list --count HEAD` and fail on malformed or stale versions. If another commit is added afterward, the release target is no longer final; repeat the dedicated synchronization commit before release. These commands validate release state and do not publish the package.

### Test Command Contract

| Command | Selection |
| --- | --- |
| `npm test` | Unit and end-to-end tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:e2e` | End-to-end tests only |
| `npm run test:acceptance` | Fixture-derived acceptance targets |
| `npm run test:agent` | Real-provider agent tests |
| `npm run test:all` | Default tests plus real-provider agent tests |
| `npm run test:ci` | Credential-free unit, end-to-end, stub acceptance, and CLI smoke stages |

`npm run test:ci` runs its four stages sequentially, stops at the first failure, and never selects `tests/agent`. Use `npm run test:agent` explicitly when provider credentials are available.

`node tests/run.js --help` prints usage without discovering or executing tests. Machine-readable discovery requires the paired flags `--list --json` and accepts one valid suite or file selection. The suite selectors `--preset`, `--scope`, `--agent`, and `--all` are mutually exclusive and cannot be combined with file selection. Repeated `--file`, repeated `--pattern`, and positional paths form one deduplicated file union.

---

<!-- {{data("base.docs.nav")}} -->
[← Tool Overview and Architecture](overview.md) | [Project Structure →](project_structure.md)
<!-- {{/data}} -->
