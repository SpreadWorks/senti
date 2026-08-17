# Feature Specification: 288-workflow-plugin-migration

**Feature Branch**: `feature/288-workflow-plugin-migration`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub Issue #375

## Goal
Complete Issue #375 by moving the workflow feature from the core senti package to the external workflow plugin repository while preserving the user-facing `senti workflow` command behavior and removing core-owned workflow feature implementation.

## Background
Issue #375 is the 2/3 migration after plugin foundation work. The core package still owns workflow runtime behavior and workflow-specific integration text, while the current official workflow plugin is only a shim into core. This prevents workflow from being an independently installable plugin and keeps core coupled to workflow-specific config, help, tests, agent defaults, upgrade behavior, and flow integration instructions. The migration must move behavior to the plugin repository and leave core with generic plugin foundation contracts only.

## Scope
- Migrate existing workflow command behavior, board operations, publish behavior, ideas candidate extraction, GitHub Projects access, workflow skill, and flow prepare/finalize integration into the workflow plugin.
- Remove core-owned workflow runtime code, bundled workflow plugin compatibility copy, workflow-specific config schema/defaults/migration, workflow-specific agent defaults, bootstrap special-cases, prompt/skill hardcoding, and workflow-specific tests.
- Keep `senti workflow` as the user-facing top-level command name, but provide it from the external workflow plugin rather than core.
- Preserve existing workflow features unless Issue #375 explicitly requests deletion or behavior change.
- Prepare and modify the external workflow plugin repository inside this active flow worktree before applying or verifying plugin-side changes.

## Out of Scope
- Do not redesign GitHub Projects access, replace the gh CLI / GraphQL approach, or introduce a new GitHub API client.
- Do not automatically migrate top-level workflow config to plugin.config.workflow.
- Do not preserve compatibility aliases for removed `issue-start` or `issue-log-import` public subcommands; use the migration plan in constraints and clarifications instead.
- Do not introduce workflow-specific public APIs in core.
- Do not remove historical specs, docs, generated artifacts, reports, retrospectives, issue logs, or `.github/workflows` convention paths solely because they contain the word workflow.

## Constraints
- Use only Node.js built-in modules and existing project helpers; no external dependencies.
- Respect the active flow worktree boundary: plugin repository changes must be prepared under the active flow worktree path before editing or verification.
- Core must remain workflow-neutral after migration. Generic plugin command, hook, config, help, and agent foundation changes are allowed only when they do not encode workflow-specific command names, subcommands, or agent purpose names in core.
- Semantic removal is the acceptance rule for the word workflow: remove workflow feature ownership from active core runtime/source/test/package/current config surfaces, while preserving unrelated generic uses such as Spec-Driven Development workflow and GitHub Actions workflow.
- backward-compatible-cli-interface: removing `senti workflow issue-start` and `senti workflow issue-log-import` is permitted only with this migration plan: issue-start behavior moves to a prepare.post hook, issue-log-import user-facing review moves to `senti workflow ideas --spec <spec>`, skill/help/prompt guidance stops documenting the removed subcommands, and removed invocations receive normal unknown subcommand behavior.
- exit-code-contract: plugin-provided workflow commands must return zero for successful command execution, non-zero for invalid user input, missing required config for commands that require board access, plugin command throws, and unknown subcommands. Hook business failures during prepare/finalize integration are warnings/follow-ups and must not fail the main flow command by themselves.
- validate-user-input-at-entry-point: plugin workflow command entry points must validate user-facing positional arguments and options before invoking services. `ideas --spec <path>` must require a root-relative or spec-relative spec path and reject missing, absolute, traversal, or shell-metacharacter paths.
- AI calls inside the workflow plugin must be configurable through plugin.config.workflow.agent.<name> and must fall back to the generic default agent only when no plugin override is configured.
- bounded-resource-usage: workflow plugin issue-log/ideas candidate extraction must process at most 200 issue-log entries per invocation, produce at most 200 candidates, run at most one classify call and one compose call per retained candidate, and perform no recursive AI retry loop. Board list/search operations must use bounded GraphQL pagination with an implementation-defined cap no larger than 20 pages or 1000 items per invocation.
- src/ must not contain project-specific paths or environment-specific values. Test fixtures in core must use generic plugin names, not workflow-specific fixture names.
- If src/skills, src/presets, or source templates change, run senti upgrade and include the resulting deployed artifact changes or evidence.

## Design Principles
- Treat this as a migration, not a workflow feature redesign.
- Keep core/plugin separation explicit: core owns generic plugin runtime contracts, while the workflow plugin owns workflow commands, hooks, services, skill text, config interpretation, and follow-up wording.
- Share workflow command and hook behavior through plugin-owned service functions rather than invoking `senti workflow ...` from hooks.
- Keep finalize follow-up schema loose in core: core may surface plugin returned followUps but must not interpret workflow-specific artifact schemas.
- Make generic flow lifecycle hook context explicit at prepare and finalize boundaries so plugins receive current flow data and can return successful follow-up data without core knowing plugin-specific schemas.

## Overview
### Modules
- src/workflow/ currently owns the core workflow dispatcher, registry, command classes, board helpers, GraphQL calls, validation, category, hash, and config helpers.
- src/official-plugins/senti-workflow-plugin/ currently contains a bundled compatibility plugin whose command imports core src/workflow/index.js instead of owning workflow behavior.
- src/upgrade.js and src/lib/official-plugins.js currently contain official workflow plugin bootstrap and resolver special-cases.
- src/lib/config.js and src/lib/agent-defaults.js currently contain workflow-specific top-level config and workflow.publish agent defaults.
- src/flow/prompts/plan/draft.md and deployed flow skill text currently contain workflow board integration instructions that should become plugin hook behavior.
- tests/unit/workflow*.test.js and workflow board candidate guidance tests currently exercise workflow feature behavior in core.

### Data Flow
- Before implementation, a copy or worktree of /home/nakano/workspace/senti-workflow-plugin is prepared under the active flow worktree so plugin-side edits stay inside the flow boundary.
- The workflow plugin dispatches `senti workflow <subcommand>` through plugin-owned command code, validates command input at the plugin entry point, and calls plugin-owned services for board operations and issue publishing.
- prepare.post hook receives a linked issue from the flow hook context and invokes the plugin-owned issue-start service when plugin.config.workflow.flowIntegration is enable.
- After flow prepare writes flow.json, the generic core lifecycle re-resolves or passes the newly created flow state, including hook snapshot, spec path, runId, and linked issue, before running prepare.post hooks.
- finalize-cleanup.post hook runs while a durable spec/issue-log/artifact path is available, writes plugin artifacts, and returns follow-up text or data for core to surface without interpreting workflow-specific schema.
- Plugin command and hook contexts expose a workflow-neutral agent API plus root config values needed by plugins, so the workflow plugin can run AI-backed publish and ideas behavior without importing core internals.
- Core command/help/config/agent/plugin runtime remains generic and discovers the workflow command, hooks, config schema/defaults, and skill from the installed external plugin.

### Decisions
- [VERIFY] checked core workflow dispatcher; result=match with migration target.
- [VERIFY] checked bundled workflow plugin command; result=match with shim problem.
- [VERIFY] checked workflow config handling; result=match with core-specific config removal target.
- [VERIFY] checked upgrade bootstrap; result=match with official workflow special-case removal target.
- [VERIFY] checked agent defaults; result=match with workflow-specific agent default removal target.
- [VERIFY] checked draft prompt; result=match with hardcoded flow integration removal target.
- The plugin repository must be handled inside the active flow worktree.
- Core removal uses semantic matching rather than literal removal of every workflow token.
- Removed workflow subcommands get a migration plan instead of compatibility aliases.

## Clarifications (Q&A)
- Q: Does core still know the workflow command name after migration?
  - A: Core may discover an enabled plugin command named workflow through generic plugin command registry metadata, but core must not contain workflow-specific bootstrap, config, subcommand, or help logic.
- Q: What replaces `senti workflow issue-start`?
  - A: prepare.post hook behavior in the workflow plugin replaces it. Users do not call issue-start directly after migration.
- Q: What replaces `senti workflow issue-log-import`?
  - A: `senti workflow ideas --spec <spec>` replaces the user-facing review path. finalize-cleanup.post hook records candidate extraction follow-up information.
- Q: Are removed subcommands compatible aliases?
  - A: No. Alpha policy and Issue #375 require no compatibility aliases. Removed subcommands become normal unknown subcommands, with migration guidance supplied through help/skill/prompt changes and the new hook/ideas behavior.
- Q: Which user-facing workflow command arguments require validation?
  - A: add requires <title> as a non-empty Japanese string; add --status accepts Ideas or To-do; add --category accepts RESEARCH, BUG, ENHANCE, or OTHER; add --body is optional and, when non-empty, must contain Japanese. update requires <hash> as a non-empty workflow item id/hash prefix and accepts optional --status as a non-empty board status, --title as a non-empty Japanese string, and --body as a Japanese string when non-empty. show and publish require <hash> as a non-empty workflow item id/hash prefix; publish --label is optional and must be a non-empty label string when present. search requires <query> as a non-empty string. list --status is optional and must be a non-empty board status when present. ideas requires --spec as a safe project/spec path and rejects missing, absolute, traversal, shell-metacharacter, or non-spec paths.
- Q: What resource bounds apply to workflow plugin board and idea operations?
  - A: ideas processes at most 200 issue-log entries and emits at most 200 candidates per invocation, with at most one classify and one compose AI call per retained candidate and no recursive retry loop. Board list/search GraphQL pagination is bounded to an implementation cap no larger than 20 pages or 1000 items per invocation.
- Q: What is the exit code contract?
  - A: Plugin workflow commands return zero for valid successful execution and non-zero for invalid user input, unknown subcommand, required board config failure for board-required commands, or command throw. Flow hooks return warnings/follow-ups for business failures and do not fail the main flow command solely because board, gh, or AI refinement failed.
- Q: What generic core lifecycle changes are required for workflow hooks?
  - A: prepare.post must run with the newly created flow state after flow.json is written. finalize-cleanup.post must run with a durable spec/issue-log/artifact path and successful hook followUps/data must be aggregated into the finalize-cleanup result.
- Q: What generic core API is required for plugin AI calls?
  - A: Plugin command and hook context must expose workflow-neutral agent resolve/call capability and needed root config values such as lang, so plugins can choose provider/profile overrides from their own plugin config.
- Q: How is the external plugin repository finalized?
  - A: Implementation work uses an in-flow copy/worktree for safety. The spec requires verification against that copy/worktree and a documented application path to the external plugin repository before final validation.

## Alternatives Considered
- Keep the bundled workflow plugin shim that imports core workflow/index.js. — Rejected because it leaves workflow behavior owned by core and fails Issue #375's complete plugin migration goal.
- Leave workflow-specific bootstrap in senti upgrade so official workflow is auto-enabled. — Rejected because Issue #375 says the workflow plugin is explicit install/enable only after complete migration.
- Keep issue-start and issue-log-import as compatibility aliases. — Rejected because Issue #375 and alpha policy require removing these public subcommands without backward compatibility; backward-compatible-cli-interface is addressed by the replacement migration plan.
- Let core interpret workflow idea artifact schema after finalize. — Rejected because finalize follow-up wording and candidate schema are workflow plugin responsibilities, and core must not retain workflow-specific schema knowledge.
- Use literal deletion of every workflow token in core. — Rejected because Issue #375 explicitly excludes historical artifacts and external conventions, and core still uses workflow as a generic term for Spec-Driven Development and GitHub Actions.
- Modify /home/nakano/workspace/senti-workflow-plugin directly during the active flow. — Rejected because the active flow worktree boundary requires work to stay under the flow worktree until cleanup.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-11T06:46:58.493Z
- Notes: User approved gate-passed spec for Issue #375 workflow plugin migration.

## Requirements
- R1 [must]: Prepare the external workflow plugin repository under the active flow worktree and perform plugin-side implementation and verification from that in-boundary location.
- R2 [must]: The workflow plugin must own the `senti workflow` top-level command and existing add, update, show, search, list, publish, and ideas behavior without importing core src/workflow modules or relying on a bundled compatibility copy. Each user-facing argument and option must be validated at the plugin command entry point according to the validation contract in clarifications.
- R3 [must]: The workflow plugin must provide plugin-owned services shared by commands and hooks for board item operations, issue publishing, issue-start behavior, and board idea candidate extraction.
- R4 [must]: The workflow plugin must provide prepare.post and finalize-cleanup.post hooks for flow integration. Generic core lifecycle must run prepare.post with the newly written flow state including hook snapshot, spec path, runId, and linked issue, and must run finalize-cleanup.post while a durable spec/issue-log/artifact path is available. Hook business failures such as board config missing, gh failure, or AI refinement failure must produce warnings, issue-log entries, or follow-ups without failing the main flow command.
- R5 [must]: Workflow plugin AI call sites for publish, idea candidate classification, similarity, and composition must resolve provider/profile overrides from plugin.config.workflow.agent.<name> and otherwise use a workflow-neutral public plugin agent API/context that exposes generic agent resolve/call capability and needed root config values such as lang.
- R6 [must]: Core must remove workflow-owned runtime implementation and bundled workflow compatibility artifacts, including src/workflow and src/official-plugins/senti-workflow-plugin, after their behavior is available from the external plugin.
- R7 [must]: Core must remove workflow-specific config schema/defaults/migration, workflow.publish default agent profile entries, official workflow bootstrap special-cases, and workflow-specific help/locale entries, while preserving generic plugin and preset behavior.
- R8 [must]: Core flow prompt and skill source must stop hardcoding workflow board integration, issue-start, issue-log-import, workflow add, or workflow.flowIntegration instructions. Equivalent behavior must be provided through workflow plugin hooks and plugin-owned follow-up text.
- R9 [must]: Public workflow subcommands issue-start and issue-log-import must be removed without compatibility aliases. The migration plan must replace issue-start with prepare.post hook behavior and issue-log-import with the ideas command and updated skill/help guidance.
- R10 [must]: Core tests must not contain workflow-specific feature fixtures or expectations after migration. Core may keep generic plugin contract tests using non-workflow sample plugins, and workflow behavior tests must live with the workflow plugin.
- R11 [must]: The migrated workflow plugin must be installable/enabled for this repository from the external plugin repository and provide a smoke-verifiable `senti workflow` command plus flow hook behavior.
- R12 [should]: If migration changes src/skills, src/presets, source templates, or deployed skill artifacts, the implementation must run senti upgrade and include evidence that generated artifacts match source changes.

## Acceptance Criteria
- AC1: The implementation creates or uses an in-flow copy/worktree of the external workflow plugin repository under the active flow worktree before editing plugin-side files.
- AC2: The external workflow plugin contains command-owned implementation for add, update, show, search, list, publish, and ideas, and no plugin command imports core src/workflow paths.
- AC3: Workflow plugin hooks call plugin-owned services directly rather than invoking `senti workflow ...` commands from hook code.
- AC4: `senti workflow ideas --spec <spec>` is documented and implemented as the user-facing issue-log idea review command; `issue-log-import` is not a public workflow subcommand.
- AC5: `issue-start` is not a public workflow subcommand; prepare.post hook behavior covers linked issue board status movement when plugin.config.workflow.flowIntegration is enable.
- AC6: Workflow plugin config uses plugin.config.workflow for flowIntegration, languages.source, languages.publish, and agent overrides. Top-level workflow config is not accepted by core as a workflow feature namespace.
- AC7: Core no longer contains src/workflow or src/official-plugins/senti-workflow-plugin after migration.
- AC8: Core upgrade/setup/package/help/locale/config/agent-default behavior no longer has workflow-specific bootstrap, command, config, or default agent entries.
- AC9: src/flow/prompts and src/skills/senti.flow source no longer instruct AI to run workflow-specific CLI commands or read workflow-specific config directly.
- AC10: A semantic scan of active core runtime/source/test/package/current config surfaces finds no workflow feature ownership; remaining workflow text is limited to unrelated generic terms, historical artifacts, generated docs/specs, or external conventions such as GitHub Actions workflows.
- AC11: Core tests that remain after migration use generic plugin fixtures and pass without importing src/workflow or checking workflow-specific feature behavior.
- AC12: Workflow plugin tests cover migrated command dispatch, board operations, publish behavior, ideas extraction, prepare/finalize hooks, config namespace defaults, agent override resolution, and removed subcommand behavior.
- AC13: Installing/enabling the external workflow plugin for this repository makes the `senti workflow` command discoverable and keeps flow integration best-effort behavior non-blocking for board/gh failures.
- AC14: Commands and hooks introduced or modified by the workflow plugin return Envelope-compatible objects; plugin command invalid input and unknown subcommands return non-zero exit, while hook business failures become warnings/follow-ups.
- AC15: Spec-local tests under specs/288-workflow-plugin-migration/tests/ include // spec: R<N> headers covering R1 through R12, and shared regression tests are updated only where core/plugin contracts change.
- AC16: prepare.post hook execution receives the newly created flow state after prepare writes flow.json, including linked issue, spec path, runId, and hook snapshot, so issue-start replacement behavior can run for a newly prepared flow.
- AC17: finalize-cleanup.post hook execution can read issue-log/spec evidence from a durable path, write plugin artifacts, and return successful hook followUps/data that appear in the finalize-cleanup result without core parsing workflow-specific schema.
- AC18: Plugin command and hook contexts expose a workflow-neutral agent API and needed root config values, and workflow plugin AI call sites use that API instead of importing core agent internals.
- AC19: Workflow plugin entry-point validation rejects invalid add/update/show/search/list/publish/ideas arguments according to the clarification contract and returns non-zero command failure envelopes.
- AC20: Workflow plugin ideas extraction and board list/search behavior obey the bounded-resource-usage limits in constraints.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Prepare plugin workspace
  - Create or attach an in-flow copy/worktree of the external workflow plugin repository so plugin-side edits and verification remain inside the active flow boundary.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Move workflow commands
  - Move workflow command runtime ownership to the workflow plugin while preserving existing public add/update/show/search/list/publish behavior and adding ideas as the issue-log review command.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Move workflow hooks
  - Implement workflow plugin prepare.post and finalize-cleanup.post hooks that share plugin-owned services with commands and provide non-blocking flow integration.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Move plugin settings
  - Move workflow skill, config namespace, help metadata, language defaults, and AI agent override resolution into the workflow plugin.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Remove core workflow ownership
  - Delete workflow-owned core implementation and remove workflow-specific core config, agent defaults, upgrade bootstrap, help/locale, prompt, skill, package, and bundled plugin references.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Rehome workflow tests
  - Move workflow feature tests to the plugin repository and keep only workflow-neutral plugin contract tests in core.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Verify external plugin
  - Install or enable the migrated external workflow plugin for this repository and smoke verify command discovery plus flow hook behavior after core workflow ownership is removed.
  - see `tasks/T-7.md` for full spec
