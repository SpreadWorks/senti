# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Preserve ENOENT error code contract
**Target:** R1 / R4 ENOENT diagnostics
**Issue:** Existing Agent currently rejects the raw child_process spawn error, which carries code="ENOENT". The workflow plugin catches errors and uses err.code for its failure envelope, but the spec only requires the new diagnostic message fields and does not require the wrapped diagnostic Error to preserve the code.
**Required change:** Add a requirement or acceptance criterion that the ENOENT diagnostic error preserves error.code === "ENOENT" while replacing the message with contextual diagnostics.
**Why blocking:** An implementation can satisfy AC1 by throwing a new Error with the required message but no code, causing existing workflow refine propagation to report a generic ERROR instead of ENOENT; tests cannot determine which compatibility behavior to assert.


## Non-blocking Improvements

### 1. Mention existing spawn tests
**Target:** Overview Modules / T-1 test_strategy
**Improvement:** Add tests/unit/lib/agent.test.js as a related test target because it already covers real spawn success/failure, stdin fallback, and retry behavior around Agent.call().
**Why non-blocking:** The listed test files are sufficient to implement and verify the required behavior; this only improves test placement guidance.

### 2. Clarify ENOENT retry behavior
**Target:** R1 / R5
**Improvement:** State whether ENOENT should continue to honor the existing retryCount behavior or fail fast with diagnostics.
**Why non-blocking:** Existing retry behavior can be preserved and tests can set retryCount: 0, so implementation is not blocked; clarification would avoid accidental slow diagnostics.
