# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/284-plugin-mechanism-workflow-presets/test-coverage.json`

## Blocking Findings

### 1. External plugin repo paths make tests environment-dependent
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-preset-registry.test.js and specs/284-plugin-mechanism-workflow-presets/tests/workflow-plugin-migration.test.js
**Issue:** The tests default SENTI_PRESETS_REPO and SENTI_WORKFLOW_PLUGIN_REPO to hard-coded absolute paths under /home/nakano/workspace and then assert those plugin.json files exist. In a clean CI or reviewer workspace these tests are not executable unless unrelated sibling repositories happen to exist at those exact paths.
**Required change:** Create the senti-presets and workflow plugin fixtures inside the test temp directory or point to checked-in spec fixtures, then use those paths consistently for install/upgrade assertions.
**Why blocking:** A test suite that depends on author-local absolute paths can fail before exercising the implementation and does not provide reliable spec-local acceptance coverage for R7 and R8.

### 2. Bounded preset parent-chain validation is not actually tested
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-preset-registry.test.js R6 test
**Issue:** The R6 test name claims bounded parent chains are validated, but the only parent-chain assertion is doesNotThrow for a valid chain. An implementation with no cycle detection or max-depth enforcement would still pass.
**Required change:** Add a spec-local plugin preset fixture with a cycle or chain exceeding maxDepth and assert validatePresetChain fails for it.
**Why blocking:** R6 explicitly requires bounded parent-chain validation, and the current test would pass without exercising that required production behavior.

### 3. Core command override rejection is not asserted
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/workflow-plugin-migration.test.js R9 test
**Issue:** The test installs a plugin that contributes a core command name, docs, but only asserts the core docs help still works and plugin list output mentions the conflict. It does not require the override to be rejected, so warning or silent ignore behavior could pass.
**Required change:** Assert that a plugin declaring a command with a core command name is rejected by plugin validation, registry loading, install, or list with a non-zero failure, while a non-core plugin command remains dispatchable in a separate valid fixture.
**Why blocking:** R9 requires rejecting core command overrides; the current test encodes a weaker premise and could pass an implementation that does not enforce the rejection.

### 4. Clean local Git repo requirement lacks dirty-repo regression coverage
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js R2/R3 coverage
**Issue:** Local path discovery is tested only with committed clean repositories. There is no test that an uncommitted or dirty local Git plugin source is refused or otherwise prevented from producing an unreproducible installed commit.
**Required change:** Add a local Git fixture with uncommitted changes after the initial commit and assert repo add, find, or install fails with an error explaining the source must be clean.
**Why blocking:** R2 calls out clean Git local path repo sources and R3 requires reproducible commits; without this regression, an implementation can accept dirty local sources and still pass the current tests.


## Advisory Findings

No advisory findings.