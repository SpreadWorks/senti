# Feature Specification: 285-fix-371-plugin-sibling-repos

**Feature Branch**: `feature/285-fix-371-plugin-sibling-repos`
**Created**: 2026-06-09
**Status**: Draft
**Input**: GitHub Issue #371

## Goal
Repair the issue #371 completion gap so the official preset and workflow plugin artifacts exist in the real sibling repositories and tests fail when those repositories are missing or incomplete.

## Background
Issue #371 required a common plugin mechanism that moves official non-base presets into SpreadWorks/senti-presets and workflow functionality into SpreadWorks/senti-workflow-plugin. The previous implementation built the plugin mechanism and placed official artifacts under src/official-plugins inside senti, but the sibling repositories in this workspace remained empty. That means the plugin mechanism can pass tests while failing the three-repository migration expectation. This repair focuses on making the two sibling repositories real deployable plugin packages and making tests prove that fact.

## Scope
- Populate /home/nakano/workspace/senti-presets with the official preset plugin artifact: plugin.json and every non-base preset file required by its contributions.
- Populate /home/nakano/workspace/senti-workflow-plugin with the official workflow plugin artifact: plugin.json, command module, skill, config schema, and config defaults.
- Make senti's official plugin source handling explicit so upgrade and tests can distinguish real sibling repository artifacts from bundled compatibility artifacts.
- Strengthen spec-local and shared regression tests so the previous #371 preset/workflow extraction expectations fail when only src/official-plugins exists and the sibling repositories are empty or incomplete.
- Preserve base as the only core builtin preset and keep existing upgrade behavior for official presets and workflow plugin activation.
- Run relevant spec-local tests, targeted shared regression tests, and full project regression.

## Out of Scope
- Do not run npm publish or npm dist-tag.
- Do not add plugin-side installScript, postinstall, prepare, dependency installation, or script execution hooks.
- Do not rename plugin.repos, plugin.packages, plugin.json.name, or plugin.json.type.
- Do not redesign the whole plugin lifecycle unless a narrow change is required to make sibling repository artifacts the verified source.
- Do not remove src/official-plugins compatibility unless tests and upgrade behavior prove the real sibling repositories remain the completion source.

## Constraints
- Use only Node.js built-in modules and existing project helpers; do not add external dependencies.
- The sibling repository paths are /home/nakano/workspace/senti-presets and /home/nakano/workspace/senti-workflow-plugin in this workspace.
- Each sibling repository must be a Git repository with a resolvable HEAD commit after artifacts are committed.
- senti-presets plugin.json must define name, type, files, and contributions.presets, and every contributed preset path must exist under that repository.
- senti-workflow-plugin plugin.json must define name, type, files, contributions.commands, contributions.skills, and contributions.config, and every referenced path must exist under that repository.
- Tests must not pass solely because src/official-plugins contains bundled artifacts.
- src/official-plugins may remain only as packaged compatibility or fallback material; it is not sufficient evidence that the three-repository migration is complete.
- Core preset discovery must treat src/presets/base as the only built-in preset source; non-base official presets must be available only through an enabled plugin package or explicit project-local override.
- Official preset and workflow package installation during upgrade must validate a clean sibling Git worktree with a resolvable HEAD and copy files from the pinned commit before writing plugin.packages.
- Dirty, non-Git, missing-HEAD, or missing plugin.json official sibling sources must fail before plugin.packages is written.
- Official plugin artifact validation must reject missing plugin.json, missing contribution paths, and contribution paths outside the repository root.
- R1 and R2 sibling repository artifact changes are committed in their own Git repositories outside this worktree, so they do not appear in the senti repository diff. The senti repository must record their clean HEAD evidence in specs/285-fix-371-plugin-sibling-repos/sibling-repository-evidence.json and enforce the state through spec-local tests.
- No plugin-side scripts or package dependencies may be introduced in the official sibling repositories.
- Commit messages must be English and must not include sign-off or co-authored-by trailers.
- npm publish and npm dist-tag remain release operations and must not be executed in this flow.

## Design Principles
- Treat the real sibling repositories as the completion source and bundled artifacts as compatibility, not as proof of migration.
- Keep validation deterministic: manifest and path checks should be performed by tests and small helper logic, not by manual inspection.
- Keep the repair narrow: fix the artifact placement and verification gap without reopening the whole plugin mechanism design.

## Overview
### Modules
- Sibling repository artifacts: the two repositories under /home/nakano/workspace contain the deployable official plugin packages and are committed independently.
- Official plugin source resolver: senti exposes or uses explicit official plugin repository roots so upgrade and tests can point at the real sources while preserving bundled compatibility when needed.
- Artifact validation tests: spec-local tests inspect real sibling repository manifests and every contribution path, then exercise install/sync or upgrade behavior against those repositories.

### Data Flow
- senti-presets repository provides plugin.json and presets/<key>/ directories; tests read the manifest and verify every contributed preset path exists.
- senti-workflow-plugin repository provides plugin.json, commands/workflow.js, skills/senti.workflow, config.schema.json, and config.defaults.json; tests verify every contribution path exists.
- A temporary project registers the sibling repository path in plugin.repos, installs or upgrades the official package, and records a commit-pinned plugin.packages entry.
- A workflow-enabled temporary project executes the installed plugin command from .senti/plugins/workflow to prove the sibling package works after deployment, not only at its source location.

### Decisions
- [VERIFY] Previous #371 spec listed the sibling repositories as implementation targets; result=match with the user's repair request.
- [VERIFY] Current official plugin helper points at bundled artifacts; result=source needs explicit sibling repository handling for this repair.
- [VERIFY] The sibling repositories currently do not contain plugin artifacts; result=missing completion evidence.
- The repair treats sibling repository artifacts as mandatory and keeps npm publication out of scope.
- [CORRECTION] Non-base preset availability must depend on enabled plugin contributions, not bundled official-plugins discovery.
- [CORRECTION] Official upgrade must install from a clean committed sibling HEAD and reject dirty or non-Git official sources.
- [CORRECTION] Workflow plugin verification must execute the installed command entry point.

## Clarifications (Q&A)
- Q: Should src/official-plugins be deleted?
  - A: Not necessarily. It may remain as a packaged compatibility copy, but it cannot be the only artifact used to prove the three-repository migration.
- Q: How can tests be CI-safe if the workspace paths are absolute?
  - A: Spec-local tests may validate the real workspace sibling repositories for this flow, while shared regression helpers should avoid hard-coding a developer home path unless the test is explicitly scoped to this workspace repair.
- Q: Why are R1 and R2 artifacts not visible as file additions in the senti repository diff?
  - A: R1 and R2 target /home/nakano/workspace/senti-presets and /home/nakano/workspace/senti-workflow-plugin, which are separate Git repositories. Their implementation evidence is the clean committed HEAD in each repository plus sibling-repository-evidence.json and the spec-local tests that inspect those repositories.

## Alternatives Considered
- Keep only src/official-plugins and update wording to call them official repositories. — Rejected because issue #371 and the user's correction require actual sibling repositories. This would keep the same completion gap.
- Remove src/official-plugins immediately and make sibling repositories the only source. — Rejected for this repair unless tests show upgrade and packaged compatibility remain intact. Immediate deletion could break npm package behavior beyond the narrow completion gap.
- Defer sibling repository population to release time. — Rejected because the requested repair is to make the current flow output complete and testable before finalization.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-09T15:44:15.085Z
- Notes: approved-by-user-option-1

## Requirements
- R1 [must]: Populate /home/nakano/workspace/senti-presets with a committed official preset plugin package whose plugin.json contributes all current non-base official presets and whose contribution paths all exist.
- R2 [must]: Populate /home/nakano/workspace/senti-workflow-plugin with a committed official workflow plugin package whose plugin.json contributes the workflow command, senti.workflow skill, config schema, and config defaults, with every referenced path present.
- R3 [must]: Update senti's official plugin source handling and preset discovery so tests and migration use the real sibling repository roots, src/presets/base remains the only built-in preset source, and bundled src/official-plugins artifacts cannot make non-base presets available without an enabled plugin.
- R4 [must]: Add spec-local tests that fail when sibling repositories are empty, missing plugin.json, missing contribution paths, dirty before commit-pinned install, unable to produce commit-pinned plugin.packages entries, or copied from a working tree that does not match the recorded commit.
- R5 [must]: Preserve existing official preset upgrade behavior and workflow plugin migration behavior, including successful execution of an installed sibling-sourced workflow command entry point.
- R6 [should]: Update documentation, help text, or AGENTS guidance only where current wording would incorrectly imply that bundled src/official-plugins artifacts alone satisfy the official repository migration.

## Acceptance Criteria
- R1: /home/nakano/workspace/senti-presets/plugin.json exists, validates as a preset plugin, and every contributions.presets[].path exists in that repository.
- R1: /home/nakano/workspace/senti-presets has a Git HEAD commit after artifact placement, and git status --short is clean after commit.
- R2: /home/nakano/workspace/senti-workflow-plugin/plugin.json exists, validates as a workflow plugin, and every command, skill, schema, and defaults contribution path exists in that repository.
- R2: /home/nakano/workspace/senti-workflow-plugin has a Git HEAD commit after artifact placement, and git status --short is clean after commit.
- R3: official plugin source helper or test helper exposes the sibling roots explicitly, and tests can distinguish sibling roots from src/official-plugins roots.
- R3: With no enabled official-presets plugin, a non-base official preset such as webapp or node-cli is unavailable through preset resolution even when src/official-plugins exists.
- R3: After upgrade installs the official-presets package from /home/nakano/workspace/senti-presets, the same non-base preset resolves from the enabled plugin contribution.
- R4: spec-local tests under specs/285-fix-371-plugin-sibling-repos/tests include // spec: R<N> headers and verify sibling artifact existence, contribution completeness, and commit-pinned install or upgrade behavior.
- R4: A test fixture or assertion fails if the sibling repository plugin.json is absent even when src/official-plugins exists.
- R4: Official upgrade from sibling roots rejects dirty worktrees, non-Git roots, missing HEAD, and sources whose copied files do not come from the recorded commit.
- R5: Existing tests for preset resolution, upgrade migration, workflow plugin activation, and root regression continue to pass.
- R5: A temporary project that upgrades or installs from /home/nakano/workspace/senti-workflow-plugin can run the installed workflow command entry point, for example senti workflow --help, without resolving package-relative imports outside the installed plugin.
- R6: Any changed docs/help/AGENTS text reflects that official plugin packages live in the sibling repositories, with bundled artifacts described only as compatibility or packaged copies when retained.
- No npm publish or npm dist-tag command is executed.

## Implementation Targets
- src/lib/official-plugins.js
- src/upgrade.js
- src/lib/plugin-registry.js
- src/lib/presets.js
- src/official-plugins/**
- /home/nakano/workspace/senti-presets
- /home/nakano/workspace/senti-workflow-plugin
- specs/285-fix-371-plugin-sibling-repos/tests/**
- tests/**
- docs/**
- AGENTS.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Populate preset repository
  - Create the official preset plugin package in /home/nakano/workspace/senti-presets and commit it.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Populate workflow repository
  - Create the official workflow plugin package in /home/nakano/workspace/senti-workflow-plugin and commit it.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Expose official roots
  - Make senti source or tests explicitly expose the real sibling roots separately from bundled compatibility roots.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Verify sibling artifacts
  - Add tests that make empty or incomplete sibling repositories fail the spec.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Preserve migration behavior
  - Keep existing preset upgrade and workflow plugin activation behavior passing after official source verification changes.
  - see `tasks/T-5.md` for full spec
