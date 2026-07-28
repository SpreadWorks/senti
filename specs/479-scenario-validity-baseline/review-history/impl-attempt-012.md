# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Scenario validity now blocks flows without a captured repair baseline
**Finding key:** baseline-fallback-blocks-legacy-flows
**Failure mode:** spec_behavior_contradiction
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R1
**Issue:** `execute()` now requires `flowState.repairBaseline` and returns `SCENARIO_VALIDITY_BLOCKED` when it is absent. The previous behavior explicitly fell back to `state?.baseBranch || "main"`, and this patch only updates one e2e fixture to add a baseline. Any existing flow state created before this field was introduced, or any caller that still provides only `baseBranch`, will be blocked before scenario-validity can run.
**Suggestion:** Preserve the existing fallback for flow states that do not yet carry `repairBaseline`, or add a migration/initialization path that captures and persists the repair baseline before `RunScenarioValidityCommand.execute()` is reachable. Cover that compatibility path in `tests/e2e/231-task-e2e-full-lifecycle.test.js` or the new immutable-baseline test.
**Disposition:** must-fix
**Rationale:** R1 maps to both scenario-validity and repair-state identity behavior. Replacing the established baseline fallback with a hard requirement is a behavioral contradiction for existing flow states unless the implementation also guarantees every scenario-validity invocation has been migrated to include the new authority.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
