# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/319-guarded-plan-rewind/test-coverage.json`

## Blocking Findings

### 1. Missing coverage for required rejection cases
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R7
**Issue:** R7 requires tests for run, Issue, and spec identity mismatches, missing flow-level guards, task-scoped stages, every finalize leaf, merge outcome, squash baseline, finalized timestamp, evidence traversal escape, symlink, path length over 1000, file count over 500, aggregate bytes over 268435456, 101st audit record, candidate invariant failure, and byte-identical rejection behavior. The test only covers two source stages, one squash baseline shape, a 501-character reason, and maxFiles: 0.
**Required change:** Add executable spec-local tests for each required R7 rejection path and assert no mutation of flow state, source/artifacts where applicable, and audit history on rejection.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, and the coverage artifact marks R7 covered despite missing required cases.

### 2. Missing coverage for exact retry reset semantics
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R3
**Issue:** R3 requires reset markers for every flow-level review and gate retry phase that can be revisited, removal of active retry-recovery grants from eligibility while retaining the prior value in audit, and configured retry maxima remaining unchanged so renewed retry counts start at zero without extra attempts. The test only checks that appended metrics have reset === true and retryRecovery becomes null; it does not verify the complete phase set, renewed counts, or unchanged maxima behavior.
**Required change:** Assert the complete retry reset phase set and verify retry maxima/configuration are unchanged while renewed retry counts resolve to zero without extra attempts.
**Why blocking:** A required behavioral guarantee has no concrete regression test.

### 3. Missing coverage for evidence eligibility categories and renewed route
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R4
**Issue:** R4 requires user approval plus planning, test, implementation, review, gate, retro, acceptance, finding, override, and final-regression evidence at or before the rewind timestamp to be ineligible, and evidence created afterward through the normal route to be eligible. The test only calls a timestamp helper with three timestamps and checks approval status pending.
**Required change:** Add tests that exercise each required evidence/approval category as stale before or at the rewind timestamp and eligible only when recreated afterward through the normal route.
**Why blocking:** Critical evidence invalidation behavior lacks coverage for most required categories and the renewed normal-route eligibility path.

### 4. Missing coverage for artifact inventory limits and chunk size
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R5
**Issue:** R5 requires inventory limits of at most 500 regular files, 268435456 aggregate bytes, spec-relative paths no longer than 1000 characters, hash chunks no larger than 65536 bytes, and preservation of product source files and artifacts. The test captures one file and excludes flow.json, but does not verify the 500-file boundary, byte aggregate boundary, path length boundary, chunk size, artifact preservation beyond one file, or product source byte preservation.
**Required change:** Add boundary tests for 500 files, 268435456 bytes, 1000-character paths, 65536-byte hash chunks, and byte preservation of product source and prior artifact files.
**Why blocking:** Required resource limits and preservation guarantees have no corresponding executable test coverage.

### 5. Missing coverage for audit cap and required audit fields
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R6
**Issue:** R6 requires at most 100 durable audit records, rejection of the 101st rewind before mutation, and audit fields including invalidated approval confirmation, invalidated retry-recovery value, retry reset phases, and up to 500 invalidated evidence entries. The test checks append behavior and a few fields, but not the 100-record cap, 101st rejection, approval confirmation, retry recovery value, retry reset phases, or evidence truncation/cap.
**Required change:** Add tests for all required audit fields, evidence cap behavior, immutable prior records, and 101st rewind rejection before mutation.
**Why blocking:** A required audit durability and limit guarantee lacks coverage.

### 6. R8 self-check does not exercise production behavior
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R8
**Issue:** The R8 test builds a local array of test name strings and asserts its own length and prefixes. It would pass even if production code omitted the required end-to-end fixture, route parity, bounds, reset, freshness, audit, and implementation verification behavior.
**Required change:** Replace the self-referential name-list assertions with executable tests that exercise the required shared/spec-local coverage, including the impl-gate end-to-end path through clarification, renewed review/gate/approval, and required implementation verification.
**Why blocking:** This is a static anti-pattern that passes without exercising production behavior while claiming broad acceptance coverage.

### 7. Missing coverage for unchanged pre-implementation and task-level reopen routes
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R1/R8
**Issue:** R1 and R8 require existing pre-implementation and task-level success and failure reopen routes to retain current prerequisites, results, and issue-log behavior. The tests only inspect command options/help and do not execute or assert those existing routes.
**Required change:** Add regression tests for representative pre-implementation and task-level reopen-draft success and failure routes, including prerequisites, results, and issue-log behavior.
**Why blocking:** A required non-regression surface has no corresponding executable coverage.

### 8. Missing next-action agreement validation coverage
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R2
**Issue:** R2 requires validation before save that exactly one in-progress leaf exists across parent and task scopes and next-action resolves that same draft leaf. The test only inspects the transformed step statuses from applyPlanRewind and does not exercise next-action resolution or cross-scope invariant failure before save.
**Required change:** Add tests that invoke the relevant next-action/validation path and assert it resolves the same draft leaf, plus a candidate invariant failure case that is rejected before save.
**Why blocking:** The key candidate validation contract is untested.


## Advisory Findings

No advisory findings.