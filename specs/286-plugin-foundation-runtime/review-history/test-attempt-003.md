# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/286-plugin-foundation-runtime/test-coverage.json`

## Blocking Findings

### 1. R4 prepare snapshot test expects a deleted hook to be snapshotted
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js / test "R4: flow prepare snapshots hook plans into flow.json and active flows use the snapshot"
**Issue:** The test writes a hook snapshot into an unrelated flow.json, deletes the installed hook module, then calls runPrepareWithPluginHooks() and expects the new prepare flow to contain that deleted hook. This contradicts the requirement that successful flow prepare snapshots the currently validated hook plans from installed/enabled plugin roots.
**Required change:** Keep the hook module present when testing prepare-time snapshot creation. Test active-flow non-rediscovery separately by loading an existing flow snapshot and ensuring newly added hook files are not discovered for that active flow.
**Why blocking:** As written, the test encodes an incorrect implementation premise and would force prepare to reuse stale/unrelated snapshot state instead of validating and snapshotting installed hooks at prepare time.

### 2. R5 public hook context omits flow coverage
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js / test "R5: hook runner exposes public context and normalizes non-blocking failures"
**Issue:** The requirement explicitly includes flow in the public hook context, but the recording hook only asserts project, plugin, config, result, artifacts, and envelope helpers.
**Required change:** Have the hook record and assert an expected context.flow value, with the test passing representative flow context into runFlowCommandHooks or runFlowCommandWithPluginLifecycle.
**Why blocking:** An implementation could omit context.flow entirely and still pass this test, leaving an acceptance requirement without spec-local regression coverage.

### 3. R9 issue-start preservation assertion can pass vacuously
**Target:** specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js / test "R9: official workflow plugin prepare.post hook preserves migrated issue-start behavior"
**Issue:** The assertion uses issueLogEntries?.every(...), which is true for an empty array, and the preceding JSON match accepts either issue-start or workflow. A result that contains workflow metadata but creates no issue-start candidate could pass without preserving the required behavior.
**Required change:** Assert that issueLogEntries is an array with length greater than zero and that at least one entry has pluginId "workflow" and a reason or payload specifically matching issue-start behavior.
**Why blocking:** This is a static anti-pattern that can pass without exercising the production behavior required by R9.


## Advisory Findings

No advisory findings.