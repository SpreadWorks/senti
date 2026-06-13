# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. R6 test does not exercise non-help execution ownership
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js: R6 test
**Issue:** The test named "non-help execution still routes through existing dispatchers" only invokes help paths: `docs --help` and `help docs`. An implementation could break normal command execution, argument parsing, exit codes, flow lifecycle hooks, or plugin hook dispatch and this test would still pass.
**Required change:** Add focused regression coverage that executes representative non-help command paths owned by the existing dispatchers, including the ownership surfaces named by R6 that are in scope for this migration.
**Why blocking:** R6 is marked covered, but the actual test does not exercise the required production behavior.

### 2. R2 registry source-of-truth is not proven
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js: R2 test
**Issue:** The test checks that rendered top-level help contains the current command names, but it would also pass if `renderHelp` still used a private static layout with the same text. `Array.isArray(help.commands) === false` does not rule out another static `LAYOUT` source of truth.
**Required change:** Add a registry-driven assertion, such as rendering with a registry-only fixture command or otherwise proving top-level output changes from command metadata rather than a static layout.
**Why blocking:** R2 requires migration away from static `src/help.js` layout as source of truth, and the current test can pass without that migration.

### 3. R3 semantic parity coverage is too shallow
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js: R3 test
**Issue:** The R3 test only checks for `docs`, `build`, `docs build`, and `Usage:`. It does not verify preserved args/options, descriptions, subcommand listing semantics, or experimental markers from the shared metadata source.
**Required change:** Assert representative command and subcommand help output includes preserved usage, args/options, descriptions, subcommand entries, and experimental markers from metadata.
**Why blocking:** R3 explicitly requires semantic parity for these user-visible help fields, but the test would pass with incomplete renderer output.

### 4. R7 coverage artifact contradicts executable coverage
**Target:** Requirement-to-Test Coverage Artifact and specs/292-command-help-registry/tests/plugin-help-rendering.test.js
**Issue:** The artifact marks R7 covered only by `plugin-help-rendering.test.js`, but that R7 test covers plugin renderer calls only. It does not cover the full R7 list: top-level core help, core command help, core subcommand help, and locale-specific rendering under the R7 requirement mapping.
**Required change:** Add or relabel executable tests with `// spec: R7` coverage for every public help surface named by R7, including the core and locale-specific surfaces.
**Why blocking:** R7 is a must requirement, and the declared coverage does not match the actual tests for that requirement.

### 5. R9 convention-discovery guard would pass without exercising the risk
**Target:** specs/292-command-help-registry/tests/plugin-help-rendering.test.js: R9 test
**Issue:** The test asserts `resolveCommand("undiscovered") === null`, but the fixture never creates an unlisted `commands/undiscovered.js` file. Therefore the test would pass even if convention-based discovery were added, as long as there is no file to discover.
**Required change:** Create an unlisted command file in the plugin commands directory and assert it is not resolved, rendered, or executable unless declared in plugin contributions.
**Why blocking:** R9 specifically forbids convention-based plugin command discovery, but the current test does not exercise that forbidden case.


## Advisory Findings

No advisory findings.