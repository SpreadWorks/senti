# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/284-plugin-mechanism-workflow-presets/test-coverage.json`

## Blocking Findings

### 1. Missing pinned-sync regression coverage
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js / R3
**Issue:** R3 requires reproducible commits, but the lifecycle test only verifies that install records a 40-character commit and update-all advances it. No test proves sync or install restores/copies the package from the recorded commit when the source repo has advanced afterward.
**Required change:** Add one spec-local regression test that installs a plugin, records the installed commit/content, advances the source repo, runs plugin sync without update-all, and asserts the copied plugin content still matches the pinned commit rather than the new HEAD.
**Why blocking:** Without this coverage, an implementation could always copy from the latest repo checkout and still pass the current tests, violating the reproducible commit requirement.

### 2. Contribution allowlist coverage uses only traversal
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-install-safety.test.js / R4
**Issue:** R4 requires rejecting contribution paths outside copied files, but the test uses ../outside.js. That mainly exercises path traversal rejection, not the distinct case where a contribution path is inside the repo but omitted from the declared files allowlist.
**Required change:** Add or adjust a test so the manifest declares files that do not include the contributed path, for example files: ["plugin.json"] with contributions.commands[0].path: "commands/index.js", and assert install is rejected.
**Why blocking:** An implementation could reject traversal while still allowing undeclared in-repo contribution files to be used or copied, leaving a required safety rule untested.


## Advisory Findings

### 1. Help tests are weaker than executable command coverage
**Target:** specs/284-plugin-mechanism-workflow-presets/tests/plugin-config-cli.test.js / R2-R3
**Improvement:** The help-output tests for repo and lifecycle commands could be supplemented with JSON/schema assertions or one executable smoke path for each subcommand family.
**Why non-blocking:** Executable lifecycle tests already cover the main plugin operations elsewhere, so this is a robustness improvement rather than missing requirement coverage.
