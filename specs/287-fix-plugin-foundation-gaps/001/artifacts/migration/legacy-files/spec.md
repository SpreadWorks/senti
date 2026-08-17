# Feature Specification: 287-fix-plugin-foundation-gaps

**Feature Branch**: `feature/287-fix-plugin-foundation-gaps`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub Issue #374

## Goal
Fix the unmet plugin foundation acceptance criteria from Issue #374 by enforcing hook import boundaries, hard-failing invalid snapshot hook state, and storing flow hook artifacts under the active spec directory.

## Background
The plugin foundation work in spec #286 is complete, but Issue #374 identifies three remaining acceptance gaps. First, hook discovery validates the hook factory shape after import but does not reject core-internal imports before import. Second, active-flow snapshot execution converts unresolved hook modules and metadata mismatches into the same warning path used for hook business failures, even though snapshot corruption should invalidate the flow command. Third, hook artifact helpers write to .senti/plugin-artifacts instead of the active spec directory, so the artifacts are not spec-local evidence.

## Scope
- Reject core-internal imports in installed plugin hooks before hook module import during discovery.
- Hard-fail snapshot hook execution when the snapshot cannot be reconciled with installed plugin state or hook metadata.
- Keep hook run business failures non-blocking warnings plus issue-log candidates.
- Store flow hook artifacts under specs/<spec>/plugin-artifacts/<pluginId>/.
- Add spec-local tests for the unmet acceptance cases and update shared plugin foundation contract tests only where the production contract changes.

## Out of Scope
- Do not migrate workflow or preset implementations to external plugin repositories.
- Do not redesign plugin command runtime, plugin help metadata, plugin config namespace, or installer known-path policy.
- Do not add a general import side-effect analyzer; this spec only rejects core-internal hook imports.
- Do not change plugin command artifact storage unless required by shared helper extraction for flow hook artifact storage.

## Constraints
- Use only Node.js built-in modules and existing project helpers; no external dependencies.
- Preserve alpha policy: do not add compatibility shims for invalid snapshots, disabled plugins, or removed hook modules.
- Preserve bounded resource usage from the existing plugin foundation: maximum 100 enabled plugin packages, 200 hook files per plugin, 20 path segments, 300-byte relative paths, and 1 MiB JSON metadata files.
- For existing flow commands that execute plugin hooks, invalid discovery/import/register/static metadata/snapshot consistency must produce a command failure with a non-zero exit code. Hook run business failures must keep the current successful main command exit behavior with warnings.
- No new user-facing CLI arguments are introduced. Existing command arguments keep their current validation surface.
- Affected existing user-facing commands are `senti flow prepare` and existing `senti flow run <command>` invocations that already execute plugin lifecycle hooks. This spec changes invalid plugin runtime state handling only; it does not add, remove, or reinterpret any CLI flags or positional arguments.
- Plugin hook snapshot entries, installed plugin package state, hook module paths, and hook metadata are internal runtime inputs loaded from flow.json, .senti/config.json, and .senti/plugins. They must be validated at the plugin runtime boundary before hook execution, not exposed as new CLI arguments.
- Do not write project-specific values under src/. Test fixtures must use generic sample plugin names.

## Design Principles
- Treat prepare-time discovery and active-flow snapshot execution as separate validation boundaries.
- Keep snapshot metadata as the source of truth during active flows; do not live-discover replacement hooks to repair a broken snapshot.
- Separate runtime boundary corruption from plugin business failures. Boundary corruption fails the command; hook run failures are warnings.
- Make plugin hook artifact evidence spec-local so finalize and review can reason about it with the rest of the spec artifacts.

## Overview
### Modules
- src/lib/plugin-registry.js owns plugin hook discovery, snapshot loading, hook execution, public plugin context, and artifact helper construction.
- src/flow/lib/run-prepare-spec.js calls hook discovery during prepare and writes the hook snapshot into flow.json.
- specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js covers the existing plugin foundation contract and provides regression context for this fix.
- specs/287-fix-plugin-foundation-gaps/tests/ will contain new spec-local coverage for Issue #374 acceptance gaps.

### Data Flow
- During prepare, installed enabled plugin hooks are scanned from .senti/plugins/<pluginId>/hooks/*.js, import-boundary checked, imported, validated, and persisted as metadata-only plans in flow.json.
- During active flow command execution, flow.json plugins.flowCommandHooks is filtered by command/hook, each plan is reconciled with the currently installed enabled plugin package and hook module, and only valid plans are executed.
- Flow hook context receives project, plugin, config, flow, result, envelope helpers, and artifact helpers. Artifact helpers write under specs/<spec>/plugin-artifacts/<pluginId>/ when flow.spec is available.
- Hook run throw/ok:false remains a warning path. Snapshot reconciliation, import/register, class validation, and metadata mismatch happen before hook run and are command-failing errors.

### Decisions
- [VERIFY] checked hook discovery import boundary in src/lib/plugin-registry.js; result=gap exists.
- [VERIFY] checked snapshot execution failure handling in src/lib/plugin-registry.js; result=gap exists.
- [VERIFY] checked artifact helper storage in src/lib/plugin-registry.js; result=gap exists.
- [VERIFY] checked hook run warning policy in src/lib/plugin-registry.js; result=match and must be preserved.
- Issue #374 is a bounded correction to spec #286 acceptance, not a new plugin migration phase.

## Clarifications (Q&A)
- Q: Does this change migrate workflow or preset implementations to plugin repositories?
  - A: No. It only fixes unmet acceptance criteria in the shared plugin foundation.
- Q: Are plugin hook run failures now hard failures?
  - A: No. Only discovery/import/register/static metadata and snapshot consistency failures hard-fail. Hook run business failures remain warnings and issue-log candidates.
- Q: Does this spec add new CLI options?
  - A: No. Existing flow commands that execute plugin hooks gain stricter failure behavior for invalid plugin runtime state, but their user-facing arguments do not change.
- Q: Which user-facing CLI arguments are added or changed?
  - A: None. `senti flow prepare` and existing `senti flow run <command>` forms keep their current arguments. Snapshot entries and hook metadata are internal runtime inputs read from persisted flow/plugin state.
- Q: What is the exit code contract for stricter snapshot failures?
  - A: Existing flow commands that encounter invalid snapshot plugin state must fail the command and return a non-zero exit. Valid hook run business failures keep the main command success path with warnings.

## Alternatives Considered
- Treat missing snapshot modules and metadata mismatches as non-blocking warnings. — Rejected because it hides corrupted snapshot state and fails spec #286 AC6, which requires missing/disabled snapshot plugins to fail with restore/enable guidance.
- Re-discover live hooks when a snapshot entry is broken. — Rejected because active flow reproducibility depends on the prepare-time snapshot being the source of truth.
- Keep plugin hook artifacts under .senti/plugin-artifacts. — Rejected because flow hook artifacts are spec evidence and spec #286 T-5 requires specs/<specId>/plugin-artifacts/<pluginId>/.
- Block all imports from plugin hook modules. — Rejected because plugin-internal relative imports are allowed by the plugin boundary decision; only core-internal imports are prohibited.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-11T03:29:57.597Z
- Notes: autoApprove=true; spec gate passed after user-requested manual retry reset

## Requirements
- R1 [must]: Hook discovery must reject installed plugin hook modules that import core internal project paths before dynamic import. Relative imports that stay within the plugin package remain allowed.
- R2 [must]: Snapshot hook execution must hard-fail when a snapshot entry references a disabled plugin, missing installed plugin, unresolved hook module, invalid register(api) export, invalid hook class, or mismatched className/command/hook/priority metadata.
- R3 [must]: Hook run business failures must remain non-blocking command warnings and issue-log candidates when the snapshot entry and hook metadata are valid.
- R4 [must]: Flow hook artifact helpers must read JSON artifacts and write JSON/text artifacts under specs/<spec>/plugin-artifacts/<pluginId>/ for hooks executed with an active flow spec path. Missing files passed to readJson must preserve the existing fallback return behavior.
- R5 [must]: Spec-local tests under specs/287-fix-plugin-foundation-gaps/tests/ must cover R1 through R4 with requirement headers, and shared plugin foundation tests may be updated only to align with the corrected production contract.

## Acceptance Criteria
- AC1: A hook file under .senti/plugins/<pluginId>/hooks/*.js that imports project core internals is rejected before dynamic import, and the failure identifies the plugin id and hook module.
- AC2: Hook files that use relative imports inside their own installed plugin package continue to pass discovery validation.
- AC3: Running snapshot hooks with a disabled plugin package fails the flow command with a non-zero exit and guidance to re-enable the plugin or re-prepare the flow.
- AC4: Running snapshot hooks with a removed plugin directory or missing hook module fails the flow command with a non-zero exit and restore/re-prepare guidance.
- AC5: Running snapshot hooks with className, command, hook, or priority metadata that differs from the snapshot fails the flow command with a non-zero exit and metadata mismatch detail.
- AC6: A hook whose run() throws or returns ok:false after successful snapshot validation still produces PLUGIN_HOOK_FAILED-style warnings and issue-log candidates without failing the main flow command by itself.
- AC7: A flow hook using context.artifacts.readJson/writeJson/writeText reads and writes under specs/<spec>/plugin-artifacts/<pluginId>/, preserves readJson fallback behavior for missing files, and does not read or write .senti/plugin-artifacts/<pluginId>/ for flow hook artifacts.
- AC8: Spec-local tests with // spec: R1 R2 R3 R4 R5 headers fail against the current implementation and pass after the correction.
- AC9: The implementation does not add external dependencies and does not introduce project-specific source text under src/.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Reject hook core imports
  - Add hook discovery validation that rejects core-internal project imports before importing a plugin hook module while preserving plugin-internal relative imports.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Validate snapshot hooks
  - Separate snapshot reconciliation failures from hook run business failures so disabled, missing, unresolved, and metadata-mismatched snapshot entries hard-fail the flow command.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve run warnings
  - Keep hook run throw/ok:false behavior as warnings and issue-log candidates after snapshot validation succeeds.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Store hook artifacts
  - Read and write flow hook artifacts under the active spec directory so plugin evidence is committed with the spec artifacts and read-modify-write hooks use one storage root.
  - see `tasks/T-4.md` for full spec
