# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. runtime-log retrieval can select its own just-opened block
**Target:** R1, R8, R9, T-3
**Issue:** The spec requires automatic logging for flow get commands and also adds `sdd-forge flow get runtime-log`, whose default selection is the latest block. In the existing dispatcher model, runtime logging opens before command execution, so `flow get runtime-log` would append a new latest block before it tries to select the latest block.
**Required change:** Specify that `flow get runtime-log` is exempt from automatic runtime logging, or that it selects from a pre-open snapshot / latest non-runtime-log block.
**Why blocking:** Without this correction, the default retrieval command will return its own empty or partial retrieval block instead of the failed command block, making the core diagnostic workflow untestable and incorrect.

### 2. no-flow logs have no retrieval contract
**Target:** R2, R8, R9, Goal
**Issue:** The spec sends commands with no active flow to `.tmp/logs/no-flow.log`, but `flow get runtime-log` is defined as selecting the latest block for the active flow by default and has no selector for the no-flow log. `flow prepare`, `flow resume`, and preparing-mode commands can fail before an active flow exists.
**Required change:** Define how `flow get runtime-log` selects `.tmp/logs/no-flow.log` when no active flow exists, or add an explicit selector for no-flow logs.
**Why blocking:** Failures before flow.json exists cannot be diagnosed through the promised replacement command, so tests for prepare/pre-active failure logging have no observable retrieval path.

### 3. finalize-cleanup metadata timing is unresolved
**Target:** R6, Clarifications: step-associated commands, T-2
**Issue:** The spec includes `finalize-*` commands as step-associated metadata targets. Existing `flow run finalize-cleanup` updates and commits `flow.json` inside the command body, then clears active state and may remove the worktree before dispatcher post-processing has the final `endedAt` and `exitCode`. A generic dispatcher/registry post hook cannot durably add final runtimeLog metadata afterward without leaving uncommitted state or losing the target file.
**Required change:** Add a finalize-cleanup-specific metadata persistence contract, or explicitly exclude finalize-cleanup from step runtimeLog metadata persistence.
**Why blocking:** The required metadata cannot be safely persisted and committed for finalize-cleanup under the existing command lifecycle, so implementation would either miss required metadata, dirty the finalized repository, or lose the data during cleanup.

### 4. report show failure bypasses dispatcher finalization
**Target:** R1, R4, src/flow/lib/run-report-show.js
**Issue:** `flow report show` currently catches errors, writes directly to `process.stderr`, and calls `process.exit(1)`. That terminates before the dispatcher can close a runtime log block with `endedAt` and `exitCode`. The spec notes raw stdout for report show but omits this existing failure path.
**Required change:** Specify that `flow report show` failures must return or throw through the dispatcher rather than calling `process.exit`, so runtime log finalization can run.
**Why blocking:** Missing-pointer or missing-report failures would produce an unclosed block with no exitCode, contradicting the required failure logging behavior and preventing reliable failure-path tests.


## Non-blocking Improvements

### 1. define stable block markers
**Target:** R4, T-3
**Improvement:** Clarify the exact start/end record syntax or parser-visible marker names used to identify bounded blocks in the append log.
**Why non-blocking:** The implementation can choose a format, but spelling it out would make retrieval parsing and search-based tests less brittle.

### 2. clarify agent work dir interaction
**Target:** Constraints, T-4
**Improvement:** State whether `--agent-work-dir` continues to affect only agent subprocess workspace paths while automatic runtime logs always use root `.tmp/logs`.
**Why non-blocking:** The `.tmp/logs` constraint is already clear enough to implement, but this would reduce confusion because existing flow run options include `--agent-work-dir` and current logs are under `agentWorkDir/logs`.
