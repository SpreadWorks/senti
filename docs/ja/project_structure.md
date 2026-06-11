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
| src/official-plugins | 131 | — |
| src/flow | 82 | flow merge command, Report generation and formatting for flow status artifacts, Flow review command orchestrator, Workflow definition and lifecycle engine, spec rationale section builder for prompts, Static gate heuristic evaluator, Abstract base command for flow subcommands, lib, draft-lifecycle-model, routing, Flow context resolver, contract, Translates gate retry state into a normalized display-oriented recovery phase object., Provides gate step and phase translation utilities used by recovery and state inspection logic., Defines a preflight check command for flow prerequisites, repository state, and GitHub tool readiness., Context retrieval and search layer, get guardrail flow command, cli, Next-action decision engine, Prompt lookup command, Runtime log retrieval command, status reporter, Prompt loader for flow step instruction templates., Review evidence domain model and normalization layer, spec-view-renderer, library, auto-check input resolver, Context resolver for active flow execution state., Optional artifact reader for retrospective flow outputs., Failure classification and stop-state model for review phases., Auto-mode eligibility evaluator for flow requests., Command handler for completing the current flow task., Final regression runner and failure attribution engine., Finalize commit command adapter, finalize merge command wrapper, finalize sync command, finalize workflow utility layer, multi-phase gate and guardrail engine, implementation confirmation command, controller, draft reopening and reset command, latest finalized report display command, Flow command adapter for report generation, flow-command, retrospective synthesis command, Phase-aware review orchestrator for the flow pipeline., Scenario-validity test runner and requirement-to-test mapper., Flow command that triggers project documentation synchronization., Test execution command for spec-local and project regression checks., test artifact review command, Command for merging overview metadata into a spec artifact., Flow command for managing `user_approval` state in spec metadata., Command that toggles flow auto mode with eligibility checks., broad mode setter, Initialization command for creating a new flow run context., Issue log persistence and mutation command, Issue setter command handler, Metric setter command handler, Note setter command handler, requirement status setter, flow subcommand handler, retry state command, step status command, summary update command, step tree utilities, task scope evaluator, test-header-validator |
| src/lib | 50 | Metric dimension normalizer shared by agent runner and metrics aggregator, model, Shared domain constants for flow validation and control., CLI dispatcher, Error preview formatter utility, Finalize cleanup path resolver, Flow state helper library, Workflow coordinator, Option normalization utility, Persistent flow state store, lib, Git and GitHub command orchestration with normalized repository-state introspection., Gitignore normalization helper, Core utility for translating glob patterns into executable regular expressions., Guardrail configuration loader, Flow hook runner, Localization and translation service, Safe include preprocessor for templated documentation and skill content., lint-executor, Sensitive data masker, Structured logger, Makefile parsing utility for automated test command discovery., view, Preparing flow state store, Preset asset deployer, Preset discovery and chain validation, Core process runner abstraction and command error normalization., CLI progress renderer, Fluent builder for AI prompts assembled from labeled sections, AI provider abstraction and registry, Runtime execution logging framework, Lightweight schema validation utility, Skill rule loader and directive expander, Skill deployment manager, Spec file persistence and validation helper, Canonical step identifier migration layer for flow and task state., Test command source modeling and priority-based selector. |
| src/docs | 40 | AGENTS document generator, documentation build orchestrator, cli, data directive renderer, analysis enrichment pipeline, iterative docs forge command, documentation initializer, README generator, documentation review command, docs scan command, text directive generation pipeline, docs translation command, analysis entry core library, utility, lib, docs command utilities, DataSource loader, parser, prompt construction utilities, rendering, resolver factory, review output parser, scannable mixin, file scanner and parser, template resolver and merger, test environment detector, text fill prompt library |
| src | 12 | check command entrypoint, docs command entrypoint, flow CLI entrypoint, Metrics command entrypoint, top-level CLI dispatcher, project setup command, spec command namespace entrypoint, legacy project upgrade command |
| src/data | 6 | AGENTS data source, documentation data source, language navigation data source, data-source |
| src/check | 3 | configuration validation command, documentation freshness checker, scan coverage checker |
| src/metrics | 2 | Review metrics aggregator and formatter |
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
