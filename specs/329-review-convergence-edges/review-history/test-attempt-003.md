# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/329-review-convergence-edges/test-coverage.json`

## Blocking Findings

### 1. R1 canonical tuple fields are under-specified by tests
**Target:** specs/329-review-convergence-edges/tests/test-review-finding-identity.test.js
**Issue:** R1 requires findingId to be the SHA-256 of a canonical tuple including normalized target, finding kind or failureMode, title, and issue or improvement. The tests only assert 64 hex characters and distinct IDs for two blocking findings with the same target and different title/issue. An implementation could omit normalized target, omit kind/failureMode, omit advisory improvement identity, or hash a non-canonical structure and still pass.
**Required change:** Add spec-local assertions that changing only target, kind/failureMode, and advisory improvement changes the findingId, and that an expected canonical tuple produces the expected SHA-256 independent of array position.
**Why blocking:** A must requirement has no executable coverage for several required identity inputs, allowing an incorrect findingId implementation to pass without exercising the required production behavior.

### 2. R5 does not cover per-identity flow handoff deduplication
**Target:** specs/329-review-convergence-edges/tests/review-completion-scope.test.js
**Issue:** R5 requires canonical exhaustion to save a flow finding handoff once for each identity and to avoid additional records when the same evidence is reprocessed. The evidence-transition test uses only one blocking finding, so it cannot detect collapsing multiple distinct identities into one handoff, duplicating one identity while handling another, or failing per-identity uniqueness.
**Required change:** Add a flow-level exhausted evidence case with at least two distinct finding identities and assert exactly one handoff per identity after first processing and no additional records or handoffs after duplicate evidence reprocessing.
**Why blocking:** A must requirement for per-identity handoff persistence has no corresponding coverage; a static anti-pattern with single-item data would pass without validating the required multi-identity behavior.


## Advisory Findings

### 1. R4 atomic CAS behavior is mostly inferred
**Target:** specs/329-review-convergence-edges/tests/changed-tree-recovery.test.js
**Improvement:** The public recovery test verifies the final state has one grant and one tooling reset, but it does not directly assert that both are persisted by the same flow-state CAS mutation. Consider adding an instrumentation-oriented assertion if the local helper API exposes revision or mutation counts.
**Why non-blocking:** The existing tests still cover the observable recovery behavior and idempotence; this would strengthen implementation-detail confidence rather than fill a clearly absent acceptance path.
