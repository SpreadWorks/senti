# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-issue-412-strict-ci-test-suite/test-coverage.json`

## Blocking Findings

### 1. Missing parser coverage for required missing-value failures
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** R1 requires TestSelection to reject missing values, but the invalid-argument table only covers a missing value for --preset. It does not cover missing values for other value-taking flags such as --scope, --file, or --pattern.
**Required change:** Add spec-local assertions that TestSelection.parse throws for each value-taking flag when its value is omitted.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, so an implementation could accept incomplete selectors while these tests still pass.

### 2. Missing coverage for file selector deduplication timing
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** R1 requires repeated --file, repeated --pattern, and positional paths to deduplicate only after resolution, but the tests only assert that repeated --file and --pattern are accepted by the parser. They do not prove duplicates are preserved through parsing and only deduplicated by the resolver after file resolution.
**Required change:** Add a focused resolver/listing assertion that duplicate file-spec inputs remain distinct before resolution and are deduplicated only after they resolve to the same repository-relative file.
**Why blocking:** This is a concrete behavioral requirement with no corresponding regression coverage; a parser-level dedupe or missing resolver dedupe could pass the current tests.

### 3. CI first-failure test encodes the wrong failure point
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/ci-stages.contract.test.js
**Issue:** The runCiStages assertion uses args[1] === "tests/run.js" to make the first stage fail, but the first stage args are ["tests/run.js", "--scope", "unit"], so args[1] is "--scope". The stub returns success for every stage, and the test then expects status 1 and only one call.
**Required change:** Change the stub failure predicate to match the first stage correctly, for example args[0] === "tests/run.js" && args[2] === "unit".
**Why blocking:** The test is not executable as written for its intended assertion and would fail before implementation can be evaluated.

### 4. Stub provider test targets the wrong module
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/ci-stages.contract.test.js
**Issue:** R3 requires the stub acceptance path to inject a schema-aware provider from tests/helpers/stub-agent.js, but this contract imports createStubProvider from tests/ci.js instead. That allows the CI orchestrator to own or fake provider behavior without proving the required helper module exists or is used by stub acceptance.
**Required change:** Move the provider contract to import tests/helpers/stub-agent.js directly, or assert that tests/ci/stub-acceptance.test.js uses that helper module while keeping CI stage orchestration separate.
**Why blocking:** The test encodes an incorrect implementation premise and can pass without exercising the production behavior required by R3.

### 5. No coverage that test:ci excludes real agent tests
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/ci-stages.contract.test.js
**Issue:** R3 requires tests/agent not to be selected by test:ci, but the test only checks the nominal stage array. It does not prove the --scope unit and --scope e2e selections exclude tests/agent, nor that the CI smoke/stub stages avoid real-provider execution.
**Required change:** Add a selection/resolver assertion showing the CI stages do not include tests/agent files or --agent mode.
**Why blocking:** A critical CI safety requirement has no regression test; an implementation could include credentialed agent tests under one of the CI scopes while this contract still passes.

### 6. Acceptance target discovery coverage allows recursive/file-content implementations
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/acceptance-targets.contract.test.js
**Issue:** R4 requires discovery to inspect only immediate preset directories and fixed test/fixtures path pairs, with no recursive fixture traversal or file-content reads. The injected filesystem only provides readdirSync and existsSync, so the test cannot detect implementations that use real fs recursion or read file contents outside those injected seams.
**Required change:** Add failing injected hooks for recursive directory reads and file reads, and assert discovery only calls the immediate src/presets read plus the two fixed exists checks per candidate.
**Why blocking:** The current test has a static seam anti-pattern: an implementation can perform forbidden production filesystem behavior while still satisfying the asserted injected calls.

### 7. Acceptance runner contract does not cover empty requested resolution
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/acceptance-targets.contract.test.js
**Issue:** R4 requires tests/acceptance/run.js to exit non-zero on empty requested resolution. The resolver test covers discovery error, empty all-target result, unknown requested target, and valid requested target, but not a request set that resolves to no test files, such as a target with an empty or missing testFile.
**Required change:** Add an assertion that resolveAcceptanceRun throws when requested targets exist but resolve to an empty executable file list.
**Why blocking:** A required failure mode has no corresponding spec-local test coverage.

### 8. Agent report contract does not prove required helper import path
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/agent-report-fixture.contract.test.js
**Issue:** R5 requires tests/agent/report.test.js to import helpers from ../acceptance/lib and select the discovered base fixture rather than node. The test imports a separate tests/agent/report-fixture.js module and only checks that resolveReportFixture calls an injected function with "base".
**Required change:** Assert the real agent report fixture path is resolved through the acceptance lib helper, or import the same helper-facing module used by tests/agent/report.test.js so the contract fails if report.test.js keeps a node fixture or bypasses ../acceptance/lib.
**Why blocking:** The test can pass with a standalone helper that is never used by tests/agent/report.test.js, so it does not exercise the production behavior required by R5.

### 9. Missing coverage for retained selector and package-script surface
**Target:** specs/316-issue-412-strict-ci-test-suite/tests
**Issue:** R5 requires automated regressions to prove every retained valid selector/package-script surface. The tests check test:agent and test:ci scripts plus a few valid selector cases, but do not cover retained valid selectors such as --preset, --scope, --agent, --all, file-spec mode, and --list --json combinations across those selectors.
**Required change:** Add focused contract cases for each retained valid selector and package script that must continue to work.
**Why blocking:** A broad regression requirement is marked covered in the artifact, but the actual tests leave required valid surfaces untested.


## Advisory Findings

### 1. Boundary coverage for selector conflicts could be clearer
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Improvement:** Add representative conflict cases for --pattern with suite selectors and positional paths with suite selectors, matching the existing --file conflict case.
**Why non-blocking:** The current tests already cover the core mutually exclusive selector rule; these extra cases would reduce ambiguity without changing the main coverage assessment.
