# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. R2 default top-level help is not forced onto the registry path
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js :: R2 top-level core help is generated from registry metadata, not a static layout
**Issue:** The test verifies buildCoreHelpModel(allCommands) separately and verifies renderHelp honors an injected commands fixture, but the production default renderHelp({ root, argv: [], lang }) is only checked for existing output fragments. An implementation could still use a private static src/help.js layout for the default top-level help and pass these assertions.
**Required change:** Add a spec-local assertion that the default top-level help path is observably driven by the core command metadata registry, not only by an injected commands argument or matching legacy text.
**Why blocking:** R2 explicitly requires the current top-level help source of truth to move from the static layout to the core registry/metadata path; the current test can pass without exercising that production behavior.

### 2. Plugin CLI help surfaces are not proven to use the shared renderer
**Target:** specs/292-command-help-registry/tests/plugin-help-rendering.test.js :: R12 plugin CLI help surfaces render metadata without running plugin command behavior
**Issue:** The plugin R12 test checks resolveHelpSurfaceOwner return values and a few CLI output fragments, but it does not compare plugin CLI help output to the shared renderer output. A separate plugin help implementation using the manifest directly could pass while not being renderer-backed.
**Required change:** For plugin command and subcommand CLI help surfaces, compare the CLI output with help.renderCommandHelp for the same root/topic; add an equivalent renderer-backed assertion for plugin package top-level help if that surface has a public renderer API.
**Why blocking:** R12 requires plugin help invocation surfaces to be renderer-backed metadata paths. The current assertions can pass without exercising the shared renderer path for those public plugin CLI surfaces.


## Advisory Findings

### 1. R11 execution ownership check is narrow
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js :: R11 independent top-level commands have explicit metadata owners
**Improvement:** Consider adding lightweight resolveExecutionOwner assertions for help, setup, upgrade, plugin, and presets list so the test covers the 'existing execution entrypoints remain unchanged' clause as well as metadata ownership.
**Why non-blocking:** R6 already covers representative non-help execution ownership, and R11's central acceptance point is explicit metadata ownership for those commands.
