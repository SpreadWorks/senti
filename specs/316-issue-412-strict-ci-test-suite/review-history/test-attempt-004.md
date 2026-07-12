# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-issue-412-strict-ci-test-suite/test-coverage.json`

## Blocking Findings

### 1. Selector conflict matrix is only partially covered
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** R1 requires rejecting combinations of mutually exclusive suite selectors with each other or with file-spec mode, but the test samples only a few conflicts. It does not cover several required selector conflicts such as --scope with --agent, --scope with --all, --preset with --agent, --preset with --all, --preset with --file/--pattern/positional path, and --agent with positional path.
**Required change:** Add table-driven invalid cases covering the missing mutually exclusive selector combinations, especially each suite selector paired with another suite selector and each suite selector paired with file-spec mode.
**Why blocking:** An implementation could reject only the sampled pairs while accepting other forbidden combinations, so the acceptance requirement has incomplete spec-local coverage.

### 2. Missing CLI JSON stdout-only and pre-stdout oversize coverage
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Issue:** R2 requires `tests/run.js --list --json` stdout to be only JSON and listing to fail before stdout when serialized JSON exceeds 16 MiB. The tests validate `TestRunner.run` JSON parsing and `renderTestList` throws at a low byte limit, but they do not prove the runner returns empty stdout on listing serialization failure or that the CLI path avoids any non-JSON stdout around the JSON listing.
**Required change:** Add runner-level or CLI-level contract coverage asserting successful list output is exactly parseable JSON with no extra stdout text, and an oversized JSON listing returns non-zero with empty stdout before writing JSON.
**Why blocking:** The current tests allow an implementation that throws internally or emits partial/non-JSON stdout, contradicting the required command contract.

### 3. Acceptance target discovery bound is incomplete
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/acceptance-targets.contract.test.js
**Issue:** R4 requires discovery to inspect at most 1000 immediate directories under src/presets and to return a structured discovery error when the directory/path bound is exceeded. The test covers 1001 directory entries, but it does not cover the path-bound side of the requirement, such as overly long target paths or too many checked path pairs if that is the intended path bound.
**Required change:** Add a discovery test that exceeds the required path bound and asserts no targets plus a structured error code.
**Why blocking:** An implementation could enforce only the directory-count limit and miss the required path-bound failure mode.

### 4. Side-effect-free acceptance library is not tested
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/acceptance-targets.contract.test.js
**Issue:** R4 requires `tests/acceptance/lib/targets.js` to remain side-effect-free, but the tests only exercise injected discovery calls. They do not assert that importing the library does not perform filesystem discovery, spawn processes, write output, or otherwise execute side effects.
**Required change:** Add an import-time contract using injected or observable seams that proves the targets library performs no discovery/execution side effects until its exported functions are called.
**Why blocking:** A module with import-time discovery or execution could still pass the current tests while violating the side-effect-free requirement.

### 5. Stub acceptance credential-free behavior is not enforced
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/ci-stages.contract.test.js
**Issue:** R3 requires stub acceptance to require no provider credentials. The test passes `env: {}` but does not assert that credential environment variables are ignored or that missing credentials are not read, required, or forwarded. A runner could still inspect `process.env` directly and fail in real CI while passing this injectable test.
**Required change:** Add a contract case that runs the stub acceptance path with no provider credentials and fails if credential lookup is required, or injects an env accessor that throws for provider credential keys and asserts the pipeline still succeeds.
**Why blocking:** The current test can pass without proving the required credential-free behavior of the CI stub acceptance stage.


## Advisory Findings

### 1. R2 valid list-selection combinations could be broader
**Target:** specs/316-issue-412-strict-ci-test-suite/tests/test-selection.contract.test.js
**Improvement:** Consider adding explicit `--list --json` cases with `--preset`, `--all`, and file-spec selections, not only default retained selector parsing and one runner `--scope unit` listing.
**Why non-blocking:** The parser coverage already checks retained selectors with JSON listing, but extra cases would document the command contract more completely.
