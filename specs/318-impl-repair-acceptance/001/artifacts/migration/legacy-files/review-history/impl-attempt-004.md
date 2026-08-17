# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. I’ll review the diff as a quality reviewer only within the two touched files, and I’ll keep proposals tied directly to those paths.### 1. Extract finding ID stamping
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** `blockingFindings` and `nonBlockingImprovements` now duplicate the same “serialize then add prefixed findingId” pattern.  
**Suggestion:** Add a small helper such as `serializeFindingsWithIds(items, prefix)` and use it for both `F` and `I` findings.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** `blockingFindings` and `nonBlockingImprovements` now duplicate the same “serialize then add prefixed findingId” pattern.  
**Suggestion:** Add a small helper such as `serializeFindingsWithIds(items, prefix)` and use it for both `F` and `I` findings.
**Rationale:** Loop review proposal.

### 2. 2. Reuse the triage write predicate
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** The condition `triageFindings.length > 0 && !taskSpec` is repeated in both the write path and the `changed` list construction.  
**Suggestion:** Introduce `const shouldWriteTriage = triageFindings.length > 0 && !taskSpec;` before the `if`, then reuse it in both places.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** The condition `triageFindings.length > 0 && !taskSpec` is repeated in both the write path and the `changed` list construction.  
**Suggestion:** Introduce `const shouldWriteTriage = triageFindings.length > 0 && !taskSpec;` before the `if`, then reuse it in both places.
**Rationale:** Loop review proposal.

### 3. 4. Add an explicit bound for generated triage findings
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** The new `triageFindings` array bulk-processes every blocking and non-blocking finding without an explicit local upper bound, which conflicts with the bounded-resource-usage guardrail unless the bound is enforced elsewhere in this path.  
**Suggestion:** Reuse the same maximum finding count enforced by the review artifact parser, or add a named cap before building/writing `impl-triage.json`, failing validation if the combined finding count exceeds it.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** The new `triageFindings` array bulk-processes every blocking and non-blocking finding without an explicit local upper bound, which conflicts with the bounded-resource-usage guardrail unless the bound is enforced elsewhere in this path.  
**Suggestion:** Reuse the same maximum finding count enforced by the review artifact parser, or add a named cap before building/writing `impl-triage.json`, failing validation if the combined finding count exceeds it.
**Rationale:** Loop review proposal.

### 4. 3. Remove unused lifecycle variable
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`  
**Issue:** `proposalCount` is still declared in `resolveImplReviewLifecycle`, but the shown implementation no longer uses it.  
**Suggestion:** Remove `const proposalCount = input.result?.artifacts?.proposalCount ?? 0;` if it is now dead code.
**Suggestion:** **File:** `src/flow/definition.js`  
**Issue:** `proposalCount` is still declared in `resolveImplReviewLifecycle`, but the shown implementation no longer uses it.  
**Suggestion:** Remove `const proposalCount = input.result?.artifacts?.proposalCount ?? 0;` if it is now dead code.
**Rationale:** Loop review proposal.

### 5. 1. Extract shared impl-review validation
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateImplReviewEvidence()` duplicates the same verdict derivation and finding-bucket validation now added in `contractFromImplReviewArtifact()` in `src/flow/lib/flow-judgment-contract.js`.
**Suggestion:** Move the impl-review consistency check into one shared helper exported from one of the touched files, or make one function call the other. This keeps the `PASS` / `ADVISORY` / `FAIL` bucket rules in one place.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateImplReviewEvidence()` duplicates the same verdict derivation and finding-bucket validation now added in `contractFromImplReviewArtifact()` in `src/flow/lib/flow-judgment-contract.js`.
**Suggestion:** Move the impl-review consistency check into one shared helper exported from one of the touched files, or make one function call the other. This keeps the `PASS` / `ADVISORY` / `FAIL` bucket rules in one place.
**Rationale:** Loop review proposal.

### 6. 2. Avoid rebuilding small status sets inside loops
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateRetroEvidence()` creates `new Set(["done", "not_done", "not_applicable"])` for every requirement entry.
**Suggestion:** Define a module-level constant such as `const RETRO_REQUIREMENT_STATUSES = new Set([...])` and reuse it in the loop.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateRetroEvidence()` creates `new Set(["done", "not_done", "not_applicable"])` for every requirement entry.
**Suggestion:** Define a module-level constant such as `const RETRO_REQUIREMENT_STATUSES = new Set([...])` and reuse it in the loop.
**Rationale:** Loop review proposal.

### 7. 3. Rename ambiguous `dispositionEvidence`
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `dispositionEvidence()` sounds like a value rather than a reader/parser function, while nearby functions use clearer verbs like `readImplRepairLedger()`.
**Suggestion:** Rename it to `readDispositionEvidence()` or `readDeferredDispositionEvidence()` to make the side effect and returned data clearer.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `dispositionEvidence()` sounds like a value rather than a reader/parser function, while nearby functions use clearer verbs like `readImplRepairLedger()`.
**Suggestion:** Rename it to `readDispositionEvidence()` or `readDeferredDispositionEvidence()` to make the side effect and returned data clearer.
**Rationale:** Loop review proposal.

### 8. 4. Remove unreachable return value
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateRequirementSummaryMembership()` returns `missing`, but immediately throws when `missing.length > 0`, so the successful return is always an empty array. Callers assign it to `missingRequired`, which makes the function look like it computes missing IDs even though it only validates.
**Suggestion:** Either rename it to `assertRequirementSummaryMembership()` and return nothing, or change it to return `{ missing, unknown }` without throwing so callers can use the result intentionally.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateRequirementSummaryMembership()` returns `missing`, but immediately throws when `missing.length > 0`, so the successful return is always an empty array. Callers assign it to `missingRequired`, which makes the function look like it computes missing IDs even though it only validates.
**Suggestion:** Either rename it to `assertRequirementSummaryMembership()` and return nothing, or change it to return `{ missing, unknown }` without throwing so callers can use the result intentionally.
**Rationale:** Loop review proposal.

### 9. 5. Factor repeated fingerprint assertion step list
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `contractForStepFromSpecDir()` hardcodes `["impl-review", "impl-gate", "test-result-review", "acceptance-review"]` inline for fingerprint checks.
**Suggestion:** Extract this to a module-level constant like `FINGERPRINTED_CONTRACT_STEPS` to document the policy and avoid another inline list if the set changes.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `contractForStepFromSpecDir()` hardcodes `["impl-review", "impl-gate", "test-result-review", "acceptance-review"]` inline for fingerprint checks.
**Suggestion:** Extract this to a module-level constant like `FINGERPRINTED_CONTRACT_STEPS` to document the policy and avoid another inline list if the set changes.
**Rationale:** Loop review proposal.

### 10. I’ll review the supplied diff only, using the requested code-quality lens plus the bounded-resource guardrail. Since this is a review task, I’ll produce proposals rather than editing files.The working directory appears to be a temporary wrapper rather than the repository root, so I’m locating the actual checked-out files before grounding any proposal in existing patterns.### 1. Extract implementation step IDs
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** `isFlowImplementationStep()` now embeds a longer step-id array inline, which reallocates on each call and makes future lifecycle edits easier to miss.  
**Suggestion:** Move the IDs into a module-level `Set`, e.g. `FLOW_IMPLEMENTATION_STEP_IDS`, and use `.has(target.stepId)`.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** `isFlowImplementationStep()` now embeds a longer step-id array inline, which reallocates on each call and makes future lifecycle edits easier to miss.  
**Suggestion:** Move the IDs into a module-level `Set`, e.g. `FLOW_IMPLEMENTATION_STEP_IDS`, and use `.has(target.stepId)`.
**Rationale:** Loop review proposal.

### 11. 2. Centralize the aborted next-action response
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** The new aborted branch returns a full null-filled response object inline. If other terminal/no-action states use the same envelope shape, this adds another place to keep fields synchronized.  
**Suggestion:** Extract a small helper such as `buildTerminalNextAction(action)` or reuse an existing response builder if one exists in this file.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** The new aborted branch returns a full null-filled response object inline. If other terminal/no-action states use the same envelope shape, this adds another place to keep fields synchronized.  
**Suggestion:** Extract a small helper such as `buildTerminalNextAction(action)` or reuse an existing response builder if one exists in this file.
**Rationale:** Loop review proposal.

### 12. 3. Remove duplicated acceptance path derivation
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `isAcceptanceDiffPath()` and `implementationDiff()` both normalize `state.spec`, derive `specDir`, and construct acceptance test paths.  
**Suggestion:** Add a helper like `buildAcceptanceDiffScope(state)` returning `{ specPath, specDir, specTests, rawEvidence, paths }`, then use it for both the git pathspecs and untracked-file filtering.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `isAcceptanceDiffPath()` and `implementationDiff()` both normalize `state.spec`, derive `specDir`, and construct acceptance test paths.  
**Suggestion:** Add a helper like `buildAcceptanceDiffScope(state)` returning `{ specPath, specDir, specTests, rawEvidence, paths }`, then use it for both the git pathspecs and untracked-file filtering.
**Rationale:** Loop review proposal.

### 13. 4. Rename `implementationDiff`
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `implementationDiff()` now collects tracked diff plus bounded untracked content for acceptance-review evidence. The name sounds like a pure implementation-code diff and hides the acceptance-specific filtering.  
**Suggestion:** Rename it to `collectAcceptanceDiff()` or `buildAcceptanceEvidenceDiff()`.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `implementationDiff()` now collects tracked diff plus bounded untracked content for acceptance-review evidence. The name sounds like a pure implementation-code diff and hides the acceptance-specific filtering.  
**Suggestion:** Rename it to `collectAcceptanceDiff()` or `buildAcceptanceEvidenceDiff()`.
**Rationale:** Loop review proposal.

### 14. 5. Bound model response shape
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `ACCEPTANCE_RESPONSE_SCHEMA` has unbounded `requirementJudgments`, ref arrays, `missingEvidence`, and string lengths. This violates the bounded-resource-usage guardrail for bulk AI response processing.  
**Suggestion:** Build the schema from the acceptance context so `requirementJudgments.maxItems` equals the number of requirements, and add reasonable `maxItems`/`maxLength` limits for refs and missing-evidence strings.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `ACCEPTANCE_RESPONSE_SCHEMA` has unbounded `requirementJudgments`, ref arrays, `missingEvidence`, and string lengths. This violates the bounded-resource-usage guardrail for bulk AI response processing.  
**Suggestion:** Build the schema from the acceptance context so `requirementJudgments.maxItems` equals the number of requirements, and add reasonable `maxItems`/`maxLength` limits for refs and missing-evidence strings.
**Rationale:** Loop review proposal.

### 15. 6. Add an explicit response-size cap before JSON repair
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `parseAcceptanceResponse()` passes arbitrary response text into `JSON.parse()` and then `repairJson()`. If the agent returns a very large response, repair/parsing can consume unbounded CPU and memory.  
**Suggestion:** Check `text.length` against an explicit `MAX_ACCEPTANCE_RESPONSE_CHARS` before parsing or repairing.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `parseAcceptanceResponse()` passes arbitrary response text into `JSON.parse()` and then `repairJson()`. If the agent returns a very large response, repair/parsing can consume unbounded CPU and memory.  
**Suggestion:** Check `text.length` against an explicit `MAX_ACCEPTANCE_RESPONSE_CHARS` before parsing or repairing.
**Rationale:** Loop review proposal.

### 16. 7. Cap the final prompt, not only its parts
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** The diff and evidence are each capped at `MAX_ACCEPTANCE_PROMPT_CHARS`, but the final prompt can exceed that limit once combined with rules, schema, and fallback text.  
**Suggestion:** After `PromptBuilder.build()`, validate the combined prompt payload length or split the constants into `MAX_ACCEPTANCE_DIFF_CHARS`, `MAX_ACCEPTANCE_EVIDENCE_CHARS`, and `MAX_ACCEPTANCE_TOTAL_PROMPT_CHARS`.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** The diff and evidence are each capped at `MAX_ACCEPTANCE_PROMPT_CHARS`, but the final prompt can exceed that limit once combined with rules, schema, and fallback text.  
**Suggestion:** After `PromptBuilder.build()`, validate the combined prompt payload length or split the constants into `MAX_ACCEPTANCE_DIFF_CHARS`, `MAX_ACCEPTANCE_EVIDENCE_CHARS`, and `MAX_ACCEPTANCE_TOTAL_PROMPT_CHARS`.
**Rationale:** Loop review proposal.

### 17. 1. Avoid Recomputing Repair Fingerprint Inside Skip Decision
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Issue:** `finalRegressionSkipDecision` now builds and asserts the repair fingerprint inline, adding repair-artifact validation logic to a function otherwise focused on skip/classification decisions.
**Suggestion:** Compute the fingerprint once at the caller level, or introduce a small helper such as `assertCurrentTestExecuteFingerprint({ root, state, specDir })`. This keeps skip-decision logic focused and makes the repair-fingerprint assertion easier to reuse consistently.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Issue:** `finalRegressionSkipDecision` now builds and asserts the repair fingerprint inline, adding repair-artifact validation logic to a function otherwise focused on skip/classification decisions.
**Suggestion:** Compute the fingerprint once at the caller level, or introduce a small helper such as `assertCurrentTestExecuteFingerprint({ root, state, specDir })`. This keeps skip-decision logic focused and makes the repair-fingerprint assertion easier to reuse consistently.
**Rationale:** Loop review proposal.

### 18. 2. Replace Repeated Artifact Filename Literals With Shared Constants
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Issue:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `test-execute-result.json` and `test-result-review.json` are now referenced both as path variables and as string literals in the `files` array. This creates minor duplication and makes future renames easier to miss.
**Suggestion:** Define artifact filename constants near the existing path construction, then derive both the paths and the `assertCurrentRepairEvidenceFiles` list from those constants.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `test-execute-result.json` and `test-result-review.json` are now referenced both as path variables and as string literals in the `files` array. This creates minor duplication and makes future renames easier to miss.
**Suggestion:** Define artifact filename constants near the existing path construction, then derive both the paths and the `assertCurrentRepairEvidenceFiles` list from those constants.
**Rationale:** Loop review proposal.

### 19. 3. Clarify Whether `retro.json` Is Required Evidence
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Issue:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `assertCurrentRepairEvidenceFiles` is called before `readRetroResultIfExists`, but the surrounding code treats `retro.json` as optional. If `assertCurrentRepairEvidenceFiles` requires every listed file to exist, this changes optional behavior into required behavior.
**Suggestion:** Either pass only files that are mandatory at this point, or rename/use an API that clearly supports optional files. If `retro.json` is intentionally required after repair, make that explicit with a local comment or a more specific assertion helper name.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `assertCurrentRepairEvidenceFiles` is called before `readRetroResultIfExists`, but the surrounding code treats `retro.json` as optional. If `assertCurrentRepairEvidenceFiles` requires every listed file to exist, this changes optional behavior into required behavior.
**Suggestion:** Either pass only files that are mandatory at this point, or rename/use an API that clearly supports optional files. If `retro.json` is intentionally required after repair, make that explicit with a local comment or a more specific assertion helper name.
**Rationale:** Loop review proposal.

### 20. 1. Reuse the repair evidence validator
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkIntegrationTestArtifacts` manually builds a fingerprint, reads two JSON files, parses them, and calls `assertRepairFingerprint`. `run-report.js` now uses `assertCurrentRepairEvidenceFiles` for the same kind of validation, so the validation pattern is inconsistent and partly duplicated.  
**Suggestion:** Replace the manual loop with `assertCurrentRepairEvidenceFiles({ root, state, specDir, files: [...] })` if the helper supports this call site, or add a small local helper so repair evidence validation is expressed the same way across gate/report flows.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkIntegrationTestArtifacts` manually builds a fingerprint, reads two JSON files, parses them, and calls `assertRepairFingerprint`. `run-report.js` now uses `assertCurrentRepairEvidenceFiles` for the same kind of validation, so the validation pattern is inconsistent and partly duplicated.  
**Suggestion:** Replace the manual loop with `assertCurrentRepairEvidenceFiles({ root, state, specDir, files: [...] })` if the helper supports this call site, or add a small local helper so repair evidence validation is expressed the same way across gate/report flows.
**Rationale:** Loop review proposal.

### 21. 2. Centralize impl-gate artifact writing
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `persistIntegrationGateResult` and `runGatePhaseWithDependencies` now both know that integration gate results should be written through `writeRepairEvidenceArtifact` with `stepId: "impl-gate"`. That duplicates artifact routing knowledge and makes future filename or metadata changes easier to miss.  
**Suggestion:** Extract a helper such as `writeImplGateResultArtifact({ specDir, artifact, fingerprint })` and use it from both call sites. It can return the written artifact/path so callers do not need to separately assume the basename.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `persistIntegrationGateResult` and `runGatePhaseWithDependencies` now both know that integration gate results should be written through `writeRepairEvidenceArtifact` with `stepId: "impl-gate"`. That duplicates artifact routing knowledge and makes future filename or metadata changes easier to miss.  
**Suggestion:** Extract a helper such as `writeImplGateResultArtifact({ specDir, artifact, fingerprint })` and use it from both call sites. It can return the written artifact/path so callers do not need to separately assume the basename.
**Rationale:** Loop review proposal.

### 22. 3. Avoid inline repair evidence filename lists
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Issue:** The list `["test-execute-result.json", "test-result-review.json", "retro.json"]` is embedded directly in `RunReportCommand.run`. Similar artifact filename sets are likely to recur as R4 enforcement expands, which increases the chance of inconsistent coverage.  
**Suggestion:** Move the list to a named constant near the top of the file, for example `REPORT_REPAIR_EVIDENCE_FILES`, so the intent is explicit and future additions are localized.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Issue:** The list `["test-execute-result.json", "test-result-review.json", "retro.json"]` is embedded directly in `RunReportCommand.run`. Similar artifact filename sets are likely to recur as R4 enforcement expands, which increases the chance of inconsistent coverage.  
**Suggestion:** Move the list to a named constant near the top of the file, for example `REPORT_REPAIR_EVIDENCE_FILES`, so the intent is explicit and future additions are localized.
**Rationale:** Loop review proposal.

### 23. 4. Remove now-unused `retroPath` write responsibility
**Failure mode:** refactor
**File:** src/flow/lib/run-retro.js
**Issue:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The direct `fs.writeFileSync(retroPath, ...)` call was replaced by `writeRepairEvidenceArtifact`, but `retroPath` may now only exist for path construction or prior checks. If it is no longer needed, keeping it makes the write target less obvious.  
**Suggestion:** If `retroPath` is unused after this change, remove it. If callers still need the exact path, derive it from the `writeRepairEvidenceArtifact` result instead of maintaining two write-path concepts.
**Suggestion:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The direct `fs.writeFileSync(retroPath, ...)` call was replaced by `writeRepairEvidenceArtifact`, but `retroPath` may now only exist for path construction or prior checks. If it is no longer needed, keeping it makes the write target less obvious.  
**Suggestion:** If `retroPath` is unused after this change, remove it. If callers still need the exact path, derive it from the `writeRepairEvidenceArtifact` result instead of maintaining two write-path concepts.
**Rationale:** Loop review proposal.

### 24. I’ll review the supplied diff only and focus on maintainability proposals in the touched files. Since this is a code review request, I’m not editing the workspace.### 1. Extract shared repair fingerprint validation
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** The new impl-review fingerprint check duplicates artifact names and validation flow already present in `src/flow/lib/run-retro.js`, increasing drift risk if artifact names or validation rules change.  
**Suggestion:** Move the “load test-execute-result/test-result-review and assert repair fingerprint” logic into a small shared helper in an existing artifact module, then call it from both review and retro.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** The new impl-review fingerprint check duplicates artifact names and validation flow already present in `src/flow/lib/run-retro.js`, increasing drift risk if artifact names or validation rules change.  
**Suggestion:** Move the “load test-execute-result/test-result-review and assert repair fingerprint” logic into a small shared helper in an existing artifact module, then call it from both review and retro.
**Rationale:** Loop review proposal.

### 25. 2. Avoid unbounded artifact reads
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `JSON.parse(fs.readFileSync(artifactPath, "utf8"))` reads the full artifact without an explicit size bound, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Use an existing bounded artifact reader if available, or add a small size check before reading/parsing these two JSON files.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `JSON.parse(fs.readFileSync(artifactPath, "utf8"))` reads the full artifact without an explicit size bound, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Use an existing bounded artifact reader if available, or add a small size check before reading/parsing these two JSON files.
**Rationale:** Loop review proposal.

### 26. 3. Replace inline artifact filename literals
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `"test-execute-result.json"` and `"test-result-review.json"` are hard-coded inline, while `run-retro.js` already has named constants for these artifacts.  
**Suggestion:** Introduce shared constants or local constants in `run-review.js` so error messages, path construction, and labels use the same source of truth.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `"test-execute-result.json"` and `"test-result-review.json"` are hard-coded inline, while `run-retro.js` already has named constants for these artifacts.  
**Suggestion:** Introduce shared constants or local constants in `run-review.js` so error messages, path construction, and labels use the same source of truth.
**Rationale:** Loop review proposal.

### 27. 1. Remove stale `resultPath` dependency if it is no longer used
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The direct `fs.writeFileSync(resultPath, ...)` call was replaced by `writeRepairEvidenceArtifact(...)`. If `resultPath` is now only retained for that removed write, it becomes dead code and may mislead readers into thinking the path is still authoritative here.  
**Suggestion:** Remove the `resultPath` variable/import dependency if it is no longer referenced elsewhere in the file, or use it explicitly if the artifact writer is expected to target that exact path.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The direct `fs.writeFileSync(resultPath, ...)` call was replaced by `writeRepairEvidenceArtifact(...)`. If `resultPath` is now only retained for that removed write, it becomes dead code and may mislead readers into thinking the path is still authoritative here.  
**Suggestion:** Remove the `resultPath` variable/import dependency if it is no longer referenced elsewhere in the file, or use it explicitly if the artifact writer is expected to target that exact path.
**Rationale:** Loop review proposal.

### 28. 2. Avoid mutating the review artifact inside the writer helper
**Failure mode:** refactor
**File:** src/flow/lib/run-test-result-review.js
**Issue:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `writeReviewArtifacts` mutates `review` by assigning `review.contractSummary` before writing. The function name sounds like an output-only writer, but it also enriches the artifact, which makes call-site behavior less obvious.  
**Suggestion:** Build the final artifact explicitly before writing, for example:

```js
const artifact = {
  ...review,
  contractSummary: contractFromTestResultReviewArtifact(...).summary.toJSON(),
};
```

Then pass `artifact` to `writeRepairEvidenceArtifact(...)` and `writeMarkdown(...)`.
**Suggestion:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `writeReviewArtifacts` mutates `review` by assigning `review.contractSummary` before writing. The function name sounds like an output-only writer, but it also enriches the artifact, which makes call-site behavior less obvious.  
**Suggestion:** Build the final artifact explicitly before writing, for example:

```js
const artifact = {
  ...review,
  contractSummary: contractFromTestResultReviewArtifact(...).summary.toJSON(),
};
```

Then pass `artifact` to `writeRepairEvidenceArtifact(...)` and `writeMarkdown(...)`.
**Rationale:** Loop review proposal.

### 29. 3. Centralize relative artifact path normalization inside the helper
**Failure mode:** refactor
**File:** src/flow/lib/run-test-result-review.js
**Issue:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `path.relative(root, reviewPath).split(path.sep).join("/")` is a repeated path-normalization pattern likely used elsewhere in flow artifacts. Keeping it inline makes the artifact-writing code noisier and increases the chance of inconsistent path formatting.  
**Suggestion:** Extract a small local helper in this file, such as `toArtifactPath(root, filePath)`, and use it when building `contractSummary`.
**Suggestion:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `path.relative(root, reviewPath).split(path.sep).join("/")` is a repeated path-normalization pattern likely used elsewhere in flow artifacts. Keeping it inline makes the artifact-writing code noisier and increases the chance of inconsistent path formatting.  
**Suggestion:** Extract a small local helper in this file, such as `toArtifactPath(root, filePath)`, and use it when building `contractSummary`.
**Rationale:** Loop review proposal.

### 30. 1. Extract repeated spec/state completion branch shape
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new `impl-triage` and `impl-repair` branches add more special-case completion logic directly inside the `"done"` path. This method already contains step-specific handling, and the new branches continue that growth pattern.
**Suggestion:** Move these branches into small private helpers such as `completeImplTriageStep(ctx, state, id, status)` and `completeImplRepairStep(ctx, state, id, status)`, or a single dispatch table for artifact-backed step completions. This keeps `run()` focused on routing and makes future implementation leaves easier to add consistently.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new `impl-triage` and `impl-repair` branches add more special-case completion logic directly inside the `"done"` path. This method already contains step-specific handling, and the new branches continue that growth pattern.
**Suggestion:** Move these branches into small private helpers such as `completeImplTriageStep(ctx, state, id, status)` and `completeImplRepairStep(ctx, state, id, status)`, or a single dispatch table for artifact-backed step completions. This keeps `run()` focused on routing and makes future implementation leaves easier to add consistently.
**Rationale:** Loop review proposal.

### 31. 2. Name the reset range constant
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** `flowLeafIdsBetween("test-execute", "finalize-cleanup")` encodes important workflow behavior inline. The range determines which downstream leaves are reset after repair, but the boundary meaning is not obvious at the call site.
**Suggestion:** Assign it to a named constant or helper, for example `implementationRepairResetStepIds()` or `DOWNSTREAM_IMPL_REPAIR_RESET_RANGE`, so the reset policy is explicit and easier to audit against R1.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** `flowLeafIdsBetween("test-execute", "finalize-cleanup")` encodes important workflow behavior inline. The range determines which downstream leaves are reset after repair, but the boundary meaning is not obvious at the call site.
**Suggestion:** Assign it to a named constant or helper, for example `implementationRepairResetStepIds()` or `DOWNSTREAM_IMPL_REPAIR_RESET_RANGE`, so the reset policy is explicit and easier to audit against R1.
**Rationale:** Loop review proposal.

### 32. 3. Avoid mixed return payload naming
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new completion responses use different payload keys: `dispositions` for `impl-triage`, and `repair` plus `invalidations` for `impl-repair`. That may be correct semantically, but it creates a slightly inconsistent response shape for related implementation-repair flow steps.
**Suggestion:** Consider grouping step-specific completion artifacts under a consistent key such as `artifact` or `completion`, for example `{ id, status, next, artifact: completed.artifact }` and `{ id, status, artifact: completed.entry, invalidations }`. This makes command consumers less likely to grow step-specific parsing branches unnecessarily.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new completion responses use different payload keys: `dispositions` for `impl-triage`, and `repair` plus `invalidations` for `impl-repair`. That may be correct semantically, but it creates a slightly inconsistent response shape for related implementation-repair flow steps.
**Suggestion:** Consider grouping step-specific completion artifacts under a consistent key such as `artifact` or `completion`, for example `{ id, status, next, artifact: completed.artifact }` and `{ id, status, artifact: completed.entry, invalidations }`. This makes command consumers less likely to grow step-specific parsing branches unnecessarily.
**Rationale:** Loop review proposal.

### 33. 4. Clarify no-repair record ownership in prompt text
**Failure mode:** refactor
**File:** src/flow/prompts/impl/acceptance-review.md
**Issue:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** The prompt now requires `impl-repair.json` or an explicit no-repair record, but it does not name where that no-repair record comes from or how it is represented. That ambiguity can produce inconsistent reviewer output or invented citation strings, which the same prompt later forbids.
**Suggestion:** Add a short concrete phrase identifying the artifact/source for the no-repair record, for example “the command-provided explicit no-repair record” or the exact artifact path/key if one exists.
**Suggestion:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** The prompt now requires `impl-repair.json` or an explicit no-repair record, but it does not name where that no-repair record comes from or how it is represented. That ambiguity can produce inconsistent reviewer output or invented citation strings, which the same prompt later forbids.
**Suggestion:** Add a short concrete phrase identifying the artifact/source for the no-repair record, for example “the command-provided explicit no-repair record” or the exact artifact path/key if one exists.
**Rationale:** Loop review proposal.

### 34. 1. Clarify triage wording to avoid mixed responsibilities
**Failure mode:** refactor
**File:** src/flow/prompts/impl/impl-review.md
**Issue:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** The FAIL path says to “Continue to `impl-triage`” and then “Address only `blockingFindings[]` through the triage artifact.” “Address” can imply doing repair work during review/triage, which conflicts with “do not repair directly from the review step.”  
**Suggestion:** Reword step 3 to make the artifact responsibility explicit, e.g. “Use the triage artifact to select and carry forward only `blockingFindings[]` for `impl-repair`.” This keeps review, triage, and repair responsibilities distinct.
**Suggestion:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** The FAIL path says to “Continue to `impl-triage`” and then “Address only `blockingFindings[]` through the triage artifact.” “Address” can imply doing repair work during review/triage, which conflicts with “do not repair directly from the review step.”  
**Suggestion:** Reword step 3 to make the artifact responsibility explicit, e.g. “Use the triage artifact to select and carry forward only `blockingFindings[]` for `impl-repair`.” This keeps review, triage, and repair responsibilities distinct.
**Rationale:** Loop review proposal.

### 35. 2. Avoid hard-coding choices if lifecycle choices may expand
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`  
**Issue:** The help text now hard-codes only `accept_risk_and_continue` and `abort`. If the acceptance-decision command later supports additional explicit choices, the help text can drift from the implementation.  
**Suggestion:** If the valid choices already exist as constants or schema values in this file, generate this help line from that source instead of duplicating the literals in the help string.
**Suggestion:** **File:** `src/flow/registry.js`  
**Issue:** The help text now hard-codes only `accept_risk_and_continue` and `abort`. If the acceptance-decision command later supports additional explicit choices, the help text can drift from the implementation.  
**Suggestion:** If the valid choices already exist as constants or schema values in this file, generate this help line from that source instead of duplicating the literals in the help string.
**Rationale:** Loop review proposal.

### 36. I’ll review the two schema diffs only and look for quality/design issues within that scope, including the bounded-resource guardrail.### 1. Add explicit bounds for arrays and strings
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** Several arrays and strings are unbounded, including `mechanicalBlockers`, `hardBlockers`, `requirementJudgments`, `deferredFindings`, evidence ref arrays, and free-form strings. This violates the `bounded-resource-usage` guardrail because bulk output size is not capped.  
**Suggestion:** Add explicit `maxItems` for arrays and `maxLength` for strings, using project-appropriate limits for blocker counts, requirement judgments, evidence refs, and report refs.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** Several arrays and strings are unbounded, including `mechanicalBlockers`, `hardBlockers`, `requirementJudgments`, `deferredFindings`, evidence ref arrays, and free-form strings. This violates the `bounded-resource-usage` guardrail because bulk output size is not capped.  
**Suggestion:** Add explicit `maxItems` for arrays and `maxLength` for strings, using project-appropriate limits for blocker counts, requirement judgments, evidence refs, and report refs.
**Rationale:** Loop review proposal.

### 37. 3. Deduplicate repeated evidence reference array schemas
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** The schema repeats the same “array of non-empty strings” shape for `requestRefs`, `requirementRefs`, `diffRefs`, `repairRefs`, `testRefs`, `missingEvidence`, `evidenceRefs`, and `reportRefs`, with small inconsistencies such as some requiring `minItems` and others not.  
**Suggestion:** Introduce local `$defs`, for example `nonEmptyString`, `refArray`, and `requiredRefArray`, then reference them with `$ref`. This reduces duplication and makes future tightening, such as adding `maxItems`/`maxLength`, less error-prone.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** The schema repeats the same “array of non-empty strings” shape for `requestRefs`, `requirementRefs`, `diffRefs`, `repairRefs`, `testRefs`, `missingEvidence`, `evidenceRefs`, and `reportRefs`, with small inconsistencies such as some requiring `minItems` and others not.  
**Suggestion:** Introduce local `$defs`, for example `nonEmptyString`, `refArray`, and `requiredRefArray`, then reference them with `$ref`. This reduces duplication and makes future tightening, such as adding `maxItems`/`maxLength`, less error-prone.
**Rationale:** Loop review proposal.

### 38. 4. Tighten `hardBlockers` item shape for consistency
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** `mechanicalBlockers` now has a strict object shape with `additionalProperties: false`, but `hardBlockers` remains an array of arbitrary objects. That inconsistency weakens the schema and makes downstream handling less predictable.  
**Suggestion:** Define a strict `hardBlockers.items` schema with required identifiers/summary fields, or reuse a shared blocker definition if hard and mechanical blockers intentionally share structure.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** `mechanicalBlockers` now has a strict object shape with `additionalProperties: false`, but `hardBlockers` remains an array of arbitrary objects. That inconsistency weakens the schema and makes downstream handling less predictable.  
**Suggestion:** Define a strict `hardBlockers.items` schema with required identifiers/summary fields, or reuse a shared blocker definition if hard and mechanical blockers intentionally share structure.
**Rationale:** Loop review proposal.

### 39. 2. Add bounds to next-action acceptance-review projection
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The projected response arrays are also unbounded: `requirementJudgments`, `mechanicalBlockers`, and `hardBlockers`. This has the same bounded-resource risk as the full acceptance-review schema.  
**Suggestion:** Add `maxItems` to each array and, if item shapes remain generic objects, consider bounding object size via stricter item schemas or `maxProperties`.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The projected response arrays are also unbounded: `requirementJudgments`, `mechanicalBlockers`, and `hardBlockers`. This has the same bounded-resource risk as the full acceptance-review schema.  
**Suggestion:** Add `maxItems` to each array and, if item shapes remain generic objects, consider bounding object size via stricter item schemas or `maxProperties`.
**Rationale:** Loop review proposal.

### 40. 5. Avoid duplicating verdict enum values across schemas
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The `verdict` enum is duplicated here and in `src/flow/schemas/acceptance-review.schema.json`. The recent `amend_required` to `repair_required` rename had to be made in both places, which is easy to miss in future changes.  
**Suggestion:** If the schema loader supports JSON Schema references, factor the verdict enum into a shared `$defs` entry or shared schema file and reference it from both touched schemas. If external refs are not supported, add an in-file `$defs.verdict` in each file to at least keep local usage consistent.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The `verdict` enum is duplicated here and in `src/flow/schemas/acceptance-review.schema.json`. The recent `amend_required` to `repair_required` rename had to be made in both places, which is easy to miss in future changes.  
**Suggestion:** If the schema loader supports JSON Schema references, factor the verdict enum into a shared `$defs` entry or shared schema file and reference it from both touched schemas. If external refs are not supported, add an in-file `$defs.verdict` in each file to at least keep local usage consistent.
**Rationale:** Loop review proposal.

### 41. I’ll review the diff strictly within the two touched test files and focus on maintainability issues plus the bounded-resource guardrail.### 1. Extract duplicated impl-review fixture setup
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** The two new tests duplicate temp root setup, spec creation, touched file setup, and advisory finding payload construction.  
**Suggestion:** Add small local helpers such as `prepareImplReviewFixture()` and `advisoryImprovement()` within this test file, then let each test only declare the findings that differ.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** The two new tests duplicate temp root setup, spec creation, touched file setup, and advisory finding payload construction.  
**Suggestion:** Add small local helpers such as `prepareImplReviewFixture()` and `advisoryImprovement()` within this test file, then let each test only declare the findings that differ.
**Rationale:** Loop review proposal.

### 42. 2. Name fixture helper by behavior, not mechanism
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** `prepareAcceptanceEvidence` now writes scenario validity, fingerprint-matched repair evidence, impl-review, impl-gate, retro, and test review artifacts. The name understates the side effects.  
**Suggestion:** Rename it to something more explicit, for example `prepareFingerprintMatchedAcceptanceEvidence` or `preparePassingAcceptancePipelineEvidence`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** `prepareAcceptanceEvidence` now writes scenario validity, fingerprint-matched repair evidence, impl-review, impl-gate, retro, and test review artifacts. The name understates the side effects.  
**Suggestion:** Rename it to something more explicit, for example `prepareFingerprintMatchedAcceptanceEvidence` or `preparePassingAcceptancePipelineEvidence`.
**Rationale:** Loop review proposal.

### 43. 3. Split oversized acceptance fixture construction
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** `prepareAcceptanceEvidence` became a large multi-artifact fixture builder with repeated `writeRepairEvidenceArtifact({ specDir, stepId, fingerprint, artifact })` calls. This makes the test harder to scan and obscures which artifacts are essential to the assertion.  
**Suggestion:** Extract focused helpers such as `writePassingTestExecuteEvidence`, `writePassingImplGateEvidence`, and `writePassingRetroEvidence`, or use a small local wrapper like `writeFingerprintedEvidence(stepId, artifact)` to reduce repetition.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** `prepareAcceptanceEvidence` became a large multi-artifact fixture builder with repeated `writeRepairEvidenceArtifact({ specDir, stepId, fingerprint, artifact })` calls. This makes the test harder to scan and obscures which artifacts are essential to the assertion.  
**Suggestion:** Extract focused helpers such as `writePassingTestExecuteEvidence`, `writePassingImplGateEvidence`, and `writePassingRetroEvidence`, or use a small local wrapper like `writeFingerprintedEvidence(stepId, artifact)` to reduce repetition.
**Rationale:** Loop review proposal.

### 44. 4. Avoid nondeterministic timestamps in fixtures
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** The fixture uses `new Date().toISOString()` in multiple artifact payloads. These values are not asserted and can make snapshots, debugging, or future equality checks noisier.  
**Suggestion:** Define a constant timestamp such as `const fixtureTimestamp = "2026-01-01T00:00:00.000Z";` and reuse it in generated fixture artifacts.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** The fixture uses `new Date().toISOString()` in multiple artifact payloads. These values are not asserted and can make snapshots, debugging, or future equality checks noisier.  
**Suggestion:** Define a constant timestamp such as `const fixtureTimestamp = "2026-01-01T00:00:00.000Z";` and reuse it in generated fixture artifacts.
**Rationale:** Loop review proposal.

### 45. 5. Extract repeated acceptance review context setup
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** The test constructs the same `state` and `diff` inputs inline, then calls `buildAcceptanceReviewContext` twice.  
**Suggestion:** Move the state/diff fixture into a helper such as `buildDemoAcceptanceContext(fixture)` or reuse a single `context` when possible, keeping the test focused on final disposition and missing-source behavior.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** The test constructs the same `state` and `diff` inputs inline, then calls `buildAcceptanceReviewContext` twice.  
**Suggestion:** Move the state/diff fixture into a helper such as `buildDemoAcceptanceContext(fixture)` or reuse a single `context` when possible, keeping the test focused on final disposition and missing-source behavior.
**Rationale:** Loop review proposal.

### 46. 1. Table-drive the rejection assertions
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The new `"rejects missing buckets..."` test repeats `assert.throws(() => contractFromImplReviewArtifact(...), /.../)` several times with only input and expected message changing.  
**Suggestion:** Replace the repeated assertions with an array of `{ artifact, message }` cases and loop over them. This reduces duplication and makes future verdict/bucket validation cases easier to add.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The new `"rejects missing buckets..."` test repeats `assert.throws(() => contractFromImplReviewArtifact(...), /.../)` several times with only input and expected message changing.  
**Suggestion:** Replace the repeated assertions with an array of `{ artifact, message }` cases and loop over them. This reduces duplication and makes future verdict/bucket validation cases easier to add.
**Rationale:** Loop review proposal.

### 47. 2. Rename `updatesFor` to describe the post-hook behavior
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The helper name `updatesFor` is generic and does not say what system behavior it exercises.  
**Suggestion:** Rename it to something like `postHookUpdatesForImplReview` or `runImplReviewPostHook` so the test reads more clearly at each assertion site.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The helper name `updatesFor` is generic and does not say what system behavior it exercises.  
**Suggestion:** Rename it to something like `postHookUpdatesForImplReview` or `runImplReviewPostHook` so the test reads more clearly at each assertion site.
**Rationale:** Loop review proposal.

### 48. 3. Avoid sharing mutable expected update arrays
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** `noRepairUpdates` is reused as the expected value for both PASS and ADVISORY. It is not mutated today, but sharing a mutable array in assertions can make later test edits more fragile.  
**Suggestion:** Use a small factory such as `expectedNoRepairUpdates()` or inline the expected arrays if preferred. This keeps each assertion isolated while preserving readability.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** `noRepairUpdates` is reused as the expected value for both PASS and ADVISORY. It is not mutated today, but sharing a mutable array in assertions can make later test edits more fragile.  
**Suggestion:** Use a small factory such as `expectedNoRepairUpdates()` or inline the expected arrays if preferred. This keeps each assertion isolated while preserving readability.
**Rationale:** Loop review proposal.

### 49. 1. Centralize repair evidence validation
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Multiple files now validate repair evidence with slightly different patterns: `run-gate.js` manually reads/parses artifacts and asserts fingerprints, while `run-report.js`, `run-review.js`, `run-retro.js`, `run-finalize.js`, and `run-final-regression.js` appear to use or duplicate related repair-evidence validation logic. This creates drift risk around required files, fingerprint rules, and bounded reads.
**Suggestion:** Move the shared “assert current repair evidence files” flow into one helper that owns filename handling, bounded reads, parsing, and fingerprint assertion. Use it consistently across gate, review, retro, report, finalize, and final-regression paths.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Multiple files now validate repair evidence with slightly different patterns: `run-gate.js` manually reads/parses artifacts and asserts fingerprints, while `run-report.js`, `run-review.js`, `run-retro.js`, `run-finalize.js`, and `run-final-regression.js` appear to use or duplicate related repair-evidence validation logic. This creates drift risk around required files, fingerprint rules, and bounded reads.
**Suggestion:** Move the shared “assert current repair evidence files” flow into one helper that owns filename handling, bounded reads, parsing, and fingerprint assertion. Use it consistently across gate, review, retro, report, finalize, and final-regression paths.
**Rationale:** Loop review proposal.

### 50. 2. Share repair artifact filename constants
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** Artifact filenames such as `test-execute-result.json`, `test-result-review.json`, and `retro.json` are repeated across `run-review.js`, `run-retro.js`, `run-report.js`, `run-finalize.js`, `run-gate.js`, and tests. This makes future artifact renames or required-evidence changes easy to apply inconsistently.
**Suggestion:** Define shared constants or a small artifact registry for repair evidence filenames, then derive paths, validation lists, and test fixtures from that source.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** Artifact filenames such as `test-execute-result.json`, `test-result-review.json`, and `retro.json` are repeated across `run-review.js`, `run-retro.js`, `run-report.js`, `run-finalize.js`, `run-gate.js`, and tests. This makes future artifact renames or required-evidence changes easy to apply inconsistently.
**Suggestion:** Define shared constants or a small artifact registry for repair evidence filenames, then derive paths, validation lists, and test fixtures from that source.
**Rationale:** Loop review proposal.

### 51. 3. Consolidate impl-review verdict and bucket validation
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateImplReviewEvidence()` and `contractFromImplReviewArtifact()` both appear to validate the same impl-review verdict/bucket consistency rules. That duplicates lifecycle contract logic across artifact validation and judgment contract construction.
**Suggestion:** Extract a shared impl-review consistency validator and call it from both places, or make one function consume the other’s normalized contract result.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** `validateImplReviewEvidence()` and `contractFromImplReviewArtifact()` both appear to validate the same impl-review verdict/bucket consistency rules. That duplicates lifecycle contract logic across artifact validation and judgment contract construction.
**Suggestion:** Extract a shared impl-review consistency validator and call it from both places, or make one function consume the other’s normalized contract result.
**Rationale:** Loop review proposal.

### 52. 4. Align acceptance review schema definitions
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`
**Issue:** Acceptance-review verdicts and projected response shapes are duplicated between the full acceptance-review schema and the next-action projection schema. The recent verdict rename had to be reflected in both, which is a cross-file consistency risk.
**Suggestion:** Factor shared verdict/blocker/ref definitions into reusable `$defs` or a shared schema file if the loader supports it. At minimum, mirror local `$defs` naming and bounds in both schemas.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`
**Issue:** Acceptance-review verdicts and projected response shapes are duplicated between the full acceptance-review schema and the next-action projection schema. The recent verdict rename had to be reflected in both, which is a cross-file consistency risk.
**Suggestion:** Factor shared verdict/blocker/ref definitions into reusable `$defs` or a shared schema file if the loader supports it. At minimum, mirror local `$defs` naming and bounds in both schemas.
**Rationale:** Loop review proposal.

### 53. 5. Normalize implementation-repair step response shapes
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** Related implementation-repair flow steps return different payload keys, such as `dispositions` for `impl-triage` and `repair` for `impl-repair`. Other files such as `get-next-action.js`, lifecycle definitions, and command consumers may need step-specific parsing branches because the interface is not uniform.
**Suggestion:** Use a consistent envelope for step completion results, such as `{ id, status, next, artifact, invalidations }`, while keeping step-specific data inside `artifact`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** Related implementation-repair flow steps return different payload keys, such as `dispositions` for `impl-triage` and `repair` for `impl-repair`. Other files such as `get-next-action.js`, lifecycle definitions, and command consumers may need step-specific parsing branches because the interface is not uniform.
**Suggestion:** Use a consistent envelope for step completion results, such as `{ id, status, next, artifact, invalidations }`, while keeping step-specific data inside `artifact`.
**Rationale:** Loop review proposal.

### 54. 6. Use consistent naming for acceptance diff collection
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`
**Issue:** `implementationDiff()` appears to collect acceptance-review evidence, while nearby files and prompts refer to acceptance evidence, repair evidence, and implementation repair artifacts. The name can mislead callers about scope and ownership.
**Suggestion:** Rename it to `collectAcceptanceDiff()` or `buildAcceptanceEvidenceDiff()` and align related helper names with the acceptance-review terminology used in schemas and prompts.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`
**Issue:** `implementationDiff()` appears to collect acceptance-review evidence, while nearby files and prompts refer to acceptance evidence, repair evidence, and implementation repair artifacts. The name can mislead callers about scope and ownership.
**Suggestion:** Rename it to `collectAcceptanceDiff()` or `buildAcceptanceEvidenceDiff()` and align related helper names with the acceptance-review terminology used in schemas and prompts.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
