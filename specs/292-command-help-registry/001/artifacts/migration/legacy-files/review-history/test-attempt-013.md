# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. R12 plugin package help surface is not executable through the CLI
**Target:** specs/292-command-help-registry/tests/plugin-help-rendering.test.js: R12 test
**Issue:** The test asserts `resolveHelpSurfaceOwner(["help", "example"], { root })` and runs `senti help example`, but it never defines executable renderer behavior that maps the plugin package id `example` to the plugin top-level help model. The plugin contribution command is named `sample`, so an implementation could satisfy command help for `sample` while `senti help <plugin>` remains unsupported or ambiguous unless this package-id surface is explicitly asserted against renderer output semantics.
**Required change:** Add the smallest executable assertion that `senti help example` is resolved as plugin package top-level help through metadata and fails if only command-name lookup is implemented, for example by checking package-level help output contains the plugin command list while not treating `example` as a command.
**Why blocking:** R12 explicitly requires plugin help through `senti help <plugin>` to be a renderer-backed metadata path. Without a precise package-id surface test, a required public help invocation can be left unimplemented while adjacent plugin command help tests still pass.


## Advisory Findings

### 1. R2 current-help parity is maintained through a hard-coded command list
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js: EXISTING_CORE_HELP_COMMANDS
**Improvement:** Consider deriving or snapshotting the retained public command list from the pre-migration help surface so the test fails when the old help output contains a command omitted from `EXISTING_CORE_HELP_COMMANDS`.
**Why non-blocking:** The test does cover a broad explicit set of current commands, so this is mainly a maintainability guard against stale fixtures rather than missing executable coverage for the named requirements.
