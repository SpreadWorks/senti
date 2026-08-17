# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. Top-level core command coverage is self-referential
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js R2
**Issue:** The R2 test builds the expected command list from the new registry model and then checks that rendered help contains those same model commands. If an existing core command from the current help output is omitted from the new registry, the test still passes because the omitted command is absent from both sides.
**Required change:** Add a spec-local assertion against an explicit baseline list of existing top-level core commands currently shown by help, or otherwise compare against the pre-migration public help surface, so omissions from the registry fail.
**Why blocking:** R2 requires every existing core command shown by current help output to be generated from registry metadata; the current test can pass without covering that acceptance requirement.

### 2. Metadata field coverage misses args and applicable subcommands
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js R1
**Issue:** The R1 test checks name, section, summary, usage, options, experimental marker, and locale source on a leaf command, but it does not verify args metadata and does not verify subcommands on a command where subcommands are applicable.
**Required change:** Extend R1 coverage to assert renderer-ready args metadata and subcommands metadata on an applicable namespace command such as docs.
**Why blocking:** R1 explicitly requires args/options and subcommands where applicable; those required metadata fields currently have no direct spec-local test coverage.

### 3. Renderer-backed public surfaces are not distinguished from legacy help paths
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js R12
**Issue:** The R12 test only asserts that each CLI surface prints some help-like text and avoids unknown-command errors. A legacy/static help path could satisfy these assertions without using renderer-backed metadata.
**Required change:** Add an assertion that each listed core help surface contains metadata-only registry content or otherwise uses an observable renderer-backed path, not merely any help output.
**Why blocking:** R12 requires concrete public help invocation surfaces to be renderer-backed metadata paths; the current assertions would pass without exercising that production behavior.


## Advisory Findings

### 1. Locale parity coverage is narrow
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js R5
**Improvement:** Consider adding one assertion that localized summary/help text is resolved from metadata rather than only checking that English and Japanese full outputs differ for docs build.
**Why non-blocking:** The existing test does cover language fallback and output variation, so this is a precision improvement rather than missing executable coverage.
