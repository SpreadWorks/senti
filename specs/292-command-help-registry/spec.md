# Feature Specification: 292-command-help-registry

**Feature Branch**: `feature/292-command-help-registry`
**Created**: 2026-06-13
**Status**: Draft
**Input**: GitHub Issue #382

## Goal
command registry / command class metadata を help 表示の single source of truth にし、core command と plugin command を同じ help rendering pipeline で扱えるようにする。

## Background
The CLI help display is currently split across a static top-level LAYOUT in `src/help.js`, localized `help.commands` strings, registry entries, command entrypoints, and plugin command metadata. This split makes help drift likely when commands are added or changed, and it prevents plugin commands from flowing through the same renderer as core commands. The change moves help metadata ownership toward command registry / command class metadata, normalizes core and plugin command metadata into one renderer input, and preserves command execution ownership.

## Scope
- `src/help.js` の static LAYOUT 依存を削減または置換し、registry / command metadata 由来で top-level help を生成する。
- top-level help に出る全 core command の help metadata を registry / command class 由来に揃える。
- core command と subcommand の usage、args/options、description、experimental、section、subcommands metadata を実行定義近傍に寄せる。
- plugin command metadata を core command metadata と同じ help renderer に渡せる shape に正規化する。
- locale key または locale map を command metadata 側に持たせ、renderer が現在言語へ解決する。
- top-level core help、core command help、core subcommand help、plugin top-level help、plugin command help、plugin subcommand help、locale rendering、unchanged execution ownership を behavior-level tests で確認する。
- `flow` registry の lifecycle hook / pre / post / onError / finally behavior を維持したまま help metadata rendering の対象にする。
- command module の top-level side effect 禁止規約を contributor が確認できる場所に反映し、focused tests で help rendering が command behavior を実行しないことを確認する。

## Out of Scope
- `flow` lifecycle registry の一括置換。
- plugin command の convention-based discovery と実行登録の全面移行。
- `plugin.json` の肥大化した `contributions.commands` 列挙へ寄せる変更。
- workflow plugin migration 本体または `senti workflow` core removal。
- command behavior、exit code、argument parsing semantics の変更。
- import-time side effect の完全な静的解析器または lint 風 checker の追加。

## Constraints
- 外部依存を追加しない。Node.js built-in modules と既存 command / registry / plugin infrastructure を使う。
- `src/` には特定プロジェクトや環境固有情報を入れない。
- metadata の構造制約は、必要に応じて専用 class と invariant で表現する。
- 同じ metadata normalization または rendering pattern が複数箇所に出る場合は共通 helper に抽出する。
- help output parity は、ユーザーに意味が伝わる内容 parity を必須とする。細かい表現、wording、spacing の完全一致は不要とする。
- plugin command は metadata shape と help renderer 互換までを今回の対象にする。command class discovery と実行登録の全面移行は対象外にする。
- command module の import-time side effect 禁止は規約と focused tests で担保する。完全な機械検査は今回作らない。
- help metadata rendering は command execution dispatcher、argument parsing behavior、exit code behavior、flow lifecycle hooks、plugin hook dispatch、plugin command execution を移動または変更しない。
- Migration parity must map every retained public help surface to its new owner or an explicit unchanged owner before implementation.

## Design Principles
- Help 表示に必要な metadata を実行定義の近くへ寄せ、help list と executable registry の drift を構造的に減らす。
- Renderer は core command と plugin command を同じ normalized metadata shape で扱う。
- Execution registry と lifecycle registry は command 実行の所有者のままにし、help metadata extraction は表示専用の読み取り境界に留める。

## Overview
### Modules
- `src/help.js`: top-level help、command help、subcommand help を shared renderer から生成する entrypoint。
- `src/lib/command-registry.js`: core command tree と help metadata の集約元。docs / check / metrics / spec / hook / flow などの metadata を top-level help へ提供する。
- `src/senti.js`, `src/setup.js`, `src/upgrade.js`, `src/plugin.js`, `src/presets-cmd.js`: independent top-level command entrypoints whose help metadata must be represented in the core command metadata registry while execution remains in the existing entrypoints.
- `src/flow/registry.js`: flow command の help metadata と lifecycle metadata を持つ既存 registry。lifecycle behavior は維持し、help metadata のみ renderer 入力に使う。
- `src/lib/plugin-registry.js`: plugin command contribution を読み、core と同じ normalized help metadata shape へ渡す境界。
- `src/locale/*/ui.json`: 既存 locale 文言の互換 source。command metadata から参照される locale key または fallback として扱う。
- `tests/` and `specs/292-command-help-registry/tests/`: retained help surface と unchanged execution ownership の regression coverage。

### Data Flow
- Core command registry entries expose help metadata including section, name, summary, usage, args/options, experimental, locale source, and subcommands.
- Plugin command contributions are normalized into the same help metadata shape before rendering.
- The help renderer resolves locale-aware text from metadata using the current language, then renders top-level, command, and subcommand help.
- Command execution still flows through existing dispatchers, plugin execution, and flow lifecycle hooks; help rendering reads metadata and does not run command behavior.
- `senti help`, `senti --help`, and `senti -h` render top-level help through the shared renderer from normalized core and plugin metadata.
- `senti help <core>`, `senti help <core subcommand>`, core namespace `--help`, and core leaf `--help` render from the same command metadata; non-help execution remains with existing dispatchers.
- `senti help <plugin>`, `senti help <plugin subcommand>`, direct `senti <plugin> --help`, and direct plugin subcommand help render from normalized plugin metadata; non-help plugin execution remains with `dispatchPluginCommand`.

### Decisions
- [VERIFY] `src/help.js` currently owns static top-level help layout and resolves core descriptions from locale keys.
- [VERIFY] `src/lib/command-registry.js` already owns core command tree execution metadata but only some entries have help metadata.
- [VERIFY] `src/flow/registry.js` already demonstrates registry-style command help metadata together with lazy imports and lifecycle hooks.
- [VERIFY] Plugin command help currently comes from plugin metadata and is rendered separately from core help.
- Migration inventory: top-level core help moves from `src/help.js` static LAYOUT plus `ui:help.commands.*` to core command metadata plus shared renderer.
- Migration inventory: core command/subcommand help moves from scattered registry and entrypoint strings to command metadata interpreted by shared renderer; execution remains with existing dispatchers.
- Migration mapping: independent core commands `help`, `setup`, `upgrade`, `plugin`, and `presets list` receive metadata entries in the core command metadata registry; their execution entrypoints remain unchanged.
- Migration mapping: all observable help invocation surfaces are assigned to renderer-backed metadata, while non-help command execution remains with existing dispatchers or plugin execution.
- Migration inventory: plugin help rendering moves from the plugin-specific `src/help.js` branch to normalized plugin metadata rendered by the shared renderer.
- Migration inventory: `flow` lifecycle behavior remains owned by `src/flow/registry.js`; help metadata consumption must not move pre/post/onError/finally semantics.
- Why this approach: shared metadata and renderer remove the help/registry drift root cause while limiting plugin discovery and execution changes outside this spec.

## Clarifications (Q&A)
- Q: What does semantic help output parity mean?
  - A: The user must still be able to identify the same commands, sections, usage, args/options, descriptions, and experimental status. Exact wording and spacing do not need to match the previous output.
- Q: What plugin discovery work is excluded?
  - A: This spec excludes scanning plugin command directories and registering plugin commands without `contributions.commands`. It only requires plugin command metadata compatibility with the shared help renderer.
- Q: What import-time side-effect work is excluded?
  - A: This spec excludes a full static checker for import-time side effects. It requires a documented no-side-effect convention and focused tests around help rendering behavior.
- Q: What is the retained owner for command execution?
  - A: Existing dispatchers, plugin command execution, flow lifecycle registry hooks, and argument parsing remain the owners of command execution behavior. Help rendering only reads metadata.

## Alternatives Considered
- Migrate only representative commands to registry-derived help metadata. — Rejected because leaving static LAYOUT for remaining core commands would preserve the drift root cause.
- Require byte-for-byte help output parity. — Rejected because the user said meaning is enough and exact wording/spacing does not need to match.
- Keep `help.commands` as the central source for localized command descriptions. — Rejected because it keeps help text ownership separated from command metadata.
- Implement convention-based plugin command discovery in this spec. — Rejected because it changes plugin command registration/execution discovery and is broader than help renderer compatibility.
- Build a full import-time side-effect checker. — Rejected because Issue #382 explicitly allows initial enforcement through convention and review/tests.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-13T10:58:13.543Z
- Notes: User selected [1] at approval step; proceed with gate-passed spec.

## Requirements
- R1 [must]: Core command help metadata must expose enough structured data to render top-level, command, and subcommand help: command name, section, summary, usage, args/options, experimental marker, locale source, and subcommands where applicable.
- R2 [must]: Top-level help must be generated from core command registry / command metadata for every existing core command shown by the current help output, rather than from the static `src/help.js` LAYOUT as the source of truth.
- R3 [must]: Core command and subcommand help must be rendered from the same command metadata source used for top-level help, preserving user-visible usage, args/options, subcommand listing, descriptions, and experimental markers by semantic parity.
- R4 [must]: Plugin command metadata must be normalized to the same renderer input shape as core command metadata so plugin top-level help, command help, and subcommand help use the shared renderer.
- R5 [must]: Locale support must be reachable from command metadata through a locale key or locale map, and the renderer must resolve command summaries/help text using the current language with fallback behavior.
- R6 [must]: The implementation must preserve command execution ownership: dispatchers, argument parsing, exit codes, plugin command execution, flow lifecycle hooks, and plugin hook dispatch must not be moved or semantically changed by help rendering.
- R7 [must]: Migration parity tests must verify each retained public help surface through the new path: top-level core help, core command help, core subcommand help, plugin top-level help, plugin command help, plugin subcommand help, and locale-specific rendering.
- R8 [must]: Import-time side effect policy must be documented near the command metadata convention, and focused tests must show help rendering reads metadata without invoking command run behavior.
- R9 [must]: The implementation must not add convention-based plugin command discovery or a full import-time side-effect static checker in this spec.
- R10 [must]: All newly introduced spec-local tests must include `// spec: R<N>` headers that map each test to the requirement it verifies.
- R11 [must]: Independent top-level core commands currently shown by help but not aggregated in `allCommands` must have explicit metadata owners: `help`, `setup`, `upgrade`, `plugin`, and `presets list` must be represented in the core command metadata registry while their existing execution entrypoints remain unchanged.
- R12 [must]: The spec implementation must map concrete public help invocation surfaces to owners: `senti help`, global `--help`, `senti help <command>`, `senti help <subcommand>`, core namespace `--help`, core leaf `--help`, plugin help through `senti help <plugin>`, and direct plugin `--help` must be renderer-backed metadata paths; non-help execution remains with existing dispatchers.

## Acceptance Criteria
- `src/help.js` no longer uses a hardcoded command LAYOUT as the source of truth for core top-level help.
- A registry-derived top-level help model contains all existing core commands currently shown by help, grouped into user-visible sections with semantic descriptions.
- Core command help and core subcommand help render usage, options/args, description, and subcommand lists from command metadata.
- Plugin command help uses the same renderer path as core command help after plugin command metadata is normalized.
- Locale-specific rendering can produce meaningful command descriptions/help text for at least English and Japanese source paths used by the current project configuration.
- Behavior-level tests cover top-level core help, core command help, core subcommand help, plugin top-level help, plugin command help, plugin subcommand help, and locale rendering through the new path.
- A focused test or existing regression assertion demonstrates that rendering help does not execute command run behavior, alter dispatcher behavior, or move flow lifecycle hook ownership.
- Tests document that full plugin command discovery and full static import-time side-effect checking remain out of scope.
- Metadata ownership is explicit for independent top-level core commands: `help`, `setup`, `upgrade`, `plugin`, and `presets list` are present in the core command metadata registry or an adjacent registry module imported by it.
- Behavior-level tests cover concrete help invocation surfaces: `senti help`, global `--help`, `senti help <core>`, `senti help <core subcommand>`, `senti <core namespace> --help`, `senti <core namespace> <leaf> --help`, `senti help <plugin>`, and direct `senti <plugin> --help`.
- Tests or assertions verify that non-help execution for core commands and plugin commands still routes through the existing dispatchers and plugin execution path.
- Spec-local tests under `specs/292-command-help-registry/tests/` include `// spec: R<N>` headers for each covered requirement.

## Implementation Targets
- src/help.js
- src/lib/command-registry.js
- src/flow/registry.js
- src/lib/plugin-registry.js
- src/locale/en/ui.json
- src/locale/ja/ui.json
- tests/
- specs/292-command-help-registry/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define help metadata model
  - Create or formalize the normalized metadata shape and renderer input that can represent core and plugin command help surfaces.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Generate core help from registry
  - Move all current core top-level help entries to registry / command metadata and render top-level, command, and subcommand help from that source.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Unify plugin help rendering
  - Normalize plugin command metadata into the shared help renderer while keeping plugin command discovery and execution registration unchanged.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Cover parity and policy
  - Add spec-local and shared regression coverage for migration parity, locale resolution, unchanged execution ownership, and import-time side-effect policy.
  - see `tasks/T-4.md` for full spec
