# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Review history scope omits existing review phases
**Target:** R3/R4/T-2
**Issue:** The spec requires aggregation by review phase and adjacent-attempt repair metrics, but the history requirement only names latest impl/spec artifacts (`review.md`, `impl-review.json`, `spec-review.md`, `spec-review.json`). Existing `flow review` also writes `test-review.md`, `test-review.json`, `draft-review-questions.json`, and `draft-review-coverage.json`, and those phases participate in retry/repair flow.
**Required change:** State the exact review phases and artifact basenames that must get attempt-level history, including either test/draft review artifacts or an explicit exclusion of those phases from attempt-level repair metrics.
**Why blocking:** Without this, implementation can preserve history for only impl/spec while the report still claims phase-wide trends; tests for phase aggregation and adjacent-attempt repair metrics cannot be designed consistently for test and draft review artifacts.

### 2. Finding identity and category contract is missing
**Target:** R3/R5/R6/R7
**Issue:** The spec requires repair entries to reference a finding id, aggregates findings by category, computes same-category reappearance, and searches exact categories. Current review artifacts do not provide stable finding ids, and category data is inconsistent or absent across phases: impl has `failureMode`, draft has `classification`, while spec/test findings have no category field.
**Required change:** Require new attempt-level finding records to include a stable finding id and define the category source or `unknown` fallback for each review phase.
**Why blocking:** Repair correspondence cannot be linked to a specific finding, and same-category reappearance/search behavior cannot be implemented or tested reliably when category and id semantics differ by artifact or are absent.

### 3. Attempt-limit source misses review retry state
**Target:** R2/R6/Data Flow
**Issue:** The spec says to read `specs/*/issue-log.json` for specs that reached attempt limits, but existing review retry attempts are stored in `flow.json` metrics as `reviewRetry`, and `REVIEW_MAX_ATTEMPTS_EXCEEDED` does not automatically append an issue-log entry. Issue-log has gate retry exhaustion evidence, but it is not an authoritative source for review max-attempt exits.
**Required change:** Specify that `metrics review` also reads `flow.json` review/gate retry state for attempt-limit detection, or require review max-attempt exits to be persisted to issue-log when they occur.
**Why blocking:** The attempt-limit spec list will silently omit review attempts that exhausted their retry budget, so the report's repair effectiveness output would be incomplete and regression tests would depend on manual issue-log entries rather than verified flow behavior.


## Non-blocking Improvements

### 1. Pin the history filename pattern
**Target:** R4
**Improvement:** Define the deterministic attempt-history filename pattern, including whether numbering is per phase, per artifact family, or global per spec.
**Why non-blocking:** The current wording is implementable by choosing a local convention, but an explicit pattern would make fixtures and user-facing documentation easier to align.
