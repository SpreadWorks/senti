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
src/    (lib, cli, middleware)
src/check/commands/    (cli)
src/docs/commands/    (cli, controller, lib)
src/docs/data/    (model)
src/docs/lib/    (lib, model)
src/docs/lib/lang/    (lib)
src/flow/    (config)
src/flow/commands/    (cli)
src/flow/lib/    (model, lib, cli, controller)
src/lib/    (model, lib, config, middleware, controller, view)
src/metrics/commands/    (cli)
```
<!-- {{/data}} -->

<!-- {{data("base.structure.directories", {header: "### 各ディレクトリの責務\n", labels: "ディレクトリ|ファイル数|役割", ignoreError: true})}} -->
### 各ディレクトリの責務

| ディレクトリ | ファイル数 | 役割 |
| --- | --- | --- |
| src/docs | 43 | cli, controller, lib, model |
| src/flow | 36 | cli, model, lib, controller, config |
| src/lib | 32 | model, lib, config, middleware, controller, view |
| src | 11 | lib, cli, middleware |
| src/check | 3 | cli |
| src/metrics | 1 | cli |
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
