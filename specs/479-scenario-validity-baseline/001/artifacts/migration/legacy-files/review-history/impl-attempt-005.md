# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Baseline authority tests assert codes the resolver never emits
**Finding key:** baseline-authority-test-expects-wrong-error-codes
**Failure mode:** spec_behavior_contradiction
**File:** specs/479-scenario-validity-baseline/tests/immutable-baseline.test.js
**Requirement:** R1
**Issue:** The new R1 assertions expect `SCENARIO_VALIDITY_BASELINE_REQUIRED`, `SCENARIO_VALIDITY_BASELINE_AUTHORITY_MISMATCH`, `SCENARIO_VALIDITY_BASELINE_UNRESOLVABLE`, and `SCENARIO_VALIDITY_BASELINE_AMBIGUOUS`, but `resolveScenarioValidityBaselineAuthority` is a direct re-export of `resolveRepairBaselineAuthority`, which throws `RepairStateError` codes with the existing `REPAIR_BASELINE_*` names. These assertions do not match the implemented resolver contract.
**Suggestion:** Update the R1 assertions in `immutable-baseline.test.js` to expect the actual `REPAIR_BASELINE_*` resolver codes, while keeping `RunScenarioValidityCommand.execute()` envelope assertions on the public `SCENARIO_VALIDITY_BLOCKED` code.
**Disposition:** must-fix
**Rationale:** The task requires regression coverage for retained scenario-validity contracts. A spec-local requirement test that statically asserts impossible resolver codes blocks that mandatory coverage and contradicts the touched implementation behavior.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
