# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/284-plugin-mechanism-workflow-presets/test-coverage.json`

## Blocking Findings

### 1. R2 repo update and list behavior are only covered by help text
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-config-cli.test.js
**Issue:** The R2 test asserts that `plugin repo --help` mentions `repo update` and `repo list`, but no spec-local test executes those repo management commands or verifies that they mutate/report repository state correctly. Help text could pass while the required repo management behavior is unimplemented.
**Required change:** Add executable spec-local coverage for `plugin repo list` and `plugin repo update` against a clean local Git plugin repo, asserting expected state/output after add/update.
**Why blocking:** R2 requires plugin repo management, and the current tests only exercise `repo add` plus candidate discovery; `repo update` and `repo list` have no corresponding production-behavior coverage.

### 2. R8 workflow plugin extraction test is self-fulfilling
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/workflow-plugin-migration.test.js
**Issue:** `R8: workflow command skill and config contributions live in senti-workflow-plugin` creates a temporary compliant workflow plugin fixture and then verifies that same fixture. This would pass even if the real `senti-workflow-plugin` artifact, migrated workflow command, skills, schema/defaults, or official plugin root do not exist.
**Required change:** Change the test to inspect the production workflow plugin artifact/root that implementation is expected to ship, and verify its `plugin.json`, command, skills, config schema/defaults, and flowIntegration support there.
**Why blocking:** R8 requires moving workflow functionality out of core into `senti-workflow-plugin`; the current test does not exercise production behavior and can pass without that move.

### 3. R8 upgrade coverage depends on a preconfigured workflow repo
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/workflow-plugin-migration.test.js
**Issue:** The upgrade test only covers projects that already have a workflow plugin repo configured. R8 requires enabling the workflow plugin for every valid existing project during upgrade, which includes legacy projects without any preexisting plugin repo/package configuration.
**Required change:** Add a spec-local upgrade test for a valid legacy project with no workflow plugin repo/package configured, asserting upgrade installs/enables the official workflow plugin and preserves `workflow.flowIntegration`.
**Why blocking:** An implementation could satisfy the current tests by installing from an already configured fixture repo while failing the required migration path for ordinary existing projects.


## Advisory Findings

### 1. R9 source regex is narrow
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-config-cli.test.js
**Improvement:** The `assert.doesNotMatch` check for `workflow: "workflow/index"` only catches one old hardcoding shape. A behavioral assertion that `workflow` is available only through an enabled plugin would be more resilient.
**Why non-blocking:** Other R9 tests already exercise disabled plugin command failure, core command precedence, override rejection, and custom plugin dispatch, so this is mainly a robustness improvement.
