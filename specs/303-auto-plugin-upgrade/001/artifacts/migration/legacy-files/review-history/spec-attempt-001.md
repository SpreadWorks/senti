# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Define the upgrade invocation boundary
**Target:** Overview Data Flow / T-2
**Issue:** The spec says the plugin CLI should invoke existing `senti upgrade` and normalize the result, but the verified codebase makes invocation mode significant: `src/upgrade.js` writes directly to stdout/stderr and calls `process.exit(EXIT_ERROR)` on several failure paths, while `src/senti.js` initializes the container differently for top-level `upgrade` than for `plugin`.
**Required change:** State that automatic upgrade must run through the normal `senti upgrade` CLI entrypoint in a captured child process via the existing process helper, or through an explicitly equivalent adapter that preserves upgrade entry initialization, captures output, and converts exit status into the `upgrade` result object without allowing `process.exit` to bypass plugin output.
**Why blocking:** If implemented as an in-process import/call of `upgrade.main()`, existing failure paths can exit before the plugin result and upgrade failure are emitted, upgrade logs can contaminate `--json`, and top-level upgrade migration behavior may differ under plugin command initialization. That makes R6/R7 unsafe to implement and test correctly.

### 2. Preserve config.local plugin overlay behavior
**Target:** Data Flow / R9
**Issue:** The spec states install saves the package commit to config, but existing `installPlugin()` has a tested compatibility path for `.senti/config.local.json`: overlay-only private plugin sources/packages are materialized without writing private source/package data into public `.senti/config.json`. The spec does not call out this path while changing install/update-all orchestration and result metadata.
**Required change:** Add a compatibility requirement or acceptance note that install/update-all automatic-upgrade changes must continue respecting `.senti/config.local.json` overlays: overlay-only plugin sources/packages must not be persisted into public `.senti/config.json`, while upgrade decision/output metadata may still be computed from the merged project config.
**Why blocking:** Without this, an implementation can satisfy the new auto-upgrade flow by writing merged plugin package state back to public config, leaking private local source data and regressing verified existing plugin install behavior.


## Non-blocking Improvements

### 1. Document install --json in help expectations
**Target:** R6 / T-3
**Improvement:** Because R6 makes `--json` a supported output mode for `senti plugin install`, the help acceptance could also say install help should include `--json` alongside `--no-upgrade`.
**Why non-blocking:** The behavior can still be implemented and tested through JSON parsing assertions, but documenting it in help keeps the command metadata aligned with the new public option.
