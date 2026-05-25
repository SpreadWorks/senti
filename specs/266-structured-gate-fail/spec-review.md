# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Issue-log audit-only rule omits existing retry-state behavior paths
**Target:** R7-R9 / Data Flow / src/flow/lib/run-gate.js
**Issue:** The spec moves gate-impl prior memory out of issue-log, but existing gate-impl behavior state is not limited to failedEvaluations. checkNoProgressSinceLastFail reads issue-log headSha/worktreeHash to reject unchanged re-runs, and findPreviousPassedGuardrails/applyFlipOverride read issue-log passedGuardrails to stabilize retries. The proposed gateImplMemory index contains signature, status, and observationRef only, so it cannot preserve those existing behaviors if issue-log is made audit-only.
**Required change:** Add the smallest compatibility rule stating either that these existing issue-log reads remain explicit non-memory exceptions, or add headSha, worktreeHash, and passedGuardrails equivalents to the new flow.json/artifact behavior-state path.
**Why blocking:** Without this, implementation must choose between violating the audit-only design principle by continuing to read issue-log, or silently dropping existing no-progress rejection and PASS-to-FAIL flip stabilization behavior.

### 2. Observation severity lacks gate verdict aggregation semantics
**Target:** R3 / R6 / Acceptance Criteria
**Issue:** The spec introduces blocking and advisory Observation severity, including advisory process-evidence-missing observations, but existing gate output has only result pass/fail and next routing. The spec does not state whether advisory observations make the gate fail, pass with observations, or get omitted from PASS artifacts.
**Required change:** Specify the gate verdict and prescription rule for Observation severity, for example whether any blocking observation causes FAIL and advisory-only observations produce PASS with retained or omitted observations.
**Why blocking:** Tests and implementation cannot determine the correct result, next prescription, or artifact shape for advisory-only process-evidence-missing output, and different choices change gate control flow.

### 3. Shared gate parser scope conflicts with gate-impl-only failure modes
**Target:** R3-R6 / src/flow/lib/run-gate.js
**Issue:** R4 names parseGuardrailArticleEvaluation, which is the shared parser for draft, spec, task-spec, task-impl, and integration guardrail gates, and R6 requires Gate PASS and FAIL artifacts to include NextAction. However R3 defines exact failureMode values only for gate-impl, and the spec does not define failureMode/severity mapping for non-gate-impl structural issues or draft/spec/task-spec guardrail failures.
**Required change:** Clarify whether Observation/NextAction conversion applies to every gate phase or only gate-impl; if every gate phase is included, define the failureMode and severity mapping for non-gate-impl guardrail and structural gate issues.
**Why blocking:** The implementation target is shared code, so leaving this unspecified makes non-gate-impl gate artifacts impossible to implement and test consistently without inventing behavior outside the spec.


## Non-blocking Improvements

### 1. Memory status values are underspecified
**Target:** R8-R9
**Improvement:** Define the allowed status values and statusReason intent for gate-impl memory entries, such as fail, pass, repeated, superseded, or resolved.
**Why non-blocking:** An implementation can still store strings and keep the latest three rounds, but a small enum would make prompt rendering and tests less brittle.

### 2. Related hook files could be named
**Target:** Codebase Context
**Improvement:** Add src/flow/registry.js and src/lib/dispatcher.js to related files because gate retry counters, issue-log append hooks, post-hook skipping, and throw-to-envelope behavior are controlled there.
**Why non-blocking:** The current module list is enough to find the main gate code, but these files explain important integration behavior for retry and persistence.
