# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/test-coverage.json`

## Blocking Findings

### 1. R8 test self-matches forbidden official preset names
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js R8
**Issue:** The R8 test scans main test files for actual official preset names, but the contract file itself contains those names in the forbidden regex and also uses `webapp` in the R2 test. If this file is installed under `tests/` as the coverage artifact says, it will fail before implementation and it also contradicts the R8 fixture rule.
**Required change:** Remove actual official preset names from executable contract-test fixtures, replace `webapp` with a generic unregistered preset scenario, and make the R8 scanner avoid matching its own forbidden-name definition.
**Why blocking:** The test is not executable as a main repo test and the coverage artifact claims R8 coverage from a file that itself violates R8.

### 2. R3 default source and git metadata are not covered
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/upgrade-migration-contract.test.js R3/R9
**Issue:** The provider success test uses a preconfigured local source. It does not verify adding the official default git source when needed, nor install/enable behavior through a git source, nor reproducibility metadata for git sources.
**Required change:** Add spec-local coverage where upgrade must add the official default source object when no suitable source exists, and add a git-source provider completion case that asserts the enabled package records the resolved commit metadata.
**Why blocking:** R3 has must-level acceptance requirements with no corresponding executable coverage, so an implementation could pass while omitting default-source and git reproducibility behavior.

### 3. R3 bounds test can pass for the wrong reason
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/upgrade-migration-contract.test.js `R3: upgrade enforces source search and parent-chain bounds`
**Issue:** The single bounds test places the valid provider at source index 100 and also requests a depth-17 chain. An implementation can pass by enforcing only one of the two constraints, so source search limit and parent-chain depth are not independently tested. It also lacks a case where a child provider is found but a non-base parent provider cannot be found.
**Required change:** Split this into independent tests: one shallow provider beyond the first 100 sources for source-limit enforcement, one deep chain reachable within the first 100 sources for depth-16 enforcement, and one missing non-base parent in an otherwise found chain.
**Why blocking:** R3 requires all three behaviors; the current test design does not prove them independently and leaves parent-chain provider failure uncovered.

### 4. R4 legacy migration can pass while dropping legacy content
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/upgrade-migration-contract.test.js R4
**Issue:** The tests write legacy preset data files but never assert that those files were copied into a local plugin source and enabled package. The manifestless provider case could pass by ignoring `.senti/presets/child-preset` entirely and resolving only the provider preset, losing local legacy content. There is also no manifestless-without-provider case for the required bare preset fallback.
**Required change:** Assert that upgrade creates/enables the migrated local preset plugin package and that legacy files such as `data/local.js` exist there; add a manifestless no-provider test asserting parent null, empty scan, and empty chapters.
**Why blocking:** R4's core migration requirement is not exercised; tests would pass without preserving user legacy preset content.

### 5. R5 only covers one include path subset
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js R5
**Issue:** R5 requires deterministic resolution for `@presets` includes, locale templates, and AGENTS templates, including project-local root precedence, config type order, leaf-to-root chain order, max chain depth 16, include depth 8, and include count 32. The current tests cover a simple include, unregistered include rejection, and include count only.
**Required change:** Add coverage for locale template and AGENTS template resolution, project-local precedence, config type ordering, leaf-to-root override order, max chain depth 16, and recursive include depth 8.
**Why blocking:** Several must-level resolver behaviors in R5 have no spec-local tests, so implementation could pass while resolving only the simple include case.

### 6. R6 lacks a positive public-container DataSource case
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js R6
**Issue:** The test verifies that an internal `src/presets/lib/path-match.js` import is rejected and that container registrations exist, but it does not verify that a plugin preset DataSource can actually obtain and use the `pathMatch.*` helpers through the public container API.
**Required change:** Add a good plugin DataSource fixture that obtains `pathMatch.hasPathPrefix`, `pathMatch.hasSegmentPath`, or `pathMatch.hasAnyPathPrefix` through the public container API and assert that the DataSource runs successfully.
**Why blocking:** An implementation could reject internal imports and register names while still leaving plugin DataSources unable to use the required public helper path.


## Advisory Findings

No advisory findings.