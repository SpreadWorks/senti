# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Remove empty no-op artifacts when there is nothing to repair
**Finding key:** loop-31ca1bd9ae714c1f47f5
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-coverage-repair.json
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-repair.json`
**Requirement:** R3
**Issue:** This file records only `"No draft triage items to repair."` with an empty `items` array. As a checked-in generated artifact, it adds maintenance noise without carrying actionable data.
**Suggestion:** Omit repair artifacts when `items` is empty, or consolidate no-op phase status into a single run summary file.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-repair.json`
**Requirement:** R3
**Issue:** This file records only `"No draft triage items to repair."` with an empty `items` array. As a checked-in generated artifact, it adds maintenance noise without carrying actionable data.
**Suggestion:** Omit repair artifacts when `items` is empty, or consolidate no-op phase status into a single run summary file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 4. Remove empty no-op artifacts when there is nothing to triage
**Finding key:** loop-a0b74a7b14469546c73f
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-coverage-triage.json
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-triage.json`
**Requirement:** R3
**Issue:** This file records only `"No draft review findings to triage."` with an empty `items` array, duplicating state already implied by `draft-review-coverage.json` passing with no findings.
**Suggestion:** Do not emit a separate triage file for empty input, or have the coverage review artifact own the no-findings status.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-triage.json`
**Requirement:** R3
**Issue:** This file records only `"No draft review findings to triage."` with an empty `items` array, duplicating state already implied by `draft-review-coverage.json` passing with no findings.
**Suggestion:** Do not emit a separate triage file for empty input, or have the coverage review artifact own the no-findings status.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Collapse duplicate guardrail records
**Finding key:** loop-3777e3b808d73eeb9382
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R1
**Issue:** The same `prioritize-requirements` failure is repeated multiple times with identical `findingId`, `fingerprint`, `reason`, `rationale`, and metadata, varying only by locator. The file also duplicates the same facts across both `evaluations` and `observations`, which makes the artifact noisy and easier to drift.
**Suggestion:** Represent repeated findings once, with a bounded `locations` or `observations` array for `$.decisionMap.deferredToSpec[0]`, `[1]`, and `[2]`. If both summary and detail sections are required, make one section canonical and derive the other instead of storing duplicated copies.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R1
**Issue:** The same `prioritize-requirements` failure is repeated multiple times with identical `findingId`, `fingerprint`, `reason`, `rationale`, and metadata, varying only by locator. The file also duplicates the same facts across both `evaluations` and `observations`, which makes the artifact noisy and easier to drift.
**Suggestion:** Represent repeated findings once, with a bounded `locations` or `observations` array for `$.decisionMap.deferredToSpec[0]`, `[1]`, and `[2]`. If both summary and detail sections are required, make one section canonical and derive the other instead of storing duplicated copies.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Make finding IDs location-aware or truly shared
**Finding key:** loop-1132635736853ad41b56
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R2
**Issue:** Multiple distinct locations share the same `findingId`/`fingerprint` for `prioritize-requirements`, while corresponding `observations` use a different repeated fingerprint for the same logical failures. This naming/identity model is ambiguous: consumers cannot tell whether these are one finding with many locations or separate findings.
**Suggestion:** Either generate one stable parent finding ID plus per-location child IDs, or make the fingerprint include the locator when each location is intended to be independently actionable.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R2
**Issue:** Multiple distinct locations share the same `findingId`/`fingerprint` for `prioritize-requirements`, while corresponding `observations` use a different repeated fingerprint for the same logical failures. This naming/identity model is ambiguous: consumers cannot tell whether these are one finding with many locations or separate findings.
**Suggestion:** Either generate one stable parent finding ID plus per-location child IDs, or make the fingerprint include the locator when each location is intended to be independently actionable.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 7. Add an explicit bound for repeated observations
**Finding key:** loop-96fc0ca3193257f49c9e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R4
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R4
**Issue:** The artifact stores repeated observations directly, but there is no visible cap on the number of evaluations, observations, refs, or repeated locations. This conflicts with the bounded-resource-usage guardrail for bulk data loading/output.
**Suggestion:** Add an explicit maximum for emitted evaluations/observations and repeated locations, plus truncation metadata such as `truncated: true` and `omittedCount` when the cap is reached.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R4
**Issue:** The artifact stores repeated observations directly, but there is no visible cap on the number of evaluations, observations, refs, or repeated locations. This conflicts with the bounded-resource-usage guardrail for bulk data loading/output.
**Suggestion:** Add an explicit maximum for emitted evaluations/observations and repeated locations, plus truncation metadata such as `truncated: true` and `omittedCount` when the cap is reached.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 5. Remove empty no-op artifacts for question repair
**Finding key:** loop-ff6b1cfbad35b9d0e936
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-questions-repair.json
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-questions-repair.json`
**Requirement:** R3
**Issue:** This file is structurally identical to the other empty repair artifact and contains no actionable entries.
**Suggestion:** Suppress empty repair output or merge empty phase completion records into one compact workflow status artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-questions-repair.json`
**Requirement:** R3
**Issue:** This file is structurally identical to the other empty repair artifact and contains no actionable entries.
**Suggestion:** Suppress empty repair output or merge empty phase completion records into one compact workflow status artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 6. Remove empty no-op artifacts for question triage
**Finding key:** loop-0d2f67034bb63db71bbf
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-questions-triage.json
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-questions-triage.json`
**Requirement:** R3
**Issue:** This file is another empty generated phase artifact with only metadata and a no-findings summary.
**Suggestion:** Avoid creating triage artifacts with empty `items`, or consolidate empty triage statuses to reduce duplicate generated files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-questions-triage.json`
**Requirement:** R3
**Issue:** This file is another empty generated phase artifact with only metadata and a no-findings summary.
**Suggestion:** Avoid creating triage artifacts with empty `items`, or consolidate empty triage statuses to reduce duplicate generated files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Add failure policy to saved hook snapshots
**Finding key:** loop-3a487f475e2e827b2571
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R2  
**Issue:** `plugins.flowCommandHooks` entries include `command`, `hook`, and `priority`, but no failure policy metadata. That conflicts with the draft’s stated design that saved snapshots carry failure policy and that missing metadata is rejected.  
**Suggestion:** Add an explicit `failurePolicy` field, for example `"failurePolicy": "required"` or `"advisory"`, to each saved flow command hook snapshot entry so this fixture reflects the new contract.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R2  
**Issue:** `plugins.flowCommandHooks` entries include `command`, `hook`, and `priority`, but no failure policy metadata. That conflicts with the draft’s stated design that saved snapshots carry failure policy and that missing metadata is rejected.  
**Suggestion:** Add an explicit `failurePolicy` field, for example `"failurePolicy": "required"` or `"advisory"`, to each saved flow command hook snapshot entry so this fixture reflects the new contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Remove stale “in_progress” state from generated flow artifact
**Finding key:** loop-50eedac4c509f0a3db72
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** The flow artifact records `impl-review` as `"status": "in_progress"` even though `impl-review.json` reports a PASS verdict and the surrounding task history has completed implementation review. This makes the artifact internally inconsistent and harder to reason about.  
**Suggestion:** Update the `impl-review` step status and timestamps to match the finalized review artifact, or regenerate `flow.json` from the current flow state.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** The flow artifact records `impl-review` as `"status": "in_progress"` even though `impl-review.json` reports a PASS verdict and the surrounding task history has completed implementation review. This makes the artifact internally inconsistent and harder to reason about.  
**Suggestion:** Update the `impl-review` step status and timestamps to match the finalized review artifact, or regenerate `flow.json` from the current flow state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Bound retained review history in flow state
**Finding key:** loop-6fcd182708e11875e4a5
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** `reviewConvergence.records[].evidenceHistory` and `metrics` retain many full historical entries in a single state file. Without an explicit retention cap, repeated review retries can grow this artifact without bound, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Store only the latest canonical evidence plus a bounded number of prior evidence references, or add an explicit max history count per phase/task and truncate older entries.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** `reviewConvergence.records[].evidenceHistory` and `metrics` retain many full historical entries in a single state file. Without an explicit retention cap, repeated review retries can grow this artifact without bound, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Store only the latest canonical evidence plus a bounded number of prior evidence references, or add an explicit max history count per phase/task and truncate older entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Reduce bilingual maintenance drift
**Finding key:** loop-e9d28dcbbfb5cf6c2128
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R1  
**Issue:** The English and Japanese sections duplicate the full Summary, Decision, Requirements, Scope, Acceptance Criteria, and Evidence. Any later edit can easily update one section but leave the other stale.  
**Suggestion:** Keep one canonical requirements section and make the localized section a concise translation summary, or explicitly mark one section as authoritative.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R1  
**Issue:** The English and Japanese sections duplicate the full Summary, Decision, Requirements, Scope, Acceptance Criteria, and Evidence. Any later edit can easily update one section but leave the other stale.  
**Suggestion:** Keep one canonical requirements section and make the localized section a concise translation summary, or explicitly mark one section as authoritative.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Avoid duplicated issue number state
**Finding key:** loop-4537f9ae5f578c5bfc0d
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The issue number appears twice as `issue` and `result.issueNumber`, creating a small but avoidable drift risk.  
**Suggestion:** Store the issue number in one place if the artifact schema allows it. If both fields are required by consumers, add a short schema/fixture convention elsewhere in this file’s context so mismatches are intentionally validated.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The issue number appears twice as `issue` and `result.issueNumber`, creating a small but avoidable drift risk.  
**Suggestion:** Store the issue number in one place if the artifact schema allows it. If both fields are required by consumers, add a short schema/fixture convention elsewhere in this file’s context so mismatches are intentionally validated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Pretty-print review evidence for maintainability
**Finding key:** loop-3d1909fa59c372bdb7cd
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/036d163f4fe3867ff2f740d04af93688221f2df0815c62211f70310d41b3b834.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/036d163f4fe3867ff2f740d04af93688221f2df0815c62211f70310d41b3b834.json`  
**Requirement:** R1  
**Issue:** The JSON is minified onto one line, which makes future review diffs noisy and hides structural changes.  
**Suggestion:** Format the evidence JSON with stable indentation so changes to findings, provenance, or disposition are easy to inspect.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/036d163f4fe3867ff2f740d04af93688221f2df0815c62211f70310d41b3b834.json`  
**Requirement:** R1  
**Issue:** The JSON is minified onto one line, which makes future review diffs noisy and hides structural changes.  
**Suggestion:** Format the evidence JSON with stable indentation so changes to findings, provenance, or disposition are easy to inspect.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Format review evidence JSON for maintainability
**Finding key:** loop-b7b1f87efa2e17e106ec
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/def3a5a0e158ad9dca2d9d95a9f1cef30394d77a082c2c6eb29c08b05862cf02.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/def3a5a0e158ad9dca2d9d95a9f1cef30394d77a082c2c6eb29c08b05862cf02.json`  
**Requirement:** R8  
**Issue:** The evidence file is committed as one long JSON line. This makes diffs hard to review, especially because this file contains multiple `blockingFindings` entries with repeated fields.  
**Suggestion:** Pretty-print the JSON with stable indentation and key ordering, matching whatever format the evidence writer expects. Apply the same formatting convention to the other touched evidence JSON files if these artifacts are meant to be human-reviewed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/def3a5a0e158ad9dca2d9d95a9f1cef30394d77a082c2c6eb29c08b05862cf02.json`  
**Requirement:** R8  
**Issue:** The evidence file is committed as one long JSON line. This makes diffs hard to review, especially because this file contains multiple `blockingFindings` entries with repeated fields.  
**Suggestion:** Pretty-print the JSON with stable indentation and key ordering, matching whatever format the evidence writer expects. Apply the same formatting convention to the other touched evidence JSON files if these artifacts are meant to be human-reviewed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Avoid storing duplicate finding identifiers in each finding object
**Finding key:** loop-43fb69d4c37cbf73d311
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/aa4851fa86fa626464307114c39827de4e9d5b656f731b5777daf7fc5b7bcdad.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/aa4851fa86fa626464307114c39827de4e9d5b656f731b5777daf7fc5b7bcdad.json`  
**Requirement:** R8  
**Issue:** Each finding repeats the same hash in both `findingId` and `fingerprint`. If these values are always identical, the data model is carrying duplicate state and creates room for accidental divergence.  
**Suggestion:** Keep only one canonical identifier field, or document and enforce the distinction if `findingId` and `fingerprint` are intended to differ in future evidence records.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/aa4851fa86fa626464307114c39827de4e9d5b656f731b5777daf7fc5b7bcdad.json`  
**Requirement:** R8  
**Issue:** Each finding repeats the same hash in both `findingId` and `fingerprint`. If these values are always identical, the data model is carrying duplicate state and creates room for accidental divergence.  
**Suggestion:** Keep only one canonical identifier field, or document and enforce the distinction if `findingId` and `fingerprint` are intended to differ in future evidence records.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Normalize empty and rejected evidence records through a shared schema convention
**Finding key:** loop-e695ee3e724209ee7a62
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/ae23ca386f66bb1fa90461750ebb58ceb474df680e778361618f06b5adcc2e1e.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/ae23ca386f66bb1fa90461750ebb58ceb474df680e778361618f06b5adcc2e1e.json`  
**Requirement:** R8  
**Issue:** PASS records and REJECTED records duplicate the same envelope fields: `advisoryFindings`, `blockingFindings`, `disposition`, `phase`, `provenance`, `taskId`, `treeSha`, and `version`. If these are generated artifacts, inconsistent manual edits would be difficult to detect.  
**Suggestion:** Ensure these files are produced from a single evidence serializer/schema and consider adding a schema validation step so empty PASS records and populated rejection records stay structurally consistent.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/ae23ca386f66bb1fa90461750ebb58ceb474df680e778361618f06b5adcc2e1e.json`  
**Requirement:** R8  
**Issue:** PASS records and REJECTED records duplicate the same envelope fields: `advisoryFindings`, `blockingFindings`, `disposition`, `phase`, `provenance`, `taskId`, `treeSha`, and `version`. If these are generated artifacts, inconsistent manual edits would be difficult to detect.  
**Suggestion:** Ensure these files are produced from a single evidence serializer/schema and consider adding a schema validation step so empty PASS records and populated rejection records stay structurally consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Normalize Review History Record Shape
**Finding key:** loop-a247307f8e530bec019c
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/draft-coverage-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/draft-coverage-attempt-001.json`  
**Requirement:** R8  
**Issue:** `draft-coverage-attempt-001.json` and `draft-questions-attempt-001.json` duplicate the same PASS record structure, differing only in phase, timestamps, and source artifact fields. This makes review history noisy and increases churn when generated schemas evolve.  
**Suggestion:** Have the generator emit these through a shared review-history serialization path so empty PASS attempts use one canonical schema/order and shared default values.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/draft-coverage-attempt-001.json`  
**Requirement:** R8  
**Issue:** `draft-coverage-attempt-001.json` and `draft-questions-attempt-001.json` duplicate the same PASS record structure, differing only in phase, timestamps, and source artifact fields. This makes review history noisy and increases churn when generated schemas evolve.  
**Suggestion:** Have the generator emit these through a shared review-history serialization path so empty PASS attempts use one canonical schema/order and shared default values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Avoid Duplicating Finding Bodies In The Same Artifact
**Finding key:** loop-3bcf07da910f0997f613
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once under `blockingFindings` with detailed fields, and again under `findings` with mostly the same title/body/fingerprint/disposition/rationale/requirement data. This creates duplicate persisted content that can drift inside the same artifact.  
**Suggestion:** Store the canonical finding payload once and make severity-specific groupings reference finding IDs, or derive `blockingFindings` from `findings` at read time.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once under `blockingFindings` with detailed fields, and again under `findings` with mostly the same title/body/fingerprint/disposition/rationale/requirement data. This creates duplicate persisted content that can drift inside the same artifact.  
**Suggestion:** Store the canonical finding payload once and make severity-specific groupings reference finding IDs, or derive `blockingFindings` from `findings` at read time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Use Consistent Finding Field Names
**Finding key:** loop-021c74c39fa3f3d122d0
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`  
**Requirement:** R8  
**Issue:** The same concept is named `issue` in `blockingFindings` but `body` in `findings`, and `failureMode` maps to `category`. The duplicate naming makes downstream consumers more complex.  
**Suggestion:** Standardize on one vocabulary across both sections, preferably the generic `body` and `category` names, or remove one section as suggested above.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`  
**Requirement:** R8  
**Issue:** The same concept is named `issue` in `blockingFindings` but `body` in `findings`, and `failureMode` maps to `category`. The duplicate naming makes downstream consumers more complex.  
**Suggestion:** Standardize on one vocabulary across both sections, preferably the generic `body` and `category` names, or remove one section as suggested above.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 4. Pretty-Print Evidence JSON For Reviewability
**Finding key:** loop-47b1f21dd2b06b9cb956
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/ecebc467db456197cc023436f49d152e36b2189ebe4cbbba9b0aaec630c45091.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/ecebc467db456197cc023436f49d152e36b2189ebe4cbbba9b0aaec630c45091.json`  
**Requirement:** R8  
**Issue:** The evidence artifacts are stored as single-line JSON despite containing multiple findings. That makes diffs hard to review and obscures changes to individual findings.  
**Suggestion:** Emit review-evidence JSON with stable pretty formatting, matching the `review-history/*.json` files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/ecebc467db456197cc023436f49d152e36b2189ebe4cbbba9b0aaec630c45091.json`  
**Requirement:** R8  
**Issue:** The evidence artifacts are stored as single-line JSON despite containing multiple findings. That makes diffs hard to review and obscures changes to individual findings.  
**Suggestion:** Emit review-evidence JSON with stable pretty formatting, matching the `review-history/*.json` files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 5. Consider Omitting Empty Arrays From Minimal Evidence Records
**Finding key:** loop-5a1d20105d76ccc9a6f5
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/e75df2ff70a90ae84461d13f807c124efe16415a55e5923f31099fb7356abca6.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/e75df2ff70a90ae84461d13f807c124efe16415a55e5923f31099fb7356abca6.json`  
**Requirement:** R8  
**Issue:** PASS evidence records persist both `advisoryFindings: []` and `blockingFindings: []`, which repeats empty state and adds noise to otherwise minimal records.  
**Suggestion:** If consumers can distinguish absence from empty arrays, omit empty finding collections for PASS records or use a compact shared PASS evidence shape.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/e75df2ff70a90ae84461d13f807c124efe16415a55e5923f31099fb7356abca6.json`  
**Requirement:** R8  
**Issue:** PASS evidence records persist both `advisoryFindings: []` and `blockingFindings: []`, which repeats empty state and adds noise to otherwise minimal records.  
**Suggestion:** If consumers can distinguish absence from empty arrays, omit empty finding collections for PASS records or use a compact shared PASS evidence shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Remove Duplicated Human/JSON Review Records
**Finding key:** loop-ddc0e37fa6271671095c
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-002.md
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-002.md`  
**Requirement:** R2  
**Issue:** The Markdown file duplicates the same finding data already captured structurally in `impl-attempt-002.json`, including verdict, file, requirement, issue, suggestion, disposition, and rationale. Keeping both manually comparable representations increases drift risk without adding new information.  
**Suggestion:** Prefer one canonical artifact format for review history. If both formats are required by tooling, generate the Markdown from the JSON artifact rather than storing independently authored duplicate content.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-002.md`  
**Requirement:** R2  
**Issue:** The Markdown file duplicates the same finding data already captured structurally in `impl-attempt-002.json`, including verdict, file, requirement, issue, suggestion, disposition, and rationale. Keeping both manually comparable representations increases drift risk without adding new information.  
**Suggestion:** Prefer one canonical artifact format for review history. If both formats are required by tooling, generate the Markdown from the JSON artifact rather than storing independently authored duplicate content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Normalize Repeated “No Findings” Review Text
**Finding key:** loop-32de2d44c400b94398f6
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-003.md
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-003.md`  
**Requirement:** R3  
**Issue:** The PASS Markdown artifact repeats boilerplate sections such as “No blocking findings,” “No non-blocking improvements,” and excluded counts that are already represented in `impl-attempt-003.json`. This creates low-value duplicated text across successful attempts.  
**Suggestion:** Replace repeated PASS Markdown bodies with a compact generated summary, or rely on the JSON artifact as the source of truth and generate this view only when needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-003.md`  
**Requirement:** R3  
**Issue:** The PASS Markdown artifact repeats boilerplate sections such as “No blocking findings,” “No non-blocking improvements,” and excluded counts that are already represented in `impl-attempt-003.json`. This creates low-value duplicated text across successful attempts.  
**Suggestion:** Replace repeated PASS Markdown bodies with a compact generated summary, or rely on the JSON artifact as the source of truth and generate this view only when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Avoid Redundant Finding Identifiers
**Finding key:** loop-4cd313b10d800152d2d6
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-004.json
**Requirement:** R4
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-004.json`  
**Requirement:** R4  
**Issue:** Each finding stores both `id` and `findingId` with identical values, and top-level findings also duplicate `findingId` and `fingerprint` with the same hash. This makes the schema noisier and increases the chance that future records contain inconsistent aliases.  
**Suggestion:** Keep a single canonical identifier field per finding, or clearly separate semantic meanings if both are required. If compatibility requires both, populate one from the other during artifact generation instead of treating both as independent persisted fields.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-004.json`  
**Requirement:** R4  
**Issue:** Each finding stores both `id` and `findingId` with identical values, and top-level findings also duplicate `findingId` and `fingerprint` with the same hash. This makes the schema noisier and increases the chance that future records contain inconsistent aliases.  
**Suggestion:** Keep a single canonical identifier field per finding, or clearly separate semantic meanings if both are required. If compatibility requires both, populate one from the other during artifact generation instead of treating both as independent persisted fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Normalize Repeated “No Findings” Review Text
**Finding key:** loop-f8f75fa68bcc68924140
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R3  
**Issue:** The PASS Markdown artifact repeats boilerplate sections such as “No blocking findings,” “No non-blocking improvements,” and excluded counts that are already represented in `impl-attempt-003.json`. This creates low-value duplicated text across successful attempts.  
**Suggestion:** Replace repeated PASS Markdown bodies with a compact generated summary, or rely on the JSON artifact as the source of truth and generate this view only when needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R3  
**Issue:** The PASS Markdown artifact repeats boilerplate sections such as “No blocking findings,” “No non-blocking improvements,” and excluded counts that are already represented in `impl-attempt-003.json`. This creates low-value duplicated text across successful attempts.  
**Suggestion:** Replace repeated PASS Markdown bodies with a compact generated summary, or rely on the JSON artifact as the source of truth and generate this view only when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Normalize Repeated “No Findings” Review Text
**Finding key:** loop-5dc1986143722ef7ea0e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review.md
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/review.md`  
**Requirement:** R3  
**Issue:** The PASS Markdown artifact repeats boilerplate sections such as “No blocking findings,” “No non-blocking improvements,” and excluded counts that are already represented in `impl-attempt-003.json`. This creates low-value duplicated text across successful attempts.  
**Suggestion:** Replace repeated PASS Markdown bodies with a compact generated summary, or rely on the JSON artifact as the source of truth and generate this view only when needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review.md`  
**Requirement:** R3  
**Issue:** The PASS Markdown artifact repeats boilerplate sections such as “No blocking findings,” “No non-blocking improvements,” and excluded counts that are already represented in `impl-attempt-003.json`. This creates low-value duplicated text across successful attempts.  
**Suggestion:** Replace repeated PASS Markdown bodies with a compact generated summary, or rely on the JSON artifact as the source of truth and generate this view only when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Remove duplicated finding bodies from JSON history
**Finding key:** loop-5ac8094acf5c651cd789
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-005.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-005.json`  
**Requirement:** R8  
**Issue:** Each finding is duplicated in both `blockingFindings` and `findings` with mostly the same title, issue/body, category, rationale, requirement, fingerprint, and repeat count. This makes the artifact larger and creates drift risk if one copy is edited or generated differently.  
**Suggestion:** Store canonical finding records once, then derive summary/grouped views at render time, or make one section contain only references such as finding IDs.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-005.json`  
**Requirement:** R8  
**Issue:** Each finding is duplicated in both `blockingFindings` and `findings` with mostly the same title, issue/body, category, rationale, requirement, fingerprint, and repeat count. This makes the artifact larger and creates drift risk if one copy is edited or generated differently.  
**Suggestion:** Store canonical finding records once, then derive summary/grouped views at render time, or make one section contain only references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Remove duplicated finding bodies from JSON history
**Finding key:** loop-c93e8fb8696fd38ae751
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-006.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-006.json`  
**Requirement:** R8  
**Issue:** The single finding is repeated in both `blockingFindings` and `findings`, using different field names for the same concepts (`issue` vs `body`, `failureMode` vs `category`).  
**Suggestion:** Normalize to one canonical finding representation and derive either the blocking list or the flat list from it.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-006.json`  
**Requirement:** R8  
**Issue:** The single finding is repeated in both `blockingFindings` and `findings`, using different field names for the same concepts (`issue` vs `body`, `failureMode` vs `category`).  
**Suggestion:** Normalize to one canonical finding representation and derive either the blocking list or the flat list from it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Remove duplicated finding bodies from JSON history
**Finding key:** loop-6c36276e979ce16118e5
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-007.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-007.json`  
**Requirement:** R8  
**Issue:** The two findings are duplicated across `blockingFindings` and `findings`, increasing maintenance cost and making future comparisons noisier.  
**Suggestion:** Keep a single findings array with severity/category fields, and compute blocking/non-blocking groupings from that data when needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-007.json`  
**Requirement:** R8  
**Issue:** The two findings are duplicated across `blockingFindings` and `findings`, increasing maintenance cost and making future comparisons noisier.  
**Suggestion:** Keep a single findings array with severity/category fields, and compute blocking/non-blocking groupings from that data when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Use one generated format per attempt
**Finding key:** loop-d5cb953894cab705fea6
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-005.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-005.md`  
**Requirement:** R8  
**Issue:** The markdown file repeats the same substantive review data already stored in `impl-attempt-005.json`. Keeping both full-text artifacts creates duplicate source-of-truth problems.  
**Suggestion:** Treat JSON as canonical and generate markdown views on demand, or store the markdown as a lightweight pointer/summary instead of duplicating every finding field.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-005.md`  
**Requirement:** R8  
**Issue:** The markdown file repeats the same substantive review data already stored in `impl-attempt-005.json`. Keeping both full-text artifacts creates duplicate source-of-truth problems.  
**Suggestion:** Treat JSON as canonical and generate markdown views on demand, or store the markdown as a lightweight pointer/summary instead of duplicating every finding field.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Avoid duplicated finding payload in review JSON
**Finding key:** loop-55c497130a8eb0ab5cb6
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-008.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-008.json`  
**Requirement:** R8  
**Issue:** The same finding content is duplicated in both `blockingFindings[0]` and `findings[0]`, including title, issue/body, rationale, fingerprint, disposition, requirement, and repeat count. This creates two sources of truth inside one artifact.  
**Suggestion:** Keep one canonical finding representation and derive the grouped view from it, or reduce one section to IDs/references if the schema permits.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-008.json`  
**Requirement:** R8  
**Issue:** The same finding content is duplicated in both `blockingFindings[0]` and `findings[0]`, including title, issue/body, rationale, fingerprint, disposition, requirement, and repeat count. This creates two sources of truth inside one artifact.  
**Suggestion:** Keep one canonical finding representation and derive the grouped view from it, or reduce one section to IDs/references if the schema permits.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Add final newline
**Finding key:** loop-9549584c959e5af00164
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/spec-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-001.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-001.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Add final newline
**Finding key:** loop-e993f4dfb59d4a5a9882
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/spec-attempt-002.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-002.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-002.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Add final newline
**Finding key:** loop-b205fb1d9080357d844f
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec-review.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec-review.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Remove duplicated finding payloads
**Finding key:** loop-b97c0a7b1e36685aadbd
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.json`
**Requirement:** R8
**Issue:** Each finding is stored twice: once in `blockingFindings` with detailed fields and again in `findings` with nearly the same `id`, `findingId`, `title`, `body/issue`, `fingerprint`, `disposition`, and `rationale`. This creates drift risk and makes review history unnecessarily bulky.
**Suggestion:** Keep one canonical findings array and derive grouped views like `blockingFindings` from `severity`/`kind`, or reduce `blockingFindings` to references by `findingId`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.json`
**Requirement:** R8
**Issue:** Each finding is stored twice: once in `blockingFindings` with detailed fields and again in `findings` with nearly the same `id`, `findingId`, `title`, `body/issue`, `fingerprint`, `disposition`, and `rationale`. This creates drift risk and makes review history unnecessarily bulky.
**Suggestion:** Keep one canonical findings array and derive grouped views like `blockingFindings` from `severity`/`kind`, or reduce `blockingFindings` to references by `findingId`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Remove duplicated finding payloads
**Finding key:** loop-f6e416ae7dc1fa9a83cf
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-002.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The file repeats the same finding data in both `blockingFindings` and `findings`, with only minor shape differences. This duplicates maintenance and serialization logic.
**Suggestion:** Store findings once in a normalized schema. If consumers need both shapes, generate one from the other at read/render time.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The file repeats the same finding data in both `blockingFindings` and `findings`, with only minor shape differences. This duplicates maintenance and serialization logic.
**Suggestion:** Store findings once in a normalized schema. If consumers need both shapes, generate one from the other at read/render time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Avoid committing derived Markdown alongside JSON
**Finding key:** loop-ed05070cf71082ad2739
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown report duplicates the same review content already present in `test-attempt-001.json`. Keeping both committed increases the chance of stale or inconsistent history artifacts.
**Suggestion:** Treat Markdown as a rendered view generated from JSON, or keep only the Markdown if it is the canonical human-readable artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown report duplicates the same review content already present in `test-attempt-001.json`. Keeping both committed increases the chance of stale or inconsistent history artifacts.
**Suggestion:** Treat Markdown as a rendered view generated from JSON, or keep only the Markdown if it is the canonical human-readable artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Avoid committing derived Markdown alongside JSON
**Finding key:** loop-cdebec194086d2060c3a
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-002.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.md`
**Requirement:** R8
**Issue:** This duplicates `test-attempt-002.json` almost verbatim in another format.
**Suggestion:** Keep a single source of truth and render the alternate format on demand.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.md`
**Requirement:** R8
**Issue:** This duplicates `test-attempt-002.json` almost verbatim in another format.
**Suggestion:** Keep a single source of truth and render the alternate format on demand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Add explicit history retention bounds
**Finding key:** loop-2c5bb86ab72253e9131a
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-003.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.json`
**Requirement:** R8
**Issue:** The change adds per-attempt review-history artifacts, but the format does not show an explicit retention/count/size bound. Over time, repeated attempts can grow this directory without limit, which violates the bounded-resource-usage guardrail.
**Suggestion:** Add or enforce a retention policy for review-history artifacts, such as keeping the latest N attempts per phase or compacting older attempts into a bounded summary.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.json`
**Requirement:** R8
**Issue:** The change adds per-attempt review-history artifacts, but the format does not show an explicit retention/count/size bound. Over time, repeated attempts can grow this directory without limit, which violates the bounded-resource-usage guardrail.
**Suggestion:** Add or enforce a retention policy for review-history artifacts, such as keeping the latest N attempts per phase or compacting older attempts into a bounded summary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Add Missing Final Newline
**Finding key:** loop-508994952e36dd06c562
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-003.md
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Add Missing Final Newline
**Finding key:** loop-5ea248c415bad858bee3
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-004.md
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-004.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, repeating the same formatting issue as the other review-history markdown artifacts.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-004.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, repeating the same formatting issue as the other review-history markdown artifacts.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Add Missing Final Newline
**Finding key:** loop-08aebc949de1ae4da64c
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-005.md
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-005.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which makes the generated review-history artifacts less consistent.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-005.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which makes the generated review-history artifacts less consistent.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Deduplicate repeated evidence fields
**Finding key:** loop-9cbb310524519011d6eb
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/scenario-validity-result.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/scenario-validity-result.json`
**Requirement:** R8
**Issue:** Each `summary[].evidence` repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to maintain if any shared evidence value changes.
**Suggestion:** Move shared execution evidence to a top-level object, such as `evidenceContext`, and keep each requirement entry limited to requirement-specific fields like `id`, `classification`, and `test_name`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/scenario-validity-result.json`
**Requirement:** R8
**Issue:** Each `summary[].evidence` repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to maintain if any shared evidence value changes.
**Suggestion:** Move shared execution evidence to a top-level object, such as `evidenceContext`, and keep each requirement entry limited to requirement-specific fields like `id`, `classification`, and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 2. Normalize generated attempt artifacts
**Finding key:** loop-59f844f80580ca8deeed
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-008.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-008.json`
**Requirement:** R8
**Issue:** The same advisory finding content is duplicated across `advisoryFindings[]` and `findings[]` with slightly different field names (`improvement` vs `body`, `kind` vs `severity`). This increases drift risk between two representations of the same finding.
**Suggestion:** Store the finding once as the canonical record and derive phase-specific views from it, or make one section reference the canonical finding by `findingId` instead of repeating the full text.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-008.json`
**Requirement:** R8
**Issue:** The same advisory finding content is duplicated across `advisoryFindings[]` and `findings[]` with slightly different field names (`improvement` vs `body`, `kind` vs `severity`). This increases drift risk between two representations of the same finding.
**Suggestion:** Store the finding once as the canonical record and derive phase-specific views from it, or make one section reference the canonical finding by `findingId` instead of repeating the full text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 1. Deduplicate repeated evidence fields
**Finding key:** loop-5bb695879548dfa22050
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-007.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.md`
**Requirement:** R8
**Issue:** Each `summary[].evidence` repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to maintain if any shared evidence value changes.
**Suggestion:** Move shared execution evidence to a top-level object, such as `evidenceContext`, and keep each requirement entry limited to requirement-specific fields like `id`, `classification`, and `test_name`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.md`
**Requirement:** R8
**Issue:** Each `summary[].evidence` repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to maintain if any shared evidence value changes.
**Suggestion:** Move shared execution evidence to a top-level object, such as `evidenceContext`, and keep each requirement entry limited to requirement-specific fields like `id`, `classification`, and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 2. Normalize generated attempt artifacts
**Finding key:** loop-3f9e7927f434e5be4d55
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-007.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.md`
**Requirement:** R8
**Issue:** The same advisory finding content is duplicated across `advisoryFindings[]` and `findings[]` with slightly different field names (`improvement` vs `body`, `kind` vs `severity`). This increases drift risk between two representations of the same finding.
**Suggestion:** Store the finding once as the canonical record and derive phase-specific views from it, or make one section reference the canonical finding by `findingId` instead of repeating the full text.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.md`
**Requirement:** R8
**Issue:** The same advisory finding content is duplicated across `advisoryFindings[]` and `findings[]` with slightly different field names (`improvement` vs `body`, `kind` vs `severity`). This increases drift risk between two representations of the same finding.
**Suggestion:** Store the finding once as the canonical record and derive phase-specific views from it, or make one section reference the canonical finding by `findingId` instead of repeating the full text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 1. Deduplicate repeated evidence fields
**Finding key:** loop-8acbc34eb535d567bf7b
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.md`
**Requirement:** R8
**Issue:** Each `summary[].evidence` repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to maintain if any shared evidence value changes.
**Suggestion:** Move shared execution evidence to a top-level object, such as `evidenceContext`, and keep each requirement entry limited to requirement-specific fields like `id`, `classification`, and `test_name`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.md`
**Requirement:** R8
**Issue:** Each `summary[].evidence` repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to maintain if any shared evidence value changes.
**Suggestion:** Move shared execution evidence to a top-level object, such as `evidenceContext`, and keep each requirement entry limited to requirement-specific fields like `id`, `classification`, and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 2. Normalize generated attempt artifacts
**Finding key:** loop-7aadc12027c1de3efeae
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.md`
**Requirement:** R8
**Issue:** The same advisory finding content is duplicated across `advisoryFindings[]` and `findings[]` with slightly different field names (`improvement` vs `body`, `kind` vs `severity`). This increases drift risk between two representations of the same finding.
**Suggestion:** Store the finding once as the canonical record and derive phase-specific views from it, or make one section reference the canonical finding by `findingId` instead of repeating the full text.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.md`
**Requirement:** R8
**Issue:** The same advisory finding content is duplicated across `advisoryFindings[]` and `findings[]` with slightly different field names (`improvement` vs `body`, `kind` vs `severity`). This increases drift risk between two representations of the same finding.
**Suggestion:** Store the finding once as the canonical record and derive phase-specific views from it, or make one section reference the canonical finding by `findingId` instead of repeating the full text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 1. Remove Duplicated Overview Statements
**Finding key:** loop-bebb0fad59c7c8c84695
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.json`  
**Requirement:** R2  
**Issue:** The `overview.modules`, `overview.data_flow`, and `overview.decisions` sections repeat the same concepts in both original and `added_by_task` entries, making the spec harder to maintain and increasing drift risk between duplicated statements.  
**Suggestion:** Consolidate the repeated lifecycle ownership, policy enforcement, and finalize-cleanup warning-scan removal statements into single canonical entries.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.json`  
**Requirement:** R2  
**Issue:** The `overview.modules`, `overview.data_flow`, and `overview.decisions` sections repeat the same concepts in both original and `added_by_task` entries, making the spec harder to maintain and increasing drift risk between duplicated statements.  
**Suggestion:** Consolidate the repeated lifecycle ownership, policy enforcement, and finalize-cleanup warning-scan removal statements into single canonical entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 2. Remove Empty Placeholder Sections
**Finding key:** loop-2edd4ff0ae7593cb627e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** `## Clarifications (Q&A)` contains empty `Q:` / `A:` placeholders, and `## Open Questions` contains an empty checklist item. These are dead documentation artifacts with no useful information.  
**Suggestion:** Omit these sections when there are no clarifications or open questions, or render them as explicit empty-state text only if the renderer requires the headings.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** `## Clarifications (Q&A)` contains empty `Q:` / `A:` placeholders, and `## Open Questions` contains an empty checklist item. These are dead documentation artifacts with no useful information.  
**Suggestion:** Omit these sections when there are no clarifications or open questions, or render them as explicit empty-state text only if the renderer requires the headings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 3. Deduplicate Gate Failure Records
**Finding key:** loop-b46f5075843712ed4228
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/task-impl-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R7  
**Issue:** The same no-overengineering finding appears twice under `evaluations` and again twice under `observations`, with nearly identical rationale and the same underlying fingerprint. This duplicates review signal and can cause downstream consumers to overcount one issue.  
**Suggestion:** Store one canonical finding per unique fingerprint, or make `evaluations` reference the corresponding observation by ID instead of embedding duplicate full records.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R7  
**Issue:** The same no-overengineering finding appears twice under `evaluations` and again twice under `observations`, with nearly identical rationale and the same underlying fingerprint. This duplicates review signal and can cause downstream consumers to overcount one issue.  
**Suggestion:** Store one canonical finding per unique fingerprint, or make `evaluations` reference the corresponding observation by ID instead of embedding duplicate full records.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 4. Avoid Repeating Task Details Across Spec Formats
**Finding key:** loop-49721e4177ccb69e4d52
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** The task summaries in `## Tasks` duplicate the task source files and `spec.json.tasks[]`. That is acceptable for generated output, but the repeated “see tasks/T-N.md for full spec” plus copied goal text creates another drift surface if manual edits ever occur.  
**Suggestion:** Render either concise task links only, or make the task section clearly derived from `spec.json.tasks[]` without duplicating descriptive text already present in the task files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** The task summaries in `## Tasks` duplicate the task source files and `spec.json.tasks[]`. That is acceptable for generated output, but the repeated “see tasks/T-N.md for full spec” plus copied goal text creates another drift surface if manual edits ever occur.  
**Suggestion:** Render either concise task links only, or make the task section clearly derived from `spec.json.tasks[]` without duplicating descriptive text already present in the task files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 1. Remove Committed Raw Test Log
**Finding key:** loop-287b7ce802ad6b4bdb6e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/.raw/scenario-validity.log
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/.raw/scenario-validity.log`
**Requirement:** R8
**Issue:** This 6,246-line raw failure log is generated evidence, not maintainable source. It duplicates information already summarized by `test-review.json` and makes reviews noisy.
**Suggestion:** Remove the raw log from the change set, or replace it with a bounded summary artifact if the spec workflow requires evidence to be checked in.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/.raw/scenario-validity.log`
**Requirement:** R8
**Issue:** This 6,246-line raw failure log is generated evidence, not maintainable source. It duplicates information already summarized by `test-review.json` and makes reviews noisy.
**Suggestion:** Remove the raw log from the change set, or replace it with a bounded summary artifact if the spec workflow requires evidence to be checked in.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 2. Deduplicate Finalize Hook Fixture Creation
**Finding key:** loop-f1e1045a711f442ae468
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R6
**Issue:** The finalize hook module and snapshot setup are repeated across multiple tests with only class name, body, and root path changing.
**Suggestion:** Add a helper such as `writeFinalizeHook(projectRoot, { className, body })` that writes `hooks/finalize.js` and returns the matching `flowCommandHooks` snapshot entry.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R6
**Issue:** The finalize hook module and snapshot setup are repeated across multiple tests with only class name, body, and root path changing.
**Suggestion:** Add a helper such as `writeFinalizeHook(projectRoot, { className, body })` that writes `hooks/finalize.js` and returns the matching `flowCommandHooks` snapshot entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 3. Use Cleanup For mkdtemp Test Directories
**Finding key:** loop-3bfa188d21806a50a008
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R8
**Issue:** Several tests use `fs.mkdtempSync(path.join(os.tmpdir(), ...))` without cleanup, while later tests use `createTmpDir` with `removeTmpDir`.
**Suggestion:** Standardize on `createTmpDir` plus `try/finally removeTmpDir`, or use `t.after()` cleanup, so repeated test runs do not leave plugin fixture repositories behind.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R8
**Issue:** Several tests use `fs.mkdtempSync(path.join(os.tmpdir(), ...))` without cleanup, while later tests use `createTmpDir` with `removeTmpDir`.
**Suggestion:** Standardize on `createTmpDir` plus `try/finally removeTmpDir`, or use `t.after()` cleanup, so repeated test runs do not leave plugin fixture repositories behind.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 4. Rename Compose Helper To Reflect Semantics
**Finding key:** loop-3b1f5d87b0a728ecd427
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R7
**Issue:** `composeFinalizePluginLifecycle(pre, post)` sounds like generic composition, but it specifically merges pre/post hook runner results and selects the effective outcome.
**Suggestion:** Rename it to `mergeFinalizeHookResults` or `buildFinalizePluginLifecycleResult` to make the data-shaping responsibility clearer.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R7
**Issue:** `composeFinalizePluginLifecycle(pre, post)` sounds like generic composition, but it specifically merges pre/post hook runner results and selects the effective outcome.
**Suggestion:** Rename it to `mergeFinalizeHookResults` or `buildFinalizePluginLifecycleResult` to make the data-shaping responsibility clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 5. Deduplicate Post Hook Execution
**Finding key:** loop-3f836ff8a662a5c63242
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R7
**Issue:** Spec-only completion and transactional teardown both manually call `runFlowCommandHooks` for the `post` hook and then apply the same merge/failure handling pattern.
**Suggestion:** Extract a helper such as `runFinalizePostHooks(pluginContext, state, result)` and reuse it in both paths. Keep path-specific rollback behavior at the call site.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R7
**Issue:** Spec-only completion and transactional teardown both manually call `runFlowCommandHooks` for the `post` hook and then apply the same merge/failure handling pattern.
**Suggestion:** Extract a helper such as `runFinalizePostHooks(pluginContext, state, result)` and reuse it in both paths. Keep path-specific rollback behavior at the call site.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 6. Avoid Unbounded Cache-Busting Imports
**Finding key:** loop-dc068206dd92e214f2cf
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R8
**Issue:** `importFresh()` uses `Date.now()` plus `Math.random()`, creating an unbounded number of module instances during a test run.
**Suggestion:** Use a deterministic counter suffix instead, for example `let importVersion = 0; ... ?t=${importVersion++}`. This keeps cache busting explicit and bounded by test calls.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R8
**Issue:** `importFresh()` uses `Date.now()` plus `Math.random()`, creating an unbounded number of module instances during a test run.
**Suggestion:** Use a deterministic counter suffix instead, for example `let importVersion = 0; ... ?t=${importVersion++}`. This keeps cache busting explicit and bounded by test calls.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 1. Remove redundant catch block
**Finding key:** loop-43421330861653114d72
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R7  
**Issue:** `writeFlowState()` wraps the lifecycle execution in `try { ... } catch (error) { throw error; }`, which adds no behavior and makes the required-hook failure path harder to read.  
**Suggestion:** Remove the `try/catch` and let errors propagate directly.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R7  
**Issue:** `writeFlowState()` wraps the lifecycle execution in `try { ... } catch (error) { throw error; }`, which adds no behavior and makes the required-hook failure path harder to read.  
**Suggestion:** Remove the `try/catch` and let errors propagate directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 2. Rename callback parameter for clarity
**Finding key:** loop-fda9248d8fa76aa088fd
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `writeFlowState(extra, writePrepareFiles)` uses a parameter name that is identical to the outer helper function passed in, which makes it look like the helper is closed over rather than injected.  
**Suggestion:** Rename the parameter to something like `writeSpecArtifacts` or `writePrepareArtifacts` to clarify that lifecycle `main` is responsible for writing the files only after required pre-hooks pass.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `writeFlowState(extra, writePrepareFiles)` uses a parameter name that is identical to the outer helper function passed in, which makes it look like the helper is closed over rather than injected.  
**Suggestion:** Rename the parameter to something like `writeSpecArtifacts` or `writePrepareArtifacts` to clarify that lifecycle `main` is responsible for writing the files only after required pre-hooks pass.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 3. Extract lifecycle aggregation helper
**Finding key:** loop-906fb888c11d41bacd2d
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** `runFlowCommandWithPluginLifecycle()` and `pluginLifecycleFailure()` both manually assemble `pluginHooks`, `followUps`, `warnings`, and `issueLogEntries` from pre/post hook results. This duplicates lifecycle result-shaping logic.  
**Suggestion:** Add a small helper, for example `mergeHookLifecycleResults(pre, postOrFailure, result)`, and use it for both success and failure paths.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** `runFlowCommandWithPluginLifecycle()` and `pluginLifecycleFailure()` both manually assemble `pluginHooks`, `followUps`, `warnings`, and `issueLogEntries` from pre/post hook results. This duplicates lifecycle result-shaping logic.  
**Suggestion:** Add a small helper, for example `mergeHookLifecycleResults(pre, postOrFailure, result)`, and use it for both success and failure paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 4. Improve outcome constructor error naming
**Finding key:** loop-dadfc2697daf3ececbd3
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** `FlowCommandHookExecutionOutcome` throws `"successful flow command hook outcome cannot carry a failure policy"` for any non-business outcome with a policy, including `integrity-failure`. The message is misleading because integrity failure is not success.  
**Suggestion:** Change the message to a neutral invariant such as `"only business-failure outcomes can carry a failure policy"`.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** `FlowCommandHookExecutionOutcome` throws `"successful flow command hook outcome cannot carry a failure policy"` for any non-business outcome with a policy, including `integrity-failure`. The message is misleading because integrity failure is not success.  
**Suggestion:** Change the message to a neutral invariant such as `"only business-failure outcomes can carry a failure policy"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 5. Rename advisory outcome accumulator
**Finding key:** loop-9d6545a1b812204083bc
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R4  
**Issue:** In `runFlowCommandHooks()`, the variable `outcome` starts as success but is later overwritten with the latest advisory business failure. The generic name hides that only the final advisory failure outcome is retained.  
**Suggestion:** Rename it to `lastAdvisoryFailureOutcome` or explicitly compute the returned outcome from a `businessFailureOutcome` variable for clearer intent.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R4  
**Issue:** In `runFlowCommandHooks()`, the variable `outcome` starts as success but is later overwritten with the latest advisory business failure. The generic name hides that only the final advisory failure outcome is retained.  
**Suggestion:** Rename it to `lastAdvisoryFailureOutcome` or explicitly compute the returned outcome from a `businessFailureOutcome` variable for clearer intent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 1. Normalize review finding schemas across artifacts
**Finding key:** loop-454dd0f8cdfb2c7fedcd
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** Multiple review artifacts store the same finding data in parallel shapes such as `blockingFindings`, `advisoryFindings`, and `findings`, while using inconsistent names like `issue` vs `body`, `failureMode` vs `category`, and `kind` vs `severity`. This creates cross-file consumer complexity and drift risk.
**Suggestion:** Define one canonical finding schema and have grouped views reference canonical `findingId`s or be derived at render/read time.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** Multiple review artifacts store the same finding data in parallel shapes such as `blockingFindings`, `advisoryFindings`, and `findings`, while using inconsistent names like `issue` vs `body`, `failureMode` vs `category`, and `kind` vs `severity`. This creates cross-file consumer complexity and drift risk.
**Suggestion:** Define one canonical finding schema and have grouped views reference canonical `findingId`s or be derived at render/read time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 65. 2. Consolidate duplicate JSON and Markdown review history
**Finding key:** loop-ab94afcc7fba6f3640cc
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-002.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-002.md`
**Requirement:** R8
**Issue:** Review attempts are repeatedly committed in both JSON and Markdown with the same substantive data. This pattern appears across impl and test attempt artifacts, creating two cross-file sources of truth for verdicts, findings, requirements, dispositions, and rationale.
**Suggestion:** Treat JSON as canonical and generate Markdown on demand, or keep Markdown as a compact summary that points to the canonical structured artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-002.md`
**Requirement:** R8
**Issue:** Review attempts are repeatedly committed in both JSON and Markdown with the same substantive data. This pattern appears across impl and test attempt artifacts, creating two cross-file sources of truth for verdicts, findings, requirements, dispositions, and rationale.
**Suggestion:** Treat JSON as canonical and generate Markdown on demand, or keep Markdown as a compact summary that points to the canonical structured artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 66. 3. Apply one formatting convention to generated evidence files
**Finding key:** loop-a6e9a6581c4d6f400933
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/def3a5a0e158ad9dca2d9d95a9f1cef30394d77a082c2c6eb29c08b05862cf02.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/def3a5a0e158ad9dca2d9d95a9f1cef30394d77a082c2c6eb29c08b05862cf02.json`
**Requirement:** R8
**Issue:** Several review evidence JSON files are minified while review-history JSON files are pretty-printed. The inconsistent formatting makes cross-file review harder and causes noisy diffs for generated artifacts with similar schemas.
**Suggestion:** Emit all generated JSON artifacts through a shared serializer with stable indentation and key ordering.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/def3a5a0e158ad9dca2d9d95a9f1cef30394d77a082c2c6eb29c08b05862cf02.json`
**Requirement:** R8
**Issue:** Several review evidence JSON files are minified while review-history JSON files are pretty-printed. The inconsistent formatting makes cross-file review harder and causes noisy diffs for generated artifacts with similar schemas.
**Suggestion:** Emit all generated JSON artifacts through a shared serializer with stable indentation and key ordering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 67. 4. Standardize empty generated artifact handling
**Finding key:** loop-0112bd39d3bd2508f938
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-coverage-triage.json
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-triage.json`
**Requirement:** R3
**Issue:** Empty triage, repair, PASS evidence, and no-finding Markdown artifacts are emitted across multiple phases using repeated boilerplate. This creates duplicate low-value files and inconsistent empty-state conventions.
**Suggestion:** Use one shared empty-state policy: suppress empty artifacts, consolidate them into a run summary, or emit a compact canonical empty record through the same serializer.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-triage.json`
**Requirement:** R3
**Issue:** Empty triage, repair, PASS evidence, and no-finding Markdown artifacts are emitted across multiple phases using repeated boilerplate. This creates duplicate low-value files and inconsistent empty-state conventions.
**Suggestion:** Use one shared empty-state policy: suppress empty artifacts, consolidate them into a run summary, or emit a compact canonical empty record through the same serializer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 68. 5. Add bounded retention for generated histories and evidence
**Finding key:** loop-1ce8e7661a88e253e005
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow.json`
**Requirement:** R8
**Issue:** `flow.json`, `review-history/*`, raw logs, and evidence histories all retain repeated historical data without a visible shared cap. Across files, repeated retries can grow generated artifacts and directories without bound.
**Suggestion:** Define a single retention policy, such as latest N attempts per phase plus summarized older evidence, and enforce it in the artifact generator.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow.json`
**Requirement:** R8
**Issue:** `flow.json`, `review-history/*`, raw logs, and evidence histories all retain repeated historical data without a visible shared cap. Across files, repeated retries can grow generated artifacts and directories without bound.
**Suggestion:** Define a single retention policy, such as latest N attempts per phase plus summarized older evidence, and enforce it in the artifact generator.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 69. 6. Unify finding identity semantics
**Finding key:** loop-e9d596eede60f9efd132
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R2
**Issue:** Across gate source, review evidence, and review history artifacts, identifiers such as `id`, `findingId`, and `fingerprint` are sometimes duplicated with identical values and sometimes reused across distinct locations. This makes it unclear whether a finding is location-specific or shared.
**Suggestion:** Establish one identity model: a canonical `findingId`, optional location IDs for repeated occurrences, and a documented separate `fingerprint` only if it has different semantics.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R2
**Issue:** Across gate source, review evidence, and review history artifacts, identifiers such as `id`, `findingId`, and `fingerprint` are sometimes duplicated with identical values and sometimes reused across distinct locations. This makes it unclear whether a finding is location-specific or shared.
**Suggestion:** Establish one identity model: a canonical `findingId`, optional location IDs for repeated occurrences, and a documented separate `fingerprint` only if it has different semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 70. 7. Share lifecycle result aggregation naming and helpers
**Finding key:** loop-13509254774e6f598806
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R2
**Issue:** Lifecycle aggregation appears in both plugin registry and finalize cleanup code, with overlapping concepts named differently, such as composing lifecycle results versus merging hook runner results. This cross-file inconsistency obscures the required/advisory failure policy behavior.
**Suggestion:** Introduce one shared helper and vocabulary, for example `mergeHookLifecycleResults`, and use consistent names for pre/post hook outcomes across prepare, finalize, and plugin registry paths.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R2
**Issue:** Lifecycle aggregation appears in both plugin registry and finalize cleanup code, with overlapping concepts named differently, such as composing lifecycle results versus merging hook runner results. This cross-file inconsistency obscures the required/advisory failure policy behavior.
**Suggestion:** Introduce one shared helper and vocabulary, for example `mergeHookLifecycleResults`, and use consistent names for pre/post hook outcomes across prepare, finalize, and plugin registry paths.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
