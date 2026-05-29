# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Post-commit dirty detection cannot prevent committing staged other-flow metadata
**Target:** Data Flow / R2 / R3 / T-2
**Issue:** The spec orders cleanup as committing the target specs/<target>/flow.json before inspecting main-repository dirty specs/*/flow.json paths. In the current implementation, src/flow/lib/run-finalize-cleanup.js stages the target path and then runs plain `git commit -m ...`; Git will include any other paths already staged in the index, including another specs/<id>/flow.json, before the proposed post-cleanup warning scan can see them.
**Required change:** Specify the smallest required pre-commit safeguard for non-target specs/*/flow.json entries already staged or otherwise dirty in the index, and add acceptance/test coverage that a staged other-flow flow.json is not included in the finalized flow's commit.
**Why blocking:** Without this correction, an implementation that follows the spec literally can pass the ` M specs/<other>/flow.json` warning test while still committing a pre-staged other active flow's flow.json in the finalized flow's `chore: finalize <spec>` commit, directly violating R3 and the ownership boundary.

### 2. R1 does not pin the actual cross-flow mutation integration path
**Target:** R1 / Decisions / src/flow/lib/flow-context.js / src/flow/registry.js
**Issue:** The spec's VERIFY decision says flow context switches to the main repo flow.json for the same spec after merge, but the current code returns `baseFlowManager.forRoot(mainRoot)` without binding the selected spec id. Subsequent hook calls such as `ctx.flowManager.incrementMetric(...)` can call `load()` with no spec id, and in a main repo with multiple active flows that resolves by the main repo's current branch, not necessarily the worktree-selected spec.
**Required change:** Revise R1 or the Decisions section to require coverage of the post-merge worktree authority-switch path where the main repo is on another active flow branch, and state that the selected spec id must remain bound or explicitly routed for post-hook metadata mutations.
**Why blocking:** If the spec keeps treating this as already verified behavior, implementers can test only direct FlowManager writes or a single-current-branch scenario and miss the concrete concurrent-flow bug: a command run from the worktree after merge can append metrics to another active flow's flow.json.


## Non-blocking Improvements

### 1. Name the warning code
**Target:** R2 / Acceptance Criteria
**Improvement:** Consider specifying the machine-readable warning code expected for dirty other-flow flow.json paths, instead of leaving it to implementation choice.
**Why non-blocking:** Envelope warnings already support arbitrary codes and tests can assert path/message visibility, so implementation remains possible without a preselected code.
