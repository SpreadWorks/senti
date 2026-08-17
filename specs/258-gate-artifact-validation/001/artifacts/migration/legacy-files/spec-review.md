# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Gate scope is ambiguous between task and integration gate-impl
**Target:** R1/R2/T-2 and Overview > Data Flow
**Issue:** The codebase has both task-level gate-impl mapped to phase task-impl and flow-level gate-impl mapped to phase integration. The required artifacts in this spec are produced by flow-level test-execute/test-result-review and are not available during task-level gate-impl. The spec repeatedly says gate-impl without explicitly limiting the new trust precondition to the integration phase.
**Required change:** State whether artifact trust validation applies only to flow-level gate-impl / phase=integration after test-result-review, or define the separate task-level artifact data path if task-impl must also be covered.
**Why blocking:** If implemented for task-impl, normal task gates can fail before the artifacts exist; if implemented only for integration, tests and gate expectations remain ambiguous because the same gate-impl step name is used for both paths.

### 2. User-permission audit record has no deterministic contract
**Target:** R5 and Clarifications > user-permission exception
**Issue:** The spec allows placeholder artifacts when the active flow contains an explicit user-permission audit record, but existing issue-log.json entries are free-form step/reason/trigger/resolution records and there is no defined field, marker, artifact path, association rule, or ordering rule that proves explicit user permission.
**Required change:** Define the exact audit record contract gate-impl must accept, including artifact location, required fields or marker values, and how it must relate to the current flow/phase and placeholder artifact.
**Why blocking:** The exception path cannot be implemented or tested deterministically; an implementation would either rely on brittle free-text matching or risk accepting unrelated issue-log entries as permission.

### 3. Placeholder sentinel scan scope is undefined
**Target:** R3 and Clarifications > placeholder definition
**Issue:** The spec says placeholder/TODO/TBD should fail when found in a value that claims execution evidence, but existing artifacts contain many string fields across summary evidence, regression evidence, review checked_items, result paths, file-map paths, and the raw log. The spec does not identify which fields count as execution-evidence values or whether raw log/file-map strings are scanned.
**Required change:** Enumerate the exact fields or JSON paths in each required artifact that are subject to sentinel rejection, and state how file-map.json values and tests/.raw/test-execution.log are handled.
**Why blocking:** Tests cannot define reliable sentinel cases, and implementation may either reject legitimate commands/paths/log output containing TODO/TBD or miss placeholders in fields the spec intended to protect.


## Non-blocking Improvements

### 1. Document placeholder hash normalization
**Target:** R3/T-1
**Improvement:** Specify whether placeholder fixture hashes are computed from raw file bytes or canonicalized JSON, and where the documented fixture hash list lives.
**Why non-blocking:** The implementation can still create a fixture and test around it, but an explicit normalization rule would prevent future hash drift.

### 2. Clarify stale artifact scope
**Target:** Scope In and T-1
**Improvement:** Clarify whether stale means only the existing regression snapshot stale checks, or whether file-map/raw-log/test-review staleness introduces additional rules.
**Why non-blocking:** R2, R4, and the acceptance criteria already define the main observable invalid classes, but the extra stale wording could lead to broader-than-intended validation.
