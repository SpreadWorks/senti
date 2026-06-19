# Feature Specification: 312-plugin-bulk-update

**Feature Branch**: `feature/312-plugin-bulk-update`
**Created**: 2026-06-19
**Status**: Draft
**Input**: GitHub Issue #406

## Goal
Support npm / pnpm-style `senti plugin update [name]`: without a name it lists all installed plugin update candidates and updates all only after explicit confirmation; with a name it updates only that plugin.

## Background
Issue #406 requests moving plugin update UX to `senti plugin update [name]`. The current CLI has `sync`, `install`, and an existing `update-all` command. That separate bulk command provides useful behavior, but its public surface does not match the requested `update [name]` model and it updates without a command-level confirmation prompt. This spec migrates the retained bulk behavior to `update` without arguments, adds explicit confirmation before mutation, and defines single-plugin update behavior for `update <name>`.

## Scope
- `senti plugin update` without positional arguments checks enabled installed plugin packages for update candidates.
- `senti plugin update` without positional arguments shows an `Update all installed plugins? [y/N]` equivalent prompt before changing plugin package state.
- `senti plugin update` without positional arguments updates all enabled installed plugins only when stdin is `y` or `yes` after trimming and case normalization.
- `senti plugin update` without positional arguments does not update when stdin is empty, `n`, `no`, or any other value.
- `senti plugin update <name>` updates only the named installed plugin and does not show the bulk update confirmation.
- Existing bulk-update behavior owned by `update-all` is migrated to `update` without arguments, including update result fields and automatic upgrade behavior.

## Out of Scope
- Interactive target selection UI.
- Dry-run mode.
- `--all` option.
- Advanced subset selection beyond a single plugin name or all installed plugins.
- A new command dedicated solely to bulk plugin updates.

## Constraints
- Use only Node.js built-in modules.
- Do not add project-specific values under `src/`; plugin update behavior must remain generic package code.
- Do not preserve `update-all` solely as a backward-compatibility path. This project is alpha and public UX should move to `update [name]`.
- Confirmation must be required only for bulk update. Single-plugin update must not prompt for all plugins.
- No update may occur before the bulk confirmation is accepted.
- Bulk update must use a non-mutating plan phase before confirmation and a separate apply phase after accepted confirmation.
- Disabled plugin packages (`enabled === false`) are excluded from bulk update candidates to preserve existing bulk update behavior.
- When `--json` is present, confirmation prompts and refusal/status text must be written to stderr so stdout remains parseable JSON.
- Bulk update must preserve the existing enabled-package upper bound enforced by `MAX_ENABLED_PLUGIN_PACKAGES` and must not introduce unbounded package scanning.

## Design Principles
- Keep command routing user-facing behavior in `src/plugin.js` and package state mutation in `src/lib/plugin-registry.js`.
- Reuse existing output and automatic upgrade formatting so install/update/update-all migration parity can be checked at behavior level.
- Prefer small helper functions for prompt parsing and shared update execution instead of duplicating branch logic.

## Overview
### Modules
- `src/plugin.js` owns `plugin` subcommand parsing, confirmation prompting, human/JSON output, and automatic `senti upgrade` reporting.
- `src/lib/plugin-registry.js` owns reading plugin sources/packages and installing package files into `.senti/plugins`.
- `src/lib/command-registry.js` owns help metadata for `senti plugin --help` and subcommand usage.

### Data Flow
- Bulk update first builds a non-mutating plan for enabled installed plugin packages, prints candidates, reads confirmation, then applies the plan only on accepted input.
- Single update resolves the named installed package source, updates only that package, renders the same package line shape, then runs automatic upgrade when the package changed and `--no-upgrade` is absent.
- No-update bulk path prints candidates or no-candidate status, skips package mutation, and skips automatic upgrade with an explicit skip reason.

### Decisions
- [VERIFY] `src/plugin.js` currently has `update-all` but no `update`; bulk behavior uses `syncInstalledPlugins(root, { update: true })`.
- [VERIFY] `syncInstalledPlugins` returns update metadata needed for candidate display.
- [CORRECTION] Candidate display must not call existing mutating `syncInstalledPlugins(..., { update: true })` before confirmation; implementation needs a non-mutating plan/apply split.
- [CORRECTION] Bulk update preserves existing disabled-package behavior by excluding packages where `enabled === false`.
- [CORRECTION] JSON mode keeps stdout parseable by writing confirmation prompts and refusal/status text to stderr.
- [CORRECTION] Bulk update remains bounded by the existing enabled-package limit.
- [VERIFY] Help metadata must move from `update-all` to `update`.
- Migration inventory: `update-all` route, all-package update semantics, update result rendering, automatic upgrade condition, help metadata, and user-visible impact of the old route.
- Migration owner mapping: retained bulk behavior moves to `senti plugin update` without args; `senti plugin update <name>` owns single-package update; `update-all` is removed from normal command surface.

## Clarifications (Q&A)
- Q: What counts as accepting the bulk update prompt?
  - A: `y` and `yes` after trimming surrounding whitespace and lowercasing. Every other input is a refusal.
- Q: How is `update-all` treated?
  - A: The retained behavior migrates to `senti plugin update` without args. `senti plugin update-all` is removed as a compatibility route; invoking it must fail with an unknown-command style error, exit non-zero, and leave plugin package state unchanged.
- Q: Should no-candidate bulk update ask for confirmation?
  - A: No. When no package can be updated, there is no mutation to approve. The command reports no updates and skips automatic upgrade.
- Q: Are disabled installed plugin packages included in bulk update?
  - A: No. Bulk update preserves existing `update-all` behavior and excludes packages where `enabled === false`.
- Q: Where does the bulk confirmation prompt go in JSON mode?
  - A: The prompt and refusal/status text go to stderr. Stdout remains reserved for parseable JSON.
- Q: What upper bound applies to bulk update candidate processing?
  - A: The existing `MAX_ENABLED_PLUGIN_PACKAGES` bound remains the package-count limit for enabled installed packages. New planning/apply code must not scan beyond that bounded set.

## Alternatives Considered
- Keep `senti plugin update-all` and add `senti plugin update` as another bulk path. — Rejected because Issue #406 asks to avoid a separate bulk command UX and the alpha policy does not require keeping backward-compatibility aliases.
- Add `--all` for bulk update. — Rejected because Issue #406 explicitly lists `--all` as out of scope.
- Prompt before checking candidates. — Rejected because Issue #406 requires listing candidates before performing updates, and users need candidate visibility before approving mutation.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-19T15:07:49.905Z
- Notes: autoApprove accepted the gate-passed spec for issue #406

## Requirements
- R1 [must]: `senti plugin update` without a plugin name must compute and display enabled installed plugin update candidates via a non-mutating plan before any package state is changed, while preserving the existing enabled-package count bound.
- R2 [must]: `senti plugin update` without a plugin name must ask for bulk confirmation and apply the prepared enabled-package update plan only when the answer is `y` or `yes` after trimming and case normalization.
- R3 [must]: `senti plugin update` without a plugin name must leave plugin package state unchanged when the answer is empty, `n`, `no`, or any other value.
- R4 [must]: `senti plugin update <name>` must update only the named installed plugin and must not display the bulk update confirmation.
- R5 [must]: The retained public behavior of existing bulk update must be available through `senti plugin update` without args, including disabled-package exclusion, result rendering, and automatic upgrade skip/run conditions.
- R6 [must]: The plugin help metadata must advertise `senti plugin update [name]`; `senti plugin update-all` must not be preserved as a compatibility route and must fail without updating when invoked.
- R7 [should]: When no enabled installed plugin has a newer candidate, `senti plugin update` without args should report that no package updates are available and should not show the bulk confirmation prompt.

## Acceptance Criteria
- AC1: Running `senti plugin update` without args displays enabled installed plugin update candidates from a non-mutating plan before confirmation and before package files or config commits are changed.
- AC2: Running `senti plugin update` without args with stdin `y` applies the prepared enabled-package update plan and runs automatic upgrade when at least one package changed and `--no-upgrade` is absent.
- AC3: Running `senti plugin update` without args with stdin `yes` behaves the same as `y`.
- AC4: Running `senti plugin update` without args with empty stdin, `n`, `no`, or another value does not update plugin package commits or installed files.
- AC5: Running `senti plugin update <name>` updates only `<name>` and does not print the bulk confirmation prompt.
- AC6: Running `senti plugin update <name>` for an uninstalled plugin fails instead of installing a new plugin package.
- AC7: `senti plugin --help` and `senti plugin update --help` document `update [name]`; `update-all` is not advertised.
- AC8: Existing bulk update result semantics are preserved through `senti plugin update` without args: disabled packages are excluded, package id/source/commit data is rendered, `previousCommit` and `updated` remain available for JSON output, and automatic upgrade is skipped when no package changed.
- AC9: With `--json`, bulk confirmation prompt and refusal/status text are written to stderr, while stdout contains only the final JSON object.
- AC10: Running `senti plugin update-all` fails with an unknown-command style error, exits non-zero, and does not update plugin package state.
- AC11: Spec-local coverage files live under `specs/312-plugin-bulk-update/tests/` and include `// spec: R<N>` headers for every testable requirement.

## Implementation Targets
- src/plugin.js
- src/lib/plugin-registry.js
- src/lib/command-registry.js
- tests/e2e/help.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add update routing
  - Add `senti plugin update [name]` routing for bulk and single-plugin update while preserving the existing plugin operation output style.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add bulk confirmation
  - Require explicit confirmation before bulk update applies a prepared enabled-package update plan.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Migrate bulk surface
  - Move retained `update-all` behavior to `update` without args and make help output advertise the new command surface.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Cover update behavior
  - Add spec-local tests that prove the new update behavior satisfies R1 through R7.
  - see `tasks/T-4.md` for full spec
