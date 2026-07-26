# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Normalize Empty Repair Artifact Shape
**Finding key:** loop-1ed8107f140e8d14329c
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-coverage-repair.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-repair.json`
**Requirement:** R2
**Issue:** This file duplicates the same empty repair structure and wording as `draft-questions-repair.json`, with only phase/source metadata changing.
**Suggestion:** Generate empty repair artifacts through the same canonical path as other empty repair outputs, parameterized by `phase` and `sourceTriage`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-repair.json`
**Requirement:** R2
**Issue:** This file duplicates the same empty repair structure and wording as `draft-questions-repair.json`, with only phase/source metadata changing.
**Suggestion:** Generate empty repair artifacts through the same canonical path as other empty repair outputs, parameterized by `phase` and `sourceTriage`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 3. Normalize Empty Triage Artifact Shape
**Finding key:** loop-b5663ea885b3d1c6d5ac
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-coverage-triage.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-triage.json`
**Requirement:** R2
**Issue:** This file duplicates the same empty triage structure and wording as `draft-questions-triage.json`, with only phase/source metadata changing.
**Suggestion:** Generate empty triage artifacts from one reusable template or canonical serializer to avoid copy-style divergence in `summary`, `items`, and source field naming.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-triage.json`
**Requirement:** R2
**Issue:** This file duplicates the same empty triage structure and wording as `draft-questions-triage.json`, with only phase/source metadata changing.
**Suggestion:** Generate empty triage artifacts from one reusable template or canonical serializer to avoid copy-style divergence in `summary`, `items`, and source field naming.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Deduplicate Repeated Guardrail Findings
**Finding key:** loop-e3a6f190015b8a401016
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R1
**Issue:** The same `prioritize-requirements` failure is repeated multiple times with identical `findingId`, `fingerprint`, `reason`, `rationale`, and metadata, differing only by locator. The same information is also duplicated between `evaluations` and `observations`.
**Suggestion:** Represent each unique guardrail finding once and store affected locators as an array, or keep `evaluations` as the canonical source and derive `observations` at read time. This reduces duplicate data and avoids drift between sections.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R1
**Issue:** The same `prioritize-requirements` failure is repeated multiple times with identical `findingId`, `fingerprint`, `reason`, `rationale`, and metadata, differing only by locator. The same information is also duplicated between `evaluations` and `observations`.
**Suggestion:** Represent each unique guardrail finding once and store affected locators as an array, or keep `evaluations` as the canonical source and derive `observations` at read time. This reduces duplicate data and avoids drift between sections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Normalize Empty Review/Triage Artifact Shape
**Finding key:** loop-8149c10dfaf84ec68493
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-review-coverage.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-review-coverage.json`
**Requirement:** R2
**Issue:** The empty review artifact repeats the same structural pattern and summary text as `draft-review-questions.json`, differing only in `phase`, `sourceDraft`, and timestamp. This creates boilerplate artifacts that are easy to generate inconsistently.
**Suggestion:** Use a shared generation path or schema convention for empty review results so fields like `verdict`, `summary`, `blockingFindings`, `advisoryFindings`, and `repairTargets` are emitted consistently.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-review-coverage.json`
**Requirement:** R2
**Issue:** The empty review artifact repeats the same structural pattern and summary text as `draft-review-questions.json`, differing only in `phase`, `sourceDraft`, and timestamp. This creates boilerplate artifacts that are easy to generate inconsistently.
**Suggestion:** Use a shared generation path or schema convention for empty review results so fields like `verdict`, `summary`, `blockingFindings`, `advisoryFindings`, and `repairTargets` are emitted consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Add failure policy to saved hook snapshots
**Finding key:** loop-a1054d28f3262bc9a939
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R1  
**Issue:** `plugins.flowCommandHooks` snapshot entries include `command`, `hook`, and `priority`, but omit the new failure policy metadata required by the spec.  
**Suggestion:** Add explicit `failurePolicy` values to each snapshot entry, for example `"failurePolicy": "required"` or `"advisory"`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R1  
**Issue:** `plugins.flowCommandHooks` snapshot entries include `command`, `hook`, and `priority`, but omit the new failure policy metadata required by the spec.  
**Suggestion:** Add explicit `failurePolicy` values to each snapshot entry, for example `"failurePolicy": "required"` or `"advisory"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Fix stale in-progress flow state
**Finding key:** loop-26721c4c2788b2322955
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** The `impl-review` step is still marked `"in_progress"` even though later artifacts show implementation review completed. This makes the generated state internally inconsistent.  
**Suggestion:** Regenerate or update `flow.json` so `impl-review` has a completed status and matching `finishedAt`/runtime metadata.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** The `impl-review` step is still marked `"in_progress"` even though later artifacts show implementation review completed. This makes the generated state internally inconsistent.  
**Suggestion:** Regenerate or update `flow.json` so `impl-review` has a completed status and matching `finishedAt`/runtime metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Bound retained review history
**Finding key:** loop-56080b87b80c35462398
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records[].evidenceHistory`, and related historical arrays can grow without a visible cap, violating the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit retention policy, such as latest N records per phase/task plus truncation metadata.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records[].evidenceHistory`, and related historical arrays can grow without a visible cap, violating the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit retention policy, such as latest N records per phase/task plus truncation metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Remove duplicate localization source of truth
**Finding key:** loop-963def8893ca81c3a01c
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R2  
**Issue:** The English and Japanese sections duplicate the full issue body, including Summary, Decision, Requirements, Scope, Acceptance Criteria, and Evidence. This creates drift risk.  
**Suggestion:** Keep one canonical requirements section and make the localized section a concise translation summary, or clearly mark one section as authoritative.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R2  
**Issue:** The English and Japanese sections duplicate the full issue body, including Summary, Decision, Requirements, Scope, Acceptance Criteria, and Evidence. This creates drift risk.  
**Suggestion:** Keep one canonical requirements section and make the localized section a concise translation summary, or clearly mark one section as authoritative.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Add final newline
**Finding key:** loop-a2f9e2bc04065f3c41ae
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 6. Deduplicate issue-log observations
**Finding key:** loop-0a8c07e9366cd2ae5437
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/issue-log.json`  
**Requirement:** R8  
**Issue:** Several issue-log entries store the same review information in `reason`, `observations`, and `failedEvaluations`, repeating long text blocks inside one artifact.  
**Suggestion:** Store canonical observations once and make `reason`/`failedEvaluations` reference or summarize those records.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/issue-log.json`  
**Requirement:** R8  
**Issue:** Several issue-log entries store the same review information in `reason`, `observations`, and `failedEvaluations`, repeating long text blocks inside one artifact.  
**Suggestion:** Store canonical observations once and make `reason`/`failedEvaluations` reference or summarize those records.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 7. Bound issue-log growth
**Finding key:** loop-86bec3ded44450f96c69
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/issue-log.json`  
**Requirement:** R8  
**Issue:** The issue log appends detailed entries indefinitely, including large failure payloads and changed-file fingerprints. This has no visible size/count bound.  
**Suggestion:** Enforce a maximum retained entry count or payload size, with older details compacted into bounded summaries.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/issue-log.json`  
**Requirement:** R8  
**Issue:** The issue log appends detailed entries indefinitely, including large failure payloads and changed-file fingerprints. This has no visible size/count bound.  
**Suggestion:** Enforce a maximum retained entry count or payload size, with older details compacted into bounded summaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 8. Remove rejected no-op triage payload
**Finding key:** loop-476fabddf9f5578878f9
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/impl-triage.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/impl-triage.json`  
**Requirement:** R8  
**Issue:** The file stores many rejected improvement proposals for files that are not in the provided diff scope, creating noisy generated state that is not actionable for this change review.  
**Suggestion:** Filter triage items to only touched files before persisting, or separate out-of-scope rejected findings into a compact count.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/impl-triage.json`  
**Requirement:** R8  
**Issue:** The file stores many rejected improvement proposals for files that are not in the provided diff scope, creating noisy generated state that is not actionable for this change review.  
**Suggestion:** Filter triage items to only touched files before persisting, or separate out-of-scope rejected findings into a compact count.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 9. Deduplicate deferred findings
**Finding key:** loop-3113444b8de516be50ee
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/flow-findings.json
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/flow-findings.json`  
**Requirement:** R6  
**Issue:** Each entry repeats `sourceFindingId` and `fingerprint` with identical values, plus both `disposition` and `finalDisposition` fields that can conflict.  
**Suggestion:** Keep one canonical finding identifier and one final state field, or document/enforce the distinction if both are required.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/flow-findings.json`  
**Requirement:** R6  
**Issue:** Each entry repeats `sourceFindingId` and `fingerprint` with identical values, plus both `disposition` and `finalDisposition` fields that can conflict.  
**Suggestion:** Keep one canonical finding identifier and one final state field, or document/enforce the distinction if both are required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 10. Avoid duplicated requirement path lists
**Finding key:** loop-3ec3fea3f1e295f920e2
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/file-map.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/file-map.json`  
**Requirement:** R8  
**Issue:** Requirements R2, R3, and R4 list the same three implementation files and same test file, and R6/R7 largely repeat that mapping.  
**Suggestion:** If the schema allows it, introduce a shared group or generated alias for common lifecycle policy files, then reference that group per requirement.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/file-map.json`  
**Requirement:** R8  
**Issue:** Requirements R2, R3, and R4 list the same three implementation files and same test file, and R6/R7 largely repeat that mapping.  
**Suggestion:** If the schema allows it, introduce a shared group or generated alias for common lifecycle policy files, then reference that group per requirement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Remove Redundant Issue Number State
**Finding key:** loop-3478aef02bfb77f3c4f1
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`
**Requirement:** R2
**Issue:** The file stores issue number twice as `issue` and `result.issueNumber`, with the same value.
**Suggestion:** Store the issue number once, preferably inside the structured `result` object, or remove `result.issueNumber` if the top-level `issue` is the artifact key.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`
**Requirement:** R2
**Issue:** The file stores issue number twice as `issue` and `result.issueNumber`, with the same value.
**Suggestion:** Store the issue number once, preferably inside the structured `result` object, or remove `result.issueNumber` if the top-level `issue` is the artifact key.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 5. Avoid Committing Transient Workflow Status
**Finding key:** loop-fb3c840696da7260e1e9
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json
**Requirement:** R4
**Issue:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`
**Requirement:** R4
**Issue:** The artifact records transient board state such as `"status": "In Progress"`, `"changed": true`, and `"previousStatus": "Todo"`. These are operational side effects rather than durable spec data.
**Suggestion:** Exclude transient workflow mutation results from committed artifacts, or move them into bounded local run evidence that is not treated as source-controlled spec content.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`
**Requirement:** R4
**Issue:** The artifact records transient board state such as `"status": "In Progress"`, `"changed": true`, and `"previousStatus": "Todo"`. These are operational side effects rather than durable spec data.
**Suggestion:** Exclude transient workflow mutation results from committed artifacts, or move them into bounded local run evidence that is not treated as source-controlled spec content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Bound Review Evidence Growth
**Finding key:** loop-dae1632860d9f7ef57f4
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json
**Requirement:** R7
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json`
**Requirement:** R7
**Issue:** This generated evidence artifact retains a very large `advisoryFindings` array with no visible cap. That violates the bounded-resource-usage guardrail because repeated review attempts can grow the file indefinitely.
**Suggestion:** Add an explicit retention policy for generated review evidence, such as keeping only the latest N findings per phase or summarizing older findings into a bounded aggregate record.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json`
**Requirement:** R7
**Issue:** This generated evidence artifact retains a very large `advisoryFindings` array with no visible cap. That violates the bounded-resource-usage guardrail because repeated review attempts can grow the file indefinitely.
**Suggestion:** Add an explicit retention policy for generated review evidence, such as keeping only the latest N findings per phase or summarizing older findings into a bounded aggregate record.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Deduplicate Finding Identity Fields
**Finding key:** loop-ed97895f2340d70d33de
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json`
**Requirement:** R6
**Issue:** Each finding stores both `findingId` and `fingerprint`, and in the shown entries they are identical. This duplicates state and invites drift if one field is updated without the other.
**Suggestion:** Keep one canonical identifier field, or define distinct semantics and only emit both when they actually differ.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json`
**Requirement:** R6
**Issue:** Each finding stores both `findingId` and `fingerprint`, and in the shown entries they are identical. This duplicates state and invites drift if one field is updated without the other.
**Suggestion:** Keep one canonical identifier field, or define distinct semantics and only emit both when they actually differ.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Normalize Review Evidence Formatting
**Finding key:** loop-a0070389f43852b1ada8
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json
**Requirement:** R5
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json`
**Requirement:** R5
**Issue:** The evidence JSON is committed as a single extremely long line, making reviews and future diffs hard to inspect.
**Suggestion:** Pretty-print generated review evidence with stable key ordering and a trailing newline.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/5cac57cb5799a07696840b35dd38cc5e76de494b284a4353af4b286282a7fbec.json`
**Requirement:** R5
**Issue:** The evidence JSON is committed as a single extremely long line, making reviews and future diffs hard to inspect.
**Suggestion:** Pretty-print generated review evidence with stable key ordering and a trailing newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Avoid inconsistent formatting for review evidence JSON
**Finding key:** loop-046b6268adbe8312b899
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-evidence/ecebc467db456197cc023436f49d152e36b2189ebe4cbbba9b0aaec630c45091.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-evidence/ecebc467db456197cc023436f49d152e36b2189ebe4cbbba9b0aaec630c45091.json`  
**Requirement:** R8  
**Issue:** This artifact is minified onto one very long line while the other JSON review artifacts in the same change set are pretty-printed. The inconsistent format makes review, diffs, and targeted edits harder.  
**Suggestion:** Format this JSON with the same indentation style used by the `review-history/*.json` files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-evidence/ecebc467db456197cc023436f49d152e36b2189ebe4cbbba9b0aaec630c45091.json`  
**Requirement:** R8  
**Issue:** This artifact is minified onto one very long line while the other JSON review artifacts in the same change set are pretty-printed. The inconsistent format makes review, diffs, and targeted edits harder.  
**Suggestion:** Format this JSON with the same indentation style used by the `review-history/*.json` files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Remove duplicated finding payloads from attempt artifacts
**Finding key:** loop-166cc150bd1f956d276f
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`  
**Requirement:** R2  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with overlapping fields such as title, issue/body, fingerprint, disposition, rationale, and requirement ID. This creates avoidable drift risk between two copies of the same review result.  
**Suggestion:** Keep one canonical findings array and derive grouped views such as blocking/non-blocking from `severity` or `disposition`, or reduce `blockingFindings` to references/IDs only.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-001.json`  
**Requirement:** R2  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with overlapping fields such as title, issue/body, fingerprint, disposition, rationale, and requirement ID. This creates avoidable drift risk between two copies of the same review result.  
**Suggestion:** Keep one canonical findings array and derive grouped views such as blocking/non-blocking from `severity` or `disposition`, or reduce `blockingFindings` to references/IDs only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Remove duplicated finding payloads from second attempt artifact
**Finding key:** loop-f61642a1c8fbaf840dbf
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-002.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-002.json`  
**Requirement:** R2  
**Issue:** The single blocking finding is duplicated in both `blockingFindings` and `findings`, repeating the same title, rationale, fingerprint, and requirement data.  
**Suggestion:** Use one canonical finding representation and compute the blocking summary from that structure, or store only `findingId` references in `blockingFindings`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-002.json`  
**Requirement:** R2  
**Issue:** The single blocking finding is duplicated in both `blockingFindings` and `findings`, repeating the same title, rationale, fingerprint, and requirement data.  
**Suggestion:** Use one canonical finding representation and compute the blocking summary from that structure, or store only `findingId` references in `blockingFindings`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 3. Normalize empty PASS artifacts
**Finding key:** loop-6b54829501584f282c87
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-003.json`  
**Requirement:** R1  
**Issue:** The PASS artifact carries several empty or redundant collections and counters: `blockingFindings`, `nonBlockingImprovements`, `findings`, and summary totals that all encode the same absence of findings.  
**Suggestion:** Simplify PASS artifacts by keeping a single canonical empty `findings: []` plus `verdict`, and derive zero-count summaries during rendering unless the schema strictly requires persisted counters.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-003.json`  
**Requirement:** R1  
**Issue:** The PASS artifact carries several empty or redundant collections and counters: `blockingFindings`, `nonBlockingImprovements`, `findings`, and summary totals that all encode the same absence of findings.  
**Suggestion:** Simplify PASS artifacts by keeping a single canonical empty `findings: []` plus `verdict`, and derive zero-count summaries during rendering unless the schema strictly requires persisted counters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Remove duplicated finding payloads from attempt JSON
**Finding key:** loop-d0dd4143cd6090b50bc8
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-004.json
**Requirement:** R4
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-004.json`  
**Requirement:** R4  
**Issue:** The same review findings are stored twice: once in `blockingFindings` and again in `findings`, with duplicated title, issue/body, disposition, rationale, requirement, fingerprint, and repeat count. This makes the artifact harder to maintain and risks divergence between the two sections.  
**Suggestion:** Keep one canonical findings array and derive severity-specific groupings when rendering, or make `blockingFindings` contain only references/ids if both views are required.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-004.json`  
**Requirement:** R4  
**Issue:** The same review findings are stored twice: once in `blockingFindings` and again in `findings`, with duplicated title, issue/body, disposition, rationale, requirement, fingerprint, and repeat count. This makes the artifact harder to maintain and risks divergence between the two sections.  
**Suggestion:** Keep one canonical findings array and derive severity-specific groupings when rendering, or make `blockingFindings` contain only references/ids if both views are required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Remove duplicated finding payloads from attempt JSON
**Finding key:** loop-d81d9403a7fe3ffd134d
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-005.json
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-005.json`  
**Requirement:** R6  
**Issue:** The two findings are duplicated between `blockingFindings` and `findings`, repeating nearly identical metadata and long text fields. This is unnecessary duplication in a generated review-history artifact.  
**Suggestion:** Store each finding once, with `severity: "blocking"`, and compute the blocking list from that field when needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-005.json`  
**Requirement:** R6  
**Issue:** The two findings are duplicated between `blockingFindings` and `findings`, repeating nearly identical metadata and long text fields. This is unnecessary duplication in a generated review-history artifact.  
**Suggestion:** Store each finding once, with `severity: "blocking"`, and compute the blocking list from that field when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Remove duplicated finding payloads from attempt JSON
**Finding key:** loop-2478d4c1b77bb23e4b08
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md
**Requirement:** R4
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R4  
**Issue:** The same review findings are stored twice: once in `blockingFindings` and again in `findings`, with duplicated title, issue/body, disposition, rationale, requirement, fingerprint, and repeat count. This makes the artifact harder to maintain and risks divergence between the two sections.  
**Suggestion:** Keep one canonical findings array and derive severity-specific groupings when rendering, or make `blockingFindings` contain only references/ids if both views are required.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R4  
**Issue:** The same review findings are stored twice: once in `blockingFindings` and again in `findings`, with duplicated title, issue/body, disposition, rationale, requirement, fingerprint, and repeat count. This makes the artifact harder to maintain and risks divergence between the two sections.  
**Suggestion:** Keep one canonical findings array and derive severity-specific groupings when rendering, or make `blockingFindings` contain only references/ids if both views are required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Remove duplicated finding payloads from attempt JSON
**Finding key:** loop-04a0eb05258f786ca37e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R6  
**Issue:** The two findings are duplicated between `blockingFindings` and `findings`, repeating nearly identical metadata and long text fields. This is unnecessary duplication in a generated review-history artifact.  
**Suggestion:** Store each finding once, with `severity: "blocking"`, and compute the blocking list from that field when needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R6  
**Issue:** The two findings are duplicated between `blockingFindings` and `findings`, repeating nearly identical metadata and long text fields. This is unnecessary duplication in a generated review-history artifact.  
**Suggestion:** Store each finding once, with `severity: "blocking"`, and compute the blocking list from that field when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Normalize empty PASS artifacts
**Finding key:** loop-0a2b5be4dbd2bdf4d27b
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R1  
**Issue:** The PASS artifact carries several empty or redundant collections and counters: `blockingFindings`, `nonBlockingImprovements`, `findings`, and summary totals that all encode the same absence of findings.  
**Suggestion:** Simplify PASS artifacts by keeping a single canonical empty `findings: []` plus `verdict`, and derive zero-count summaries during rendering unless the schema strictly requires persisted counters.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-009.md`  
**Requirement:** R1  
**Issue:** The PASS artifact carries several empty or redundant collections and counters: `blockingFindings`, `nonBlockingImprovements`, `findings`, and summary totals that all encode the same absence of findings.  
**Suggestion:** Simplify PASS artifacts by keeping a single canonical empty `findings: []` plus `verdict`, and derive zero-count summaries during rendering unless the schema strictly requires persisted counters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Remove duplicated proposal text in review records
**Finding key:** loop-f93c1ba65a464f8d3196
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-010.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.json`  
**Requirement:** R8  
**Issue:** Each `nonBlockingImprovements[]` entry repeats the full proposal text in both `issue` and `suggestion`, and the same content is repeated again under `findings[].body`. This creates three sources of truth inside one artifact and makes the file very large.  
**Suggestion:** Store the canonical proposal body once. Make `suggestion` contain only the concrete suggestion text, and have `findings[]` reference the canonical improvement by `findingId` or be derived from `nonBlockingImprovements`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.json`  
**Requirement:** R8  
**Issue:** Each `nonBlockingImprovements[]` entry repeats the full proposal text in both `issue` and `suggestion`, and the same content is repeated again under `findings[].body`. This creates three sources of truth inside one artifact and makes the file very large.  
**Suggestion:** Store the canonical proposal body once. Make `suggestion` contain only the concrete suggestion text, and have `findings[]` reference the canonical improvement by `findingId` or be derived from `nonBlockingImprovements`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Consolidate duplicated findings arrays
**Finding key:** loop-84eb1545f5974ee6f4be
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-007.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-007.json`  
**Requirement:** R8  
**Issue:** The same findings are stored in both `blockingFindings` and `findings` with mostly identical fields but different names such as `issue` vs `body` and `failureMode` vs `category`.  
**Suggestion:** Keep one canonical `findings` array with `severity`, `category`, and `requirementId`, then derive `blockingFindings` when rendering or reading the artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-007.json`  
**Requirement:** R8  
**Issue:** The same findings are stored in both `blockingFindings` and `findings` with mostly identical fields but different names such as `issue` vs `body` and `failureMode` vs `category`.  
**Suggestion:** Keep one canonical `findings` array with `severity`, `category`, and `requirementId`, then derive `blockingFindings` when rendering or reading the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Consolidate duplicated findings arrays
**Finding key:** loop-c622ede5ae00ed60dc6b
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-008.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-008.json`  
**Requirement:** R8  
**Issue:** The single finding is duplicated across `blockingFindings[0]` and `findings[0]`, including title, rationale, fingerprint, disposition, requirement, and repeat count.  
**Suggestion:** Store the finding once and make grouped sections reference `findingId`, or remove the grouped section if the flat `findings` array is the canonical schema.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-008.json`  
**Requirement:** R8  
**Issue:** The single finding is duplicated across `blockingFindings[0]` and `findings[0]`, including title, rationale, fingerprint, disposition, requirement, and repeat count.  
**Suggestion:** Store the finding once and make grouped sections reference `findingId`, or remove the grouped section if the flat `findings` array is the canonical schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Normalize Markdown/JSON review history duplication
**Finding key:** loop-f74f45ecd8b1bf69c011
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-007.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-007.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact duplicates the same substantive review data already present in `impl-attempt-007.json`, including verdict, file, requirement, issue, suggestion, disposition, and rationale.  
**Suggestion:** Treat JSON as canonical and generate Markdown on demand, or reduce the Markdown file to a compact summary that points to the structured attempt artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-007.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact duplicates the same substantive review data already present in `impl-attempt-007.json`, including verdict, file, requirement, issue, suggestion, disposition, and rationale.  
**Suggestion:** Treat JSON as canonical and generate Markdown on demand, or reduce the Markdown file to a compact summary that points to the structured attempt artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 5. Normalize Markdown/JSON review history duplication
**Finding key:** loop-d4ce3db3dadce30b1d89
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-008.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-008.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact repeats the same finding already stored structurally in `impl-attempt-008.json`. Maintaining both full representations increases drift risk.  
**Suggestion:** Generate this Markdown from JSON, or store only one canonical representation for each review attempt.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-008.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact repeats the same finding already stored structurally in `impl-attempt-008.json`. Maintaining both full representations increases drift risk.  
**Suggestion:** Generate this Markdown from JSON, or store only one canonical representation for each review attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 6. Add bounded retention for attempt history
**Finding key:** loop-40219d055b26933bf806
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-010.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.json`  
**Requirement:** R8  
**Issue:** The artifact records attempt 10 and includes 70 advisory findings plus repeated historical metadata. The touched diff shows review attempts accumulating without an explicit visible cap, which conflicts with the bounded-resource-usage guardrail for bulk retained history.  
**Suggestion:** Enforce a retention policy, such as keeping the latest N attempts per phase and compacting older attempts into a bounded summary with `omittedCount` metadata.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.json`  
**Requirement:** R8  
**Issue:** The artifact records attempt 10 and includes 70 advisory findings plus repeated historical metadata. The touched diff shows review attempts accumulating without an explicit visible cap, which conflicts with the bounded-resource-usage guardrail for bulk retained history.  
**Suggestion:** Enforce a retention policy, such as keeping the latest N attempts per phase and compacting older attempts into a bounded summary with `omittedCount` metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Remove duplicated proposal field blocks
**Finding key:** loop-57e5fb8e418c2437db6f
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-010.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.md`
**Requirement:** R8
**Issue:** Each non-blocking improvement repeats the embedded `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:**` content twice inside the same proposal. This makes the review artifact noisy and harder to consume.
**Suggestion:** Emit each proposal with a single canonical `File`, `Requirement`, `Issue`, and `Suggestion` block, then keep `Disposition` and `Rationale` once after it.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.md`
**Requirement:** R8
**Issue:** Each non-blocking improvement repeats the embedded `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:**` content twice inside the same proposal. This makes the review artifact noisy and harder to consume.
**Suggestion:** Emit each proposal with a single canonical `File`, `Requirement`, `Issue`, and `Suggestion` block, then keep `Disposition` and `Rationale` once after it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Consolidate repeated review-history proposal themes
**Finding key:** loop-40a4b556ef4f9a263d55
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/impl-attempt-010.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.md`
**Requirement:** R8
**Issue:** The artifact contains many near-duplicate proposals for the same underlying issues, such as pretty-printing evidence JSON, removing duplicated finding payloads, adding final newlines, and normalizing empty artifacts. This repeats review signal and makes prioritization harder.
**Suggestion:** Group repeated findings by theme and file set, or retain only the latest/canonical proposal per unique finding key or fingerprint.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/impl-attempt-010.md`
**Requirement:** R8
**Issue:** The artifact contains many near-duplicate proposals for the same underlying issues, such as pretty-printing evidence JSON, removing duplicated finding payloads, adding final newlines, and normalizing empty artifacts. This repeats review signal and makes prioritization harder.
**Suggestion:** Group repeated findings by theme and file set, or retain only the latest/canonical proposal per unique finding key or fingerprint.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Add explicit retention bounds for generated attempt history
**Finding key:** loop-6bef0f7ed8063638ca86
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.json`
**Requirement:** R8
**Issue:** The new per-attempt history artifacts establish a pattern where each retry adds another full JSON and Markdown record. Without a visible count or size limit, repeated review loops can grow the history directory without bound, violating the bounded-resource-usage guardrail.
**Suggestion:** Add or enforce a bounded retention policy, such as keeping the latest N attempts per phase and compacting older attempts into a summary artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.json`
**Requirement:** R8
**Issue:** The new per-attempt history artifacts establish a pattern where each retry adds another full JSON and Markdown record. Without a visible count or size limit, repeated review loops can grow the history directory without bound, violating the bounded-resource-usage guardrail.
**Suggestion:** Add or enforce a bounded retention policy, such as keeping the latest N attempts per phase and compacting older attempts into a summary artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Normalize finding identity fields
**Finding key:** loop-51dd3b143c0818243df5
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.json`
**Requirement:** R8
**Issue:** Each finding repeats the same hash across `id`, `findingId`, and `fingerprint`, and some distinct findings share the same hash. That makes it unclear whether the identifier represents a unique finding, a repeated category, or a grouping fingerprint.
**Suggestion:** Use one canonical `findingId` per finding and reserve `fingerprint` only for grouping semantics. If grouping is intentional, add per-finding IDs and keep the shared hash as a separate group key.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.json`
**Requirement:** R8
**Issue:** Each finding repeats the same hash across `id`, `findingId`, and `fingerprint`, and some distinct findings share the same hash. That makes it unclear whether the identifier represents a unique finding, a repeated category, or a grouping fingerprint.
**Suggestion:** Use one canonical `findingId` per finding and reserve `fingerprint` only for grouping semantics. If grouping is intentional, add per-finding IDs and keep the shared hash as a separate group key.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Store findings once per JSON artifact
**Finding key:** loop-54944f2af8e49fcbafdd
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-002.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The same finding content is duplicated in `blockingFindings` and `findings` with different field names such as `issue` versus `body` and `kind` versus `severity`.
**Suggestion:** Store one canonical findings array with severity/category fields, then derive `blockingFindings` at render time or reduce it to `findingId` references.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The same finding content is duplicated in `blockingFindings` and `findings` with different field names such as `issue` versus `body` and `kind` versus `severity`.
**Suggestion:** Store one canonical findings array with severity/category fields, then derive `blockingFindings` at render time or reduce it to `findingId` references.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 6. Avoid committing full Markdown duplicates of JSON records
**Finding key:** loop-41d6f12444b3fda25788
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown report duplicates the substantive content already stored in `test-attempt-001.json`, including verdict, targets, issues, required changes, and rationale.
**Suggestion:** Treat JSON as canonical and generate Markdown on demand, or make the Markdown a compact summary that points to the structured artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown report duplicates the substantive content already stored in `test-attempt-001.json`, including verdict, targets, issues, required changes, and rationale.
**Suggestion:** Treat JSON as canonical and generate Markdown on demand, or make the Markdown a compact summary that points to the structured artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 7. Add final newline to Markdown artifacts
**Finding key:** loop-378c7ad276288496f252
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/spec-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-001.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with normal Markdown artifact formatting and can create noisy diffs.
**Suggestion:** Add a final newline at EOF and ensure the generator writes one for all Markdown review-history files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-001.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with normal Markdown artifact formatting and can create noisy diffs.
**Suggestion:** Add a final newline at EOF and ensure the generator writes one for all Markdown review-history files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 8. Deduplicate empty PASS review records
**Finding key:** loop-3e485687766b1bb8c677
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/spec-attempt-002.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-002.json`
**Requirement:** R8
**Issue:** `spec-attempt-001.json` and `spec-attempt-002.json` are structurally identical PASS records that differ only by timestamp and attempt number. Keeping full empty records for every successful retry adds low-value generated churn.
**Suggestion:** Use a compact PASS attempt shape, or consolidate repeated empty PASS attempts into a bounded summary with attempt count and latest timestamp.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-002.json`
**Requirement:** R8
**Issue:** `spec-attempt-001.json` and `spec-attempt-002.json` are structurally identical PASS records that differ only by timestamp and attempt number. Keeping full empty records for every successful retry adds low-value generated churn.
**Suggestion:** Use a compact PASS attempt shape, or consolidate repeated empty PASS attempts into a bounded summary with attempt count and latest timestamp.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 7. Add final newline to Markdown artifacts
**Finding key:** loop-10118fa3b47ffa31f18a
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/spec-attempt-002.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-002.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with normal Markdown artifact formatting and can create noisy diffs.
**Suggestion:** Add a final newline at EOF and ensure the generator writes one for all Markdown review-history files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/spec-attempt-002.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with normal Markdown artifact formatting and can create noisy diffs.
**Suggestion:** Add a final newline at EOF and ensure the generator writes one for all Markdown review-history files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 7. Add final newline to Markdown artifacts
**Finding key:** loop-2763244423be570f7dc1
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec-review.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with normal Markdown artifact formatting and can create noisy diffs.
**Suggestion:** Add a final newline at EOF and ensure the generator writes one for all Markdown review-history files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec-review.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with normal Markdown artifact formatting and can create noisy diffs.
**Suggestion:** Add a final newline at EOF and ensure the generator writes one for all Markdown review-history files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 5. Add Final Newlines
**Finding key:** loop-89097e8961d75f538538
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-002.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs.
**Suggestion:** Add a trailing newline. Apply the same formatting normalization to the other new Markdown review-history files.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-002.md`
**Requirement:** R8
**Issue:** The file has no trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs.
**Suggestion:** Add a trailing newline. Apply the same formatting normalization to the other new Markdown review-history files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 4. Normalize Finding Field Names
**Finding key:** loop-201a93947bd44ef92aa5
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-003.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.json`
**Requirement:** R8
**Issue:** Each finding repeats semantically equivalent identifiers as both `id` and `findingId`, and repeats `rationale` content that is also represented in `whyBlocking`.
**Suggestion:** Use one canonical identifier field and one canonical rationale field, unless downstream consumers require both. If aliases are required, document that contract in the artifact schema.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.json`
**Requirement:** R8
**Issue:** Each finding repeats semantically equivalent identifiers as both `id` and `findingId`, and repeats `rationale` content that is also represented in `whyBlocking`.
**Suggestion:** Use one canonical identifier field and one canonical rationale field, unless downstream consumers require both. If aliases are required, document that contract in the artifact schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 1. Remove Duplicated Review Content Across JSON and Markdown
**Finding key:** loop-d9ef22f2e83afc6dd5d9
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-003.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the same findings already stored structurally in `test-attempt-003.json`. This creates two sources of truth for titles, issues, required changes, and rationales.
**Suggestion:** Generate the Markdown view from the JSON artifact, or store only the JSON artifact if the Markdown is not required as a committed source artifact.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-003.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the same findings already stored structurally in `test-attempt-003.json`. This creates two sources of truth for titles, issues, required changes, and rationales.
**Suggestion:** Generate the Markdown view from the JSON artifact, or store only the JSON artifact if the Markdown is not required as a committed source artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 2. Remove Duplicated Review Content Across JSON and Markdown
**Finding key:** loop-eb68994209d8a6d8db3e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-004.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-004.md`
**Requirement:** R8
**Issue:** The Markdown content repeats the finding already present in `test-attempt-004.json`, increasing maintenance cost and risk of drift.
**Suggestion:** Keep the structured JSON as canonical and generate the Markdown representation during reporting instead of committing both manually.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-004.md`
**Requirement:** R8
**Issue:** The Markdown content repeats the finding already present in `test-attempt-004.json`, increasing maintenance cost and risk of drift.
**Suggestion:** Keep the structured JSON as canonical and generate the Markdown representation during reporting instead of committing both manually.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 3. Remove Duplicated Review Content Across JSON and Markdown
**Finding key:** loop-332ea04b6618bcc29da6
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-005.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-005.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the finding from `test-attempt-005.json`, including issue text, required change, and rationale.
**Suggestion:** Prefer a single canonical artifact format, or add an automated generation step that derives this Markdown from the JSON.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-005.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the finding from `test-attempt-005.json`, including issue text, required change, and rationale.
**Suggestion:** Prefer a single canonical artifact format, or add an automated generation step that derives this Markdown from the JSON.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 2. Avoid Duplicating Finding Content Within One Artifact
**Finding key:** loop-815530133854d8165caf
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-006.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-006.json`  
**Requirement:** R8  
**Issue:** The same finding is represented twice: once in `blockingFindings` and again in `findings`, duplicating title, ID, fingerprint, disposition, rationale, and body/issue text. This creates drift risk between summary-specific and canonical finding sections.  
**Suggestion:** Make one section canonical and derive the other during rendering/consumption, or store only finding IDs in the summary section.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-006.json`  
**Requirement:** R8  
**Issue:** The same finding is represented twice: once in `blockingFindings` and again in `findings`, duplicating title, ID, fingerprint, disposition, rationale, and body/issue text. This creates drift risk between summary-specific and canonical finding sections.  
**Suggestion:** Make one section canonical and derive the other during rendering/consumption, or store only finding IDs in the summary section.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 4. Add Missing Final Newline
**Finding key:** loop-19960196d260e402532f
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-006.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-006.md`  
**Requirement:** R8  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline and ensure generated Markdown artifacts consistently end with one.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-006.md`  
**Requirement:** R8  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline and ensure generated Markdown artifacts consistently end with one.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 4. Add Missing Final Newline
**Finding key:** loop-8e261719a43804b56878
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-007.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.md`  
**Requirement:** R8  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline and ensure generated Markdown artifacts consistently end with one.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.md`  
**Requirement:** R8  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline and ensure generated Markdown artifacts consistently end with one.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 1. Remove Duplicate Review Attempt Artifact
**Finding key:** loop-b8e725651c62a1678363
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-007.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.json`  
**Requirement:** R8  
**Issue:** `test-attempt-007.json` repeats the same rejected finding as `test-attempt-006.json` with identical finding ID, rationale, issue text, required change, and verdict. The only meaningful differences are timestamps, attempt number, and progress signature, which adds noise without new review information.  
**Suggestion:** Avoid persisting duplicate review attempts when the semantic finding set is unchanged, or store them as a compact retry/event record that references the prior attempt.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-007.json`  
**Requirement:** R8  
**Issue:** `test-attempt-007.json` repeats the same rejected finding as `test-attempt-006.json` with identical finding ID, rationale, issue text, required change, and verdict. The only meaningful differences are timestamps, attempt number, and progress signature, which adds noise without new review information.  
**Suggestion:** Avoid persisting duplicate review attempts when the semantic finding set is unchanged, or store them as a compact retry/event record that references the prior attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 3. Avoid Duplicating Finding Content Within Advisory Artifact
**Finding key:** loop-a5b371ac9d10eaff50b7
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/test-attempt-008.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-008.json`  
**Requirement:** R8  
**Issue:** The advisory finding is duplicated across `advisoryFindings` and `findings`, with overlapping title, ID, fingerprint, disposition, rationale, and body content.  
**Suggestion:** Normalize the schema so advisory/blocking buckets reference canonical entries from `findings`, or remove the redundant top-level bucket when `counts` already summarizes severity.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/test-attempt-008.json`  
**Requirement:** R8  
**Issue:** The advisory finding is duplicated across `advisoryFindings` and `findings`, with overlapping title, ID, fingerprint, disposition, rationale, and body content.  
**Suggestion:** Normalize the schema so advisory/blocking buckets reference canonical entries from `findings`, or remove the redundant top-level bucket when `counts` already summarizes severity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 5. Bound Stored Raw Provider Responses
**Finding key:** loop-0bfe7e05698cf6ec2d16
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json
**Requirement:** R4
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full provider output inline with no visible size bound or truncation metadata. This can grow unbounded for large review chunks and conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Cap persisted `rawResponse` length and add metadata such as `rawResponseTruncated` and `rawResponseOmittedBytes`, or store only parsed proposals plus a bounded excerpt for diagnostics.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full provider output inline with no visible size bound or truncation metadata. This can grow unbounded for large review chunks and conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Cap persisted `rawResponse` length and add metadata such as `rawResponseTruncated` and `rawResponseOmittedBytes`, or store only parsed proposals plus a bounded excerpt for diagnostics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 1. Remove Duplicate Review Attempt Artifact
**Finding key:** loop-b34f0362875634313881
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** `test-attempt-007.json` repeats the same rejected finding as `test-attempt-006.json` with identical finding ID, rationale, issue text, required change, and verdict. The only meaningful differences are timestamps, attempt number, and progress signature, which adds noise without new review information.  
**Suggestion:** Avoid persisting duplicate review attempts when the semantic finding set is unchanged, or store them as a compact retry/event record that references the prior attempt.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** `test-attempt-007.json` repeats the same rejected finding as `test-attempt-006.json` with identical finding ID, rationale, issue text, required change, and verdict. The only meaningful differences are timestamps, attempt number, and progress signature, which adds noise without new review information.  
**Suggestion:** Avoid persisting duplicate review attempts when the semantic finding set is unchanged, or store them as a compact retry/event record that references the prior attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 2. Avoid Duplicating Finding Content Within One Artifact
**Finding key:** loop-6eb436ca496c19b83593
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** The same finding is represented twice: once in `blockingFindings` and again in `findings`, duplicating title, ID, fingerprint, disposition, rationale, and body/issue text. This creates drift risk between summary-specific and canonical finding sections.  
**Suggestion:** Make one section canonical and derive the other during rendering/consumption, or store only finding IDs in the summary section.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** The same finding is represented twice: once in `blockingFindings` and again in `findings`, duplicating title, ID, fingerprint, disposition, rationale, and body/issue text. This creates drift risk between summary-specific and canonical finding sections.  
**Suggestion:** Make one section canonical and derive the other during rendering/consumption, or store only finding IDs in the summary section.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 3. Avoid Duplicating Finding Content Within Advisory Artifact
**Finding key:** loop-be4b843c7d99e8dc5722
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** The advisory finding is duplicated across `advisoryFindings` and `findings`, with overlapping title, ID, fingerprint, disposition, rationale, and body content.  
**Suggestion:** Normalize the schema so advisory/blocking buckets reference canonical entries from `findings`, or remove the redundant top-level bucket when `counts` already summarizes severity.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** The advisory finding is duplicated across `advisoryFindings` and `findings`, with overlapping title, ID, fingerprint, disposition, rationale, and body content.  
**Suggestion:** Normalize the schema so advisory/blocking buckets reference canonical entries from `findings`, or remove the redundant top-level bucket when `counts` already summarizes severity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 4. Add Missing Final Newline
**Finding key:** loop-21ef95968e97746f07f0
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline and ensure generated Markdown artifacts consistently end with one.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R8  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline and ensure generated Markdown artifacts consistently end with one.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 5. Bound Stored Raw Provider Responses
**Finding key:** loop-f3228b24e2b957973f12
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.md
**Requirement:** R4
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full provider output inline with no visible size bound or truncation metadata. This can grow unbounded for large review chunks and conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Cap persisted `rawResponse` length and add metadata such as `rawResponseTruncated` and `rawResponseOmittedBytes`, or store only parsed proposals plus a bounded excerpt for diagnostics.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.md`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full provider output inline with no visible size bound or truncation metadata. This can grow unbounded for large review chunks and conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Cap persisted `rawResponse` length and add metadata such as `rawResponseTruncated` and `rawResponseOmittedBytes`, or store only parsed proposals plus a bounded excerpt for diagnostics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 1. Deduplicate Work Unit Metadata
**Finding key:** loop-e82241f7a9f7940b6fe3
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`  
**Requirement:** R8  
**Issue:** The artifact stores the same metadata twice: `identity.unitId` duplicates top-level `unitId`, `identity.targetFiles` duplicates top-level `targetFiles`, and `identity.providerIdentity`/`promptVersion`/`schemaVersion` duplicate top-level fields. This creates avoidable drift risk across generated review-history files.  
**Suggestion:** Keep immutable identity fields under `identity` and remove the duplicated top-level copies, or make the top-level fields the canonical source and reduce `identity` to only identity-specific fields such as `stableOrderKey`, `parentUnitId`, and `commandId`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`  
**Requirement:** R8  
**Issue:** The artifact stores the same metadata twice: `identity.unitId` duplicates top-level `unitId`, `identity.targetFiles` duplicates top-level `targetFiles`, and `identity.providerIdentity`/`promptVersion`/`schemaVersion` duplicate top-level fields. This creates avoidable drift risk across generated review-history files.  
**Suggestion:** Keep immutable identity fields under `identity` and remove the duplicated top-level copies, or make the top-level fields the canonical source and reduce `identity` to only identity-specific fields such as `stableOrderKey`, `parentUnitId`, and `commandId`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 2. Avoid Persisting Raw And Parsed Proposal Copies
**Finding key:** loop-627f77111ec16d236a1e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`  
**Requirement:** R8  
**Issue:** `rawResponse` contains the full proposal text, while `success.proposals[]` stores the same proposals again as parsed objects. This duplicates large text payloads and can become inconsistent if parsing or normalization changes.  
**Suggestion:** Persist only `success.proposals[]` as the canonical review result. If raw provider output is needed for debugging, store it behind an explicit debug/provenance field with a retention policy or omit it after successful parsing.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`  
**Requirement:** R8  
**Issue:** `rawResponse` contains the full proposal text, while `success.proposals[]` stores the same proposals again as parsed objects. This duplicates large text payloads and can become inconsistent if parsing or normalization changes.  
**Suggestion:** Persist only `success.proposals[]` as the canonical review result. If raw provider output is needed for debugging, store it behind an explicit debug/provenance field with a retention policy or omit it after successful parsing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 3. Normalize Repeated Work Unit Shape
**Finding key:** loop-f771ad4cadeaa4e8fce9
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`  
**Requirement:** R8  
**Issue:** This file repeats the same structural boilerplate as the other work-unit artifacts: version, phase, kind, provider identity, prompt version, schema version, target files, and timing fields. The repeated schema shape makes generated artifacts verbose and harder to inspect.  
**Suggestion:** Move shared run metadata into a batch-level manifest, and keep each chunk file focused on chunk-specific fields such as `unitId`, `stableOrderKey`, `inputHash`, `targetFiles`, status, and parsed proposals.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`  
**Requirement:** R8  
**Issue:** This file repeats the same structural boilerplate as the other work-unit artifacts: version, phase, kind, provider identity, prompt version, schema version, target files, and timing fields. The repeated schema shape makes generated artifacts verbose and harder to inspect.  
**Suggestion:** Move shared run metadata into a batch-level manifest, and keep each chunk file focused on chunk-specific fields such as `unitId`, `stableOrderKey`, `inputHash`, `targetFiles`, status, and parsed proposals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 4. Remove Redundant Number Prefixes From Proposal Titles
**Finding key:** loop-85f111b14b7ac2b1c922
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`  
**Requirement:** R8  
**Issue:** Each parsed proposal `title` includes the display index, such as `"1. Remove Duplicated Overview Statements"`, while the array order already represents proposal ordering. Persisting presentation numbering inside the data field makes titles less reusable and can become stale if proposals are reordered.  
**Suggestion:** Store titles without numeric prefixes and let renderers add numbering from array position.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`  
**Requirement:** R8  
**Issue:** Each parsed proposal `title` includes the display index, such as `"1. Remove Duplicated Overview Statements"`, while the array order already represents proposal ordering. Persisting presentation numbering inside the data field makes titles less reusable and can become stale if proposals are reordered.  
**Suggestion:** Store titles without numeric prefixes and let renderers add numbering from array position.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 65. 5. Use Consistent Naming For Provider Result Fields
**Finding key:** loop-871dabb90f3f67430d62
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/591b4feebb7073ebc2e7b66d.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/591b4feebb7073ebc2e7b66d.json`  
**Requirement:** R8  
**Issue:** The file uses both `providerIdentity` and `success.proposals[].requirementId`, while the raw Markdown uses `Requirement`. The mix of provider-oriented and domain-oriented naming is acceptable individually, but the persisted schema would be clearer if parsed review output used consistently domain-specific names.  
**Suggestion:** Keep provider execution metadata under a `provider` or `execution` object, and keep review data under `result` with consistently named fields such as `requirementId`, `file`, `title`, `issue`, and `suggestion`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/591b4feebb7073ebc2e7b66d.json`  
**Requirement:** R8  
**Issue:** The file uses both `providerIdentity` and `success.proposals[].requirementId`, while the raw Markdown uses `Requirement`. The mix of provider-oriented and domain-oriented naming is acceptable individually, but the persisted schema would be clearer if parsed review output used consistently domain-specific names.  
**Suggestion:** Keep provider execution metadata under a `provider` or `execution` object, and keep review data under `result` with consistently named fields such as `requirementId`, `file`, `title`, `issue`, and `suggestion`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 66. 6. Add Explicit Bound To Raw Response Storage
**Finding key:** loop-27c39fcc1fbcc648e0ab
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R8  
**Issue:** `rawResponse` can hold arbitrarily large provider output, and the artifact format does not show an explicit size bound. Under the bounded-resource-usage guardrail, persisted bulk text should have a clear cap.  
**Suggestion:** Enforce a maximum stored `rawResponse` length, truncate with an explicit marker, or persist only a digest/reference once parsing succeeds.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R8  
**Issue:** `rawResponse` can hold arbitrarily large provider output, and the artifact format does not show an explicit size bound. Under the bounded-resource-usage guardrail, persisted bulk text should have a clear cap.  
**Suggestion:** Enforce a maximum stored `rawResponse` length, truncate with an explicit marker, or persist only a digest/reference once parsing succeeds.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 67. 1. Remove duplicated `targetFiles` metadata
**Finding key:** loop-6a49b2b6c87ee65915cf
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R8  
**Issue:** `targetFiles` is stored twice: once at the top level and again under `identity.targetFiles`, with identical values. This duplication appears across the new work-unit artifacts and can drift if one copy is updated independently.  
**Suggestion:** Keep `targetFiles` in one canonical location, preferably under `identity` if it is part of the stable identity hash, and have consumers read from that location.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R8  
**Issue:** `targetFiles` is stored twice: once at the top level and again under `identity.targetFiles`, with identical values. This duplication appears across the new work-unit artifacts and can drift if one copy is updated independently.  
**Suggestion:** Keep `targetFiles` in one canonical location, preferably under `identity` if it is part of the stable identity hash, and have consumers read from that location.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 68. 2. Remove duplicated unit identity fields
**Finding key:** loop-58165ba37303e00c74b7
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/8dd631de9065ac75b1dfdc57.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/8dd631de9065ac75b1dfdc57.json`  
**Requirement:** R8  
**Issue:** `unitId` appears both at the top level and inside `identity.unitId`, while `phase`, `kind`, and other metadata are similarly repeated. This makes each artifact noisier and creates unnecessary consistency obligations.  
**Suggestion:** Store immutable identity data once under `identity`, and keep only operational fields such as `status`, `attemptCount`, `startedAt`, and `finishedAt` at the top level.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/8dd631de9065ac75b1dfdc57.json`  
**Requirement:** R8  
**Issue:** `unitId` appears both at the top level and inside `identity.unitId`, while `phase`, `kind`, and other metadata are similarly repeated. This makes each artifact noisier and creates unnecessary consistency obligations.  
**Suggestion:** Store immutable identity data once under `identity`, and keep only operational fields such as `status`, `attemptCount`, `startedAt`, and `finishedAt` at the top level.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 69. 3. Avoid storing the same proposals twice
**Finding key:** loop-72aeb45a70f974161759
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/bd3798396b2128f722503801.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R8  
**Issue:** The proposal content is duplicated in `rawResponse` and again in structured form under `success.proposals[].body`. This creates two sources of truth for the same review output.  
**Suggestion:** Keep the structured `success.proposals` as canonical and omit `rawResponse`, or store only a raw-response hash/debug reference if auditability is required.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R8  
**Issue:** The proposal content is duplicated in `rawResponse` and again in structured form under `success.proposals[].body`. This creates two sources of truth for the same review output.  
**Suggestion:** Keep the structured `success.proposals` as canonical and omit `rawResponse`, or store only a raw-response hash/debug reference if auditability is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 70. 5. Use a shared work-unit artifact schema
**Finding key:** loop-0b22e4ea4e6ab7225b07
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R8  
**Issue:** Each new work-unit file repeats the same metadata shape and many identical fields: `version`, `phase`, `kind`, `providerIdentity`, `promptVersion`, `schemaVersion`, `status`, timestamps, and nested identity data. The repeated JSON boilerplate increases generated diff size and makes schema changes expensive.  
**Suggestion:** Emit a compact canonical work-unit record with only per-unit data, or move repeated command/provider/schema metadata into a parent run manifest referenced by each work unit.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R8  
**Issue:** Each new work-unit file repeats the same metadata shape and many identical fields: `version`, `phase`, `kind`, `providerIdentity`, `promptVersion`, `schemaVersion`, `status`, timestamps, and nested identity data. The repeated JSON boilerplate increases generated diff size and makes schema changes expensive.  
**Suggestion:** Emit a compact canonical work-unit record with only per-unit data, or move repeated command/provider/schema metadata into a parent run manifest referenced by each work unit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 71. 4. Normalize proposal title storage
**Finding key:** loop-3e9e3cc55eb68af92d3a
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R8  
**Issue:** `success.proposals[].title` includes the ordinal prefix, for example `"1. Remove duplicated finding bodies from JSON history"`, while the array position already provides ordering. This mixes display formatting into data.  
**Suggestion:** Store titles without numeric prefixes and let renderers add numbering when producing Markdown.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R8  
**Issue:** `success.proposals[].title` includes the ordinal prefix, for example `"1. Remove duplicated finding bodies from JSON history"`, while the array position already provides ordering. This mixes display formatting into data.  
**Suggestion:** Store titles without numeric prefixes and let renderers add numbering when producing Markdown.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 72. 7. Prefer canonical requirement fields over duplicated embedded text
**Finding key:** loop-d31925d751d76db12c39
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/d85e17476af5711ba3ad8791.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/d85e17476af5711ba3ad8791.json`  
**Requirement:** R8  
**Issue:** Each proposal stores `requirementId` structurally, but the same requirement is also embedded inside `body` as `**Requirement:** ...`. The same applies to `file`, which is both a structured field and Markdown text.  
**Suggestion:** Keep `file` and `requirementId` only as structured fields, and generate the Markdown body from those fields when rendering review output.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/d85e17476af5711ba3ad8791.json`  
**Requirement:** R8  
**Issue:** Each proposal stores `requirementId` structurally, but the same requirement is also embedded inside `body` as `**Requirement:** ...`. The same applies to `file`, which is both a structured field and Markdown text.  
**Suggestion:** Keep `file` and `requirementId` only as structured fields, and generate the Markdown body from those fields when rendering review output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 73. 6. Bound retained raw model output
**Finding key:** loop-c226f0b90379d5713c1c
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/review-history/work-units/impl-review/f11405f01831676c001ddd2a.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/f11405f01831676c001ddd2a.json`  
**Requirement:** R8  
**Issue:** `rawResponse` stores full Markdown model output inline. As review loops grow, retaining complete raw responses in every work-unit artifact can grow without an obvious cap, especially because the same content is also stored structurally. This violates the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit retention policy for raw responses, such as keeping only the latest N raw outputs, truncating to a fixed character limit, or replacing raw text with a digest plus structured proposals.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/review-history/work-units/impl-review/f11405f01831676c001ddd2a.json`  
**Requirement:** R8  
**Issue:** `rawResponse` stores full Markdown model output inline. As review loops grow, retaining complete raw responses in every work-unit artifact can grow without an obvious cap, especially because the same content is also stored structurally. This violates the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit retention policy for raw responses, such as keeping only the latest N raw outputs, truncating to a fixed character limit, or replacing raw text with a digest plus structured proposals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 74. 4. Consolidate Repeated Evidence Blocks
**Finding key:** loop-c056b990cfa7aad8f4d1
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/scenario-validity-result.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats identical `test_file`, `command`, and `raw_output_lines` values. That duplication increases file size and makes future updates error-prone if the command or output range changes.  
**Suggestion:** Store shared evidence once at the top level, and keep each requirement entry focused on `id`, `classification`, and `test_name`, if the consuming schema allows it.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats identical `test_file`, `command`, and `raw_output_lines` values. That duplication increases file size and makes future updates error-prone if the command or output range changes.  
**Suggestion:** Store shared evidence once at the top level, and keep each requirement entry focused on `id`, `classification`, and `test_name`, if the consuming schema allows it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 75. 1. Remove Stale Failing Gate Artifact
**Finding key:** loop-3f7f607fff764b845473
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** This file records `"result": "fail"` for schema validation, while `spec-review.json` reports PASS and `spec.json` says the spec was auto-approved after spec gate PASS. Keeping contradictory generated gate outputs makes the change set harder to review and can mislead later automation or humans.  
**Suggestion:** Regenerate or remove the stale gate-source artifact so committed spec evidence has one consistent gate state.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** This file records `"result": "fail"` for schema validation, while `spec-review.json` reports PASS and `spec.json` says the spec was auto-approved after spec gate PASS. Keeping contradictory generated gate outputs makes the change set harder to review and can mislead later automation or humans.  
**Suggestion:** Regenerate or remove the stale gate-source artifact so committed spec evidence has one consistent gate state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 76. 2. Fix Overlong Decision Text Before Regenerating
**Finding key:** loop-1c4382c55cfa0c167872
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.json`  
**Requirement:** R8  
**Issue:** `spec-gate-source.json` reports `overview.decisions[3].text` exceeds the schema max length of 500 characters. Even if later review passed, the checked-in `spec.json` still contains a very long decision entry that appears to be the source of the gate failure.  
**Suggestion:** Split that decision into two shorter decisions or move detail into `evidence`, then regenerate `spec.md` and gate artifacts.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.json`  
**Requirement:** R8  
**Issue:** `spec-gate-source.json` reports `overview.decisions[3].text` exceeds the schema max length of 500 characters. Even if later review passed, the checked-in `spec.json` still contains a very long decision entry that appears to be the source of the gate failure.  
**Suggestion:** Split that decision into two shorter decisions or move detail into `evidence`, then regenerate `spec.md` and gate artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 77. 3. Remove Empty Placeholder Sections
**Finding key:** loop-6cc169677641bdd8e58b
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** `## Clarifications (Q&A)` contains empty `Q` and `A` bullets, and `## Open Questions` contains an empty checkbox. These are dead placeholders that add noise without carrying reviewable information.  
**Suggestion:** Omit empty rendered sections when `clarifications` and `open_questions` are empty, or regenerate after adjusting the renderer/source so empty placeholders are not emitted.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** `## Clarifications (Q&A)` contains empty `Q` and `A` bullets, and `## Open Questions` contains an empty checkbox. These are dead placeholders that add noise without carrying reviewable information.  
**Suggestion:** Omit empty rendered sections when `clarifications` and `open_questions` are empty, or regenerate after adjusting the renderer/source so empty placeholders are not emitted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 78. 5. Deduplicate Repeated Gate Findings
**Finding key:** loop-7aeae095bbf895843d1f
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/task-impl-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R7  
**Issue:** The same no-overengineering finding appears multiple times across `evaluations` and `observations`, with repeated rationale text and closely overlapping locators. This makes the gate output noisy and obscures the single actionable issue.  
**Suggestion:** Collapse duplicate findings by fingerprint/findingId and keep one canonical observation per distinct issue, with multiple locators only if needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R7  
**Issue:** The same no-overengineering finding appears multiple times across `evaluations` and `observations`, with repeated rationale text and closely overlapping locators. This makes the gate output noisy and obscures the single actionable issue.  
**Suggestion:** Collapse duplicate findings by fingerprint/findingId and keep one canonical observation per distinct issue, with multiple locators only if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 79. 1. Deduplicate repeated evidence command/path blocks
**Finding key:** loop-f0b1897001ff5573d9ab
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-execute-result.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `test_file`, `command`, and `raw_output_lines` values. This makes the artifact noisy and increases the chance of inconsistent evidence metadata when one entry is updated.  
**Suggestion:** Move shared execution metadata to a top-level `execution` object, and let each requirement summary keep only requirement-specific fields such as `id`, `result`, and `test_name`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `test_file`, `command`, and `raw_output_lines` values. This makes the artifact noisy and increases the chance of inconsistent evidence metadata when one entry is updated.  
**Suggestion:** Move shared execution metadata to a top-level `execution` object, and let each requirement summary keep only requirement-specific fields such as `id`, `result`, and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 80. 2. Align test file paths across coverage artifacts
**Finding key:** loop-85e68d68ca6c6c998bc6
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-coverage.json`  
**Requirement:** R8  
**Issue:** `test-coverage.json` refers to `tests/required-hook-failure-policy.test.js`, while `test-execute-result.json` uses `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`. The inconsistent path style makes cross-artifact comparison harder.  
**Suggestion:** Use the same normalized project-relative path format in both artifacts, preferably `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-coverage.json`  
**Requirement:** R8  
**Issue:** `test-coverage.json` refers to `tests/required-hook-failure-policy.test.js`, while `test-execute-result.json` uses `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`. The inconsistent path style makes cross-artifact comparison harder.  
**Suggestion:** Use the same normalized project-relative path format in both artifacts, preferably `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 81. 3. Avoid duplicating advisory rationale text
**Finding key:** loop-cf1a1b2c279a9fc2a4f1
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.json`  
**Requirement:** R8  
**Issue:** The advisory finding repeats identical text in both `rationale` and `whyNonBlocking`. This adds maintenance noise without adding distinct information.  
**Suggestion:** Keep the explanatory text in `rationale`, and make `whyNonBlocking` either a short non-duplicative summary or omit it if the schema allows.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.json`  
**Requirement:** R8  
**Issue:** The advisory finding repeats identical text in both `rationale` and `whyNonBlocking`. This adds maintenance noise without adding distinct information.  
**Suggestion:** Keep the explanatory text in `rationale`, and make `whyNonBlocking` either a short non-duplicative summary or omit it if the schema allows.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 82. 4. Shorten oversized task test strategy text
**Finding key:** loop-f4ccad2dd32bd0048e0a
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tasks/T-3.md
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/tasks/T-3.md`  
**Requirement:** R6  
**Issue:** The `Test Strategy` section is a single long sentence listing many state surfaces, which makes the generated task harder to scan and review.  
**Suggestion:** Split the strategy into concise bullets for prepare and finalize-cleanup atomicity checks while preserving the same required surfaces.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tasks/T-3.md`  
**Requirement:** R6  
**Issue:** The `Test Strategy` section is a single long sentence listing many state surfaces, which makes the generated task harder to scan and review.  
**Suggestion:** Split the strategy into concise bullets for prepare and finalize-cleanup atomicity checks while preserving the same required surfaces.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 83. 1. Remove Committed Raw Test Logs
**Finding key:** loop-1089878a1b0da6546d5a
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/.raw/scenario-validity.log
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This is a generated failure log, not source or an assertion artifact. It is large, duplicates test output, contains absolute local paths, and will become stale as soon as tests or line numbers change.  
**Suggestion:** Do not commit `.raw/*.log` outputs. Keep the executable spec test as the durable artifact and regenerate logs during the workflow when needed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This is a generated failure log, not source or an assertion artifact. It is large, duplicates test output, contains absolute local paths, and will become stale as soon as tests or line numbers change.  
**Suggestion:** Do not commit `.raw/*.log` outputs. Keep the executable spec test as the durable artifact and regenerate logs during the workflow when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 84. 2. Remove Passing Test Execution Log
**Finding key:** loop-c25373507ed464f23fce
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/.raw/test-execution.log
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/.raw/test-execution.log`  
**Requirement:** R8  
**Issue:** This committed generated log duplicates the test suite’s pass/fail state and timing data. It adds churn without improving regression coverage.  
**Suggestion:** Exclude `.raw/test-execution.log` from the change set, or replace raw logs with a concise generated summary only if the spec workflow requires persisted evidence.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/.raw/test-execution.log`  
**Requirement:** R8  
**Issue:** This committed generated log duplicates the test suite’s pass/fail state and timing data. It adds churn without improving regression coverage.  
**Suggestion:** Exclude `.raw/test-execution.log` from the change set, or replace raw logs with a concise generated summary only if the spec workflow requires persisted evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 85. 3. Consolidate Finalize Hook Fixture Writing
**Finding key:** loop-cca3bcb07adec1233034
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R8  
**Issue:** The finalize hook fixture source is manually repeated in multiple tests, while `writeHook()` is hard-coded to `hooks/prepare.js`. This creates duplication across required finalize, worktree finalize, and structured finalize tests.  
**Suggestion:** Generalize `writeHook(projectRoot, source, name = "prepare.js")` or add `writeFinalizeHook(projectRoot, className, body, policy = "required")`, then use it for all finalize hook fixtures.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R8  
**Issue:** The finalize hook fixture source is manually repeated in multiple tests, while `writeHook()` is hard-coded to `hooks/prepare.js`. This creates duplication across required finalize, worktree finalize, and structured finalize tests.  
**Suggestion:** Generalize `writeHook(projectRoot, source, name = "prepare.js")` or add `writeFinalizeHook(projectRoot, className, body, policy = "required")`, then use it for all finalize hook fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 86. 4. Reuse Snapshot Construction Helpers
**Finding key:** loop-f5b14ebcd83042227350
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R1  
**Issue:** Snapshot objects are repeated inline throughout the test file with the same `pluginId`, `module`, `className`, `command`, `hook`, `priority`, and `failurePolicy` shape. That makes policy coverage noisy and easy to accidentally drift.  
**Suggestion:** Add a small `hookSnapshot(overrides = {})` helper and use it in registry/lifecycle tests. This keeps each test focused on the changed fields.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R1  
**Issue:** Snapshot objects are repeated inline throughout the test file with the same `pluginId`, `module`, `className`, `command`, `hook`, `priority`, and `failurePolicy` shape. That makes policy coverage noisy and easy to accidentally drift.  
**Suggestion:** Add a small `hookSnapshot(overrides = {})` helper and use it in registry/lifecycle tests. This keeps each test focused on the changed fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 87. 5. Deduplicate Plugin Lifecycle Failure Envelope Builders
**Finding key:** loop-d18f9a25881c6ce811e1
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** `finalizePluginLifecycleFailure()`, `finalizeRequiredPluginHookFailure()`, and the inline required-hook failure block in `runTeardownTransactionOwned()` all build near-identical finalize-cleanup failure envelopes.  
**Suggestion:** Make `finalizeRequiredPluginHookFailure(pluginLifecycle)` the single helper for required hook failures and use it from `runTeardownTransactionOwned()` as well, wrapping with `failBeforeCommit(...)` where rollback is needed.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** `finalizePluginLifecycleFailure()`, `finalizeRequiredPluginHookFailure()`, and the inline required-hook failure block in `runTeardownTransactionOwned()` all build near-identical finalize-cleanup failure envelopes.  
**Suggestion:** Make `finalizeRequiredPluginHookFailure(pluginLifecycle)` the single helper for required hook failures and use it from `runTeardownTransactionOwned()` as well, wrapping with `failBeforeCommit(...)` where rollback is needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 88. 6. Make Lifecycle Composition Naming Consistent
**Finding key:** loop-3bd389c2761b82593a23
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `composeFinalizePluginLifecycle(pre, post)` expects `pre`/`post` objects from `runFlowCommandHooks`, but returns a lifecycle-shaped object whose fields differ slightly from `runFlowCommandWithPluginLifecycle()`’s composition path in `plugin-registry.js`. The naming makes it harder to tell whether values are hook outcomes or lifecycle results.  
**Suggestion:** Rename parameters to `preHooks` and `postHooks`, and consider matching the registry helper naming (`composePluginLifecycleResult`) to reduce mental mapping between the two implementations.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `composeFinalizePluginLifecycle(pre, post)` expects `pre`/`post` objects from `runFlowCommandHooks`, but returns a lifecycle-shaped object whose fields differ slightly from `runFlowCommandWithPluginLifecycle()`’s composition path in `plugin-registry.js`. The naming makes it harder to tell whether values are hook outcomes or lifecycle results.  
**Suggestion:** Rename parameters to `preHooks` and `postHooks`, and consider matching the registry helper naming (`composePluginLifecycleResult`) to reduce mental mapping between the two implementations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 89. 7. Simplify Redundant Try/Catch
**Finding key:** loop-f680b2b6c884228a99f2
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R7  
**Issue:** `writeFlowState()` wraps lifecycle execution in `try { ... } catch (error) { throw error; }`, which does not add handling or context.  
**Suggestion:** Remove the redundant `try/catch` and let errors propagate directly. Keep only the explicit `if (!lifecycle.ok)` conversion to `PLUGIN_HOOK_REQUIRED_FAILED`.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R7  
**Issue:** `writeFlowState()` wraps lifecycle execution in `try { ... } catch (error) { throw error; }`, which does not add handling or context.  
**Suggestion:** Remove the redundant `try/catch` and let errors propagate directly. Keep only the explicit `if (!lifecycle.ok)` conversion to `PLUGIN_HOOK_REQUIRED_FAILED`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 90. 8. Replace Boolean Callback Name With Action-Oriented Name
**Finding key:** loop-346516d8492d9765535b
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `writeFlowState(extra, writePrepareFiles)` names the second parameter like a boolean flag, but it is a callback with durable side effects.  
**Suggestion:** Rename it to `publishPrepareFiles` or `writePrepareFilesFn` so call sites make clear that file publication happens inside the lifecycle main callback.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `writeFlowState(extra, writePrepareFiles)` names the second parameter like a boolean flag, but it is a callback with durable side effects.  
**Suggestion:** Rename it to `publishPrepareFiles` or `writePrepareFilesFn` so call sites make clear that file publication happens inside the lifecycle main callback.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 91. 9. Extract Shared Hook Snapshot Validation Result
**Finding key:** loop-7ed583a4936cde803264
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R1
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R1  
**Issue:** `validateHookClass()` returns a `FlowCommandHookFailurePolicy`, while `validateHookSnapshot()` validates but discards policy objects. The two validation paths now encode the same policy rule with different return behavior.  
**Suggestion:** Add a small `readHookFailurePolicy(value, label)` helper returning the normalized string, and use it from both discovery and snapshot validation. This keeps registration and persisted snapshot loading behavior visibly identical.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R1  
**Issue:** `validateHookClass()` returns a `FlowCommandHookFailurePolicy`, while `validateHookSnapshot()` validates but discards policy objects. The two validation paths now encode the same policy rule with different return behavior.  
**Suggestion:** Add a small `readHookFailurePolicy(value, label)` helper returning the normalized string, and use it from both discovery and snapshot validation. This keeps registration and persisted snapshot loading behavior visibly identical.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 92. 10. Bound Hook Snapshot Iteration Explicitly
**Finding key:** loop-145739c8dabc2d349c8a
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R1
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R1  
**Issue:** `validateHookSnapshot(snapshot)` iterates whatever snapshot array it receives without an explicit count bound. Under the bounded-resource guardrail, bulk processing should have clear limits.  
**Suggestion:** Introduce a maximum hook snapshot count constant and reject snapshots above it before validation/execution, or reuse an existing plugin registry bound if one already exists in this file.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R1  
**Issue:** `validateHookSnapshot(snapshot)` iterates whatever snapshot array it receives without an explicit count bound. Under the bounded-resource guardrail, bulk processing should have clear limits.  
**Suggestion:** Introduce a maximum hook snapshot count constant and reject snapshots above it before validation/execution, or reuse an existing plugin registry bound if one already exists in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
