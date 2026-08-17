# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/284-plugin-mechanism-workflow-presets/test-coverage.json`

## Blocking Findings

### 1. update-all does not prove runtime files are refreshed
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js: R3 lifecycle test
**Issue:** The update-all scenario advances repo commits and asserts config.plugin.packages commits changed, but it never reads the copied plugin runtime files after update-all. An implementation that only updates commit metadata and leaves .senti/plugins/* stale would pass.
**Required change:** After plugin update-all, assert the installed plugin files contain content from the updated commits, for example by reading each installed preset/preset.json label or command file content.
**Why blocking:** R3 requires update-all to operate on installed plugin state with reproducible copying, so the current test can pass without exercising a required production behavior.

### 2. unsafe package validation is only covered for install
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js: R3/R4 safety coverage
**Issue:** The unsafe structure cases all call plugin install. There is no regression test proving plugin sync or plugin update-all rejects unsafe package contents when those commands copy from recorded or newly advanced commits.
**Required change:** Add a spec-local test that reaches an unsafe package through sync or update-all and asserts the command fails without copying unsafe content.
**Why blocking:** R3 requires sync/update-all with validation, and R4 requires unsafe plugin package structures to be rejected. This critical safety path has no direct coverage.

### 3. upgrade consumption of plugin preset contributions is untested
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-preset-registry.test.js: R5 coverage
**Issue:** R5 explicitly includes upgrade consuming plugin preset contributions, but the tests cover resolveChain, docs resolver, and setup only. The upgrade tests are under R7 and do not verify that upgrade can resolve a type supplied only by an enabled plugin preset contribution.
**Required change:** Add an R5 upgrade test with config.type set to a plugin-contributed preset key, run upgrade, and assert it succeeds while preserving/resolving that plugin preset after upgrade.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, so an implementation could leave upgrade using only core preset resolution and still pass the current R5 tests.


## Advisory Findings

### 1. temporary path regex escape is brittle
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js: clean local Git path test
**Improvement:** Replace the custom RegExp construction for the repo path with assert.includes or a standard RegExp escape using "\\$&".
**Why non-blocking:** The current temp paths are likely to avoid regex metacharacters, so this is mainly a portability and clarity improvement rather than missing requirement coverage.
