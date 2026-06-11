# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/288-workflow-plugin-migration/test-coverage.json`

## Blocking Findings

### 1. Command behavior and validation are only checked by string presence
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R2
**Issue:** The R2 test only verifies that commands/workflow.js exists, contains subcommand names, and lacks a few core-import patterns. It does not exercise add, update, show, search, list, publish, or ideas behavior, and it does not test user-facing argument or option validation at the plugin command entry point.
**Required change:** Add spec-local executable command-entry tests for each workflow subcommand, including representative valid input and invalid argument/option cases from the validation contract.
**Why blocking:** R2's central acceptance requirement can pass with a stub file or comments, so the coverage artifact claims coverage that the actual test does not provide.

### 2. Plugin-owned shared services are not proven to be used
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R3
**Issue:** The R3 test only checks that service filenames exist and that hooks do not shell out to the workflow CLI. Empty service files or duplicated command/hook implementations would pass.
**Required change:** Add tests that verify workflow commands and hooks call the plugin-owned board, publish, issue-start, and ideas services through shared service APIs, preferably with stubs/spies at the service boundary.
**Why blocking:** R3 requires plugin-owned services shared by commands and hooks for specific behavior; filename existence does not exercise production behavior or sharing.

### 3. Flow hook lifecycle contract is not exercised
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R4
**Issue:** The R4 test searches hook source for prepare/finalize strings and issue-log related words, but does not verify that core runs prepare.post after writing flow state with hook snapshot, spec path, runId, and linked issue, nor that finalize-cleanup.post receives durable spec/issue-log/artifact paths. It also does not verify non-fatal handling for board config, gh, or AI refinement failures.
**Required change:** Add integration-style tests for the generic flow lifecycle invoking prepare.post and finalize-cleanup.post hooks with asserted context fields and simulated business failures that produce warnings, issue-log entries, or follow-ups without failing the main command.
**Why blocking:** The required core/plugin lifecycle behavior is critical and currently untested; the existing regex test would pass without the hook contract working.

### 4. AI provider/profile override behavior is not covered
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R5
**Issue:** The R5 test only looks for config.workflow.agent and api.agent/context.agent strings. It does not verify publish, idea candidate classification, similarity, and composition call sites resolve plugin.config.workflow.agent.<name> overrides, fall back to the workflow-neutral plugin agent API, or pass needed root config values such as lang.
**Required change:** Add tests for each workflow AI call site using a fake public plugin agent context that records resolve/call inputs for override and fallback cases, including lang propagation.
**Why blocking:** R5 can pass with unused strings while the migrated plugin still calls the wrong agent, ignores overrides, or imports private core behavior.

### 5. Removed public subcommands can still pass the test
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R9
**Issue:** The R9 regex only fails when issue-start or issue-log-import appears near the words public or subcommand. A real compatibility alias such as a switch case, command map entry, or help row could pass if those words are absent.
**Required change:** Add command-entry and help/discovery tests asserting issue-start and issue-log-import are rejected or absent as public subcommands, while ideas remains available.
**Why blocking:** R9 explicitly requires removal without compatibility aliases; the current static pattern can miss the prohibited API surface.

### 6. Installability and smoke verification are not tested
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R11
**Issue:** The R11 test only checks .senti/config.json contains a workflow package and source path. It does not verify the plugin can actually be installed/enabled, discovered by the CLI, run as senti workflow, or participate in flow hook behavior.
**Required change:** Add a smoke test that enables the external plugin from the recorded workspace/source, runs a harmless senti workflow command such as help/list with test fixtures, and verifies prepare/finalize hook discovery or invocation.
**Why blocking:** R11 requires installable/enabled and smoke-verifiable behavior; config shape alone is not sufficient coverage.

### 7. Upgrade evidence requirement is not validated
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js R12
**Issue:** The R12 test only scans selected source and deployed files for old workflow strings. It does not detect whether src/skills, src/presets, source templates, or deployed skill artifacts changed, does not verify senti upgrade was run, and does not compare generated artifacts against sources.
**Required change:** Add an explicit upgrade evidence check, such as a generated-artifact comparison or recorded command evidence, and include source template paths in the conditional coverage when those inputs change.
**Why blocking:** R12 can pass with stale generated artifacts or without running the required upgrade step after source changes.


## Advisory Findings

No advisory findings.