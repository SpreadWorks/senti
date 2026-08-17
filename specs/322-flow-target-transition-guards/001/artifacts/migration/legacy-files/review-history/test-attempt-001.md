# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/322-flow-target-transition-guards/test-coverage.json`

## Blocking Findings

### 1. R1 lacks preparing and bound-target selector coverage
**Target:** specs/322-flow-target-transition-guards/tests/target-resolution.test.js
**Issue:** The R1 test exercises explicit selector AND behavior only against active flows created with addActiveFlow. It does not cover preparing targets or bound worktree targets, and does not prove no foreign preparing/bound candidate can be selected.
**Required change:** Add spec-local executable coverage for AND/0/1/2+ resolution across preparing and bound worktree target sources, including bound authority mismatch behavior.
**Why blocking:** R1 explicitly requires selectors to be combined across active, preparing, and bound worktree targets; the coverage artifact marks R1 covered but the test file omits two required target classes.

### 2. R2 no-mutation coverage is incomplete
**Target:** specs/322-flow-target-transition-guards/tests/target-resolution.test.js
**Issue:** The R2 dispatcher test checks hooks, command invocation, metadata, and one runtime-log path, but it does not snapshot and compare active/preparing registries, flow/preparing state, flow.json bytes, timestamps, artifacts, existing .tmp runtime-log bytes, step runtimeLog metadata, or retry counters.
**Required change:** Add a no-write mismatch test with real persisted active/preparing/flow state and existing runtime-log/artifact bytes, then assert byte-identical state before and after the typed failure.
**Why blocking:** R2 is a critical no-side-effect requirement before command execution; current tests could pass while resolution failure still mutates persisted flow or runtime state.

### 3. R4 caller enforcement is not covered
**Target:** specs/322-flow-target-transition-guards/tests/step-transition-policy.test.js
**Issue:** The R4 test validates constructor existence and a few constructor invariants, but it does not verify lifecycle callers accept only definition-produced actions or recovery callers use only dedicated recovery paths.
**Required change:** Add executable tests that exercise lifecycle command/caller paths with definition-produced versus forged actions, and recovery entrypoints versus normal set-step paths.
**Why blocking:** R4 requires both OOP constructor invariants and caller-path enforcement; constructor-only tests could pass while production callers still bypass the transition policy.

### 4. R5 exactly-once side effects and terminal retry rejection are not covered
**Target:** specs/322-flow-target-transition-guards/tests/step-transition-policy.test.js
**Issue:** The R5 test only asserts SetStep passes one NormalStepTransition to updateStepStatus and mutates two statuses in a fake manager. It does not cover FlowStore atomic persistence, post-commit logger/artifact side effects, or rejection of retrying an already-terminal transition without duplicate promotion/runtime-log/retry mutation.
**Required change:** Add tests against the real FlowStore/update path that verify one atomic write, post-commit side effects exactly once, and already-terminal retry rejection with no duplicate promotion, artifact, runtime-log, or retry-counter mutation.
**Why blocking:** R5 centers on atomic persistence and exactly-once side effects; the current fake-manager test can pass without exercising the required production behavior.

### 5. R6 command-level prevalidation no-write path is undercovered
**Target:** specs/322-flow-target-transition-guards/tests/next-action-planning.test.js
**Issue:** The R6 tests validate an invalid rule via GetNextActionCommand and constructor validation on NextActionPromotionPlan, but they do not exercise command-level no-write behavior for invalid output schema, instruction, target identity, task scope, or maxAttempts > 10000.
**Required change:** Add command-level tests for each required invalid executable input, especially maxAttempts 10001, asserting the same no-write/no-runtime-log/no-artifact/no-retry mutation path.
**Why blocking:** R6 requires GetNextActionCommand to validate these inputs before any mutation; constructor-only checks do not prove the command builds and enforces the read-only plan before writing.

### 6. R8 migration parity coverage is materially incomplete
**Target:** specs/322-flow-target-transition-guards/tests/target-resolution.test.js
**Issue:** The R8 test only checks selector flags and set-step positional arguments. It does not cover exact-unique CLI/API success, definition-approved lifecycle/recovery, exactly-once artifacts/side effects under mapped owners, removal of first-candidate selection, removal of selector OR/fallback, removal of normal non-current/out-of-order update, removal of pre-validation promotion, absence of legacy fallback, or stale caller re-resolution contracts.
**Required change:** Add focused parity tests for the retained and intentionally removed behaviors listed in R8, including both CLI and direct-module surfaces where applicable.
**Why blocking:** The coverage artifact marks R8 covered, but the actual test covers only a small registry subset and misses most acceptance-critical migration contracts.

### 7. R9 required matrix coverage is incomplete
**Target:** specs/322-flow-target-transition-guards/tests/*.test.js
**Issue:** The spec-local suite has headers, but does not cover the full R9 matrix: public CLI and direct-module matrices for AND/0/1/2+ targets, bound mismatch, no-mutation runtime-log failure, lifecycle/recovery transitions, invalid action inputs, concurrent revision drift with caller re-resolution, exact success/retry, and unchanged config/help/registered steps.
**Required change:** Add the missing CLI/direct-module matrix cases required by R9, or narrow the coverage artifact so it no longer claims full R9 coverage.
**Why blocking:** R9 is itself an acceptance requirement for test coverage breadth; current tests leave required matrix areas untested while the artifact reports covered.


## Advisory Findings

No advisory findings.