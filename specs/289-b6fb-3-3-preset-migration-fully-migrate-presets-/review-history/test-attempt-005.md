# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/test-coverage.json`

## Blocking Findings

### 1. R1 source/runtime dependency coverage is incomplete
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js
**Issue:** The R1 test only asserts that src/official-plugins/senti-presets is absent and src/presets contains only base. It does not check that runtime source or main repo tests no longer reference or require bundled official preset content.
**Required change:** Add a spec-local static assertion that scans relevant src runtime files and main tests for references to src/official-plugins/senti-presets and non-base builtin preset content, excluding the contract test itself if needed.
**Why blocking:** R1 explicitly requires official preset content not to be required by runtime source or main repo tests; the current coverage artifact marks R1 covered while that acceptance clause can still pass untested.

### 2. R3 default source test does not prove provider completion
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/upgrade-migration-contract.test.js
**Issue:** The default official source test only checks that a source entry is added. It would pass if upgrade adds the source and exits zero without installing/enabling the provider package or making the preset chain resolvable.
**Required change:** In the default-source test, assert that official-presets is enabled in plugin.packages, the installed plugin exists, reproducibility metadata is recorded, and resolveChain("child-preset", tmp) resolves through the provider.
**Why blocking:** R3 requires adding the default source when needed and installing/enabling the provider plugin; provider completion for that path currently has no direct executable assertion.

### 3. R5 include anti-scan behavior is not exercised
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js
**Issue:** The include test asserts an unregistered @presets key fails, but the fixture does not create an unregistered template file at that include path. A resolver that broadly scans installed plugin presets would still fail because the file is absent, so the test does not exercise the forbidden behavior.
**Required change:** Create .senti/plugins/fixture-presets/presets/unregistered-preset/templates/fragment.md in the fixture and assert @presets/unregistered-preset/templates/fragment.md does not resolve.
**Why blocking:** R5 requires @presets includes not to broadly scan installed plugin presets; the current test has a static anti-pattern that can pass without detecting broad scanning.

### 4. R5 config type order is not covered
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js
**Issue:** The tests cover project-local precedence and leaf-to-root chain precedence, but they do not create two configured preset types with overlapping assets to prove deterministic config type order is honored for include, locale, or AGENTS resolution.
**Required change:** Add a registered second preset type with overlapping template/locale/AGENTS content and assert the first entry in presetTypes wins before the later type is considered.
**Why blocking:** R5 requires deterministic search by config type order; the current spec-local tests do not cover that acceptance requirement.


## Advisory Findings

### 1. Sort preset directory entries before comparison
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js
**Improvement:** Sort presetEntries before asserting deep equality with ["base"].
**Why non-blocking:** Most environments return stable directory order for this single-entry case, but sorting makes the assertion deterministic if additional failure entries are present.
