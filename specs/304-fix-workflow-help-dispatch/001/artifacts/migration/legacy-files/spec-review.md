# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Required refine subcommand is not in the workflow command help surface
**Target:** R2 / AC2 / T-2 / .senti/plugins/workflow/commands/workflow.js
**Issue:** The spec requires `senti workflow --help` to contain `refine`, but the verified workflow plugin command's `helpText()` and `publicSurface` include only `add`, `update`, `show`, `search`, `list`, `publish`, and `ideas`. The spec also declares changing the workflow plugin implementation and updating `.senti/plugins/workflow` snapshots out of scope.
**Required change:** Remove `refine` from the required `senti workflow --help` subcommand list in R2, AC2, and T-2 so the spec matches the current workflow command surface.
**Why blocking:** After the dispatcher fix, the CLI will print the plugin command's existing help, which cannot satisfy AC2 because `refine` is absent. Keeping this requirement forces either an out-of-scope plugin/snapshot change or a failing acceptance test.


## Non-blocking Improvements

### 1. Clarify plugin subcommand help flag scope
**Target:** Scope / Requirements
**Improvement:** State whether only top-level plugin command help such as `senti workflow --help` is in scope, or whether nested forms like `senti workflow add --help` must also be preserved or changed.
**Why non-blocking:** The current acceptance criteria only exercise `senti workflow --help`, so implementation and tests can proceed without resolving nested plugin help semantics.
