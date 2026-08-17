# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/479-scenario-validity-baseline/test-coverage.json`

## Blocking Findings

### 1. R1 authority validation coverage is incomplete
**Target:** specs/479-scenario-validity-baseline/tests/immutable-baseline.test.js
**Issue:** The tests only cover missing repairBaseline and mismatched refs. They do not cover commit identity agreement with persisted authority, ambiguous authority, or unresolvable authority, all of which R1 explicitly requires to fail closed with typed errors before diffing.
**Required change:** Add spec-local unit tests that exercise persisted-authority commit mismatch plus ambiguous and unresolvable baseline authority cases, asserting the typed fail-closed errors.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for several required failure modes.

### 2. R2 production-target change detection is not covered
**Target:** specs/479-scenario-validity-baseline/tests/immutable-baseline.test.js
**Issue:** The R2 test only checks that diff args start with the baseline ref. It does not cover committed diff computation from the immutable baseline, advanced-base exclusion, or retained staged, unstaged, and untracked production-target detection using the existing allowlist.
**Required change:** Add tests that exercise committed current-flow changes from the validated immutable baseline, advanced-base exclusion, and staged/unstaged/untracked production-target changes through the allowlist behavior.
**Why blocking:** R2 and R4 require these behaviors, but the current tests would pass without exercising the production behavior that detects those change categories.

### 3. R3 public contract behavior is not tested
**Target:** specs/479-scenario-validity-baseline/tests/immutable-baseline.test.js
**Issue:** The R3-labeled test asserts an invalid authority helper error, not the scenario-validity public contract. It does not verify version-1 result artifact writing, raw log writing, pass/block semantics, or advancement of pass results to test review.
**Required change:** Replace or supplement the R3 test with executable coverage of valid scenario-validity runs writing the v1 result artifact and raw log, preserving pass/block outcomes, and transitioning pass results to test review.
**Why blocking:** The coverage artifact marks R3 as covered, but the actual test contradicts that claim and does not cover the required public contract.

### 4. R4 coverage claim is contradicted by the test body
**Target:** specs/479-scenario-validity-baseline/tests/immutable-baseline.test.js
**Issue:** The R4-labeled test only duplicates a baseline authority mismatch assertion. It does not cover the R4-required advanced-base exclusion, committed/staged/unstaged/untracked current-flow changes, invalid baseline authority breadth, or retained artifact/transition behavior.
**Required change:** Add the missing R4 unit cases or narrow the coverage artifact so it does not claim R4 is covered until those cases exist.
**Why blocking:** The requirement-to-test coverage artifact says R4 is covered, but the actual tests do not cover most of R4.


## Advisory Findings

No advisory findings.