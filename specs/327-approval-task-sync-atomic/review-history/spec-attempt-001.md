# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Clarify current spec-load behavior
**Target:** overview.decisions
**Improvement:** Describe the current helper as skipping active-flow load errors and a missing spec, throwing malformed or invalid spec errors, and having set-step convert those exceptions to warning-success.
**Why non-blocking:** The requirements and acceptance criteria already require active-spec failures to propagate, so this only makes the source-verification narrative more precise.

### 2. Define logical retry comparison fields
**Target:** AC3
**Improvement:** State whether the test fixes the clock or compares the logical approval, task, promotion, and result-envelope fields while excluding wall-clock timestamps.
**Why non-blocking:** Either test technique can verify the same idempotency contract without changing implementation behavior.

### 3. Name the committed retry result
**Target:** R3 and AC3
**Improvement:** Clarify that retry after a committed:true failure is rejected as an already-terminal transition and performs no additional write, effect, or tasksSynced emission.
**Why non-blocking:** The current transition policy already determines this result and the spec already requires the complete committed state to remain duplicate-free.
