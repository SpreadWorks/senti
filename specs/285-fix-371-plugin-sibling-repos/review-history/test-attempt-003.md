# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/285-fix-371-plugin-sibling-repos/test-coverage.json`

## Blocking Findings

### 1. R3 does not prove base is the only built-in preset source
**Target:** tests/official-sibling-behavior.test.js: R3 test
**Issue:** The R3 test only asserts that an unenabled webapp preset does not resolve. It does not inspect or exercise the built-in preset source set, so an implementation could still treat other local preset directories or bundled official artifacts as built-in while making only webapp unavailable in this scenario.
**Required change:** Add a spec-local assertion that built-in preset discovery contains only src/presets/base, or otherwise exercises all non-base bundled official preset sources and verifies none resolve without an enabled plugin.
**Why blocking:** R3 explicitly requires src/presets/base to remain the only built-in preset source; that acceptance requirement currently has no direct spec-local coverage.

### 2. Committed artifact tests can pass with ignored working-tree files
**Target:** tests/official-sibling-artifacts.test.js: assertCleanGitRepo and contribution path checks
**Issue:** The artifact tests check that the sibling repos have a clean git status and that files exist on disk, but they do not prove plugin.json or contribution paths are tracked at HEAD. Ignored files can exist in a clean working tree and still satisfy these assertions without being committed.
**Required change:** Assert that plugin.json and every referenced contribution path are present in the recorded commit, for example with git ls-files --error-unmatch and/or git cat-file -e HEAD:<path>.
**Why blocking:** R1 and R2 require committed plugin packages; the current tests can pass without exercising the committed-artifact requirement.


## Advisory Findings

### 1. Missing workflow negative cases
**Target:** tests/official-sibling-behavior.test.js: R4 cases
**Improvement:** R4 negative coverage is focused on official preset upgrade sources. Add analogous workflow-source cases for missing plugin.json, missing contribution paths, dirty source, and missing HEAD if the implementation has separate workflow install/migration code paths.
**Why non-blocking:** The preset cases cover the named failure modes for one official sibling source and may drive shared validation logic, but workflow-specific coverage would reduce regression risk if the code paths diverge.
