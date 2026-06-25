# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/313-resume-recovery-only/test-coverage.json`

## Blocking Findings

### 1. R2 recovery classifications are incomplete
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** The R2 test only asserts active, finalized, and stale candidates. It does not create or assert orphan worktree or branch-only candidates, even though R2 explicitly requires those classifications to be separated from normal active flows.
**Required change:** Add spec-local tests or cases that create an orphan worktree candidate and a branch-only candidate, then assert their distinct recovery states in `senti flow resume` output.
**Why blocking:** The coverage artifact marks R2 covered, but two required candidate classes have no corresponding executable coverage.

### 2. R3 does not cover candidates without execution roots
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** The R3 test blocks a candidate missing `runId`, but never covers a displayed candidate missing a usable execution root.
**Required change:** Add a recovery candidate case without a usable execution root and assert `senti flow resume --spec <specId>` rejects it as non-continuable/display-only.
**Why blocking:** R3 requires both `runId` and execution root to be present before selection; testing only one missing value leaves half of the acceptance rule uncovered.

### 3. R4 guarded continuation coverage is too narrow
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** The R4 test only checks `flow get next-action --expect-run-id` mismatch. It does not verify continuation from the selected candidate execution root, nor mismatch protection before `status` or `run` command execution.
**Required change:** Add tests that select a resume candidate, continue from its execution root with the expected `runId`, and assert mismatched `runId` returns `ACTIVE_FLOW_MISMATCH` for target-aware status and run continuation before any step work occurs.
**Why blocking:** R4 names multiple guarded continuation surfaces and requires execution-root binding; the current test covers only one command path.

### 4. R5 skill guidance is not actually tested
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** The R5 test checks CLI resume JSON guidance, but the requirement is specifically about `senti.flow-resume` skill guidance no longer presenting unqualified `/senti.flow` re-entry and instead showing guarded continuation or safe-stop instructions.
**Required change:** Add a spec-local test that inspects or exercises the generated `senti.flow-resume` guidance and asserts unqualified `/senti.flow` re-entry is absent while execution-root plus `runId` guarded commands or safe-stop guidance are present.
**Why blocking:** The executable tests do not target the public surface named by R5, so the coverage artifact overstates coverage.

### 5. R6 migration parity surfaces are missing coverage
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** R6 requires parity coverage for resume discovery, resume selection, normal active-flow status, target-aware status, next-action, run continuation, resolve-context, active-flow registry, and skill guidance. The test file does not cover target-aware status, run continuation, resolve-context, or skill guidance.
**Required change:** Add tests for the missing retained public surfaces: target-aware status, run continuation, resolve-context, and skill guidance.
**Why blocking:** R6 is a broad parity requirement, and several named surfaces have no corresponding spec-local test coverage.

### 6. R7 worktree test misses normal-resolution separation
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** The R7 test uses a real git worktree and verifies the candidate is selectable from its execution root, but it does not verify separation from normal active-flow resolution.
**Required change:** Extend the worktree recovery test to assert normal active-flow resolution from the main root does not treat the worktree recovery candidate as the active flow.
**Why blocking:** R7 explicitly requires both real git-worktree discovery and separation from normal active-flow resolution; only discovery/selection is covered.

### 7. R8 traversal bounds are not covered
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** The R8 test verifies the 200 candidate cap and truncation flag, but does not verify traversal is limited to local specs, registered git worktrees, and `feature/*` branches.
**Required change:** Add tests that create in-scope and out-of-scope discovery sources, including a non-`feature/*` branch, and assert recovery discovery excludes sources outside the allowed traversal bounds.
**Why blocking:** R8 has two parts: candidate cap and traversal scope. The traversal-scope requirement currently has no executable coverage.


## Advisory Findings

No advisory findings.