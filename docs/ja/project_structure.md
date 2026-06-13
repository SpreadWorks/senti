<!-- {{data("base.docs.langSwitcher", {labels: "relative"})}} -->
**日本語** | [English](../project_structure.md)
<!-- {{/data}} -->

# プロジェクト構成

<!-- {{data("monorepo.monorepo.apps", {labels: "project_structure", ignoreError: true})}} -->
<!-- {{/data}} -->

## 説明

<!-- {{text({prompt: "この章の概要を1〜2文で記述してください。主要ディレクトリの数と役割を踏まえること。"})}} -->

本章では、sdd-forge パッケージのディレクトリ構成と各領域の役割を説明します。`src/docs`・`src/flow`・`src/lib`・`src/` の 4 つの主要ディレクトリに分かれており、それぞれドキュメント生成・フロー管理・共通ライブラリ・エントリーポイントの責務を担っています。
<!-- {{/text}} -->

## 内容

### ディレクトリ構成

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

<!-- {{data("base.structure.directories", {header: "### 各ディレクトリの責務\n", labels: "ディレクトリ|ファイル数|役割", ignoreError: true})}} -->
### 各ディレクトリの責務

| ディレクトリ | ファイル数 | 役割 |
| --- | --- | --- |
| src/flow | 86 | flow merge command, Report generation and formatting for flow status artifacts, Flow review command orchestrator, flow command registry and lifecycle adapter, spec rationale section builder for prompts, Static gate heuristic evaluator, Abstract base command for flow subcommands, lib, draft-lifecycle-model, routing, Flow context resolver, Translates gate retry state into a normalized display-oriented recovery phase object., Provides gate step and phase translation utilities used by recovery and state inspection logic., Defines a preflight check command for flow prerequisites, repository state, and GitHub tool readiness., Context retrieval and search layer, get guardrail flow command, cli, next-action command logic, Prompt lookup command, Runtime log retrieval command, Prompt loader for flow step instruction templates., Review evidence domain model and normalization layer, spec-view-renderer, library, auto-check input resolver, Context resolver for active flow execution state., Optional artifact reader for retrospective flow outputs., Flow retry-recovery policy and persistence layer, Failure classification and stop-state model for review phases., Auto-mode eligibility evaluator for flow requests., Command handler for completing the current flow task., Final regression runner and failure attribution engine., Flow finalization cleanup and recovery coordinator, Finalize commit command adapter, finalize merge command wrapper, finalize sync command, finalize workflow utility layer, Flow gate orchestrator and validation engine, implementation confirmation command, controller, Initialize spec state and worktree context for flow commands., draft reopening and reset command, latest finalized report display command, Flow command adapter for report generation, flow-command, retrospective synthesis command, Review phase executor and verdict parser, Scenario-validity test runner and requirement-to-test mapper., Flow command that triggers project documentation synchronization., Test execution command for spec-local and project regression checks., test artifact review command, Command for merging overview metadata into a spec artifact., acceptance decision command, Flow command for managing `user_approval` state in spec metadata., Command that toggles flow auto mode with eligibility checks., broad mode setter, Initialization command for creating a new flow run context., Issue log persistence and mutation command, Issue setter command handler, Metric setter command handler, Note setter command handler, requirement status setter, flow subcommand handler, retry state command, step status update command, summary update command, step tree utilities, task scope evaluator, Test artifact validation and trust enforcement layer, test-header-validator, Regression planning and test process execution |
| src/lib | 51 | active flow state registry, agent default configuration merger, Metric dimension normalizer shared by agent runner and metrics aggregator, agent execution engine, AGENTS template resolver, CLI and repository utility library, CLI command registry and help metadata layer, model, Configuration loader and schema merger, Shared domain constants for flow validation and control., Runtime dependency container and bootstrapper, CLI dispatcher, Error preview formatter utility, Finalize cleanup path resolver, Flow state helper library, Workflow coordinator, Option normalization utility, Persistent flow state store, lib, Git and GitHub command orchestration with normalized repository-state introspection., Gitignore normalization helper, Core utility for translating glob patterns into executable regular expressions., Guardrail configuration loader, Flow hook runner, Localization and translation loader, Template include resolver, lint-executor, Sensitive data masker, Structured logger, Makefile parsing utility for automated test command discovery., view, Official plugin root resolver, Repository path matching utility, Plugin registry and lifecycle manager, Preparing flow state store, Preset asset deployer, Resolve preset inheritance and template search behavior., Core process runner abstraction and command error normalization., CLI progress renderer, Fluent builder for AI prompts assembled from labeled sections, AI provider abstraction and registry, Runtime execution logging framework, Validate JSON-like configuration data against simple schemas., Skill rule loader and directive expander, Skill deployment manager, Spec file persistence and validation helper, Canonical step identifier migration layer for flow and task state., Test command source modeling and priority-based selector., type contract module |
| src/docs | 40 | CLI command for generating and refining AGENTS.md, documentation build orchestrator, Generate a changelog document from spec directories., data directive renderer, analysis enrichment pipeline, iterative docs forge command, documentation initializer, README generator, documentation review command, CLI command for repository scanning and analysis generation, text directive generation pipeline, docs translation command, analysis entry core library, utility, lib, docs command utilities, DataSource loader, parser, prompt construction utilities, rendering, Resolver factory for preset-based documentation data lookup, review output parser, scannable mixin, file scanner and parser, template resolver and merger, test environment detector, text fill prompt library |
| src | 12 | check command entrypoint, docs command entrypoint, flow CLI entrypoint, Render localized help for core and plugin commands., hook command bootstrap, Metrics command entrypoint, Plugin CLI command dispatcher, List and visualize preset inheritance trees., Serve as the main CLI dispatcher and help gateway., CLI setup command entrypoint and project bootstrapper, spec command namespace entrypoint, CLI upgrade command entrypoint and legacy migration engine |
| src/data | 6 | DataSource registration for AGENTS metadata and template-backed values, documentation data source, language navigation data source, data-source |
| src/check | 3 | configuration validation command, documentation freshness checker, scan coverage checker |
| src/metrics | 2 | Review metrics aggregator and formatter, Report token usage and cost metrics for flow phases. |
| src/hook | 1 | Lists configured hooks for users in machine-readable or terminal-friendly form. |
| src/scripts | 1 | step ID migration script |
| src/spec | 1 | spec Markdown renderer |
<!-- {{/data}} -->

### 共通ライブラリ

<!-- {{text({prompt: "共通ライブラリの一覧をクラス名・ファイルパス・責務の表形式で記述してください。"})}} -->

| モジュール名 | ファイルパス | 責務 |
| --- | --- | --- |
| registry.js | src/flow/registry.js | フローサブシステムの全コマンド文字列とハンドラーモジュールを一元管理するセントラルレジストリ。ステップ追跡用ミドルウェアの生成と、flow.js ディスパッチからの実装分離も担う |
| presets.js | src/lib/presets.js | `src/presets/` ディレクトリ配下の全プリセットを探索し、`parent` フィールドをたどる継承チェーン解決を提供する。`PRESETS` 定数のほか、チェーン取得・複数チェーン統合・安全なフォールバック付き取得のヘルパーを公開する |
<!-- {{/text}} -->

---

<!-- {{data("base.docs.nav")}} -->
[← 技術スタックと運用](stack_and_ops.md) | [CLI コマンドリファレンス →](cli_commands.md)
<!-- {{/data}} -->
