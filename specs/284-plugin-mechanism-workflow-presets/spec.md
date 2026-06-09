# Feature Specification: 284-plugin-mechanism-workflow-presets

**Feature Branch**: `feature/284-plugin-mechanism-workflow-presets`
**Created**: 2026-06-09
**Status**: Draft
**Input**: GitHub Issue #371

## Goal
Introduce a common plugin mechanism that lets workflow and presets share Git/local acquisition, project-local placement, explicit activation, reproducible commit pinning, setup/upgrade migration, and documentation updates across senti, senti-presets, and senti-workflow-plugin.

## Background
senti currently bundles workflow and most presets inside core. The top-level CLI dispatches workflow directly from src/senti.js, preset discovery scans src/presets, and workflow config/schema lives in core config. This prevents private workflow repositories and external preset repositories from being installed, enabled, updated, and reproduced without core releases. Issue #371 defines a common plugin unit for workflow and preset acquisition, placement, activation, reproducibility, setup candidates, migration, and registry behavior.

Impact on existing features: .senti/config.json validation gains plugin.repos/plugin.packages and plugin-owned config bootstrap; setup preset choices can include plugin repo candidates; non-base preset resolution moves from src/presets to enabled plugin registry entries plus project-local overlays; senti workflow moves from a core dispatcher entry to enabled plugin command dispatch for upgraded projects; disabled workflow plugin projects receive an unavailable-command failure; docs/AGENTS/help/upgrade output describe plugin activation and migration. Existing base preset behavior, project-local preset override semantics, command names for upgraded workflow users, and npm publish behavior remain unchanged.

## Scope
- Add plugin.repos and plugin.packages to .senti/config.json and use commit-pinned package entries as the reproducibility source.
- Add plugin repo checkout, candidate discovery from plugin.json, repo add/update/list, plugin install/list/enable/disable/update/sync, and project-local runtime placement under .senti/plugins/<id>/.
- Support both normal git URLs and local paths as plugin repo sources while leaving private repository authentication to git.
- Make preset resolution, setup, and upgrade consume plugin preset contributions while keeping base as the core builtin preset and keeping .senti/presets/<key>/ as a project-specific override.
- Move workflow into a plugin command/skill/config contribution and make existing projects use senti workflow through upgrade-installed workflow plugin activation.
- Remove the core workflow-specific command stub after migration support is in place; disabled workflow plugin projects treat senti workflow as unavailable.
- Move existing non-base presets to senti-presets and workflow command/skill/config assets to senti-workflow-plugin as part of this flow.
- Add plugin.json validation, allowed files copying, package.json safety rejection, symlink/.git exclusion, path-safe plugin id validation, and repo URL/token masking.
- Define the initial plugin.json contract with required name, type, files, and contributions, and with command, preset, skill, config schema/defaults, and DataSource static meta contribution fields.
- Add DataSource static meta to the initial plugin/preset registry so parent chains, overrides, and template/data directive validation can be resolved through registry metadata.
- Update docs, AGENTS content, help text, and upgrade deployment behavior for plugin repos, preset creation, workflow plugin activation, and migration.

## Out of Scope
- Do not run npm publish or npm dist-tag.
- Do not add plugin-side installScript, postinstall, prepare, or any script execution hook.
- Do not create .senti/plugins.lock.json or plugins.json.
- Do not use resolved or version as the primary reproducibility field for enabled packages.
- Do not add individual package update commands in the initial CLI; only update all enabled packages.

## Constraints
- Use only Node.js built-in modules and existing project helpers; do not add external dependencies.
- Plugin ids must be path-safe single segments and must match config id, runtime directory, and plugin.json name.
- plugin.json must require name, type, files, and contributions. type must identify workflow, preset, or mixed package role. Optional fields are label, description, and version.
- plugin.json.files must be a non-empty array of relative copy patterns from the plugin root. Absolute paths, parent traversal, leading slashes, and backslashes are invalid.
- plugin.json contributions.commands entries must include name and path; path is relative to .senti/plugins/<id>/ and points to a module exporting async function main(argv, ctx).
- plugin.json contributions.presets entries must include key, path, and parent. path points to a preset directory containing preset.json/templates/data/guardrail as applicable.
- plugin.json contributions.skills entries must include name and path. path points to a skill directory copied by plugin.json.files.
- plugin.json contributions.config may include schema and defaults paths for config.schema.json and config.defaults.json copied by plugin.json.files.
- plugin.json contributions.dataSources entries must include name, path, category, and methods metadata used by the registry for parent-chain, override, and template/data directive validation.
- plugin.repos[].id must be generated from normalized repo source and shown with its repo source in repo list output.
- plugin.packages[] must be the explicit enabled package list and must record id, repo, commit, and optional ref.
- Config loading must first validate core fields plus plugin.repos/plugin.packages, then load enabled plugin manifests/runtime metadata, merge plugin config schema/default contributions, and finally validate plugin-owned config sections.
- Local path plugin repo sources must be Git repositories or Git worktrees with a resolvable HEAD commit. Non-Git paths are rejected. Dirty local paths are rejected for install/sync/update unless the command is explicitly documented as repo checkout/update only and does not write plugin.packages commit.
- Installed plugin files under .senti/plugins/<id>/ must not activate the plugin unless plugin.packages lists that package.
- plugin install/sync/update must never execute plugin-side scripts.
- If package.json contains non-empty dependencies, devDependencies, optionalDependencies, peerDependencies, or scripts, install/sync must reject the package.
- Plugin copy must include only plugin.json.files targets and must reject absolute paths, parent traversal, leading slashes, backslashes, symlinks, .git content, and contribution paths outside copied files.
- senti upgrade must install and enable the official workflow plugin for every existing project with a valid .senti/config.json unless plugin.packages already records a workflow provider.
- Core built-in commands must not be overridden by plugin command contributions in the initial implementation.
- Project-local .senti/presets/<key>/ remains a project-specific override and overlays the active registry preset with the same key when preset.json is absent.
- Preset parent-chain lookup must use core base plus enabled plugin preset contributions, not only src/presets.
- Preset parent-chain traversal must stop after 20 levels and reject repeated preset keys as cycles.
- plugin update/sync/list registry operations must process at most 200 enabled packages per invocation and fail non-zero when config exceeds that limit.
- Plugin repo candidate discovery must inspect at most 200 plugin.json manifests per repo checkout per invocation and report when additional candidates are skipped.
- Template/data directive pre-validation must inspect at most 500 directive references per docs generation run and fail non-zero when the limit is exceeded.
- CLI commands added or changed by this spec succeed with exit code 0 only after the requested valid operation completes or list/find output is produced; invalid arguments, invalid config, invalid plugin.json, unsafe package content, dirty or non-Git local paths, missing enabled packages, unavailable plugin commands, and failed Git/file operations exit non-zero with a diagnostic.
- Source code under src/ must not contain project-specific values other than distributable defaults such as official plugin repo identifiers.
- backward-compatible-cli-interface is satisfied by upgrade migration and docs/help guidance, while new or disabled projects may see senti workflow as unavailable when the plugin is not enabled.

## Design Principles
- Keep plugin candidate discovery, installed runtime files, enabled package state, and contribution resolution as separate concepts.
- Prefer a deep plugin module that hides checkout, validation, copy, activation, and registry resolution behind simple CLI-facing interfaces.
- Migrate in a verifiable order: plugin foundation, config, repo management, install/sync/update, preset/setup/upgrade, workflow plugin, external repository moves, core deletion, docs/AGENTS updates.
- Build migration before deletion; do not remove core presets or workflow before plugin paths are working.
- Represent meaningful values such as plugin manifests, package refs, repo refs, contributions, and registry entries as dedicated classes with invariants rather than ad hoc object literals.

## Overview
### Modules
- Plugin core: manifest validation, repo source normalization, repo checkout, package install/sync/update, files copy, URL masking, and enabled package state.
- Plugin registry: loads enabled plugin contributions for commands, presets, skills, config schema/defaults, and DataSource static meta.
- Preset integration: resolver/setup/upgrade/docs loaders combine core base, enabled plugin preset contributions, and project-local preset overrides.
- Command integration: top-level dispatcher resolves core built-ins first, then enabled plugin command contributions, then unavailable/unknown command handling.
- Migration and deployment: upgrade installs/enables official preset/workflow plugins, deploys plugin skills, reflects plugin templates, and updates docs/AGENTS guidance.

### Data Flow
- .senti/config.json plugin.repos defines repo sources; repo update creates .senti/plugin-repos/<repo-id>/ checkouts used by plugin find and setup candidate discovery.
- plugin install resolves a candidate, checks out the package, validates plugin.json/package.json/files, copies runtime files to .senti/plugins/<id>/, and records plugin.packages commit.
- config loading validates core plugin state first, loads enabled plugin manifests and config schema/default contributions, then validates plugin-owned config keys such as workflow.
- plugin sync reads plugin.packages[].commit, restores .senti/plugins/<id>/ from repo sources, then registry loading exposes only enabled contributions.
- setup selects base or plugin preset candidates; selecting an uninstalled plugin preset installs/enables the package and writes the selected preset key to config.type.
- upgrade fills missing commits, migrates official preset/workflow packages, syncs runtime files, deploys skills/templates/config defaults, and keeps existing workflow invocation available through the plugin.

### Decisions
- [VERIFY] src/senti.js currently has a fixed top-level workflow dispatcher; plugin command dispatch must replace that workflow-specific core path.
- [VERIFY] src/lib/presets.js currently scans src/presets and resolves .senti/presets/<key>/ first for project-local overrides.
- The flow includes senti, senti-presets, and senti-workflow-plugin file migration.
- Project-local presets remain project-specific overrides while shared presets move to plugin packages.
- Initial plugin update updates all enabled packages only.
- Plugin repo sources support both git URLs and local paths.
- Workflow command is available only through an enabled workflow plugin after migration.
- Plugin packages with dependencies or scripts are rejected by install/sync.
- DataSource static meta is included in the initial implementation scope.
- Existing projects receive the workflow plugin during upgrade because prior direct workflow use has no reliable usage marker.
- Local path plugin sources must be Git worktrees with clean, resolvable commits before package commit pinning.

## Clarifications (Q&A)
- Q: Should the flow include external repository file migration?
  - A: Yes. It includes senti, senti-presets, and senti-workflow-plugin.
- Q: Should .senti/presets/<key>/ remain supported?
  - A: Yes. It remains a project-specific override.
- Q: Should local path plugin repos be supported initially?
  - A: Yes. Both git URL and clean Git local path repo sources are initial scope.
- Q: Should workflow command exist when workflow plugin is disabled?
  - A: No. It is unavailable unless the workflow plugin is enabled.
- Q: Should DataSource static meta be included initially?
  - A: Yes. It is part of the initial registry endpoint.
- Q: How should existing direct workflow users be detected?
  - A: They are not reliably detectable, so upgrade enables the official workflow plugin for every existing project with a valid .senti/config.json unless a workflow provider is already enabled.
- Q: Which user-facing CLI arguments require entry-point validation?
  - A: plugin repo add validates <source> as a git URL or local path string; repo update/list/find validate optional repo ids as path-safe ids; plugin install/enable/disable validate <package-id> as a path-safe id and optional --ref as a Git ref string without path traversal; plugin update/sync/list accept no individual package id in the initial CLI; setup validates selected preset keys against core base, installed plugin presets, or discoverable plugin candidates; plugin command dispatch validates the top-level command name as a single segment and passes plugin-specific argv only after the provider command is enabled.
- Q: What exit code contract applies to plugin and workflow command changes?
  - A: Successful valid operations exit 0 after output or filesystem/config changes complete. Invalid arguments, unavailable disabled-plugin commands, invalid config, invalid manifests, unsafe files/package metadata, Git failures, dirty or non-Git local paths for commit-pinned operations, and failed copy/sync/update operations exit non-zero with a diagnostic.

## Alternatives Considered
- Implement only core plugin infrastructure and defer external repository migration. — Rejected because it would not verify actual preset/workflow extraction across the required repositories.
- Convert all project-local presets into plugin packages. — Rejected because project-local overrides serve project customization, not distributable package state.
- Keep a workflow-specific core stub for disabled workflow plugin projects. — Rejected because it preserves workflow-specific routing in core and blurs plugin activation.
- Allow plugin package dependencies and scripts. — Rejected because plugin install/sync must not execute plugin-side scripts and must place reproducible, already-built runtime files.
- Defer DataSource static meta to a later issue. — Rejected by user choice; the registry endpoint is included in this initial implementation.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-09T09:16:03.320Z
- Notes: approved-by-user-option-1

## Requirements
- R1 [must]: Add plugin.repos and plugin.packages config support with repo ids, package ids, optional refs, and commit-pinned enabled package entries.
- R2 [must]: Implement plugin repo management and candidate discovery from checked-out plugin.json files for git URL and clean Git local path repo sources.
- R3 [must]: Implement plugin install, list, enable, disable, update-all, and sync with safe checkout, validation, copying, token masking, and reproducible commits.
- R4 [must]: Reject unsafe plugin package structures, including invalid ids/files, contribution paths outside copied files, symlinks, .git content, package dependencies, and scripts.
- R5 [must]: Make preset resolution, docs loaders, setup, and upgrade consume plugin preset contributions while retaining base as core builtin and .senti/presets/<key>/ as registry-backed project-local overlay.
- R6 [must]: Implement plugin registry static meta for preset/DataSource resolution, parent chains, override resolution, and template/data directive pre-validation.
- R7 [must]: Move non-base official presets to senti-presets with plugin.json contributions and update core migration to install/enable them when existing config.type requires them.
- R8 [must]: Move workflow command, skills, config schema/defaults, and flowIntegration support to senti-workflow-plugin while enabling the workflow plugin for every valid existing project during upgrade.
- R9 [must]: Replace core workflow-specific top-level dispatch with generic plugin command dispatch that resolves core built-ins first and rejects overriding core commands.
- R10 [should]: Update docs, AGENTS, help text, and upgrade output to describe plugin repos, preset creation, workflow plugin activation, migration behavior, and disabled-plugin unavailable command handling.

## Acceptance Criteria
- Given a config with plugin.repos and plugin.packages, validation accepts only the new schema fields and rejects missing commit during sync.
- Given plugin-owned config keys are present, config loading accepts plugin.repos/plugin.packages first, loads enabled plugin schema/default contributions, and validates plugin-owned sections after schema merge.
- Given plugin.json is missing name/type/files/contributions or a contribution lacks required fields, discovery/install reports a validation error before copying runtime files.
- Given plugin.json declares commands, presets, skills, config, or DataSource meta, every referenced path must be included by plugin.json.files before install succeeds.
- Given a plugin repo from a git URL or local path, repo update/list/find uses a checked-out .senti/plugin-repos/<repo-id>/ copy and reads plugin.json as source of truth.
- Given a local path plugin repo is non-Git or dirty, install/sync/update rejects it before writing plugin.packages commit.
- Given a valid plugin package, plugin install copies only allowed files to .senti/plugins/<id>/ and records id/repo/commit in plugin.packages.
- Given an unsafe plugin package, install/sync fails for invalid ids, invalid files patterns, symlinks, .git content, contribution paths outside copied files, dependency fields, or scripts.
- Given an installed but disabled plugin directory, registry loading does not expose its command, preset, skill, config, or DataSource contributions.
- Given setup selects an uninstalled plugin preset, setup installs/enables the package, resolves non-base parent presets through core base plus enabled plugin presets first, and writes config.type to the selected preset key.
- Given .senti/presets/<key>/ exists without preset.json and an enabled plugin provides the same preset key, the local directory overlays the plugin preset metadata instead of becoming a bare preset.
- Given an existing project type points to a non-base official preset, senti upgrade registers the official preset repo, installs/enables the provider package, and keeps docs build working.
- Given an existing project has a valid .senti/config.json, senti upgrade installs/enables the workflow plugin unless another workflow provider is already enabled, so the same senti workflow invocation works through plugin command dispatch.
- Given workflow plugin is disabled, senti workflow is unavailable and help/docs explain enabling or upgrading the workflow plugin.
- Given multiple plugin contributions share a name, registry loading applies plugin.packages order and plugin list --json reports the final provider without warning in normal execution.
- Given DataSource static meta exists, registry/meta resolution can validate parent chains, overrides, and template/data directive references before docs generation.
- Given parent chains, enabled package lists, repo candidate discovery, or directive pre-validation exceed the configured spec limits, the command fails non-zero before unbounded processing.
- Given CLI commands added or changed by this spec are invoked, valid operations exit 0 and invalid arguments/config/manifests/safety checks/local paths/unavailable plugin commands exit non-zero.
- Spec-local test files under specs/284-plugin-mechanism-workflow-presets/tests/ include a header containing spec: R<N> for covered requirements.
- Given src/skills or src/presets sources change during this work, generated skill/template reflection files corresponding to those changed sources are updated in the diff.

## Implementation Targets
- src/lib/config.js
- src/lib/presets.js
- src/setup.js
- src/upgrade.js
- src/senti.js
- src/workflow/**
- src/skills/senti.workflow/**
- src/presets/**
- /home/nakano/workspace/senti-presets
- /home/nakano/workspace/senti-workflow-plugin
- docs/**
- AGENTS.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add plugin configuration
  - Introduce plugin.repos and plugin.packages schema, defaults, config loading, and commit-pinning semantics.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Implement plugin package lifecycle
  - Add repo management, candidate discovery, install, list, enable, disable, update-all, and sync behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add plugin registry
  - Resolve enabled plugin contributions for presets, commands, skills, config schema/defaults, and DataSource static meta.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Integrate plugin presets
  - Make preset resolver, docs loaders, setup, and upgrade work with plugin preset contributions while preserving base and project-local overrides.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Implement DataSource meta registry
  - Add static meta to DataSource/preset registry resolution for parent chains, overrides, and template/data directive pre-validation.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Extract workflow plugin
  - Move workflow command, skill, config schema/defaults, and flowIntegration behavior into senti-workflow-plugin and dispatch it through plugin command contribution.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Move official presets
  - Move non-base built-in presets to senti-presets with plugin.json contributions and update core to keep base as builtin.
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Update docs and deployment
  - Update help, docs, AGENTS, upgrade deployment, and generated artifacts to explain plugin operation, migration, preset creation, and workflow plugin handling.
  - see `tasks/T-8.md` for full spec
