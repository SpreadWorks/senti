# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/284-plugin-mechanism-workflow-presets/test-coverage.json`

## Blocking Findings

### 1. Missing token masking regression coverage
**Target:** R3 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js
**Issue:** R3 requires plugin lifecycle operations with token masking, but no test exercises a repository source containing credentials or asserts that stdout/stderr/config output masks secret tokens.
**Required change:** Add one spec-local test that uses a credential-bearing repo URL or simulated failure path and asserts emitted output does not contain the raw token while still preserving useful source context.
**Why blocking:** An implementation can leak credentials in plugin repo/install/update errors and still pass all current tests, leaving a critical security requirement uncovered.

### 2. Missing update-all command coverage
**Target:** R3 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-config-cli.test.js and specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js
**Issue:** R3 specifically requires an update-all operation, but the tests only check generic help text for `update` and execute `plugin update`. They do not require `plugin update-all` or prove all installed packages are updated together.
**Required change:** Add or adjust the lifecycle test to invoke the required `plugin update-all` command with at least two installed plugins and assert both package commits are refreshed or considered during the operation.
**Why blocking:** The current tests would pass an implementation that omits the required update-all command entirely.

### 3. Official preset migration is not tested
**Target:** R7 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-preset-registry.test.js
**Issue:** R7 requires core migration to install and enable official preset plugins when an existing config.type requires them, but the R7 test only checks that core presets moved out and that the external manifest contributes preset keys.
**Required change:** Add a migration/upgrade test for an existing project with a non-base `config.type` such as `webapp`, then assert upgrade installs/enables the official presets package and records a commit-pinned package entry.
**Why blocking:** An implementation can move preset files and publish plugin contributions while failing to migrate existing projects, which is an explicit must requirement.

### 4. Preset consumers beyond resolveChain are uncovered
**Target:** R5 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-preset-registry.test.js
**Issue:** R5 requires preset resolution, docs loaders, setup, and upgrade to consume plugin preset contributions, but the tests only exercise `resolveChain` and a project-local overlay. There is no executable coverage for docs loading, setup, or upgrade behavior using plugin presets.
**Required change:** Add spec-local tests that run or directly call the docs loader, setup path, and upgrade path against a plugin-contributed preset and assert they resolve the plugin preset rather than only core or project-local presets.
**Why blocking:** The current suite would pass if only `resolveChain` understands plugin presets while the required user-facing flows still ignore them.

### 5. Flow integration migration is not asserted
**Target:** R8 / specs/284-plugin-mechanism-workflow-presets/tests/workflow-plugin-migration.test.js
**Issue:** R8 requires workflow config schema/defaults and flowIntegration support to move to the workflow plugin, but the migration tests only assert the plugin package is installed or skipped when a provider exists. They do not assert preservation or plugin-backed handling of `workflow.flowIntegration`.
**Required change:** Extend the upgrade test to assert the existing `workflow.flowIntegration` behavior/config remains valid after migration through the workflow plugin contribution.
**Why blocking:** A migration could install the workflow plugin but drop or ignore flowIntegration support and still satisfy the current tests.


## Advisory Findings

### 1. Use fs helper consistently
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/workflow-plugin-migration.test.js
**Improvement:** The R9 test writes command files with `fs.writeFileSync` while other spec fixtures use `writeFile`; using the helper would keep directory creation and cleanup style consistent.
**Why non-blocking:** The current writes are executable and do exercise the intended dispatch behavior.

### 2. Command naming should match requirement wording
**Target:** Requirement-to-test coverage artifact / R3 tests
**Improvement:** If the intended public command is `plugin update` rather than `plugin update-all`, update the requirement text or test names so the coverage artifact does not drift from the CLI contract.
**Why non-blocking:** This is advisory only if product intent has changed; otherwise the missing `update-all` executable coverage is already listed as blocking.
