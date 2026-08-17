# Code Review Results

### 1. 1. Make the expected implementation order readable
**File:** `specs/251-fix-flow-impl-phase-order/tests/definition-impl-order.test.js`  
**Issue:** The expected child order is now a long inline array, which makes future order changes harder to review.  
**Suggestion:** Format the expected IDs as a multiline array before `assert.deepEqual`.

### 2. 2. Update stale requirement label in test name
**File:** `specs/251-fix-flow-impl-phase-order/tests/definition-impl-order.test.js`  
**Issue:** The test still uses `R1`, but the related requirements for this change are `R28` and `R34`. This makes traceability weaker.  
**Suggestion:** Rename the test description to reference the current requirement, e.g. `R34: impl branch children are ordered through test execution before review and gate`.

### 3. 3. Improve category variable naming
**File:** `src/check/commands/scan.js`  
**Issue:** `cat` is abbreviated and less clear now that category iteration is centralized through `iterateAnalysisCategories`.  
**Suggestion:** Rename `cat` to `category` in the loop:

```js
for (const [, category] of iterateAnalysisCategories(analysis)) {
  for (const entry of category.entries) {
    if (entry?.file) analyzedFiles.add(entry.file);
  }
}
```

### 4. 2. Improve category variable naming
**File:** `src/docs/commands/enrich.js`  
**Issue:** The variable name `cat` is terse and less consistent with the domain term used elsewhere (`category`).  
**Suggestion:** Rename `cat` to `category` in `collectEntries`:

```js
for (const [category, catData] of iterateAnalysisCategories(analysis)) {
  ...
  entries.push({ category, ... });
}
```

### 5. 1. Avoid intermediate iterator materialization
**File:** `src/docs/commands/review.js`  
**Issue:** `const analysisCategories = [...iterateAnalysisCategories(analysis)].map(([k]) => k);` allocates an intermediate array of category tuples only to immediately map it.  
**Suggestion:** Use `Array.from` with a mapper and a clearer variable name:

```js
const analysisCategories = Array.from(
  iterateAnalysisCategories(analysis),
  ([category]) => category,
);
```

### 6. 1. Consolidate Test Command Selection Logic
**File:** `src/docs/lib/test-env-detection.js`  
**Issue:** `detectTestCommandFromAnalysis()` and `detectTestCommandFromRoot()` duplicate the same source-order logic and command strings. This can drift and would directly affect R27 consistency.  
**Suggestion:** Extract a shared helper like `selectTestCommand({ configuredCommand, packageScripts, composerScripts, hasMakefileTest })` and let the analysis/root functions only normalize their inputs before calling it.

### 7. 2. Bound Root File Reads
**File:** `src/docs/lib/test-env-detection.js`  
**Issue:** `detectTestCommandFromRoot()` reads `package.json`, `composer.json`, and `Makefile` fully with no size cap. This violates `bounded-resource-usage` for bulk data loading; the matched acknowledgment does not specifically cover these filesystem reads.  
**Suggestion:** Add a small bounded reader, for example checking `fs.statSync(path).size` before `readFileSync`, with explicit limits for JSON files and Makefiles.

### 8. 3. Simplify Immutable Local
**File:** `src/docs/lib/test-env-detection.js`  
**Issue:** `configuredTestCommand` is declared with `let` but is never reassigned.  
**Suggestion:** Change it to `const configuredTestCommand = analysis?.config?.test?.command || null;` for consistency with the surrounding immutable values.

### 9. 1. Consolidate Test Command Selection Logic
**File:** `src/docs/lib/test-env-detection.js`  
**Issue:** `detectTestCommandFromAnalysis()` and `detectTestCommandFromRoot()` duplicate the same source-order logic and command strings. This can drift and would directly affect R27 consistency.  
**Suggestion:** Extract a shared helper like `selectTestCommand({ configuredCommand, packageScripts, composerScripts, hasMakefileTest })` and let the analysis/root functions only normalize their inputs before calling it.

### 10. 2. Bound Root File Reads
**File:** `src/docs/lib/test-env-detection.js`  
**Issue:** `detectTestCommandFromRoot()` reads `package.json`, `composer.json`, and `Makefile` fully with no size cap. This violates `bounded-resource-usage` for bulk data loading; the matched acknowledgment does not specifically cover these filesystem reads.  
**Suggestion:** Add a small bounded reader, for example checking `fs.statSync(path).size` before `readFileSync`, with explicit limits for JSON files and Makefiles.

### 11. 3. Simplify Immutable Local
**File:** `src/docs/lib/test-env-detection.js`  
**Issue:** `configuredTestCommand` is declared with `let` but is never reassigned.  
**Suggestion:** Change it to `const configuredTestCommand = analysis?.config?.test?.command || null;` for consistency with the surrounding immutable values.

### 12. I’ll verify the touched file context before proposing anything, especially whether the modified imports and fallback paths are consistent with the surrounding module.The `.tmp` directory doesn’t contain the source tree, so I’ll base the review on the supplied diff and keep proposals strictly to those two touched paths.### 1. Remove stale analysis import
**File:** `src/docs/lib/text-prompts.js`  
**Issue:** `ANALYSIS_META_KEYS` appears to become unused after switching `getEnrichedContext()` to `iterateAnalysisCategories()`.  
**Suggestion:** Import only `iterateAnalysisCategories` unless `ANALYSIS_META_KEYS` is still used elsewhere in this file.

### 13. 2. Avoid ambiguous `redolog` fallback
**File:** `src/flow/commands/report.js`  
**Issue:** `input.redolog` introduces an unexplained alternate input name and looks like either a typo or backward-compatibility fallback. That conflicts with the project’s alpha policy against keeping legacy paths.  
**Suggestion:** Require callers to pass `issueLog`, or normalize this before calling `generateReport()`. If a redo log concept is intentional, use a clearly named property such as `redoLog` and keep it distinct from `issueLog`.

### 14. 3. Extract project regression text formatting
**File:** `src/flow/commands/report.js`  
**Issue:** The `Project regression` line is built inline with defaults and optional category logic, making the report formatter harder to scan as more test fields are added.  
**Suggestion:** Move this into a small helper such as `formatProjectRegression(projectRegression)` and have `formatText()` only append the returned line.

### 15. 1. Clarify durable-only pathspec helper
**File:** `src/flow/lib/run-finalize-commit.js`  
**Issue:** `specArtifactPathspecs()` now returns only `DURABLE_TEST_ARTIFACT_RELATIVE_PATHS`, but the name still sounds like all spec artifact pathspecs. The temporary summary exclusion is handled separately, which makes the helper name slightly misleading.  
**Suggestion:** Rename it to `durableSpecArtifactPathspecs()` or `durableTestArtifactPathspecs()`.

### 16. 2. Remove single-use plural wrapper
**File:** `src/flow/lib/run-finalize-commit.js`  
**Issue:** `TEMPORARY_TEST_ARTIFACT_RELATIVE_PATHS` wraps a single imported constant and is only used once. The plural array adds indirection without reducing duplication.  
**Suggestion:** Inline `[TEMP_SUMMARY_RELATIVE]` at the call site, or introduce a shared helper like `specRelativePathspecs(specId, relativePaths)` if both durable and temporary pathspec construction should stay symmetric.

### 17. 1. Clarify durable-only pathspec helper
**File:** `src/flow/lib/run-finalize-commit.js`  
**Issue:** `specArtifactPathspecs()` now returns only `DURABLE_TEST_ARTIFACT_RELATIVE_PATHS`, but the name still sounds like all spec artifact pathspecs. The temporary summary exclusion is handled separately, which makes the helper name slightly misleading.  
**Suggestion:** Rename it to `durableSpecArtifactPathspecs()` or `durableTestArtifactPathspecs()`.

### 18. 2. Remove single-use plural wrapper
**File:** `src/flow/lib/run-finalize-commit.js`  
**Issue:** `TEMPORARY_TEST_ARTIFACT_RELATIVE_PATHS` wraps a single imported constant and is only used once. The plural array adds indirection without reducing duplication.  
**Suggestion:** Inline `[TEMP_SUMMARY_RELATIVE]` at the call site, or introduce a shared helper like `specRelativePathspecs(specId, relativePaths)` if both durable and temporary pathspec construction should stay symmetric.

### 19. 3. Clarify report input naming
**File:** `src/flow/lib/run-finalize.js`
**Issue:** The `generateReport()` call changed from `redolog: issueLog` to `issueLog`, which may drift from the established report API naming.
**Suggestion:** If `generateReport()` still expects `redolog`, keep the key as `redolog`. If the API was intentionally renamed, update all call sites consistently so finalize/report/report-show use the same envelope shape.

### 20. 4. Align commit wording with staged files
**File:** `src/flow/lib/run-finalize.js`
**Issue:** The code now stages only durable test artifacts, but the commit message still says `chore: add retro and report`.
**Suggestion:** Rename the message to match the new behavior, for example `chore: add durable test artifacts`, or include report/retro paths explicitly if those are still intended to be staged.

### 21. I’ll review the touched code against the requested maintainability angles and the bounded-resource guardrail, keeping proposals scoped to the two files in the diff.The provided worktree path appears to contain only the review input area rather than the full repository source, so I’m relying on the diff itself for the proposals.### 1. Consolidate artifact validation
**File:** `src/flow/lib/run-gate.js`
**Issue:** `checkIntegrationTestArtifacts()` still performs local existence checks before delegating to `assertIntegrationRegressionEvidence()`, splitting validation responsibility.
**Suggestion:** Let `assertIntegrationRegressionEvidence()` own presence, readability, version, and regression checks, and only translate its thrown error into `gateFail()` here.

### 22. 2. Remove duplicate config defaulting
**File:** `src/flow/lib/run-gate.js`
**Issue:** `config = {}` in `checkIntegrationTestArtifacts()` duplicates the caller’s `ctx.config || {}` fallback.
**Suggestion:** Keep the default in one place. Prefer passing `ctx.config || {}` at the call site and making `config` a required parameter internally.

### 23. 1. Combine Identical Next-Step Branches
**File:** `src/flow/lib/run-impl-confirm.js`  
**Issue:** `allDone` and `noRequirements` now both assign `next = "test-execute"`, leaving duplicated branch bodies.  
**Suggestion:** Collapse them into one condition:

```js
if (allDone || noRequirements) {
  next = "test-execute";
} else {
  next = "fix";
}
```

### 24. 2. Extract Repeated Docs-Scan Registration Sequence
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `runDocsScanAndValidate(specRoot);` is repeated in all three successful setup branches immediately before `flowManager.addActiveFlow(...)`. This duplicates the ordering-sensitive prepare logic.  
**Suggestion:** Introduce a small helper such as `registerActiveFlowAfterDocsScan(kind)` that runs the scan, validates analysis, then calls `flowManager.addActiveFlow(specDirName, kind)`. This keeps the requirement-critical ordering in one place.

### 25. 3. Make Helper Name More Specific
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `runDocsScanAndValidate` sounds like it validates the docs scan generally, but the implementation specifically validates `.sdd-forge/output/analysis.json`.  
**Suggestion:** Rename it to something like `runDocsScanAndValidateAnalysis` or `runDocsScanAndValidateAnalysisOutput` so the name matches the behavior.

### 26. 2. Make report text validation explicit in the function name
**File:** `src/flow/lib/run-report-show.js`  
**Issue:** `readReportText()` now does more than read `json.text`: it validates report test data shape and validates sidecar test artifacts through `loadValidatedTestArtifacts()`. The name hides a blocking validation side effect.  
**Suggestion:** Rename it to something like `readValidatedReportText()` or split the validation into `validateReportTestData(reportPath, json)`, then call that before returning `json.text`.

### 27. 3. Harden the `projectRegression` check against malformed `tests`
**File:** `src/flow/lib/run-report-show.js`  
**Issue:** `if (json.data?.tests && !("projectRegression" in json.data.tests))` assumes `json.data.tests` is an object. If malformed report data sets `tests` to a truthy primitive, the `in` operator throws a generic `TypeError` instead of the intended report-show error.  
**Suggestion:** First check `typeof json.data.tests === "object" && json.data.tests !== null`, then perform the `projectRegression` membership check. This keeps invalid report failures consistent and easier to diagnose.

### 28. I’ll inspect the touched files around the changed code so the proposals stay grounded in the actual local patterns, and I’ll keep the review scoped to the diff files only.The current working directory is the `.tmp` area, and the source tree is not rooted there. I’m going to locate the repository root from here without leaving the worktree boundary.### 1. Avoid double-reading test artifacts
**File:** `src/flow/lib/run-report.js`  
**Issue:** `testExecuteResult` and `testResultReview` are parsed only to decide whether to call `buildTestResultsFromArtifacts(specDir)`, which then reads and validates the same files again. This duplicates I/O and parsing, and leaves `readJsonIfExists()` doing work that no longer contributes data.  
**Suggestion:** Replace those two `readJsonIfExists()` calls with existence checks, e.g. `hasTestExecuteResult` / `hasTestResultReview`, then call `buildTestResultsFromArtifacts(specDir)` when either exists. Keep `readJsonIfExists()` only for `retro.json`.

### 29. 4. Include artifact names in validation failures
**File:** `src/flow/lib/run-retro.js`  
**Issue:** `validateTestResultReview(review)` and `validateTestExecuteResultV2(result)` are wrapped in one catch block that returns `TEST_ARTIFACT_INVALID` with only `err.message`. If validation fails, the operator may not know which artifact is invalid.  
**Suggestion:** Validate each artifact through a small local helper or separate try/catch blocks so the failure message includes `test-result-review.json` or `test-execute-result.json`.

### 30. I’ll treat this as a scoped code-quality review only against the two diff files and keep the output in the requested proposal format.The provided working directory does not contain the `src/flow/...` files, so I’m basing the review on the diff text you supplied rather than local file reads.### 1. Make the reset trigger ignore dry runs
**File:** `src/flow/lib/run-review.js`  
**Issue:** `resetImplEvidenceAfterReviewProposals()` resets downstream evidence whenever `proposalCount > 0`, but `run-review` now records `dryRun` in `artifacts`. A dry run can produce proposals without applying code changes, so resetting test evidence would be unnecessary state churn.  
**Suggestion:** Add an explicit guard such as `if (result?.artifacts?.dryRun) return false;` before deleting artifacts.

### 31. 2. Extract reset step IDs into a named constant
**File:** `src/flow/lib/run-review.js`  
**Issue:** The step IDs reset after review proposals are embedded inline in the mutation loop. This makes the artifact reset list named and discoverable, while the corresponding state reset list remains anonymous.  
**Suggestion:** Add a constant near `DOWNSTREAM_AFTER_REVIEW_APPLY`, for example `STEPS_RESET_AFTER_REVIEW_APPLY`, and iterate over that.

### 32. 3. Recheck whether `review` should be reset
**File:** `src/flow/lib/run-review.js`  
**Issue:** The comment says the flow is sent “back to test-execute,” and the related requirements mention resetting `test-execute`, `test-result-review`, `gate-impl`, and `retro`. The implementation also resets `review`, which may make next-action selection less obvious and creates a mismatch with the documented intent.  
**Suggestion:** Remove `"review"` from the reset step list unless there is a concrete reason to rerun impl review; if it is intentional, rename/comment the reset list to make that behavior explicit.

### 33. 1. Cache Spec Test File Discovery
**File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `findSpecTestFileForReq()` calls `listSpecTestFiles()` once for scanning and again for fallback, and `buildSummary()` repeats that per requirement. This duplicates directory scans and file reads.  
**Suggestion:** Build a spec-test index once in `buildSummary()` or before it, then pass it into lookup/extraction helpers.

### 34. 2. Extract Pass/Fail Result Predicate
**File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The process pass condition is repeated in `specLocalPassed()`, `buildRequiredRegression()`, and the regression raw-log marker construction.  
**Suggestion:** Add a single helper such as `processPassed(result)` and use it for spec-local tests, regression artifact creation, and raw-log result strings.

### 35. 3. Simplify Artifact Removal Helper
**File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `removeIfExists()` checks existence before `fs.rmSync(..., { force: true })`, but `force: true` already makes missing files harmless.  
**Suggestion:** Replace the helper body with `fs.rmSync(filePath, { force: true });`.

### 36. 4. Rename Ambiguous Range Variables
**File:** `src/flow/lib/run-test-execute.js`  
**Issue:** Parameters named `range` are used for raw output line ranges, but the name is generic and easy to confuse with command scope or target ranges.  
**Suggestion:** Rename to `rawOutputRange` in `buildSummary()` and `buildRequiredRegression()`.

### 37. 5. Remove Redundant Review Checks
**File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `validateSummaryAgainstFiles()` performs file/name checks that appear to overlap with `validateTestExecuteResultV2()` and the validation already done during result composition.  
**Suggestion:** If `validateTestExecuteResultV2()` already guarantees evidence shape, keep this function focused on cross-file/raw-output checks only, or rename it to reflect the extra filesystem validation.

### 38. 6. Consolidate Check Item Construction
**File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `pass()` and `fail()` are tiny object factories, but callers still repeat string literals for check names. This makes check naming drift more likely.  
**Suggestion:** Define constants for check names such as `CHECK_SUMMARY_COMPLETENESS` and use them in all pass/fail calls.

### 39. 1. Remove unused import
**File:** `src/flow/lib/set-step.js`  
**Issue:** `loadValidatedTestArtifacts` is imported from `./test-artifacts.js` but never used.  
**Suggestion:** Remove it from the import list to avoid dead code and lint noise.

### 40. 2. Extract repeated regression evidence validation
**File:** `src/flow/lib/set-step.js`  
**Issue:** The `gate-impl` and `retro` branches duplicate the same `assertIntegrationRegressionEvidence({ root, state, specDir, config })` call and repeat config lookup logic.  
**Suggestion:** Add a small helper such as `assertCurrentRegressionEvidence(ctx, state, specDir)` and reuse it in both branches.

### 41. 3. Rename validation helper for intent
**File:** `src/flow/lib/set-step.js`  
**Issue:** `validatePostHookManagedStep` is vague. The function specifically validates manual `done` transitions for steps whose completion artifacts are normally produced by the flow.  
**Suggestion:** Rename it to something more explicit, for example `validateManualDoneTransitionArtifacts` or `validateManualDoneStepArtifacts`.

### 42. 4. Make artifact error message step-specific
**File:** `src/flow/lib/set-step.js`  
**Issue:** The failure message always says `valid current v2 test artifacts`, but `gate-impl` validates regression evidence and `retro` also checks `retro.json`. This can mislead operators when the missing artifact is not a v2 test artifact.  
**Suggestion:** Use a more general message such as `without required current flow artifacts`, or map each step to a clearer artifact description.

### 43. 5. Avoid recreating the managed step list inline
**File:** `src/flow/lib/set-step.js`  
**Issue:** `["test-execute", "test-result-review", "gate-impl", "retro"]` is embedded directly in the execution path. If this list grows or is reused, it is easy to miss updates.  
**Suggestion:** Define a module-level constant like `MANUAL_DONE_VALIDATED_STEPS` and use `.has(id)` via a `Set` for clearer intent.

### 44. 1. Remove unused import
**File:** `src/flow/lib/set-step.js`  
**Issue:** `loadValidatedTestArtifacts` is imported from `./test-artifacts.js` but never used.  
**Suggestion:** Remove it from the import list to avoid dead code and lint noise.

### 45. 2. Extract repeated regression evidence validation
**File:** `src/flow/lib/set-step.js`  
**Issue:** The `gate-impl` and `retro` branches duplicate the same `assertIntegrationRegressionEvidence({ root, state, specDir, config })` call and repeat config lookup logic.  
**Suggestion:** Add a small helper such as `assertCurrentRegressionEvidence(ctx, state, specDir)` and reuse it in both branches.

### 46. 3. Rename validation helper for intent
**File:** `src/flow/lib/set-step.js`  
**Issue:** `validatePostHookManagedStep` is vague. The function specifically validates manual `done` transitions for steps whose completion artifacts are normally produced by the flow.  
**Suggestion:** Rename it to something more explicit, for example `validateManualDoneTransitionArtifacts` or `validateManualDoneStepArtifacts`.

### 47. 4. Make artifact error message step-specific
**File:** `src/flow/lib/set-step.js`  
**Issue:** The failure message always says `valid current v2 test artifacts`, but `gate-impl` validates regression evidence and `retro` also checks `retro.json`. This can mislead operators when the missing artifact is not a v2 test artifact.  
**Suggestion:** Use a more general message such as `without required current flow artifacts`, or map each step to a clearer artifact description.

### 48. 5. Avoid recreating the managed step list inline
**File:** `src/flow/lib/set-step.js`  
**Issue:** `["test-execute", "test-result-review", "gate-impl", "retro"]` is embedded directly in the execution path. If this list grows or is reused, it is easy to miss updates.  
**Suggestion:** Define a module-level constant like `MANUAL_DONE_VALIDATED_STEPS` and use `.has(id)` via a `Set` for clearer intent.

### 49. 1. Remove Stale Verbose-Flag Examples
**File:** `src/flow/prompts/impl/test-execute.md`
**Issue:** The discovery list now excludes language-specific implicit config and only supports config/package/composer/Makefile sources, but the verbose execution guidance still names `pytest -v` and `jest --verbose`. That can steer agents back toward unsupported language-specific assumptions.
**Suggestion:** Reword the verbose guidance generically, or tie examples only to supported discovered commands, e.g. “append supported verbose flags only when they are valid for the discovered command.”

### 50. 2. Clarify Duplicate Regression Command Fields
**File:** `src/flow/prompts/impl/test-execute.md`
**Issue:** The sample regression object includes both `root_test_command` and `command` with the same value. Without explaining the distinction, agents may populate them inconsistently or treat one as redundant.
**Suggestion:** Add a short field note explaining that `root_test_command` is the discovered canonical root command, while `command` is the actual executed command. If they are always identical in v2, remove one from the prompt example if the schema allows it.

### 51. 1. Remove Stale Verbose-Flag Examples
**File:** `src/flow/prompts/impl/test-execute.md`
**Issue:** The discovery list now excludes language-specific implicit config and only supports config/package/composer/Makefile sources, but the verbose execution guidance still names `pytest -v` and `jest --verbose`. That can steer agents back toward unsupported language-specific assumptions.
**Suggestion:** Reword the verbose guidance generically, or tie examples only to supported discovered commands, e.g. “append supported verbose flags only when they are valid for the discovered command.”

### 52. 2. Clarify Duplicate Regression Command Fields
**File:** `src/flow/prompts/impl/test-execute.md`
**Issue:** The sample regression object includes both `root_test_command` and `command` with the same value. Without explaining the distinction, agents may populate them inconsistently or treat one as redundant.
**Suggestion:** Add a short field note explaining that `root_test_command` is the discovered canonical root command, while `command` is the actual executed command. If they are always identical in v2, remove one from the prompt example if the schema allows it.

### 53. I’ll review only the touched files from the supplied diff and check whether the bounded-resource guardrail raises anything actionable.The worktree `.tmp` directory doesn’t contain the repository files, so I’m basing this review on the supplied diff only.### 1. Extract shared artifact validation setup
**File:** `src/flow/registry.js`  
**Issue:** The new `test-execute` and `test-result-review` post-hooks duplicate lazy imports, `specDir` resolution, JSON reading, and artifact path construction.  
**Suggestion:** Add a small helper in `registry.js`, for example `readCurrentSpecArtifact(ctx, fileName)`, and reuse it from both hooks. Keep lazy imports inside the helper if that pattern is intentional.

### 54. 2. Name the side-effecting review reset result
**File:** `src/flow/registry.js`  
**Issue:** `if (!ctx.dryRun && reviewMod.resetImplEvidenceAfterReviewProposals(ctx, result)) return;` hides a side effect inside a compound condition, making the post-hook flow harder to scan.  
**Suggestion:** Split it into a named boolean, such as `const didResetImplEvidence = !ctx.dryRun && reviewMod.resetImplEvidenceAfterReviewProposals(ctx, result); if (didResetImplEvidence) return;`.

### 55. 3. Centralize artifact filenames used by post-hooks
**File:** `src/flow/registry.js`  
**Issue:** Artifact filenames like `test-execute-result.json` and `test-result-review.json` are now used both in user-facing output text and validation logic, which can drift.  
**Suggestion:** Define local constants for these filenames in `registry.js` and reference them from both the `output` strings and post-hook validation paths.

### 56. I’ll review only the touched files from the supplied diff and check whether the bounded-resource guardrail raises anything actionable.The worktree `.tmp` directory doesn’t contain the repository files, so I’m basing this review on the supplied diff only.### 1. Extract shared artifact validation setup
**File:** `src/flow/registry.js`  
**Issue:** The new `test-execute` and `test-result-review` post-hooks duplicate lazy imports, `specDir` resolution, JSON reading, and artifact path construction.  
**Suggestion:** Add a small helper in `registry.js`, for example `readCurrentSpecArtifact(ctx, fileName)`, and reuse it from both hooks. Keep lazy imports inside the helper if that pattern is intentional.

### 57. 2. Name the side-effecting review reset result
**File:** `src/flow/registry.js`  
**Issue:** `if (!ctx.dryRun && reviewMod.resetImplEvidenceAfterReviewProposals(ctx, result)) return;` hides a side effect inside a compound condition, making the post-hook flow harder to scan.  
**Suggestion:** Split it into a named boolean, such as `const didResetImplEvidence = !ctx.dryRun && reviewMod.resetImplEvidenceAfterReviewProposals(ctx, result); if (didResetImplEvidence) return;`.

### 58. 3. Centralize artifact filenames used by post-hooks
**File:** `src/flow/registry.js`  
**Issue:** Artifact filenames like `test-execute-result.json` and `test-result-review.json` are now used both in user-facing output text and validation logic, which can drift.  
**Suggestion:** Define local constants for these filenames in `registry.js` and reference them from both the `output` strings and post-hook validation paths.

### 59. 1. Add explicit type for artifact version
**File:** `src/flow/schemas/next-action/test-execute.schema.json`  
**Issue:** `artifact_version` uses `enum: ["2"]` without an explicit `"type": "string"`, while the surrounding schema properties declare their primitive types directly.  
**Suggestion:** Define it as `"artifact_version": { "type": "string", "enum": ["2"] }` for consistency and clearer validation intent.

### 60. 1. Add explicit type for artifact version
**File:** `src/flow/schemas/next-action/test-execute.schema.json`  
**Issue:** `artifact_version` uses `enum: ["2"]` without an explicit `"type": "string"`, while the surrounding schema properties declare their primitive types directly.  
**Suggestion:** Define it as `"artifact_version": { "type": "string", "enum": ["2"] }` for consistency and clearer validation intent.

### 61. 1. Consolidate duplicated schema fragments
**File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** `raw_output_lines` and changed-file item schemas are duplicated inline. This makes future schema changes easy to miss in one location.  
**Suggestion:** If the local validator supports it, extract shared definitions using `$defs` / `$ref`. If not, consider moving repeated cross-field/detail validation into deterministic validator functions and keep the schema narrower.

### 62. 2. Rename missing-type compatibility option
**File:** `src/lib/config.js`  
**Issue:** `allowMissingType` is vague and reads like a general schema behavior switch, but it only suppresses one specific legacy/default config error string.  
**Suggestion:** Rename it to something narrower such as `allowMissingConfigType` or `ignoreMissingTopLevelType`, and document why this exception exists.

### 63. 3. Avoid brittle error-string filtering
**File:** `src/lib/config.js`  
**Issue:** `MISSING_TYPE_ERROR` depends on the exact text emitted by `validateSchema`. If the schema validator wording changes, `allowMissingType` silently stops working.  
**Suggestion:** Prefer a structured validation option, or make the schema requirement conditional before validation instead of removing an error afterward by string match.

### 64. 4. Remove duplicate shell-metacharacter definitions
**File:** `src/lib/config.js`  
**Issue:** `TEST_COMMAND_FORBIDDEN` and the inline `test.projectPaths` metacharacter regex overlap but are maintained separately.  
**Suggestion:** Extract shared character-class constants or helper functions, with separate names only for the genuinely different command/path rules.

### 65. 5. Tighten timeout schema type
**File:** `src/lib/config.js`  
**Issue:** `test.timeout` is declared as `"number"` in the schema, then integer-checked separately.  
**Suggestion:** If the schema subset supports it, use `"integer"` directly. If not, add a short comment near the cross-field validation explaining why integer enforcement lives outside the schema.

### 66. 2. Avoid duplicate error reporting on config load failure
**File:** `src/lib/container.js`  
**Issue:** Invalid config now writes directly to `stderr` and then rethrows. If the caller already reports command startup failures through the standard error/envelope path, this can produce duplicate or inconsistent error output.  
**Suggestion:** Let the existing command error path own presentation. Either remove the `process.stderr.write(...)` before `throw err`, or wrap/log only at the outer command boundary.

### 67. 1. Keep delegator formatting consistent
**File:** `src/lib/flow-manager.js`  
**Issue:** `completeTask()` was expanded to a multi-line method while the surrounding `FlowManager` methods are compact one-line delegators. This adds noise without changing behavior.  
**Suggestion:** Restore the one-line form:

```js
completeTask(taskId) { return this._store.completeTask(taskId); }
```

### 68. 1. Use NUL-delimited Git output for path parsing
**File:** `src/lib/git-helpers.js`  
**Issue:** `parsePorcelainLine()` and the committed diff parsing rely on whitespace, tabs, quotes, and `" -> "` splitting. This is fragile for paths containing tabs, newlines, quotes, backslashes, or the literal rename separator text.  
**Suggestion:** Use `git diff --name-status -z` and `git status --porcelain=v1 -z`, then parse NUL-delimited records. That removes the need for ad hoc quote stripping and makes renamed/untracked paths reliable.

### 69. 2. Extract committed diff line parsing
**File:** `src/lib/git-helpers.js`  
**Issue:** `listChangedFilesDetailed()` repeats status normalization logic inline for committed changes, while porcelain changes use `normalizeStatus()` and `parsePorcelainLine()`. This creates two status mapping paths to keep in sync.  
**Suggestion:** Add a `parseNameStatusEntry()` helper and have `listChangedFilesDetailed()` call it. Keep all Git status-to-entry conversion in small parser helpers.

### 70. 1. Use NUL-delimited Git output for path parsing
**File:** `src/lib/git-helpers.js`  
**Issue:** `parsePorcelainLine()` and the committed diff parsing rely on whitespace, tabs, quotes, and `" -> "` splitting. This is fragile for paths containing tabs, newlines, quotes, backslashes, or the literal rename separator text.  
**Suggestion:** Use `git diff --name-status -z` and `git status --porcelain=v1 -z`, then parse NUL-delimited records. That removes the need for ad hoc quote stripping and makes renamed/untracked paths reliable.

### 71. 2. Extract committed diff line parsing
**File:** `src/lib/git-helpers.js`  
**Issue:** `listChangedFilesDetailed()` repeats status normalization logic inline for committed changes, while porcelain changes use `normalizeStatus()` and `parsePorcelainLine()`. This creates two status mapping paths to keep in sync.  
**Suggestion:** Add a `parseNameStatusEntry()` helper and have `listChangedFilesDetailed()` call it. Keep all Git status-to-entry conversion in small parser helpers.

### 72. 1. Preserve spawn error normalization in the helper
**File:** `src/lib/process.js`  
**Issue:** `runCmdAsync()` now returns `errorCode`, but `toProcessResult()` ignores it unless callers manually pass `opts.spawnError`. That spreads classification knowledge to callers and makes the helper less complete.  
**Suggestion:** Include `errorCode?: string|null` in the JSDoc input type and default `spawnError` from it, e.g. `spawnError: opts.spawnError ?? res.errorCode ?? null`.

### 73. 2. Clarify `TestConfig.command` documentation
**File:** `src/lib/types.js`  
**Issue:** `TestConfig.command` is typed as `string`, but the description says “parsed as argv-style tokens,” which can read as if the stored value is already tokenized.  
**Suggestion:** Reword to describe the stored contract directly, such as “Root project regression command string parsed into argv-style tokens during execution.”

### 74. 2. Split Combined Regression Failure Message
**File:** `src/locale/en/messages.json`  
**Issue:** `projectRegressionBlocked` combines two different states, “failed” and “stale”, into one message. That makes the message less precise and can make future callers choose an over-broad label.  
**Suggestion:** Prefer separate localized keys such as `projectRegressionFailed` and `projectRegressionStale`, or rename this one to a broader `projectRegressionBlocked` message that avoids implying the exact cause.

### 75. I’ll treat this as a review-only pass and keep proposals limited to the two locale files shown in the diff. I’m going to check nearby locale structure so any naming or duplication comments are grounded in the existing pattern.The provided cwd is a temporary work area that does not contain `src/`, so I can’t inspect the full repository from here. I’ll base the review on the supplied diff and the local consistency visible in those changed snippets.### 1. Align Test Config Wording
**File:** `src/locale/en/ui.json`  
**Issue:** `step2` says “project test paths”, while the later config label uses the exact key `test.projectPaths`. This introduces avoidable naming drift in user-facing text.  
**Suggestion:** Change `project test paths` to `test.projectPaths`, e.g. `Configure test.command or test.projectPaths before implementation flows that need project regression checks`.

### 76. 2. Reduce Mixed English/Japanese Runtime Wording
**File:** `src/locale/ja/messages.json`  
**Issue:** The added Japanese locale strings contain mixed terms like `test artifact`, `project regression`, and `stale`. Some command/artifact names must remain literal, but generic words should be localized for readability and consistency.  
**Suggestion:** Keep filenames and commands literal, but localize descriptive terms, e.g. `テスト成果物の検証に失敗しました...` and `プロジェクト回帰テストが失敗したか、結果が stale です...`.

### 77. 1. Align Japanese Terminology for Test Config Keys
**File:** `src/locale/ja/ui.json`  
**Issue:** The new setup message says `project test paths`, while the config glossary below uses the actual key `test.projectPaths`. This creates avoidable terminology drift in user-facing Japanese help.  
**Suggestion:** Use the exact config key in the setup message, e.g. `test.command または test.projectPaths を設定してください`.

### 78. I’ll inspect the touched files around the diff so the proposals are grounded in the existing patterns and stay within the requested scope.The `.tmp` worktree path does not contain those source paths directly, so I’ll check the workspace layout before drawing conclusions from local context.### 1. Extract script detection helper
**File:** `src/presets/base/data/package.js`  
**Issue:** `package.json` and `composer.json` now both need “non-empty scripts” detection, which duplicates the same `parsed.scripts && Object.keys(parsed.scripts).length > 0` pattern.  
**Suggestion:** Add a small helper such as `nonEmptyScripts(parsed)` and use it for both `packageScripts` and `composerScripts`.

### 79. 2. Split `parse()` by file kind
**File:** `src/presets/base/data/package.js`  
**Issue:** `parse()` now handles Makefile scanning plus two JSON formats in one method, making the file-type branching harder to scan as more discovery sources are added.  
**Suggestion:** Keep `parse()` as a dispatcher and extract `parseMakefile(absPath, entry)`, `parsePackageJson(parsed, entry)`, and `parseComposerJson(parsed, entry)` helpers.

### 80. 3. Improve Makefile naming
**File:** `src/presets/base/data/package.js`  
**Issue:** `MAKE_FILES` is slightly misleading because it stores accepted Makefile basenames, not files.  
**Suggestion:** Rename it to `MAKEFILE_NAMES` or `MAKEFILE_BASENAMES` to match its actual role and make `match()` easier to read.

### 81. 4. Rename category loop variable
**File:** `src/presets/base/data/structure.js`  
**Issue:** `allItems()` now delegates category filtering to `iterateAnalysisCategories()`, but the loop variable remains `val`, which obscures the expected shape of each yielded value.  
**Suggestion:** Rename `val` to `category` or `analysisCategory`, then use `category.entries` inside the loop.

### 82. I’ll check the touched files in context so the proposals are grounded in the actual local patterns, not just the snippet.The current working directory is the flow temp directory and does not contain `src/`, so I’m locating the actual worktree root while staying within the provided worktree boundary.The touched helper usage is consistent with nearby analysis iteration code. I’m checking the helper contract once to see whether this diff introduces any hidden assumptions.### 1. Collapse duplicated next-step output
**File:** `src/setup.js`
**Issue:** The final summary now repeats the same `console.log` pattern for each numbered setup step. This is small now, but it will keep growing line-by-line as more steps are added.
**Suggestion:** Use a local list of message keys and loop over it:

```js
for (const key of ["step1", "step2"]) {
  console.log(`    ${t(`setup.messages.${key}`)}`);
}
```

No guardrail violations found in the touched files.

### 83. I’ll check the touched files in context so the proposals are grounded in the actual local patterns, not just the snippet.The current working directory is the flow temp directory and does not contain `src/`, so I’m locating the actual worktree root while staying within the provided worktree boundary.The touched helper usage is consistent with nearby analysis iteration code. I’m checking the helper contract once to see whether this diff introduces any hidden assumptions.### 1. Collapse duplicated next-step output
**File:** `src/setup.js`
**Issue:** The final summary now repeats the same `console.log` pattern for each numbered setup step. This is small now, but it will keep growing line-by-line as more steps are added.
**Suggestion:** Use a local list of message keys and loop over it:

```js
for (const key of ["step1", "step2"]) {
  console.log(`    ${t(`setup.messages.${key}`)}`);
}
```

No guardrail violations found in the touched files.

### 84. 2. Keep Post-Hook Step Terminology Consistent
**File:** `src/templates/partials/flow-tracking.md`  
**Issue:** This file says these steps are advanced by CLI post hooks, while `rules.json` says “post-hook and deterministic validator.” The slight wording difference makes the rule source less consistent.  
**Suggestion:** Use the same phrase in both places, for example: “advanced by post hooks after deterministic validation,” so generated instructions do not appear to describe different mechanisms.

### 85. 1. Broaden the Rule ID
**File:** `src/templates/skills/rules.json`  
**Issue:** The new rule id `post-hook-managed-test-artifacts` is narrower than the rule’s actual scope. It covers `gate-impl`, `retro`, prerequisite hard stops, and raw logs, not only test artifacts.  
**Suggestion:** Rename it to something like `post-hook-managed-flow-steps` or `no-manual-post-hook-step-completion` to better match the behavior being enforced.

### 86. 1. Split Dense Flow Outcome Note Into Structured Bullets
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The expanded note now combines artifact format, step ownership, hard-stop behavior, regression evidence behavior, and manual completion constraints in one long paragraph. That makes future edits more likely to introduce inconsistent wording.  
**Suggestion:** Rewrite the note as a short bullet list under a heading like “Test execution contract,” keeping each rule separate: centralized execution, v2 artifacts, artifact consumers, hard stops, started regression failures, and manual-step restrictions.

### 87. 2. Use More Explicit Failure Terminology
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** “A started project regression failure” is slightly ambiguous because “started” modifies the failure rather than the command execution.  
**Suggestion:** Rename the phrase to something more direct, such as “A project regression command that started and failed,” to distinguish it clearly from “a prerequisite failure before command start.”

### 88. 1. Split Dense Flow Outcome Note Into Structured Bullets
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The expanded note now combines artifact format, step ownership, hard-stop behavior, regression evidence behavior, and manual completion constraints in one long paragraph. That makes future edits more likely to introduce inconsistent wording.  
**Suggestion:** Rewrite the note as a short bullet list under a heading like “Test execution contract,” keeping each rule separate: centralized execution, v2 artifacts, artifact consumers, hard stops, started regression failures, and manual-step restrictions.

### 89. 2. Use More Explicit Failure Terminology
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** “A started project regression failure” is slightly ambiguous because “started” modifies the failure rather than the command execution.  
**Suggestion:** Rename the phrase to something more direct, such as “A project regression command that started and failed,” to distinguish it clearly from “a prerequisite failure before command start.”

### 90. 1. Clarify Optional Escaped Quote Matching
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** The regex `/unknown guardrail_id \\?"REQ-SPEC\\?"/` is hard to read because `\\?` means “optional backslash”, not an escaped optional quote.  
**Suggestion:** Use an explicit alternation so the intent is clear, for example:
```js
/assert guardrail_id (?:\\"|")REQ-SPEC(?:\\"|")/
```
or define a small named constant if this pattern is reused in the file.

### 91. 1. Clarify Optional Escaped Quote Matching
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** The regex `/unknown guardrail_id \\?"REQ-SPEC\\?"/` is hard to read because `\\?` means “optional backslash”, not an escaped optional quote.  
**Suggestion:** Use an explicit alternation so the intent is clear, for example:
```js
/assert guardrail_id (?:\\"|")REQ-SPEC(?:\\"|")/
```
or define a small named constant if this pattern is reused in the file.

### 92. 差分だけで判断できる範囲を確認しつつ、触られたテストファイル内の既存パターンも見て提案の重複や妥当性を絞ります。指定の cwd には差分パスが見当たりません。ワークツリー配置を確認して、提供された diff の内容自体から逸脱しない範囲で続けます。確認した範囲では変更はテスト期待値の更新に限定されています。品質観点では、大きな設計違反よりも、テストデータの表現とリスト命名の小さな改善候補が中心です。### 1. Derive non-approval flow steps
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** `falsyFlowSteps` manually duplicates part of the flow step list, and the new entries still leave the test dependent on future manual updates. The file already imports `FLOW_STEPS`, but it is otherwise unused.  
**Suggestion:** Build the list from `FLOW_STEPS` and exclude the approval-required steps, e.g. `FLOW_STEPS.filter((id) => !approvalRequiredStepIds.has(id))`. This removes duplication, makes the test match “all other rule-defined steps,” and eliminates the dead `FLOW_STEPS` import issue.

### 93. 差分だけで判断できる範囲を確認しつつ、触られたテストファイル内の既存パターンも見て提案の重複や妥当性を絞ります。指定の cwd には差分パスが見当たりません。ワークツリー配置を確認して、提供された diff の内容自体から逸脱しない範囲で続けます。確認した範囲では変更はテスト期待値の更新に限定されています。品質観点では、大きな設計違反よりも、テストデータの表現とリスト命名の小さな改善候補が中心です。### 1. Derive non-approval flow steps
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** `falsyFlowSteps` manually duplicates part of the flow step list, and the new entries still leave the test dependent on future manual updates. The file already imports `FLOW_STEPS`, but it is otherwise unused.  
**Suggestion:** Build the list from `FLOW_STEPS` and exclude the approval-required steps, e.g. `FLOW_STEPS.filter((id) => !approvalRequiredStepIds.has(id))`. This removes duplication, makes the test match “all other rule-defined steps,” and eliminates the dead `FLOW_STEPS` import issue.

### 94. 1. Extract v2 test artifact fixture helpers
**File:** `tests/unit/flow/run-retro-no-missing-requirements.test.js`  
**Issue:** `writeArtifacts()` now embeds a fairly detailed v2 `regression` object and review `checked_items` structure inline. That makes the fixture harder to scan and increases churn if the v2 schema changes.  
**Suggestion:** Extract small helpers/constants such as `makeSkippedRegressionFixture()` and `makePassingReviewChecks()` so `writeArtifacts()` stays focused on writing files.

### 95. 2. Rename `writeArtifacts()` to reflect v2 semantics
**File:** `tests/unit/flow/run-retro-no-missing-requirements.test.js`  
**Issue:** The helper name is generic, but it now specifically writes v2 `test-execute-result.json` artifacts with regression metadata.  
**Suggestion:** Rename it to something like `writeV2TestArtifacts()` or `writeTestExecuteArtifacts()` to make the fixture contract explicit.

### 96. 1. Extract v2 test artifact fixture helpers
**File:** `tests/unit/flow/run-retro-no-missing-requirements.test.js`  
**Issue:** `writeArtifacts()` now embeds a fairly detailed v2 `regression` object and review `checked_items` structure inline. That makes the fixture harder to scan and increases churn if the v2 schema changes.  
**Suggestion:** Extract small helpers/constants such as `makeSkippedRegressionFixture()` and `makePassingReviewChecks()` so `writeArtifacts()` stays focused on writing files.

### 97. 2. Rename `writeArtifacts()` to reflect v2 semantics
**File:** `tests/unit/flow/run-retro-no-missing-requirements.test.js`  
**Issue:** The helper name is generic, but it now specifically writes v2 `test-execute-result.json` artifacts with regression metadata.  
**Suggestion:** Rename it to something like `writeV2TestArtifacts()` or `writeTestExecuteArtifacts()` to make the fixture contract explicit.
