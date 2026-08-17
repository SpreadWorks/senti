# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/286-plugin-foundation-runtime/test-coverage.json`

## Blocking Findings

### 1. R4 snapshot behavior is not actually exercised for active flows
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js :: R4 test
**Issue:** The test manually writes and later reloads a snapshot from a pre-existing flowPath, but it never executes an active-flow command after adding hooks to prove the runtime uses flow.json plugins.flowCommandHooks instead of re-discovering installed hook files.
**Required change:** After prepare writes the real flow.json snapshot, mutate the installed hooks and execute an active-flow lifecycle path that would discover the new hook if re-discovery occurred; assert only the snapshot hook runs.
**Why blocking:** R4 explicitly requires active flows to use the snapshot without re-discovering hooks, and the current test can pass without exercising that production behavior.

### 2. R4 prepare snapshot does not assert required snapshot fields
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js :: R4 test
**Issue:** The prepare assertion only checks snapshot length and module for the flow produced by runPrepareWithPluginHooks. It does not verify apiVersion, pluginId, className, command, hook, priority, or absence of absolute paths in the prepared flow.json snapshot.
**Required change:** Assert the prepared flow.json plugins.flowCommandHooks entry exactly contains the required R4 fields and that no stored value includes the plugin root or any absolute path.
**Why blocking:** R4 requires those fields on successful flow prepare; an implementation could omit most of them and still satisfy the current test.

### 3. R3 lacks coverage for one-hook-per-file enforcement
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js :: R3 test
**Issue:** The tests validate one normal hook class per file, but they do not reject a hook module that returns multiple hook classes or another multi-hook structure from a single hooks/*.js file.
**Required change:** Add a spec-local case where register(api) returns multiple hook classes from one hooks/*.js module and assert discovery rejects it with an actionable error.
**Why blocking:** R3 explicitly requires one hook per hooks/*.js file; without this regression test, an implementation can allow multiple hooks per file while the coverage artifact still reports R3 covered.

### 4. R1 plugin CLI JSON output is not covered
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js :: R1 test
**Issue:** The test checks renderPluginList only with json: false. Because the helper accepts a json option, JSON CLI output could still expose repo instead of source and the test would pass.
**Required change:** Add an assertion for renderPluginList(resolved, { json: true }) verifying the output uses source/packages[].source terminology and does not include repo fields.
**Why blocking:** R1 requires plugin CLI output to replace repo terminology with source terminology; leaving a CLI output mode untested is a direct acceptance coverage gap.


## Advisory Findings

No advisory findings.