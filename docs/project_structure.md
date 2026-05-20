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
| src/flow | 77 | flow merge orchestrator, flow-report-generator, flow-review-command, flow-definition, Flow command registry and hook orchestrator, spec rationale section builder for prompts, lib, Abstract base command for flow subcommands, draft-lifecycle-model, draft-review-routes, flow-context, gate-recovery-display, gate-step-resolver, controller, flow-context-search, get guardrail flow command, cli, next-action-resolver, flow-prompt-loader, flow-status-builder, step-instructions-loader, spec-view-renderer, library, Flow auto-check input resolver determining skip/fail/proceed verdicts based on spec approval and draft goal presence, Flow context envelope builder, retry recovery policy and persistence engine, review failure classifier and stop-state formatter, auto-check command orchestrator, flow task completion command, Final regression runner command that executes tests, classifies failure scope, writes artifacts, and appends issue-log entries, finalize cleanup and recovery orchestrator, finalize commit step command, finalize merge command wrapper, Finalize lifecycle utilities, gate command orchestrator and policy engine, implementation confirmation command, Spec preparation command, draft reopen/reset command, report display command, flow report generation command, flow-command, retrospective synthesis command, review command orchestrator, scenario validity test gate command, Test execution orchestrator, Test evidence review command, Flow command for safely applying overview deltas to spec artifacts., Flow command for managing `user_approval` state in spec metadata., Flow command that toggles automatic approval behavior with guard checks., Flow command to declare broad-scope execution intent for task-scoped steps., Issue setter command handler, Metric setter command handler, Note setter command handler, Request setter command handler, Retry reset controller, Primary command for transitioning flow step states with guardrails., Scope policy layer for task-oriented flow execution., Artifact validation and trust layer, test-header-validator, Regression planning engine |
| src/docs | 40 | command, cli, docs command, AI enrichment pipeline command, documentation generation orchestrator, documentation integrity reviewer, source analysis scanner, text directive fill command, analysis entry core library, analysis exclusion filter, lib, prompt composition library, library, test environment detector, text fill prompt library |
| src/lib | 40 | lib, Metric dimension normalizer shared by agent runner and metrics aggregator, Execution runtime for AI/agent subprocess calls and telemetry., Foundational CLI/path helper layer shared across commands., route, model, Configuration loader and validator, Shared domain constants for flow validation and control., Service-locator container bootstrapping config, agent, providers, paths, and scanner utilities for all CLI subcommands, Central dispatcher converting CLI argv into command invocations with envelope output, runtime logging, and hook lifecycle, Path translator that maps worktree-internal artifacts to durable main-repo locations for finalize cleanup, Shared flow-state utility layer for lifecycle and task progression., Flow lifecycle coordinator, Option normalization utility, Flow state store and migration engine, Git and GitHub command orchestration with normalized repository-state introspection., guardrail loading, merging, and filtering, lint-executor, middleware, Makefile parsing utility for automated test command discovery., view, Core process runner abstraction and command error normalization., Fluent builder for AI prompts assembled from labeled sections, Provider plug-ins: per-CLI argument flags and stdout parsers, spec-json-io, Test command source modeling and priority-based selector., Shared type/contract anchor module for internal interfaces. |
| src | 10 | cli, flow-dispatcher, Root CLI bin script dispatching `sdd-forge <subcommand>` invocations to namespace dispatchers or independent module entrypoints |
| src/data | 6 | — |
| src/check | 3 | cli, coverage check command |
| src/metrics | 1 | metrics token subcommand: tokenization cost/time aggregator with caching |
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
