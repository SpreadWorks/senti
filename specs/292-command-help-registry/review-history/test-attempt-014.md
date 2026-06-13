# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. Core CLI help surfaces are not proven to use the renderer-backed metadata path
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js R12 tests
**Issue:** The core public help surface tests call the CLI but only assert that some help-like output appears and that resolveHelpSurfaceOwner returns renderer-backed-metadata. An implementation could leave the CLI wired to the legacy/static help path, add a helper that reports the expected owner, and still pass these tests.
**Required change:** For each core CLI help surface under R12, assert the CLI output matches or is derived from help.renderHelp/renderCommandHelp for the same topic, or otherwise instrument the dispatch path so the executable public surface proves it used the shared renderer metadata path.
**Why blocking:** R12 specifically requires concrete public invocations such as senti help, global --help, command --help, and leaf --help to be renderer-backed metadata paths; the current tests do not exercise that production routing requirement.

### 2. Independent command ownership is checked on the rendered model, not the core metadata registry
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js R11 test
**Issue:** The R11 test verifies that buildCoreHelpModel(...).findCommand(...).owner is core-command-metadata. This can pass if help.js synthesizes help/setup/upgrade/plugin/presets list entries during model construction instead of those commands being explicitly represented in the core command metadata registry.
**Required change:** Add a direct assertion against the core command metadata registry/allCommands structure, or a registry API, proving help, setup, upgrade, plugin, and presets list have explicit metadata owners before the help model is built.
**Why blocking:** R11 requires these commands to be represented in the core command metadata registry while execution entrypoints remain unchanged; model-level assertions allow an implementation premise that violates the required ownership boundary.

### 3. Renderer-ready metadata shape is only spot-checked for one core path
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js R1 test
**Issue:** The R1 test checks the full metadata shape only for docs build and partially for docs. Other existing core commands, including independent commands required by R11, could lack section, usage, args/options, experimental marker, or locale source and the test would still pass.
**Required change:** Iterate over the core metadata registry/model entries used for public help and assert every command/subcommand exposes the required renderer-ready fields, with subcommands checked recursively where applicable.
**Why blocking:** R1 requires core command help metadata to expose enough structured data for top-level, command, and subcommand help, not just a single docs leaf command.

### 4. Plugin normalization does not prove the shared renderer input shape
**Target:** specs/292-command-help-registry/tests/plugin-help-rendering.test.js R4 test
**Issue:** The R4 test only checks plugin normalized name, summary, usage, and one subcommand name. It does not assert the normalized plugin command has the same renderer input shape expected of core metadata, such as args/options defaults, experimental marker, section/owner fields, and recursive subcommand fields.
**Required change:** Extend the R4 normalization assertion to verify the normalized plugin command and subcommand expose the same renderer-ready field contract as core command metadata, including default values where plugin manifests omit optional fields.
**Why blocking:** R4 requires plugin command metadata to be normalized to the same renderer input shape as core command metadata; the current test can pass with an incomplete shape that only works for the narrow fixture.


## Advisory Findings

### 1. Documentation policy assertion is very loose
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js R8 documentation test
**Improvement:** Assert a more specific policy phrase near the command metadata convention, such as help metadata must be import-safe and must not import or run command modules during help rendering, instead of only matching import-time side effects and help metadata anywhere in the file.
**Why non-blocking:** There is executable side-effect coverage for metadata reads, so this is mainly a robustness improvement for the documentation check rather than a missing behavioral regression test.
