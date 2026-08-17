# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/303-auto-plugin-upgrade/test-coverage.json`

## Blocking Findings

### 1. Unchanged update-all does not prove upgrade was skipped
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js - R3 test
**Issue:** The test asserts only `output.upgrade.ran === false` and a skip reason. It does not detect whether `senti upgrade` was actually invoked and then falsely reported as skipped.
**Required change:** Run the unchanged `update-all` case with an upgrade invocation probe or equivalent sentinel and assert that no upgrade invocation occurred.
**Why blocking:** R3's required behavior is that upgrade does not run when no package commit changes; the current test can pass without exercising that production behavior.

### 2. sync/source update absence of upgrade is not observed
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js - R4 test
**Issue:** The test checks that deployed content remains old and that stdout has no upgrade status line, but an implementation could still invoke `senti upgrade` and redeploy the same pinned content without being detected.
**Required change:** Use an upgrade invocation probe for `plugin sync` and `plugin source update`, then assert the probe was not called.
**Why blocking:** R4 requires these commands to never trigger automatic upgrade; the current assertions do not prove the command was not triggered.

### 3. Script-safety commands can fail without failing the test
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js - R9 script-safety block
**Issue:** The `runSenti` calls for install, update-all, sync, and source update ignore exit status. If those commands fail or no-op before reaching plugin handling, the marker file remains absent and the test still passes.
**Required change:** Assert success for each script-safety command before checking that the plugin-side script marker was not created.
**Why blocking:** This is a static anti-pattern that can pass without exercising production behavior, while R9 requires behavior-level coverage including plugin-side scripts not being executed.

### 4. Overlay upgrade behavior is only reported, not exercised
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js - R10 test
**Issue:** The overlay test verifies `upgrade.ran` and that public config stays empty, but it does not assert that automatic upgrade actually consumed the merged local overlay and deployed the private plugin content, especially after update-all changes the private source.
**Required change:** Assert that the private overlay skill is deployed after install, and that update-all deploys the updated private overlay skill content while public config remains unchanged.
**Why blocking:** R10's critical risk is automatic upgrade respecting private overlays; the current test can pass if output is computed from merged config but upgrade itself ignores the overlay or no-ops.


## Advisory Findings

### 1. Human skipped/failed output cases are thin
**Target:** specs/303-auto-plugin-upgrade/tests/plugin-auto-upgrade.test.js - R8 coverage
**Improvement:** Add human-output cases for skipped update-all with the no-updates skip reason and failed automatic upgrade with the failure message.
**Why non-blocking:** R8 is a should-level requirement, and core JSON failure/skip behavior is already covered elsewhere.
