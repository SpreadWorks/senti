# Feature Specification: 286-plugin-foundation-runtime

**Feature Branch**: `feature/286-plugin-foundation-runtime`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub Issue #373

## Goal
workflow plugin と preset plugin を core 実装から外部化する前提として、shared plugin foundation を実装する。

## Background
Issue #373 prepares the plugin foundation needed before workflow and preset implementations can move to external plugin repositories. The current core still depends on plugin.json.files allowlists, plugin.repos config, static workflow help, direct plugin command main() loading, and workflow/preset-specific assumptions. This spec creates the shared runtime contract without migrating workflow or preset implementations themselves.

## Scope
- installed and enabled plugin roots から hooks/*.js を discovery/validate し、flow prepare 成功時に flow.json へ snapshot する runtime foundation。
- snapshot 済み plugin hook を flow command registry の pre/post lifecycle point で実行する runner と public context。
- plugin command を register(api) factory と Envelope-compatible return に寄せる runtime foundation。
- plugin command help metadata を enabled plugin registry から取得し、top-level help と command help に反映する基盤。
- plugin.config.<pluginId> namespace と plugin config defaults/schema の runtime merge。
- plugin.json.files 必須を廃止し、known paths だけを copy する installer convention。
- plugin.sources[] と plugin.packages[] の separation、および git/local source の validation/reproducibility policy。
- workflow-specific flow instructions を AI skill text から CLI side hook へ移すための foundation と検証。

## Out of Scope
- workflow implementation 自体を外部 repository へ完全移行しない。
- preset implementation 自体を外部 repository へ完全移行しない。
- 既存 registry hook の class 化は行わない。
- npm source の本格対応は行わず、初期実装では unsupported validation までに留める。
- plugin install/update で package scripts を実行しない。
- import-time side effect の機械的検査は初期実装に含めず、規約と review 対象にする。

## Constraints
- 外部依存は追加しない。Node.js built-in module だけで実装する。
- alpha policy に従い、plugin.repos / packages[].repo を runtime で読み続ける compatibility shim は作らない。
- backward-compatible-cli-interface: plugin config rename の migration plan は upgrade/config validation/help guidance に明記する。旧 field が残る場合は actionable error で plugin.sources / packages[].source への置換を促す。
- plugin hook / command modules は core internal path を import しない。core 側 API は register(api) または public context 経由で渡す。
- 既存 top-level workflow.* config は silent ignore しない。senti upgrade で plugin.config.workflow へ移行し、移行後も top-level workflow.* が残る場合は actionable error で新 namespace への移動を促す。
- plugin hook discovery, snapshot, command metadata, known-path copy は具体的な上限を持つ。1 project あたり enabled plugin packages は最大 100、1 plugin あたり hook files は最大 200、known-path copy 対象 files は最大 2000、directory depth は最大 20、manifest/config/help metadata JSON は各 1 MiB 以下、relative path は 300 bytes 以下に制限する。
- CLI command の失敗条件は non-zero exit にする。hook run failure は command envelope warning と issue-log candidate に変換し、main flow の exit code は hook run failure だけでは変えない。
- user-facing inputs は entry point で検証する。source id、package id、source type、local path、git remote、commit SHA、command metadata path、hook metadata は invalid value を拒否する。
- src/ 以下に project 固有情報を書かない。fixture や example は sample-preset / child-preset のような汎用名を使う。
- src/skills または src/presets を変更した場合は、生成済み skill/preset artifacts が source と整合する diff になっていることを検証対象にする。

## Design Principles
- 既存 flow command registry の lifecycle point を拡張し、新しい event bus は作らない。
- plugin hook plan は flow prepare 成功時の snapshot を source of truth にし、active flow 中に live discovery しない。
- plugin command/help/hook/config は workflow/preset 固有名を core が解釈しない形に寄せる。
- public plugin context は core internal object を渡さず、必要な値と helper だけを渡す。

## Overview
### Modules
- src/lib/plugin-registry.js: plugin manifest validation, installed plugin registry, source/package config, command metadata, hook plan discovery の中心。
- src/flow/registry.js and src/lib/command-registry.js: existing flow lifecycle hooks and command metadata に plugin hook runner を接続する入口。
- src/senti.js and src/plugin.js: top-level plugin command dispatch と plugin management CLI の user-facing surface。
- src/help.js: static workflow display を plugin command metadata aware rendering に置き換える対象。
- src/lib/config.js: plugin config namespace, defaults/schema runtime merge, source/package validation の対象。

### Data Flow
- plugin install/update resolves plugin.sources[], copies known paths into .senti/plugins/<pluginId>, and records enabled packages in plugin.packages[].
- flow prepare runs existing prepare behavior, discovers enabled plugin hooks, snapshots pluginId/module/class/command/hook/priority into flow.json, then runs snapshot prepare.post hooks.
- later flow commands read flow.json plugins.flowCommandHooks, resolve installed plugin modules, build public context, execute hooks, and fold hook warnings into the command envelope.
- top-level command dispatch resolves enabled plugin command metadata, loads command modules through register(api), and treats returned Envelope-compatible objects as command results.

### Decisions
- [VERIFY] src/lib/plugin-registry.js currently requires plugin.json.files and copies manifest.files; result=match with draft policy.
- [VERIFY] src/lib/config.js currently validates plugin.repos and packages[].repo; result=match with config rename requirement.
- [VERIFY] src/help.js currently includes static Workflow section and workflow command; result=match with plugin-aware help requirement.
- [VERIFY] src/senti.js currently dispatches plugin command modules by calling dispatchPluginCommand; result=match with command runtime replacement requirement.
- Hook failures are split by phase: discovery/import/register/metadata validation failures are hard failures, while hook run failures become warnings and issue-log candidates.
- Existing active flows without hook snapshots continue without hooks; no live discovery fallback or re-prepare requirement is introduced.

## Clarifications (Q&A)
- Q: Does this spec migrate workflow or preset implementations to external repositories?
  - A: No. It only prepares the shared plugin foundation needed by those later migrations.
- Q: Are old plugin.repos and packages[].repo fields supported at runtime?
  - A: No. Alpha policy rejects long-term compatibility shims. The migration plan is documented upgrade/config validation/help guidance with actionable errors.
- Q: What happens to existing top-level workflow.flowIntegration config?
  - A: It is migrated to plugin.config.workflow.flowIntegration by senti upgrade or rejected with actionable guidance if it remains. The migrated value drives the official workflow plugin prepare.post hook.
- Q: Which hook failures stop the main flow?
  - A: Discovery, import, register execution, class validation, and static metadata validation are hard failures. Hook run failures are non-blocking warnings and issue-log candidates.

## Alternatives Considered
- Create a new event bus for plugin hooks. — Rejected because Issue #373 explicitly chooses the existing flow command registry pre/post lifecycle points, which avoids a second lifecycle system.
- Keep plugin.json.files as a manifest allowlist. — Rejected because the installer convention must make known paths the core-side contract and not require plugin authors to enumerate copy targets.
- Keep plugin command modules as export async function main(argv, ctx). — Rejected because raw core ctx exposure couples plugins to internal APIs and conflicts with the register(api) factory boundary.
- Use live hook discovery for existing active flows without snapshots. — Rejected because active flow reproducibility depends on the snapshot captured at prepare time.
- Add runtime aliases for plugin.repos and packages[].repo. — Rejected because alpha policy avoids compatibility shims; backward-compatible-cli-interface is addressed by migration documentation and actionable validation errors.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-11T00:36:45.981Z
- Notes: User approved the gate-passed spec.

## Requirements
- R1 [must]: Replace plugin.repos / packages[].repo with plugin.sources[] / packages[].source in config schema, validation, plugin CLI output, and plugin registry source resolution, including a documented migration path and actionable validation error for old fields.
- R2 [must]: Remove plugin.json.files as a required manifest field and copy only known plugin package paths: plugin.json, commands/, skills/, presets/, hooks/, config.schema.json, and config.defaults.json, while preserving safety checks for .git, node_modules, symlinks, scripts, path traversal, unsafe package.json, max depth 20, max 2000 copied files per plugin, max 300-byte relative paths, and max 1 MiB JSON metadata files.
- R3 [must]: Discover one hook per hooks/*.js file under installed and enabled plugin roots, capped at 200 hook files per plugin and 100 enabled plugin packages per project, then validate default export register(api), named returned class, FlowCommandHook inheritance, command/hook metadata, integer priority, and prepare.pre rejection.
- R4 [must]: On successful flow prepare, snapshot validated hook plans into flow.json plugins.flowCommandHooks using apiVersion, pluginId, module relative path, className, command, hook, and priority, without storing absolute paths or re-discovering hooks during active flows.
- R5 [must]: Execute snapshot plugin hooks at supported flow command pre/post lifecycle points with a public context containing project, plugin, config, flow, result, artifacts, and envelope helpers, and convert hook run failures into non-blocking warnings plus issue-log candidates.
- R6 [must]: Load plugin commands through default export register(api), execute returned command.main(argv, context), require Envelope-compatible returns, normalize thrown command errors to failure envelopes with non-zero exit, and stop passing raw core ctx to plugin commands.
- R7 [must]: Read plugin command help metadata from plugin.json contributions.commands[] and render top-level help, command help, subcommand help, locale wording, and experimental display through the same help rendering path as core commands without importing plugin command modules.
- R8 [must]: Apply plugin config schemas/defaults under plugin.config.<pluginId>, merge defaults at loadConfig() runtime without writing them to .senti/config.json, migrate existing top-level workflow.* config to plugin.config.workflow through upgrade/config guidance, and expose a generic agent execution API that lets plugins pass provider/profile overrides from their own plugin config.
- R9 [must]: Remove workflow-specific flow instructions from generated AI skill text and preserve existing workflow.flowIntegration issue-start behavior through an official workflow plugin prepare.post hook that reads plugin.config.workflow.flowIntegration after migration.
- R10 [should]: Remove core runtime/source/test expectations that depend on actual official preset names; use generic plugin/preset fixtures for foundation contract tests while keeping user config examples, generated docs, and historical specs untouched.

## Acceptance Criteria
- AC1: Config validation accepts plugin.sources[] and plugin.packages[].source, rejects duplicate ids, unknown package source references, invalid ids, invalid commit pins for git packages, unsafe local source paths, and unsupported npm sources with a non-zero CLI failure where applicable.
- AC2: Existing plugin CLI commands operate on sources/packages terminology in JSON and human output; old plugin.repos/packages[].repo config produces an actionable migration error rather than silent fallback.
- AC3: Installing a plugin package copies only known paths that exist and never copies .git, node_modules, symlinks, package scripts, path traversal targets, arbitrary unlisted repository files, more than 2000 files, paths deeper than 20 segments, paths over 300 bytes, or JSON metadata files over 1 MiB.
- AC4: Hook discovery validates accepted factory hook modules and rejects anonymous register, anonymous class, multiple hook exports, unknown command, unknown hook, prepare.pre, non-integer priority, core internal path imports, more than 200 hook files per plugin, and more than 100 enabled plugin packages per project.
- AC5: flow prepare writes plugins.flowCommandHooks snapshot entries with only relative module paths and metadata, then execute prepare.post plugin hooks from that snapshot.
- AC6: Active flows without plugins.flowCommandHooks execute no plugin hooks and do not perform live discovery; active flows with missing/disabled snapshot plugins fail with a clear restore/enable guidance.
- AC7: Hook run failure, ok:false return, or hook warning is reflected in command envelope warnings using a common PLUGIN_HOOK_FAILED-style schema and does not stop the main flow command by itself.
- AC8: Plugin command modules use register(api) and return Envelope-compatible objects; thrown errors produce failure envelopes and non-zero exit for plugin commands.
- AC9: Help output includes enabled plugin command metadata and no longer relies on static workflow entries in the top-level layout; help rendering does not import plugin command modules.
- AC10: loadConfig() exposes plugin config defaults under plugin.config.<pluginId> without mutating .senti/config.json, and plugin config schemas validate inside that namespace.
- AC11: Existing top-level workflow.flowIntegration config is migrated to plugin.config.workflow.flowIntegration by senti upgrade or rejected with actionable guidance; it is never silently ignored after namespace migration.
- AC12: When plugin.config.workflow.flowIntegration is enable and a flow has a linked issue, the official workflow plugin prepare.post hook invokes issue-start-equivalent behavior from the CLI side and preserves the existing non-fatal skipped behavior when board/gh support is unavailable.
- AC13: Spec-local tests under specs/286-plugin-foundation-runtime/tests/ include // spec: R<N> headers covering R1 through R10, and shared regression tests are updated only where production contract changes require it.
- AC14: If src/skills or src/presets content changes, generated skill/preset artifacts in the repository diff reflect the source changes, and tests or snapshot assertions verify the generated text no longer contains removed workflow-specific flow instructions.

## Implementation Targets
- src/lib/plugin-registry.js
- src/lib/config.js
- src/plugin.js
- src/senti.js
- src/help.js
- src/flow/registry.js
- src/lib/command-registry.js
- src/skills/senti.flow/SKILL.md
- src/presets/base/templates/en/AGENTS.senti.md
- src/presets/base/templates/ja/AGENTS.senti.md
- tests/
- specs/286-plugin-foundation-runtime/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Replace plugin source config
  - Move plugin package discovery and enabled package config from plugin.repos/packages[].repo to plugin.sources/packages[].source with validation and migration guidance.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Install known plugin paths
  - Replace manifest files allowlist copying with core-side known path copying while preserving package safety checks.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Discover flow hooks
  - Add plugin hook discovery and validation for hooks/*.js modules under installed and enabled plugin roots.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Snapshot flow hooks
  - Persist hook plans into flow.json during prepare and execute snapshot hooks through the flow command lifecycle.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Run plugin hooks
  - Build the public hook context and normalize hook return values, warnings, thrown errors, artifact writes, and issue-log candidates.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Load plugin commands
  - Move plugin command execution to register(api) factory modules with Envelope-compatible returns and normalized command failures.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Render plugin command help
  - Integrate plugin command help metadata into the same help rendering path as core commands without importing plugin command modules for display.
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Namespace plugin config
  - Apply plugin schema/defaults under plugin.config.<pluginId> and expose generic plugin-side agent execution support.
  - see `tasks/T-8.md` for full spec
- **T-9** [pending]: Decouple workflow guidance
  - Remove workflow-specific flow instructions from generated AI skill text and preserve issue-start behavior through the official workflow plugin prepare.post hook.
  - see `tasks/T-9.md` for full spec
- **T-10** [pending]: Generalize preset contracts
  - Remove core foundation tests and runtime expectations that rely on actual official preset names while preserving user-facing historical docs and configs.
  - see `tasks/T-10.md` for full spec
