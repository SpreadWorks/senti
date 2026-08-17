# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/305-fix-plugin-git-cache-update/test-coverage.json`

## Blocking Findings

### 1. Missing unrecoverable-cache reclone coverage
**Target:** specs/305-fix-plugin-git-cache-update/tests/plugin-git-cache-update.test.js / R3
**Issue:** R3 requires dirty managed Git URL caches to be reset/cleaned, and when they cannot be restored, deleted and recloned. The tests cover repairable dirty content and unsafe source ids, but no test forces reset/clean repair to fail and verifies the cache is recloned to the resolved target commit.
**Required change:** Add one R3 spec-local test that makes the managed cache unrecoverable or non-resettable, then asserts update succeeds by replacing/recloning the cache at the resolved commit.
**Why blocking:** A required fallback path involving destructive cache recovery has no corresponding spec-local regression coverage.

### 2. R5 coverage artifact overstates public-behavior preservation
**Target:** Requirement-to-Test Coverage Artifact R5 and specs/305-fix-plugin-git-cache-update/tests/plugin-git-cache-update.test.js
**Issue:** R5 is marked covered for plugin source add/update/find/install, setup official preset resolution, config persistence, installed package materialization, and local path dirty rejection, but the provided test file only directly covers local path dirty rejection and partially exercises find/update behavior. It does not cover source add/update/install, official preset resolution, config persistence, or installed package materialization.
**Required change:** Either add focused spec-local regression tests for the missing R5 public behaviors or narrow/split the R5 coverage artifact so only actually covered behaviors are marked covered.
**Why blocking:** The requirement coverage artifact contradicts the actual test files and several acceptance-preservation requirements have no corresponding spec-local coverage.

### 3. R7 only covers find metadata consumer
**Target:** specs/305-fix-plugin-git-cache-update/tests/plugin-git-cache-update.test.js / R7
**Issue:** R7 requires resolved target trees before PluginManifest, validateSourceTree, find, add, and install paths read files. The only R7 test calls findPluginCandidates, so add/install/materialization and validation-time consumers are not exercised against a stale cache updated upstream.
**Required change:** Add minimal R7 tests for the missing file-reading paths, especially install/materialization and validation, using a stale managed cache whose remote target commit changes visible plugin metadata or files.
**Why blocking:** A stated acceptance requirement covers multiple production read paths, but the spec-local tests only exercise one of them.


## Advisory Findings

No advisory findings.