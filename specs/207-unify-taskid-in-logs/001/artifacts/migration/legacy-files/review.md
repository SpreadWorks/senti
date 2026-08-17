# Code Review Results

### [ ] 1. Reuse `countGateRetry` in integration test
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** `readCounter()` reimplements the same reset-aware retry counting logic that was just extracted to `countGateRetry()` in `src/flow/lib/run-gate.js`. This duplicates behavior and risks drift.  
**Suggestion:** Import and use `countGateRetry(entries, "task-impl")` directly in `readCounter()`, so test and production logic stay aligned from one implementation.

**Verdict:** REJECTED
**Reason:** This reduces test independence by sharing the same logic under test; if `countGateRetry()` is wrong, the test helper can mirror the same bug and miss regressions.

### [ ] 2. Tighten `update-overview` schema strictness
**File:** `src/flow/schemas/next-action/update-overview.schema.json`  
**Issue:** `additionalProperties: false` was removed, so unexpected fields are now silently accepted. That weakens contract clarity and can hide malformed AI outputs.  
**Suggestion:** Re-add `"additionalProperties": false` at the root, and consider making `overview_path` conditionally required when `updated: true` to keep the schema explicit and self-consistent.

**Verdict:** REJECTED
**Reason:** Re-adding strictness (and conditional required fields) is a behavioral contract change, not a safe refactor; it can break currently accepted payloads without clear compatibility intent.

### [ ] 3. Clarify aggregation intent in `get-qa-count`
**File:** `src/flow/lib/get-qa-count.js`  
**Issue:** `summary.total?.draft?.question` now counts both flow-level and task-scoped draft questions. The old behavior read a single flow-level metric object. This semantic shift is not obvious from naming.  
**Suggestion:** Either switch to `summary.flow?.draft?.question` (if command should remain flow-level), or rename the command/output semantics to explicitly indicate total (flow + tasks) aggregation.

**Verdict:** REJECTED
**Reason:** The proposal is directionally valid but ambiguous (`flow`-only vs `total` semantics). Without explicit product intent, either choice risks changing observable behavior incorrectly.

### [ ] 4. Reduce counter-name duplication in test helper
**File:** `tests/unit/flow/commands/report-metrics.test.js`  
**Issue:** `asMetrics()` hardcodes `["question", "srcRead", "docsRead", "issueLog"]`, duplicating production counter definitions and creating maintenance drift risk.  
**Suggestion:** Import and reuse `ACTIVITY_COUNTERS` from `src/flow/lib/get-status.js` in the helper to keep test input generation consistent with runtime expectations.

**Verdict:** REJECTED
**Reason:** Importing `ACTIVITY_COUNTERS` from production into tests couples tests to implementation details and weakens regression detection for missing/changed counters.

### [ ] 5. Improve naming clarity for phase accumulator
**File:** `src/flow/lib/get-status.js`  
**Issue:** `applyEntry(bucket, entry)` uses short variable `p` for phase aggregate, which makes the core aggregation path harder to scan.  
**Suggestion:** Rename `p` to `phaseSummary` (or similar) to improve readability and consistency with the surrounding `summary` naming pattern without changing behavior.

**Verdict:** REJECTED
**Reason:** This is cosmetic-only (`p` rename) and does not materially improve behavior or architecture under a conservative review standard.
