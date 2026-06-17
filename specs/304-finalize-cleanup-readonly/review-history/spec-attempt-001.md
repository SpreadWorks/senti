# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Post-command runtime/metric writes are not assigned an owner or commit boundary
**Target:** R1/R2 and Data Flow
**Issue:** The spec requires runtime-derived data and metrics to avoid the target worktree and preserve runtime/metrics persistence, but existing code writes runtime log blocks and step runtimeLog metadata from the dispatcher after the finalize-cleanup command returns. Existing agent metrics also append through FlowStore outside run-finalize-cleanup.js. The spec does not define whether those post-command writes must be included in the final flow.json commit, written to a durable sidecar, or allowed as main-repo uncommitted changes.
**Required change:** Define the required owner and transaction boundary for dispatcher/agent cleanup-time runtime log metadata and metrics after finalize-cleanup starts, including whether they are committed with the final flow.json snapshot or stored in a durable non-worktree location outside the final commit.
**Why blocking:** Without this, an implementation can satisfy the command-local relocation while still recreating the removed worktree path, dirtying main repo flow.json after the final commit, or dropping runtime/metric data; tests cannot determine which outcome is correct.


## Non-blocking Improvements

### 1. Name dispatcher/runtime-log as related implementation targets
**Target:** Overview / Modules
**Improvement:** Add src/lib/dispatcher.js and src/lib/runtime-log.js to the module overview because finalize-cleanup runtime logging is opened and closed by the dispatcher rather than run-finalize-cleanup.js alone.
**Why non-blocking:** R1 already covers runtime-derived writes broadly, so implementation can infer this from codebase context, but naming the files would reduce missed integration risk.

### 2. Make plugin artifact persistence expectation explicit
**Target:** Owner mapping / Acceptance Criteria
**Improvement:** Clarify whether relocated plugin artifacts should be committed under specs/<spec>/plugin-artifacts, stored under .senti/agent-work, or only surfaced through the plugin lifecycle envelope.
**Why non-blocking:** The spec already prohibits target-worktree plugin writes and requires plugin hook output to remain observable; the exact durable location can be chosen during implementation without changing public behavior.
