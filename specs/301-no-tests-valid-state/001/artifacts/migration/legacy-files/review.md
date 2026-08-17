# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. I’ll inspect the touched file around the new skip path and existing result/skip helpers so the proposals are grounded in the file’s current patterns.The path in the diff is not present under the current `.tmp` directory, so I’m checking the worktree layout before relying only on the supplied diff.The repository files are one level above the current `.tmp` directory, while the command working directory remains inside the allowed worktree path. I’m reading the touched file from there now.The new path duplicates the same synthetic “not started” result used by the existing skip path. I’m checking the surrounding factory code to avoid suggesting an abstraction that already exists.I’m also checking where `checkedSources` is produced, because the bounded-resource guardrail turns on whether this new artifact copy can grow without an explicit cap.`checkedSources` currently comes from a fixed internal list, so I don’t see a bounded-resource violation in this specific diff. The main review finding is a local consistency/duplication problem in the new skip result construction.### 1. Extract the skipped process result
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** The new `skipped_by_project_policy` path duplicates the same synthetic process result object already used by the existing skip path: `started: false`, null exit/signal, empty stdout/stderr, etc. That makes future changes to skipped process shape easy to miss in one branch.  
**Suggestion:** Add a small factory method such as `FinalRegressionProcessResultFactory.skipped()` and use it in both skip branches.

```js
static skipped() {
  return {
    started: false,
    exitCode: null,
    signal: null,
    timedOut: false,
    spawnError: null,
    stdout: "",
    stderr: "",
  };
}
```

Then replace both duplicated object literals with `FinalRegressionProcessResultFactory.skipped()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** The new `skipped_by_project_policy` path duplicates the same synthetic process result object already used by the existing skip path: `started: false`, null exit/signal, empty stdout/stderr, etc. That makes future changes to skipped process shape easy to miss in one branch.  
**Suggestion:** Add a small factory method such as `FinalRegressionProcessResultFactory.skipped()` and use it in both skip branches.

```js
static skipped() {
  return {
    started: false,
    exitCode: null,
    signal: null,
    timedOut: false,
    spawnError: null,
    stdout: "",
    stderr: "",
  };
}
```

Then replace both duplicated object literals with `FinalRegressionProcessResultFactory.skipped()`.
**Rationale:** Loop review proposal.

### 2. I’ll quickly inspect the touched file around the changed code so the proposals match the surrounding style and don’t overreach beyond the diff.The provided path isn’t present relative to the current temp directory, so I’m checking the workspace layout before relying only on the inline diff.The checked-out source file isn’t available in this workspace snapshot, so I’ll keep the review constrained to the diff text you supplied.### 1. Align Summary Field Naming
**Failure mode:** refactor
**File:** src/flow/lib/run-retro.js
**Issue:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The new summary field `not_applicable_count` uses a different naming pattern from nearby fields like `not_done`, `na_count`, and `not_testable_count`. This creates a mixed contract style in the same object.  
**Suggestion:** If external contract allows, prefer one consistent convention, such as `not_applicable`, matching `not_done`. If `not_applicable_count` is required by R4, consider also naming the local variable `notApplicableCount` to make the count semantics explicit.
**Suggestion:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The new summary field `not_applicable_count` uses a different naming pattern from nearby fields like `not_done`, `na_count`, and `not_testable_count`. This creates a mixed contract style in the same object.  
**Suggestion:** If external contract allows, prefer one consistent convention, such as `not_applicable`, matching `not_done`. If `not_applicable_count` is required by R4, consider also naming the local variable `notApplicableCount` to make the count semantics explicit.
**Rationale:** Loop review proposal.

### 3. 2. Avoid Repeated Status Filtering
**Failure mode:** refactor
**File:** src/flow/lib/run-retro.js
**Issue:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** `done` and `notApplicable` are computed with separate `filter` passes over `reqs`, then `notDone` is derived afterward. This is small, but it duplicates traversal logic and makes adding future statuses more error-prone.  
**Suggestion:** Compute status counts in one pass, for example with `reduce`, then derive `not_done` from the resulting counters.
**Suggestion:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** `done` and `notApplicable` are computed with separate `filter` passes over `reqs`, then `notDone` is derived afterward. This is small, but it duplicates traversal logic and makes adding future statuses more error-prone.  
**Suggestion:** Compute status counts in one pass, for example with `reduce`, then derive `not_done` from the resulting counters.
**Rationale:** Loop review proposal.

### 4. 3. Clarify Dry-Run Artifact Shape
**Failure mode:** refactor
**File:** src/flow/lib/run-retro.js
**Issue:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The dry-run response now includes `requirements` inside `artifacts`, even though `summary` is not a file artifact either. This may further blur whether `artifacts` contains paths, generated content, or both.  
**Suggestion:** Consider moving generated preview data under a clearly named property such as `preview`, or document/rename the dry-run object fields so `artifacts` does not mix artifact paths with in-memory report contents.
**Suggestion:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The dry-run response now includes `requirements` inside `artifacts`, even though `summary` is not a file artifact either. This may further blur whether `artifacts` contains paths, generated content, or both.  
**Suggestion:** Consider moving generated preview data under a clearly named property such as `preview`, or document/rename the dry-run object fields so `artifacts` does not mix artifact paths with in-memory report contents.
**Rationale:** Loop review proposal.

### 5. I’ll inspect the touched file around the changed functions so the proposals are grounded in the actual surrounding code, not just the snippet.The diff file is not present at that relative path in the current workspace, so I’ll base this review on the provided diff and keep proposals scoped to `src/flow/lib/run-test-execute.js`.### 1. Cache spec test file discovery in `findSpecTestFileForReq`
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `findSpecTestFileForReq` calls `listSpecTestFiles(specDir)` once for iteration and again for the fallback. That duplicates directory/file discovery work and makes the null fallback harder to reason about.  
**Suggestion:** Store the result once:

```js
const files = listSpecTestFiles(specDir);
for (const file of files) { ... }
return files[0] || null;
```
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `findSpecTestFileForReq` calls `listSpecTestFiles(specDir)` once for iteration and again for the fallback. That duplicates directory/file discovery work and makes the null fallback harder to reason about.  
**Suggestion:** Store the result once:

```js
const files = listSpecTestFiles(specDir);
for (const file of files) { ... }
return files[0] || null;
```
**Rationale:** Loop review proposal.

### 6. 2. Centralize requirement outcome construction
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The `not_applicable` / `no_tests_declared` logic is now split across `requirementSummaryResult`, `requirementRawResultLine`, and `buildSummary`. If the reason or result semantics change, multiple places must stay synchronized.  
**Suggestion:** Replace `requirementSummaryResult` with a helper that returns the complete outcome, for example `{ result, reason }`, and use it in both raw output generation and summary generation.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The `not_applicable` / `no_tests_declared` logic is now split across `requirementSummaryResult`, `requirementRawResultLine`, and `buildSummary`. If the reason or result semantics change, multiple places must stay synchronized.  
**Suggestion:** Replace `requirementSummaryResult` with a helper that returns the complete outcome, for example `{ result, reason }`, and use it in both raw output generation and summary generation.
**Rationale:** Loop review proposal.

### 7. 3. Avoid throwing a generic missing-file error from summary building
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `buildSummary` now throws `spec-local test file missing for ${req.id}` if `findSpecTestFileForReq` returns `null`. In normal flow this should only happen if no tests are declared, already handled earlier, so the error path is more of an invariant failure than a user-actionable condition.  
**Suggestion:** Make the invariant explicit, for example by checking `specLocal.noTestsDeclared` before calling `findSpecTestFileForReq`, or by throwing a clearer invariant-style message that includes that tests were expected but no spec-local files were found.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `buildSummary` now throws `spec-local test file missing for ${req.id}` if `findSpecTestFileForReq` returns `null`. In normal flow this should only happen if no tests are declared, already handled earlier, so the error path is more of an invariant failure than a user-actionable condition.  
**Suggestion:** Make the invariant explicit, for example by checking `specLocal.noTestsDeclared` before calling `findSpecTestFileForReq`, or by throwing a clearer invariant-style message that includes that tests were expected but no spec-local files were found.
**Rationale:** Loop review proposal.

### 8. 1. Centralize artifact path normalization
**Failure mode:** refactor
**File:** src/flow/lib/run-test-result-review.js
**Issue:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `path.relative(root, ...).split(path.sep).join("/")` is repeated in several places, and some return paths still use plain `path.relative(...)`.  
**Suggestion:** Add a small helper such as `relativeArtifactPath(root, targetPath)` and use it consistently for `artifactPath`, `result_file_path`, `raw_output_path`, `changed`, and `artifacts.review_path`.
**Suggestion:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `path.relative(root, ...).split(path.sep).join("/")` is repeated in several places, and some return paths still use plain `path.relative(...)`.  
**Suggestion:** Add a small helper such as `relativeArtifactPath(root, targetPath)` and use it consistently for `artifactPath`, `result_file_path`, `raw_output_path`, `changed`, and `artifacts.review_path`.
**Rationale:** Loop review proposal.

### 9. 2. Avoid mutating review objects while writing
**Failure mode:** refactor
**File:** src/flow/lib/run-test-result-review.js
**Issue:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `writeReviewArtifacts` mutates `review` by assigning `review.contractSummary`. That makes the helper both transform and write, which can surprise callers.  
**Suggestion:** Build a local `reviewWithContractSummary` object inside the helper and write that instead.
**Suggestion:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `writeReviewArtifacts` mutates `review` by assigning `review.contractSummary`. That makes the helper both transform and write, which can surprise callers.  
**Suggestion:** Build a local `reviewWithContractSummary` object inside the helper and write that instead.
**Rationale:** Loop review proposal.

### 10. 3. Bound raw output loading and line splitting
**Failure mode:** refactor
**File:** src/flow/lib/run-test-result-review.js
**Issue:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** The review loads the full raw output and splits it into lines without an explicit size or line-count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Enforce an explicit maximum raw log size and/or maximum line count before `split(/\r?\n/)`, failing the review with a clear artifact error if exceeded.
**Suggestion:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** The review loads the full raw output and splits it into lines without an explicit size or line-count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Enforce an explicit maximum raw log size and/or maximum line count before `split(/\r?\n/)`, failing the review with a clear artifact error if exceeded.
**Rationale:** Loop review proposal.

### 11. 1. Extract shared summary evidence validation
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `validateTestExecuteResultV2` and `validateSummaryEvidence` now duplicate checks for `evidence`, `evidence.command`, `raw_output_lines`, `not_applicable` reason, and pass/fail handling.  
**Suggestion:** Extract a helper such as `validateSummaryEntryShape(entry, context)` or smaller helpers for `validateSummaryEvidenceRange` and `validateNoTestsSummaryEntry`. This keeps the v2 schema validator and evidence validator consistent as the contract evolves.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `validateTestExecuteResultV2` and `validateSummaryEvidence` now duplicate checks for `evidence`, `evidence.command`, `raw_output_lines`, `not_applicable` reason, and pass/fail handling.  
**Suggestion:** Extract a helper such as `validateSummaryEntryShape(entry, context)` or smaller helpers for `validateSummaryEvidenceRange` and `validateNoTestsSummaryEntry`. This keeps the v2 schema validator and evidence validator consistent as the contract evolves.
**Rationale:** Loop review proposal.

### 12. 2. Add an explicit bound for `checkedSources`
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `discovery.checkedSources` is validated as a non-empty array, then scanned with `.some(...)`, but there is no explicit maximum length. This violates the `bounded-resource-usage` guardrail for bulk data validation.  
**Suggestion:** Add a constant such as `MAX_COMMAND_DISCOVERY_CHECKED_SOURCES` and reject arrays above that size before iterating.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `discovery.checkedSources` is validated as a non-empty array, then scanned with `.some(...)`, but there is no explicit maximum length. This violates the `bounded-resource-usage` guardrail for bulk data validation.  
**Suggestion:** Add a constant such as `MAX_COMMAND_DISCOVERY_CHECKED_SOURCES` and reject arrays above that size before iterating.
**Rationale:** Loop review proposal.

### 13. 3. Make skip-kind branching explicit
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** The final `else` in `validateFinalRegressionSkipKind` implicitly means `skipped_by_project_policy`, relying on the earlier allowlist to make that true. That coupling makes future skip kinds easy to misroute into project-policy proof validation.  
**Suggestion:** Change the branch to `else if (result.skipKind === "skipped_by_project_policy")` and add a defensive final `else` error. This keeps each skip kind’s proof contract explicit.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** The final `else` in `validateFinalRegressionSkipKind` implicitly means `skipped_by_project_policy`, relying on the earlier allowlist to make that true. That coupling makes future skip kinds easy to misroute into project-policy proof validation.  
**Suggestion:** Change the branch to `else if (result.skipKind === "skipped_by_project_policy")` and add a defensive final `else` error. This keeps each skip kind’s proof contract explicit.
**Rationale:** Loop review proposal.

### 14. I’ll review the diff as a code-quality pass only, constrained to `src/flow/lib/test-regression.js`, and check the bounded-resource guardrail against the touched logic.The diff path is relative to the project, but this sandbox’s current directory is a `.tmp` workspace root that does not contain `src/flow/lib/test-regression.js`. I’ll base the review on the supplied diff unless the project files are present elsewhere inside the allowed root.### 1. Derive checked source names from discovery candidates
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `REGRESSION_COMMAND_CHECKED_SOURCES` duplicates the command discovery sources manually. If discovery order or supported sources change later, the no-tests artifact can report stale checked sources.  
**Suggestion:** Build the checked source list from the same candidate definitions used by `discoverRegressionCommand`, or keep source labels beside each candidate and derive both discovery and reporting from that single structure.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `REGRESSION_COMMAND_CHECKED_SOURCES` duplicates the command discovery sources manually. If discovery order or supported sources change later, the no-tests artifact can report stale checked sources.  
**Suggestion:** Build the checked source list from the same candidate definitions used by `discoverRegressionCommand`, or keep source labels beside each candidate and derive both discovery and reporting from that single structure.
**Rationale:** Loop review proposal.

### 15. 2. Remove redundant default/passed argument pairing
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `regressionCommandFromSource(source, checkedSources = REGRESSION_COMMAND_CHECKED_SOURCES)` defines a default, but `discoverRegressionCommand` also passes the same constant explicitly. This makes the API look more configurable than it currently is.  
**Suggestion:** Either call `regressionCommandFromSource(source)` from `discoverRegressionCommand`, or remove the default and require callers to pass checked sources intentionally.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `regressionCommandFromSource(source, checkedSources = REGRESSION_COMMAND_CHECKED_SOURCES)` defines a default, but `discoverRegressionCommand` also passes the same constant explicitly. This makes the API look more configurable than it currently is.  
**Suggestion:** Either call `regressionCommandFromSource(source)` from `discoverRegressionCommand`, or remove the default and require callers to pass checked sources intentionally.
**Rationale:** Loop review proposal.

### 16. 3. Extract the Node eval allowance predicate
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `quotedNodeEvalArg` embeds several policy details inline inside `parseArgvCommand`: quoted token state, command name, and accepted Node eval flags. That makes the shell-syntax exception harder to scan and test independently.  
**Suggestion:** Move it to a small helper such as `isQuotedNodeEvalArgument(tokens, argv, index)` and optionally define the eval flags as a frozen constant.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `quotedNodeEvalArg` embeds several policy details inline inside `parseArgvCommand`: quoted token state, command name, and accepted Node eval flags. That makes the shell-syntax exception harder to scan and test independently.  
**Suggestion:** Move it to a small helper such as `isQuotedNodeEvalArgument(tokens, argv, index)` and optionally define the eval flags as a frozen constant.
**Rationale:** Loop review proposal.

### 17. 4. Freeze `commandCandidates` for consistency
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `NoSupportedRegressionCommandError` freezes `checkedSources` but leaves `commandCandidates` as a mutable array. The two fields both describe discovery metadata and should have similar immutability semantics.  
**Suggestion:** Set `this.commandCandidates = Object.freeze([]);` to match `checkedSources` and avoid accidental mutation downstream.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `NoSupportedRegressionCommandError` freezes `checkedSources` but leaves `commandCandidates` as a mutable array. The two fields both describe discovery metadata and should have similar immutability semantics.  
**Suggestion:** Set `this.commandCandidates = Object.freeze([]);` to match `checkedSources` and avoid accidental mutation downstream.
**Rationale:** Loop review proposal.

### 18. 1. Bound `checkedSources`
**Failure mode:** refactor
**File:** src/flow/prompts/impl/final-regression.md
**Issue:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** `commandDiscovery.checkedSources` is newly required, but the prompt does not state an upper bound on the number of checked sources or retained entries. This risks violating `bounded-resource-usage` if discovery can grow with project files/configs.  
**Suggestion:** Specify that `checkedSources` is limited to a fixed set of supported project-level command source identifiers, with a maximum entry count and truncated/summary behavior if needed.
**Suggestion:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** `commandDiscovery.checkedSources` is newly required, but the prompt does not state an upper bound on the number of checked sources or retained entries. This risks violating `bounded-resource-usage` if discovery can grow with project files/configs.  
**Suggestion:** Specify that `checkedSources` is limited to a fixed set of supported project-level command source identifiers, with a maximum entry count and truncated/summary behavior if needed.
**Rationale:** Loop review proposal.

### 19. 2. Use Exact Skip Kind Naming
**Failure mode:** refactor
**File:** src/flow/prompts/impl/final-regression.md
**Issue:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** “Project-policy proof” is a prose label that does not exactly match the artifact value `skipped_by_project_policy`, while the same sentence uses exact names for other fields.  
**Suggestion:** Rename the phrase to `` `skipped_by_project_policy` proof `` so the documentation consistently ties proof shape to the exact `skipKind` value.
**Suggestion:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** “Project-policy proof” is a prose label that does not exactly match the artifact value `skipped_by_project_policy`, while the same sentence uses exact names for other fields.  
**Suggestion:** Rename the phrase to `` `skipped_by_project_policy` proof `` so the documentation consistently ties proof shape to the exact `skipKind` value.
**Rationale:** Loop review proposal.

### 20. I’ll inspect the touched schema so the proposals are grounded in the full structure, while keeping the scope limited to the diff file.The path from the diff is not present relative to the current working directory. I’ll quickly locate the repository layout and then continue only against the touched path.### 1. Preserve Result-Specific Schema Invariants
**Failure mode:** refactor
**File:** src/flow/schemas/test-execute-result.schema.json
**Issue:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** The change makes `reason` optional for all results and makes `test_file` / `test_name` optional for `pass` and `fail` entries too. That broadens the schema beyond the new `not_applicable` case.  
**Suggestion:** Use `oneOf` or `if` / `then` branches: require `reason: no_tests_declared` only when `result` is `not_applicable`, and keep `test_file` / `test_name` required for `pass` and `fail` evidence.
**Suggestion:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** The change makes `reason` optional for all results and makes `test_file` / `test_name` optional for `pass` and `fail` entries too. That broadens the schema beyond the new `not_applicable` case.  
**Suggestion:** Use `oneOf` or `if` / `then` branches: require `reason: no_tests_declared` only when `result` is `not_applicable`, and keep `test_file` / `test_name` required for `pass` and `fail` evidence.
**Rationale:** Loop review proposal.

### 21. 2. Add Explicit Bounds For Raw Output
**Failure mode:** refactor
**File:** src/flow/schemas/test-execute-result.schema.json
**Issue:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** `raw_output_lines` appears to accept arbitrary output size. Under the `bounded-resource-usage` guardrail, bulk output fields should have explicit limits.  
**Suggestion:** Add bounds such as `maxItems` for `raw_output_lines` and `maxLength` for each line item. Choose limits that match the executor’s intended evidence size, and apply them consistently to both normal test evidence and `not_applicable` evidence.
**Suggestion:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** `raw_output_lines` appears to accept arbitrary output size. Under the `bounded-resource-usage` guardrail, bulk output fields should have explicit limits.  
**Suggestion:** Add bounds such as `maxItems` for `raw_output_lines` and `maxLength` for each line item. Choose limits that match the executor’s intended evidence size, and apply them consistently to both normal test evidence and `not_applicable` evidence.
**Rationale:** Loop review proposal.

### 22. 1. Unify `not_applicable` contract shape
**Failure mode:** refactor
**File:** src/flow/schemas/test-execute-result.schema.json
**Issue:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** The new `not_applicable` / `no_tests_declared` state spans `run-test-execute.js`, `run-retro.js`, `test-artifacts.js`, and the schema, but the schema appears broader than the producer/validator contract. It allows optional `reason`, `test_file`, and `test_name` beyond just the `not_applicable` case, while code paths seem to expect stricter result-specific evidence shapes.  
**Suggestion:** Encode result-specific branches in the schema: `pass` / `fail` require test evidence, while `not_applicable` requires `reason: "no_tests_declared"` and omits test-specific fields. Then align `test-artifacts.js` validation to the same branch structure.
**Suggestion:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** The new `not_applicable` / `no_tests_declared` state spans `run-test-execute.js`, `run-retro.js`, `test-artifacts.js`, and the schema, but the schema appears broader than the producer/validator contract. It allows optional `reason`, `test_file`, and `test_name` beyond just the `not_applicable` case, while code paths seem to expect stricter result-specific evidence shapes.  
**Suggestion:** Encode result-specific branches in the schema: `pass` / `fail` require test evidence, while `not_applicable` requires `reason: "no_tests_declared"` and omits test-specific fields. Then align `test-artifacts.js` validation to the same branch structure.
**Rationale:** Loop review proposal.

### 23. 2. Standardize summary count naming
**Failure mode:** refactor
**File:** src/flow/lib/run-retro.js
**Issue:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The new summary naming is inconsistent across files and report layers: `not_applicable`, `not_applicable_count`, `na_count`, `not_testable_count`, and `not_done` all appear to describe related status/count concepts. This makes the cross-file reporting contract harder to consume reliably.  
**Suggestion:** Pick one public naming convention for status counts, preferably matching the status name directly, such as `not_applicable`, and use it consistently in retro summaries, test execution summaries, validators, and schema/docs.
**Suggestion:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The new summary naming is inconsistent across files and report layers: `not_applicable`, `not_applicable_count`, `na_count`, `not_testable_count`, and `not_done` all appear to describe related status/count concepts. This makes the cross-file reporting contract harder to consume reliably.  
**Suggestion:** Pick one public naming convention for status counts, preferably matching the status name directly, such as `not_applicable`, and use it consistently in retro summaries, test execution summaries, validators, and schema/docs.
**Rationale:** Loop review proposal.

### 24. 3. Centralize `checkedSources` discovery metadata
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `checkedSources` is introduced across discovery, final regression artifacts, validators, and prompt documentation, but the supported source names and limits are duplicated or only implied. That creates drift risk between what discovery reports, what validation accepts, and what the prompt requires.  
**Suggestion:** Define a single fixed list of command discovery source identifiers and an explicit maximum count in code, derive reported `checkedSources` from it, and mirror that contract in `test-artifacts.js` validation and `final-regression.md`.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `checkedSources` is introduced across discovery, final regression artifacts, validators, and prompt documentation, but the supported source names and limits are duplicated or only implied. That creates drift risk between what discovery reports, what validation accepts, and what the prompt requires.  
**Suggestion:** Define a single fixed list of command discovery source identifiers and an explicit maximum count in code, derive reported `checkedSources` from it, and mirror that contract in `test-artifacts.js` validation and `final-regression.md`.
**Rationale:** Loop review proposal.

### 25. 4. Share raw output bounds across schema and reviewer
**Failure mode:** refactor
**File:** src/flow/schemas/test-execute-result.schema.json
**Issue:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** `raw_output_lines` is treated as bulk evidence in the schema, executor/review flow, and artifact validator, but the proposed bounds are not defined consistently across those files. The reviewer may load/split unbounded raw output while the schema also lacks `maxItems` / line length constraints.  
**Suggestion:** Introduce shared constants for maximum raw output bytes, maximum evidence lines, and maximum line length, then apply equivalent limits in the executor/reviewer code, artifact validator, and JSON schema.
**Suggestion:** **File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** `raw_output_lines` is treated as bulk evidence in the schema, executor/review flow, and artifact validator, but the proposed bounds are not defined consistently across those files. The reviewer may load/split unbounded raw output while the schema also lacks `maxItems` / line length constraints.  
**Suggestion:** Introduce shared constants for maximum raw output bytes, maximum evidence lines, and maximum line length, then apply equivalent limits in the executor/reviewer code, artifact validator, and JSON schema.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
