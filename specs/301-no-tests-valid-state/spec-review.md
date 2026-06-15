# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. No-command skip predicate is underspecified
**Target:** R5 / T-4
**Issue:** The spec says final-regression should convert project regression command absence into skipped_by_project_policy, but existing discoverRegressionCommand throws for both true absence and invalid discovery cases such as malformed test.command syntax. The spec does not state which discovery errors remain invalid_project_test failures.
**Required change:** Specify that skipped_by_project_policy applies only when no supported regression command source is present, and that malformed configured commands or other invalid discovery states remain fail artifacts with invalid_project_test.
**Why blocking:** Without this distinction, an implementation can safely-looking catch all discovery errors and skip invalid project test configuration, which changes existing failure behavior and prevents tests from asserting that invalid commands still block.

### 2. Skipped artifact proof contract is missing
**Target:** R5 / final-regression-result.json contract
**Issue:** Existing final-regression skipped artifacts are validated with skipKind-specific proof objects, and validateFinalRegressionResult currently rejects skipped artifacts without a recognized proof shape. The spec adds skipKind=skipped_by_project_policy but does not define its proof requirements or explicitly say proof validation should be removed for that kind.
**Required change:** Define the skipped_by_project_policy artifact proof contract, or explicitly state that this skipKind is exempt from proof and what raw/process fields are sufficient for validation.
**Why blocking:** The validator and post-hook promotion cannot be implemented or tested deterministically because the current skipped-artifact contract requires proof, while the new spec only defines result, skipKind, completed, nextAction, process, and raw log expectations.


## Non-blocking Improvements

### 1. Report count wording could be more concrete
**Target:** R6 / report
**Improvement:** Clarify whether report output should expose a separate not_applicable count alongside passed and failed counts.
**Why non-blocking:** R6 already requires report paths to consume and display the no-tests state, so implementation can choose a reasonable representation without blocking the core contract.
