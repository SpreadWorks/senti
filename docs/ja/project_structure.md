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
| src/flow | 90 | flow merge command, Flow report generation and formatting, Multi-phase flow review orchestrator, model, controller, Acceptance review artifact orchestration and decision engine, spec rationale section builder for prompts, Artifact completion normalization layer, Static gate heuristic evaluator, lib, draft-lifecycle-model, routing, Deferred findings artifact manager, Step completion contract and validation framework, Translates gate retry state into a normalized display-oriented recovery phase object., Provides gate step and phase translation utilities used by recovery and state inspection logic., Defines a preflight check command for flow prerequisites, repository state, and GitHub tool readiness., Context search and retrieval layer for analysis-backed flow prompts., get guardrail flow command, cli, next-action command logic, Prompt lookup command, Runtime log retrieval command, flow status command, Prompt loader for flow step instruction templates., Typed review-observation model with validation and legacy normalization., spec-view-renderer, library, auto-check input resolver, Context resolver for active flow execution state., Optional artifact reader for retrospective flow outputs., Retry counter and failure classification utility, Flow retry-recovery policy and persistence layer, Failure classification and stop-state model for review phases., Acceptance review command wrapper, Auto-mode eligibility evaluator for feature requests in the flow pipeline., Command handler for completing the current flow task., Final regression execution and failure decision engine, Finalize cleanup command and Git recovery coordinator, Finalize commit command adapter, finalize merge command wrapper, finalize sync command, finalize workflow utility layer, Flow gate orchestration and guardrail enforcement, implementation confirmation command, draft reopening and reset command, latest finalized report display command, Report command orchestration, flow resume command, Retro summary generation command, Review command orchestrator, Scenario-validity test runner and requirement-to-test mapper., Task start command for flow execution, Flow command that triggers project documentation synchronization., Test result verification and review command, Command for merging overview metadata into a spec artifact., acceptance decision command, Flow command for managing `user_approval` state in spec metadata., Command that toggles flow auto mode with eligibility checks., broad mode setter, Initialization command for creating a new flow run context., Issue log persistence and mutation command, Issue setter command handler, Metric setter command handler, Note setter command handler, requirement status setter, flow subcommand handler, retry state command, summary update command, step tree utilities, task scope evaluator, test-header-validator, Checkpointed work-unit planner for resumable review |
| src/lib | 53 | active flow state registry, config, Agent defaults and profile merger, Metric dimension normalizer shared by agent runner and metrics aggregator, lib, AGENTS template resolver, CLI and repository utility library, Central command metadata registry for built-in and flow-related CLI commands., model, configuration loader and validator, Shared domain constants for flow validation and control., Runtime dependency container and bootstrapper, controller, Error preview formatter utility, Finalize-cleanup path relocation helper, Flow state helper library, Option normalization utility, Persistent flow state store, Flow target validation and mismatch envelope builder, Gitignore normalization helper, Core utility for translating glob patterns into executable regular expressions., Guardrail configuration loader, Flow hook runner, Localization and translation loader, Template include resolver, lint-executor, Sensitive data masker, Structured logger, Makefile parsing utility for automated test command discovery., view, Official plugin root resolver, Repository path matching utility, Plugin system backend covering source management, manifests, registry assembly, and runtime hook execution., Preparing flow state store, Preset asset deployment helper, Preset catalog, inheritance resolver, and template-chain validator., Core process runner abstraction and command error normalization., CLI progress renderer, Fluent builder for AI prompts assembled from labeled sections, provider abstraction and registry, Runtime execution logging framework, Generic schema validation utility, Skill rule loader and directive expander, Skill deployment manager, spec.json loading, schema validation, and requirement utilities, Canonical step identifier migration layer for flow and task state., Test command source collection and precedence resolution., type contract module |
| src/docs | 40 | CLI command for generating and refining AGENTS.md, documentation build orchestrator, Generate a changelog document from spec directories., data directive renderer, AI-backed documentation enrichment command for analysis metadata generation., iterative docs forge command, Documentation initialization command, README generator, cli, CLI command for repository scanning and analysis generation, Docs text autofill command, docs translation command, analysis entry core library, utility, lib, docs command utilities, DataSource loader, parser, prompt construction utilities, rendering, Resolver factory for preset-based documentation data lookup, review output parser, scannable mixin, file scanner and parser, template resolver and merger, test environment detector, text fill prompt library |
| src | 12 | check command entrypoint, docs command entrypoint, cli, Render localized help for core and plugin commands., hook command bootstrap, Metrics command entrypoint, CLI entrypoint for preset inspection and tree rendering., Top-level CLI router and command bootstrapper, spec command namespace entrypoint, migration |
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
