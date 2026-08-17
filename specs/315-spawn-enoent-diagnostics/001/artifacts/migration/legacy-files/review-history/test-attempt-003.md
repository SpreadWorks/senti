# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/315-spawn-enoent-diagnostics/test-coverage.json`

## Blocking Findings

### 1. R1 actionable PATH guidance is not actually asserted
**Target:** specs/315-spawn-enoent-diagnostics/tests/agent-enoent-diagnostics.test.js: R1 test
**Issue:** The test checks for `PATH=` and `/PATH.*senti/i`, but that can pass with a generic diagnostic that mentions PATH and senti without giving the required actionable suggestion to add the CLI to the PATH of the environment that starts `senti`.
**Required change:** Assert concrete guidance terms, e.g. adding/installing the CLI and updating the PATH for the environment/process that starts `senti`.
**Why blocking:** R1 explicitly requires actionable remediation guidance; the current assertion would pass without covering that acceptance requirement.

### 2. R2 does not verify cloned environment preserves non-PATH variables
**Target:** specs/315-spawn-enoent-diagnostics/tests/agent-enoent-diagnostics.test.js: R2 test
**Issue:** The test verifies `PATH` is kept and `CLAUDECODE` is omitted, but it does not prove the invocation env clones `process.env` or that only `CLAUDECODE` is removed. An implementation that drops unrelated environment variables would still pass.
**Required change:** Set an unrelated sentinel environment variable before building the invocation and assert it is present unchanged in `built.env`.
**Why blocking:** R2 requires preserving existing spawn environment behavior by cloning `process.env` and removing only `CLAUDECODE`; that behavior lacks spec-local coverage.


## Advisory Findings

No advisory findings.