# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-impl-repair-acceptance/test-coverage.json`

## Blocking Findings

### 1. Repair invalidation detail is not asserted
**Target:** specs/318-impl-repair-acceptance/tests/repair-lifecycle.test.js
**Issue:** R4 requires each invalidated artifact path to be recorded with its invalidation reason and previous fingerprint. The tests only assert the list of invalidated artifact filenames and, in the CLI path, that the ledger has a previousFingerprint plus invalidatedArtifacts. They do not require per-invalidated-artifact records containing both reason and previous fingerprint, so an implementation could satisfy these tests while omitting the required invalidation metadata.
**Required change:** Add a spec-local assertion that the repair invalidation/audit artifact records every invalidated artifact path together with the reason and previous fingerprint for that artifact.
**Why blocking:** An acceptance requirement has no corresponding spec-local coverage for a required artifact contract field.

### 2. Tests directly mutate flow state to reach success paths
**Target:** specs/318-impl-repair-acceptance/tests/repair-closure-cli.test.js
**Issue:** R8 requires the public CLI repair flow tests to verify behavior without directly mutating flow state or evidence to force success. setupProject constructs and saves a flow state with prior steps marked done and test-execute in_progress, bypassing the public CLI lifecycle needed to reach the tested state.
**Required change:** Use public CLI setup/progression commands, or limit direct fixture state writes to non-R8 tests and add an R8 public-CLI-only scenario that reaches the repair lifecycle without directly saving step statuses.
**Why blocking:** The test encodes a static anti-pattern specifically prohibited by R8 and can pass without exercising the production CLI path that establishes the prerequisite flow state.


## Advisory Findings

No advisory findings.