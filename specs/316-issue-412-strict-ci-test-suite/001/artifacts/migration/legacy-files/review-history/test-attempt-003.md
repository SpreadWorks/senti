# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-issue-412-strict-ci-test-suite/test-coverage.json`

## Blocking Findings

### 1. Test name lacks matching header id
**Target:** tests/ci-stages.contract.test.js:R5
**Issue:** The file has a 'R5: ...' test name but the header does not declare R5.
**Required change:** Add R5 to the file header or rename the test.
**Why blocking:** The coverage artifact omits a requirement referenced by executable tests.

### 2. Test name lacks matching header id
**Target:** tests/test-selection.contract.test.js:R5
**Issue:** The file has a 'R5: ...' test name but the header does not declare R5.
**Required change:** Add R5 to the file header or rename the test.
**Why blocking:** The coverage artifact omits a requirement referenced by executable tests.

### 3. Coverage artifact is invalid for R5 declarations
**Target:** Requirement-to-Test Coverage Artifact; tests/ci-stages.contract.test.js; tests/test-selection.contract.test.js
**Issue:** The artifact reports validation.ok=false because both files contain R5-named tests while their spec headers do not declare R5. The requirements list also only attributes R5 coverage to tests/agent-report-fixture.contract.test.js, contradicting the actual test names present in the spec-local files.
**Required change:** Either add R5 to the affected file headers and artifact file mappings, or rename/move those R5 tests so the artifact validates cleanly.
**Why blocking:** A contradictory requirement coverage artifact is explicitly blocking and makes the claimed R5 coverage unreliable before implementation.

### 4. R2 command-level help and JSON list contract is not covered
**Target:** tests/test-selection.contract.test.js
**Issue:** The tests exercise TestSelection.parse and renderTestList directly, but they do not cover tests/run.js --help returning usage without discovery/execution, nor --list --json producing stdout that is only JSON. They also omit assertions for required JSON fields version=1, selection { mode, preset, scope }, and per-suite count values matching files.
**Required change:** Add a spec-local command-level or injectable-main test for tests/run.js that verifies help exits before discovery/execution and list/json emits only the required JSON shape, including version, selection, files, count, and totalFiles.
**Why blocking:** R2 is a must requirement on tests/run.js behavior; helper-only tests could pass while the CLI remains unwired or emits the wrong stdout/schema.

### 5. R2 depth bound has no regression test
**Target:** tests/test-selection.contract.test.js
**Issue:** The boundary tests cover traversal, file count, path length, and JSON size, but not rejection of resolved paths beyond depth 32.
**Required change:** Add a render/list resolver test with a repository-relative POSIX path deeper than 32 segments and assert it is rejected.
**Why blocking:** The depth limit is an explicit R2 must requirement and currently has no corresponding spec-local coverage.

### 6. R3 stub acceptance behavior is not exercised
**Target:** tests/ci-stages.contract.test.js
**Issue:** The CI tests verify the stage list and the stub provider factory, but they do not verify that tests/ci/stub-acceptance.test.js copies the base fixture, injects the schema-aware provider into the docs enrich/text and quality paths, runs the pipeline, or avoids provider credentials.
**Required change:** Add a credential-free contract around the stub acceptance test or its extracted helper that proves it copies the base fixture, uses tests/helpers/stub-agent.js for the required provider calls, runs the pipeline, and does not require credentials.
**Why blocking:** R3 explicitly requires stub acceptance pipeline behavior; the current test could pass with a correct stage name but a missing or credentialed stub acceptance implementation.

### 7. R4 acceptance runner CLI consumption is not covered
**Target:** tests/acceptance-targets.contract.test.js
**Issue:** The tests cover discovery and a non-executing resolveAcceptanceRun helper, but not tests/acceptance/run.js consuming discovery, exiting non-zero for discovery/empty/unknown/empty-resolution failures, or executing only resolved files on success.
**Required change:** Add a spec-local test for an injectable tests/acceptance/run.js main/runner that verifies the required exit statuses and executed test file list using stubbed discovery and execution.
**Why blocking:** R4 is a must requirement on tests/acceptance/run.js behavior; resolver-only coverage can pass while the CLI ignores the resolver or exits incorrectly.


## Advisory Findings

No advisory findings.