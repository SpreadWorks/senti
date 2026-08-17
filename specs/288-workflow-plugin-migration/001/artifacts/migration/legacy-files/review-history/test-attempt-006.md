# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/288-workflow-plugin-migration/test-coverage.json`

## Blocking Findings

### 1. R1 does not prove external plugin provenance
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R1 / pluginWorkspace()
**Issue:** The R1 assertions only check for a root-relative directory with plugin.json and a 40-character sourceCommit. A locally created in-tree stub or compatibility copy with a fake SHA would satisfy the test without preparing the external workflow plugin repository.
**Required change:** Add a spec-local assertion that ties the recorded workspace to the external workflow plugin source, such as repository metadata, source URL, or an external-plugin manifest identifier, while continuing to verify from the recorded plugin root.
**Why blocking:** R1 is a must requirement, and the current test can pass without exercising the required external repository migration boundary.

### 2. Prepare hook issue propagation is not covered
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R4 generic flow hook lifecycle test
**Issue:** The test calls runPrepareWithPluginHooks without a linked issue and later manually invokes runFlowCommandWithPluginLifecycle with issue: 375, overwriting the same artifact. This verifies the manual lifecycle helper, not that the actual prepare flow runs prepare.post after writing flow state with the linked issue.
**Required change:** Have the prepare-path test invoke the real prepare lifecycle with a linked issue, or read the prepare hook artifact before the manual lifecycle call and assert it contains spec, runId, hook snapshot, and issue.
**Why blocking:** R4 explicitly requires prepare.post to receive the newly written flow state including the linked issue; the current coverage can pass even if prepare hooks never receive that issue.

### 3. Prompt and skill hardcode scan misses forbidden guidance
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R8 test
**Issue:** The regex only rejects exact strings such as 'senti workflow issue-start' and 'senti workflow add'. It would allow bare 'issue-start', 'issue-log-import', 'workflow add', or workflow board integration instructions, all of which R8 requires removing.
**Required change:** Broaden the R8 assertions to cover the forbidden concepts named in the requirement, including bare issue-start, issue-log-import, workflow add, and workflow board or board integration guidance in src/flow/prompts and src/skills.
**Why blocking:** R8 is marked covered, but the test can pass while core prompts or skills still contain workflow-specific instructions prohibited by the requirement.


## Advisory Findings

### 1. Upgrade evidence trigger is narrower than R12
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R12 test
**Improvement:** The test only requires upgrade evidence when src/skills or src/presets change, although R12 also mentions source templates and deployed skill artifacts. It also checks deployed files for stale workflow text but does not compare generated artifacts against changed sources.
**Why non-blocking:** R12 is a should requirement and the stale-text check still provides useful migration protection; this is a coverage-strengthening improvement rather than a must-have blocker.
