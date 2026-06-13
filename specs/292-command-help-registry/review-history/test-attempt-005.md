# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. Migration parity is asserted only by loose substrings
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js / specs/292-command-help-registry/tests/plugin-help-rendering.test.js
**Issue:** R3 and R7 require preserving retained public help surfaces by semantic parity, but the tests only assert broad substrings such as `Usage:`, `Subcommands:`, command names, or a locale difference. These assertions can pass while dropping or changing descriptions, arguments, options, subcommand listings, experimental markers, or whole sections.
**Required change:** Add spec-local parity assertions that compare the rendered metadata-backed help against the retained expected public help content for representative top-level, command, subcommand, plugin, and localized surfaces, including usage, args/options, descriptions, subcommands, and experimental markers where applicable.
**Why blocking:** The current tests do not exercise the acceptance requirement that user-visible help is preserved; an implementation could satisfy the tests while regressing public help output.

### 2. R12 omits direct plugin top-level help surface
**Target:** specs/292-command-help-registry/tests/plugin-help-rendering.test.js
**Issue:** R12 requires plugin help through `senti help <plugin>` and direct plugin `--help` to be renderer-backed metadata paths. The test only covers `senti help sample` and `senti sample --help`; it does not cover the plugin top-level help surface for the plugin namespace itself, despite R7 also requiring plugin top-level help.
**Required change:** Add an executable assertion for the plugin top-level help invocation surface, such as `senti help example` if `example` is the plugin namespace, and verify it renders through metadata without invoking plugin command behavior.
**Why blocking:** A required public help surface has no corresponding spec-local executable coverage.

### 3. R6 execution ownership coverage is too narrow for required preservation scope
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js / specs/292-command-help-registry/tests/plugin-help-rendering.test.js
**Issue:** R6 requires dispatchers, argument parsing, exit codes, plugin command execution, flow lifecycle hooks, and plugin hook dispatch to remain semantically unchanged. The tests cover a hook command, one flow get path, one invalid option, one plugin execution, and one hook dispatch, but they do not cover exit-code preservation for plugin execution or representative non-help execution for command metadata paths such as docs commands.
**Required change:** Add focused non-help regression assertions for at least one metadata-backed core command execution path and plugin command exit-code/argument behavior, in addition to the existing dispatcher and hook checks.
**Why blocking:** Help rendering changes could accidentally intercept or alter non-help execution for core or plugin commands while these tests still pass.


## Advisory Findings

### 1. R10 self-check is only a placeholder
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js
**Improvement:** The `R10` test currently only asserts `true`. It would be more useful to read the spec-local test files and verify each file has a `// spec:` header with requirement ids.
**Why non-blocking:** The coverage artifact already records valid headers, and the test files shown do include headers, so this is a test-strength improvement rather than a blocker.
