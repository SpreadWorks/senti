# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Reuse spec path constants
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `specs/${specId}` is rebuilt in multiple places for `issueLogPath`, `artifactPath`, and `flowJsonRel`, which makes future path changes easy to miss.  
**Suggestion:** Define shared constants near the start of `runTeardown`, e.g. `specDirRel`, `issueLogRel`, and `flowJsonRel`, then reuse them in the plugin lifecycle payload and metadata update logic.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `specs/${specId}` is rebuilt in multiple places for `issueLogPath`, `artifactPath`, and `flowJsonRel`, which makes future path changes easy to miss.  
**Suggestion:** Define shared constants near the start of `runTeardown`, e.g. `specDirRel`, `issueLogRel`, and `flowJsonRel`, then reuse them in the plugin lifecycle payload and metadata update logic.
**Rationale:** Loop review proposal.

### 2. 2. Rename lifecycle result variable
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `pluginLifecycle` reads like a lifecycle object or runner, but it actually stores the result of running lifecycle hooks.  
**Suggestion:** Rename it to `pluginLifecycleResult` or `pluginHookResult` to make later uses like `pluginLifecycleResult.warnings` and `pluginLifecycleResult.data` clearer.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `pluginLifecycle` reads like a lifecycle object or runner, but it actually stores the result of running lifecycle hooks.  
**Suggestion:** Rename it to `pluginLifecycleResult` or `pluginHookResult` to make later uses like `pluginLifecycleResult.warnings` and `pluginLifecycleResult.data` clearer.
**Rationale:** Loop review proposal.

### 3. 3. Extract plugin lifecycle fallback construction
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The catch block manually constructs the fallback lifecycle result inline, including duplicated error-code strings and result shape details.  
**Suggestion:** Move this into a small helper such as `pluginLifecycleFailureResult(err)`, returning `{ warnings, issueLogEntries, data }`. This keeps `runTeardown` focused on teardown flow and centralizes the fallback shape.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The catch block manually constructs the fallback lifecycle result inline, including duplicated error-code strings and result shape details.  
**Suggestion:** Move this into a small helper such as `pluginLifecycleFailureResult(err)`, returning `{ warnings, issueLogEntries, data }`. This keeps `runTeardown` focused on teardown flow and centralizes the fallback shape.
**Rationale:** Loop review proposal.

### 4. 4. Normalize plugin lifecycle result once
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** Later code defensively reads `pluginLifecycle.data?.pluginHooks || []`, `pluginLifecycle.data?.followUps || []`, and `pluginLifecycle.warnings || []`. That spreads result-shape assumptions through the teardown logic.  
**Suggestion:** Normalize immediately after the lifecycle call/catch, e.g. ensure `warnings`, `issueLogEntries`, `data.pluginHooks`, and `data.followUps` are arrays. Then downstream code can read plain properties without repeated fallback logic.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** Later code defensively reads `pluginLifecycle.data?.pluginHooks || []`, `pluginLifecycle.data?.followUps || []`, and `pluginLifecycle.warnings || []`. That spreads result-shape assumptions through the teardown logic.  
**Suggestion:** Normalize immediately after the lifecycle call/catch, e.g. ensure `warnings`, `issueLogEntries`, `data.pluginHooks`, and `data.followUps` are arrays. Then downstream code can read plain properties without repeated fallback logic.
**Rationale:** Loop review proposal.

### 5. 1. Reuse spec path constants
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `specs/${specId}` is rebuilt in multiple places for `issueLogPath`, `artifactPath`, and `flowJsonRel`, which makes future path changes easy to miss.  
**Suggestion:** Define shared constants near the start of `runTeardown`, e.g. `specDirRel`, `issueLogRel`, and `flowJsonRel`, then reuse them in the plugin lifecycle payload and metadata update logic.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `specs/${specId}` is rebuilt in multiple places for `issueLogPath`, `artifactPath`, and `flowJsonRel`, which makes future path changes easy to miss.  
**Suggestion:** Define shared constants near the start of `runTeardown`, e.g. `specDirRel`, `issueLogRel`, and `flowJsonRel`, then reuse them in the plugin lifecycle payload and metadata update logic.
**Rationale:** Loop review proposal.

### 6. 2. Rename lifecycle result variable
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `pluginLifecycle` reads like a lifecycle object or runner, but it actually stores the result of running lifecycle hooks.  
**Suggestion:** Rename it to `pluginLifecycleResult` or `pluginHookResult` to make later uses like `pluginLifecycleResult.warnings` and `pluginLifecycleResult.data` clearer.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `pluginLifecycle` reads like a lifecycle object or runner, but it actually stores the result of running lifecycle hooks.  
**Suggestion:** Rename it to `pluginLifecycleResult` or `pluginHookResult` to make later uses like `pluginLifecycleResult.warnings` and `pluginLifecycleResult.data` clearer.
**Rationale:** Loop review proposal.

### 7. 3. Extract plugin lifecycle fallback construction
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The catch block manually constructs the fallback lifecycle result inline, including duplicated error-code strings and result shape details.  
**Suggestion:** Move this into a small helper such as `pluginLifecycleFailureResult(err)`, returning `{ warnings, issueLogEntries, data }`. This keeps `runTeardown` focused on teardown flow and centralizes the fallback shape.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The catch block manually constructs the fallback lifecycle result inline, including duplicated error-code strings and result shape details.  
**Suggestion:** Move this into a small helper such as `pluginLifecycleFailureResult(err)`, returning `{ warnings, issueLogEntries, data }`. This keeps `runTeardown` focused on teardown flow and centralizes the fallback shape.
**Rationale:** Loop review proposal.

### 8. 4. Normalize plugin lifecycle result once
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** Later code defensively reads `pluginLifecycle.data?.pluginHooks || []`, `pluginLifecycle.data?.followUps || []`, and `pluginLifecycle.warnings || []`. That spreads result-shape assumptions through the teardown logic.  
**Suggestion:** Normalize immediately after the lifecycle call/catch, e.g. ensure `warnings`, `issueLogEntries`, `data.pluginHooks`, and `data.followUps` are arrays. Then downstream code can read plain properties without repeated fallback logic.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** Later code defensively reads `pluginLifecycle.data?.pluginHooks || []`, `pluginLifecycle.data?.followUps || []`, and `pluginLifecycle.warnings || []`. That spreads result-shape assumptions through the teardown logic.  
**Suggestion:** Normalize immediately after the lifecycle call/catch, e.g. ensure `warnings`, `issueLogEntries`, `data.pluginHooks`, and `data.followUps` are arrays. Then downstream code can read plain properties without repeated fallback logic.
**Rationale:** Loop review proposal.

### 9. 1. Reuse spec path constants
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `specs/${specId}` is rebuilt in multiple places for `issueLogPath`, `artifactPath`, and `flowJsonRel`, which makes future path changes easy to miss.  
**Suggestion:** Define shared constants near the start of `runTeardown`, e.g. `specDirRel`, `issueLogRel`, and `flowJsonRel`, then reuse them in the plugin lifecycle payload and metadata update logic.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `specs/${specId}` is rebuilt in multiple places for `issueLogPath`, `artifactPath`, and `flowJsonRel`, which makes future path changes easy to miss.  
**Suggestion:** Define shared constants near the start of `runTeardown`, e.g. `specDirRel`, `issueLogRel`, and `flowJsonRel`, then reuse them in the plugin lifecycle payload and metadata update logic.
**Rationale:** Loop review proposal.

### 10. 2. Rename lifecycle result variable
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `pluginLifecycle` reads like a lifecycle object or runner, but it actually stores the result of running lifecycle hooks.  
**Suggestion:** Rename it to `pluginLifecycleResult` or `pluginHookResult` to make later uses like `pluginLifecycleResult.warnings` and `pluginLifecycleResult.data` clearer.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** `pluginLifecycle` reads like a lifecycle object or runner, but it actually stores the result of running lifecycle hooks.  
**Suggestion:** Rename it to `pluginLifecycleResult` or `pluginHookResult` to make later uses like `pluginLifecycleResult.warnings` and `pluginLifecycleResult.data` clearer.
**Rationale:** Loop review proposal.

### 11. 3. Extract plugin lifecycle fallback construction
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The catch block manually constructs the fallback lifecycle result inline, including duplicated error-code strings and result shape details.  
**Suggestion:** Move this into a small helper such as `pluginLifecycleFailureResult(err)`, returning `{ warnings, issueLogEntries, data }`. This keeps `runTeardown` focused on teardown flow and centralizes the fallback shape.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The catch block manually constructs the fallback lifecycle result inline, including duplicated error-code strings and result shape details.  
**Suggestion:** Move this into a small helper such as `pluginLifecycleFailureResult(err)`, returning `{ warnings, issueLogEntries, data }`. This keeps `runTeardown` focused on teardown flow and centralizes the fallback shape.
**Rationale:** Loop review proposal.

### 12. 4. Normalize plugin lifecycle result once
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** Later code defensively reads `pluginLifecycle.data?.pluginHooks || []`, `pluginLifecycle.data?.followUps || []`, and `pluginLifecycle.warnings || []`. That spreads result-shape assumptions through the teardown logic.  
**Suggestion:** Normalize immediately after the lifecycle call/catch, e.g. ensure `warnings`, `issueLogEntries`, `data.pluginHooks`, and `data.followUps` are arrays. Then downstream code can read plain properties without repeated fallback logic.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** Later code defensively reads `pluginLifecycle.data?.pluginHooks || []`, `pluginLifecycle.data?.followUps || []`, and `pluginLifecycle.warnings || []`. That spreads result-shape assumptions through the teardown logic.  
**Suggestion:** Normalize immediately after the lifecycle call/catch, e.g. ensure `warnings`, `issueLogEntries`, `data.pluginHooks`, and `data.followUps` are arrays. Then downstream code can read plain properties without repeated fallback logic.
**Rationale:** Loop review proposal.

### 13. 1. Extract prepare lifecycle payload construction
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The `runFlowCommandWithPluginLifecycle(...)` call duplicates the same `command`, `flow`, and `main` payload in both `runPrepareWithPluginHooks` and `RunPrepareSpecCommand`.  
**Suggestion:** Add a small helper such as `runPrepareLifecycle(root, plans, state)` that wraps the shared call and returns the lifecycle result. This keeps prepare hook behavior consistent and reduces drift risk.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The `runFlowCommandWithPluginLifecycle(...)` call duplicates the same `command`, `flow`, and `main` payload in both `runPrepareWithPluginHooks` and `RunPrepareSpecCommand`.  
**Suggestion:** Add a small helper such as `runPrepareLifecycle(root, plans, state)` that wraps the shared call and returns the lifecycle result. This keeps prepare hook behavior consistent and reduces drift risk.
**Rationale:** Loop review proposal.

### 14. 2. Rename and validate the optional issue argument
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The new `issue` parameter is converted with `Number(issue)` only when truthy. That makes the name slightly ambiguous and can silently store `NaN` for invalid non-empty input.  
**Suggestion:** Rename it to `issueNumber` or `linkedIssueNumber`, parse once, and only include it when `Number.isFinite(parsedIssue)` is true. This makes the state shape clearer and avoids invalid lifecycle payload data.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The new `issue` parameter is converted with `Number(issue)` only when truthy. That makes the name slightly ambiguous and can silently store `NaN` for invalid non-empty input.  
**Suggestion:** Rename it to `issueNumber` or `linkedIssueNumber`, parse once, and only include it when `Number.isFinite(parsedIssue)` is true. This makes the state shape clearer and avoids invalid lifecycle payload data.
**Rationale:** Loop review proposal.

### 15. 1. Extract prepare lifecycle payload construction
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The `runFlowCommandWithPluginLifecycle(...)` call duplicates the same `command`, `flow`, and `main` payload in both `runPrepareWithPluginHooks` and `RunPrepareSpecCommand`.  
**Suggestion:** Add a small helper such as `runPrepareLifecycle(root, plans, state)` that wraps the shared call and returns the lifecycle result. This keeps prepare hook behavior consistent and reduces drift risk.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The `runFlowCommandWithPluginLifecycle(...)` call duplicates the same `command`, `flow`, and `main` payload in both `runPrepareWithPluginHooks` and `RunPrepareSpecCommand`.  
**Suggestion:** Add a small helper such as `runPrepareLifecycle(root, plans, state)` that wraps the shared call and returns the lifecycle result. This keeps prepare hook behavior consistent and reduces drift risk.
**Rationale:** Loop review proposal.

### 16. 2. Rename and validate the optional issue argument
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The new `issue` parameter is converted with `Number(issue)` only when truthy. That makes the name slightly ambiguous and can silently store `NaN` for invalid non-empty input.  
**Suggestion:** Rename it to `issueNumber` or `linkedIssueNumber`, parse once, and only include it when `Number.isFinite(parsedIssue)` is true. This makes the state shape clearer and avoids invalid lifecycle payload data.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The new `issue` parameter is converted with `Number(issue)` only when truthy. That makes the name slightly ambiguous and can silently store `NaN` for invalid non-empty input.  
**Suggestion:** Rename it to `issueNumber` or `linkedIssueNumber`, parse once, and only include it when `Number.isFinite(parsedIssue)` is true. This makes the state shape clearer and avoids invalid lifecycle payload data.
**Rationale:** Loop review proposal.

### 17. 1. Extract prepare lifecycle payload construction
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The `runFlowCommandWithPluginLifecycle(...)` call duplicates the same `command`, `flow`, and `main` payload in both `runPrepareWithPluginHooks` and `RunPrepareSpecCommand`.  
**Suggestion:** Add a small helper such as `runPrepareLifecycle(root, plans, state)` that wraps the shared call and returns the lifecycle result. This keeps prepare hook behavior consistent and reduces drift risk.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The `runFlowCommandWithPluginLifecycle(...)` call duplicates the same `command`, `flow`, and `main` payload in both `runPrepareWithPluginHooks` and `RunPrepareSpecCommand`.  
**Suggestion:** Add a small helper such as `runPrepareLifecycle(root, plans, state)` that wraps the shared call and returns the lifecycle result. This keeps prepare hook behavior consistent and reduces drift risk.
**Rationale:** Loop review proposal.

### 18. 2. Rename and validate the optional issue argument
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The new `issue` parameter is converted with `Number(issue)` only when truthy. That makes the name slightly ambiguous and can silently store `NaN` for invalid non-empty input.  
**Suggestion:** Rename it to `issueNumber` or `linkedIssueNumber`, parse once, and only include it when `Number.isFinite(parsedIssue)` is true. This makes the state shape clearer and avoids invalid lifecycle payload data.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The new `issue` parameter is converted with `Number(issue)` only when truthy. That makes the name slightly ambiguous and can silently store `NaN` for invalid non-empty input.  
**Suggestion:** Rename it to `issueNumber` or `linkedIssueNumber`, parse once, and only include it when `Number.isFinite(parsedIssue)` is true. This makes the state shape clearer and avoids invalid lifecycle payload data.
**Rationale:** Loop review proposal.

### 19. 1. Rename or inline obsolete migration helper
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `migratePluginDefaultNamespaces()` no longer migrates anything; it only clones config. The name now implies workflow migration behavior that was intentionally removed.
**Suggestion:** Inline `structuredClone(raw || {})` at the call site, or rename the helper to something neutral like `cloneConfigForPluginDefaults()`.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `migratePluginDefaultNamespaces()` no longer migrates anything; it only clones config. The name now implies workflow migration behavior that was intentionally removed.
**Suggestion:** Inline `structuredClone(raw || {})` at the call site, or rename the helper to something neutral like `cloneConfigForPluginDefaults()`.
**Rationale:** Loop review proposal.

### 20. 1. Rename or inline obsolete migration helper
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `migratePluginDefaultNamespaces()` no longer migrates anything; it only clones config. The name now implies workflow migration behavior that was intentionally removed.
**Suggestion:** Inline `structuredClone(raw || {})` at the call site, or rename the helper to something neutral like `cloneConfigForPluginDefaults()`.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `migratePluginDefaultNamespaces()` no longer migrates anything; it only clones config. The name now implies workflow migration behavior that was intentionally removed.
**Suggestion:** Inline `structuredClone(raw || {})` at the call site, or rename the helper to something neutral like `cloneConfigForPluginDefaults()`.
**Rationale:** Loop review proposal.

### 21. 2. Replace placeholder agent API with a real implementation or remove it
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginContext()` exposes `agent.resolve()` and `agent.call()`, but they are hardcoded placeholders. That creates a misleading public plugin API surface and is inconsistent with the requirement that plugins use a workflow-neutral agent API/context.
**Suggestion:** Wire these methods to the existing generic agent resolve/call implementation, including plugin/root config inputs, or omit `agent` from the context until it is actually functional.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginContext()` exposes `agent.resolve()` and `agent.call()`, but they are hardcoded placeholders. That creates a misleading public plugin API surface and is inconsistent with the requirement that plugins use a workflow-neutral agent API/context.
**Suggestion:** Wire these methods to the existing generic agent resolve/call implementation, including plugin/root config inputs, or omit `agent` from the context until it is actually functional.
**Rationale:** Loop review proposal.

### 22. 3. Reduce repeated hook metadata construction
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `runFlowCommandHooks()` repeatedly constructs `{ pluginId: plan.pluginId, command, hook, ... }` across `hookData`, warnings, follow-ups, and failures.
**Suggestion:** Introduce a local `const hookMeta = { pluginId: plan.pluginId, command, hook };` inside the loop and reuse it when building hook result objects.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `runFlowCommandHooks()` repeatedly constructs `{ pluginId: plan.pluginId, command, hook, ... }` across `hookData`, warnings, follow-ups, and failures.
**Suggestion:** Introduce a local `const hookMeta = { pluginId: plan.pluginId, command, hook };` inside the loop and reuse it when building hook result objects.
**Rationale:** Loop review proposal.

### 23. 4. Use clearer names for hook result collections
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `hookData` is vague and later becomes `pluginHooks`, while `followUps` contains normalized hook follow-up records. The names obscure whether these are raw hook outputs, summaries, or user-facing follow-up actions.
**Suggestion:** Rename `hookData` to `hookResults` or `pluginHookResults`, and consider `hookFollowUps` for the follow-up collection to distinguish it from any main command follow-ups.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `hookData` is vague and later becomes `pluginHooks`, while `followUps` contains normalized hook follow-up records. The names obscure whether these are raw hook outputs, summaries, or user-facing follow-up actions.
**Suggestion:** Rename `hookData` to `hookResults` or `pluginHookResults`, and consider `hookFollowUps` for the follow-up collection to distinguish it from any main command follow-ups.
**Rationale:** Loop review proposal.

### 24. 2. Replace placeholder agent API with a real implementation or remove it
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginContext()` exposes `agent.resolve()` and `agent.call()`, but they are hardcoded placeholders. That creates a misleading public plugin API surface and is inconsistent with the requirement that plugins use a workflow-neutral agent API/context.
**Suggestion:** Wire these methods to the existing generic agent resolve/call implementation, including plugin/root config inputs, or omit `agent` from the context until it is actually functional.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `buildPluginContext()` exposes `agent.resolve()` and `agent.call()`, but they are hardcoded placeholders. That creates a misleading public plugin API surface and is inconsistent with the requirement that plugins use a workflow-neutral agent API/context.
**Suggestion:** Wire these methods to the existing generic agent resolve/call implementation, including plugin/root config inputs, or omit `agent` from the context until it is actually functional.
**Rationale:** Loop review proposal.

### 25. 3. Reduce repeated hook metadata construction
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `runFlowCommandHooks()` repeatedly constructs `{ pluginId: plan.pluginId, command, hook, ... }` across `hookData`, warnings, follow-ups, and failures.
**Suggestion:** Introduce a local `const hookMeta = { pluginId: plan.pluginId, command, hook };` inside the loop and reuse it when building hook result objects.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `runFlowCommandHooks()` repeatedly constructs `{ pluginId: plan.pluginId, command, hook, ... }` across `hookData`, warnings, follow-ups, and failures.
**Suggestion:** Introduce a local `const hookMeta = { pluginId: plan.pluginId, command, hook };` inside the loop and reuse it when building hook result objects.
**Rationale:** Loop review proposal.

### 26. 4. Use clearer names for hook result collections
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`
**Issue:** `hookData` is vague and later becomes `pluginHooks`, while `followUps` contains normalized hook follow-up records. The names obscure whether these are raw hook outputs, summaries, or user-facing follow-up actions.
**Suggestion:** Rename `hookData` to `hookResults` or `pluginHookResults`, and consider `hookFollowUps` for the follow-up collection to distinguish it from any main command follow-ups.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Issue:** `hookData` is vague and later becomes `pluginHooks`, while `followUps` contains normalized hook follow-up records. The names obscure whether these are raw hook outputs, summaries, or user-facing follow-up actions.
**Suggestion:** Rename `hookData` to `hookResults` or `pluginHookResults`, and consider `hookFollowUps` for the follow-up collection to distinguish it from any main command follow-ups.
**Rationale:** Loop review proposal.

### 27. I’ll check the touched code context so the review is grounded in the current implementation, especially the `ensureOfficialPackage` call shape after the workflow cleanup.The provided `cwd` doesn’t contain `src/` directly. I’ll locate the repository layout first, then read only the files named in the diff.Only temporary artifacts are under the current directory. I’m going to inspect the surrounding worktree path for the actual source checkout without modifying anything.I found the full worktree. I’ll keep the review scoped to the three files in the supplied diff, as requested.The remaining official preset enablement no longer passes a `type`, and the registry signature confirms that argument is no longer accepted. I’m checking the surrounding imports for newly dead dependencies before forming the final review.One important context detail showed up: `loadPluginRegistry` is still referenced elsewhere in `src/upgrade.js`, even though this diff removes its import. I’ll verify that exact block because that is a concrete cleanup regression within the touched file.### 1. Restore Still-Used Registry Import
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `loadPluginRegistry` was removed from the import list, but `pluginSkillSourceDirs()` still calls `loadPluginRegistry(root)`. This leaves a runtime `ReferenceError`.  
**Suggestion:** Keep the import as `import { ensureOfficialPackage, loadPluginRegistry } from "./lib/plugin-registry.js";` unless `pluginSkillSourceDirs()` is also being removed or rewritten.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `loadPluginRegistry` was removed from the import list, but `pluginSkillSourceDirs()` still calls `loadPluginRegistry(root)`. This leaves a runtime `ReferenceError`.  
**Suggestion:** Keep the import as `import { ensureOfficialPackage, loadPluginRegistry } from "./lib/plugin-registry.js";` unless `pluginSkillSourceDirs()` is also being removed or rewritten.
**Rationale:** Loop review proposal.

### 28. 2. Collapse Now-Single Nested Branch
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** After removing the workflow bootstrap block, the `if (!dryRun) { if (needsOfficialPresets()) { ... } }` structure has only one inner branch.  
**Suggestion:** Simplify to `if (!dryRun && needsOfficialPresets()) { ... }` to reduce nesting left behind by the workflow cleanup.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** After removing the workflow bootstrap block, the `if (!dryRun) { if (needsOfficialPresets()) { ... } }` structure has only one inner branch.  
**Suggestion:** Simplify to `if (!dryRun && needsOfficialPresets()) { ... }` to reduce nesting left behind by the workflow cleanup.
**Rationale:** Loop review proposal.

### 29. I’ll check the touched code context so the review is grounded in the current implementation, especially the `ensureOfficialPackage` call shape after the workflow cleanup.The provided `cwd` doesn’t contain `src/` directly. I’ll locate the repository layout first, then read only the files named in the diff.Only temporary artifacts are under the current directory. I’m going to inspect the surrounding worktree path for the actual source checkout without modifying anything.I found the full worktree. I’ll keep the review scoped to the three files in the supplied diff, as requested.The remaining official preset enablement no longer passes a `type`, and the registry signature confirms that argument is no longer accepted. I’m checking the surrounding imports for newly dead dependencies before forming the final review.One important context detail showed up: `loadPluginRegistry` is still referenced elsewhere in `src/upgrade.js`, even though this diff removes its import. I’ll verify that exact block because that is a concrete cleanup regression within the touched file.### 1. Restore Still-Used Registry Import
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `loadPluginRegistry` was removed from the import list, but `pluginSkillSourceDirs()` still calls `loadPluginRegistry(root)`. This leaves a runtime `ReferenceError`.  
**Suggestion:** Keep the import as `import { ensureOfficialPackage, loadPluginRegistry } from "./lib/plugin-registry.js";` unless `pluginSkillSourceDirs()` is also being removed or rewritten.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `loadPluginRegistry` was removed from the import list, but `pluginSkillSourceDirs()` still calls `loadPluginRegistry(root)`. This leaves a runtime `ReferenceError`.  
**Suggestion:** Keep the import as `import { ensureOfficialPackage, loadPluginRegistry } from "./lib/plugin-registry.js";` unless `pluginSkillSourceDirs()` is also being removed or rewritten.
**Rationale:** Loop review proposal.

### 30. 2. Collapse Now-Single Nested Branch
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** After removing the workflow bootstrap block, the `if (!dryRun) { if (needsOfficialPresets()) { ... } }` structure has only one inner branch.  
**Suggestion:** Simplify to `if (!dryRun && needsOfficialPresets()) { ... }` to reduce nesting left behind by the workflow cleanup.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** After removing the workflow bootstrap block, the `if (!dryRun) { if (needsOfficialPresets()) { ... } }` structure has only one inner branch.  
**Suggestion:** Simplify to `if (!dryRun && needsOfficialPresets()) { ... }` to reduce nesting left behind by the workflow cleanup.
**Rationale:** Loop review proposal.

### 31. I’ll check the touched code context so the review is grounded in the current implementation, especially the `ensureOfficialPackage` call shape after the workflow cleanup.The provided `cwd` doesn’t contain `src/` directly. I’ll locate the repository layout first, then read only the files named in the diff.Only temporary artifacts are under the current directory. I’m going to inspect the surrounding worktree path for the actual source checkout without modifying anything.I found the full worktree. I’ll keep the review scoped to the three files in the supplied diff, as requested.The remaining official preset enablement no longer passes a `type`, and the registry signature confirms that argument is no longer accepted. I’m checking the surrounding imports for newly dead dependencies before forming the final review.One important context detail showed up: `loadPluginRegistry` is still referenced elsewhere in `src/upgrade.js`, even though this diff removes its import. I’ll verify that exact block because that is a concrete cleanup regression within the touched file.### 1. Restore Still-Used Registry Import
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `loadPluginRegistry` was removed from the import list, but `pluginSkillSourceDirs()` still calls `loadPluginRegistry(root)`. This leaves a runtime `ReferenceError`.  
**Suggestion:** Keep the import as `import { ensureOfficialPackage, loadPluginRegistry } from "./lib/plugin-registry.js";` unless `pluginSkillSourceDirs()` is also being removed or rewritten.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `loadPluginRegistry` was removed from the import list, but `pluginSkillSourceDirs()` still calls `loadPluginRegistry(root)`. This leaves a runtime `ReferenceError`.  
**Suggestion:** Keep the import as `import { ensureOfficialPackage, loadPluginRegistry } from "./lib/plugin-registry.js";` unless `pluginSkillSourceDirs()` is also being removed or rewritten.
**Rationale:** Loop review proposal.

### 32. 2. Collapse Now-Single Nested Branch
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** After removing the workflow bootstrap block, the `if (!dryRun) { if (needsOfficialPresets()) { ... } }` structure has only one inner branch.  
**Suggestion:** Simplify to `if (!dryRun && needsOfficialPresets()) { ... }` to reduce nesting left behind by the workflow cleanup.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** After removing the workflow bootstrap block, the `if (!dryRun) { if (needsOfficialPresets()) { ... } }` structure has only one inner branch.  
**Suggestion:** Simplify to `if (!dryRun && needsOfficialPresets()) { ... }` to reduce nesting left behind by the workflow cleanup.
**Rationale:** Loop review proposal.

### 33. 1. Use a Neutral, Shared Sample Command ID
**Failure mode:** refactor
**File:** tests/unit/lib/agent.test.js
**Issue:** **File:** `tests/unit/lib/agent.test.js`  
**Issue:** The repeated literal `plugin.sample.publish` still carries “publish” terminology from the migrated workflow feature, and duplicating it across tests makes future fixture drift easier.  
**Suggestion:** Define a local constant such as `const SAMPLE_PLUGIN_COMMAND_ID = "plugin.sample.run";` and use it in both profile-resolution tests. This keeps the core test clearly generic and removes duplicate string literals.
**Suggestion:** **File:** `tests/unit/lib/agent.test.js`  
**Issue:** The repeated literal `plugin.sample.publish` still carries “publish” terminology from the migrated workflow feature, and duplicating it across tests makes future fixture drift easier.  
**Suggestion:** Define a local constant such as `const SAMPLE_PLUGIN_COMMAND_ID = "plugin.sample.run";` and use it in both profile-resolution tests. This keeps the core test clearly generic and removes duplicate string literals.
**Rationale:** Loop review proposal.

### 34. 1. Use a Neutral, Shared Sample Command ID
**Failure mode:** refactor
**File:** tests/unit/lib/agent.test.js
**Issue:** **File:** `tests/unit/lib/agent.test.js`  
**Issue:** The repeated literal `plugin.sample.publish` still carries “publish” terminology from the migrated workflow feature, and duplicating it across tests makes future fixture drift easier.  
**Suggestion:** Define a local constant such as `const SAMPLE_PLUGIN_COMMAND_ID = "plugin.sample.run";` and use it in both profile-resolution tests. This keeps the core test clearly generic and removes duplicate string literals.
**Suggestion:** **File:** `tests/unit/lib/agent.test.js`  
**Issue:** The repeated literal `plugin.sample.publish` still carries “publish” terminology from the migrated workflow feature, and duplicating it across tests makes future fixture drift easier.  
**Suggestion:** Define a local constant such as `const SAMPLE_PLUGIN_COMMAND_ID = "plugin.sample.run";` and use it in both profile-resolution tests. This keeps the core test clearly generic and removes duplicate string literals.
**Rationale:** Loop review proposal.

### 35. 1. Use a Neutral, Shared Sample Command ID
**Failure mode:** refactor
**File:** tests/unit/lib/agent.test.js
**Issue:** **File:** `tests/unit/lib/agent.test.js`  
**Issue:** The repeated literal `plugin.sample.publish` still carries “publish” terminology from the migrated workflow feature, and duplicating it across tests makes future fixture drift easier.  
**Suggestion:** Define a local constant such as `const SAMPLE_PLUGIN_COMMAND_ID = "plugin.sample.run";` and use it in both profile-resolution tests. This keeps the core test clearly generic and removes duplicate string literals.
**Suggestion:** **File:** `tests/unit/lib/agent.test.js`  
**Issue:** The repeated literal `plugin.sample.publish` still carries “publish” terminology from the migrated workflow feature, and duplicating it across tests makes future fixture drift easier.  
**Suggestion:** Define a local constant such as `const SAMPLE_PLUGIN_COMMAND_ID = "plugin.sample.run";` and use it in both profile-resolution tests. This keeps the core test clearly generic and removes duplicate string literals.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
