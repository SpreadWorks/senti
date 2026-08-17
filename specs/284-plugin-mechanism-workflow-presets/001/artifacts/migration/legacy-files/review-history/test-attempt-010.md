# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/284-plugin-mechanism-workflow-presets/test-coverage.json`

## Blocking Findings

### 1. Official preset upgrade test can pass without using official plugin discovery
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-preset-registry.test.js: R7 upgrade installs and enables official presets when existing config.type requires them
**Issue:** The test seeds config.plugin.repos with a local fixture repo that already contains the required preset package, then only asserts that some preset-like repo/package exists after upgrade. An implementation could satisfy the test by installing from the preseeded fixture path and never implement the required core migration behavior that locates and installs the official senti-presets artifact.
**Required change:** Start the legacy project without a preconfigured plugin repo, or assert that the resulting repo/package source matches officialPresetPluginRoot()/the official plugin registration rather than the seeded fixture.
**Why blocking:** R7 specifically requires core migration to install and enable the moved official presets. The current test has a static anti-pattern that would pass without exercising production official migration behavior.


## Advisory Findings

### 1. Escaped path assertion contains placeholder replacement text
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js: R2 repo add and find discover plugin.json candidates from a clean local Git path
**Improvement:** Replace the RegExp escape replacement string `"\\{{PROMPT}}"` with the matched-character escape pattern, for example `"\\$&"`.
**Why non-blocking:** The temp repo paths used by the test are unlikely to contain regex metacharacters, so the test remains executable in normal runs, but the helper expression is misleading and fragile.
