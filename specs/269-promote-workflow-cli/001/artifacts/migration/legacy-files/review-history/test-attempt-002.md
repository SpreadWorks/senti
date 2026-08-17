# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-promote-workflow-cli/test-coverage.json`

## Blocking Findings

### 1. R11 import-path adjustment is untested
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R11
**Issue:** The R11 test only checks that some workflow-*.test.js files exist under tests/unit/ and are absent from experimental/tests/. It does not verify that relocated workflow tests had their imports updated to src/workflow/, so an implementation could move files while leaving stale experimental imports and still satisfy this spec-local test.
**Required change:** Extend the R11 test to inspect relocated tests/unit/workflow-*.test.js files and assert they do not import experimental/workflow paths and do reference src/workflow where applicable, or otherwise make those relocated tests executable through the expected unit-test entrypoint.
**Why blocking:** R11 explicitly requires import paths to be adjusted after moving the tests, and that acceptance requirement currently has no corresponding spec-local coverage.


## Advisory Findings

### 1. R5 unconditional skill deployment is only partially asserted
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R5
**Improvement:** Consider also asserting that src/lib/skills.js still derives deployable skills from MAIN_SKILLS_DIR so the relocated sdd-forge.exp.workflow skill is included in the normal unconditional skill path.
**Why non-blocking:** The current test covers the strongest regression risks by checking the new skill source location and removal of the experimental directory constant and enable-conditioned upgrade branch; the remaining concern is an extra confidence check rather than missing core coverage.
