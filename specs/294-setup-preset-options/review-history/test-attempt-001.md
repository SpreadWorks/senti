# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/294-setup-preset-options/test-coverage.json`

## Blocking Findings

### 1. R2 fail-loud official source path is untested
**Target:** specs/294-setup-preset-options/tests/preset-candidates.test.js
**Issue:** The R2 test only injects a valid officialPresetRoot and verifies read-only discovery. It does not cover the required loud failure when the official preset source cannot be resolved, so an implementation that silently falls back to base would pass.
**Required change:** Add an R2 spec-local test that calls setup candidate discovery with official presets enabled and an unresolvable official source, then asserts a clear throw and no config/plugin writes.
**Why blocking:** R2 explicitly requires loud failure for unresolved official sources, and the coverage artifact marks R2 covered despite that acceptance behavior having no executable test.

### 2. R6 parity coverage misses several required behaviors
**Target:** specs/294-setup-preset-options/tests/setup-parity.test.js
**Issue:** The R6 test covers summary display and agent template lookup, but it does not cover defaults, non-interactive --type handling, or config type minimization through the project-root-aware resolver.
**Required change:** Add focused R6 tests for default setup behavior, non-interactive --type selection, and generated config type minimization when project-root-aware preset resolution is involved.
**Why blocking:** R6 is a must requirement listing multiple existing behaviors. Current tests would allow regressions in several of those behaviors while still passing.

### 3. R8 config.local preservation is not asserted
**Target:** specs/294-setup-preset-options/tests/official-state.test.js
**Issue:** The R8 test checks that config.local private entries are not copied into public config, but it does not assert that .senti/config.local.json itself remains preserved and separated after official state writes.
**Required change:** After ensureSetupOfficialPresetState, read .senti/config.local.json and assert the private local plugin entries remain intact and are not replaced or polluted by public official package state.
**Why blocking:** R8 requires preserving config.json and config.local.json separation. An implementation that deletes or rewrites config.local could pass the current test.

### 4. R9 bounded-resource coverage is incomplete
**Target:** specs/294-setup-preset-options/tests/preset-candidates.test.js
**Issue:** The R9 test only checks the enabled package count limit. It does not cover plugin registry size/path limits, official metadata read bounds, or preset chain depth limits.
**Required change:** Add R9 tests that exercise existing path/size limit enforcement for plugin or official preset metadata reads and a preset chain depth limit failure.
**Why blocking:** R9 is a must requirement for bounded resource usage. Current tests would pass an implementation that enforces only package count while missing the other required limits.


## Advisory Findings

### 1. R7 source regex is brittle
**Target:** specs/294-setup-preset-options/tests/setup-parity.test.js
**Improvement:** Supplement or replace the source text regex with a behavior-oriented setup candidate/tree test showing setup uses shared candidate discovery for non-core presets.
**Why non-blocking:** R7 is a should requirement, and the current static check still guards the specific known PRESETS regression, but it can be bypassed without proving production behavior.
