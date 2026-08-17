# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Consolidate Repeated Workflow Provider Configuration
**Failure mode:** refactor
**File:** .senti/config.json
**Issue:** **File:** `.senti/config.json`  
**Issue:** The same provider value, `codex/gpt-5.5`, is repeated for `publish`, `classify`, `similarity`, and `compose`, which makes future provider changes more error-prone.  
**Suggestion:** If the workflow plugin schema supports it, define a single workflow agent default provider and keep per-agent provider entries only for exceptions. This would remove duplication and make the shared intent clearer.
**Suggestion:** **File:** `.senti/config.json`  
**Issue:** The same provider value, `codex/gpt-5.5`, is repeated for `publish`, `classify`, `similarity`, and `compose`, which makes future provider changes more error-prone.  
**Suggestion:** If the workflow plugin schema supports it, define a single workflow agent default provider and keep per-agent provider entries only for exceptions. This would remove duplication and make the shared intent clearer.
**Rationale:** Loop review proposal.

### 2. 1. Extract final regression detail formatting
**Failure mode:** refactor
**File:** src/flow/commands/report.js
**Issue:** **File:** `src/flow/commands/report.js`  
**Issue:** The `lines.push` call now embeds multiple optional fields in one long template literal, making it harder to read and easier to extend inconsistently if more final-regression fields are added.  
**Suggestion:** Build the optional parts as an array and join them, e.g. `["result=...", r.skipKind && ..., r.failureKind && ...].filter(Boolean).join(" ")`, or extract a small helper such as `formatFinalRegressionResult(r)`. This keeps the text formatting consistent and easier to maintain.
**Suggestion:** **File:** `src/flow/commands/report.js`  
**Issue:** The `lines.push` call now embeds multiple optional fields in one long template literal, making it harder to read and easier to extend inconsistently if more final-regression fields are added.  
**Suggestion:** Build the optional parts as an array and join them, e.g. `["result=...", r.skipKind && ..., r.failureKind && ...].filter(Boolean).join(" ")`, or extract a small helper such as `formatFinalRegressionResult(r)`. This keeps the text formatting consistent and easier to maintain.
**Rationale:** Loop review proposal.

### 3. 1. Centralize non-blocking final-regression results
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`  
**Issue:** The accepted non-blocking outcomes for final regression are now encoded in two places: `allowedVerdicts: ["pass", "skipped"]` and the `artifact.result === "pass" || artifact.result === "skipped"` check. This creates a small maintenance risk if another terminal non-blocking result is added later.  
**Suggestion:** Define a shared constant or helper in this file, for example `FINAL_REGRESSION_NON_BLOCKING_RESULTS = new Set(["pass", "skipped"])`, and use it both for `allowedVerdicts` and for deciding whether `blockingFindings` should be empty.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`  
**Issue:** The accepted non-blocking outcomes for final regression are now encoded in two places: `allowedVerdicts: ["pass", "skipped"]` and the `artifact.result === "pass" || artifact.result === "skipped"` check. This creates a small maintenance risk if another terminal non-blocking result is added later.  
**Suggestion:** Define a shared constant or helper in this file, for example `FINAL_REGRESSION_NON_BLOCKING_RESULTS = new Set(["pass", "skipped"])`, and use it both for `allowedVerdicts` and for deciding whether `blockingFindings` should be empty.
**Rationale:** Loop review proposal.

### 4. 1. Bound recursive directory expansion
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `listFilesRecursive()` recursively walks directories with no depth, file count, or size bound. This violates the `bounded-resource-usage` guardrail if a changed directory is large or deeply nested.  
**Suggestion:** Add explicit limits, for example `MAX_EXPANDED_CHANGED_FILES` and `MAX_EXPANSION_DEPTH`, and fail closed by returning the original directory entry or forcing full regression when exceeded.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `listFilesRecursive()` recursively walks directories with no depth, file count, or size bound. This violates the `bounded-resource-usage` guardrail if a changed directory is large or deeply nested.  
**Suggestion:** Add explicit limits, for example `MAX_EXPANDED_CHANGED_FILES` and `MAX_EXPANSION_DEPTH`, and fail closed by returning the original directory entry or forcing full regression when exceeded.
**Rationale:** Loop review proposal.

### 5. 2. Remove the thin fingerprint wrapper
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `currentChangedFilesWithFingerprints()` only forwards to `withChangedFileFingerprints()` and does not add behavior or clarify intent meaningfully.  
**Suggestion:** Inline calls to `withChangedFileFingerprints(root, changedFiles)` and delete `currentChangedFilesWithFingerprints()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `currentChangedFilesWithFingerprints()` only forwards to `withChangedFileFingerprints()` and does not add behavior or clarify intent meaningfully.  
**Suggestion:** Inline calls to `withChangedFileFingerprints(root, changedFiles)` and delete `currentChangedFilesWithFingerprints()`.
**Rationale:** Loop review proposal.

### 6. 3. Avoid duplicate command identity construction
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `commandIdentityFor(rootCommand)` is called in `execute()` to get `commandSource`, then called again inside `finalRegressionSkipDecision()` to build the full identity.  
**Suggestion:** Compute `const commandIdentity = commandIdentityFor(rootCommand).toJSON()` once in `execute()`, use `commandIdentity.commandSource`, and pass `commandIdentity` into `finalRegressionSkipDecision()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `commandIdentityFor(rootCommand)` is called in `execute()` to get `commandSource`, then called again inside `finalRegressionSkipDecision()` to build the full identity.  
**Suggestion:** Compute `const commandIdentity = commandIdentityFor(rootCommand).toJSON()` once in `execute()`, use `commandIdentity.commandSource`, and pass `commandIdentity` into `finalRegressionSkipDecision()`.
**Rationale:** Loop review proposal.

### 7. 4. Prefer existing classification over parallel test-only matching
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `isGenericTestOnlyPath()` duplicates part of the regression classification logic with filename/path checks, while the requirements say generic test-only files should be determined by `classifyRegression()`. This creates two sources of truth.  
**Suggestion:** Reuse the `classifyRegression()` result already computed in `finalRegressionSkipDecision()` and pass relevant classification data into `riskBasedSkipDecision()` instead of reimplementing generic test-only matching locally.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `isGenericTestOnlyPath()` duplicates part of the regression classification logic with filename/path checks, while the requirements say generic test-only files should be determined by `classifyRegression()`. This creates two sources of truth.  
**Suggestion:** Reuse the `classifyRegression()` result already computed in `finalRegressionSkipDecision()` and pass relevant classification data into `riskBasedSkipDecision()` instead of reimplementing generic test-only matching locally.
**Rationale:** Loop review proposal.

### 8. 5. Simplify skip proof representation
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `FinalRegressionSkipProof` mostly wraps a plain object, assigns arbitrary data onto `this`, and exists mainly so `artifact.toJSON()` can call `.toJSON()`. That is heavier than the rest of the skip decision data needs.  
**Suggestion:** Replace it with a small `buildFinalRegressionSkipProof(kind, data)` helper that validates `kind` and returns a frozen plain object. Then `FinalRegressionArtifact.toJSON()` can emit `proof` directly.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Issue:** `FinalRegressionSkipProof` mostly wraps a plain object, assigns arbitrary data onto `this`, and exists mainly so `artifact.toJSON()` can call `.toJSON()`. That is heavier than the rest of the skip decision data needs.  
**Suggestion:** Replace it with a small `buildFinalRegressionSkipProof(kind, data)` helper that validates `kind` and returns a frozen plain object. Then `FinalRegressionArtifact.toJSON()` can emit `proof` directly.
**Rationale:** Loop review proposal.

### 9. I’ll inspect the touched file around the changed helpers so the proposals are grounded in the actual local implementation, not just the diff snippet.The provided path isn’t rooted at the current working directory, so I’m checking the workspace layout and then I’ll open the matching file wherever this worktree has it.This checkout appears to expose the task artifacts under `agent/` rather than the repository root. I’m locating the supplied diff and source snapshot there.### 1. Avoid Hidden `command` Overwrite
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `buildRequiredRegression` sets `command: command.toString()` and then spreads `...commandIdentity`, which likely contains its own `command` field. That makes the first `command` assignment redundant or silently overwritten.  
**Suggestion:** Make `commandIdentity` the single source of truth by removing the explicit `command: command.toString()`, or spread `commandIdentity` before explicit legacy fields if intentional overrides are needed.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `buildRequiredRegression` sets `command: command.toString()` and then spreads `...commandIdentity`, which likely contains its own `command` field. That makes the first `command` assignment redundant or silently overwritten.  
**Suggestion:** Make `commandIdentity` the single source of truth by removing the explicit `command: command.toString()`, or spread `commandIdentity` before explicit legacy fields if intentional overrides are needed.
**Rationale:** Loop review proposal.

### 10. 2. Keep Root Command Source Semantics Clear
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `root_test_command_source` now uses `commandIdentity.commandSource`, but the field name pairs with `root_test_command: rootCommand.toString()`. If `rootCommand` and `command` differ, this mixes two command identities.  
**Suggestion:** Use `rootCommand.source` for `root_test_command_source`, and rely on `commandIdentity.commandSource` for the actual regression command identity field.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `root_test_command_source` now uses `commandIdentity.commandSource`, but the field name pairs with `root_test_command: rootCommand.toString()`. If `rootCommand` and `command` differ, this mixes two command identities.  
**Suggestion:** Use `rootCommand.source` for `root_test_command_source`, and rely on `commandIdentity.commandSource` for the actual regression command identity field.
**Rationale:** Loop review proposal.

### 11. 3. Consolidate Changed-File Fingerprinting
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `withChangedFileFingerprints` is called separately for `classification.changedFiles` and `classification.triggerRelevantChangedFiles`, which may duplicate hashing or filesystem work when the trigger-relevant set overlaps with the full changed-file set.  
**Suggestion:** Compute fingerprint evidence once for the changed-file universe and derive the trigger-relevant subset from that result, or introduce a small helper such as `buildRegressionChangedFileEvidence(root, classification)`.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** `withChangedFileFingerprints` is called separately for `classification.changedFiles` and `classification.triggerRelevantChangedFiles`, which may duplicate hashing or filesystem work when the trigger-relevant set overlaps with the full changed-file set.  
**Suggestion:** Compute fingerprint evidence once for the changed-file universe and derive the trigger-relevant subset from that result, or introduce a small helper such as `buildRegressionChangedFileEvidence(root, classification)`.
**Rationale:** Loop review proposal.

### 12. 4. Add Explicit Bounds Around Fingerprint Collection
**Failure mode:** refactor
**File:** src/flow/lib/run-test-execute.js
**Issue:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The new fingerprinting path processes changed-file lists without an explicit visible bound in this file, which risks violating the `bounded-resource-usage` guardrail if the helper does not cap file count, file size, or total bytes read.  
**Suggestion:** Enforce or document explicit limits before calling `withChangedFileFingerprints`, ideally failing closed for skip eligibility when the changed-file fingerprint evidence exceeds the allowed bound.
**Suggestion:** **File:** `src/flow/lib/run-test-execute.js`  
**Issue:** The new fingerprinting path processes changed-file lists without an explicit visible bound in this file, which risks violating the `bounded-resource-usage` guardrail if the helper does not cap file count, file size, or total bytes read.  
**Suggestion:** Enforce or document explicit limits before calling `withChangedFileFingerprints`, ideally failing closed for skip eligibility when the changed-file fingerprint evidence exceeds the allowed bound.
**Rationale:** Loop review proposal.

### 13. 1. Consolidate line range validation
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** `assertCamelRange()` duplicates nearly all of `assertRange()` with only the field names differing.
**Suggestion:** Replace both with one helper that accepts key names, for example `assertLineRange(range, label, { startKey, endKey, fieldName })`, and call it with `start_line/end_line` or `start/end`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** `assertCamelRange()` duplicates nearly all of `assertRange()` with only the field names differing.
**Suggestion:** Replace both with one helper that accepts key names, for example `assertLineRange(range, label, { startKey, endKey, fieldName })`, and call it with `start_line/end_line` or `start/end`.
**Rationale:** Loop review proposal.

### 14. 2. Extract skipped proof validators
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** `validateFinalRegressionSkipKind()` now mixes top-level skipped artifact validation with two proof schema variants, making the function long and harder to extend.
**Suggestion:** Split into focused helpers such as `validateCoveredByTestExecuteProof(proof)` and `validateRiskBasedStaticProof(proof)`, keeping `validateFinalRegressionSkipKind()` as the dispatcher.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** `validateFinalRegressionSkipKind()` now mixes top-level skipped artifact validation with two proof schema variants, making the function long and harder to extend.
**Suggestion:** Split into focused helpers such as `validateCoveredByTestExecuteProof(proof)` and `validateRiskBasedStaticProof(proof)`, keeping `validateFinalRegressionSkipKind()` as the dispatcher.
**Rationale:** Loop review proposal.

### 15. 3. Avoid `JSON.stringify()` for schema equality checks
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** Comparing `staleCheck` and `failClosedDecision` with `JSON.stringify()` is brittle because it depends on property insertion order and obscures which field failed.
**Suggestion:** Validate each required property explicitly, e.g. `sameFlow === true`, `commandIdentityMatched === true`, and ensure `fallbackReasons` is an empty array.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** Comparing `staleCheck` and `failClosedDecision` with `JSON.stringify()` is brittle because it depends on property insertion order and obscures which field failed.
**Suggestion:** Validate each required property explicitly, e.g. `sameFlow === true`, `commandIdentityMatched === true`, and ensure `fallbackReasons` is an empty array.
**Rationale:** Loop review proposal.

### 16. 4. Add bounded validation for artifact arrays
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** New skipped-proof fields accept arrays such as `commandIdentity.argv`, `changedFileFingerprints`, `allowlistClassifications`, and `checkedSensitivePathClasses` without explicit size limits. This conflicts with the `bounded-resource-usage` guardrail for bulk artifact data.
**Suggestion:** Introduce explicit maximum counts for these arrays before inspecting or accepting them, using existing project constants if available or nearby final-regression-specific constants if not.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** New skipped-proof fields accept arrays such as `commandIdentity.argv`, `changedFileFingerprints`, `allowlistClassifications`, and `checkedSensitivePathClasses` without explicit size limits. This conflicts with the `bounded-resource-usage` guardrail for bulk artifact data.
**Suggestion:** Introduce explicit maximum counts for these arrays before inspecting or accepting them, using existing project constants if available or nearby final-regression-specific constants if not.
**Rationale:** Loop review proposal.

### 17. 5. Validate proof entry shapes consistently
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** The code checks that `changedFileFingerprints`, `allowlistClassifications`, and `checkedSensitivePathClasses` are arrays, but it does not validate their element shapes even though the requirements specify object fields like `{ path, fingerprint }` and `{ path, category, fingerprint }`.
**Suggestion:** Add small validators for each proof collection so malformed skipped artifacts fail close with clear errors.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** The code checks that `changedFileFingerprints`, `allowlistClassifications`, and `checkedSensitivePathClasses` are arrays, but it does not validate their element shapes even though the requirements specify object fields like `{ path, fingerprint }` and `{ path, category, fingerprint }`.
**Suggestion:** Add small validators for each proof collection so malformed skipped artifacts fail close with clear errors.
**Rationale:** Loop review proposal.

### 18. 1. Bound fingerprint workload
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `withChangedFileFingerprints()` fingerprints every changed file, and `fingerprintFile()` reads each whole file with `fs.readFileSync()`. This violates `bounded-resource-usage` because both file count and file size are unbounded.  
**Suggestion:** Add explicit limits, for example max changed-file count and max bytes per fingerprinted file. For oversized files, return a sentinel or force full regression instead of reading the entire file into memory.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `withChangedFileFingerprints()` fingerprints every changed file, and `fingerprintFile()` reads each whole file with `fs.readFileSync()`. This violates `bounded-resource-usage` because both file count and file size are unbounded.  
**Suggestion:** Add explicit limits, for example max changed-file count and max bytes per fingerprinted file. For oversized files, return a sentinel or force full regression instead of reading the entire file into memory.
**Rationale:** Loop review proposal.

### 19. 2. Validate command identity primitive maps
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `RegressionCommandIdentity` freezes `env` and `metadata`, but does not validate that their values are JSON primitives. That makes the comparison contract harder to trust and can allow nested objects/arrays into identity data.  
**Suggestion:** Add a small helper like `assertPrimitiveMap(name, value)` and use it for both `env` and `metadata`. This keeps identity construction aligned with the exact primitive-value comparison requirement.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `RegressionCommandIdentity` freezes `env` and `metadata`, but does not validate that their values are JSON primitives. That makes the comparison contract harder to trust and can allow nested objects/arrays into identity data.  
**Suggestion:** Add a small helper like `assertPrimitiveMap(name, value)` and use it for both `env` and `metadata`. This keeps identity construction aligned with the exact primitive-value comparison requirement.
**Rationale:** Loop review proposal.

### 20. 3. Remove duplicated source assignment ambiguity
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `commandIdentityFor()` sets both `commandSource` and `source` to the normalized `commandSource` value. Because both fields are part of the required identity, this makes `source` look redundant and obscures whether it is meant to preserve the original `ParsedCommand.source`.  
**Suggestion:** Either preserve the raw value with `source: command.source`, or rename/internalize the normalized value so the two identity keys have clearly distinct meanings. If they are intentionally identical, add a short comment where the identity is built.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Issue:** `commandIdentityFor()` sets both `commandSource` and `source` to the normalized `commandSource` value. Because both fields are part of the required identity, this makes `source` look redundant and obscures whether it is meant to preserve the original `ParsedCommand.source`.  
**Suggestion:** Either preserve the raw value with `source: command.source`, or rename/internalize the normalized value so the two identity keys have clearly distinct meanings. If they are intentionally identical, add a short comment where the identity is built.
**Rationale:** Loop review proposal.

### 21. I’ll review the touched prompt file only, since your scope constraint is strict, and check it against the bounded resource usage guardrail.### 1. Add explicit bounds for artifact collections
**Failure mode:** refactor
**File:** src/flow/prompts/impl/final-regression.md
**Issue:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** `rawOutputLines`, `changedFiles`, `changedFileFingerprints`, and proof collections can imply unbounded bulk data capture, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Specify limits, for example: cap `rawOutputLines` by line count/bytes, cap changed-file fingerprint entries, and require truncation metadata when limits are exceeded.
**Suggestion:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** `rawOutputLines`, `changedFiles`, `changedFileFingerprints`, and proof collections can imply unbounded bulk data capture, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Specify limits, for example: cap `rawOutputLines` by line count/bytes, cap changed-file fingerprint entries, and require truncation metadata when limits are exceeded.
**Rationale:** Loop review proposal.

### 22. 2. Clarify skipped result terminology
**Failure mode:** refactor
**File:** src/flow/prompts/impl/final-regression.md
**Issue:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** The text uses outcome names like `covered_by_test_execute_full_regression` and `risk_based_static_proof`, but later says “On PASS or SKIPPED” without defining whether `SKIPPED` is a `result`, an outcome category, or shorthand for both skip kinds.  
**Suggestion:** Replace “On PASS or SKIPPED” with explicit artifact values, such as “On `result: "pass"` or `result: "skipped"`”, and state that skipped artifacts must set `skipKind` to one of the two listed skip outcomes.
**Suggestion:** **File:** `src/flow/prompts/impl/final-regression.md`  
**Issue:** The text uses outcome names like `covered_by_test_execute_full_regression` and `risk_based_static_proof`, but later says “On PASS or SKIPPED” without defining whether `SKIPPED` is a `result`, an outcome category, or shorthand for both skip kinds.  
**Suggestion:** Replace “On PASS or SKIPPED” with explicit artifact values, such as “On `result: "pass"` or `result: "skipped"`”, and state that skipped artifacts must set `skipKind` to one of the two listed skip outcomes.
**Rationale:** Loop review proposal.

### 23. 1. Bound Artifact Payload Fields
**Failure mode:** refactor
**File:** src/flow/prompts/impl/test-execute.md
**Issue:** **File:** `src/flow/prompts/impl/test-execute.md`  
**Issue:** The added artifact fields `argv`, `env`, and `metadata` have no explicit size/count limits. This can violate `bounded-resource-usage`, especially if an implementation records a full process environment or large metadata blob.  
**Suggestion:** Add explicit bounds, e.g. max argv entries, max env keys, max metadata keys, and max string length per value. Prefer whitelisted env keys over dumping the full environment.
**Suggestion:** **File:** `src/flow/prompts/impl/test-execute.md`  
**Issue:** The added artifact fields `argv`, `env`, and `metadata` have no explicit size/count limits. This can violate `bounded-resource-usage`, especially if an implementation records a full process environment or large metadata blob.  
**Suggestion:** Add explicit bounds, e.g. max argv entries, max env keys, max metadata keys, and max string length per value. Prefer whitelisted env keys over dumping the full environment.
**Rationale:** Loop review proposal.

### 24. 2. Remove Duplicate Command Source Fields
**Failure mode:** refactor
**File:** src/flow/prompts/impl/test-execute.md
**Issue:** **File:** `src/flow/prompts/impl/test-execute.md`  
**Issue:** The example now includes `root_test_command_source`, `commandSource`, and `source`, which appear to describe overlapping provenance. This creates ambiguity about which field downstream consumers should trust.  
**Suggestion:** Keep one canonical field name for command provenance, or clearly document distinct meanings if all are required. Prefer matching the existing snake_case style, e.g. `command_source`.
**Suggestion:** **File:** `src/flow/prompts/impl/test-execute.md`  
**Issue:** The example now includes `root_test_command_source`, `commandSource`, and `source`, which appear to describe overlapping provenance. This creates ambiguity about which field downstream consumers should trust.  
**Suggestion:** Keep one canonical field name for command provenance, or clearly document distinct meanings if all are required. Prefer matching the existing snake_case style, e.g. `command_source`.
**Rationale:** Loop review proposal.

### 25. 3. Normalize Responsibility Labels
**Failure mode:** refactor
**File:** src/flow/prompts/impl/test-execute.md
**Issue:** **File:** `src/flow/prompts/impl/test-execute.md`  
**Issue:** The responsibility labels mix compact enum-like names (`spec-local`, `targeted`, `explicit-full`) with a sentence-like label (`deferred final-regression`).  
**Suggestion:** Rename `deferred final-regression` to a consistent enum-style label such as `deferred-final-regression`, while keeping the description text unchanged.
**Suggestion:** **File:** `src/flow/prompts/impl/test-execute.md`  
**Issue:** The responsibility labels mix compact enum-like names (`spec-local`, `targeted`, `explicit-full`) with a sentence-like label (`deferred final-regression`).  
**Suggestion:** Rename `deferred final-regression` to a consistent enum-style label such as `deferred-final-regression`, while keeping the description text unchanged.
**Rationale:** Loop review proposal.

### 26. 1. Replace duplicated result pairing with an allowed-result check
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`  
**Issue:** The `completed` expression duplicates the same comparison pattern for `"pass"` and `"skipped"`, and the name `completed` is slightly misleading because it means “artifact and hook result match an accepted outcome,” not necessarily the artifact’s `completed` field.  
**Suggestion:** Use a small allowed-results set and a clearer variable name:

```js
const acceptedFinalRegressionResults = new Set(["pass", "skipped"]);
const hasAcceptedResult =
  artifact.result === result?.result && acceptedFinalRegressionResults.has(artifact.result);

if (!hasAcceptedResult) {
  throw new Error("final-regression result is not pass or skipped");
}
```
**Suggestion:** **File:** `src/flow/registry.js`  
**Issue:** The `completed` expression duplicates the same comparison pattern for `"pass"` and `"skipped"`, and the name `completed` is slightly misleading because it means “artifact and hook result match an accepted outcome,” not necessarily the artifact’s `completed` field.  
**Suggestion:** Use a small allowed-results set and a clearer variable name:

```js
const acceptedFinalRegressionResults = new Set(["pass", "skipped"]);
const hasAcceptedResult =
  artifact.result === result?.result && acceptedFinalRegressionResults.has(artifact.result);

if (!hasAcceptedResult) {
  throw new Error("final-regression result is not pass or skipped");
}
```
**Rationale:** Loop review proposal.

### 27. I’ll inspect the full schema around the changed conditionals so the suggestions account for existing patterns in the file, not just the snippet.The provided path is not present relative to the current worktree root. I’ll list the workspace to locate the checked-out repository layout before giving the review.### 1. Restrict `skipKind` to skipped results only
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/final-regression.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/final-regression.schema.json`  
**Issue:** `skipKind` is optional at the top level and only required when `result` is `"skipped"`, but the schema does not prevent it from appearing with `"pass"` or `"fail"`. That allows contradictory artifacts such as `{ "result": "pass", "skipKind": "risk_based_static_proof" }`.  
**Suggestion:** Add a conditional rule that disallows `skipKind` unless `result` is `"skipped"`, or add `not: { "required": ["skipKind"] }` to the pass/fail result branches if those branches already exist in this schema.
**Suggestion:** **File:** `src/flow/schemas/next-action/final-regression.schema.json`  
**Issue:** `skipKind` is optional at the top level and only required when `result` is `"skipped"`, but the schema does not prevent it from appearing with `"pass"` or `"fail"`. That allows contradictory artifacts such as `{ "result": "pass", "skipKind": "risk_based_static_proof" }`.  
**Suggestion:** Add a conditional rule that disallows `skipKind` unless `result` is `"skipped"`, or add `not: { "required": ["skipKind"] }` to the pass/fail result branches if those branches already exist in this schema.
**Rationale:** Loop review proposal.

### 28. 1. Preserve the Migration Scenario Under Test
**Failure mode:** refactor
**File:** tests/unit/upgrade-rename-migration.test.js
**Issue:** **File:** `tests/unit/upgrade-rename-migration.test.js`
**Issue:** The test now creates both dependency and project files with the already-migrated `senti` name/content, so `RenameMigration.run()` no longer has to rename or rewrite anything. That weakens the regression test for skipping nested `node_modules` while still migrating project files.
**Suggestion:** Keep the dependency fixture as the old `sdd-forge` path/content and create the project fixture with the old `sdd-forge` path/content, then assert only the project file was migrated to `senti` while the nested `node_modules` file remained unchanged.
**Suggestion:** **File:** `tests/unit/upgrade-rename-migration.test.js`
**Issue:** The test now creates both dependency and project files with the already-migrated `senti` name/content, so `RenameMigration.run()` no longer has to rename or rewrite anything. That weakens the regression test for skipping nested `node_modules` while still migrating project files.
**Suggestion:** Keep the dependency fixture as the old `sdd-forge` path/content and create the project fixture with the old `sdd-forge` path/content, then assert only the project file was migrated to `senti` while the nested `node_modules` file remained unchanged.
**Rationale:** Loop review proposal.

### 29. 1. Canonicalize command identity fields
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`
**Issue:** Command provenance is represented across files as `command`, `source`, `commandSource`, `root_test_command`, and `root_test_command_source`. The prompt example, identity builder, and regression artifact construction appear to overlap or overwrite these fields.
**Suggestion:** Define one canonical command identity contract in `test-regression.js`, then update `run-test-execute.js` and `prompts/impl/test-execute.md` to use only those fields. Document any legacy snake_case fields as derived compatibility fields.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`
**Issue:** Command provenance is represented across files as `command`, `source`, `commandSource`, `root_test_command`, and `root_test_command_source`. The prompt example, identity builder, and regression artifact construction appear to overlap or overwrite these fields.
**Suggestion:** Define one canonical command identity contract in `test-regression.js`, then update `run-test-execute.js` and `prompts/impl/test-execute.md` to use only those fields. Document any legacy snake_case fields as derived compatibility fields.
**Rationale:** Loop review proposal.

### 30. 2. Share final-regression accepted result semantics
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `"pass"` and `"skipped"` are treated as accepted final-regression outcomes in multiple places: judgment contract, registry completion logic, prompt wording, and schema conditionals. This creates several sources of truth.
**Suggestion:** Introduce a shared final-regression result helper or constant set, and align the schema/prompt wording with it. Ensure `skipKind` is valid only when `result === "skipped"`.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `"pass"` and `"skipped"` are treated as accepted final-regression outcomes in multiple places: judgment contract, registry completion logic, prompt wording, and schema conditionals. This creates several sources of truth.
**Suggestion:** Introduce a shared final-regression result helper or constant set, and align the schema/prompt wording with it. Ensure `skipKind` is valid only when `result === "skipped"`.
**Rationale:** Loop review proposal.

### 31. 3. Centralize changed-file fingerprint evidence
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Issue:** **File:** `src/flow/lib/test-regression.js`
**Issue:** Changed-file fingerprinting is introduced and consumed across `run-test-execute.js`, `run-final-regression.js`, `test-regression.js`, and artifact validation, but each file appears to shape or collect the evidence independently.
**Suggestion:** Add one helper that builds bounded changed-file evidence, including full and trigger-relevant subsets, then have both test-execute and final-regression flows consume that same object shape.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`
**Issue:** Changed-file fingerprinting is introduced and consumed across `run-test-execute.js`, `run-final-regression.js`, `test-regression.js`, and artifact validation, but each file appears to shape or collect the evidence independently.
**Suggestion:** Add one helper that builds bounded changed-file evidence, including full and trigger-relevant subsets, then have both test-execute and final-regression flows consume that same object shape.
**Rationale:** Loop review proposal.

### 32. 4. Apply one bounded-resource contract across implementation, validation, and prompts
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** Several files independently mention unbounded arrays or file reads: fingerprint collection, directory expansion, artifact arrays, prompt payload fields, and raw output lines. If limits are added piecemeal, the implementation may reject artifacts the prompt allows, or accept artifacts the runtime cannot safely produce.
**Suggestion:** Define shared constants for max files, bytes per file, array counts, argv/env/metadata sizes, and raw output capture. Use them in runtime helpers, artifact validators, JSON schema, and both prompt files.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Issue:** Several files independently mention unbounded arrays or file reads: fingerprint collection, directory expansion, artifact arrays, prompt payload fields, and raw output lines. If limits are added piecemeal, the implementation may reject artifacts the prompt allows, or accept artifacts the runtime cannot safely produce.
**Suggestion:** Define shared constants for max files, bytes per file, array counts, argv/env/metadata sizes, and raw output capture. Use them in runtime helpers, artifact validators, JSON schema, and both prompt files.
**Rationale:** Loop review proposal.

### 33. 5. Normalize final-regression skip terminology
**Failure mode:** refactor
**File:** src/flow/prompts/impl/final-regression.md
**Issue:** **File:** `src/flow/prompts/impl/final-regression.md`
**Issue:** Skip states are described across files as `skipped`, `skipKind`, `covered_by_test_execute_full_regression`, `risk_based_static_proof`, and “SKIPPED”. The result, skip kind, and proof kind boundaries are not consistently named across prompt, schema, validators, and artifact builders.
**Suggestion:** Treat `result` as `pass | fail | skipped`, `skipKind` as the specific skipped reason enum, and `proof.kind` as either identical to `skipKind` or removed. Update prompt, schema, validation, and artifact construction to match.
**Suggestion:** **File:** `src/flow/prompts/impl/final-regression.md`
**Issue:** Skip states are described across files as `skipped`, `skipKind`, `covered_by_test_execute_full_regression`, `risk_based_static_proof`, and “SKIPPED”. The result, skip kind, and proof kind boundaries are not consistently named across prompt, schema, validators, and artifact builders.
**Suggestion:** Treat `result` as `pass | fail | skipped`, `skipKind` as the specific skipped reason enum, and `proof.kind` as either identical to `skipKind` or removed. Update prompt, schema, validation, and artifact construction to match.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
