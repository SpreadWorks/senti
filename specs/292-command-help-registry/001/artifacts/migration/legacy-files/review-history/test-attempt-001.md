# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. R12 plugin help invocation surfaces are untested
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js / specs/292-command-help-registry/tests/plugin-help-rendering.test.js
**Issue:** R12 explicitly requires plugin help through `senti help <plugin>` and direct plugin `--help` to be renderer-backed metadata paths, but the CLI surface test only covers core commands and the plugin tests call renderer functions directly or execute the plugin without `--help`.
**Required change:** Add spec-local executable coverage for `node src/senti.js help sample` and `node src/senti.js sample --help` using the temporary plugin project, asserting they render plugin metadata help without executing the plugin run behavior.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for two concrete public help surfaces.

### 2. R5 fallback locale behavior is not covered
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js
**Issue:** The R5 test checks English and Japanese rendering differ, but it does not verify fallback behavior when the current language has no localized command text or when an unsupported language is requested.
**Required change:** Add a focused R5 assertion that renders metadata with a missing/unsupported locale and verifies it falls back to the default locale text instead of failing or producing empty help.
**Why blocking:** R5 requires locale fallback behavior, and the current test only covers locale selection, not fallback.

### 3. R8 documentation requirement is not tested or represented
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js
**Issue:** R8 requires the import-time side effect policy to be documented near the command metadata convention, but the test file only verifies command run behavior is not invoked during metadata model construction.
**Required change:** Add a minimal R8 test or static assertion that the command metadata convention documentation contains the import-time side effect policy, or update the coverage artifact so the documentation check is represented by an appropriate spec-local test file.
**Why blocking:** The requirement coverage artifact marks R8 covered, but the actual tests cover only the runtime side of R8 and omit the required documentation policy.


## Advisory Findings

### 1. R6 ownership coverage is narrow
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js
**Improvement:** The R6 test could add one focused plugin hook or flow lifecycle non-help assertion if those paths are expected to be at risk in the implementation.
**Why non-blocking:** The current test does exercise dispatcher ownership for core help surfaces, and broader lifecycle regression coverage may already exist outside the spec-local tests.
