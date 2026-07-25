# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Guardrail output failures are collapsed into generic guardrail failures
**Finding key:** guardrail-output-failure-misclassified
**Failure mode:** missing_acceptance_requirement
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** In `checkGuardrail`, every exception from `evaluateGuardrailObservationsWithRetry` that is not an `EvaluationSchemaError` is returned as `failureCode: "GATE_REQUIRED_GUARDRAIL"`. That collapses malformed or unparsable required guardrail output into a provider/evaluation failure, even though R2 requires each required-evaluation failure mode to be non-PASS and machine-readable with its own classification. The added spec-local test expects `GATE_REQUIRED_OUTPUT` for `requiredGuardrail: { output: "not-json" }`, but this production path cannot emit that code from the catch branch.
**Suggestion:** Update the `checkGuardrail` catch classification to distinguish output parsing/shape failures from guardrail invocation failures, for example by checking the concrete error type/code emitted for non-JSON output and returning `failureCode: "GATE_REQUIRED_OUTPUT"` while reserving `GATE_REQUIRED_GUARDRAIL` for provider invocation/evaluation errors.
**Disposition:** must-fix
**Rationale:** This is tied directly to the mandatory T-2 acceptance criterion that all R2 failure modes are blocking and machine-readable. Misclassifying a required output failure prevents policy consumers from resolving the required R2 failure mode correctly.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
