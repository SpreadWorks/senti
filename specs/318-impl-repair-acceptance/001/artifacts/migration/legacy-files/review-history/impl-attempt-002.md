# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 2. Avoid assigning finding IDs during serialization
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** `ImplReviewArtifact.toJSON()` now generates `findingId` from array position. That makes identity depend on serialization order and duplicates the responsibility of shaping persisted finding records.  
**Suggestion:** Assign stable finding IDs once when constructing or normalizing `blockingFindings`, or use a dedicated helper like `withFindingIds(findings)` before persistence and triage generation.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** `ImplReviewArtifact.toJSON()` now generates `findingId` from array position. That makes identity depend on serialization order and duplicates the responsibility of shaping persisted finding records.  
**Suggestion:** Assign stable finding IDs once when constructing or normalizing `blockingFindings`, or use a dedicated helper like `withFindingIds(findings)` before persistence and triage generation.
**Rationale:** Loop review proposal.

### 2. 3. Add an explicit bound for triage findings
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Issue:** **File:** `src/flow/commands/review.js`  
**Issue:** `prepareImplTriageArtifact` receives every blocking finding from `artifactJson.blockingFindings` with no local upper bound. This can violate the `bounded-resource-usage` guardrail if review output is unexpectedly large.  
**Suggestion:** Enforce a maximum blocking-finding count before writing triage artifacts, preferably near artifact validation/normalization, and fail clearly if the agent output exceeds it.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Issue:** `prepareImplTriageArtifact` receives every blocking finding from `artifactJson.blockingFindings` with no local upper bound. This can violate the `bounded-resource-usage` guardrail if review output is unexpectedly large.  
**Suggestion:** Enforce a maximum blocking-finding count before writing triage artifacts, preferably near artifact validation/normalization, and fail clearly if the agent output exceeds it.
**Rationale:** Loop review proposal.

### 3. I’ll review the diff as a quality pass only, scoped to the two changed files, and return proposals in the requested format.### 1. Centralize implementation follow-up status actions
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`  
**Issue:** `resolveImplReviewLifecycle` now repeats the same `SetStepStatus` actions for `impl-triage` and `impl-repair` in multiple branches.  
**Suggestion:** Extract a small helper such as `completeImplFollowupLeaves()` returning those two actions, then spread it in the deferred and PASS/ADVISORY branches.
**Suggestion:** **File:** `src/flow/definition.js`  
**Issue:** `resolveImplReviewLifecycle` now repeats the same `SetStepStatus` actions for `impl-triage` and `impl-repair` in multiple branches.  
**Suggestion:** Extract a small helper such as `completeImplFollowupLeaves()` returning those two actions, then spread it in the deferred and PASS/ADVISORY branches.
**Rationale:** Loop review proposal.

### 4. 2. Add explicit bounds for diff evidence binding
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `AcceptanceEvidenceBindings` processes `context.evidence.diff` with `matchAll` without an explicit size or match-count bound. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Add constants such as `MAX_ACCEPTANCE_DIFF_BYTES` and `MAX_ACCEPTANCE_DIFF_REFS`, reject oversized diffs, and stop/throw when too many `diff --git` refs are found.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `AcceptanceEvidenceBindings` processes `context.evidence.diff` with `matchAll` without an explicit size or match-count bound. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Add constants such as `MAX_ACCEPTANCE_DIFF_BYTES` and `MAX_ACCEPTANCE_DIFF_REFS`, reject oversized diffs, and stop/throw when too many `diff --git` refs are found.
**Rationale:** Loop review proposal.

### 5. 3. Avoid repeated linear membership checks
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** Several validation paths repeatedly call `.includes()` inside loops, for example requirement judgment validation, deferred finding coverage, and evidence ref validation. This makes the code noisier and scales poorly.  
**Suggestion:** Convert expected ids/refs to `Set`s once per validation function and use `.has()` for membership checks.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** Several validation paths repeatedly call `.includes()` inside loops, for example requirement judgment validation, deferred finding coverage, and evidence ref validation. This makes the code noisier and scales poorly.  
**Suggestion:** Convert expected ids/refs to `Set`s once per validation function and use `.has()` for membership checks.
**Rationale:** Loop review proposal.

### 6. 4. Simplify deferred source validation
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `deferredSourceBlockers` calls `JSON.stringify(source).includes(...)` for each deferred finding, which is both indirect and potentially repetitive for the same source artifact.  
**Suggestion:** Cache serialized source artifacts by `finding.sourceArtifact`, or restore a small helper like `sourceIncludesFindingId(source, id)` and use a per-artifact cache to make the intent clearer.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `deferredSourceBlockers` calls `JSON.stringify(source).includes(...)` for each deferred finding, which is both indirect and potentially repetitive for the same source artifact.  
**Suggestion:** Cache serialized source artifacts by `finding.sourceArtifact`, or restore a small helper like `sourceIncludesFindingId(source, id)` and use a per-artifact cache to make the intent clearer.
**Rationale:** Loop review proposal.

### 7. 5. Rename disposition reader for consistency
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `dispositionEvidence` is a noun phrase but performs file IO and parsing, while nearby functions use verb-led names such as `readScenarioRawEvidence`.  
**Suggestion:** Rename it to `readDispositionEvidence` or `readDeferredDispositionEvidence` to match the file’s naming pattern.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `dispositionEvidence` is a noun phrase but performs file IO and parsing, while nearby functions use verb-led names such as `readScenarioRawEvidence`.  
**Suggestion:** Rename it to `readDispositionEvidence` or `readDeferredDispositionEvidence` to match the file’s naming pattern.
**Rationale:** Loop review proposal.

### 8. I’ll review this as a quality pass over only the two diff files, checking for simplification and guardrail issues rather than functional correctness outside the touched surface.### 1. Extract shared impl-review verdict validation
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`  
**Issue:** The impl-review bucket/verdict consistency check now exists here and is also duplicated as `validateImplReviewEvidence` in `src/flow/lib/acceptance-review-artifacts.js`.  
**Suggestion:** Move the shared validation into one exported helper in a touched file and reuse it from both call sites, so future verdict rules cannot drift.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`  
**Issue:** The impl-review bucket/verdict consistency check now exists here and is also duplicated as `validateImplReviewEvidence` in `src/flow/lib/acceptance-review-artifacts.js`.  
**Suggestion:** Move the shared validation into one exported helper in a touched file and reuse it from both call sites, so future verdict rules cannot drift.
**Rationale:** Loop review proposal.

### 9. I’ll review the supplied diff only, using the requested code-quality lens plus the bounded-resource guardrail. Since this is a review task, I’ll produce proposals rather than editing files.The working directory appears to be a temporary wrapper rather than the repository root, so I’m locating the actual checked-out files before grounding any proposal in existing patterns.### 1. Extract implementation step IDs
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** `isFlowImplementationStep()` now embeds a longer step-id array inline, which reallocates on each call and makes future lifecycle edits easier to miss.  
**Suggestion:** Move the IDs into a module-level `Set`, e.g. `FLOW_IMPLEMENTATION_STEP_IDS`, and use `.has(target.stepId)`.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** `isFlowImplementationStep()` now embeds a longer step-id array inline, which reallocates on each call and makes future lifecycle edits easier to miss.  
**Suggestion:** Move the IDs into a module-level `Set`, e.g. `FLOW_IMPLEMENTATION_STEP_IDS`, and use `.has(target.stepId)`.
**Rationale:** Loop review proposal.

### 10. 2. Centralize the aborted next-action response
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** The new aborted branch returns a full null-filled response object inline. If other terminal/no-action states use the same envelope shape, this adds another place to keep fields synchronized.  
**Suggestion:** Extract a small helper such as `buildTerminalNextAction(action)` or reuse an existing response builder if one exists in this file.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Issue:** The new aborted branch returns a full null-filled response object inline. If other terminal/no-action states use the same envelope shape, this adds another place to keep fields synchronized.  
**Suggestion:** Extract a small helper such as `buildTerminalNextAction(action)` or reuse an existing response builder if one exists in this file.
**Rationale:** Loop review proposal.

### 11. 3. Remove duplicated acceptance path derivation
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `isAcceptanceDiffPath()` and `implementationDiff()` both normalize `state.spec`, derive `specDir`, and construct acceptance test paths.  
**Suggestion:** Add a helper like `buildAcceptanceDiffScope(state)` returning `{ specPath, specDir, specTests, rawEvidence, paths }`, then use it for both the git pathspecs and untracked-file filtering.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `isAcceptanceDiffPath()` and `implementationDiff()` both normalize `state.spec`, derive `specDir`, and construct acceptance test paths.  
**Suggestion:** Add a helper like `buildAcceptanceDiffScope(state)` returning `{ specPath, specDir, specTests, rawEvidence, paths }`, then use it for both the git pathspecs and untracked-file filtering.
**Rationale:** Loop review proposal.

### 12. 4. Rename `implementationDiff`
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `implementationDiff()` now collects tracked diff plus bounded untracked content for acceptance-review evidence. The name sounds like a pure implementation-code diff and hides the acceptance-specific filtering.  
**Suggestion:** Rename it to `collectAcceptanceDiff()` or `buildAcceptanceEvidenceDiff()`.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `implementationDiff()` now collects tracked diff plus bounded untracked content for acceptance-review evidence. The name sounds like a pure implementation-code diff and hides the acceptance-specific filtering.  
**Suggestion:** Rename it to `collectAcceptanceDiff()` or `buildAcceptanceEvidenceDiff()`.
**Rationale:** Loop review proposal.

### 13. 5. Bound model response shape
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `ACCEPTANCE_RESPONSE_SCHEMA` has unbounded `requirementJudgments`, ref arrays, `missingEvidence`, and string lengths. This violates the bounded-resource-usage guardrail for bulk AI response processing.  
**Suggestion:** Build the schema from the acceptance context so `requirementJudgments.maxItems` equals the number of requirements, and add reasonable `maxItems`/`maxLength` limits for refs and missing-evidence strings.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `ACCEPTANCE_RESPONSE_SCHEMA` has unbounded `requirementJudgments`, ref arrays, `missingEvidence`, and string lengths. This violates the bounded-resource-usage guardrail for bulk AI response processing.  
**Suggestion:** Build the schema from the acceptance context so `requirementJudgments.maxItems` equals the number of requirements, and add reasonable `maxItems`/`maxLength` limits for refs and missing-evidence strings.
**Rationale:** Loop review proposal.

### 14. 6. Add an explicit response-size cap before JSON repair
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `parseAcceptanceResponse()` passes arbitrary response text into `JSON.parse()` and then `repairJson()`. If the agent returns a very large response, repair/parsing can consume unbounded CPU and memory.  
**Suggestion:** Check `text.length` against an explicit `MAX_ACCEPTANCE_RESPONSE_CHARS` before parsing or repairing.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `parseAcceptanceResponse()` passes arbitrary response text into `JSON.parse()` and then `repairJson()`. If the agent returns a very large response, repair/parsing can consume unbounded CPU and memory.  
**Suggestion:** Check `text.length` against an explicit `MAX_ACCEPTANCE_RESPONSE_CHARS` before parsing or repairing.
**Rationale:** Loop review proposal.

### 15. 7. Cap the final prompt, not only its parts
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** The diff and evidence are each capped at `MAX_ACCEPTANCE_PROMPT_CHARS`, but the final prompt can exceed that limit once combined with rules, schema, and fallback text.  
**Suggestion:** After `PromptBuilder.build()`, validate the combined prompt payload length or split the constants into `MAX_ACCEPTANCE_DIFF_CHARS`, `MAX_ACCEPTANCE_EVIDENCE_CHARS`, and `MAX_ACCEPTANCE_TOTAL_PROMPT_CHARS`.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** The diff and evidence are each capped at `MAX_ACCEPTANCE_PROMPT_CHARS`, but the final prompt can exceed that limit once combined with rules, schema, and fallback text.  
**Suggestion:** After `PromptBuilder.build()`, validate the combined prompt payload length or split the constants into `MAX_ACCEPTANCE_DIFF_CHARS`, `MAX_ACCEPTANCE_EVIDENCE_CHARS`, and `MAX_ACCEPTANCE_TOTAL_PROMPT_CHARS`.
**Rationale:** Loop review proposal.

### 16. 1. Avoid Recomputing Repair Fingerprint Inside Skip Decision
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Issue:** `finalRegressionSkipDecision` now builds and asserts the repair fingerprint inline, adding repair-artifact validation logic to a function otherwise focused on skip/classification decisions.
**Suggestion:** Compute the fingerprint once at the caller level, or introduce a small helper such as `assertCurrentTestExecuteFingerprint({ root, state, specDir })`. This keeps skip-decision logic focused and makes the repair-fingerprint assertion easier to reuse consistently.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Issue:** `finalRegressionSkipDecision` now builds and asserts the repair fingerprint inline, adding repair-artifact validation logic to a function otherwise focused on skip/classification decisions.
**Suggestion:** Compute the fingerprint once at the caller level, or introduce a small helper such as `assertCurrentTestExecuteFingerprint({ root, state, specDir })`. This keeps skip-decision logic focused and makes the repair-fingerprint assertion easier to reuse consistently.
**Rationale:** Loop review proposal.

### 17. 2. Replace Repeated Artifact Filename Literals With Shared Constants
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Issue:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `test-execute-result.json` and `test-result-review.json` are now referenced both as path variables and as string literals in the `files` array. This creates minor duplication and makes future renames easier to miss.
**Suggestion:** Define artifact filename constants near the existing path construction, then derive both the paths and the `assertCurrentRepairEvidenceFiles` list from those constants.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `test-execute-result.json` and `test-result-review.json` are now referenced both as path variables and as string literals in the `files` array. This creates minor duplication and makes future renames easier to miss.
**Suggestion:** Define artifact filename constants near the existing path construction, then derive both the paths and the `assertCurrentRepairEvidenceFiles` list from those constants.
**Rationale:** Loop review proposal.

### 18. 3. Clarify Whether `retro.json` Is Required Evidence
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize.js
**Issue:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `assertCurrentRepairEvidenceFiles` is called before `readRetroResultIfExists`, but the surrounding code treats `retro.json` as optional. If `assertCurrentRepairEvidenceFiles` requires every listed file to exist, this changes optional behavior into required behavior.
**Suggestion:** Either pass only files that are mandatory at this point, or rename/use an API that clearly supports optional files. If `retro.json` is intentionally required after repair, make that explicit with a local comment or a more specific assertion helper name.
**Suggestion:** **File:** `src/flow/lib/run-finalize.js`
**Issue:** `assertCurrentRepairEvidenceFiles` is called before `readRetroResultIfExists`, but the surrounding code treats `retro.json` as optional. If `assertCurrentRepairEvidenceFiles` requires every listed file to exist, this changes optional behavior into required behavior.
**Suggestion:** Either pass only files that are mandatory at this point, or rename/use an API that clearly supports optional files. If `retro.json` is intentionally required after repair, make that explicit with a local comment or a more specific assertion helper name.
**Rationale:** Loop review proposal.

### 19. 1. Reuse the repair evidence validator
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkIntegrationTestArtifacts` manually builds a fingerprint, reads two JSON files, parses them, and calls `assertRepairFingerprint`. `run-report.js` now uses `assertCurrentRepairEvidenceFiles` for the same kind of validation, so the validation pattern is inconsistent and partly duplicated.  
**Suggestion:** Replace the manual loop with `assertCurrentRepairEvidenceFiles({ root, state, specDir, files: [...] })` if the helper supports this call site, or add a small local helper so repair evidence validation is expressed the same way across gate/report flows.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkIntegrationTestArtifacts` manually builds a fingerprint, reads two JSON files, parses them, and calls `assertRepairFingerprint`. `run-report.js` now uses `assertCurrentRepairEvidenceFiles` for the same kind of validation, so the validation pattern is inconsistent and partly duplicated.  
**Suggestion:** Replace the manual loop with `assertCurrentRepairEvidenceFiles({ root, state, specDir, files: [...] })` if the helper supports this call site, or add a small local helper so repair evidence validation is expressed the same way across gate/report flows.
**Rationale:** Loop review proposal.

### 20. 2. Centralize impl-gate artifact writing
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `persistIntegrationGateResult` and `runGatePhaseWithDependencies` now both know that integration gate results should be written through `writeRepairEvidenceArtifact` with `stepId: "impl-gate"`. That duplicates artifact routing knowledge and makes future filename or metadata changes easier to miss.  
**Suggestion:** Extract a helper such as `writeImplGateResultArtifact({ specDir, artifact, fingerprint })` and use it from both call sites. It can return the written artifact/path so callers do not need to separately assume the basename.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Issue:** `persistIntegrationGateResult` and `runGatePhaseWithDependencies` now both know that integration gate results should be written through `writeRepairEvidenceArtifact` with `stepId: "impl-gate"`. That duplicates artifact routing knowledge and makes future filename or metadata changes easier to miss.  
**Suggestion:** Extract a helper such as `writeImplGateResultArtifact({ specDir, artifact, fingerprint })` and use it from both call sites. It can return the written artifact/path so callers do not need to separately assume the basename.
**Rationale:** Loop review proposal.

### 21. 3. Avoid inline repair evidence filename lists
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Issue:** The list `["test-execute-result.json", "test-result-review.json", "retro.json"]` is embedded directly in `RunReportCommand.run`. Similar artifact filename sets are likely to recur as R4 enforcement expands, which increases the chance of inconsistent coverage.  
**Suggestion:** Move the list to a named constant near the top of the file, for example `REPORT_REPAIR_EVIDENCE_FILES`, so the intent is explicit and future additions are localized.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Issue:** The list `["test-execute-result.json", "test-result-review.json", "retro.json"]` is embedded directly in `RunReportCommand.run`. Similar artifact filename sets are likely to recur as R4 enforcement expands, which increases the chance of inconsistent coverage.  
**Suggestion:** Move the list to a named constant near the top of the file, for example `REPORT_REPAIR_EVIDENCE_FILES`, so the intent is explicit and future additions are localized.
**Rationale:** Loop review proposal.

### 22. 4. Remove now-unused `retroPath` write responsibility
**Failure mode:** refactor
**File:** src/flow/lib/run-retro.js
**Issue:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The direct `fs.writeFileSync(retroPath, ...)` call was replaced by `writeRepairEvidenceArtifact`, but `retroPath` may now only exist for path construction or prior checks. If it is no longer needed, keeping it makes the write target less obvious.  
**Suggestion:** If `retroPath` is unused after this change, remove it. If callers still need the exact path, derive it from the `writeRepairEvidenceArtifact` result instead of maintaining two write-path concepts.
**Suggestion:** **File:** `src/flow/lib/run-retro.js`  
**Issue:** The direct `fs.writeFileSync(retroPath, ...)` call was replaced by `writeRepairEvidenceArtifact`, but `retroPath` may now only exist for path construction or prior checks. If it is no longer needed, keeping it makes the write target less obvious.  
**Suggestion:** If `retroPath` is unused after this change, remove it. If callers still need the exact path, derive it from the `writeRepairEvidenceArtifact` result instead of maintaining two write-path concepts.
**Rationale:** Loop review proposal.

### 23. I’ll review the supplied diff only and focus on maintainability proposals in the touched files. Since this is a code review request, I’m not editing the workspace.### 1. Extract shared repair fingerprint validation
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** The new impl-review fingerprint check duplicates artifact names and validation flow already present in `src/flow/lib/run-retro.js`, increasing drift risk if artifact names or validation rules change.  
**Suggestion:** Move the “load test-execute-result/test-result-review and assert repair fingerprint” logic into a small shared helper in an existing artifact module, then call it from both review and retro.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** The new impl-review fingerprint check duplicates artifact names and validation flow already present in `src/flow/lib/run-retro.js`, increasing drift risk if artifact names or validation rules change.  
**Suggestion:** Move the “load test-execute-result/test-result-review and assert repair fingerprint” logic into a small shared helper in an existing artifact module, then call it from both review and retro.
**Rationale:** Loop review proposal.

### 24. 2. Avoid unbounded artifact reads
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `JSON.parse(fs.readFileSync(artifactPath, "utf8"))` reads the full artifact without an explicit size bound, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Use an existing bounded artifact reader if available, or add a small size check before reading/parsing these two JSON files.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `JSON.parse(fs.readFileSync(artifactPath, "utf8"))` reads the full artifact without an explicit size bound, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Use an existing bounded artifact reader if available, or add a small size check before reading/parsing these two JSON files.
**Rationale:** Loop review proposal.

### 25. 3. Replace inline artifact filename literals
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `"test-execute-result.json"` and `"test-result-review.json"` are hard-coded inline, while `run-retro.js` already has named constants for these artifacts.  
**Suggestion:** Introduce shared constants or local constants in `run-review.js` so error messages, path construction, and labels use the same source of truth.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Issue:** `"test-execute-result.json"` and `"test-result-review.json"` are hard-coded inline, while `run-retro.js` already has named constants for these artifacts.  
**Suggestion:** Introduce shared constants or local constants in `run-review.js` so error messages, path construction, and labels use the same source of truth.
**Rationale:** Loop review proposal.

### 26. 1. Remove stale `resultPath` dependency if it is no longer used
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The direct `fs.writeFileSync(resultPath, ...)` call was replaced by `writeRepairEvidenceArtifact(...)`. If `resultPath` is now only retained for that removed write, it becomes dead code and may mislead readers into thinking the path is still authoritative here.  
**Suggestion:** Remove the `resultPath` variable/import dependency if it is no longer referenced elsewhere in the file, or use it explicitly if the artifact writer is expected to target that exact path.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The direct `fs.writeFileSync(resultPath, ...)` call was replaced by `writeRepairEvidenceArtifact(...)`. If `resultPath` is now only retained for that removed write, it becomes dead code and may mislead readers into thinking the path is still authoritative here.  
**Suggestion:** Remove the `resultPath` variable/import dependency if it is no longer referenced elsewhere in the file, or use it explicitly if the artifact writer is expected to target that exact path.
**Rationale:** Loop review proposal.

### 27. 2. Avoid mutating the review artifact inside the writer helper
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

### 28. 3. Centralize relative artifact path normalization inside the helper
**Failure mode:** refactor
**File:** src/flow/lib/run-test-result-review.js
**Issue:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `path.relative(root, reviewPath).split(path.sep).join("/")` is a repeated path-normalization pattern likely used elsewhere in flow artifacts. Keeping it inline makes the artifact-writing code noisier and increases the chance of inconsistent path formatting.  
**Suggestion:** Extract a small local helper in this file, such as `toArtifactPath(root, filePath)`, and use it when building `contractSummary`.
**Suggestion:** **File:** `src/flow/lib/run-test-result-review.js`  
**Issue:** `path.relative(root, reviewPath).split(path.sep).join("/")` is a repeated path-normalization pattern likely used elsewhere in flow artifacts. Keeping it inline makes the artifact-writing code noisier and increases the chance of inconsistent path formatting.  
**Suggestion:** Extract a small local helper in this file, such as `toArtifactPath(root, filePath)`, and use it when building `contractSummary`.
**Rationale:** Loop review proposal.

### 29. 1. Extract repeated spec/state completion branch shape
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new `impl-triage` and `impl-repair` branches add more special-case completion logic directly inside the `"done"` path. This method already contains step-specific handling, and the new branches continue that growth pattern.
**Suggestion:** Move these branches into small private helpers such as `completeImplTriageStep(ctx, state, id, status)` and `completeImplRepairStep(ctx, state, id, status)`, or a single dispatch table for artifact-backed step completions. This keeps `run()` focused on routing and makes future implementation leaves easier to add consistently.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new `impl-triage` and `impl-repair` branches add more special-case completion logic directly inside the `"done"` path. This method already contains step-specific handling, and the new branches continue that growth pattern.
**Suggestion:** Move these branches into small private helpers such as `completeImplTriageStep(ctx, state, id, status)` and `completeImplRepairStep(ctx, state, id, status)`, or a single dispatch table for artifact-backed step completions. This keeps `run()` focused on routing and makes future implementation leaves easier to add consistently.
**Rationale:** Loop review proposal.

### 30. 2. Name the reset range constant
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** `flowLeafIdsBetween("test-execute", "finalize-cleanup")` encodes important workflow behavior inline. The range determines which downstream leaves are reset after repair, but the boundary meaning is not obvious at the call site.
**Suggestion:** Assign it to a named constant or helper, for example `implementationRepairResetStepIds()` or `DOWNSTREAM_IMPL_REPAIR_RESET_RANGE`, so the reset policy is explicit and easier to audit against R1.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** `flowLeafIdsBetween("test-execute", "finalize-cleanup")` encodes important workflow behavior inline. The range determines which downstream leaves are reset after repair, but the boundary meaning is not obvious at the call site.
**Suggestion:** Assign it to a named constant or helper, for example `implementationRepairResetStepIds()` or `DOWNSTREAM_IMPL_REPAIR_RESET_RANGE`, so the reset policy is explicit and easier to audit against R1.
**Rationale:** Loop review proposal.

### 31. 3. Avoid mixed return payload naming
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new completion responses use different payload keys: `dispositions` for `impl-triage`, and `repair` plus `invalidations` for `impl-repair`. That may be correct semantically, but it creates a slightly inconsistent response shape for related implementation-repair flow steps.
**Suggestion:** Consider grouping step-specific completion artifacts under a consistent key such as `artifact` or `completion`, for example `{ id, status, next, artifact: completed.artifact }` and `{ id, status, artifact: completed.entry, invalidations }`. This makes command consumers less likely to grow step-specific parsing branches unnecessarily.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** The new completion responses use different payload keys: `dispositions` for `impl-triage`, and `repair` plus `invalidations` for `impl-repair`. That may be correct semantically, but it creates a slightly inconsistent response shape for related implementation-repair flow steps.
**Suggestion:** Consider grouping step-specific completion artifacts under a consistent key such as `artifact` or `completion`, for example `{ id, status, next, artifact: completed.artifact }` and `{ id, status, artifact: completed.entry, invalidations }`. This makes command consumers less likely to grow step-specific parsing branches unnecessarily.
**Rationale:** Loop review proposal.

### 32. 4. Clarify no-repair record ownership in prompt text
**Failure mode:** refactor
**File:** src/flow/prompts/impl/acceptance-review.md
**Issue:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** The prompt now requires `impl-repair.json` or an explicit no-repair record, but it does not name where that no-repair record comes from or how it is represented. That ambiguity can produce inconsistent reviewer output or invented citation strings, which the same prompt later forbids.
**Suggestion:** Add a short concrete phrase identifying the artifact/source for the no-repair record, for example “the command-provided explicit no-repair record” or the exact artifact path/key if one exists.
**Suggestion:** **File:** `src/flow/prompts/impl/acceptance-review.md`
**Issue:** The prompt now requires `impl-repair.json` or an explicit no-repair record, but it does not name where that no-repair record comes from or how it is represented. That ambiguity can produce inconsistent reviewer output or invented citation strings, which the same prompt later forbids.
**Suggestion:** Add a short concrete phrase identifying the artifact/source for the no-repair record, for example “the command-provided explicit no-repair record” or the exact artifact path/key if one exists.
**Rationale:** Loop review proposal.

### 33. 1. Clarify triage wording to avoid mixed responsibilities
**Failure mode:** refactor
**File:** src/flow/prompts/impl/impl-review.md
**Issue:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** The FAIL path says to “Continue to `impl-triage`” and then “Address only `blockingFindings[]` through the triage artifact.” “Address” can imply doing repair work during review/triage, which conflicts with “do not repair directly from the review step.”  
**Suggestion:** Reword step 3 to make the artifact responsibility explicit, e.g. “Use the triage artifact to select and carry forward only `blockingFindings[]` for `impl-repair`.” This keeps review, triage, and repair responsibilities distinct.
**Suggestion:** **File:** `src/flow/prompts/impl/impl-review.md`  
**Issue:** The FAIL path says to “Continue to `impl-triage`” and then “Address only `blockingFindings[]` through the triage artifact.” “Address” can imply doing repair work during review/triage, which conflicts with “do not repair directly from the review step.”  
**Suggestion:** Reword step 3 to make the artifact responsibility explicit, e.g. “Use the triage artifact to select and carry forward only `blockingFindings[]` for `impl-repair`.” This keeps review, triage, and repair responsibilities distinct.
**Rationale:** Loop review proposal.

### 34. 2. Avoid hard-coding choices if lifecycle choices may expand
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`  
**Issue:** The help text now hard-codes only `accept_risk_and_continue` and `abort`. If the acceptance-decision command later supports additional explicit choices, the help text can drift from the implementation.  
**Suggestion:** If the valid choices already exist as constants or schema values in this file, generate this help line from that source instead of duplicating the literals in the help string.
**Suggestion:** **File:** `src/flow/registry.js`  
**Issue:** The help text now hard-codes only `accept_risk_and_continue` and `abort`. If the acceptance-decision command later supports additional explicit choices, the help text can drift from the implementation.  
**Suggestion:** If the valid choices already exist as constants or schema values in this file, generate this help line from that source instead of duplicating the literals in the help string.
**Rationale:** Loop review proposal.

### 35. I’ll review the two schema diffs only and look for quality/design issues within that scope, including the bounded-resource guardrail.### 1. Add explicit bounds for arrays and strings
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** Several arrays and strings are unbounded, including `mechanicalBlockers`, `hardBlockers`, `requirementJudgments`, `deferredFindings`, evidence ref arrays, and free-form strings. This violates the `bounded-resource-usage` guardrail because bulk output size is not capped.  
**Suggestion:** Add explicit `maxItems` for arrays and `maxLength` for strings, using project-appropriate limits for blocker counts, requirement judgments, evidence refs, and report refs.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** Several arrays and strings are unbounded, including `mechanicalBlockers`, `hardBlockers`, `requirementJudgments`, `deferredFindings`, evidence ref arrays, and free-form strings. This violates the `bounded-resource-usage` guardrail because bulk output size is not capped.  
**Suggestion:** Add explicit `maxItems` for arrays and `maxLength` for strings, using project-appropriate limits for blocker counts, requirement judgments, evidence refs, and report refs.
**Rationale:** Loop review proposal.

### 36. 3. Deduplicate repeated evidence reference array schemas
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** The schema repeats the same “array of non-empty strings” shape for `requestRefs`, `requirementRefs`, `diffRefs`, `repairRefs`, `testRefs`, `missingEvidence`, `evidenceRefs`, and `reportRefs`, with small inconsistencies such as some requiring `minItems` and others not.  
**Suggestion:** Introduce local `$defs`, for example `nonEmptyString`, `refArray`, and `requiredRefArray`, then reference them with `$ref`. This reduces duplication and makes future tightening, such as adding `maxItems`/`maxLength`, less error-prone.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** The schema repeats the same “array of non-empty strings” shape for `requestRefs`, `requirementRefs`, `diffRefs`, `repairRefs`, `testRefs`, `missingEvidence`, `evidenceRefs`, and `reportRefs`, with small inconsistencies such as some requiring `minItems` and others not.  
**Suggestion:** Introduce local `$defs`, for example `nonEmptyString`, `refArray`, and `requiredRefArray`, then reference them with `$ref`. This reduces duplication and makes future tightening, such as adding `maxItems`/`maxLength`, less error-prone.
**Rationale:** Loop review proposal.

### 37. 4. Tighten `hardBlockers` item shape for consistency
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** `mechanicalBlockers` now has a strict object shape with `additionalProperties: false`, but `hardBlockers` remains an array of arbitrary objects. That inconsistency weakens the schema and makes downstream handling less predictable.  
**Suggestion:** Define a strict `hardBlockers.items` schema with required identifiers/summary fields, or reuse a shared blocker definition if hard and mechanical blockers intentionally share structure.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`  
**Issue:** `mechanicalBlockers` now has a strict object shape with `additionalProperties: false`, but `hardBlockers` remains an array of arbitrary objects. That inconsistency weakens the schema and makes downstream handling less predictable.  
**Suggestion:** Define a strict `hardBlockers.items` schema with required identifiers/summary fields, or reuse a shared blocker definition if hard and mechanical blockers intentionally share structure.
**Rationale:** Loop review proposal.

### 38. 2. Add bounds to next-action acceptance-review projection
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The projected response arrays are also unbounded: `requirementJudgments`, `mechanicalBlockers`, and `hardBlockers`. This has the same bounded-resource risk as the full acceptance-review schema.  
**Suggestion:** Add `maxItems` to each array and, if item shapes remain generic objects, consider bounding object size via stricter item schemas or `maxProperties`.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The projected response arrays are also unbounded: `requirementJudgments`, `mechanicalBlockers`, and `hardBlockers`. This has the same bounded-resource risk as the full acceptance-review schema.  
**Suggestion:** Add `maxItems` to each array and, if item shapes remain generic objects, consider bounding object size via stricter item schemas or `maxProperties`.
**Rationale:** Loop review proposal.

### 39. 5. Avoid duplicating verdict enum values across schemas
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The `verdict` enum is duplicated here and in `src/flow/schemas/acceptance-review.schema.json`. The recent `amend_required` to `repair_required` rename had to be made in both places, which is easy to miss in future changes.  
**Suggestion:** If the schema loader supports JSON Schema references, factor the verdict enum into a shared `$defs` entry or shared schema file and reference it from both touched schemas. If external refs are not supported, add an in-file `$defs.verdict` in each file to at least keep local usage consistent.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The `verdict` enum is duplicated here and in `src/flow/schemas/acceptance-review.schema.json`. The recent `amend_required` to `repair_required` rename had to be made in both places, which is easy to miss in future changes.  
**Suggestion:** If the schema loader supports JSON Schema references, factor the verdict enum into a shared `$defs` entry or shared schema file and reference it from both touched schemas. If external refs are not supported, add an in-file `$defs.verdict` in each file to at least keep local usage consistent.
**Rationale:** Loop review proposal.

### 40. I’ll review the diff as a quality pass only within the two touched test files, then return proposals in the exact requested format.### 1. Extract repeated fingerprinted artifact writes
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** `prepareAcceptanceEvidence` repeats `writeRepairEvidenceArtifact({ specDir, stepId, fingerprint, artifact: ... })` five times, which makes the fixture noisy and harder to scan.  
**Suggestion:** Add a small local helper inside `prepareAcceptanceEvidence`, such as `writeFingerprintedArtifact(stepId, artifact)`, and use it for each repair evidence artifact.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** `prepareAcceptanceEvidence` repeats `writeRepairEvidenceArtifact({ specDir, stepId, fingerprint, artifact: ... })` five times, which makes the fixture noisy and harder to scan.  
**Suggestion:** Add a small local helper inside `prepareAcceptanceEvidence`, such as `writeFingerprintedArtifact(stepId, artifact)`, and use it for each repair evidence artifact.
**Rationale:** Loop review proposal.

### 41. 2. Use a stable fixture timestamp
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** The test fixture uses `new Date().toISOString()` in multiple artifact payloads. The exact value is irrelevant to the assertions and introduces unnecessary nondeterminism.  
**Suggestion:** Define a constant like `const generatedAt = "2026-01-01T00:00:00.000Z";` and reuse it for `generatedAt` and `date`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Issue:** The test fixture uses `new Date().toISOString()` in multiple artifact payloads. The exact value is irrelevant to the assertions and introduces unnecessary nondeterminism.  
**Suggestion:** Define a constant like `const generatedAt = "2026-01-01T00:00:00.000Z";` and reuse it for `generatedAt` and `date`.
**Rationale:** Loop review proposal.

### 42. 3. Table-drive rejection assertions
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The `"rejects missing buckets and verdicts inconsistent with recorded findings"` test has several near-identical `assert.throws` blocks.  
**Suggestion:** Convert the cases into an array of `{ artifact, message }` records and loop over them. This would reduce duplication while keeping each validation scenario explicit.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The `"rejects missing buckets and verdicts inconsistent with recorded findings"` test has several near-identical `assert.throws` blocks.  
**Suggestion:** Convert the cases into an array of `{ artifact, message }` records and loop over them. This would reduce duplication while keeping each validation scenario explicit.
**Rationale:** Loop review proposal.

### 43. 4. Improve generic test case naming
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The variable name `cases` in the completion contract test is generic and does not communicate what dimension is being exercised.  
**Suggestion:** Rename it to something more specific, such as `consistentVerdictCases` or `validCompletionContractCases`.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Issue:** The variable name `cases` in the completion contract test is generic and does not communicate what dimension is being exercised.  
**Suggestion:** Rename it to something more specific, such as `consistentVerdictCases` or `validCompletionContractCases`.
**Rationale:** Loop review proposal.

### 44. 1. Centralize repair evidence validation helper
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Several files introduce or mention similar repair evidence fingerprint validation flows: `run-gate.js`, `run-review.js`, `run-retro.js`, `run-report.js`, `run-final-regression.js`, and `run-finalize.js`. Some use `assertCurrentRepairEvidenceFiles`, while others manually build fingerprints, read artifacts, and call `assertRepairFingerprint`.
**Suggestion:** Move the common “current repair evidence files + fingerprint assertion” behavior into one shared helper/API and use it consistently across gate, review, retro, report, finalize, and final regression paths.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Several files introduce or mention similar repair evidence fingerprint validation flows: `run-gate.js`, `run-review.js`, `run-retro.js`, `run-report.js`, `run-final-regression.js`, and `run-finalize.js`. Some use `assertCurrentRepairEvidenceFiles`, while others manually build fingerprints, read artifacts, and call `assertRepairFingerprint`.
**Suggestion:** Move the common “current repair evidence files + fingerprint assertion” behavior into one shared helper/API and use it consistently across gate, review, retro, report, finalize, and final regression paths.
**Rationale:** Loop review proposal.

### 45. 2. Share repair artifact filename constants
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Issue:** **File:** `src/flow/lib/run-review.js`
**Issue:** Artifact filenames such as `test-execute-result.json`, `test-result-review.json`, and `retro.json` are repeated across `run-review.js`, `run-retro.js`, `run-report.js`, `run-finalize.js`, and test fixtures. This creates rename drift risk.
**Suggestion:** Define shared constants for repair evidence artifact filenames, likely in the artifact helper module, and derive validation lists and write paths from those constants.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Issue:** Artifact filenames such as `test-execute-result.json`, `test-result-review.json`, and `retro.json` are repeated across `run-review.js`, `run-retro.js`, `run-report.js`, `run-finalize.js`, and test fixtures. This creates rename drift risk.
**Suggestion:** Define shared constants for repair evidence artifact filenames, likely in the artifact helper module, and derive validation lists and write paths from those constants.
**Rationale:** Loop review proposal.

### 46. 3. Normalize repair evidence artifact writing
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Multiple files now call `writeRepairEvidenceArtifact` directly with step IDs and artifact routing knowledge: `run-gate.js`, `run-retro.js`, `run-test-execute.js`, `run-test-result-review.js`, and tests. This duplicates ownership of which step writes which artifact.
**Suggestion:** Add narrow writer helpers such as `writeImplGateResultArtifact`, `writeRetroArtifact`, or a table-driven artifact writer map so callers do not repeat filenames, step IDs, and metadata rules.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Issue:** Multiple files now call `writeRepairEvidenceArtifact` directly with step IDs and artifact routing knowledge: `run-gate.js`, `run-retro.js`, `run-test-execute.js`, `run-test-result-review.js`, and tests. This duplicates ownership of which step writes which artifact.
**Suggestion:** Add narrow writer helpers such as `writeImplGateResultArtifact`, `writeRetroArtifact`, or a table-driven artifact writer map so callers do not repeat filenames, step IDs, and metadata rules.
**Rationale:** Loop review proposal.

### 47. 4. Unify impl-review verdict validation
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** Impl-review verdict/bucket consistency validation is reported in both `acceptance-review-artifacts.js` and `flow-judgment-contract.js`. Duplicated validation rules can drift as review states evolve.
**Suggestion:** Export one shared impl-review validation helper from the contract/artifact layer and call it from both locations.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** Impl-review verdict/bucket consistency validation is reported in both `acceptance-review-artifacts.js` and `flow-judgment-contract.js`. Duplicated validation rules can drift as review states evolve.
**Suggestion:** Export one shared impl-review validation helper from the contract/artifact layer and call it from both locations.
**Rationale:** Loop review proposal.

### 48. 5. Consolidate bounded AI response/schema limits
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`
**Issue:** Bounded-resource concerns appear across runtime parsing, prompt construction, artifact validation, and JSON schemas. The same conceptual limits are likely to be enforced inconsistently if each file invents its own caps.
**Suggestion:** Define shared acceptance-review limit constants or schema `$defs` for blocker counts, evidence refs, response size, string lengths, and requirement judgment counts, then reuse them in schema generation and runtime validation.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`
**Issue:** Bounded-resource concerns appear across runtime parsing, prompt construction, artifact validation, and JSON schemas. The same conceptual limits are likely to be enforced inconsistently if each file invents its own caps.
**Suggestion:** Define shared acceptance-review limit constants or schema `$defs` for blocker counts, evidence refs, response size, string lengths, and requirement judgment counts, then reuse them in schema generation and runtime validation.
**Rationale:** Loop review proposal.

### 49. 6. Align completion response shapes for implementation flow steps
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`
**Issue:** Related implementation repair steps return different payload keys, such as `dispositions` for `impl-triage` and `repair` for `impl-repair`. This creates an interface inconsistency that can force command consumers into step-specific parsing.
**Suggestion:** Use a consistent envelope such as `{ id, status, next, artifact, invalidations }`, with step-specific details nested under `artifact` or `completion`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Issue:** Related implementation repair steps return different payload keys, such as `dispositions` for `impl-triage` and `repair` for `impl-repair`. This creates an interface inconsistency that can force command consumers into step-specific parsing.
**Suggestion:** Use a consistent envelope such as `{ id, status, next, artifact, invalidations }`, with step-specific details nested under `artifact` or `completion`.
**Rationale:** Loop review proposal.

### 50. 7. Standardize acceptance-review verdict enum ownership
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`
**Issue:** The acceptance-review verdict enum is duplicated between the full acceptance-review schema and the next-action projection schema. Recent enum renames must be repeated in both places.
**Suggestion:** Factor the verdict enum into a shared `$defs` entry or shared schema module if supported; otherwise, add a generation/check test to ensure both schemas remain synchronized.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`
**Issue:** The acceptance-review verdict enum is duplicated between the full acceptance-review schema and the next-action projection schema. Recent enum renames must be repeated in both places.
**Suggestion:** Factor the verdict enum into a shared `$defs` entry or shared schema module if supported; otherwise, add a generation/check test to ensure both schemas remain synchronized.
**Rationale:** Loop review proposal.

### 51. 8. Make naming consistent for artifact readers and collectors
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** Naming patterns vary across related artifact helpers: examples include noun-like `dispositionEvidence`, broad `implementationDiff`, and writer helpers that also mutate artifacts. This makes cross-file responsibilities harder to infer.
**Suggestion:** Prefer verb-led names for IO and construction functions, such as `readDispositionEvidence`, `collectAcceptanceDiff`, and `buildReviewArtifact`, and reserve `write*` names for functions that only persist already-built artifacts.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Issue:** Naming patterns vary across related artifact helpers: examples include noun-like `dispositionEvidence`, broad `implementationDiff`, and writer helpers that also mutate artifacts. This makes cross-file responsibilities harder to infer.
**Suggestion:** Prefer verb-led names for IO and construction functions, such as `readDispositionEvidence`, `collectAcceptanceDiff`, and `buildReviewArtifact`, and reserve `write*` names for functions that only persist already-built artifacts.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
