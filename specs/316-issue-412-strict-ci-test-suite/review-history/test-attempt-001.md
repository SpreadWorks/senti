# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-issue-412-strict-ci-test-suite/test-coverage.json`

## Blocking Findings

### 1. R1 invalid selector matrix is mostly untested
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** The R1 test covers only one unknown flag, one missing value, one preset/scope combination, one repeated scope, and one valid repeated --file case. It has no spec-local assertions for unknown presets, missing presets, repeated --preset, repeated --agent, repeated --all, --all/--agent mutual exclusion, selector/file-spec mutual exclusion, repeated --pattern validity, positional path union validity, or deduplication only after resolution.
**Required change:** Add focused contract cases for each required invalid selector failure and retained valid multi-valued file/pattern/positional behavior.
**Why blocking:** R1 is a must requirement and the coverage artifact marks it covered, but several required parser behaviors have no corresponding spec-local test coverage.

### 2. R2 CLI/listing contract lacks required coverage
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** The R2 test checks help mode and one renderTestList shape only. It does not cover that --help performs no discovery/execution, --list and --json require each other, listing stdout is JSON-only, suite ordering across unit/integration/acceptance/other, sorted repository-relative POSIX files, count/total consistency beyond a single file, no test spawning during listing, traversal depth >32, >10000 resolved files, repo-relative path length >4096, or serialized JSON >16 MiB failing before stdout.
**Required change:** Add spec-local tests for the list/json pairing, JSON-only output shape/order/count/sort guarantees, non-spawning behavior, and every resolver/listing limit failure mode.
**Why blocking:** R2 is a must requirement and the artifact marks it covered, but most required failure modes and output guarantees are untested.

### 3. R3 CI execution behavior and credential-free stub path are untested
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/ci-stages.contract.test.js
**Issue:** The R3 test only asserts createCiStages returns four command tuples. It does not test package.json maps npm run test:ci to node tests/ci.js, stages execute sequentially, execution stops non-zero on the first failure, tests/agent is not selected, or that tests/ci/stub-acceptance.test.js copies the base fixture, injects tests/helpers/stub-agent.js for docs enrich/text and passing quality responses, runs the pipeline, and requires no provider credentials.
**Required change:** Add contract tests for package-script wiring, CI runner sequencing/early-exit behavior, exclusion of tests/agent, and the stub acceptance fixture/provider behavior without credentials.
**Why blocking:** R3 is a must requirement and the current test would pass with only a stage factory present, leaving critical CI behavior unprotected.

### 4. R4 discovery limits and acceptance runner behavior are untested
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/acceptance-targets.contract.test.js
**Issue:** The R4 test validates one injected immediate directory and two fixed existsSync checks. It does not cover the at-most-1000 immediate directory bound, structured discovery errors when directory/path bounds are exceeded, absence of recursive fixture traversal or file-content reads, side-effect-free behavior beyond injected filesystem calls, or tests/acceptance/run.js exiting non-zero for discovery errors, empty all-target results, unknown requested targets, or empty requested resolution, and executing only resolved test files otherwise.
**Required change:** Add targeted tests for discovery limit/error cases, no recursive/content-read filesystem usage, side-effect-free discovery, and acceptance runner failure/success resolution paths.
**Why blocking:** R4 is a must requirement and the artifact marks it covered, but the required discovery safety limits and runner contract have no corresponding spec-local coverage.

### 5. R5 real-provider isolation and package-script surface are untested
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/agent-report-fixture.contract.test.js
**Issue:** The R5 test only checks a resolveReportFixture callback is invoked with base. It does not verify tests/agent/report.test.js imports helpers from ../acceptance/lib, selects the discovered base fixture rather than node, remains under explicit real-provider npm run test:agent, fixture/import resolution is testable without credentials, real agent execution is excluded from test:ci, or that retained valid selector/package-script surfaces are covered.
**Required change:** Add tests for report.test helper imports and discovered base fixture selection, package.json test:agent/test:ci isolation, credential-free fixture/import resolution, and retained selector/package-script surfaces required by R5.
**Why blocking:** R5 is a must requirement and the current test covers only a narrow helper seam while leaving the required isolation and package-script behavior untested.


## Advisory Findings

No advisory findings.