# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Preserve `.senti` ignore exceptions
**Failure mode:** refactor
**File:** .gitignore
**Issue:** **File:** `.gitignore`
**Issue:** The new `.senti/` rule appears after `!.senti/templates/` and `!.senti/output/`, so it can re-ignore the directory and make the earlier negations ineffective.
**Suggestion:** Keep a single ignore pattern such as `.senti/*`, then place explicit negations after it for tracked subpaths. Remove the later `.senti/` rule or move/restructure the exceptions accordingly.
**Suggestion:** **File:** `.gitignore`
**Issue:** The new `.senti/` rule appears after `!.senti/templates/` and `!.senti/output/`, so it can re-ignore the directory and make the earlier negations ineffective.
**Suggestion:** Keep a single ignore pattern such as `.senti/*`, then place explicit negations after it for tracked subpaths. Remove the later `.senti/` rule or move/restructure the exceptions accordingly.
**Rationale:** Loop review proposal.

### 2. 2. Avoid committing machine-local plugin paths
**Failure mode:** refactor
**File:** .senti/config.json
**Issue:** **File:** `.senti/config.json`
**Issue:** `plugin.sources[].path` contains absolute local paths under `/home/nakano/...`, which makes the config non-portable across machines and users.
**Suggestion:** Move local source overrides to an ignored/local config file, or express them through a portable mechanism such as relative paths or documented environment-based resolution.
**Suggestion:** **File:** `.senti/config.json`
**Issue:** `plugin.sources[].path` contains absolute local paths under `/home/nakano/...`, which makes the config non-portable across machines and users.
**Suggestion:** Move local source overrides to an ignored/local config file, or express them through a portable mechanism such as relative paths or documented environment-based resolution.
**Rationale:** Loop review proposal.

### 3. 1. Remove test-fixture helper from production flow code
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `runPrepareWithPluginHooks()` embeds fixture-specific behavior in production code: hardcoded `001-plugin-hook-snapshot-fixture`, `baseBranch: "main"`, and synthetic `fixture-${Date.now()}` run IDs. This looks like test scaffolding rather than runtime behavior.  
**Suggestion:** Move this helper into the relevant test/support file, or replace it with a production-shaped helper that accepts `specDirName`, branch metadata, and flow manager dependencies explicitly.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `runPrepareWithPluginHooks()` embeds fixture-specific behavior in production code: hardcoded `001-plugin-hook-snapshot-fixture`, `baseBranch: "main"`, and synthetic `fixture-${Date.now()}` run IDs. This looks like test scaffolding rather than runtime behavior.  
**Suggestion:** Move this helper into the relevant test/support file, or replace it with a production-shaped helper that accepts `specDirName`, branch metadata, and flow manager dependencies explicitly.
**Rationale:** Loop review proposal.

### 4. 2. Inline or rename the thin hook snapshot wrapper
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `hookSnapshotFor(root)` only delegates to `discoverFlowCommandHooks(root)`, adding little meaning while obscuring that discovery is happening during prepare.  
**Suggestion:** Either call `discoverFlowCommandHooks(specRoot)` directly, or rename the helper to something more explicit like `discoverFlowCommandHookSnapshot()` if the abstraction is expected to grow.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `hookSnapshotFor(root)` only delegates to `discoverFlowCommandHooks(root)`, adding little meaning while obscuring that discovery is happening during prepare.  
**Suggestion:** Either call `discoverFlowCommandHooks(specRoot)` directly, or rename the helper to something more explicit like `discoverFlowCommandHookSnapshot()` if the abstraction is expected to grow.
**Rationale:** Loop review proposal.

### 5. 3. Batch issue-log updates for plugin hook failures
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`  
**Issue:** The code loads and saves the issue log once per `hookResult.issueLogEntries` entry. That duplicates I/O and increases the chance of partial writes if later entries fail.  
**Suggestion:** Load the issue log once, append all plugin hook entries in memory, then save once inside a single `tryAppendIssueLog()` block.
**Suggestion:** **File:** `src/flow/registry.js`  
**Issue:** The code loads and saves the issue log once per `hookResult.issueLogEntries` entry. That duplicates I/O and increases the chance of partial writes if later entries fail.  
**Suggestion:** Load the issue log once, append all plugin hook entries in memory, then save once inside a single `tryAppendIssueLog()` block.
**Rationale:** Loop review proposal.

### 6. 4. Add explicit bounds for plugin hook processing
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`  
**Issue:** `snapshot` and `hookResult.issueLogEntries` are processed without an explicit count bound. This violates the `bounded-resource-usage` guardrail because a large persisted flow snapshot could trigger unbounded hook execution and repeated issue-log writes.  
**Suggestion:** Enforce maximum counts before execution and issue-log append, for example by validating/capping snapshot hook plans and truncating issue-log candidates with a warning entry that records omitted count.
**Suggestion:** **File:** `src/flow/registry.js`  
**Issue:** `snapshot` and `hookResult.issueLogEntries` are processed without an explicit count bound. This violates the `bounded-resource-usage` guardrail because a large persisted flow snapshot could trigger unbounded hook execution and repeated issue-log writes.  
**Suggestion:** Enforce maximum counts before execution and issue-log append, for example by validating/capping snapshot hook plans and truncating issue-log candidates with a warning entry that records omitted count.
**Rationale:** Loop review proposal.

### 7. 1. Add explicit bounds when rendering plugin help
**Failure mode:** refactor
**File:** src/help.js
**Issue:** **File:** `src/help.js`  
**Issue:** `pluginCommands()` loads and renders every plugin command, and plugin command help renders every subcommand. This is bulk data processing without an explicit size/count bound, which violates `bounded-resource-usage`.  
**Suggestion:** Apply explicit limits near the rendering boundary, for example max plugin commands, max subcommands per command, and max help/description length. Prefer named constants so the limits are visible and testable.
**Suggestion:** **File:** `src/help.js`  
**Issue:** `pluginCommands()` loads and renders every plugin command, and plugin command help renders every subcommand. This is bulk data processing without an explicit size/count bound, which violates `bounded-resource-usage`.  
**Suggestion:** Apply explicit limits near the rendering boundary, for example max plugin commands, max subcommands per command, and max help/description length. Prefer named constants so the limits are visible and testable.
**Rationale:** Loop review proposal.

### 8. 2. Remove unnecessary async from help rendering
**Failure mode:** refactor
**File:** src/help.js
**Issue:** **File:** `src/help.js`  
**Issue:** `renderHelp()` is declared `async`, but it does not await anything. This forces callers to treat a purely synchronous renderer as Promise-based.  
**Suggestion:** Make `renderHelp()` synchronous and remove `await` in `main()` unless plugin registry loading is expected to become async.
**Suggestion:** **File:** `src/help.js`  
**Issue:** `renderHelp()` is declared `async`, but it does not await anything. This forces callers to treat a purely synchronous renderer as Promise-based.  
**Suggestion:** Make `renderHelp()` synchronous and remove `await` in `main()` unless plugin registry loading is expected to become async.
**Rationale:** Loop review proposal.

### 9. 3. Extract repeated locale fallback logic
**Failure mode:** refactor
**File:** src/help.js
**Issue:** **File:** `src/help.js`  
**Issue:** `localizedCommand()` repeats the same locale/default fallback pattern for commands and subcommands, with slightly different field sets. This makes future metadata changes easy to apply inconsistently.  
**Suggestion:** Add a small helper such as `localizeHelpMetadata(entry, lang, { includeHelpFallback })` and reuse it for both command and subcommand localization.
**Suggestion:** **File:** `src/help.js`  
**Issue:** `localizedCommand()` repeats the same locale/default fallback pattern for commands and subcommands, with slightly different field sets. This makes future metadata changes easy to apply inconsistently.  
**Suggestion:** Add a small helper such as `localizeHelpMetadata(entry, lang, { includeHelpFallback })` and reuse it for both command and subcommand localization.
**Rationale:** Loop review proposal.

### 10. 4. Avoid recomputing filtered argv
**Failure mode:** refactor
**File:** src/help.js
**Issue:** **File:** `src/help.js`  
**Issue:** `argv.find(...)` and `argv.filter(...)[1]` duplicate the same help-flag filtering logic.  
**Suggestion:** Compute `const args = argv.filter((arg) => arg !== "--help" && arg !== "-h");` once, then use `args[0]` and `args[1]`.
**Suggestion:** **File:** `src/help.js`  
**Issue:** `argv.find(...)` and `argv.filter(...)[1]` duplicate the same help-flag filtering logic.  
**Suggestion:** Compute `const args = argv.filter((arg) => arg !== "--help" && arg !== "-h");` once, then use `args[0]` and `args[1]`.
**Rationale:** Loop review proposal.

### 11. 5. Clarify provider/profile override naming
**Failure mode:** refactor
**File:** src/lib/agent.js
**Issue:** **File:** `src/lib/agent.js`  
**Issue:** `resolveProviderOverrideKey()` returns a registry profile key, not just a provider override key. The name hides the fact that it may discard the selected profile when `options.provider` is present.  
**Suggestion:** Rename it to something like `resolveEffectiveProfileKey(providerKey, selectedProfileKey)` and document the intended precedence.
**Suggestion:** **File:** `src/lib/agent.js`  
**Issue:** `resolveProviderOverrideKey()` returns a registry profile key, not just a provider override key. The name hides the fact that it may discard the selected profile when `options.provider` is present.  
**Suggestion:** Rename it to something like `resolveEffectiveProfileKey(providerKey, selectedProfileKey)` and document the intended precedence.
**Rationale:** Loop review proposal.

### 12. 6. Keep profile precedence documentation consistent
**Failure mode:** refactor
**File:** src/lib/agent.js
**Issue:** **File:** `src/lib/agent.js`  
**Issue:** The comment above `resolve()` still says `SENTI_PROFILE env > config.agent.useProfile > default profile > default`, but `options.profile` now takes precedence over `SENTI_PROFILE`.  
**Suggestion:** Update the comment to include `options.profile`, or change `resolveProfileKey()` if environment variables are still supposed to win.
**Suggestion:** **File:** `src/lib/agent.js`  
**Issue:** The comment above `resolve()` still says `SENTI_PROFILE env > config.agent.useProfile > default profile > default`, but `options.profile` now takes precedence over `SENTI_PROFILE`.  
**Suggestion:** Update the comment to include `options.profile`, or change `resolveProfileKey()` if environment variables are still supposed to win.
**Rationale:** Loop review proposal.

### 13. 1. Add a recursion bound to schema merging
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`  
**Issue:** `mergeSchemaNode()` recursively merges plugin-provided schemas without an explicit depth limit, which violates `bounded-resource-usage` for recursive processing.  
**Suggestion:** Add a max depth parameter, e.g. `mergeSchemaNode(base, extension, depth = 0)`, reject or stop merging past a fixed limit, and include a clear validation error for overly deep plugin config schemas.
**Suggestion:** **File:** `src/lib/config.js`  
**Issue:** `mergeSchemaNode()` recursively merges plugin-provided schemas without an explicit depth limit, which violates `bounded-resource-usage` for recursive processing.  
**Suggestion:** Add a max depth parameter, e.g. `mergeSchemaNode(base, extension, depth = 0)`, reject or stop merging past a fixed limit, and include a clear validation error for overly deep plugin config schemas.
**Rationale:** Loop review proposal.

### 14. 2. Deduplicate legacy workflow validation
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`  
**Issue:** The same `workflow.flowIntegration` migration error is constructed in both `validate()` and `loadConfig()`, making future wording changes easy to miss.  
**Suggestion:** Extract a helper such as `validateLegacyWorkflowConfig(raw, errors)` or a shared constant for the migration message, and reuse it in both places.
**Suggestion:** **File:** `src/lib/config.js`  
**Issue:** The same `workflow.flowIntegration` migration error is constructed in both `validate()` and `loadConfig()`, making future wording changes easy to miss.  
**Suggestion:** Extract a helper such as `validateLegacyWorkflowConfig(raw, errors)` or a shared constant for the migration message, and reuse it in both places.
**Rationale:** Loop review proposal.

### 15. 3. Simplify local source path validation
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`  
**Issue:** The expression `(path.isAbsolute(source.path) ? false : source.path.startsWith("../"))` is hard to read and only catches paths beginning with `"../"`, not normalized traversal like `"foo/../../bar"`.  
**Suggestion:** Extract a helper such as `isUnsafeLocalSourcePath(sourcePath)` and use `path.normalize()` to make the rule explicit and consistent.
**Suggestion:** **File:** `src/lib/config.js`  
**Issue:** The expression `(path.isAbsolute(source.path) ? false : source.path.startsWith("../"))` is hard to read and only catches paths beginning with `"../"`, not normalized traversal like `"foo/../../bar"`.  
**Suggestion:** Extract a helper such as `isUnsafeLocalSourcePath(sourcePath)` and use `path.normalize()` to make the rule explicit and consistent.
**Rationale:** Loop review proposal.

### 16. 4. Narrow the migration helper name
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`  
**Issue:** `migratePluginDefaultNamespaces()` sounds like a general namespace migration, but it only migrates `workflow.flowIntegration` defaults.  
**Suggestion:** Rename it to something more specific, such as `migrateWorkflowIntegrationDefault()` or `migrateWorkflowDefaultNamespace()`, so future callers do not assume it handles all plugin default migrations.
**Suggestion:** **File:** `src/lib/config.js`  
**Issue:** `migratePluginDefaultNamespaces()` sounds like a general namespace migration, but it only migrates `workflow.flowIntegration` defaults.  
**Suggestion:** Rename it to something more specific, such as `migrateWorkflowIntegrationDefault()` or `migrateWorkflowDefaultNamespace()`, so future callers do not assume it handles all plugin default migrations.
**Rationale:** Loop review proposal.

### 17. 5. Clarify invalid-config initialization state
**Failure mode:** refactor
**File:** src/lib/container.js
**Issue:** **File:** `src/lib/container.js`  
**Issue:** When `allowInvalidConfig` is true, `configLoaded` is set to `false` even though the failed load was intentionally handled. That name now mixes “file load succeeded” with “container may proceed using null config.”  
**Suggestion:** Either keep `configLoaded` semantics documented with an inline comment at this branch, or rename/split the state so migration-mode behavior is easier to reason about.
**Suggestion:** **File:** `src/lib/container.js`  
**Issue:** When `allowInvalidConfig` is true, `configLoaded` is set to `false` even though the failed load was intentionally handled. That name now mixes “file load succeeded” with “container may proceed using null config.”  
**Suggestion:** Either keep `configLoaded` semantics documented with an inline comment at this branch, or rename/split the state so migration-mode behavior is easier to reason about.
**Rationale:** Loop review proposal.

### 18. 1. Remove legacy `source.source` fallback
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `sourceLocation(source)` still accepts `source.source`, which silently preserves the old schema even though R1 requires replacing old fields with an actionable migration path.
**Suggestion:** Remove the fallback and add explicit validation/error handling for legacy `plugin.repos` and `packages[].repo`, e.g. “use plugin.sources[] / packages[].source”.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `sourceLocation(source)` still accepts `source.source`, which silently preserves the old schema even though R1 requires replacing old fields with an actionable migration path.
**Suggestion:** Remove the fallback and add explicit validation/error handling for legacy `plugin.repos` and `packages[].repo`, e.g. “use plugin.sources[] / packages[].source”.
**Rationale:** Loop review proposal.

### 19. 2. Avoid duplicate source-tree walks during install
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `installFromSource()` validates both `sourceRoot` and the materialized commit, and `copyAllowlistedFiles()` walks the same known paths again. This repeats bounded filesystem traversal work.
**Suggestion:** Validate only the materialized package snapshot before copying, or combine validation and copy into one traversal that enforces depth, path length, JSON size, and file-count limits once.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `installFromSource()` validates both `sourceRoot` and the materialized commit, and `copyAllowlistedFiles()` walks the same known paths again. This repeats bounded filesystem traversal work.
**Suggestion:** Validate only the materialized package snapshot before copying, or combine validation and copy into one traversal that enforces depth, path length, JSON size, and file-count limits once.
**Rationale:** Loop review proposal.

### 20. 3. Make artifact JSON writes consistent with text writes
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `artifactHelpers.writeText()` creates parent directories, but `writeJson()` does not. The two helpers expose the same artifact path abstraction but behave differently for nested paths.
**Suggestion:** Update `writeJson()` to create `path.dirname(file)` before writing, matching `writeText()`.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `artifactHelpers.writeText()` creates parent directories, but `writeJson()` does not. The two helpers expose the same artifact path abstraction but behave differently for nested paths.
**Suggestion:** Update `writeJson()` to create `path.dirname(file)` before writing, matching `writeText()`.
**Rationale:** Loop review proposal.

### 21. 4. Reuse one plugin API object per operation
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginApi()` is called repeatedly in command dispatch, hook discovery, hook loading, and context construction. This duplicates object creation and makes future API changes easier to apply inconsistently.
**Suggestion:** Create a shared `PLUGIN_API` constant or pass a single `api` object through discovery/loading/context creation.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginApi()` is called repeatedly in command dispatch, hook discovery, hook loading, and context construction. This duplicates object creation and makes future API changes easier to apply inconsistently.
**Suggestion:** Create a shared `PLUGIN_API` constant or pass a single `api` object through discovery/loading/context creation.
**Rationale:** Loop review proposal.

### 22. 5. Replace broad config error swallowing
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `pluginConfigFor()` catches all errors and returns `{}`. That hides malformed project config or read failures, which makes plugin behavior harder to diagnose.
**Suggestion:** Let config read/parse errors propagate, and only default to `{}` when the plugin config entry is genuinely absent.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `pluginConfigFor()` catches all errors and returns `{}`. That hides malformed project config or read failures, which makes plugin behavior harder to diagnose.
**Suggestion:** Let config read/parse errors propagate, and only default to `{}` when the plugin config entry is genuinely absent.
**Rationale:** Loop review proposal.

### 23. 6. Extract hook plan sorting
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** Hook sorting logic is duplicated in `discoverFlowCommandHooks()` and `runFlowCommandHooks()`, with slightly different tie-breaking.
**Suggestion:** Add a small comparator like `compareHookPlans(a, b)` and use it in both places for consistent lifecycle ordering.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** Hook sorting logic is duplicated in `discoverFlowCommandHooks()` and `runFlowCommandHooks()`, with slightly different tie-breaking.
**Suggestion:** Add a small comparator like `compareHookPlans(a, b)` and use it in both places for consistent lifecycle ordering.
**Rationale:** Loop review proposal.

### 24. 1. Remove legacy `source.source` fallback
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `sourceLocation(source)` still accepts `source.source`, which silently preserves the old schema even though R1 requires replacing old fields with an actionable migration path.
**Suggestion:** Remove the fallback and add explicit validation/error handling for legacy `plugin.repos` and `packages[].repo`, e.g. “use plugin.sources[] / packages[].source”.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `sourceLocation(source)` still accepts `source.source`, which silently preserves the old schema even though R1 requires replacing old fields with an actionable migration path.
**Suggestion:** Remove the fallback and add explicit validation/error handling for legacy `plugin.repos` and `packages[].repo`, e.g. “use plugin.sources[] / packages[].source”.
**Rationale:** Loop review proposal.

### 25. 2. Avoid duplicate source-tree walks during install
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `installFromSource()` validates both `sourceRoot` and the materialized commit, and `copyAllowlistedFiles()` walks the same known paths again. This repeats bounded filesystem traversal work.
**Suggestion:** Validate only the materialized package snapshot before copying, or combine validation and copy into one traversal that enforces depth, path length, JSON size, and file-count limits once.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `installFromSource()` validates both `sourceRoot` and the materialized commit, and `copyAllowlistedFiles()` walks the same known paths again. This repeats bounded filesystem traversal work.
**Suggestion:** Validate only the materialized package snapshot before copying, or combine validation and copy into one traversal that enforces depth, path length, JSON size, and file-count limits once.
**Rationale:** Loop review proposal.

### 26. 3. Make artifact JSON writes consistent with text writes
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `artifactHelpers.writeText()` creates parent directories, but `writeJson()` does not. The two helpers expose the same artifact path abstraction but behave differently for nested paths.
**Suggestion:** Update `writeJson()` to create `path.dirname(file)` before writing, matching `writeText()`.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `artifactHelpers.writeText()` creates parent directories, but `writeJson()` does not. The two helpers expose the same artifact path abstraction but behave differently for nested paths.
**Suggestion:** Update `writeJson()` to create `path.dirname(file)` before writing, matching `writeText()`.
**Rationale:** Loop review proposal.

### 27. 4. Reuse one plugin API object per operation
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginApi()` is called repeatedly in command dispatch, hook discovery, hook loading, and context construction. This duplicates object creation and makes future API changes easier to apply inconsistently.
**Suggestion:** Create a shared `PLUGIN_API` constant or pass a single `api` object through discovery/loading/context creation.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginApi()` is called repeatedly in command dispatch, hook discovery, hook loading, and context construction. This duplicates object creation and makes future API changes easier to apply inconsistently.
**Suggestion:** Create a shared `PLUGIN_API` constant or pass a single `api` object through discovery/loading/context creation.
**Rationale:** Loop review proposal.

### 28. 5. Replace broad config error swallowing
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `pluginConfigFor()` catches all errors and returns `{}`. That hides malformed project config or read failures, which makes plugin behavior harder to diagnose.
**Suggestion:** Let config read/parse errors propagate, and only default to `{}` when the plugin config entry is genuinely absent.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `pluginConfigFor()` catches all errors and returns `{}`. That hides malformed project config or read failures, which makes plugin behavior harder to diagnose.
**Suggestion:** Let config read/parse errors propagate, and only default to `{}` when the plugin config entry is genuinely absent.
**Rationale:** Loop review proposal.

### 29. 6. Extract hook plan sorting
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** Hook sorting logic is duplicated in `discoverFlowCommandHooks()` and `runFlowCommandHooks()`, with slightly different tie-breaking.
**Suggestion:** Add a small comparator like `compareHookPlans(a, b)` and use it in both places for consistent lifecycle ordering.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** Hook sorting logic is duplicated in `discoverFlowCommandHooks()` and `runFlowCommandHooks()`, with slightly different tie-breaking.
**Suggestion:** Add a small comparator like `compareHookPlans(a, b)` and use it in both places for consistent lifecycle ordering.
**Rationale:** Loop review proposal.

### 30. 1. Clarify slash-fallback profile lookup
**Failure mode:** refactor
**File:** src/lib/provider.js
**Issue:** **File:** `src/lib/provider.js`
**Issue:** `_profileForKey()` sounds like a plain key lookup, but it also performs fallback from `plugin/profile` to `plugin`. That behavior is non-obvious at call sites like `resolveProfile()` and `hasProfile()`.
**Suggestion:** Rename it to something that exposes the fallback semantics, e.g. `_resolveProfileWithPluginFallback(profileKey)` or `_profileForExactOrPluginKey(profileKey)`.
**Suggestion:** **File:** `src/lib/provider.js`
**Issue:** `_profileForKey()` sounds like a plain key lookup, but it also performs fallback from `plugin/profile` to `plugin`. That behavior is non-obvious at call sites like `resolveProfile()` and `hasProfile()`.
**Suggestion:** Rename it to something that exposes the fallback semantics, e.g. `_resolveProfileWithPluginFallback(profileKey)` or `_profileForExactOrPluginKey(profileKey)`.
**Rationale:** Loop review proposal.

### 31. 2. Remove duplicate empty-key guard
**Failure mode:** refactor
**File:** src/lib/provider.js
**Issue:** **File:** `src/lib/provider.js`
**Issue:** `resolveProfile()` checks `if (!profileKey) return null;`, and `_profileForKey()` repeats the same guard immediately after.
**Suggestion:** Keep the guard in one place. Since `_profileForKey()` is now the shared lookup helper and `hasProfile()` also calls it, keep the guard there and remove the duplicate check from `resolveProfile()`.
**Suggestion:** **File:** `src/lib/provider.js`
**Issue:** `resolveProfile()` checks `if (!profileKey) return null;`, and `_profileForKey()` repeats the same guard immediately after.
**Suggestion:** Keep the guard in one place. Since `_profileForKey()` is now the shared lookup helper and `hasProfile()` also calls it, keep the guard there and remove the duplicate check from `resolveProfile()`.
**Rationale:** Loop review proposal.

### 32. 1. Clarify slash-fallback profile lookup
**Failure mode:** refactor
**File:** src/lib/provider.js
**Issue:** **File:** `src/lib/provider.js`
**Issue:** `_profileForKey()` sounds like a plain key lookup, but it also performs fallback from `plugin/profile` to `plugin`. That behavior is non-obvious at call sites like `resolveProfile()` and `hasProfile()`.
**Suggestion:** Rename it to something that exposes the fallback semantics, e.g. `_resolveProfileWithPluginFallback(profileKey)` or `_profileForExactOrPluginKey(profileKey)`.
**Suggestion:** **File:** `src/lib/provider.js`
**Issue:** `_profileForKey()` sounds like a plain key lookup, but it also performs fallback from `plugin/profile` to `plugin`. That behavior is non-obvious at call sites like `resolveProfile()` and `hasProfile()`.
**Suggestion:** Rename it to something that exposes the fallback semantics, e.g. `_resolveProfileWithPluginFallback(profileKey)` or `_profileForExactOrPluginKey(profileKey)`.
**Rationale:** Loop review proposal.

### 33. 2. Remove duplicate empty-key guard
**Failure mode:** refactor
**File:** src/lib/provider.js
**Issue:** **File:** `src/lib/provider.js`
**Issue:** `resolveProfile()` checks `if (!profileKey) return null;`, and `_profileForKey()` repeats the same guard immediately after.
**Suggestion:** Keep the guard in one place. Since `_profileForKey()` is now the shared lookup helper and `hasProfile()` also calls it, keep the guard there and remove the duplicate check from `resolveProfile()`.
**Suggestion:** **File:** `src/lib/provider.js`
**Issue:** `resolveProfile()` checks `if (!profileKey) return null;`, and `_profileForKey()` repeats the same guard immediately after.
**Suggestion:** Keep the guard in one place. Since `_profileForKey()` is now the shared lookup helper and `hasProfile()` also calls it, keep the guard there and remove the duplicate check from `resolveProfile()`.
**Rationale:** Loop review proposal.

### 34. 1. Remove Legacy Package Root Fallbacks
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** `packageRoot` still falls back to `SENTI_PACKAGE_ROOT` and `SENTI_SOURCE_ROOT`, which keeps legacy/environment coupling in the plugin command path. That is inconsistent with the new plugin context model in R6.  
**Suggestion:** Prefer `ctx.plugin.root` as the single source of truth. If missing, fail clearly. Example: `const packageRoot = ctx.plugin?.root;`.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** `packageRoot` still falls back to `SENTI_PACKAGE_ROOT` and `SENTI_SOURCE_ROOT`, which keeps legacy/environment coupling in the plugin command path. That is inconsistent with the new plugin context model in R6.  
**Suggestion:** Prefer `ctx.plugin.root` as the single source of truth. If missing, fail clearly. Example: `const packageRoot = ctx.plugin?.root;`.
**Rationale:** Loop review proposal.

### 35. 2. Avoid Leaking `process.argv` Mutation
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The command mutates global `process.argv` before importing the workflow entrypoint and never restores it. In a plugin runtime that may execute multiple commands in one process, this can leak state into later commands.  
**Suggestion:** Save the previous argv and restore it in a `finally` block around the dynamic import, or expose/invoke a workflow entrypoint that accepts argv directly.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The command mutates global `process.argv` before importing the workflow entrypoint and never restores it. In a plugin runtime that may execute multiple commands in one process, this can leak state into later commands.  
**Suggestion:** Save the previous argv and restore it in a `finally` block around the dynamic import, or expose/invoke a workflow entrypoint that accepts argv directly.
**Rationale:** Loop review proposal.

### 36. 3. Clarify the Command Return Construction
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The hard-coded envelope fields `"plugin"` and `"workflow"` are terse and repeated inline at the return site, making the command identity less explicit.  
**Suggestion:** Introduce local constants such as `const COMMAND_KIND = "plugin";` and `const COMMAND_NAME = "workflow";`, or use command metadata from the plugin API if available.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The hard-coded envelope fields `"plugin"` and `"workflow"` are terse and repeated inline at the return site, making the command identity less explicit.  
**Suggestion:** Introduce local constants such as `const COMMAND_KIND = "plugin";` and `const COMMAND_NAME = "workflow";`, or use command metadata from the plugin API if available.
**Rationale:** Loop review proposal.

### 37. 1. Remove Legacy Package Root Fallbacks
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** `packageRoot` still falls back to `SENTI_PACKAGE_ROOT` and `SENTI_SOURCE_ROOT`, which keeps legacy/environment coupling in the plugin command path. That is inconsistent with the new plugin context model in R6.  
**Suggestion:** Prefer `ctx.plugin.root` as the single source of truth. If missing, fail clearly. Example: `const packageRoot = ctx.plugin?.root;`.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** `packageRoot` still falls back to `SENTI_PACKAGE_ROOT` and `SENTI_SOURCE_ROOT`, which keeps legacy/environment coupling in the plugin command path. That is inconsistent with the new plugin context model in R6.  
**Suggestion:** Prefer `ctx.plugin.root` as the single source of truth. If missing, fail clearly. Example: `const packageRoot = ctx.plugin?.root;`.
**Rationale:** Loop review proposal.

### 38. 2. Avoid Leaking `process.argv` Mutation
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The command mutates global `process.argv` before importing the workflow entrypoint and never restores it. In a plugin runtime that may execute multiple commands in one process, this can leak state into later commands.  
**Suggestion:** Save the previous argv and restore it in a `finally` block around the dynamic import, or expose/invoke a workflow entrypoint that accepts argv directly.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The command mutates global `process.argv` before importing the workflow entrypoint and never restores it. In a plugin runtime that may execute multiple commands in one process, this can leak state into later commands.  
**Suggestion:** Save the previous argv and restore it in a `finally` block around the dynamic import, or expose/invoke a workflow entrypoint that accepts argv directly.
**Rationale:** Loop review proposal.

### 39. 3. Clarify the Command Return Construction
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The hard-coded envelope fields `"plugin"` and `"workflow"` are terse and repeated inline at the return site, making the command identity less explicit.  
**Suggestion:** Introduce local constants such as `const COMMAND_KIND = "plugin";` and `const COMMAND_NAME = "workflow";`, or use command metadata from the plugin API if available.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** The hard-coded envelope fields `"plugin"` and `"workflow"` are terse and repeated inline at the return site, making the command identity less explicit.  
**Suggestion:** Introduce local constants such as `const COMMAND_KIND = "plugin";` and `const COMMAND_NAME = "workflow";`, or use command metadata from the plugin API if available.
**Rationale:** Loop review proposal.

### 40. 2. Reconsider schema nesting responsibility
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/config.schema.json
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/config.schema.json`  
**Issue:** The plugin schema now describes the full path `plugin.config.workflow`. If plugin config schemas are applied under `plugin.config.<pluginId>` at runtime, this creates duplicated nesting responsibility and makes the plugin schema less reusable as the schema for the workflow plugin’s own config object.  
**Suggestion:** Keep this schema scoped to the plugin config payload itself, with top-level `languages` and `flowIntegration`, unless the loader explicitly expects whole-project config schemas.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/config.schema.json`  
**Issue:** The plugin schema now describes the full path `plugin.config.workflow`. If plugin config schemas are applied under `plugin.config.<pluginId>` at runtime, this creates duplicated nesting responsibility and makes the plugin schema less reusable as the schema for the workflow plugin’s own config object.  
**Suggestion:** Keep this schema scoped to the plugin config payload itself, with top-level `languages` and `flowIntegration`, unless the loader explicitly expects whole-project config schemas.
**Rationale:** Loop review proposal.

### 41. 1. Avoid duplicate experimental labeling
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/plugin.json
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/plugin.json`  
**Issue:** The command metadata has both `"experimental": true` and `"[EXPERIMENTAL]"` embedded in `desc`. This duplicates responsibility and risks inconsistent display/localization if the help renderer already handles experimental commands.  
**Suggestion:** Change `desc` to `"Manage workflow board drafts"` and rely on `"experimental": true` for the experimental label.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/plugin.json`  
**Issue:** The command metadata has both `"experimental": true` and `"[EXPERIMENTAL]"` embedded in `desc`. This duplicates responsibility and risks inconsistent display/localization if the help renderer already handles experimental commands.  
**Suggestion:** Change `desc` to `"Manage workflow board drafts"` and rely on `"experimental": true` for the experimental label.
**Rationale:** Loop review proposal.

### 42. 3. Split dense command metadata for maintainability
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/plugin.json
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/plugin.json`  
**Issue:** The `contributions.commands[0]` object is now a long single-line object with several fields, making future help metadata edits noisy and harder to review.  
**Suggestion:** Format the command contribution across multiple lines, matching the surrounding manifest style.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/plugin.json`  
**Issue:** The `contributions.commands[0]` object is now a long single-line object with several fields, making future help metadata edits noisy and harder to review.  
**Suggestion:** Format the command contribution across multiple lines, matching the surrounding manifest style.
**Rationale:** Loop review proposal.

### 43. 1. Rename remaining repo-oriented identifiers and errors
**Failure mode:** refactor
**File:** src/plugin.js
**Issue:** **File:** `src/plugin.js`  
**Issue:** The command was renamed from `repo` to `source`, but internal names and one user-facing error still say repo: `printRepoHelp`, `repoCommand`, `repoRest`, and `unknown plugin repo command`. This weakens consistency and can confuse users debugging CLI output.  
**Suggestion:** Rename these to `printSourceHelp`, `sourceCommand`, `sourceRest`, and change the error to `unknown plugin source command: ...`.
**Suggestion:** **File:** `src/plugin.js`  
**Issue:** The command was renamed from `repo` to `source`, but internal names and one user-facing error still say repo: `printRepoHelp`, `repoCommand`, `repoRest`, and `unknown plugin repo command`. This weakens consistency and can confuse users debugging CLI output.  
**Suggestion:** Rename these to `printSourceHelp`, `sourceCommand`, `sourceRest`, and change the error to `unknown plugin source command: ...`.
**Rationale:** Loop review proposal.

### 44. 2. Remove or wire up unused plugin list renderer
**Failure mode:** refactor
**File:** src/plugin.js
**Issue:** **File:** `src/plugin.js`  
**Issue:** `renderPluginList()` is exported but not used in the shown CLI path. It also duplicates part of `formatLine()` / `output()` formatting behavior, creating two places that can drift.  
**Suggestion:** Either use `renderPluginList()` from the relevant `plugin list` path, or remove it and keep formatting centralized in the existing `output()` / `formatLine()` flow.
**Suggestion:** **File:** `src/plugin.js`  
**Issue:** `renderPluginList()` is exported but not used in the shown CLI path. It also duplicates part of `formatLine()` / `output()` formatting behavior, creating two places that can drift.  
**Suggestion:** Either use `renderPluginList()` from the relevant `plugin list` path, or remove it and keep formatting centralized in the existing `output()` / `formatLine()` flow.
**Rationale:** Loop review proposal.

### 45. 3. Avoid mixed return-shape handling in CLI dispatch
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`  
**Issue:** `handled` now appears to be both a boolean and possibly an envelope object. The name no longer matches the value, and the `handled.ok != null` duck-typing spreads plugin envelope knowledge into the top-level CLI.  
**Suggestion:** Normalize `dispatchPluginCommand()` to return a single explicit shape, such as `null` for unhandled or an envelope/result object for handled commands. Then rename `handled` to `pluginResult` or similar and remove boolean/object branching.
**Suggestion:** **File:** `src/senti.js`  
**Issue:** `handled` now appears to be both a boolean and possibly an envelope object. The name no longer matches the value, and the `handled.ok != null` duck-typing spreads plugin envelope knowledge into the top-level CLI.  
**Suggestion:** Normalize `dispatchPluginCommand()` to return a single explicit shape, such as `null` for unhandled or an envelope/result object for handled commands. Then rename `handled` to `pluginResult` or similar and remove boolean/object branching.
**Rationale:** Loop review proposal.

### 46. I’ll review this as a diff-scoped quality pass only, so proposals will stay limited to the two touched files.### 1. Consolidate config file migration passes
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** The new pre-migration block reads/writes `.senti/config.json`, then the existing migration block reads/writes the same file again. This also makes the later “Single read/write” comment inaccurate.  
**Suggestion:** Move `migratePluginConfigNamespaces()` into the existing config migration flow or extract a shared `migrateConfigFile()` helper so config is parsed, migrated, compared, and written once.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** The new pre-migration block reads/writes `.senti/config.json`, then the existing migration block reads/writes the same file again. This also makes the later “Single read/write” comment inaccurate.  
**Suggestion:** Move `migratePluginConfigNamespaces()` into the existing config migration flow or extract a shared `migrateConfigFile()` helper so config is parsed, migrated, compared, and written once.
**Rationale:** Loop review proposal.

### 47. 2. Remove duplicated source classification regex
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** The same source URL regex is evaluated twice inside each `plugin.repos` migration.  
**Suggestion:** Introduce a local `isGitSource` variable or helper such as `pluginSourceLocation(source)` that returns `{ type, url/path }`.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** The same source URL regex is evaluated twice inside each `plugin.repos` migration.  
**Suggestion:** Introduce a local `isGitSource` variable or helper such as `pluginSourceLocation(source)` that returns `{ type, url/path }`.
**Rationale:** Loop review proposal.

### 48. 3. Add explicit bounds for migrated plugin arrays
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `plugin.repos` and `plugin.packages` are mapped without an explicit item limit. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Define and enforce a maximum count for these arrays during migration, ideally matching any existing config/schema limits.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `plugin.repos` and `plugin.packages` are mapped without an explicit item limit. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Define and enforce a maximum count for these arrays during migration, ideally matching any existing config/schema limits.
**Rationale:** Loop review proposal.

### 49. 4. Do not silently swallow write failures
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** The broad `catch (_)` hides read, parse, migration, and write failures alike. A failed migration write could be ignored, leaving config unmigrated with no actionable signal.  
**Suggestion:** Only ignore expected “missing config” cases. Surface or log parse/write errors with enough context to diagnose the failed upgrade.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** The broad `catch (_)` hides read, parse, migration, and write failures alike. A failed migration write could be ignored, leaving config unmigrated with no actionable signal.  
**Suggestion:** Only ignore expected “missing config” cases. Surface or log parse/write errors with enough context to diagnose the failed upgrade.
**Rationale:** Loop review proposal.

### 50. I’ll review this as a diff-scoped quality pass only, so proposals will stay limited to the two touched files.### 1. Consolidate config file migration passes
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** The new pre-migration block reads/writes `.senti/config.json`, then the existing migration block reads/writes the same file again. This also makes the later “Single read/write” comment inaccurate.  
**Suggestion:** Move `migratePluginConfigNamespaces()` into the existing config migration flow or extract a shared `migrateConfigFile()` helper so config is parsed, migrated, compared, and written once.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** The new pre-migration block reads/writes `.senti/config.json`, then the existing migration block reads/writes the same file again. This also makes the later “Single read/write” comment inaccurate.  
**Suggestion:** Move `migratePluginConfigNamespaces()` into the existing config migration flow or extract a shared `migrateConfigFile()` helper so config is parsed, migrated, compared, and written once.
**Rationale:** Loop review proposal.

### 51. 2. Remove duplicated source classification regex
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** The same source URL regex is evaluated twice inside each `plugin.repos` migration.  
**Suggestion:** Introduce a local `isGitSource` variable or helper such as `pluginSourceLocation(source)` that returns `{ type, url/path }`.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** The same source URL regex is evaluated twice inside each `plugin.repos` migration.  
**Suggestion:** Introduce a local `isGitSource` variable or helper such as `pluginSourceLocation(source)` that returns `{ type, url/path }`.
**Rationale:** Loop review proposal.

### 52. 3. Add explicit bounds for migrated plugin arrays
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `plugin.repos` and `plugin.packages` are mapped without an explicit item limit. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Define and enforce a maximum count for these arrays during migration, ideally matching any existing config/schema limits.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `plugin.repos` and `plugin.packages` are mapped without an explicit item limit. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Define and enforce a maximum count for these arrays during migration, ideally matching any existing config/schema limits.
**Rationale:** Loop review proposal.

### 53. 4. Do not silently swallow write failures
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** The broad `catch (_)` hides read, parse, migration, and write failures alike. A failed migration write could be ignored, leaving config unmigrated with no actionable signal.  
**Suggestion:** Only ignore expected “missing config” cases. Surface or log parse/write errors with enough context to diagnose the failed upgrade.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** The broad `catch (_)` hides read, parse, migration, and write failures alike. A failed migration write could be ignored, leaving config unmigrated with no actionable signal.  
**Suggestion:** Only ignore expected “missing config” cases. Surface or log parse/write errors with enough context to diagnose the failed upgrade.
**Rationale:** Loop review proposal.

### 54. 1. Strengthen hook assertions
**Failure mode:** refactor
**File:** tests/unit/workflow-board-candidate-guidance.test.js
**Issue:** **File:** `tests/unit/workflow-board-candidate-guidance.test.js`  
**Issue:** The new hook checks only assert `/context\.config\.flowIntegration/` and `/issue-start/`, which are weak signals and could pass even if the hook no longer contains the required candidate handling behavior.  
**Suggestion:** Assert the concrete lifecycle behavior that replaced the removed skill assertions, such as bounded candidate handling, readiness screening, user approval before adding candidates, and post-flow failure treatment if those responsibilities now live in the hook.
**Suggestion:** **File:** `tests/unit/workflow-board-candidate-guidance.test.js`  
**Issue:** The new hook checks only assert `/context\.config\.flowIntegration/` and `/issue-start/`, which are weak signals and could pass even if the hook no longer contains the required candidate handling behavior.  
**Suggestion:** Assert the concrete lifecycle behavior that replaced the removed skill assertions, such as bounded candidate handling, readiness screening, user approval before adding candidates, and post-flow failure treatment if those responsibilities now live in the hook.
**Rationale:** Loop review proposal.

### 55. 2. Rename `hook` for clarity
**Failure mode:** refactor
**File:** tests/unit/workflow-board-candidate-guidance.test.js
**Issue:** **File:** `tests/unit/workflow-board-candidate-guidance.test.js`  
**Issue:** The variable name `hook` is generic and gives little context about which lifecycle hook is under test.  
**Suggestion:** Rename it to something more specific, such as `issueStartHook`, to match `src/official-plugins/senti-workflow-plugin/hooks/issue-start.js` and make the assertions easier to scan.
**Suggestion:** **File:** `tests/unit/workflow-board-candidate-guidance.test.js`  
**Issue:** The variable name `hook` is generic and gives little context about which lifecycle hook is under test.  
**Suggestion:** Rename it to something more specific, such as `issueStartHook`, to match `src/official-plugins/senti-workflow-plugin/hooks/issue-start.js` and make the assertions easier to scan.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 7
- Out of scope: 0
