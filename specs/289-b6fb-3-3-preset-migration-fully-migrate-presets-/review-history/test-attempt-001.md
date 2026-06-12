# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/test-coverage.json`

## Blocking Findings

### 1. Resolver behavior is not exercised
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js R2/R5
**Issue:** The tests assert regexes against source files instead of resolving preset chains, includes, locale templates, or AGENTS templates. They would pass if matching helper names existed in comments or dead code while runtime still fell back to bundled official presets, accepted unregistered preset keys, searched plugin directories broadly, or ignored depth/count limits.
**Required change:** Add executable spec-local tests that construct enabled plugin registry fixtures and call the actual preset/include/i18n/AGENTS resolution APIs, asserting registry-only resolution, deterministic chain order, and max chain/include limits.
**Why blocking:** R2 and R5 are behavioral acceptance requirements; the current tests can pass without exercising production behavior.

### 2. Upgrade provider completion is only source-scanned
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/upgrade-migration-contract.test.js R3
**Issue:** R3 requires `senti upgrade` to search at most 100 plugin sources, add the official default source when needed, install and enable the provider plugin, record git reproducibility metadata, stop parent traversal at depth 16, and fail non-zero when a provider is missing. The test only checks for strings and constants in `src/upgrade.js`.
**Required change:** Add executable upgrade tests using temporary project fixtures and plugin source fixtures that verify successful provider completion, metadata persistence, source search limit, chain depth limit, and non-zero failure for unresolved parent providers.
**Why blocking:** The requirement's critical migration behavior has no corresponding executable coverage and the current static regex test would pass without the upgrade path working.

### 3. Legacy preset migration behavior is not covered
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/upgrade-migration-contract.test.js R4
**Issue:** R4 requires concrete migration outcomes for legacy `.senti/presets/<key>` directories, including manifest preservation, manifestless inherited parent/scan/chapters, bare fallback, clear failure, and ensuring runtime resolution does not treat legacy directories as leaf overrides. The test only searches `src/upgrade.js` text for related words.
**Required change:** Add executable temporary-project upgrade and resolver tests covering legacy preset directories with and without `preset.json`, matched and unmatched providers, failure messaging, and post-migration runtime resolution behavior.
**Why blocking:** This migration is a core acceptance requirement; keyword checks can pass without performing or validating the migration.

### 4. CLI exit-code requirements are not verified
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/upgrade-migration-contract.test.js R9
**Issue:** R9 explicitly requires spec-local tests to verify success and failure exit-code conditions for provider completion and migration errors. The current test only scans source for `Envelope.fail`, `EXIT_ERROR`, or `process.exit` and does not run the CLI or assert exit status.
**Required change:** Add CLI-level tests that invoke `senti upgrade` or the command entrypoint for provider completion success and migration error cases, asserting stable command/options and exact zero/non-zero exit status.
**Why blocking:** The coverage artifact marks R9 covered, but the actual test does not cover the required exit-code behavior.

### 5. Plugin preset import boundary is incomplete
**Target:** specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/preset-runtime-boundary.test.js R6
**Issue:** R6 requires plugin preset code to obtain `pathMatch.*` helpers through public container APIs and not import main package internal preset paths. The test only checks registrations in `src/lib/container.js` and one import pattern inside that same file; it does not inspect plugin preset/DataSource code for forbidden internal imports.
**Required change:** Add a static boundary test that scans plugin preset source/DataSource files and fails on imports of main package internal preset paths such as `src/presets/lib/path-match.js` or equivalent relative internal paths, while checking usage of the public container API.
**Why blocking:** The actual prohibited dependency can remain in plugin preset code while this test passes, so the acceptance requirement is not covered.


## Advisory Findings

No advisory findings.