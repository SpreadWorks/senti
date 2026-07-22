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
| src/flow | 107 | controller, lib, cli, model, spec rationale section builder for prompts, Static gate heuristic evaluator, draft-lifecycle-model, routing, middleware, view, Defines a preflight check command for flow prerequisites, repository state, and GitHub tool readiness., Context search and retrieval layer for analysis-backed flow prompts., get guardrail flow command, Prompt loader for flow step instruction templates., Typed review-observation model with validation and legacy normalization., library, auto-check input resolver, Context resolver for active flow execution state., Optional artifact reader for retrospective flow outputs., Retry counter and failure classification utility, Auto-mode eligibility evaluator for feature requests in the flow pipeline., Command handler for completing the current flow task., implementation confirmation command, latest finalized report display command, flow resume command, Scenario-validity test runner and requirement-to-test mapper., Task start command for flow execution, Flow command that triggers project documentation synchronization., acceptance decision command, Command that toggles flow auto mode with eligibility checks., broad mode setter, Metric setter command handler, Note setter command handler, requirement status setter, flow subcommand handler, summary update command, test-header-validator, Checkpointed work-unit planner for resumable review |
| src/lib | 70 | controller, config, Agent defaults and profile merger, Metric dimension normalizer shared by agent runner and metrics aggregator, lib, AGENTS template resolver, cli, model, Shared domain constants for flow validation and control., Runtime dependency container and bootstrapper, Error preview formatter utility, Finalize-cleanup path relocation helper, Option normalization utility, middleware, Core utility for translating glob patterns into executable regular expressions., Guardrail configuration loader, Flow hook runner, Localization and translation loader, Template include resolver, lint-executor, Sensitive data masker, Makefile parsing utility for automated test command discovery., view, Official plugin root resolver, migration, Repository path matching utility, Preset asset deployment helper, Core process runner abstraction and command error normalization., CLI progress renderer, Fluent builder for AI prompts assembled from labeled sections, provider abstraction and registry, Skill rule loader and directive expander, Skill deployment manager, spec.json loading, schema validation, and requirement utilities, Test command source collection and precedence resolution. |
| src/docs | 41 | CLI command for generating and refining AGENTS.md, controller, cli, iterative docs forge command, README generator, CLI command for repository scanning and analysis generation, docs translation command, analysis entry core library, utility, lib, docs command utilities, prompt construction utilities, rendering, review output parser, scannable mixin, file scanner and parser, template resolver and merger, test environment detector, text fill prompt library |
| src | 12 | cli, CLI entrypoint for preset inspection and tree rendering., config |
| src/data | 6 | DataSource registration for AGENTS metadata and template-backed values, documentation data source, language navigation data source, data-source |
| src/check | 3 | cli |
| src/metrics | 2 | Review metrics aggregator and formatter, cli |
| src/spec | 2 | cli, lib |
| src/hook | 1 | Lists configured hooks for users in machine-readable or terminal-friendly form. |
| src/scripts | 1 | migration |
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
