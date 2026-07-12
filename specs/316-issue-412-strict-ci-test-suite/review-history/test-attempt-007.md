# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-issue-412-strict-ci-test-suite/test-coverage.json`

## Blocking Findings

### 1. tests/run.js entrypoint is not exercised
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** R1 and R2 target tests/run.js behavior, but the tests import only tests/helpers/test-selection.js and tests/helpers/test-runner.js. No spec-local test invokes tests/run.js or proves it delegates to those helpers, so an implementation can satisfy the helper contract while the shipped CLI still accepts invalid selectors, discovers on --help, or emits non-JSON list output.
**Required change:** Add a spec-local entrypoint/delegation test for tests/run.js, at minimum covering --help and one --list --json selection through the actual CLI/main path.
**Why blocking:** This is a static anti-pattern that would pass without exercising the production behavior named by R1/R2.

### 2. Shared resolver limits are only tested at JSON rendering
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** The traversal, depth, file-count, and relative-path-length checks are asserted only by calling renderTestList with already-resolved file arrays. R2 requires the shared execution/list resolver to reject those limits; no non-list TestRunner or resolveTestFiles case proves invalid resolved files are rejected before executeFiles.
**Required change:** Add tests against resolveTestFiles or TestRunner execution mode for traversal, depth >32, >10000 files, and >4096-character relative paths, asserting executeFiles is not called.
**Why blocking:** A resolver that enforces limits only for JSON listing would pass while unsafe execution selections remain unguarded.

### 3. Stub provider injection into the pipeline is not asserted
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/ci-stages.contract.test.js
**Issue:** The stub acceptance test records the provider argument passed to runPipeline but only asserts the call label. runStubAcceptance could call runPipeline(tmp) without the schema-aware stub provider and still pass because quality is checked through a separate provider call.
**Required change:** Assert the pipeline call receives a schema-aware stub provider, for example by checking the recorded provider exposes enrich/text/quality and is the provider intended for the stub run.
**Why blocking:** R3 requires injecting the schema-aware provider into the pipeline; the current test would pass without that behavior.

### 4. tests/acceptance/run.js entrypoint is not covered
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/acceptance-targets.contract.test.js
**Issue:** R4 requires tests/acceptance/run.js to consume discovery and exit non-zero for discovery or target-resolution failures, but the tests import tests/acceptance/lib/run-targets.js only. No test proves the production run.js entrypoint delegates to that helper or returns its exit codes.
**Required change:** Add spec-local coverage for tests/acceptance/run.js entrypoint/delegation, using injectable discovery/execution or a minimal CLI/source assertion that it calls runAcceptanceTargets and exits with its code.
**Why blocking:** This is a static anti-pattern that would pass while the production acceptance runner remains incorrect or disconnected.

### 5. Discovery output paths are not asserted
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/acceptance-targets.contract.test.js
**Issue:** The discovery test verifies the fixed existsSync probes and the target name, but it never asserts the returned target's testFile or fixture path. The resolver tests use hand-built targets, so discovery could check the right paths but return a wrong executable test file and still pass.
**Required change:** Assert the discovered base target includes the fixed tests/acceptance/test.js file and fixtures directory paths consumed by the runner/helper.
**Why blocking:** R4 requires deriving executable targets from the fixed path pair; current coverage can pass while the runner executes the wrong file.


## Advisory Findings

### 1. Exercise later CI stage failures
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/ci-stages.contract.test.js
**Improvement:** Add a runCiStages case where earlier stages succeed and a later stage fails, verifying execution stops at that stage and returns non-zero.
**Why non-blocking:** The current test already proves short-circuit behavior for a first-stage failure; this broadens boundary coverage.

### 2. Assert multi-category counts directly
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Improvement:** In the direct renderTestList case, assert every suite.count equals suite.files.length in addition to totalFiles.
**Why non-blocking:** The TestRunner listing case already checks count fields for the unit listing; this would make the renderer contract clearer across all categories.
