# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/288-workflow-plugin-migration/test-coverage.json`

## Blocking Findings

### 1. Commands and hooks can pass using injected fake services only
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R2/R3 hook and command service tests
**Issue:** The command and hook tests assert routing through context.services fakes, while the createWorkflowServices module is tested separately. A plugin could satisfy these tests with a command and hooks that never construct or use the plugin-owned service modules in production, leaving the shared service ownership requirement unexercised.
**Required change:** Add spec-local coverage that exercises the production command and hook paths with plugin-owned service construction, or otherwise asserts the command and hook modules use the plugin-owned shared service factory/module rather than only externally injected fake services.
**Why blocking:** R3 requires plugin-owned services shared by commands and hooks, and the current tests have a static anti-pattern that can pass without exercising that production behavior.

### 2. Prepare hook lifecycle does not prove newly written flow state is used
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R4 generic lifecycle test
**Issue:** The lifecycle test manually supplies a complete flow object containing spec, runId, issue, and hook snapshot to runFlowCommandWithPluginLifecycle. It does not verify that the generic prepare lifecycle writes or refreshes the flow state before running prepare.post, as required.
**Required change:** Add coverage that drives the prepare lifecycle through the path that writes the flow state, then verifies prepare.post receives that newly written state including hook snapshot, spec path, runId, and linked issue.
**Why blocking:** R4 explicitly requires prepare.post to run with the newly written flow state; the current test only proves a preconstructed in-memory flow object is passed through.

### 3. Agent fallback path is untested
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R5 agent tests
**Issue:** The R5 tests cover configured plugin.config.workflow.agent overrides, but they do not cover the required otherwise path where provider/profile overrides are absent and calls still go through the workflow-neutral public plugin agent API/context with root config values such as lang.
**Required change:** Add a case with no plugin.config.workflow.agent entries that exercises publish, classify, similarity, and compose resolution through the public agent context and verifies lang/root config propagation.
**Why blocking:** R5 requires both override resolution and the non-override public API fallback; one acceptance path currently has no corresponding spec-local test coverage.


## Advisory Findings

### 1. Upgrade evidence check is weak
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R12 test
**Improvement:** The R12 test only checks for the existence of upgrade-result.json or upgrade.log when source skill or preset files changed, and checks deployed files for removed workflow strings. It would be stronger to verify that generated deployed artifacts actually correspond to the changed sources or that the evidence file records a successful senti upgrade.
**Why non-blocking:** R12 is a should requirement, and the existing test still provides a useful guard against missing upgrade evidence and stale workflow-specific deployed guidance.
