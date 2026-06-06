<!-- {{data("base.docs.langSwitcher", {labels: "relative"})}} -->
[日本語](ja/project_structure.md) | **English**
<!-- {{/data}} -->

# Project Structure

<!-- {{data("monorepo.monorepo.apps", {labels: "project_structure", ignoreError: true})}} -->
<!-- {{/data}} -->

## Description

<!-- {{text({prompt: "Write a 1-2 sentence overview of this chapter. Include the number of major directories and their roles."})}} -->

This chapter describes the overall directory organization of the sdd-forge project, which is structured around seven major directories: `src/` (the distributable npm package containing all CLI commands, the preset system, and shared utilities), `docs/` (user-facing documentation in English and Japanese), `specs/` (feature specifications and requirement tracking), `tests/` (integration and acceptance tests), `.sdd-forge/` (project-local runtime configuration and worktree state), `experimental/` (experimental features and prototypes), and `.github/` (CI/CD workflows and GitHub configuration).
<!-- {{/text}} -->

## Content

### Directory Layout

<!-- {{data("base.structure.tree")}} -->
```
src/    (cli)
src/check/commands/    (cli)
src/docs/commands/    (cli, controller)
src/docs/data/    (model, lib)
src/docs/lib/    (model, lib)
src/docs/lib/lang/    (lib)
src/flow/    (controller)
src/flow/commands/    (controller, cli)
src/flow/lib/    (lib, controller, cli)
src/lib/    (lib, route, model, config, middleware, view)
src/metrics/commands/    (cli)
src/spec/commands/    (cli)
```
<!-- {{/data}} -->

<!-- {{data("base.structure.directories", {header: "### Directory Responsibilities\n", labels: "Directory|Files|Role", ignoreError: true})}} -->
### Directory Responsibilities

| Directory | Files | Role |
| --- | --- | --- |
| src/flow | 81 | command, Report generation and formatting for flow status artifacts, Implements the `flow review` command orchestration layer, including multi-phase review execution, AI interaction, artifact generation, and review history tracking., definition, Flow command registry and orchestration layer for runtime hooks, step transitions, and finalize-side validations., spec rationale section builder for prompts, lib, Abstract base command for flow subcommands, draft-lifecycle-model, routing, Flow context resolver, contract, gate-recovery-display, resolver, controller, flow-context-search, get guardrail flow command, cli, flow-prompt-loader, Runtime log retrieval command, Flow status aggregation and reporting service, step-instructions-loader, Review evidence domain model and normalization layer, spec-view-renderer, library, flow-input-resolver, Flow context envelope builder, artifact-reader, Provides the internal retry-recovery engine for SDD flow operations, including validation, evidence comparison, persistence, and eligibility decisions for retry resets., failure-classifier, auto-check command orchestrator, flow task completion command, regression-runner, Finalize cleanup and worktree teardown coordinator, Finalize commit command adapter, finalize merge command wrapper, Finalize workflow safety and Git-state coordination, Core gate engine for flow validation, guardrail enforcement, retry recovery, and result artifact persistence., implementation confirmation command, Implements the flow command that initializes a new spec and optional worktree environment., Draft reopening command, Read-only report retrieval command for finalized flow output, Flow command adapter for report generation, flow-command, retrospective synthesis command, Review phase orchestration command, Scenario validity test runner, Test execution command, test artifact review command, Flow command for safely applying overview deltas to spec artifacts., Flow command for managing `user_approval` state in spec metadata., Flow command that toggles automatic approval behavior with guard checks., broad mode setter, Issue log persistence and mutation command, Issue setter command handler, Metric setter command handler, Note setter command handler, requirement status setter, Request setter command handler, retry policy and reset command, step status mutation command, task scope decision engine, Artifact schema, validation, trust, and lifecycle management, test-header-validator, Flow regression test planner and subprocess execution layer |
| src/lib | 47 | lib, agent default configuration provider, Metric dimension normalizer shared by agent runner and metrics aggregator, AI agent execution engine, Foundational CLI/path helper layer shared across commands., Registers and organizes all command namespaces for the CLI dispatcher., model, Loads and validates project configuration while exposing canonical config and output paths., Shared domain constants for flow validation and control., Service-locator container bootstrapping config, agent, providers, paths, and scanner utilities for all CLI subcommands, CLI command dispatch and envelope/error runtime handling, Error preview formatter utility, Path translator that maps worktree-internal artifacts to durable main-repo locations for finalize cleanup, shared flow state helpers, Flow context resolution and lifecycle coordination, Option normalization utility, flow state persistence and migration layer, Git and GitHub command orchestration with normalized repository-state introspection., Core utility for translating glob patterns into executable regular expressions., guardrail loading, merging, and filtering, Supplies the internal runtime for declarative flow hooks and their command execution., Safe include preprocessor for templated documentation and skill content., lint-executor, middleware, Makefile parsing utility for automated test command discovery., view, Preset asset deployment utility, Core process runner abstraction and command error normalization., Fluent builder for AI prompts assembled from labeled sections, Agent provider adapter layer, Runtime execution logging framework, Skill rule schema/validation engine and directive expansion layer., Skill deployment and synchronization utility for local agent environments., spec-json-io, Canonical step identifier migration layer for flow and task state., Test command source modeling and priority-based selector., Shared type-related library module; implementation not shown in the extract. |
| src/docs | 40 | command, cli, docs command, AI enrichment pipeline command, documentation generation orchestrator, documentation integrity reviewer, source analysis scanner, analysis entry core library, utility, lib, parser, prompt composition library, rendering, factory, scanner, library, test environment detector, text fill prompt library |
| src/workflow | 17 | Namespace dispatcher for workflow board commands., Workflow command registration map., Base command abstraction for workflow subcommands., Shared board utility layer for workflow commands., Category taxonomy and title prefix formatter for workflow items., GitHub board configuration loader for workflow features., GraphQL data access layer for GitHub Projects workflow automation., Short identifier utility for workflow item titles., Localized content validation layer for workflow drafts., Workflow command for adding categorized board draft items., Issue-log ingestion and board draft candidate builder., Workflow command for synchronizing issue start state with the board., Workflow command for listing board items., Workflow command for converting board drafts into GitHub issues., Workflow command for querying board items by text., Workflow command for retrieving one board item by hash., Workflow command for editing board draft items. |
| src | 11 | cli, entry-point, help command renderer, Provides the namespace-level CLI bootstrap for the `hook` command group., Acts as the main CLI launcher and first-stage dispatcher for all sdd-forge commands., Project bootstrap and interactive setup command., CLI implementation for upgrade execution and artifact capture |
| src/data | 6 | data-source |
| src/check | 3 | cli, Documentation freshness checker, command |
| src/metrics | 2 | Provides the review-metrics command pipeline from argument parsing through artifact loading, aggregation, and multi-format report output., metrics token subcommand: tokenization cost/time aggregator with caching |
| src/hook | 1 | Lists configured hooks for users in machine-readable or terminal-friendly form. |
| src/scripts | 1 | Repository migration script for bulk step rename refactors. |
| src/spec | 1 | Spec-to-Markdown rendering command with schema-gated output generation. |
<!-- {{/data}} -->

### Shared Libraries

<!-- {{text({prompt: "List the shared libraries with class name, file path, and responsibility in table format."})}} -->

The following shared libraries are reused across multiple modules in the codebase.

| Class / Export | File Path | Responsibility |
|---|---|---|
| `Logger` | `src/lib/log.js` | Singleton class for unified JSONL logging; writes daily log files and per-request prompt logs; opt-in via `config.logs.enabled` |
| `DataSource` | `src/docs/lib/data-source.js` | Base class for all `{{data}}` directive resolvers; provides `init()`, `desc()`, `mergeDesc()`, and override loading contract |
| `Scannable` (mixin) | `src/docs/lib/scan-source.js` | Mixin that adds the full scan pipeline (file iteration, hash checking, summary generation) to any `DataSource` subclass |
| `AnalysisEntry` | `src/docs/lib/analysis-entry.js` | Base class for `analysis.json` entries; defines common fields (`file`, `hash`, `lines`, `mtime`) and static summary generation |
| `FlowCommand` | `src/flow/lib/base-command.js` | Base class for all SDD flow subcommands; implements `run()` with validation; subclasses override `execute()` |
| `resolveAgent()`, `callAgent()` | `src/lib/agent.js` | AI agent invocation for claude, codex, and other providers; handles prompt resolution, stdin/argv size thresholds, and logging |
| `loadConfig()` | `src/lib/config.js` | Loads and parses `.sdd-forge/config.json`; resolves concurrency defaults and language settings |
| `parseArgs()`, `repoRoot()` | `src/lib/cli.js` | CLI context resolution — repo root, source root, argument parsing, and project-mode environment variable handling |
| `buildProjectPreset()`, `resolveChainSafe()` | `src/lib/presets.js` | Discovers presets from `src/presets/` and resolves single-inheritance `parent` chains; merges multiple chains |
| `loadFlowState()`, `saveFlowState()` | `src/lib/flow-state.js` | SDD workflow state persistence via `flow.json` and `.active-flow` pointer; step and phase tracking |
| `ok()`, `fail()`, `warn()` | `src/lib/flow-envelope.js` | Produces typed JSON envelope objects for all flow command responses (success, failure, warning) |
| `translate()`, `createI18n()` | `src/lib/i18n.js` | Domain-namespaced multilingual string lookup with placeholder interpolation for en/ja locales |
| `runCmd()`, `runCmdAsync()` | `src/lib/process.js` | Unified command execution wrapper; returns result objects with `status`, `stdout`, `stderr`; never throws |
| `collectGitSummary()`, `commentOnIssue()` | `src/lib/git-helpers.js` | Git and GitHub CLI state queries (branch, ahead count, diff stats) and issue comment posting |
| `resolveIncludes()` | `src/lib/include.js` | Resolves `<!-- include("path") -->` directives in templates; supports nested includes and `@templates/`/`@presets/` paths |
| `parseData()`, `parseText()`, `parseBlocks()` | `src/docs/lib/directive-parser.js` | Parses `{{data}}`, `{{text}}`, `{%extends%}`, and `{%block%}` control directives from markdown template files |
| `mergeTemplate()` | `src/docs/lib/template-merger.js` | Resolves template layer inheritance bottom-up; handles `{%extends%}` and `{%block%}` merging across preset chains |
| `createResolvers()` | `src/docs/lib/resolver-factory.js` | Factory that instantiates and initializes all `{{data}}` and `{{text}}` resolver objects from a preset chain |
| `getLangHandler()` | `src/docs/lib/lang-factory.js` | Factory returning the appropriate language parser (JS, PHP, Python, YAML) based on file extension |
| `scanFiles()`, `findFiles()` | `src/docs/lib/scanner.js` | Generic source file discovery using glob patterns; delegates per-file parsing to language handlers |
<!-- {{/text}} -->

---

<!-- {{data("base.docs.nav")}} -->
[← Technology Stack and Operations](stack_and_ops.md) | [CLI Command Reference →](cli_commands.md)
<!-- {{/data}} -->
