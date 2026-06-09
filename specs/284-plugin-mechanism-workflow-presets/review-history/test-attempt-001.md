# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/284-plugin-mechanism-workflow-presets/test-coverage.json`

## Blocking Findings

### 1. Git URL plugin repo behavior is not exercised
**Target:** R2 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-config-cli.test.js and plugin-install-safety.test.js
**Issue:** The tests only assert that help text mentions git URLs and exercise repo add/find with a clean local Git path. No executable test adds or discovers candidates from a git URL source or verifies checkout behavior for that source type.
**Required change:** Add a spec-local executable test that registers a git URL source, performs the safe checkout/update path, and discovers a plugin.json candidate from that checked-out repository.
**Why blocking:** R2 explicitly requires repo management and candidate discovery for both git URL and clean local path repo sources; one required source type has no behavioral test coverage.

### 2. Lifecycle commands are only covered by help text
**Target:** R3 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-config-cli.test.js
**Issue:** The lifecycle surface test checks that help text contains install/list/enable/disable/update/sync, but it does not execute list, enable, disable, update-all/update, or sync behavior. Only install is behaviorally exercised elsewhere.
**Required change:** Add executable spec-local coverage for the missing lifecycle commands, at minimum verifying list, enable, disable, update-all or update, and sync mutate/read plugin state as required.
**Why blocking:** R3 requires these commands to be implemented; help-text assertions can pass without any production lifecycle command behavior existing.

### 3. Safety rejection test can pass after detecting only one unsafe condition
**Target:** R4 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js
**Issue:** One fixture combines dependencies, scripts, a symlink, and an unsafe contribution path, then accepts any failure message matching one of those terms. An implementation that rejects only scripts or only outside paths would pass while leaving other required unsafe structures untested. The fixture also does not exercise .git content rejection or invalid ids/files.
**Required change:** Split or parameterize the safety tests so each required rejection class is independently exercised: invalid ids/files, contribution paths outside copied files, symlinks, .git content, package dependencies, and scripts.
**Why blocking:** R4 lists multiple concrete unsafe structures that must be rejected, but several can currently be unimplemented without causing a test failure.

### 4. Upgrade test contradicts provider exception wording
**Target:** R8 / specs/284-plugin-mechanism-workflow-presets/tests/workflow-plugin-migration.test.js
**Issue:** The test name says upgrade enables the workflow plugin for every valid project unless a provider exists, but the test only covers the no-provider case. There is no test showing that an existing provider prevents or changes workflow plugin activation.
**Required change:** Add a spec-local upgrade test for a project with an existing workflow provider, asserting the expected non-install or preservation behavior.
**Why blocking:** The executable tests do not cover the provider exception encoded in the requirement/test name, so an incorrect migration could still pass.


## Advisory Findings

### 1. R1 assertions could be more direct
**Target:** R1 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-config-cli.test.js
**Improvement:** Assert the loaded repo/package ids and refs directly, not just one repo id and one commit, so the test documents the full config shape it relies on.
**Why non-blocking:** The test fixture includes the relevant fields and would likely catch schema-level rejection, but the current assertions leave avoidable ambiguity.

### 2. R5 docs/setup/upgrade consumers are only indirectly represented
**Target:** R5 / specs/284-plugin-mechanism-workflow-presets/tests/plugin-preset-registry.test.js
**Improvement:** Consider adding focused coverage that a docs loader or setup path consumes plugin preset contributions, not only resolveChain overlay behavior.
**Why non-blocking:** The core preset registry path is covered, but additional consumer-level tests would reduce integration risk.
