# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/309-target-mismatch-guard/test-coverage.json`

## Blocking Findings

### 1. Missing executable coverage for repair command guard
**Target:** specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js
**Issue:** R1 requires a mismatched explicit Issue target to prevent repair command execution, but the executable dispatcher-path test covers next-action, start-task, reopen-draft, and finalize-cleanup only. The skill text test merely checks that the word "repair" appears in guidance and would pass even if the production repair command still executed against another active flow.
**Required change:** Add a spec-local executable test case for the actual repair command path with --expect-issue mismatch, asserting ACTIVE_FLOW_MISMATCH and no active-flow mutation.
**Why blocking:** This leaves a named acceptance requirement path without corresponding regression coverage, so implementation could miss the repair guard while tests still pass.

### 2. R5 retained behavior coverage is incomplete
**Target:** specs/309-target-mismatch-guard/tests/target-retained-behavior.test.js
**Issue:** R5 requires retained behavior for current-context status, runId display status, active worktree runId resolution, next-action, repair, run commands, finalize leaves, autoApprove shortcut, and finalize manual recovery exceptions. The test file only covers active worktree-mode runId status resolution.
**Required change:** Add spec-local retained-behavior tests for the remaining R5 behaviors, at minimum exercising matched current-context status, positional runId display status, matched next-action, matched repair/run command paths, finalize leaves, autoApprove shortcut, and finalize manual recovery exception behavior.
**Why blocking:** The requirement-to-test artifact marks R5 covered, but the actual test file covers only one subcase. Regressions in the other retained behaviors could pass unnoticed.

### 3. R6/R7 guidance tests are too weak to prove target-aware status checks
**Target:** specs/309-target-mismatch-guard/tests/skill-placement.test.js
**Issue:** The guidance tests assert only scattered token presence and relative placement of ACTIVE_FLOW_MISMATCH. They do not verify that user-named Issue, spec, or runId targets require target-aware status checks before dispatcher loop entry, so the tests could pass with unrelated mentions of --expect-issue, --expect-spec, --expect-run-id, and ACTIVE_FLOW_MISMATCH.
**Required change:** Strengthen the static guidance test to assert a coherent entry guidance block that ties each explicit target type to the corresponding status guard before dispatcher entry and states that mismatch stops before dispatcher commands.
**Why blocking:** R6 is a documentation/skill-guidance requirement; if the static test can pass on unrelated keyword mentions, it does not exercise the required production guidance behavior.


## Advisory Findings

No advisory findings.