# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-explicit-task-render-context/test-coverage.json`

## Blocking Findings

### 1. R2 pre-allocation contract is not exercised
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:167
**Issue:** The R2 test only asserts that 201 tasks are rejected. It does not verify the required ordering that TaskCollection rejects the over-200 collection before reading or constructing per-task TaskId/lookup state.
**Required change:** Add a spec-local R2 assertion using observable task objects/proxies or an equivalent hook so the 201-task rejection is proven to occur before any per-task id/parent validation or lookup allocation work.
**Why blocking:** R2 explicitly requires rejection before per-task state allocation, and the current coverage would pass for an implementation that validates or allocates all 201 entries before throwing.

### 2. R2/R3 linear-complexity constraints lack regression coverage
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Issue:** The tests do not exercise the required two linear passes/O(n) auxiliary behavior for TaskCollection or the no recursive/pairwise collection scan requirement for render planning. The current assertions would pass with nested scans on the 200-task maximum.
**Required change:** Add bounded instrumentation that counts task/id/parent accesses during TaskCollection construction and render-plan construction at representative sizes, failing on superlinear or repeated pairwise access patterns.
**Why blocking:** The acceptance requirements include algorithmic constraints intended to prevent unsafe scaling/path behavior, but no current test would catch a pairwise implementation.

### 3. TaskId UNC-style rejection is not directly covered
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:135
**Issue:** R1 requires both the schema and TaskId constructor to reject UNC-style inputs. The schema invalid cases include `\\server\share`, but the TaskId invalid constructor cases do not.
**Required change:** Add `\\server\share` to the TaskId constructor rejection cases.
**Why blocking:** The coverage artifact marks R1 covered for both schema and TaskId, but one explicitly named invalid input class is only tested against the schema.

### 4. renderSpecView rejection preservation is under-covered
**Target:** specs/318-explicit-task-render-context/tests/render-contract.test.js:585
**Issue:** R5 requires renderSpecView rejections from R1-R4 validation to leave generated files and task directories unchanged, but the internal-view rejection test only covers duplicate IDs. Invalid IDs, unknown parents, and over-limit collections are not exercised through renderSpecView with before/after snapshots.
**Required change:** Extend the internal renderSpecView rejection coverage to include invalid ID, unknown parent, and over-200 task fixtures with byte-for-byte snapshots of existing spec/task/orphan files and task directory entries.
**Why blocking:** R5 names renderSpecView separately from the CLI, and the current tests would pass if renderSpecView only preserved files for duplicate IDs while mutating on other invalid collection classes.


## Advisory Findings

No advisory findings.