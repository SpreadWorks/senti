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
| src/flow | 81 | command, spec rationale section builder for prompts, lib, Abstract base command for flow subcommands, draft-lifecycle-model, Flow context resolver, gate-recovery-display, controller, flow-context-search, get guardrail flow command, cli, flow-prompt-loader, Runtime log retrieval command, step-instructions-loader, Review evidence domain model and normalization layer, spec-view-renderer, library, Flow context envelope builder, auto-check command orchestrator, flow task completion command, Finalize cleanup and recovery command, Finalize commit command adapter, finalize merge command wrapper, implementation confirmation command, Spec preparation and initialization command, Read-only report retrieval command for finalized flow output, flow-command, retrospective synthesis command, Flow command executor for test orchestration and artifact generation, Flow command for safely applying overview deltas to spec artifacts., Flow command for managing `user_approval` state in spec metadata., Flow command that toggles automatic approval behavior with guard checks., Issue log persistence and mutation command, Issue setter command handler, Metric setter command handler, Note setter command handler, Request setter command handler, test-header-validator, Flow regression test planner and subprocess execution layer |
| src/lib | 46 | lib, Metric dimension normalizer shared by agent runner and metrics aggregator, AI agent execution engine, Foundational CLI/path helper layer shared across commands., Global CLI command map composer, model, Shared domain constants for flow validation and control., Service-locator container bootstrapping config, agent, providers, paths, and scanner utilities for all CLI subcommands, CLI command dispatch and envelope/error runtime handling, Error preview formatter utility, Path translator that maps worktree-internal artifacts to durable main-repo locations for finalize cleanup, Flow context resolution and lifecycle coordination, Option normalization utility, Git and GitHub command orchestration with normalized repository-state introspection., Core utility for translating glob patterns into executable regular expressions., guardrail loading, merging, and filtering, Safe include preprocessor for templated documentation and skill content., lint-executor, middleware, Makefile parsing utility for automated test command discovery., view, Preset asset deployment utility, Core process runner abstraction and command error normalization., Fluent builder for AI prompts assembled from labeled sections, Agent provider adapter layer, Runtime execution logging framework, Skill rule schema/validation engine and directive expansion layer., spec-json-io, Test command source modeling and priority-based selector. |
| src/docs | 40 | command, cli, docs command, AI enrichment pipeline command, documentation generation orchestrator, documentation integrity reviewer, source analysis scanner, analysis entry core library, utility, lib, parser, prompt composition library, rendering, factory, scanner, library, test environment detector, text fill prompt library |
| src/workflow | 17 | — |
| src | 10 | cli, entry-point |
| src/data | 6 | data-source |
| src/check | 3 | cli, command |
| src/metrics | 2 | Provides the review-metrics command pipeline from argument parsing through artifact loading, aggregation, and multi-format report output., metrics token subcommand: tokenization cost/time aggregator with caching |
| src/scripts | 1 | — |
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
