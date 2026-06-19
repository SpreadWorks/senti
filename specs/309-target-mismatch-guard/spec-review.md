# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. RunId/spec lookup is conflated with execution-context guarding
**Target:** R2, R7, Acceptance Criteria, T-1/T-2
**Issue:** Existing dispatcher loop commands such as `senti flow get next-action`, representative `senti flow run ...` commands, and `finalize-cleanup` execute against the current resolved `ctx.flowState`; they do not accept a runId or spec target. The spec also says runId status should return the requested runId even when a different context has an active flow. If the skill validates by resolving the requested runId/spec instead of comparing the explicit target to the current execution context, the guard can pass while the next dispatcher command still mutates the unrelated active flow.
**Required change:** Specify the spec/runId guard as an expectation check against the current dispatcher context, for example `--expect-spec` and `--expect-run-id` on context status, while preserving positional runId status as display-only; alternatively require every subsequent dispatcher command to execute against the selected spec/runId target.
**Why blocking:** Without this distinction, implementation and tests can satisfy target lookup behavior while leaving the same unsafe execution path open for explicit spec/runId requests.

### 2. RunId target behavior omits active worktree resolution
**Target:** R2, R5, T-1, src/lib/flow-manager.js
**Issue:** `FlowManager.resolveByRunId` currently scans active registry entries with main-root `loadReadOnly`, then preparing states. Active worktree flows commonly store `flow.json` in `.senti/worktree/feature-<spec>/...` before finalize merge, and the worktree redirect logic lives in `_loadActiveFlowState`, not in `resolveByRunId`. The spec requires runId status/guards and retained worktree/finalize behavior but does not require this runId data path to work.
**Required change:** Add acceptance that runId target status/guard resolves active worktree-mode flows through the active-flow registry/worktree path, not only main-root flow.json and preparing state files.
**Why blocking:** A normal worktree flow addressed by runId can be falsely reported as missing or left unguarded, so tests can miss a mandatory compatibility path and the skill cannot safely decide whether to continue or stop.


## Non-blocking Improvements

### 1. Normalize spec target wording
**Target:** R2, R3, T-1
**Improvement:** Clarify whether `expectedSpec` and `activeSpec` should use canonical spec IDs such as `309-target-mismatch-guard` or paths such as `specs/309-target-mismatch-guard/spec.json`.
**Why non-blocking:** The implementation can infer a sensible canonical form from existing `specIdFromPath` usage, but explicit wording would make assertions less brittle.
