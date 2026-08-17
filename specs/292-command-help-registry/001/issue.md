# Scope
The core senti CLI command registry / help display / plugin command metadata. In particular, the static LAYOUT in `src/help.js`, `help.commands` in `src/locale/*/ui.json`, and the usage / args / description data distributed across each command registry.

# Problem
Currently, top-level help, detailed help, and executable command definitions are spread across multiple places. As a result, when commands are added or changed, the help side is easy to miss, and there have been past cases where the actual commands and the help display diverged.

If workflow is fully migrated to a plugin, plugin commands also need to have help display capabilities equivalent to core commands. However, if help generation on the core side continues to depend on a static LAYOUT and locale files, it will be difficult to put plugin command metadata through the same pipeline.

# Cause
The core command execution definitions and help metadata are not a single source of truth.

Currently, `src/help.js` owns the LAYOUT for top-level help, descriptions live in `src/locale/*/ui.json`, and detailed help is distributed across each registry / script such as `src/flow/registry.js` and `src/workflow/registry.js`. Since the place where executable commands are defined is separate from the place where commands shown in help are defined, drift occurs structurally.

# Improvement Direction
Make the command registry the single source of truth for help display. Put execution definitions and help metadata in the same command entry, and generate top-level help / command help / subcommand help from the registry.

Do not import command modules only for help display. Command modules may have runtime dependencies or import-time side effects, so information needed for help should be read as static information from the registry / plugin metadata.

Align plugin command contributions with the same information structure as the core command registry. This will allow core commands and plugin commands to flow through the same help rendering pipeline.

# Expected Direction
- Replace the static LAYOUT in `src/help.js` with display generated from the registry.
- Add help metadata such as section, summary, usage, args/options, experimental, and subcommands to command entries.
- Treat text that needs locale support as metadata on the command entry side, rather than depending only on `help.commands` separated from the execution definition.
- Using registry-style commands such as `flow` as the baseline, gradually align `docs`, `check`, `metrics`, `spec`, `hook`, `setup`, `upgrade`, and `plugin` with the same help metadata structure.
- Make plugin command metadata compatible with these core registry entries, and display top-level help, command help, and subcommand help with the same renderer used for core commands.

# Reason for Adding to the Board
For the full workflow plugin migration, `senti workflow` needs to be removed from core while still providing help display equivalent to core commands from plugin metadata. This is not workflow-specific migration work, but a structural issue across CLI help / command registry as a whole, so it should be tracked separately from `9f78`.

# Policy Update: Move Metadata into Command Classes

Command registry / help metadata should, in principle, live in command classes rather than being enumerated in separate files or `plugin.json`.

## Adopted Policy
- Commands are placed as command classes under specific directories.
- Static metadata such as command name, help, usage, args/options, subcommand metadata, and experimental status is held as static properties / static methods on the command class.
- The registry / help renderer discovers command directories and generates top-level help / command help / subcommand help from command class metadata.
- The files that need to be checked when adding or removing commands are consolidated into the command implementation file, reducing drift between implementation and help.
- Avoid enumerating commands in `plugin.json` under `contributions.commands`. This prevents `plugin.json` from becoming bloated and reduces missed updates.
- As with `hooks/*.js` discovery for hooks, plugin commands should move toward convention-based discovery.

## Handling Import-Time Side Effects
Command modules are imported to read static metadata for help display and registry construction.

However, the convention is that the top level of a command module must be limited to imports and class / function declarations, and must not contain import-time side effects. Heavy initialization, config loading, external command execution, network access, and similar work should be deferred to `run()` or another necessary timing.

The initial implementation will not mechanically check for import-time side effects; this will be enforced through convention and review.

## Namespace Commands / Subcommands
For namespace commands such as `senti workflow add`, either the top-level command class owns the subcommand metadata / dispatch, or child classes such as `commands/workflow/*.js` are discovered as well. In either case, priority should be given to keeping subcommand help and execution definitions near the same command class.

## Applying to Core Commands
This policy should apply not only to plugin commands but also to core commands.

However, `flow` is strongly tied to the existing registry through lifecycle hooks such as pre / post / onError / finally, so it should be migrated gradually rather than replaced all at once. First, make it possible to generate help from static metadata on command classes, then organize the scope of integration with the lifecycle registry.

<details>
<summary>ja</summary>

[ENHANCE] command registry を help 表示の single source of truth にする

# 対象
senti 本体の CLI command registry / help 表示 / plugin command metadata。特に `src/help.js` の静的 LAYOUT、`src/locale/*/ui.json` の help.commands、各 command registry に分散している usage / args / description。

# 問題
現状は top-level help、詳細 help、実行可能 command の定義が複数箇所に分散している。そのため command を追加・変更しても help 側の更新漏れが起きやすく、過去にも実際の command と help 表示がずれることがあった。

workflow を plugin に完全移行する場合、plugin command も本体 command と同等の help 表示能力を持つ必要がある。しかし本体側の help 生成が静的 LAYOUT と locale file に依存したままだと、plugin command metadata を同じ pipeline に載せにくい。

# 原因
本体の command 実行定義と help metadata が single source of truth になっていない。

現在は `src/help.js` が top-level help の LAYOUT を持ち、説明文は `src/locale/*/ui.json` にあり、詳細 help は `src/flow/registry.js` や `src/workflow/registry.js` など各 registry / script 側に分散している。実行可能 command を定義する場所と、help に出す command を定義する場所が別なので、構造的に drift が起きる。

# 改善方針
command registry を help 表示の single source of truth にする。実行定義と help metadata を同じ command entry に置き、top-level help / command help / subcommand help を registry から生成する。

help 表示のためだけに command module を import しない。command module には実行時依存や import 時 side effect のリスクがあるため、help に必要な情報は registry / plugin metadata の静的情報として読む。

plugin command contribution も本体 command registry と同じ情報構造に寄せる。これにより、本体 command と plugin command を同じ help rendering pipeline に流せるようにする。

# 想定する方向性
- `src/help.js` の静的 LAYOUT を registry 由来の表示に置き換える。
- command entry に section、summary、usage、args/options、experimental、subcommands などの help metadata を持たせる。
- locale 対応が必要な文言は command entry 側の metadata として扱い、実行定義と離れた `help.commands` だけに依存しない。
- `flow` のような registry 型 command を基準に、`docs`、`check`、`metrics`、`spec`、`hook`、`setup`、`upgrade`、`plugin` も段階的に同じ help metadata 構造へ寄せる。
- plugin command metadata はこの本体 registry entry と互換にし、top-level help、command help、subcommand help を本体 command と同じ renderer で表示する。

# ボードに載せる理由
workflow plugin 完全移行では、`senti workflow` を本体から消しつつ、本体 command と同等の help 表示を plugin metadata から提供する必要がある。これは workflow 固有の移行作業ではなく、CLI help / command registry 全体の構造問題なので、`9f78` から分けて追跡する。

# 方針更新: command class に metadata を寄せる

command registry / help metadata は、別ファイルや `plugin.json` への列挙ではなく、原則として command class に寄せる。

## 採用方針
- command は特定ディレクトリ配下に command class として配置する。
- command 名、help、usage、args/options、subcommand metadata、experimental などの静的 metadata は command class の static property / static method として持たせる。
- registry / help renderer は command directory を discovery し、command class の metadata から top-level help / command help / subcommand help を生成する。
- command 追加・削除時に見るべきファイルを command 実装ファイルへ集約し、実装と help の drift を減らす。
- `plugin.json` の `contributions.commands` に command を列挙する方式は避ける。plugin.json の肥大化と更新漏れを防ぐ。
- hook の `hooks/*.js` discovery と同様に、plugin command も convention-based discovery に寄せる。

## import 時 side effect の扱い
help 表示や registry 構築のために command module を import して static metadata を読む。

ただし command module の top-level は import と class / function 宣言に限定する規約とし、import 時 side effect を書いてはならない。重い初期化、config 読み込み、外部コマンド実行、ネットワークアクセスなどは `run()` 内または必要なタイミングに遅延する。

初期実装では import 時 side effect の機械検査は行わず、規約と review で担保する。

## namespace command / subcommand
`senti workflow add` のような namespace command では、top-level command class が subcommand metadata / dispatch を持つか、`commands/workflow/*.js` のような配下 class をさらに discovery する。どちらにする場合も、subcommand の help と実行定義が同じ command class 近傍にあることを優先する。

## 本体 command への適用
plugin command だけでなく、本体 command もこの方針に寄せる。

ただし `flow` は既存 registry に pre / post / onError / finally など lifecycle hook が強く結びついているため、一括置換ではなく段階移行する。まず command class の static metadata から help を生成できるようにし、その後 lifecycle registry との統合範囲を整理する。

</details>