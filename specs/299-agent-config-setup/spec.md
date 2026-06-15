# Feature Specification: 299-agent-config-setup

**Feature Branch**: `feature/299-agent-config-setup`
**Created**: 2026-06-15
**Status**: Draft
**Input**: GitHub Issue #390

## Goal
senti setup の agent 選択を複数選択化し、agent config は選択 intent と明示 override だけを保存する。

## Background
`senti setup` currently treats agent selection as a single claude/codex choice and writes a concrete provider key into `agent.default`. It also seeds built-in profiles/providers into config, and `senti upgrade` repeats that add-only seed whenever an agent section exists. That copied config makes model/provider defaults stale after package updates. The desired behavior is to store only selected user intent and explicit overrides in config while runtime and validation resolve package-managed built-ins.

## Scope
- `senti setup` の interactive agent selection と main/default agent selection。
- `senti setup --agent` の non-interactive agent selection contract。
- setup が書く `.senti/config.json` の `agent.default`, `agent.useProfile`, `agent.workDir`。
- built-in agent profiles/providers の runtime resolution と config validation。
- `senti upgrade` の agent defaults seed 停止と既存 overrides preservation。
- AGENTS.md / CLAUDE.md generation target selection for setup.
- Rerunning setup on existing agent config and normalizing wizard defaults.
- setup completion output, help, locale, docs wording for agent settings.
- setup / upgrade / validation / runtime resolution / help wording regression tests.

## Out of Scope
- `senti config example agent` のような sample generation command の追加。
- npm publish / npm dist-tag 操作。
- 外部依存の追加。
- built-in provider/model の全面的な選定変更。
- docs/ 全体の自動再生成。ただし必要な help/docs source wording の変更は含む。

## Constraints
- `src/` には特定 project 固有情報を入れない。agent defaults は全ユーザー向けの package-managed built-ins として扱う。
- 外部依存を追加しない。Node.js built-in と既存 helper を使う。
- ユーザーが `config.agent.providers` または `config.agent.profiles` に明示した entries は built-in より優先し、自動上書きしない。
- 既存 config の判定不能な profiles/providers は user-authored override として保持し、通常 setup/upgrade では削除や縮約をしない。
- 通常 setup/upgrade は built-in profiles/providers を config に大量コピーしない。
- Concrete provider key を既に `agent.default` に持つ既存 config は、setup または明示編集で alias に変わるまで runtime resolution で扱えるようにする。
- Spec behavior coverage は `specs/299-agent-config-setup/tests/` 配下に置き、各 spec-local test file に `// spec: R<N> ...` header を付ける。
- `src/skills/` または `src/presets/` を変更した場合だけ `senti upgrade` を実行する。

## Design Principles
- Config に package-managed defaults をコピーせず、runtime resolver が package 側の built-ins を参照する。
- Setup の agent availability, main/default agent, and agent file generation targets を別々の intent として扱う。
- Migration parity は公開面ごとに検証する。config generation, upgrade, validation, runtime resolution, generated files, and help/docs を別々に確認する。
- 既存 user override は pin とみなし、package updates に追従しない明示設定として尊重する。

## Overview
### Modules
- `src/lib/agent-defaults.js`: built-in agent profiles/providers の source of truth。seed-oriented API/comment から runtime built-in defaults へ役割を整理する。
- `src/lib/agent.js`: `SENTI_PROFILE`, `agent.useProfile`, `agent.default` の優先順位を維持しながら built-in profiles を解決する。
- `src/lib/config.js`: `agent.useProfile` と profile provider references を built-in profiles/providers も含めて validate する。
- `src/lib/provider.js`: built-in provider family aliases と user provider overrides を解決する registry boundary。
- `src/setup.js`: agent selection, main/default selection, config writing, summary, and AGENTS/CLAUDE generation targets を扱う。
- `src/upgrade.js`: skill/preset/config migration を維持しつつ、agent built-ins の add-only seed を通常経路から外す。
- `src/locale/**` and docs/help sources: agent.default, agent.useProfile, agent.profiles, agent.providers の説明と override 例を提示する。

### Data Flow
- Setup は available agents を claude, codex, or claude+codex として受け取り、複数選択時だけ main agent を決める。
- Setup config write は `agent.default` に claude/codex alias、`agent.useProfile` に selected availability + main に対応する built-in profile name、`agent.workDir` に `.tmp` を保存する。
- Non-interactive setup treats the first family in comma-separated `--agent` as main/default. For example, `--agent claude,codex` writes `claude-main`, while `--agent codex,claude` writes `codex-main`.
- Non-interactive setup with both families selected generates both AGENTS.md and CLAUDE.md by default because no prompt can collect a narrower target set.
- Rerunning setup normalizes existing `agent.default` aliases, concrete provider keys, and built-in `agent.useProfile` names into wizard availability/main defaults before prompting or rewriting config.
- Runtime は `SENTI_PROFILE` または `agent.useProfile` で profile を選び、user-defined profile があればそれを優先し、無ければ package built-in profile を参照する。
- Provider resolution は user provider override を優先し、built-in provider family or provider key fallback を維持する。
- Upgrade は existing config の non-agent migrations and skill/preset deployment を維持し、agent profiles/providers の package defaults は追加しない。
- Setup completion output and help/docs show selected default/useProfile and the available built-in profile names instead of copying built-in definitions into config.

### Decisions
- [VERIFY] setup currently stores concrete provider keys and seeds agent defaults.
- [VERIFY] upgrade currently re-seeds built-in profiles/providers when any agent section exists.
- [VERIFY] validation currently treats `agent.useProfile` as config-local when `agent.profiles` exists.
- [VERIFY] runtime profile selection currently requires `agent.profiles` for selected profiles.
- [VERIFY] built-in profile definitions already contain the required useProfile names.
- Migration inventory: retained public behavior includes setup config generation, workDir creation, AGENTS/CLAUDE generation, `upgrade` non-agent migrations, `validate()`, runtime agent resolution, and help/docs discoverability.
- Migration mapping: built-in profile/provider ownership moves from copied config entries to a package-managed runtime source of truth.
- Existing unknown profiles/providers are preserved as user overrides.
- Non-interactive setup supports comma-separated multi-agent intent.
- Non-interactive multi-agent main selection uses first-listed family semantics.
- Non-interactive multi-agent file generation defaults to both agent files.
- Setup rerun defaults normalize old and new agent config forms.
- No list command is added in this spec.

## Clarifications (Q&A)
- Q: Should setup copy built-in profiles/providers into config for discoverability?
  - A: No. Discoverability is handled by setup completion output and help/docs. Config stores selected intent and explicit overrides only.
- Q: How are existing seeded profiles/providers handled?
  - A: They are preserved as user overrides unless a future migration can prove they are managed by senti. This spec does not delete or compact unknown entries.
- Q: Does this remove support for concrete provider keys in `agent.default`?
  - A: No. New setup writes family aliases, but existing concrete provider keys remain resolvable for migration parity.
- Q: Is a list command for built-in profiles/providers required?
  - A: No. The spec uses help/docs and setup completion output. A list command can be considered later if those surfaces are insufficient.

## Alternatives Considered
- Only change `agent.default` to aliases — Rejected because setup/upgrade would still seed built-in profiles/providers and existing configs would still stop following package-managed defaults.
- Delete seed-looking existing profiles/providers by value — Rejected because config has no provenance marker; a user may have intentionally pinned the same values.
- Support multi-agent selection only in interactive setup — Rejected because `--agent` is a public non-interactive setup contract and should express the same config intent.
- Generate only the main agent's instruction file when both agents are available — Rejected because available agent selection and instruction file generation are separate user intents.
- Add `senti config example agent` or a built-in list command now — Rejected because Issue #390 says the sample command is unnecessary and list command is only optional; help/docs and setup output satisfy current discoverability.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-15T03:32:38.197Z
- Notes: Auto-approved after draft-gate PASS, spec-review repair, and spec-gate PASS under user-enabled auto mode.

## Requirements
- R1 [must]: Interactive `senti setup` lets the user select claude only, codex only, or claude + codex as available agents, and asks for a main/default agent only when both families are selected.
- R2 [must]: Setup writes `agent.default` as `claude` or `codex` and writes `agent.useProfile` as `claude-only`, `codex-only`, `claude-main`, or `codex-main` according to selected availability and main agent.
- R3 [should]: Non-interactive `senti setup --agent` accepts single values `claude` / `codex` and comma-separated multi-agent values; for multi-agent values, the first listed family is the main/default agent.
- R4 [must]: Runtime agent resolution and config validation resolve package built-in profiles/providers without requiring them to be copied into `.senti/config.json`, while user-defined `agent.profiles` and `agent.providers` override built-ins by key.
- R5 [must]: Normal setup and upgrade do not add package built-in `agent.profiles` or `agent.providers` entries to config; existing unknown entries remain preserved as user overrides.
- R6 [should]: When both claude and codex are selected interactively, setup lets the user choose AGENTS.md and/or CLAUDE.md generation targets; when both are selected non-interactively, setup generates both files by default.
- R7 [must]: Setup completion output and help/docs explain selected `agent.default`, selected `agent.useProfile`, available built-in profile names, and override examples for `agent.profiles` and `agent.providers`.
- R8 [should]: Existing concrete provider key defaults such as `claude/sonnet` or `codex/gpt-5.4` remain resolvable until setup or an explicit user edit rewrites them to family aliases.
- R9 [must]: Rerunning setup normalizes existing `agent.default` family aliases, concrete provider keys, and built-in `agent.useProfile` names into wizard availability and main/default defaults before prompting or rewriting config.

## Acceptance Criteria
- R1/R2: Interactive setup can produce configs for claude-only, codex-only, claude+codex with claude main, and claude+codex with codex main; each config has the expected `agent.default` alias and `agent.useProfile` value.
- R2/R5: A new setup config with agent enabled contains `agent.default`, `agent.useProfile`, and `agent.workDir`, but does not contain copied package built-in `agent.profiles` or `agent.providers` unless the user already had explicit overrides.
- R3: Non-interactive `--agent claude`, `--agent codex`, `--agent claude,codex`, and `--agent codex,claude` produce the corresponding setup config matrix, with the first listed family as main for multi-agent values.
- R4: `validate()` accepts config where `agent.useProfile` is one of the package built-in profile names without config-local `agent.profiles`, and still rejects unknown profile/provider references.
- R4/R8: Runtime `Agent.resolve()` can resolve built-in `agent.useProfile` names, user profile overrides, user provider overrides, and existing concrete provider-key defaults.
- R5: `senti upgrade` no longer logs or writes added agent default profiles/providers solely because `raw.agent` exists, while preserving unrelated upgrade config migrations.
- R5: Existing `agent.profiles` and `agent.providers` entries remain unchanged by setup/upgrade unless they are wizard-managed fields explicitly being updated.
- R6: With claude+codex selected interactively, setup can generate AGENTS.md, CLAUDE.md, both, or skip according to the selected generation targets.
- R6: With non-interactive `--agent claude,codex` or `--agent codex,claude`, setup generates both AGENTS.md and CLAUDE.md by default.
- R7: Help/docs and setup completion output mention `agent.default`, `agent.useProfile`, built-in profile names, and how to override/pin providers/profiles without requiring a sample generation command.
- R9: Existing configs with `agent.default` as `claude`, `codex`, `claude/sonnet`, or `codex/gpt-5.4`, and configs with `agent.useProfile` as `claude-only`, `codex-only`, `claude-main`, or `codex-main`, initialize setup defaults to the intended availability/main state.
- R1-R9: Spec-local tests under `specs/299-agent-config-setup/tests/` include `// spec: R<N> ...` headers and cover setup, upgrade, validation, runtime resolution, and help/docs wording.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add built-in agent resolution
  - Expose package built-in profiles/providers as runtime defaults that validation and agent resolution can share without copying them into config.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Update setup agent selection
  - Change setup to collect available agent families, main/default agent, and instruction file generation targets, then write the new compact agent config.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Stop upgrade seeding
  - Remove normal upgrade behavior that adds package built-in agent profiles/providers to config while preserving existing user entries and unrelated migrations.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update agent help
  - Make built-in profile/provider discoverability explicit in setup output, help text, locale text, and docs without seeding config.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add regression coverage
  - Create spec-local behavior tests and update shared tests so the setup, upgrade, validation, runtime, and help contracts remain protected.
  - see `tasks/T-5.md` for full spec
