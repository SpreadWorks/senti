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
| src/flow | 81 | command, Report generation and formatting for flow status artifacts, Multi-phase review command orchestrator for the Spec-Driven Development flow, including prompt generation, AI response validation, scoped diff analysis, and review artifact persistence., definition, flow command registry and hook coordinator, spec rationale section builder for prompts, lib, Abstract base command for flow subcommands, draft-lifecycle-model, routing, Flow context resolver, contract, gate-recovery-display, resolver, controller, flow-context-search, get guardrail flow command, cli, flow-prompt-loader, Runtime log retrieval command, step-instructions-loader, Review evidence domain model and normalization layer, spec-view-renderer, library, flow-input-resolver, Flow context envelope builder, artifact-reader, Provides the internal retry-recovery engine for SDD flow operations, including validation, evidence comparison, persistence, and eligibility decisions for retry resets., failure-classifier, auto-check command orchestrator, flow task completion command, regression-runner, Finalize cleanup and recovery command, Finalize commit command adapter, finalize merge command wrapper, Finalize workflow safety and Git-state coordination, Flow gate command and validation engine for SDD phases, with artifact auditing, AI-based guardrail checks, retry handling, and result persistence., implementation confirmation command, Spec preparation and initialization command, Draft reopening command, Read-only report retrieval command for finalized flow output, Flow command adapter for report generation, flow-command, retrospective synthesis command, Review phase orchestration command, Scenario validity test runner, Test execution command, test artifact review command, Flow command for safely applying overview deltas to spec artifacts., Flow command for managing `user_approval` state in spec metadata., Flow command that toggles automatic approval behavior with guard checks., broad mode setter, Issue log persistence and mutation command, Issue setter command handler, Metric setter command handler, Note setter command handler, requirement status setter, Request setter command handler, retry policy and reset command, step status mutation command, task scope decision engine, Artifact schema, validation, trust, and lifecycle management, test-header-validator, Flow regression test planner and subprocess execution layer |
| src/lib | 46 | lib, agent default configuration provider, Metric dimension normalizer shared by agent runner and metrics aggregator, AI agent execution engine, Foundational CLI/path helper layer shared across commands., Global CLI command map composer, model, configuration loader and validator, Shared domain constants for flow validation and control., Service-locator container bootstrapping config, agent, providers, paths, and scanner utilities for all CLI subcommands, CLI command dispatch and envelope/error runtime handling, Error preview formatter utility, Path translator that maps worktree-internal artifacts to durable main-repo locations for finalize cleanup, shared flow state helpers, Flow context resolution and lifecycle coordination, Option normalization utility, flow state persistence and migration layer, Git and GitHub command orchestration with normalized repository-state introspection., Core utility for translating glob patterns into executable regular expressions., guardrail loading, merging, and filtering, Safe include preprocessor for templated documentation and skill content., lint-executor, middleware, Makefile parsing utility for automated test command discovery., view, Preset asset deployment utility, Core process runner abstraction and command error normalization., Fluent builder for AI prompts assembled from labeled sections, Agent provider adapter layer, Runtime execution logging framework, Skill rule schema/validation engine and directive expansion layer., Skill deployment and synchronization utility for local agent environments., spec-json-io, Canonical step identifier migration layer for flow and task state., Test command source modeling and priority-based selector., Shared type-related library module; implementation not shown in the extract. |
| src/docs | 40 | command, cli, docs command, AI enrichment pipeline command, documentation generation orchestrator, documentation integrity reviewer, source analysis scanner, analysis entry core library, utility, lib, parser, prompt composition library, rendering, factory, scanner, library, test environment detector, text fill prompt library |
| src/workflow | 17 | Namespace dispatcher for workflow board commands., Workflow command registration map., Base command abstraction for workflow subcommands., Shared board utility layer for workflow commands., Category taxonomy and title prefix formatter for workflow items., GitHub board configuration loader for workflow features., GraphQL data access layer for GitHub Projects workflow automation., Short identifier utility for workflow item titles., Localized content validation layer for workflow drafts., Workflow command for adding categorized board draft items., Issue-log ingestion and board draft candidate builder., Workflow command for synchronizing issue start state with the board., Workflow command for listing board items., Workflow command for converting board drafts into GitHub issues., Workflow command for querying board items by text., Workflow command for retrieving one board item by hash., Workflow command for editing board draft items. |
| src | 10 | cli, entry-point, help command renderer, Primary CLI dispatcher for `sdd-forge` commands., Project bootstrap and interactive setup command., CLI implementation for upgrade execution and artifact capture |
| src/data | 6 | data-source |
| src/check | 3 | cli, Documentation freshness checker, command |
| src/metrics | 2 | Provides the review-metrics command pipeline from argument parsing through artifact loading, aggregation, and multi-format report output., metrics token subcommand: tokenization cost/time aggregator with caching |
| src/scripts | 1 | Repository migration script for bulk step rename refactors. |
| src/spec | 1 | Spec-to-Markdown rendering command with schema-gated output generation. |
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
