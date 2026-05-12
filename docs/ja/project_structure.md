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
| src/flow | 66 | flow merge orchestrator, flow-command, flow command registry and lifecycle hooks, spec rationale section builder for prompts, lib, flow-context, phase-resolution, controller, library, get guardrail flow command, cli, flow decision engine, command, finalize cleanup teardown, finalize merge command wrapper, flow-helpers, test-header-validator |
| src/docs | 46 | command, cli, docs command, controller, model, DataSource implementation, lib, parser and transformer, resolver composition, library |
| src/lib | 36 | lib, Metric dimension normalizer shared by agent runner and metrics aggregator, Agent runtime: spawns AI CLI, normalizes I/O, retries, and logs invocations, Shared CLI primitives: argv parser, root resolver, worktree detection, route, model, Config loader and path helpers, Validation constants, flow state manager, flow_state_store, guardrail loading, merging, and filtering, lint-executor, middleware, view, child process execution helper, Fluent builder for AI prompts assembled from labeled sections, Provider plug-ins: per-CLI argument flags and stdout parsers, rules validation and rendering, skill deployment pipeline, spec-json-io, Shared type declarations placeholder |
| src | 10 | cli |
| src/check | 3 | cli |
| src/metrics | 1 | metrics token subcommand: tokenization cost/time aggregator with caching |
| src/spec | 1 | cli |
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
