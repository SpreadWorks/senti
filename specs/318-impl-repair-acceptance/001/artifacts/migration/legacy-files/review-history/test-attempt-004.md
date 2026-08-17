# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-impl-repair-acceptance/test-coverage.json`

## Blocking Findings

### 1. Fingerprint tests rely on caller-supplied changed paths instead of collection behavior
**Target:** specs/318-impl-repair-acceptance/tests/repair-lifecycle.test.js R3
**Issue:** The R3 test manually adds new and removed files to the changedPaths argument before asserting fingerprint changes. That can pass even if production fingerprint collection fails to discover additions or removals under src/, plugins/, .senti/config.json, the active spec, or active spec tests.
**Required change:** Add spec-local coverage that exercises the production path collection/discovery path for additions, removals, and content changes, without manually injecting the changed file list for each case.
**Why blocking:** R3 requires the repair fingerprint to change for any addition, removal, or content change under the defined inputs. The current test encodes an implementation premise that changed paths are already complete, so it can pass without exercising the required production behavior.

### 2. Acceptance review lacks repaired-path evidence contract coverage
**Target:** specs/318-impl-repair-acceptance/tests/repair-closure-cli.test.js and specs/318-impl-repair-acceptance/tests/semantic-acceptance.test.js R5
**Issue:** R5 requires each acceptance judgment to use either the impl-repair audit or an explicit no-repair record. The CLI test covers only the no-repair PASS path prompt; there is no acceptance-review test after an impl-repair ledger exists that verifies the audit is consumed or referenced.
**Required change:** Add a spec-local acceptance-review scenario after an impl-review FAIL and completed impl-repair that verifies judgments or the acceptance prompt/reference data include the impl-repair audit entry rather than the no-repair record.
**Why blocking:** The requirement has no corresponding spec-local coverage for the repaired lifecycle path, so implementation could always use the no-repair record or ignore the repair audit and still satisfy the current tests.


## Advisory Findings

No advisory findings.