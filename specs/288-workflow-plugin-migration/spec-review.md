# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Prepare hook has no live flow context
**Target:** R4 / AC5 / src/flow/registry.js prepare.post
**Issue:** The spec requires the workflow plugin prepare.post hook to replace issue-start behavior and receive the linked issue, but the current flow dispatcher builds the lifecycle context before prepare creates flow.json. applyLifecycleActionsFromRegistry reads ctx.flowState.plugins.flowCommandHooks and ctx.flowState.issue from that pre-prepare context, so prepare.post has no hook snapshot or issue data to run with.
**Required change:** Add a spec requirement that the generic core prepare.post lifecycle re-resolves or passes the newly created flow state after RunPrepareSpecCommand writes flow.json, including the hook snapshot, spec path, runId, and linked issue.
**Why blocking:** Without this, the issue-start replacement hook is never invoked for a newly prepared flow and linked issues cannot be moved or smoke-tested through the required plugin hook path.

### 2. Finalize hook has no successful-output or artifact path
**Target:** R4 / Design Principles / src/lib/plugin-registry.js runFlowCommandHooks and src/flow/lib/run-finalize-cleanup.js
**Issue:** The spec requires finalize-cleanup.post to read issue-log evidence, write workflow plugin artifacts, and return follow-up text or data for core to surface. Current runFlowCommandHooks ignores successful hook return data and only records failures, while finalize-cleanup post runs after teardown commits flow.json, clears active flow state, and may remove the worktree that contains the spec artifact path.
**Required change:** Specify the generic core lifecycle change for finalize-cleanup: either run the plugin cleanup integration while the spec/issue-log/artifact path is still available or pass a durable main-repo artifact path, and aggregate successful hook followUps/data into the finalize-cleanup envelope without interpreting workflow-specific schemas.
**Why blocking:** The required candidate extraction and follow-up behavior has no observable data path and can fail after worktree deletion; tests cannot reliably assert plugin artifacts or returned follow-ups.

### 3. Plugin AI fallback lacks a public integration point
**Target:** R5 / plugin command and hook context
**Issue:** Workflow publish and ideas AI calls must resolve plugin.config.workflow.agent.<name> and otherwise use the generic default agent, but buildPluginApi/buildPluginContext currently expose only Envelope, FlowCommandHook, plugin config, artifacts, flow, and result. External plugins have no public agent resolver/caller or generic lang/config access without importing core internals.
**Required change:** Add a spec requirement for a workflow-neutral plugin API/context extension that exposes generic agent resolve/call capability and any needed root config values such as lang to plugin commands and hooks.
**Why blocking:** The plugin cannot preserve publish translation or ideas AI refinement while remaining external and core-neutral; implementation would either depend on unstable core internal imports or omit required AI behavior.


## Non-blocking Improvements

### 1. Clarify plugin install pinning
**Target:** R1 / AC13
**Improvement:** Mention that the in-flow workflow plugin workspace changes should be committed and pinned before install/sync verification, because the current plugin installer archives a clean git commit and rejects dirty local plugin sources.
**Why non-blocking:** T-1 already asks to record a source commit or branch and the install command will enforce this, so implementation can infer it.

### 2. Name agent override keys
**Target:** R5
**Improvement:** Clarify the exact plugin.config.workflow.agent key names for publish, classification, similarity, and composition overrides.
**Why non-blocking:** The required call sites are named, so an implementation can choose stable keys and test them, but explicit names would reduce ambiguity.
