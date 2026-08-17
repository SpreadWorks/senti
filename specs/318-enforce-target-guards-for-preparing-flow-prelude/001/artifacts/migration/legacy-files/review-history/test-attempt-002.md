# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-enforce-target-guards-for-preparing-flow-prelude/test-coverage.json`

## Blocking Findings

### 1. Missing guard-free coverage for preparing set routes
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js:92
**Issue:** R3/R6 require evidence for guard-free documented behavior for `flow set request`, `flow set note`, and `flow set auto`. The test only exercises successful guarded routes and guard-free unknown-run errors; it does not verify normal guard-free preparing updates still succeed for an existing run.
**Required change:** Add spec-local assertions that `flow set request`, `flow set note`, and `flow set auto` succeed without `--expect-*` guards against an existing preparing run and preserve the documented behavior.
**Why blocking:** The coverage artifact marks R3/R6 covered, but a required retained behavior has no corresponding spec-local executable coverage.

### 2. Missing individual mismatch coverage for set route guards
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js:103
**Issue:** R3/R6 require each guard mismatch type for `flow set request`, `flow set note`, and `flow set auto`. The test covers one mismatch type per command: run ID for request, issue for note, and spec for auto. It does not show that each set command rejects run ID, Issue, and spec mismatches before mutation.
**Required change:** Add the smallest table-driven assertions so each of `request`, `note`, and `auto` is checked against run ID, Issue, and spec mismatches, with state unchanged after rejection.
**Why blocking:** A required guard matrix is only partially covered, so regressions in a specific command/guard combination could pass the suite.

### 3. Missing successful guarded prepare spec guard coverage
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js:190
**Issue:** R4 requires matching guarded prepare to return the promoted spec and standard run ID, Issue, and spec guard behavior. The successful prepare test uses only `--expect-run-id` and `--expect-issue`; it never demonstrates a successful prepare with a matching `--expect-spec` guard. Because preparing `spec` is null before promotion, this edge is part of the guard semantics under review.
**Required change:** Add a successful guarded prepare assertion that includes the expected spec guard according to the intended API semantics, or explicitly cover that a non-null spec guard fails while preparing spec is null and separately assert the returned promoted spec from the matching run/issue guarded prepare.
**Why blocking:** The acceptance text explicitly calls out standard spec guard behavior for prepare, but the executable coverage omits the matching guarded prepare/spec case ambiguity.

### 4. Missing prepare no-worktree rejection proof for no-branch path
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js:162
**Issue:** R4/R6 require guarded prepare mismatches to fail before branch/worktree/spec creation. The test checks no `specs` directory and no `.senti/worktree` after the `--worktree` mismatch, but the guarded unknown-run prepare uses `--no-branch` and only checks `specs`; it does not prove no branch/worktree side effects for that rejection path.
**Required change:** Add a side-effect assertion after the guarded unknown-run prepare rejection that no worktree/branch artifact was created, using the repository’s expected observable for that path.
**Why blocking:** A critical side-effect prevention requirement is not evidenced for one of the required rejection classes: guarded unknown runs.


## Advisory Findings

### 1. Selection helper does not count preparing loads
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js:17
**Improvement:** Track `loadPreparingFlow` calls and requested IDs in `preparingContainer` so the R1 test proves explicit known and missing run IDs are looked up exactly as intended.
**Why non-blocking:** The current assertions still exercise the selection shape and active-flow no-fallback behavior; this would make the diagnostic evidence tighter.
