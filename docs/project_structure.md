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
| src/flow | 97 | controller, lib, cli, model, spec rationale section builder for prompts, Artifact completion normalization layer, Static gate heuristic evaluator, draft-lifecycle-model, routing, view, Defines a preflight check command for flow prerequisites, repository state, and GitHub tool readiness., Context search and retrieval layer for analysis-backed flow prompts., get guardrail flow command, Prompt loader for flow step instruction templates., Typed review-observation model with validation and legacy normalization., library, auto-check input resolver, Context resolver for active flow execution state., Optional artifact reader for retrospective flow outputs., Retry counter and failure classification utility, Auto-mode eligibility evaluator for feature requests in the flow pipeline., Command handler for completing the current flow task., implementation confirmation command, latest finalized report display command, flow resume command, Retro summary generation command, Scenario-validity test runner and requirement-to-test mapper., Task start command for flow execution, Flow command that triggers project documentation synchronization., Test result verification and review command, acceptance decision command, Command that toggles flow auto mode with eligibility checks., broad mode setter, Metric setter command handler, Note setter command handler, requirement status setter, flow subcommand handler, summary update command, task scope evaluator, test-header-validator, Checkpointed work-unit planner for resumable review |
| src/lib | 69 | controller, config, Agent defaults and profile merger, Metric dimension normalizer shared by agent runner and metrics aggregator, AGENTS template resolver, lib, cli, model, configuration loader and validator, Shared domain constants for flow validation and control., Runtime dependency container and bootstrapper, Error preview formatter utility, Finalize-cleanup path relocation helper, Option normalization utility, middleware, Core utility for translating glob patterns into executable regular expressions., Guardrail configuration loader, Flow hook runner, Localization and translation loader, Template include resolver, lint-executor, Sensitive data masker, Structured logger, Makefile parsing utility for automated test command discovery., view, Official plugin root resolver, migration, Repository path matching utility, Preset asset deployment helper, Core process runner abstraction and command error normalization., CLI progress renderer, Fluent builder for AI prompts assembled from labeled sections, provider abstraction and registry, Skill rule loader and directive expander, Skill deployment manager, spec.json loading, schema validation, and requirement utilities, Test command source collection and precedence resolution., type contract module |
| src/docs | 41 | CLI command for generating and refining AGENTS.md, controller, cli, iterative docs forge command, README generator, CLI command for repository scanning and analysis generation, docs translation command, analysis entry core library, utility, lib, docs command utilities, prompt construction utilities, rendering, review output parser, scannable mixin, file scanner and parser, template resolver and merger, test environment detector, text fill prompt library |
| src | 12 | cli, CLI entrypoint for preset inspection and tree rendering., config |
| src/data | 6 | DataSource registration for AGENTS metadata and template-backed values, documentation data source, language navigation data source, data-source |
| src/check | 3 | cli |
| src/metrics | 2 | Review metrics aggregator and formatter, cli |
| src/spec | 2 | cli, lib |
| src/hook | 1 | Lists configured hooks for users in machine-readable or terminal-friendly form. |
| src/scripts | 1 | migration |
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
