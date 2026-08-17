# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/329-review-convergence-edges/test-coverage.json`

## Blocking Findings

### 1. R4 recovery grant persistence is not covered
**Target:** specs/329-review-convergence-edges/tests/changed-tree-recovery.test.js
**Issue:** R4 requires changed-tree recovery to save both the toolingAttempts 1->0 reset and one recovery grant in the same flow state CAS mutation. The tests assert the record reset and preservation fields, but never assert that retryRecovery/recovery grant state is written exactly once or coupled to the same mutation.
**Required change:** Add a spec-local assertion that a successful changed-tree recovery writes exactly one recovery grant entry together with the toolingAttempts reset, and that a repeated recovery does not add another grant.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for the recovery grant persistence half of the atomic mutation.

### 2. R5 flow handoff and idempotence are not covered
**Target:** specs/329-review-convergence-edges/tests/review-completion-scope.test.js
**Issue:** R5 requires canonical exhaustion for flow-level test/impl review to save taskId:null completion records and flow finding handoff once per identity, with no additional records when the same evidence is reprocessed. The tests only exercise post-hook tooling failure persistence and taskId:null scope; they do not cover flow finding handoff creation or same-evidence idempotence.
**Required change:** Add spec-local tests for flow-level canonical exhaustion that assert one flow finding handoff per identity and no duplicate completion record or handoff when the same evidence is processed again.
**Why blocking:** A must requirement has only partial coverage, leaving critical convergence/idempotence behavior untested.

### 3. R7 bucket and protected-file invariants are not covered
**Target:** specs/329-review-convergence-edges/tests/changed-tree-recovery.test.js
**Issue:** R7 includes PASS/ADVISORY/REJECTED bucket invariants, same-tree/evidence duplicate rejection, protected acceptance files, semantic maxAttempts, and toolingMaxAttempts=1. The current R7 test only checks recovery preserves toolingMaxAttempts, semanticMaxAttempts, and prior provenance; it does not cover the bucket invariants, duplicate rejection, or protected acceptance files.
**Required change:** Add spec-local coverage for the untested R7 invariants, or split the requirement coverage artifact so only the actually covered R7 clauses are marked covered.
**Why blocking:** The requirement coverage artifact marks R7 covered while significant required behavior has no corresponding tests.


## Advisory Findings

No advisory findings.