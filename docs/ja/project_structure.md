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
| src/flow | 79 | Flow review command orchestrator and multi-phase AI review engine, Workflow definition model and step-resolution utility layer, Central command registration and hook wiring for flow lifecycle events, spec rationale section builder for prompts, lib, Abstract base command for flow subcommands, draft-lifecycle-model, draft-review-routes, gate-recovery-display, gate-step-resolver, controller, flow-context-search, get guardrail flow command, cli, next-action-resolver, flow-prompt-loader, flow-status-builder, step-instructions-loader, Review evidence domain model and normalization layer, spec-view-renderer, library, Flow auto-check input resolver determining skip/fail/proceed verdicts based on spec approval and draft goal presence, Flow context envelope builder, retry recovery policy and persistence engine, review failure classifier and stop-state formatter, auto-check command orchestrator, flow task completion command, Final regression executor and failure attribution engine, Finalize commit command adapter, finalize merge command wrapper, Finalize workflow safety and preflight orchestration library, Flow gate orchestration, validation, and AI-evaluation control, implementation confirmation command, Spec preparation and initialization command, draft reopen/reset command, Read-only report retrieval command for finalized flow output, flow report generation command, flow-command, retrospective synthesis command, Phase-aware review runner and verdict interpreter in the flow pipeline, scenario validity test gate command, Flow command executor for test orchestration and artifact generation, Test evidence review command, Flow command for safely applying overview deltas to spec artifacts., Flow command for managing `user_approval` state in spec metadata., Flow command that toggles automatic approval behavior with guard checks., Flow command to declare broad-scope execution intent for task-scoped steps., Issue setter command handler, Metric setter command handler, Note setter command handler, Request setter command handler, Retry reset controller, Primary command for transitioning flow step states with guardrails., Scope policy layer for task-oriented flow execution., Test artifact validation and trust-gate core for the flow pipeline., test-header-validator, Flow regression test planner and subprocess execution layer |
| src/lib | 43 | lib, Metric dimension normalizer shared by agent runner and metrics aggregator, Execution runtime for AI/agent subprocess calls and telemetry., Foundational CLI/path helper layer shared across commands., route, model, Configuration loader and validator, Shared domain constants for flow validation and control., Service-locator container bootstrapping config, agent, providers, paths, and scanner utilities for all CLI subcommands, CLI command dispatch and envelope/error runtime handling, Path translator that maps worktree-internal artifacts to durable main-repo locations for finalize cleanup, Shared flow-state utility layer for lifecycle and task progression., Flow context resolution and lifecycle coordination, Option normalization utility, Flow state persistence, migration, and mutation engine, Git and GitHub command orchestration with normalized repository-state introspection., Core utility for translating glob patterns into executable regular expressions., guardrail loading, merging, and filtering, Safe include preprocessor for templated documentation and skill content., lint-executor, middleware, Makefile parsing utility for automated test command discovery., view, Preset asset deployment utility, Core process runner abstraction and command error normalization., Fluent builder for AI prompts assembled from labeled sections, Provider plug-ins: per-CLI argument flags and stdout parsers, Runtime execution logging framework, Skill rule schema/validation engine and directive expansion layer., Skill distribution and synchronization manager for .agents/.claude environments., spec-json-io, Test command source modeling and priority-based selector., Shared type/contract anchor module for internal interfaces. |
| src/docs | 40 | command, cli, docs command, AI enrichment pipeline command, documentation generation orchestrator, documentation integrity reviewer, source analysis scanner, text directive fill command, analysis entry core library, lib, prompt composition library, library, test environment detector, text fill prompt library |
| src | 10 | cli, Root CLI bin script dispatching `sdd-forge <subcommand>` invocations to namespace dispatchers or independent module entrypoints, Project bootstrap command for configuration, scaffolding, and environment initialization., Upgrade command orchestrator |
| src/data | 6 | — |
| src/check | 3 | cli |
| src/metrics | 1 | metrics token subcommand: tokenization cost/time aggregator with caching |
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
