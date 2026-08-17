# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/288-workflow-plugin-migration/test-coverage.json`

## Blocking Findings

### 1. R11 installability smoke can pass without using the external plugin workspace
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js: R11 test
**Issue:** The smoke test only asserts that .senti/config.json has a workflow package source whose path text matches /senti-workflow-plugin|workflow-plugin/, then asks the registry for a workflow command. It does not tie the enabled package source/commit to the in-boundary external plugin workspace recorded by plugin-workspace.json. An implementation could leave a stale installed/bundled workflow plugin elsewhere under .senti/plugins and still satisfy the registry and `senti workflow --help` checks.
**Required change:** Assert that the enabled workflow plugin resolves to the same external plugin workspace recorded by plugin-workspace.json, or otherwise verify the registry command/hook modules originate from that recorded in-boundary plugin path.
**Why blocking:** R11 specifically requires the migrated external workflow plugin to be installable/enabled from the external plugin repository. The current test can pass against an unrelated or stale workflow command and therefore may not exercise the migrated plugin installation path.


## Advisory Findings

### 1. R2 import guard is narrow
**Target:** specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js: R2/R3 no-import assertions
**Improvement:** Broaden the forbidden compatibility checks to catch additional ways of reaching removed core workflow behavior, such as dynamic import strings, child-process calls to core workflow entry points, or references to src/official-plugins/senti-workflow-plugin.
**Why non-blocking:** The tests already require service routing, shared service modules, and removal of core workflow directories, so this is a hardening improvement rather than a missing acceptance-level check.
