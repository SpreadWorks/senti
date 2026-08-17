# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/328-bounded-review-convergence/test-coverage.json`

## Blocking Findings

### 1. R2 rejection coverage is incomplete
**Target:** specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js
**Issue:** The coverage artifact marks R2 covered, but the tests only exercise stale tree SHA, caller-supplied digest, and duplicate identity. R2 also requires rejection of foreign phase/task target, target-guard mismatch, revision mismatch, and malformed evidence with unchanged canonical evidence and flow-state bytes before provider execution or mutation.
**Required change:** Add spec-local executable tests for foreign phase/task target, target-guard mismatch, revision mismatch, and malformed evidence rejection, including unchanged evidence files and flow-state bytes where mutation would otherwise occur.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, and the coverage artifact contradicts the actual test files.

### 2. R5 CLI behavior is not executable-tested
**Target:** specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js
**Issue:** R5 requires `senti flow set review-evidence --file <path>` behavior with normal target guards, spec-directory confinement, required fields, bounded input, disposition/finding consistency, CLI-computed digest, idempotent canonical persistence, and CAS convergence without provider launch. The tests cover lower-level store/input classes and a regex check of registry/command source, but do not execute the command boundary or verify the full CLI contract.
**Required change:** Add an executable spec-local test that invokes the review-evidence command path with a valid version-1 finalized audit document and asserts guarded acceptance, CLI-computed digest persistence, idempotency, CAS transition, and no provider launch; add negative executable cases for required-field, bounds, consistency, and location guard failures.
**Why blocking:** A required acceptance surface has no corresponding executable test coverage; the existing source-regex test can pass without exercising production behavior.

### 3. R4 persisted tooling budget is not covered
**Target:** specs/328-bounded-review-convergence/tests/review-action-resolution.test.js and specs/328-bounded-review-convergence/tests/review-execution-regression.test.js
**Issue:** R4 requires tooling failures to persist with stage and attempt data, avoid semantic budget consumption, share one persisted `toolingMaxAttempts=1` budget per phase/task/tree target regardless of provider or process, and reject another unchanged provider execution after retry is consumed. Current tests exercise in-memory normalization/resolution, but not persisted state shared across executions or unchanged execution rejection.
**Required change:** Add an executable persistence-level test that records a tooling failure, verifies semantic attempts are unchanged, verifies the same phase/task/tree target has no remaining tooling retry across a different provider/process, and verifies another unchanged provider execution is rejected without state mutation.
**Why blocking:** A critical convergence/idempotency requirement lacks regression coverage at the state mutation boundary.

### 4. R7 migration preservation relies on source text matching
**Target:** specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js
**Issue:** The R7 migration test checks concatenated source text for artifact names and absence of legacy constants. This can pass while command routing, target guards, exit-visible failures, phase artifact paths, post-hook lifecycle ownership, semantic maxAttempts, task scope, revision/CAS checks, PASS/ADVISORY promotion, final disposition, or acceptance judgment are broken.
**Required change:** Replace or supplement the regex-only R7 test with executable tests that exercise migrated review command routing and representative preserved behaviors, including legacy FAIL/TOOLING_FAILURE rejection and absence of reviewStop/retryRecovery aliases in emitted state/API output.
**Why blocking:** The test has a static anti-pattern that would pass without exercising required production behavior.


## Advisory Findings

### 1. Failure-stage loop could be easier to diagnose
**Target:** specs/328-bounded-review-convergence/tests/review-execution-regression.test.js
**Improvement:** Consider using subtests or named fixtures for each tooling failure stage so a single failing stage is reported directly.
**Why non-blocking:** The loop still exercises distinct inputs for the listed stages; this is mainly diagnostics and maintainability.
