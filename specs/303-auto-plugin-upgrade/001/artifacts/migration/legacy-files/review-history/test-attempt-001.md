# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/303-auto-plugin-upgrade/test-coverage.json`

## Blocking Findings

### 1. R2 update-all cap and single-upgrade behavior are untested
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js: R2 test
**Issue:** The R2 test uses only one enabled package and only checks that upgrade ran, so an implementation could process more than 100 enabled packages or run upgrade multiple times and still pass.
**Required change:** Add executable update-all coverage that creates more than 100 enabled packages and asserts only 100 are processed, and that multiple changed packages trigger exactly one automatic upgrade.
**Why blocking:** R2 is a must requirement and the coverage artifact marks it covered, but two required behaviors have no corresponding spec-local test coverage.

### 2. R5 update-all --no-upgrade behavior is not exercised
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js: R5 test
**Issue:** The test executes install with --no-upgrade, but update-all is only checked through help output. An implementation could show the option for update-all while still running upgrade or mishandling the option at runtime.
**Required change:** Add a changed-package update-all scenario using --no-upgrade and assert the command succeeds, reports upgrade.ran false, and does not deploy upgraded plugin artifacts.
**Why blocking:** R5 is a must requirement and requires --no-upgrade to be accepted by and suppress automatic upgrade for both install and update-all.

### 3. R6/R7 update-all upgrade failure path is missing
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js: R7 test
**Issue:** Upgrade failure is induced only for plugin install. update-all could exit zero, omit package operation data, or omit upgrade failure details after a failed automatic upgrade and the tests would not catch it.
**Required change:** Add a --json update-all test where at least one package updates and automatic upgrade fails, then assert non-zero exit, package metadata is still present, and upgrade.ran true, upgrade.succeeded false, and failure details are exposed.
**Why blocking:** R6 and R7 are must requirements covering both install and update-all failure reporting.

### 4. R9 plugin-side script non-execution is not covered
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js: R9 coverage
**Issue:** No fixture defines a plugin-side script or observable script side effect, so the suite cannot detect an implementation that accidentally executes plugin-side scripts during install, update-all, sync, or source update.
**Required change:** Add behavior-level coverage using the existing plugin-side script mechanism with a side effect marker, and assert the marker is not created by the relevant plugin commands.
**Why blocking:** R9 is a must requirement and explicitly includes plugin-side scripts not being executed.

### 5. R10 update-all overlay persistence risk is untested
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js: R10 test
**Issue:** The overlay test covers install only. update-all changes package commit metadata, so it is the higher-risk path for accidentally persisting overlay-only private sources or packages into public .senti/config.json.
**Required change:** Add an update-all scenario with an overlay-only private package whose source has a newer commit, then assert update/upgrade output is computed from merged config while public .senti/config.json still contains no private sources or packages.
**Why blocking:** R10 is a must requirement for automatic-upgrade changes, and current coverage does not exercise the update-all write path.


## Advisory Findings

### 1. R8 human output coverage is narrow
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js: R8 test
**Improvement:** Add human-output assertions for update-all and for skipped or failed upgrade states, including order after plugin operation output and presence of skip or failure text.
**Why non-blocking:** R8 is marked should, and the current install success check gives partial baseline coverage, but broader cases would better document the intended CLI contract.
