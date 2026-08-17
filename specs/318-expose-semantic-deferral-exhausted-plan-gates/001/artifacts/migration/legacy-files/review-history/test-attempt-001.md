# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-expose-semantic-deferral-exhausted-plan-gates/test-coverage.json`

## Blocking Findings

### 1. Draft-gate semantic exhaustion path is untested
**Target:** tests/plan-gate-semantic-deferral.test.js
**Issue:** R1-R5 apply to exhausted draft-gate and spec-gate plan gates, but the spec-local tests create only a spec-gate fixture and exercise only `--phase spec`. There is no coverage that draft-gate reads its canonical durable source, exposes the semantic continuation, performs the semantic-deferral transition, rejects mismatched guards before mutation, or keeps non-semantic classifier results stopped.
**Required change:** Add spec-local coverage for the draft-gate exhausted semantic-deferral path, or parameterize the existing R1-R5 cases over both draft-gate and spec-gate using each phase's canonical source and step.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for one of the required guarded plan-gate phases.

### 2. R6 core behavior is not covered by executable tests
**Target:** tests/plan-gate-semantic-deferral.test.js
**Issue:** The R6 test only checks helper output for recoverable phases, command shape, and reset metrics. It does not exercise the required evidence fingerprint comparison, `recoveryPossible: true` only when the current fingerprint differs from the latest baseline, recovery audit append, one-shot re-evaluation behavior, or `ACTIVE_FLOW_MISMATCH` before writes on target mismatch.
**Required change:** Add spec-local executable coverage for task-impl and integration exhausted retry recovery against flow state/evidence: unchanged fingerprint remains unrecoverable, changed fingerprint exposes the existing reset command and appends the audit/sets max-minus-one for one re-evaluation, and a target mismatch returns `ACTIVE_FLOW_MISMATCH` before state/audit writes.
**Why blocking:** The requirement coverage artifact marks R6 covered, but the actual test only covers helper construction and misses multiple required externally observable behaviors.


## Advisory Findings

No advisory findings.