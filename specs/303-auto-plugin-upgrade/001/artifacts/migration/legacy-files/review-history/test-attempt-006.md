# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/303-auto-plugin-upgrade/test-coverage.json`

## Blocking Findings

### 1. Install auto-upgrade invocation is not directly covered
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js / test "R1: install runs upgrade and deploys plugin skill by default"
**Issue:** The test only verifies the deployed skill side effect. An implementation could copy/deploy plugin skills during install without actually running `senti upgrade` and still pass this test.
**Required change:** Add a spec-local install case that uses the existing `writeUpgradeProbe` PATH shim and asserts `senti upgrade` is invoked exactly once after a successful `senti plugin install <id>`.
**Why blocking:** R1 is a must requirement that specifically requires `senti plugin install <id>` to run `senti upgrade`; the current test can pass without exercising that production behavior.

### 2. Unchanged update-all metadata is not asserted
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js / test "R3: update-all skips upgrade and reports a skip reason when no package commits change"
**Issue:** The unchanged package case asserts only `updated: false`. It does not assert that `previousCommit` and `commit` are still recorded for the processed package.
**Required change:** In the unchanged update-all test, assert `output.packages[0].previousCommit === plugin.commit` and `output.packages[0].commit === plugin.commit`.
**Why blocking:** R2 is a must requirement that requires `previousCommit`, `commit`, and `updated` for each processed enabled package; an implementation could omit commit metadata for unchanged packages and still pass.

### 3. Install JSON no-upgrade skip path is untested
**Target:** specs/303-auto-upgrade/tests/plugin-auto-upgrade.test.js / tests "R5: no-upgrade is accepted..." and "R6: JSON output for install exposes..."
**Issue:** There is no test for `senti plugin install <id> --json --no-upgrade`. The suite therefore does not verify that install JSON output still includes plugin operation data and an `upgrade` object when automatic upgrade is skipped.
**Required change:** Add an install JSON no-upgrade assertion covering the package operation data plus `upgrade.ran: false`, a no-upgrade skip reason, and the required success-status field exposed by the upgrade object.
**Why blocking:** R5 and R6 are must requirements; an implementation could handle human `install --no-upgrade` correctly while omitting or malformedly reporting the JSON skipped-upgrade object.


## Advisory Findings

### 1. Human skipped and failed upgrade states are not covered
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js / R8 human-output coverage
**Improvement:** Add human-output checks for a skipped upgrade path, such as `install --no-upgrade` or unchanged `update-all`, and a failed automatic upgrade path, asserting the single upgrade line includes the state word plus skip reason or failure message.
**Why non-blocking:** R8 is a should requirement, and the critical JSON failure/skip behavior is covered elsewhere; this would improve confidence in human output formatting without blocking implementation.
