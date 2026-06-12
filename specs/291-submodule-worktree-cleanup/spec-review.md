# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Submodule halt envelope contract is undefined
**Target:** Scope / R4 / R7 / Acceptance Criteria
**Issue:** The spec requires a submodule-cleanup-specific envelope with cause-specific recovery guidance, but the existing codebase exposes failure behavior through `Envelope.fail` machine-readable error codes and optional `data`. The spec does not define the new error code or codes, nor the minimum data fields/messages needed to distinguish dirty root, dirty submodule, and status-inspection failure cases from the existing `WORKTREE_REMOVE_FAILED` path.
**Required change:** Specify the minimal public envelope contract for submodule cleanup halt cases: error code(s), required recovery/preservation information, bounded dirty path fields, and how git status errors are surfaced.
**Why blocking:** Without a stable envelope contract, implementation and tests cannot prove the new submodule halt behavior is distinct from the existing generic remove failure, and downstream callers cannot reliably act on the cause-specific recovery state.

### 2. Force retry failure path is omitted
**Target:** R3 / Data Flow / Acceptance Criteria
**Issue:** The spec defines what happens when the clean-confirmed `git worktree remove --force <path>` retry succeeds, but not what must happen if that retry fails. In the current `runTeardown` flow, worktree removal failure is a handled public failure point before branch deletion; the force retry adds another removal failure point that needs an explicit outcome.
**Required change:** Add a spec-level requirement or acceptance criterion for `git worktree remove --force` retry failure, including whether it uses a new or existing envelope code, that the git error is reported, and that branch deletion must not proceed unless worktree removal succeeded.
**Why blocking:** If left unspecified, implementations may diverge on whether to delete the feature branch, reuse `WORKTREE_REMOVE_FAILED`, or return a submodule-specific failure, making the destructive cleanup path unsafe and untestable.


## Non-blocking Improvements

### 1. Clarify initialized submodule discovery
**Target:** R2 / R7
**Improvement:** Clarify whether dirty inspection must recurse into nested initialized submodules and what observable path granularity is expected in diagnostics, such as only the submodule path or individual dirty files within each submodule.
**Why non-blocking:** The current requirements are still implementable for the top-level initialized submodule cases in the acceptance criteria, but this would reduce ambiguity for richer diagnostics and future nested-submodule coverage.
