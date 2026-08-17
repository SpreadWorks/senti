# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-promote-workflow-cli/test-coverage.json`

## Blocking Findings

### 1. R6 has no spec-local coverage despite concrete static requirements
**Target:** Requirement-to-Test Coverage Artifact R6 / specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js
**Issue:** R6 is marked not_testable and has no test, but it contains statically verifiable acceptance requirements: the relocated skill text must replace `node experimental/workflow.js` with `sdd-forge workflow` and update `languages.source` references to `workflow.languages.source`.
**Required change:** Add the smallest static test that reads `src/skills/sdd-forge.exp.workflow/SKILL.md` and asserts the old command/reference are absent and the new command/config reference are present, or mark R6 testable with equivalent coverage.
**Why blocking:** A must requirement has no corresponding spec-local test coverage, and the missing checks are executable/static file assertions rather than inherently untestable.

### 2. R8 has no spec-local coverage despite concrete documentation-file requirements
**Target:** Requirement-to-Test Coverage Artifact R8 / specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js
**Issue:** R8 is marked not_testable and has no test, but it requires three specific files (`README.md`, `AGENTS.md`, `CLAUDE.md`) to contain an experimental workflow notice in non-generated regions. This can be verified statically.
**Required change:** Add a static test that checks all three required files contain a workflow experimental notice outside generated directive regions, or otherwise provides concrete coverage for the three-file requirement.
**Why blocking:** A should requirement still has an acceptance target and the coverage artifact incorrectly excludes a statically testable requirement, allowing implementation to omit it without detection.

### 3. R9 has no spec-local coverage despite concrete AGENTS content requirements
**Target:** Requirement-to-Test Coverage Artifact R9 / specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js
**Issue:** R9 is marked not_testable and has no test, but it requires `src/workflow/AGENTS.md` to document specific promotion criteria. Existence and required concept coverage can be statically asserted.
**Required change:** Add a static test that reads `src/workflow/AGENTS.md` and verifies the required promotion criteria are represented, or mark R9 testable with equivalent coverage.
**Why blocking:** The requirement has no corresponding spec-local coverage even though the target file and required content are concrete and statically verifiable.


## Advisory Findings

### 1. R1 dispatcher location assertion is loose
**Target:** specs/269-promote-workflow-cli/tests/promote-workflow-cli.test.js R1
**Improvement:** R1 says the relocated workflow entry moves under `src/workflow/`, but the test also accepts `src/workflow.js`. Tightening this to the intended final layout would avoid ambiguity if the spec expects the dispatcher itself inside `src/workflow/`.
**Why non-blocking:** R2 separately allows routing to a `src/workflow` dispatcher, and the test still verifies the promoted namespace behavior; this is a precision improvement unless the spec owner requires only an in-directory entrypoint.
