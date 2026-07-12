# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-accept-resolve-context-guards/test-coverage.json`

## Blocking Findings

### 1. R1 does not assert the required guard option names
**Target:** specs/316-accept-resolve-context-guards/tests/resolve-context-target-guards.test.js
**Issue:** The R1 test derives TARGET_GUARDS from FLOW_COMMANDS.get.status.args.options and then checks resolve-context/help against that derived list. If the shared guard option list regressed to omit one of --expect-run-id, --expect-issue, or --expect-spec, this test could still pass while the acceptance requirement is not met.
**Required change:** Add a spec-local assertion that the resolve-context registry/help expose the literal required options --expect-run-id, --expect-issue, and --expect-spec, rather than only comparing against another registry entry.
**Why blocking:** R1 requires coverage for those three concrete options. The current test can pass without proving all three required options exist, so the acceptance requirement lacks reliable corresponding coverage.


## Advisory Findings

No advisory findings.