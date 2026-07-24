# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/329-review-convergence-edges/test-coverage.json`

## Blocking Findings

### 1. R1 identity coverage omits advisory and failure-mode inputs
**Target:** specs/329-review-convergence-edges/tests/test-review-finding-identity.test.js
**Issue:** R1 requires the canonical findingId tuple to include finding kind or failureMode and issue or improvement. The tests only parse blocking findings with title, target, and issue; they do not verify advisory findings use improvement text, nor that failureKind/failureMode participates in the identity.
**Required change:** Add spec-local identity assertions for advisory findings and for findings whose canonical kind/failure mode differs while target/title/text are otherwise the same.
**Why blocking:** The coverage artifact marks R1 covered, but the actual tests do not cover required tuple fields for advisory/improvement or failure-mode identity, so an implementation could ignore those fields and still pass.

### 2. R2 duplicate and same-target coverage omits improvement variants
**Target:** specs/329-review-convergence-edges/tests/test-review-finding-identity.test.js
**Issue:** R2 requires same-target tuples with different title or issue/improvement to produce different findingIds and only fully identical tuples to be rejected as duplicates. The tests only exercise blocking issue text and exact duplicate blocking findings, not advisory improvement text.
**Required change:** Add spec-local tests showing advisory findings with changed improvement text get distinct findingIds, reordered/reparsed advisory identities stay stable, and exact advisory duplicates are rejected.
**Why blocking:** An implementation could base advisory finding identity only on target/title or treat advisory duplicates incorrectly while all current tests still pass.

### 3. R4 lacks static coverage for expected revision CAS semantics
**Target:** specs/329-review-convergence-edges/tests/changed-tree-recovery.test.js
**Issue:** R4 requires changed-tree recovery to save the tooling reset and recovery grant in the same flow state CAS mutation when the expected revision matches. The current public recovery test checks one grant and idempotency after success, but it does not verify expected revision matching or that the grant and reset are committed atomically by one CAS mutation.
**Required change:** Add a spec-local test that observes the flow-state save/CAS call for changed-tree recovery and asserts one expected-revision guarded mutation contains both the toolingAttempts 1->0 reset and one recovery grant.
**Why blocking:** Without this, recovery could persist the reset and grant in separate writes or without the expected revision guard and still satisfy the current tests.

### 4. R5 canonical exhaustion coverage misses impl flow scope with residual currentTaskId
**Target:** specs/329-review-convergence-edges/tests/review-completion-scope.test.js
**Issue:** R5 requires flow-level test/impl review canonical exhaustion to write taskId:null completion records and flow finding handoffs even when currentTaskId is nonnull. The exhaustion transition test only covers phase test on an ad hoc state without currentTaskId; impl coverage is limited to post-hook tooling failure, not canonical exhaustion with handoff findings.
**Required change:** Add a spec-local canonical exhaustion transition test for phase impl with currentTaskId set, asserting taskId:null, one flow handoff per identity, and duplicate evidence does not add another record.
**Why blocking:** An implementation could scope impl canonical exhaustion to the residual task cursor or skip flow handoff creation while all current tests still pass.

### 5. R6 task-level review coverage does not guard acceptance handoff
**Target:** specs/329-review-convergence-edges/tests/review-completion-scope.test.js
**Issue:** R6 requires task-level review to leave acceptance handoff unchanged. The test checks currentTaskId, steps, and absence of flow-findings.json, but it does not set or assert any acceptance handoff state/artifact.
**Required change:** Add a spec-local task-level review test with preexisting acceptance handoff state or artifact and assert it is unchanged after the task-level completion record is saved.
**Why blocking:** A task-level review implementation could accidentally mutate acceptance handoff state and still pass the current tests.


## Advisory Findings

No advisory findings.