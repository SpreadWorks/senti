# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Plugin manifest contract is not defined
**Target:** R2/R3/R4/R5/R8 and plugin.json references
**Issue:** The spec requires discovery from plugin.json, plugin.json.files copying, and command/preset/skill/config/DataSource contributions, but it never defines the manifest shape or the contribution fields that runtime code should consume. Existing code has no plugin manifest precedent, so there is no implementation target for how a workflow command module, preset directory, skill directory, config schema/default, or DataSource meta entry is declared and validated.
**Required change:** Add the minimal plugin.json contract: required name/id, files syntax, package/contribution sections, and per-contribution path/key fields for commands, presets, skills, config schema/defaults, and DataSource static meta.
**Why blocking:** Without this contract, implementers cannot write candidate discovery, validation, copying, registry loading, or fixtures with deterministic expected behavior.

### 2. Plugin-owned config validation has no bootstrap path
**Target:** Plugin registry config schema/default contributions
**Issue:** Existing config loading in src/lib/config.js validates .senti/config.json against a closed CONFIG_SCHEMA before the container or any registry exists. The spec says workflow config schema/defaults move into a plugin and plugin registry loads config schema/default contributions, but it does not define how enabled plugin manifests are loaded early enough for validation to accept plugin-owned keys such as workflow.
**Required change:** Specify the config bootstrap order: base validation must accept plugin.repos/plugin.packages, load enabled plugin manifests/runtime metadata, merge plugin config schema/default contributions, then validate plugin-owned config sections.
**Why blocking:** If workflow is removed from the core schema as required, upgraded configs containing workflow.* will be rejected before the workflow plugin can contribute its schema, preventing CLI startup and migration tests from passing.

### 3. Workflow migration cannot identify prior direct users
**Target:** Workflow migration behavior
**Issue:** The spec says previous senti workflow users continue through upgrade-installed workflow plugin activation, but existing workflow is always available and has no activation state or persisted usage marker; src/workflow/AGENTS.md documents no enable gate. The only visible config marker is workflow.flowIntegration, which covers flow integration, not direct use of senti workflow add/list/publish.
**Required change:** Define the migration selection rule, either enabling the official workflow plugin for all upgraded projects with a valid .senti/config.json or explicitly narrowing compatibility to projects with workflow.flowIntegration and revising the preservation claim.
**Why blocking:** If upgrade only enables the plugin for detectable flow-integration projects, direct workflow users lose the command after the core stub is removed, violating the stated backward-compatible CLI behavior.

### 4. Project-local preset overrides do not preserve plugin preset inheritance
**Target:** R5 project-local preset override behavior
**Issue:** Existing resolveProjectPreset() lets .senti/presets/<key>/ without preset.json inherit built-in preset metadata. After non-base presets move out of src/presets, the same project-local override for an official plugin preset would no longer find a built-in preset to inherit from and would become a bare preset with no parent, scan, or chapters unless the spec defines registry-backed inheritance.
**Required change:** Specify that project-local .senti/presets/<key>/ overlays the active registry preset with the same key when preset.json is absent, and that parent-chain lookup uses core base plus enabled plugin presets, not only src/presets.
**Why blocking:** Existing project-local overrides for official presets can silently lose parent templates, DataSources, scan settings, and chapter order after migration, making docs build behavior incompatible and hard to test correctly.

### 5. Local path sources conflict with commit-pinned reproducibility
**Target:** Repo source and commit pinning semantics
**Issue:** The spec requires local path plugin repos and also requires plugin.packages entries to be commit-pinned, but it does not state whether local paths must be Git repositories/worktrees, how HEAD is resolved, or what happens for dirty or non-Git local directories.
**Required change:** Define local path sources as Git repositories/worktrees with a resolvable commit and specify rejection or handling for dirty and non-Git paths during repo update/install/sync.
**Why blocking:** Tests for local path installation and sync cannot determine the expected commit value or failure mode, and an implementation could accept non-reproducible local directories despite commit-pinned package semantics.

### 6. DataSource static meta is both required and nice-to-have
**Target:** R6 versus Scope/Clarifications/Acceptance Criteria
**Issue:** Scope, Clarifications, Decisions, Tasks, and Acceptance Criteria include DataSource static meta in the initial implementation, but R6 marks it nice-to-have. This changes whether parent-chain, override, and directive pre-validation must be implemented for the release.
**Required change:** Change R6 to must, or remove DataSource static meta from initial scope, tasks, and acceptance criteria.
**Why blocking:** Implementers and tests cannot determine whether missing static meta support should fail the implementation or be deferred.


## Non-blocking Improvements

### 1. Clarify plugin command invocation contract
**Target:** R9 command integration
**Improvement:** Mention whether a plugin command contribution points to a module exporting main(), a dispatcher script imported with adjusted process.argv, or a command class. This would align plugin commands with existing top-level independent and namespace dispatch patterns in src/senti.js.
**Why non-blocking:** The generic manifest contract can cover this, and implementation can choose a consistent local pattern once the manifest shape is defined.

### 2. Mention agent profile defaults for workflow publish
**Target:** R8 workflow plugin extraction
**Improvement:** Call out whether workflow.publish agent profile defaults remain in core or move into workflow plugin config/default contributions, since src/lib/agent-defaults.js currently seeds workflow.publish for several profiles.
**Why non-blocking:** Existing projects that already received defaults may continue to work, and the core plugin mechanism can still be implemented without deciding this detail immediately.
