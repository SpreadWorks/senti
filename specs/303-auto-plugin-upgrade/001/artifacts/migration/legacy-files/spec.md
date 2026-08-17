# Feature Specification: 303-auto-plugin-upgrade

**Feature Branch**: `feature/303-auto-plugin-upgrade`
**Created**: 2026-06-17
**Status**: Draft
**Input**: GitHub Issue #395

## Goal
`senti plugin install` と `senti plugin update-all` の成功後に、必要な `senti upgrade` まで自動実行し、plugin package の取得と project 反映を一つの CLI flow で完了できるようにする。

## Background
Plugin install and update-all already update package runtime files and `.senti/config.json` package commits, but plugin-provided skills, presets, templates, and AGENTS are applied to the project by `senti upgrade`. Requiring users to run upgrade separately leaves an easy half-updated state: the plugin package has changed, but project-facing generated or managed files have not been refreshed. Issue #395 narrows the fix to commands that actually change installed package state: install always changes state after success; update-all changes state only when at least one package commit changes.

## Scope
- `senti plugin install <id>` 成功後の automatic upgrade 実行。
- `senti plugin update-all` で 1 件以上の package commit が変わった場合の automatic upgrade 実行。
- `senti plugin update-all` で更新がない場合の upgrade skip。
- `senti plugin install` と `senti plugin update-all` の `--no-upgrade` option。
- `--json` 出力で plugin 操作結果と upgrade 実行結果を区別できる response contract。
- upgrade 失敗時に plugin 操作結果と upgrade 失敗を両方表示し、command 全体を失敗 exit にする behavior。
- plugin install / update-all / sync / source update の behavior-level regression tests。

## Out of Scope
- `senti plugin source update` から automatic upgrade を実行する変更。
- `senti plugin sync` から automatic upgrade を実行する変更。
- `senti upgrade` の内部 migration / deployment logic 変更。
- plugin-side scripts の実行。
- npm publish、dist-tag、external release 操作。

## Constraints
- 外部依存を追加しない。automatic upgrade 実行は Node.js built-in modules と既存 CLI module / process helper の範囲で実装する。
- `src/` に project 固有情報を埋め込まない。plugin command と upgrade result は汎用 CLI contract として扱う。
- plugin install / update-all / sync の既存安全方針を維持し、plugin-side `scripts` は実行しない。今回実行する追加処理は core 側の `senti upgrade` に限定する。
- alpha 版ポリシーに従い、旧 output shape 専用の互換 shim は追加しない。ただし Issue #395 の acceptance にある既存 basic behavior は behavior-level tests で維持する。
- spec-local tests は `specs/303-auto-plugin-upgrade/tests/` 配下に置き、各 test file に `// spec: R<N>` header を付ける。
- upgrade failure を catch する場合、error は JSON response / human output / process exit に反映し、silent discard しない。
- `update-all` は existing plugin registry bound を維持し、enabled package count が 100 件を超える場合は処理を開始せず失敗する。各 command execution あたり automatic upgrade invocation は最大 1 回。

## Design Principles
- plugin package state を変更した public command だけが automatic upgrade の責務を持つ。
- update-all は commit 変更有無を result data で判定し、更新なしの project に不要な upgrade side effect を発生させない。
- JSON consumer と human CLI consumer の両方が plugin 操作結果と upgrade 結果を区別できるようにする。
- source update と sync の責務は広げず、source 解決 / pinned commit restore の既存用途を維持する。

## Overview
### Modules
- `src/plugin.js`: plugin CLI dispatcher。install / update-all / sync / source update の command branch、flag parsing、human / JSON output を扱う。
- `src/lib/plugin-registry.js`: plugin source/package materialization。installPlugin と syncInstalledPlugins が installed package state と copied runtime files を更新する。
- `src/lib/command-registry.js`: plugin command help metadata。install / update-all に `--no-upgrade` を表示する。
- `src/upgrade.js`: existing `senti upgrade` command。内部 behavior は変更せず、plugin CLI から実行される対象として扱う。
- `specs/303-auto-plugin-upgrade/tests/`: install、update-all、no-update、no-upgrade、source update、sync、upgrade failure の behavior-level coverage。

### Data Flow
- install は id を解決し、installPlugin が package runtime を `.senti/plugins/<id>` に materialize し、config package commit を保存する。成功後、`--no-upgrade` が無ければ upgrade runner を呼ぶ。
- update-all は syncInstalledPlugins の update mode で最大 100 件の enabled package を 1 回ずつ処理し、各 package を resolved commit に materialize し、previousCommit と commit を比較した updated flag を返す。1 件以上 updated=true なら upgrade runner を最大 1 回呼ぶ。
- upgrade runner は normal `senti upgrade` CLI entrypoint を captured child process で実行するか、それと明示的に同等の adapter を使い、upgrade entry initialization を保ち、stdout/stderr と exit status を `{ ran, ok, exitCode, error }` 相当の result object に正規化する。in-process import/call で `process.exit` が plugin output を bypass する実装は禁止する。
- `--json` は `{ packages|package, upgrade }` 形式で structured response を出す。human output は plugin 操作結果の後に upgrade result を 1 行で出す。
- source update と sync は upgrade runner を呼ばず、それぞれ既存の source update / pinned commit restore behavior を維持する。
- config.local overlay 由来の private plugin sources/packages は automatic upgrade decision と output metadata の入力に使ってよいが、overlay-only source/package data を public `.senti/config.json` に永続化しない。

### Decisions
- [VERIFY] plugin CLI owns install/update-all/sync branching; result output currently goes through output()/formatLine().
- [VERIFY] plugin registry currently returns install and sync result objects without update change metadata.
- Upgrade failure policy: automatic upgrade failure makes the overall plugin command fail while preserving plugin operation result in output.
- Human output policy: automatic upgrade result is visible in one line after plugin result output.
- Migration inventory: retained public surfaces in this spec are plugin install, plugin update-all, plugin sync, plugin source update, JSON output for update-all/sync, and plugin-side script safety.
- Migration mapping: install and update-all gain post-operation upgrade orchestration; update-all/sync JSON output remains command output data owned by plugin CLI; sync and source update remain owned by their existing registry/source update paths with no upgrade call.
- Upgrade invocation boundary: automatic upgrade must preserve top-level upgrade initialization and capture output/exit before plugin command output is emitted.
- config.local compatibility: automatic upgrade must not leak overlay-only private plugin source/package data into public config.

## Clarifications (Q&A)
- Q: Does this change alter `senti upgrade` internals?
  - A: No. The plugin CLI invokes the existing upgrade command after selected plugin operations. The migration/deployment logic inside upgrade is out of scope.
- Q: Why does install run upgrade unconditionally after success?
  - A: A successful install adds or refreshes a plugin package in project state, so project-managed files may need to be applied immediately.
- Q: Why does update-all check `updated` before upgrade?
  - A: update-all can complete with no package commit changes. Running upgrade in that case adds an unnecessary side effect and contradicts Issue #395 acceptance.
- Q: What is the failure policy when upgrade fails?
  - A: The plugin operation result is preserved in output, but the overall command exits non-zero because the requested one-flow application did not complete.
- Q: Does sync become an update command?
  - A: No. sync remains a pinned commit materialization/restore command and does not trigger automatic upgrade.

## Alternatives Considered
- Require users to run `senti upgrade` manually after plugin install/update-all — Rejected because Issue #395 exists to remove the half-updated state created by the separate manual step.
- Run upgrade after every plugin update-all invocation — Rejected because update-all with no commit changes would produce unnecessary side effects and violates the no-updates acceptance criterion.
- Run upgrade after plugin sync — Rejected because sync restores pinned commits and widening it to project upgrade changes its responsibility.
- Treat upgrade failure as successful plugin command exit — Rejected by draft q1 because automation would miss project reflection failure even though plugin package state changed.
- Hide automatic upgrade result in human output — Rejected by draft q2 because human CLI users need to see the added side effect and distinguish plugin success from upgrade failure.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-17T07:09:10.703Z
- Notes: User approved the gate-passed spec for Issue #395.

## Requirements
- R1 [must]: `senti plugin install <id>` runs `senti upgrade` after install succeeds unless `--no-upgrade` is present.
- R2 [must]: `senti plugin update-all` processes at most 100 enabled packages, records `previousCommit`, `commit`, and `updated` for each processed enabled package, and runs `senti upgrade` at most once only when at least one package has `updated: true` unless `--no-upgrade` is present.
- R3 [must]: `senti plugin update-all` does not run `senti upgrade` when no package commit changes, and the response reports `upgrade.ran: false` with a skip reason indicating no package updates.
- R4 [must]: `senti plugin source update` and `senti plugin sync` never trigger automatic `senti upgrade`.
- R5 [must]: `--no-upgrade` is accepted by `senti plugin install` and `senti plugin update-all`, suppresses automatic upgrade, and is shown in help for those two commands only.
- R6 [must]: `--json` output for install and update-all returns plugin operation data and an `upgrade` object that exposes whether upgrade ran, whether it succeeded, and failure details when applicable.
- R7 [must]: When automatic `senti upgrade` fails after a successful plugin install or update-all operation, the command exits non-zero and output still exposes both the plugin operation result and the upgrade failure.
- R8 [should]: Human output for install and update-all includes plugin operation output followed by one upgrade result line containing `upgrade`, a state word from `ran`, `skipped`, or `failed`, and a failure message or skip reason when present.
- R9 [must]: Existing basic behavior for plugin install, update-all, sync, and source update remains covered by behavior-level tests, including plugin-side scripts not being executed.
- R10 [must]: Automatic-upgrade changes continue respecting `.senti/config.local.json` plugin overlays: overlay-only private sources/packages are not persisted into public `.senti/config.json`, while upgrade decision and output metadata may be computed from merged project config.

## Acceptance Criteria
- R1: A spec-local test installs a valid plugin fixture and observes one automatic upgrade invocation after install success.
- R1/R5: A spec-local test runs plugin install with `--no-upgrade` and observes no upgrade invocation while the plugin package is still installed.
- R2: A spec-local test advances at least one installed plugin source commit, runs update-all, observes `updated: true` with `previousCommit` and new `commit`, and observes one automatic upgrade invocation.
- R2: A spec-local or shared regression test configures more than 100 enabled plugin packages and observes update-all fail before package processing or automatic upgrade execution.
- R3: A spec-local test runs update-all when resolved commits match stored commits and observes no upgrade invocation plus `upgrade.ran === false` and a no-updates skip reason.
- R4: Spec-local tests run plugin source update and plugin sync and observe no upgrade invocation.
- R5: Help output for `senti plugin install --help` and `senti plugin update-all --help` includes `--no-upgrade`; help output for `plugin sync` and `plugin source update` does not include it.
- R6: JSON output for install contains one plugin result object and an `upgrade` object; JSON output for update-all contains a `packages` array with per-package update metadata and an `upgrade` object.
- R7: A spec-local test forces automatic upgrade to fail, observes a non-zero command exit, and parses output showing the plugin result plus `upgrade.ok === false` or equivalent failure fields.
- R8: A spec-local test for non-JSON install or update-all output observes plugin operation lines followed by one line containing `upgrade` and one of `ran`, `skipped`, or `failed`.
- R9: Existing sync behavior restores pinned commits without advancing to source HEAD and does not run automatic upgrade.
- R9: A behavior-level safety test verifies plugin install/update-all/sync do not execute plugin-side scripts while performing package materialization or update checks.
- R10: A spec-local or shared regression test installs or updates an overlay-only plugin source/package from `.senti/config.local.json`, observes automatic upgrade decision/output metadata if applicable, and verifies public `.senti/config.json` does not receive the private source/package entry.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Track plugin update results
  - Expose enough package update metadata for plugin update-all to decide whether automatic upgrade is required.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Run automatic upgrade
  - Add post-operation upgrade orchestration to install and update-all while preserving excluded command responsibilities.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Shape command output
  - Return plugin and upgrade results in both JSON and human CLI output, and expose `--no-upgrade` in help for supported commands.
  - see `tasks/T-3.md` for full spec
