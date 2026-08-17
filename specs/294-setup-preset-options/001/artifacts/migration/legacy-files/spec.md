# Feature Specification: 294-setup-preset-options

**Feature Branch**: `feature/294-setup-preset-options`
**Created**: 2026-06-13
**Status**: Draft
**Input**: GitHub Issue #384

## Goal
Fix `senti setup` so the preset selection includes official and installed plugin presets instead of only the core `base` preset.

## Background
`senti setup` currently builds its preset tree from `PRESETS`, and `PRESETS` contains only core presets. In this repository the only core preset is `base`; official presets such as application or language presets are plugin contributions from `official-presets`. Existing project-root-aware resolvers can load plugin presets after plugin state exists, but fresh setup reaches the preset prompt before official plugin state has been materialized. The result is a user-visible setup prompt where only `base` appears.

## Scope
- Interactive `senti setup` preset candidates use a plugin-aware preset list.
- Fresh setup can discover official preset candidates before rendering the prompt without writing project config state before confirmation.
- Existing projects with enabled installed plugin presets keep those presets available as defaults and selectable candidates.
- Selecting a non-base official preset records enough plugin source/package state for later preset resolution.
- Selecting only `base` avoids writing unnecessary official preset plugin state.
- Retained setup behavior is verified for candidate rendering, default loading, `config.type` saving, summary leaf display, `validatePresetChain`, agent template preset lookup, and non-interactive `--type` handling.
- Regression tests cover the base-only candidate failure mode and the related migration-parity surfaces.

## Out of Scope
- Changing official preset repository contents.
- Changing the plugin manifest schema or preset contribution format.
- Fetching or updating arbitrary non-official plugin sources during setup.
- Redesigning the setup wizard interaction model or multi-select UI.
- Publishing npm packages or changing dist-tags.

## Constraints
- Use only Node.js built-in modules and existing internal APIs.
- `src/` changes must remain project-generic and must not embed project-specific values.
- Official preset bootstrap failure is fatal; setup must not silently continue with a base-only candidate list.
- Non-official plugin presets are setup candidates only when their installed manifest exists locally.
- Setup does not own arbitrary non-official plugin sync/update behavior; that remains owned by plugin sync/upgrade flows.
- If an existing configured preset type cannot be resolved from core or installed plugins, setup must surface a repair-needed error instead of dropping the type.
- Official plugin state is persisted only when needed for a selected non-base official preset.
- Pre-prompt official preset discovery must be read-only with respect to the target project config and installed package state.
- Official plugin state mutation must preserve public/local config separation and must not copy `.senti/config.local.json` plugin sources or packages into `.senti/config.json`.
- migration-parity: retained public surfaces are interactive preset selection, existing setup defaults, `config.type` saving, summary leaf display, `validatePresetChain`, agent template preset lookup, non-interactive `--type`, plugin update ownership, and config.local privacy.
- bounded-resource-usage: candidate discovery must stay within existing plugin registry limits (`MAX_ENABLED_PLUGIN_PACKAGES`, `MAX_PLUGIN_SOURCES`, manifest JSON/path/file limits) and preset chain depth limit (`MAX_CHAIN_DEPTH`).

## Design Principles
- Prefer one preset discovery path for setup UI and downstream validation to avoid candidate/validation drift.
- Keep setup bootstrap narrowly scoped to official presets because they are bundled infrastructure, not arbitrary user plugins.
- Preserve existing wizard-managed config behavior while adding the minimum plugin state needed for later commands.

## Overview
### Modules
- `src/setup.js`: wizard candidate rendering, settings persistence, summary display, non-interactive setup, and final preset validation.
- `src/lib/presets.js`: core and plugin-aware preset chain resolution.
- `src/lib/plugin-registry.js`: installed plugin manifest loading and official package installation helper.
- `src/upgrade.js`: existing official preset package bootstrap path used as implementation precedent.

### Data Flow
- Before preset selection, setup builds a preset candidate list from core presets plus available plugin presets for the target project root.
- For a fresh project, setup reads official preset metadata transiently before the prompt without creating target `.senti` config or package state.
- The wizard stores the selected leaf type in `config.type`; if it comes from official presets, setup also preserves official plugin state.
- After confirmation, non-base official selections persist official plugin state before project-root validation while base-only selections write no official state.
- `resolveMultiChains()` and `validatePresetChain()` continue to run against the target project root after config generation.

### Decisions
- [VERIFY] Checked setup preset candidate source / `src/setup.js` / result=match: interactive setup currently renders `buildTreeItems(PRESETS)`, so it can only show core presets.
- [VERIFY] Checked preset registry model / `src/lib/presets.js` and `src/lib/plugin-registry.js` / result=match: core-only `PRESETS` differs from project-root-aware resolution.
- [VERIFY] Checked official package precedent / `src/upgrade.js` and `src/lib/plugin-registry.js` / result=match: official package installation already has a bounded helper.
- Official bootstrap failure is treated as an infrastructure error, not as an acceptable base-only fallback.
- Non-official plugin update remains outside setup.
- Migration parity inventory is explicit: setup UI/defaults/type save/summary/validation/template lookup/noninteractive type all remain retained surfaces.
- No intentional public behavior removals are part of this spec.

## Clarifications (Q&A)
- Q: Should setup continue with only `base` if official preset bootstrap fails?
  - A: No. That hides the reported bug. Official preset bootstrap failure is fatal because it indicates broken bundled infrastructure or an unusable runtime environment.
- Q: Should setup update arbitrary non-official plugin sources to discover candidates?
  - A: No. Setup may use installed manifests, but plugin source resolution and updates stay in plugin sync/upgrade ownership.
- Q: Should official plugin state always be written during setup?
  - A: No. It is required for selected non-base official presets, but base-only projects should not gain unnecessary plugin state.

## Alternatives Considered
- Replace `PRESETS` with the existing project-root-aware resolver only. — Rejected because a fresh setup has no plugin config or installed official package yet, so the resolver would still return only core presets.
- Warn and continue with `base` when official bootstrap fails. — Rejected because it preserves the user-visible failure mode and masks broken official preset infrastructure.
- Run full plugin sync/update for all configured plugins during setup. — Rejected because it expands setup into arbitrary plugin update ownership and changes non-official plugin side effects.
- Always persist official preset plugin state for every setup run. — Rejected because base-only projects do not need official plugin state.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-13T23:26:20.694Z
- Notes: User selected approval option 1 after reviewing the gate-passed spec.

## Requirements
- R1 [must]: Interactive setup preset candidates must be generated from core presets plus available project plugin preset contributions.
- R2 [must]: Fresh setup must discover bundled official presets through a read-only pre-prompt path that does not require `.senti/config.json`, and must fail loudly if that official source cannot be resolved.
- R3 [must]: When setup saves a non-base official preset selection, the generated config and local plugin state must allow later project-root-aware preset resolution to find that preset.
- R4 [must]: When setup saves only `base`, it must not persist unnecessary official preset plugin package state.
- R5 [must]: Setup must use installed non-official plugin manifests as candidates without attempting to fetch or update missing non-official plugin sources.
- R6 [must]: Existing behavior for defaults, non-interactive `--type`, summary leaf display, config type minimization, `validatePresetChain`, and agent template preset lookup must continue through the project-root-aware resolver.
- R7 [should]: Related PRESETS-fixed display paths must be reviewed and either moved to the shared candidate helper or explicitly kept out of scope with tests protecting setup.
- R8 [must]: Setup's official plugin state writes must preserve `.senti/config.json` and `.senti/config.local.json` separation and must not publish local-only plugin sources or packages.
- R9 [must]: Preset candidate discovery and official metadata reads must enforce bounded resource usage through existing plugin registry count/size/path limits and preset chain depth limits.
- R10 [must]: Spec-local tests under `specs/294-setup-preset-options/tests/` must include `// spec: R<N>` headers and collectively cover every testable requirement.

## Acceptance Criteria
- A1: A fresh interactive setup run shows official preset candidates in the same tree UI as `base` before the user selects a preset, without creating target project config/package state before confirmation. Covers R1 and R2.
- A2: If the bundled official preset source cannot be resolved during fresh setup, setup exits with a clear error instead of rendering a base-only preset list. Covers R2.
- A3: Selecting a non-base official preset writes a config whose `type` can be resolved by `resolveMultiChains()` and accepted by `validatePresetChain()` in the generated project root. Covers R3 and R6.
- A4: Selecting only `base` writes no unnecessary official preset plugin package entry. Covers R4.
- A5: An existing project with an installed enabled plugin preset shows that preset as a candidate and preserves it as the setup default when configured. Covers R1, R5, and R6.
- A6: An existing non-official plugin package with no installed manifest is not fetched or updated by setup; a configured `type` that depends on that missing preset fails with a repair-needed error. Covers R5 and R6.
- A7: Non-interactive `senti setup --type <official-preset>` saves the requested type and passes the same downstream preset validation as the interactive path. Covers R3 and R6.
- A8: Adding official plugin state for a selected official preset does not copy plugin sources or packages that exist only in `.senti/config.local.json` into `.senti/config.json`. Covers R8.
- A9: Candidate discovery rejects or stops at the existing plugin registry bounds for package count, source count, manifest JSON/path/file limits, and preset parent chain depth. Covers R9.
- A10: Spec-local tests include `specs/294-setup-preset-options/tests/preset-candidates.test.js` with `// spec: R1 R2 R5 R9`, `official-state.test.js` with `// spec: R3 R4 R8`, and `setup-parity.test.js` with `// spec: R6 R7 R10`. Covers R1 through R10.
- A11: `setup-parity.test.js` verifies setup summary output displays leaf preset keys resolved from the generated project root for an official or installed plugin preset selection. Covers R6.
- A12: `setup-parity.test.js` verifies agent config/template generation still performs preset lookup through the generated project root for the selected official or installed plugin preset. Covers R6.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add preset candidate provider
  - Create or expose a setup-facing preset list that combines core presets with available plugin preset contributions for a target project root.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Bootstrap official presets
  - Make bundled official presets available before setup renders preset candidates for a fresh project.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Persist selected official preset state
  - Save enough plugin state for selected non-base official presets while keeping base-only setup minimal.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Preserve setup resolver behavior
  - Keep existing setup behavior intact for defaults, summaries, non-interactive type selection, validation, and installed non-official plugins.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add spec-local coverage
  - Add spec-local tests that document the requirement coverage headers and exercise setup candidate, official state, and retained behavior contracts.
  - see `tasks/T-5.md` for full spec
