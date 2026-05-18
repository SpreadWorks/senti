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
| src/flow | 74 | flow merge orchestrator, spec rationale section builder for prompts, lib, flow-context, controller, get guardrail flow command, cli, library, finalize merge command wrapper, flow-command, Flow command for safely applying overview deltas to spec artifacts., Flow command for managing `user_approval` state in spec metadata., Flow command that toggles automatic approval behavior with guard checks., Flow command to declare broad-scope execution intent for task-scoped steps., Flow command for controlled retry counter resets in gate/review pipelines., Primary command for transitioning flow step states with guardrails., Scope policy layer for task-oriented flow execution., test-header-validator, Regression command orchestration and change-impact classification. |
| src/docs | 46 | command, cli, docs command, AI enrichment pipeline command, documentation generation orchestrator, documentation integrity reviewer, source analysis scanner, text directive fill command, model, DataSource implementation, lib, analysis entry core library, analysis exclusion filter, parser and transformer, prompt composition library, resolver composition, library, test environment detector, text fill prompt library |
| src/lib | 38 | lib, Metric dimension normalizer shared by agent runner and metrics aggregator, Execution runtime for AI/agent subprocess calls and telemetry., Foundational CLI/path helper layer shared across commands., route, model, Configuration schema, defaults, and loader utilities., Shared domain constants for flow validation and control., Application composition root and dependency injection container., Core dispatch pipeline for command execution and structured output., Shared flow-state utility layer for lifecycle and task progression., guardrail loading, merging, and filtering, lint-executor, middleware, view, Fluent builder for AI prompts assembled from labeled sections, Provider plug-ins: per-CLI argument flags and stdout parsers, rules validation and rendering, skill deployment pipeline, spec-json-io |
| src | 10 | cli |
| src/check | 3 | cli, coverage check command |
| src/metrics | 1 | metrics token subcommand: tokenization cost/time aggregator with caching |
| src/spec | 1 | — |
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
