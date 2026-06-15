# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/298-fix-presets-list-tree/test-coverage.json`

## Blocking Findings

### 1. R1 can pass without project-aware plugin inventory
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js: R1 test
**Issue:** The R1 test installs and asserts real official-presets keys such as webapp, js-webapp, and nextjs. Those same keys could be loaded by a non-project mechanism, so the test does not prove that senti presets list reads enabled plugin contributions from the current project's registry/config.
**Required change:** Use a project-local plugin fixture with at least one unique preset key or label not available from core or bundled official presets, enable it in .senti/config.json, run the CLI from that project root, and assert that unique preset appears together with base.
**Why blocking:** R1 is a must requirement, and the current test can pass while the command ignores the project's enabled plugin registry.

### 2. R5 coverage omits plugin installation and package contents
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js: R5 tests
**Issue:** R5 is marked covered, but the tests only check setup candidate inclusion, resolveChain for nextjs, and that plugin.json in a copied plugin remains unchanged. They do not exercise plugin installation behavior, and they do not verify official-presets package contents beyond plugin.json.
**Required change:** Add spec-local regression coverage for the plugin installation path or API, and compare the relevant official-presets package tree or preset files before and after the list/setup operations instead of only plugin.json.
**Why blocking:** R5 is a must non-regression requirement; the coverage artifact claims coverage while required surfaces have no executable coverage.

### 3. R6 command inventory bound can pass after unbounded loading
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js: R6 command inventory test
**Issue:** The CLI test creates 513 valid preset files and only asserts a nonzero result containing 512. An implementation that reads all 513 plugin preset entries and then lets formatPresetTree reject the array would pass, even though R6 requires inventory loading itself to be bounded before rendering.
**Required change:** Make processing the 513th contribution detectably fail, such as by making it missing or invalid, and assert the command reports the 512-entry bound instead of attempting to read it.
**Why blocking:** This static anti-pattern would pass without exercising the production behavior required by R6.


## Advisory Findings

### 1. Add exact boundary cases
**Target:** specs/298-fix-presets-list-tree/tests/presets-list-tree.test.js: R6 tests
**Improvement:** Add non-failing boundary coverage showing exactly 512 preset entries are accepted and clarifying the intended inclusive depth-16 behavior.
**Why non-blocking:** The current tests cover over-limit count and depth truncation, so this would improve precision rather than fill a missing must-have behavior.
