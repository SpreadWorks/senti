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
| src/flow | 85 | flow merge command, Report generation and formatting for flow status artifacts, Flow review command orchestrator, flow definition and lifecycle engine, flow command registry and lifecycle adapter, acceptance review artifact manager, spec rationale section builder for prompts, Static gate heuristic evaluator, Abstract base command for flow subcommands, lib, draft-lifecycle-model, routing, Flow context resolver, step completion contract validator, Translates gate retry state into a normalized display-oriented recovery phase object., Provides gate step and phase translation utilities used by recovery and state inspection logic., Defines a preflight check command for flow prerequisites, repository state, and GitHub tool readiness., Context retrieval and search layer, get guardrail flow command, cli, next-action command logic, Prompt lookup command, Runtime log retrieval command, status reporter, Prompt loader for flow step instruction templates., Review evidence domain model and normalization layer, spec-view-renderer, library, auto-check input resolver, Context resolver for active flow execution state., Optional artifact reader for retrospective flow outputs., Flow retry-recovery policy and persistence layer, Failure classification and stop-state model for review phases., acceptance review command, Auto-mode eligibility evaluator for flow requests., Command handler for completing the current flow task., Final regression runner and failure attribution engine., Flow finalization cleanup and recovery coordinator, Finalize commit command adapter, finalize merge command wrapper, finalize sync command, finalize workflow utility layer, Flow gate evaluator and phase orchestrator, implementation confirmation command, controller, Flow preparation and bootstrap command, draft reopening and reset command, latest finalized report display command, Flow command adapter for report generation, flow-command, retrospective synthesis command, Phase-aware review orchestrator for the flow pipeline., Scenario-validity test runner and requirement-to-test mapper., Flow command that triggers project documentation synchronization., Test execution command for spec-local and project regression checks., test artifact review command, Command for merging overview metadata into a spec artifact., acceptance decision command, Flow command for managing `user_approval` state in spec metadata., Command that toggles flow auto mode with eligibility checks., broad mode setter, Initialization command for creating a new flow run context., Issue log persistence and mutation command, Issue setter command handler, Metric setter command handler, Note setter command handler, requirement status setter, flow subcommand handler, retry state command, step status update command, summary update command, step tree utilities, task scope evaluator, Test artifact validation and trust enforcement layer, test-header-validator, Regression planning and test process execution |
| src/lib | 51 | active flow state registry, agent default configuration merger, Metric dimension normalizer shared by agent runner and metrics aggregator, agent execution engine, AGENTS template resolver, CLI and repository utility library, command namespace registry, model, Configuration loader and schema merger, Shared domain constants for flow validation and control., Runtime dependency container and bootstrapper, CLI dispatcher, Error preview formatter utility, Finalize cleanup path resolver, Flow state helper library, Workflow coordinator, Option normalization utility, Persistent flow state store, lib, Git and GitHub command orchestration with normalized repository-state introspection., Gitignore normalization helper, Core utility for translating glob patterns into executable regular expressions., Guardrail configuration loader, Flow hook runner, Localization and translation loader, Template include resolver, lint-executor, Sensitive data masker, Structured logger, Makefile parsing utility for automated test command discovery., view, Official plugin root resolver, Repository path matching utility, Plugin package registry and lifecycle runtime, Preparing flow state store, Preset asset deployer, Core process runner abstraction and command error normalization., CLI progress renderer, Fluent builder for AI prompts assembled from labeled sections, AI provider abstraction and registry, Runtime execution logging framework, Skill rule loader and directive expander, Skill deployment manager, Spec file persistence and validation helper, Canonical step identifier migration layer for flow and task state., Test command source modeling and priority-based selector., type contract module |
| src/docs | 40 | CLI command for generating and refining AGENTS.md, documentation build orchestrator, cli, data directive renderer, analysis enrichment pipeline, iterative docs forge command, documentation initializer, README generator, documentation review command, CLI command for repository scanning and analysis generation, text directive generation pipeline, docs translation command, analysis entry core library, utility, lib, docs command utilities, DataSource loader, parser, prompt construction utilities, rendering, Resolver factory for preset-based documentation data lookup, review output parser, scannable mixin, file scanner and parser, template resolver and merger, test environment detector, text fill prompt library |
| src | 12 | check command entrypoint, docs command entrypoint, flow CLI entrypoint, CLI help generator, hook command bootstrap, Metrics command entrypoint, top-level CLI dispatcher, spec command namespace entrypoint |
| src/data | 6 | DataSource registration for AGENTS metadata and template-backed values, documentation data source, language navigation data source, data-source |
| src/check | 3 | configuration validation command, documentation freshness checker, scan coverage checker |
| src/metrics | 2 | Review metrics aggregator and formatter |
| src/hook | 1 | Lists configured hooks for users in machine-readable or terminal-friendly form. |
| src/scripts | 1 | step ID migration script |
| src/spec | 1 | spec Markdown renderer |
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
