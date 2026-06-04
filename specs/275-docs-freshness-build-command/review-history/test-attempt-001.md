# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/275-docs-freshness-build-command/test-coverage.json`

## Blocking Findings

### 1. R1 negative guard cannot catch the help's actual command lines
**Target:** specs/275-docs-freshness-build-command/tests/freshness-guidance.test.js — assertNoLegacyBuildGuidance + test "R1: help guidance points to sdd-forge docs build"
**Issue:** The help text in src/check/commands/freshness.js displays the regeneration command on two lines with NO colon: `— run sdd-forge build` (printHelp lines 34-35), which is exactly what R1 forbids ("must not display `sdd-forge build` as that command"). The negative guard only matches `/run: sdd-forge build\b/` (requires a colon) and `/sdd-forge build is needed\b/`. Neither pattern matches the no-colon command lines. A minimal/partial implementation that changes only the descriptive line 29-30 (`sdd-forge build is needed` → `sdd-forge docs build is needed`) makes the positive assert `/sdd-forge docs build/` pass and both legacy patterns pass, while help lines 34-35 still display `sdd-forge build` as the command — R1 is violated but the test goes green.
**Required change:** Strengthen the help negative check to reject any bare command token, e.g. add `assert.doesNotMatch(result.stdout, /sdd-forge build\b/)` in the R1 test (this still permits `sdd-forge docs build`, since that string contains no contiguous `sdd-forge build` substring). This forces every help command-guidance line, including lines 34-35, to use `sdd-forge docs build`.
**Why blocking:** R1's prohibition half is not enforced for the help command lines, so the test can pass while production help still shows `sdd-forge build` as the command to run — a static anti-pattern where the green test does not guarantee the requirement.


## Advisory Findings

### 1. never-built JSON shape and exit code not asserted
**Target:** specs/275-docs-freshness-build-command/tests/freshness-guidance.test.js — test "R3: JSON output shape and exit code contract stay unchanged"
**Improvement:** R3 explicitly lists `never-built` among the results whose JSON shape and exit code must be preserved, but the R3 test only asserts JSON shape/exit for `stale` and `fresh`. Add a `never-built` case with `--format json` asserting keys `["ok","result","srcNewest","docsNewest"]`, `result === "never-built"`, `ok === false`, and status 1.
**Why non-blocking:** The JSON serialization is a single shared code path (one JSON.stringify with fixed keys) already exercised by the stale/fresh JSON assertions, and the never-built exit code (1) is already covered in text mode by the R2 test, so the regression risk for the missing case is low.

### 2. Reuse a single bare-token guard for R2 text output as well
**Target:** specs/275-docs-freshness-build-command/tests/freshness-guidance.test.js — assertNoLegacyBuildGuidance usage in test "R2: stale and never-built text output..."
**Improvement:** Once the bare-token guard `/sdd-forge build\b/` exists, apply it uniformly (R1 and R2) instead of the two narrow colon/phrase patterns, so the negative check is consistent across help and text outputs and is robust to future wording changes (e.g. dropping the colon in text output).
**Why non-blocking:** For R2 the text output uses the colon form (`run: sdd-forge build`) and the positive assertion requires `run: sdd-forge docs build`, so the current narrow patterns already adequately enforce R2; this is a robustness/consistency improvement, not a coverage gap.
