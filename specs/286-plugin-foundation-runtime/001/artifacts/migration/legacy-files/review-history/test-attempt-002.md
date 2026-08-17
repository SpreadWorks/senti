# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/286-plugin-foundation-runtime/test-coverage.json`

## Blocking Findings

### 1. R1 lacks documentation coverage
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Issue:** R1 requires a documented migration path from plugin.repos/packages[].repo to plugin.sources/packages[].source, but the test only checks validation and CLI/registry behavior. No spec-local test asserts that migration guidance or generated documentation exists.
**Required change:** Add a focused test that checks the migration path is documented in the intended user-facing upgrade/config guidance artifact.
**Why blocking:** An explicit acceptance requirement has no corresponding spec-local test coverage.

### 2. R2 safety limits are only partially covered
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Issue:** R2 requires preserving safety checks for .git, node_modules, and the 2000 copied-files-per-plugin limit, but the test cases do not exercise those required rejections.
**Required change:** Add rejection cases for package contents containing .git, node_modules, and more than 2000 copied files under known plugin package paths.
**Why blocking:** Required security and resource-limit behavior has no corresponding regression coverage.

### 3. R3 discovery caps and inheritance validation are uncovered
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Issue:** R3 requires a 200 hook-file cap per plugin, a 100 enabled-plugin-package cap per project, and FlowCommandHook inheritance validation. The test checks a valid subclass but does not assert rejection for a returned class that does not extend FlowCommandHook, nor either cap.
**Required change:** Add focused tests for non-FlowCommandHook returned classes, more than 200 hook files in one plugin, and more than 100 enabled plugin packages.
**Why blocking:** Critical validation and bound requirements lack spec-local coverage.

### 4. R4 does not verify prepare writes the snapshot
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Issue:** R4 specifically requires successful flow prepare to snapshot hook plans into flow.json, but the test manually calls discoverFlowCommandHooks() and writeFlowCommandHookSnapshot() instead of exercising the prepare path.
**Required change:** Add or adjust a test to run the prepare entry point and assert flow.json contains plugins.flowCommandHooks after success.
**Why blocking:** The current test can pass with a helper that works while the required prepare integration is missing.

### 5. R5 lifecycle coverage is incomplete
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Issue:** R5 requires execution at supported flow command pre/post lifecycle points, but the test only invokes prepare.post directly through runFlowCommandHooks(). It does not verify command lifecycle integration or supported pre/post points beyond prepare.post.
**Required change:** Add tests that exercise the supported flow command lifecycle integration points, including at least one supported pre hook and one supported post hook outside the manually invoked prepare.post case.
**Why blocking:** The test could pass without production flow commands actually running snapshot plugin hooks at required lifecycle points.

### 6. R7 help coverage misses command and subcommand help paths
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Issue:** R7 requires top-level help, command help, subcommand help, locale wording, and experimental display through the shared renderer. The test only covers top-level rendering and experimental display for argv: [].
**Required change:** Add tests for plugin command help argv, plugin subcommand help metadata rendering, and locale-specific wording through the same renderHelp path.
**Why blocking:** Several required user-facing help surfaces have no executable coverage.

### 7. R8 migration and schema validation coverage is incomplete
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Issue:** R8 requires applying plugin config schemas/defaults under plugin.config.<pluginId>, migrating top-level workflow.* through upgrade/config guidance, and provider/profile overrides from plugin config. The test checks defaults and top-level workflow rejection, but does not assert plugin schema validation or actual upgrade/config guidance migration behavior.
**Required change:** Add tests that verify plugin config schema validation is applied and that the intended upgrade/config guidance migrates workflow.flowIntegration to plugin.config.workflow.
**Why blocking:** Required migration behavior and schema enforcement can be absent while the current tests still pass.


## Advisory Findings

### 1. R6 should assert non-zero exit normalization
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Improvement:** The R6 test checks invalid and thrown plugin commands return ok: false, but it does not assert the normalized failure envelope includes a non-zero exit status.
**Why non-blocking:** The main command-loading and public-context behavior is covered; this is a narrower assertion that would make the failure contract more precise.

### 2. R9 could assert hook source is official plugin behavior
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Improvement:** The R9 test verifies the official workflow plugin hook is discovered and produces issue-start/workflow output, but a more explicit assertion on the produced issue-log candidate shape would make the preserved issue-start behavior less dependent on string matching.
**Why non-blocking:** The existing test exercises the intended official hook path and guards against workflow instructions remaining in the generated skill text.
