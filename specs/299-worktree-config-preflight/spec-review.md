# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Preflight failure must preserve prepare-phase state
**Target:** R1/R4 and T-2
**Issue:** The spec requires halting before side effects, but the existing prepare path has prepare-phase state mutations before `git worktree add`: `flowManager.cleanStaleFlows()`, `flowManager.cleanStalePreparingFlows()`, and especially `flowManager.deletePreparingFlow(runIdArg)`. The current acceptance criteria only check absence of the worktree directory and feature branch, so an implementation could place the new preflight after these mutations and still appear compliant.
**Required change:** Explicitly require the required-file preflight to run before prepare-state cleanup/deletion, or require failure to preserve any `--run-id` preparing state; add an acceptance check for `--run-id` failure preserving the preparing flow record.
**Why blocking:** If a config preflight halt deletes the preparing run, the advertised recovery path cannot safely commit and continue with the same run id, and user-provided request/issue/auto settings captured before prepare can be lost despite no worktree or branch being created.


## Non-blocking Improvements

### 1. Define status code names
**Target:** R3/R4
**Improvement:** Consider naming the expected machine-readable status or issue-code values for missing, staged, unstaged, and untracked cases.
**Why non-blocking:** The behavior is testable with implementation-chosen codes, but fixed names would make CLI consumers and tests less coupled to ad hoc strings.
