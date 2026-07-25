# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Use Consistent Gate Naming
**Finding key:** loop-82d7a80103c820b5874f
**Failure mode:** refactor
**File:** .senti/presets/base/guardrail.json
**Requirement:** R1
**Issue:** **File:** `.senti/presets/base/guardrail.json`  
**Requirement:** R1  
**Issue:** The new `spec-test-coverage` text mixes “current integration gate,” “current-step-owned,” and `task-impl` terminology. Since the guardrail metadata phase is `task-impl`, this creates avoidable ambiguity about which lifecycle owner is being described.  
**Suggestion:** Rewrite the added block to consistently refer to the `task-impl` gate, and reserve `test-execute`, `test-result-review`, and `final-regression` only for the downstream lifecycle steps.
**Suggestion:** **File:** `.senti/presets/base/guardrail.json`  
**Requirement:** R1  
**Issue:** The new `spec-test-coverage` text mixes “current integration gate,” “current-step-owned,” and `task-impl` terminology. Since the guardrail metadata phase is `task-impl`, this creates avoidable ambiguity about which lifecycle owner is being described.  
**Suggestion:** Rewrite the added block to consistently refer to the `task-impl` gate, and reserve `test-execute`, `test-result-review`, and `final-regression` only for the downstream lifecycle steps.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Reduce Duplicated Lifecycle Evidence Language
**Finding key:** loop-6d29e7fd9858b7f3257a
**Failure mode:** refactor
**File:** .senti/presets/base/guardrail.json
**Requirement:** R1
**Issue:** **File:** `.senti/presets/base/guardrail.json`  
**Requirement:** R1  
**Issue:** Both `spec-test-coverage` and `project-test-integrity` now describe the same design rule: `task-impl` inspects diff coverage, while runtime evidence belongs to later lifecycle steps. The repeated wording can drift over time.  
**Suggestion:** Standardize the phrasing between the two guardrail bodies, using the same concise sentence structure for “task-impl checks diff coverage only” and “runtime pass/fail is owned by later steps.”
**Suggestion:** **File:** `.senti/presets/base/guardrail.json`  
**Requirement:** R1  
**Issue:** Both `spec-test-coverage` and `project-test-integrity` now describe the same design rule: `task-impl` inspects diff coverage, while runtime evidence belongs to later lifecycle steps. The repeated wording can drift over time.  
**Suggestion:** Standardize the phrasing between the two guardrail bodies, using the same concise sentence structure for “task-impl checks diff coverage only” and “runtime pass/fail is owned by later steps.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Use Consistent Metadata Across Review Artifacts
**Finding key:** loop-6602f71223769724326e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-repair.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but the new triage and repair artifacts do not. If these files are part of the same review artifact family, the metadata pattern is inconsistent.  
**Suggestion:** Add a `generatedAt` timestamp to `draft-questions-repair.json` using the same ISO timestamp format as `draft-review-coverage.json`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but the new triage and repair artifacts do not. If these files are part of the same review artifact family, the metadata pattern is inconsistent.  
**Suggestion:** Add a `generatedAt` timestamp to `draft-questions-repair.json` using the same ISO timestamp format as `draft-review-coverage.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Remove Ordinal Prefixes From Item Titles
**Finding key:** loop-86f5d830320cc568410f
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-triage.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds a numeric prefix like `"1. q2..."` even though ordering is already represented by array position. This duplicates structure in data and can become stale if items are reordered.  
**Suggestion:** Rename titles to stable descriptive values such as `"q2 includes recommendation and rationale"` and `"q3 includes recommendation and rationale"`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds a numeric prefix like `"1. q2..."` even though ordering is already represented by array position. This duplicates structure in data and can become stale if items are reordered.  
**Suggestion:** Rename titles to stable descriptive values such as `"q2 includes recommendation and rationale"` and `"q3 includes recommendation and rationale"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Use Consistent Metadata Across Review Artifacts
**Finding key:** loop-f022e59794b81d09bbf0
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-triage.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but this triage artifact omits it. That makes provenance and ordering less consistent across generated review outputs.  
**Suggestion:** Add a `generatedAt` timestamp field using the same format and placement convention as `draft-review-coverage.json`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but this triage artifact omits it. That makes provenance and ordering less consistent across generated review outputs.  
**Suggestion:** Add a `generatedAt` timestamp field using the same format and placement convention as `draft-review-coverage.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Remove Stale Review Artifact From Change Set
**Finding key:** loop-77b8bf16fe8f6e567d9c
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-review-questions.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R5  
**Issue:** This file records transient review findings for an intermediate draft state. Since `draft.json` already contains the repaired questions, keeping the advisory repair-target artifact adds stale process noise and duplicates history that is no longer actionable.  
**Suggestion:** Remove this generated review artifact from the final diff, or regenerate it only if the repository intentionally tracks every intermediate review output.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R5  
**Issue:** This file records transient review findings for an intermediate draft state. Since `draft.json` already contains the repaired questions, keeping the advisory repair-target artifact adds stale process noise and duplicates history that is no longer actionable.  
**Suggestion:** Remove this generated review artifact from the final diff, or regenerate it only if the repository intentionally tracks every intermediate review output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Deduplicate Repeated QA Policy Text
**Finding key:** loop-995d27c43fd402d25180
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft.json
**Requirement:** R3
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R3  
**Issue:** The same policy appears in multiple places: `decisionMap.knownFacts`, `scopeVerification`, `impactOnExisting`, and `qa` all restate that recovery is limited to valid, mutually consistent repair fingerprints and must preserve existing guards. This increases maintenance cost because future edits must keep several Japanese prose copies aligned.  
**Suggestion:** Keep the canonical policy in one section, preferably `decisionMap.knownFacts` or `qa`, and have the other sections reference the decision at a higher level instead of repeating the full boundary conditions.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R3  
**Issue:** The same policy appears in multiple places: `decisionMap.knownFacts`, `scopeVerification`, `impactOnExisting`, and `qa` all restate that recovery is limited to valid, mutually consistent repair fingerprints and must preserve existing guards. This increases maintenance cost because future edits must keep several Japanese prose copies aligned.  
**Suggestion:** Keep the canonical policy in one section, preferably `decisionMap.knownFacts` or `qa`, and have the other sections reference the decision at a higher level instead of repeating the full boundary conditions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Prune Volatile Runtime History
**Finding key:** loop-1860cbd0ab8d09130f9d
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R5  
**Issue:** `flow.json` includes very large volatile sections such as `metrics`, repeated agent call records, lock/tooling errors, runtime logs, and historical review convergence data. This makes the spec diff noisy and hard to review, while most of the content is execution telemetry rather than durable project intent.  
**Suggestion:** Keep only durable flow state needed to resume or audit the current feature, and move verbose runtime telemetry to ignored/generated evidence files if the workflow supports it.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R5  
**Issue:** `flow.json` includes very large volatile sections such as `metrics`, repeated agent call records, lock/tooling errors, runtime logs, and historical review convergence data. This makes the spec diff noisy and hard to review, while most of the content is execution telemetry rather than durable project intent.  
**Suggestion:** Keep only durable flow state needed to resume or audit the current feature, and move verbose runtime telemetry to ignored/generated evidence files if the workflow supports it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Add Explicit Bounds To Recorded History
**Finding key:** loop-3595aba3c4e7d97d14c5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R7  
**Issue:** The file records growing arrays such as `metrics`, `reviewConvergence.records`, `evidenceHistory`, and `stepAttempts` without any visible retention limit. This conflicts with the bounded-resource-usage guardrail when the persisted flow state can grow indefinitely across retries and review runs.  
**Suggestion:** Add an explicit retention policy or persisted cap for these arrays, such as max entries per phase and max evidence history length, and store overflow in separately addressed artifacts if full history is required.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R7  
**Issue:** The file records growing arrays such as `metrics`, `reviewConvergence.records`, `evidenceHistory`, and `stepAttempts` without any visible retention limit. This conflicts with the bounded-resource-usage guardrail when the persisted flow state can grow indefinitely across retries and review runs.  
**Suggestion:** Add an explicit retention policy or persisted cap for these arrays, such as max entries per phase and max evidence history length, and store overflow in separately addressed artifacts if full history is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Remove Generated Attempt History From Source Diff
**Finding key:** loop-c82e86f964acfaa3aadd
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** The new `issue-log.json` is a 400-line chronological tooling log with repeated gate failures, repair attempts, timestamps, UUIDs, and transient execution details. This is noisy, hard to review, and likely to become stale immediately.  
**Suggestion:** Keep only durable issue evidence needed by the spec, or move transient run history into generated artifacts that are not committed. If an audit trail is required, collapse repeated entries into a small structured summary keyed by lifecycle step and final resolution.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** The new `issue-log.json` is a 400-line chronological tooling log with repeated gate failures, repair attempts, timestamps, UUIDs, and transient execution details. This is noisy, hard to review, and likely to become stale immediately.  
**Suggestion:** Keep only durable issue evidence needed by the spec, or move transient run history into generated artifacts that are not committed. If an audit trail is required, collapse repeated entries into a small structured summary keyed by lifecycle step and final resolution.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Normalize Duplicate Identifiers In Issue Log
**Finding key:** loop-f25c803d12f5c3f03b3e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** Several entries repeat the same `normalizedFindingId` and very similar reasons/resolutions, especially around R8/final-regression and `4d552...` / `2291...`. This makes the log harder to consume programmatically and obscures the actual final state.  
**Suggestion:** Consolidate repeated findings into a single entry with an `attempts` count or `relatedIssueLogIds` array, keeping the final resolution as the primary record.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** Several entries repeat the same `normalizedFindingId` and very similar reasons/resolutions, especially around R8/final-regression and `4d552...` / `2291...`. This makes the log harder to consume programmatically and obscures the actual final state.  
**Suggestion:** Consolidate repeated findings into a single entry with an `attempts` count or `relatedIssueLogIds` array, keeping the final resolution as the primary record.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Deduplicate English And Japanese Issue Content
**Finding key:** loop-1f78398381fa04bc642e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue.md`  
**Requirement:** R1  
**Issue:** The Japanese `<details>` section duplicates the full English issue: symptom, problem, evidence, proposal, target, and completion criteria. This doubles maintenance cost and creates drift risk when one version is updated without the other.  
**Suggestion:** Keep one authoritative version of the technical requirements, and make the localized section a concise summary or link/reference to the canonical sections above.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue.md`  
**Requirement:** R1  
**Issue:** The Japanese `<details>` section duplicates the full English issue: symptom, problem, evidence, proposal, target, and completion criteria. This doubles maintenance cost and creates drift risk when one version is updated without the other.  
**Suggestion:** Keep one authoritative version of the technical requirements, and make the localized section a concise summary or link/reference to the canonical sections above.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Pretty-print spec evidence JSON
**Finding key:** loop-bbe8665a6dd390bd2ff2
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`  
**Requirement:** R1  
**Issue:** The PASS spec evidence is also a single-line JSON object. This is less severe here, but inconsistent with review-friendly evidence artifacts once larger fields are added.  
**Suggestion:** Use the same pretty-printed canonical JSON format as the other evidence files.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`  
**Requirement:** R1  
**Issue:** The PASS spec evidence is also a single-line JSON object. This is less severe here, but inconsistent with review-friendly evidence artifacts once larger fields are added.  
**Suggestion:** Use the same pretty-printed canonical JSON format as the other evidence files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Pretty-print dense evidence JSON
**Finding key:** loop-3801c05be518a1080be5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/927ba919f3639bbe049ab1c2d54cbbf6a0bdc8dc3226237bff96259aebdf0589.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/927ba919f3639bbe049ab1c2d54cbbf6a0bdc8dc3226237bff96259aebdf0589.json`  
**Requirement:** R8  
**Issue:** The entire rejected test-phase evidence payload is stored on one very long line, making review of the regression matrix findings difficult and increasing merge-conflict risk.  
**Suggestion:** Format the JSON with stable indentation and key ordering, matching the same data exactly. This keeps generated evidence auditable without changing semantics.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/927ba919f3639bbe049ab1c2d54cbbf6a0bdc8dc3226237bff96259aebdf0589.json`  
**Requirement:** R8  
**Issue:** The entire rejected test-phase evidence payload is stored on one very long line, making review of the regression matrix findings difficult and increasing merge-conflict risk.  
**Suggestion:** Format the JSON with stable indentation and key ordering, matching the same data exactly. This keeps generated evidence auditable without changing semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Pretty-print draft coverage evidence JSON
**Finding key:** loop-61fbe1035c065bf944cb
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/d3443c0c1b6625e4c9fa2e4d730e22b48ea5a1d94812163c343983acb1cef037.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/d3443c0c1b6625e4c9fa2e4d730e22b48ea5a1d94812163c343983acb1cef037.json`  
**Requirement:** R1  
**Issue:** The draft-coverage evidence file repeats the same compact single-line structure, creating avoidable inconsistency and making future diffs noisy if fields are added.  
**Suggestion:** Normalize it to the same stable pretty-printed JSON representation used for all review evidence artifacts.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/d3443c0c1b6625e4c9fa2e4d730e22b48ea5a1d94812163c343983acb1cef037.json`  
**Requirement:** R1  
**Issue:** The draft-coverage evidence file repeats the same compact single-line structure, creating avoidable inconsistency and making future diffs noisy if fields are added.  
**Suggestion:** Normalize it to the same stable pretty-printed JSON representation used for all review evidence artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Format generated JSON consistently
**Finding key:** loop-0e50fec949c936046062
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/dc4975c13f70b83a624d8615ac1ee6fd0890581f9b9a0730c4afada09dc3ddc3.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/dc4975c13f70b83a624d8615ac1ee6fd0890581f9b9a0730c4afada09dc3ddc3.json`  
**Requirement:** R8  
**Issue:** This JSON artifact is stored as a single long line, unlike the other touched JSON files. That makes review diffs noisy and harder to inspect.  
**Suggestion:** Pretty-print this artifact with the same indentation style used by the files under `review-history`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/dc4975c13f70b83a624d8615ac1ee6fd0890581f9b9a0730c4afada09dc3ddc3.json`  
**Requirement:** R8  
**Issue:** This JSON artifact is stored as a single long line, unlike the other touched JSON files. That makes review diffs noisy and harder to inspect.  
**Suggestion:** Pretty-print this artifact with the same indentation style used by the files under `review-history`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Normalize duplicated finding content
**Finding key:** loop-b4eeed946859f4017ba5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R5  
**Issue:** Each repair target repeats the same title, target, evidence, and rationale again under `findings`, creating two parallel representations that can drift.  
**Suggestion:** Keep one canonical finding list and derive `repairTargets` from `findings` by filtering `category: "repair_target"`, or reduce `repairTargets` to lightweight references such as finding IDs.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R5  
**Issue:** Each repair target repeats the same title, target, evidence, and rationale again under `findings`, creating two parallel representations that can drift.  
**Suggestion:** Keep one canonical finding list and derive `repairTargets` from `findings` by filtering `category: "repair_target"`, or reduce `repairTargets` to lightweight references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Avoid conflicting advisory counts
**Finding key:** loop-04bcebbbe88d1a39ab18
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R4  
**Issue:** The file has `verdict: "ADVISORY"` and two repair targets, but the summary says `0 advisory`, while the related review-evidence artifact records two advisory findings. This naming/count mismatch makes the review state harder to reason about.  
**Suggestion:** Use consistent terminology and counts across the artifact, for example `0 blocking, 2 advisory repair target finding(s) recorded.` or rename the verdict/category if repair targets are intentionally distinct from advisory findings.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R4  
**Issue:** The file has `verdict: "ADVISORY"` and two repair targets, but the summary says `0 advisory`, while the related review-evidence artifact records two advisory findings. This naming/count mismatch makes the review state harder to reason about.  
**Suggestion:** Use consistent terminology and counts across the artifact, for example `0 blocking, 2 advisory repair target finding(s) recorded.` or rename the verdict/category if repair targets are intentionally distinct from advisory findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Normalize empty finding field names across review history artifacts
**Finding key:** loop-95c659b3b3c8781a8891
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json`  
**Requirement:** R1  
**Issue:** The spec artifact uses `nonBlockingImprovements`, while the test artifact uses `advisoryFindings`. If these files are consumed by shared review-history tooling, the differing names force avoidable branching.  
**Suggestion:** Use a consistent naming convention for non-blocking/advisory findings across review-history JSON artifacts, or document phase-specific schema differences explicitly in the artifact.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json`  
**Requirement:** R1  
**Issue:** The spec artifact uses `nonBlockingImprovements`, while the test artifact uses `advisoryFindings`. If these files are consumed by shared review-history tooling, the differing names force avoidable branching.  
**Suggestion:** Use a consistent naming convention for non-blocking/advisory findings across review-history JSON artifacts, or document phase-specific schema differences explicitly in the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Add trailing newline
**Finding key:** loop-d472deb221b25b22049e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Add trailing newline
**Finding key:** loop-76b895be85a41ab1b743
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec-review.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec-review.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec-review.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Remove duplicated finding payloads
**Finding key:** loop-3a2440344ed3fbeae9fc
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated fields under slightly different names. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical findings array and derive phase-specific groupings from it, or reduce `blockingFindings` to lightweight references such as finding IDs.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated fields under slightly different names. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical findings array and derive phase-specific groupings from it, or reduce `blockingFindings` to lightweight references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 3. Normalize newline handling
**Finding key:** loop-e42d99abb18b9b7cf9ae
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text-file conventions and can cause noisy diffs.  
**Suggestion:** Add a trailing newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text-file conventions and can cause noisy diffs.  
**Suggestion:** Add a trailing newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Use distinct finding identifiers
**Finding key:** loop-073ea3f26fa870f8c2b8
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R5  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different R7 and R5 issues. This makes deduplication, tracking, and history correlation ambiguous.  
**Suggestion:** Generate stable identifiers from each finding’s own title/body/requirement so the R7 delegated-test finding and R5 missing-review-input finding have distinct IDs.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R5  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different R7 and R5 issues. This makes deduplication, tracking, and history correlation ambiguous.  
**Suggestion:** Generate stable identifiers from each finding’s own title/body/requirement so the R7 delegated-test finding and R5 missing-review-input finding have distinct IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Remove duplicated rationale text inside each finding
**Finding key:** loop-eb672bea4d81f2313843
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R7  
**Issue:** Each `blockingFindings` entry repeats the same sentence in both `rationale` and `whyBlocking`. This is redundant and increases the chance that future edits drift between fields.  
**Suggestion:** Keep one canonical field for the blocking rationale, or make `whyBlocking` a derived rendering-only value instead of storing duplicate text.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R7  
**Issue:** Each `blockingFindings` entry repeats the same sentence in both `rationale` and `whyBlocking`. This is redundant and increases the chance that future edits drift between fields.  
**Suggestion:** Keep one canonical field for the blocking rationale, or make `whyBlocking` a derived rendering-only value instead of storing duplicate text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Normalize newline handling
**Finding key:** loop-fce77c540d272138b7e5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 4. Normalize newline handling
**Finding key:** loop-95363f0e9f1e8cbed3ff
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Use unique finding identifiers
**Finding key:** loop-e72db97906fcc102f5ee
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R7  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different requirements and different missing coverage paths. This makes deduplication, tracking, and history analysis ambiguous.  
**Suggestion:** Generate distinct stable IDs/fingerprints per finding, ideally from requirement ID plus normalized title/body/target.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R7  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different requirements and different missing coverage paths. This makes deduplication, tracking, and history analysis ambiguous.  
**Suggestion:** Generate distinct stable IDs/fingerprints per finding, ideally from requirement ID plus normalized title/body/target.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Remove duplicated finding payloads
**Finding key:** loop-b202bcd3fb89b3d22dc0
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R5  
**Issue:** The same findings are represented twice, once in `blockingFindings` and again in `findings`, with overlapping fields such as title, rationale, disposition, fingerprint, and source metadata. This duplication can drift over time.  
**Suggestion:** Keep one canonical findings array and derive blocking/advisory subsets from severity, or reduce `blockingFindings` to references by finding ID.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R5  
**Issue:** The same findings are represented twice, once in `blockingFindings` and again in `findings`, with overlapping fields such as title, rationale, disposition, fingerprint, and source metadata. This duplication can drift over time.  
**Suggestion:** Keep one canonical findings array and derive blocking/advisory subsets from severity, or reduce `blockingFindings` to references by finding ID.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Align process result naming with exit status
**Finding key:** loop-b3b7642926acf0d0f075
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/scenario-validity-result.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** `process.exitCode` is `1` while top-level `result` is `"pass"`. Because every requirement is classified as `expected_fail`, this may be intentional, but the naming makes the artifact easy to misread as a successful test execution.  
**Suggestion:** Rename or split the status fields, for example `harnessResult: "pass"` and `commandResult: "failed_as_expected"`, or add an explicit `expectedExitCode: 1`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** `process.exitCode` is `1` while top-level `result` is `"pass"`. Because every requirement is classified as `expected_fail`, this may be intentional, but the naming makes the artifact easy to misread as a successful test execution.  
**Suggestion:** Rename or split the status fields, for example `harnessResult: "pass"` and `commandResult: "failed_as_expected"`, or add an explicit `expectedExitCode: 1`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Factor repeated evidence fields
**Finding key:** loop-bddbdf57b8e5d908daea
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/scenario-validity-result.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats identical `test_file`, `command`, and `raw_output_lines` values. This increases artifact size and makes later edits error-prone.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` object and keep only requirement-specific fields such as `id`, `classification`, and `test_name` inside each summary entry.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats identical `test_file`, `command`, and `raw_output_lines` values. This increases artifact size and makes later edits error-prone.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` object and keep only requirement-specific fields such as `id`, `classification`, and `test_name` inside each summary entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Deduplicate Generated Overview Entries
**Finding key:** loop-a576dd57170e3588b25b
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec.json`  
**Requirement:** R1  
**Issue:** `overview.modules` and `overview.data_flow` contain both original entries and `added_by_task` entries that restate the same responsibilities for `test-artifacts.js`, `stale-test-evidence-refresh.js`, and the integration gate flow. This makes the spec harder to scan and increases the chance of drift between overlapping descriptions.  
**Suggestion:** Consolidate the overlapping overview items into single canonical entries per module/data-flow step, preserving the task-specific detail without duplicating the same responsibility in multiple bullets.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec.json`  
**Requirement:** R1  
**Issue:** `overview.modules` and `overview.data_flow` contain both original entries and `added_by_task` entries that restate the same responsibilities for `test-artifacts.js`, `stale-test-evidence-refresh.js`, and the integration gate flow. This makes the spec harder to scan and increases the chance of drift between overlapping descriptions.  
**Suggestion:** Consolidate the overlapping overview items into single canonical entries per module/data-flow step, preserving the task-specific detail without duplicating the same responsibility in multiple bullets.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Remove Empty Placeholder Sections
**Finding key:** loop-3f939e3336debf3d407d
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R8  
**Issue:** The `## Implementation Targets` section contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders in the rendered spec and add noise without actionable content.  
**Suggestion:** Omit empty rendered sections entirely, or render them as an explicit `None` only if the project’s spec format requires the heading.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R8  
**Issue:** The `## Implementation Targets` section contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders in the rendered spec and add noise without actionable content.  
**Suggestion:** Omit empty rendered sections entirely, or render them as an explicit `None` only if the project’s spec format requires the heading.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Deduplicate Rendered Overview Bullets
**Finding key:** loop-e538220eba699431e3fa
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R1  
**Issue:** The rendered `### Modules` and `### Data Flow` sections repeat concepts from earlier bullets, especially structural/outcome separation and staged stale recovery behavior. Since this file is human-facing, the duplication reduces clarity.  
**Suggestion:** Update the source `spec.json` so the renderer emits one concise bullet per distinct module responsibility and one concise bullet per distinct data-flow step.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R1  
**Issue:** The rendered `### Modules` and `### Data Flow` sections repeat concepts from earlier bullets, especially structural/outcome separation and staged stale recovery behavior. Since this file is human-facing, the duplication reduces clarity.  
**Suggestion:** Update the source `spec.json` so the renderer emits one concise bullet per distinct module responsibility and one concise bullet per distinct data-flow step.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Align review phase naming
**Finding key:** loop-24c17e9b7f8709a3883c
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/test-review.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/test-review.json`  
**Requirement:** R8  
**Issue:** The top-level `"phase"` is `"test"`, while the artifact path, `contractSummary.targetStep`, and coverage artifact all refer to `"test-review"`. This creates avoidable naming inconsistency in generated evidence.  
**Suggestion:** Change `"phase": "test"` to `"phase": "test-review"` unless the schema explicitly requires the shorter phase name.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/test-review.json`  
**Requirement:** R8  
**Issue:** The top-level `"phase"` is `"test"`, while the artifact path, `contractSummary.targetStep`, and coverage artifact all refer to `"test-review"`. This creates avoidable naming inconsistency in generated evidence.  
**Suggestion:** Change `"phase": "test"` to `"phase": "test-review"` unless the schema explicitly requires the shorter phase name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Add final newline
**Finding key:** loop-884eb227582fd028693e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/test-review.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact has no trailing newline, which is a small formatting inconsistency and can create unnecessary diff noise.  
**Suggestion:** Add a newline at end of file.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/test-review.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact has no trailing newline, which is a small formatting inconsistency and can create unnecessary diff noise.  
**Suggestion:** Add a newline at end of file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Remove Checked-In Failing Test Log
**Finding key:** loop-a316389bd1f17aa3dad0
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/.raw/scenario-validity.log
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This file is a generated raw test execution log, and it records an all-failing run. Keeping transient failure output in the change set adds noise and can become stale immediately.  
**Suggestion:** Remove this generated `.raw/scenario-validity.log` from the diff, or replace it only with intentionally curated fixture evidence if the test suite explicitly consumes it.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This file is a generated raw test execution log, and it records an all-failing run. Keeping transient failure output in the change set adds noise and can become stale immediately.  
**Suggestion:** Remove this generated `.raw/scenario-validity.log` from the diff, or replace it only with intentionally curated fixture evidence if the test suite explicitly consumes it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Extract Shared Stale Recovery Assertions
**Finding key:** loop-2758f757428060062a70
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js
**Requirement:** R3
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R3  
**Issue:** Recovery expectations are repeated across R3 and R8: checking `result.result === "recovered"` and `result.next === "test-execute"`. R3 also performs a fuller version of the same contract.  
**Suggestion:** Add a small helper such as `assertRecoveredToTestExecute(result)` and reuse it anywhere the recovery contract is asserted.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R3  
**Issue:** Recovery expectations are repeated across R3 and R8: checking `result.result === "recovered"` and `result.next === "test-execute"`. R3 also performs a fuller version of the same contract.  
**Suggestion:** Add a small helper such as `assertRecoveredToTestExecute(result)` and reuse it anywhere the recovery contract is asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Reuse Invalid Authority Case Fixtures
**Finding key:** loop-01363a5cd86c0a17c020
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R5  
**Issue:** Malformed and inconsistent authority cases are defined once in the R5 table and again in the R8 test. This duplicates the same mutation patterns with slightly different labels.  
**Suggestion:** Extract shared case builders, for example `invalidAuthorityCases`, and let R5 and R8 select the cases they need from that list.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R5  
**Issue:** Malformed and inconsistent authority cases are defined once in the R5 table and again in the R8 test. This duplicates the same mutation patterns with slightly different labels.  
**Suggestion:** Extract shared case builders, for example `invalidAuthorityCases`, and let R5 and R8 select the cases they need from that list.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Rename `prepareEvidence` To Reflect Fixture Creation
**Finding key:** loop-2915047ae678c76f3fd1
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R8  
**Issue:** `prepareEvidence` does more than prepare evidence: it creates a repository fixture, writes artifacts, mutates source state, computes fingerprints, and returns paths plus flow state. The name understates the helper’s responsibility.  
**Suggestion:** Rename it to something more explicit, such as `prepareEvidenceFixture` or `prepareStaleEvidenceFixture`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R8  
**Issue:** `prepareEvidence` does more than prepare evidence: it creates a repository fixture, writes artifacts, mutates source state, computes fingerprints, and returns paths plus flow state. The name understates the helper’s responsibility.  
**Suggestion:** Rename it to something more explicit, such as `prepareEvidenceFixture` or `prepareStaleEvidenceFixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 5. Avoid Recomputing Review Tree SHA Per Resolver Call
**Finding key:** loop-b18803d2a31b8d3f3863
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` is passed as a callback that calls `resolveCurrentReviewTreeSha(ctx.root)` each time it is invoked. If `resolveReviewActionForFlowState` calls the resolver more than once, this repeats the same repository lookup.  
**Suggestion:** Compute the tree SHA once before calling `resolveReviewActionForFlowState`, then pass `resolveTreeSha: () => currentReviewTreeSha`.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` is passed as a callback that calls `resolveCurrentReviewTreeSha(ctx.root)` each time it is invoked. If `resolveReviewActionForFlowState` calls the resolver more than once, this repeats the same repository lookup.  
**Suggestion:** Compute the tree SHA once before calling `resolveReviewActionForFlowState`, then pass `resolveTreeSha: () => currentReviewTreeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 1. Memoize review tree SHA resolution
**Finding key:** loop-88498170ab0d97816b9e
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha: () => resolveCurrentReviewTreeSha(root)` may perform repeated filesystem/git evidence resolution if `resolveReviewActionForFlowState` calls the callback more than once. It also risks inconsistent values during one status build if the underlying tree changes mid-call.  
**Suggestion:** Capture a lazy memoized value inside `buildStatusReviewViews`, e.g. `let treeSha; const resolveTreeSha = () => treeSha ??= resolveCurrentReviewTreeSha(root);`, then pass `resolveTreeSha`.
**Suggestion:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha: () => resolveCurrentReviewTreeSha(root)` may perform repeated filesystem/git evidence resolution if `resolveReviewActionForFlowState` calls the callback more than once. It also risks inconsistent values during one status build if the underlying tree changes mid-call.  
**Suggestion:** Capture a lazy memoized value inside `buildStatusReviewViews`, e.g. `let treeSha; const resolveTreeSha = () => treeSha ??= resolveCurrentReviewTreeSha(root);`, then pass `resolveTreeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 2. Avoid repeated invalidation projection work
**Finding key:** loop-9192007ddc2085d91ed0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `RepairEvidenceInvalidationPlan.apply()` computes `invalidatedArtifacts` and `invalidationRecords` through getters that each remap `this.invalidations`. This duplicates traversal and makes the return payload depend on recomputed projections after mutation application.  
**Suggestion:** Compute both arrays once in `apply()` before returning, and return those local values after `applyRepairInvalidations(...)`. This keeps the owned recovery result explicit and avoids redundant work.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `RepairEvidenceInvalidationPlan.apply()` computes `invalidatedArtifacts` and `invalidationRecords` through getters that each remap `this.invalidations`. This duplicates traversal and makes the return payload depend on recomputed projections after mutation application.  
**Suggestion:** Compute both arrays once in `apply()` before returning, and return those local values after `applyRepairInvalidations(...)`. This keeps the owned recovery result explicit and avoids redundant work.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 3. Rename stored invalidation records for clarity
**Finding key:** loop-c9557993b3a17e609b35
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The class field `this.invalidations` contains planned invalidation record objects, while the public return field `invalidations` contains serialized JSON records. The shared name makes it harder to distinguish plan objects from emitted recovery artifact data.  
**Suggestion:** Rename the internal field to `plannedInvalidations` or `invalidationPlanRecords`, and leave the public return key as `invalidations` for compatibility.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The class field `this.invalidations` contains planned invalidation record objects, while the public return field `invalidations` contains serialized JSON records. The shared name makes it harder to distinguish plan objects from emitted recovery artifact data.  
**Suggestion:** Rename the internal field to `plannedInvalidations` or `invalidationPlanRecords`, and leave the public return key as `invalidations` for compatibility.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 4. Extract Scoped Review Record Resolution
**Finding key:** loop-39db2c73421936172f7e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveReviewActionForFlowState` now contains two resolution modes: latest scoped record and persisted target by tree SHA. The branching is compact but mixes scope filtering, argument validation, target matching, and state extraction in one function.  
**Suggestion:** Extract helpers such as `latestScopedConvergenceRecord(...)` and `latestTargetedConvergenceRecord(...)`. This would preserve behavior while making the persisted-target path easier to reason about and test independently.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveReviewActionForFlowState` now contains two resolution modes: latest scoped record and persisted target by tree SHA. The branching is compact but mixes scope filtering, argument validation, target matching, and state extraction in one function.  
**Suggestion:** Extract helpers such as `latestScopedConvergenceRecord(...)` and `latestTargetedConvergenceRecord(...)`. This would preserve behavior while making the persisted-target path easier to reason about and test independently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 5. Rename `resolveTreeSha` For Consistency
**Finding key:** loop-ff6914e78d8d817e1ff4
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` sounds like it may resolve a value asynchronously or perform broader lookup work, but this function expects a synchronous callback returning the current tree SHA.  
**Suggestion:** Rename the option to `getTreeSha` or `readTreeSha`, matching the synchronous callback shape and making the error message clearer: `getTreeSha is required for a persisted review target`.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` sounds like it may resolve a value asynchronously or perform broader lookup work, but this function expects a synchronous callback returning the current tree SHA.  
**Suggestion:** Rename the option to `getTreeSha` or `readTreeSha`, matching the synchronous callback shape and making the error message clearer: `getTreeSha is required for a persisted review target`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 6. Extract Artifact Outcome Failure Formatting
**Finding key:** loop-d93e81db0e331b60a6da
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `checkIntegrationTestArtifacts` now has two separate failure-return blocks after trust validation: stale mismatch recovery and outcome failure. The outcome failure message construction is inline, which makes the main decision flow slightly harder to scan.  
**Suggestion:** Extract a small helper such as `failIntegrationArtifactValidation({ outcome, phase, level, specPath })`. This keeps the precheck flow focused on ordering: structural trust, stale classification, then outcome verdict.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `checkIntegrationTestArtifacts` now has two separate failure-return blocks after trust validation: stale mismatch recovery and outcome failure. The outcome failure message construction is inline, which makes the main decision flow slightly harder to scan.  
**Suggestion:** Extract a small helper such as `failIntegrationArtifactValidation({ outcome, phase, level, specPath })`. This keeps the precheck flow focused on ordering: structural trust, stale classification, then outcome verdict.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 1. Collapse The Transaction Helper Classes
**Finding key:** loop-8fc59bef0ccad5a285fb
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `AdditionalArtifactDeletion`, `StagedArtifact`, and `StaleArtifactInvalidationTransaction` split a small staging workflow across several single-purpose classes. This adds object churn and indirection without matching the surrounding module style, which otherwise uses small functions and direct procedural flow.  
**Suggestion:** Replace these classes with local helper functions such as `collectExistingArtifacts(...)`, `stageArtifacts(...)`, `rollbackStagedArtifacts(...)`, and `commitStagedArtifacts(...)`. This would make the owned recovery transaction easier to audit and keep the mutation sequence visibly atomic.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `AdditionalArtifactDeletion`, `StagedArtifact`, and `StaleArtifactInvalidationTransaction` split a small staging workflow across several single-purpose classes. This adds object churn and indirection without matching the surrounding module style, which otherwise uses small functions and direct procedural flow.  
**Suggestion:** Replace these classes with local helper functions such as `collectExistingArtifacts(...)`, `stageArtifacts(...)`, `rollbackStagedArtifacts(...)`, and `commitStagedArtifacts(...)`. This would make the owned recovery transaction easier to audit and keep the mutation sequence visibly atomic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 2. Rename `additional` To Reflect Existing Invalidations
**Finding key:** loop-e8a4dfcd9567120f7818
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** The variable name `additional` is vague and loses the important fact that it only contains paths that currently exist and will be invalidated.  
**Suggestion:** Rename it to `existingAdditionalArtifacts` or `additionalInvalidatedArtifacts` so the result construction clearly reports only artifacts that were actually part of the recovery operation.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** The variable name `additional` is vague and loses the important fact that it only contains paths that currently exist and will be invalidated.  
**Suggestion:** Rename it to `existingAdditionalArtifacts` or `additionalInvalidatedArtifacts` so the result construction clearly reports only artifacts that were actually part of the recovery operation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 3. Avoid Duplicate Rollback Error Aggregation
**Finding key:** loop-cde0ac48edb4c9eb7064
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `rollback()` already throws an `AggregateError`, and `StaleRecoveryRollbackError` wraps that aggregate as a single-element aggregate. This creates nested aggregate errors that are harder to inspect and does not add much structure.  
**Suggestion:** Make `StaleRecoveryRollbackError` extend `Error` with `cause: rollbackError`, or flatten `rollbackError.errors` when available. Keep the original mutation error attached explicitly, for example as `mutationError`.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `rollback()` already throws an `AggregateError`, and `StaleRecoveryRollbackError` wraps that aggregate as a single-element aggregate. This creates nested aggregate errors that are harder to inspect and does not add much structure.  
**Suggestion:** Make `StaleRecoveryRollbackError` extend `Error` with `cause: rollbackError`, or flatten `rollbackError.errors` when available. Keep the original mutation error attached explicitly, for example as `mutationError`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 1. Extract duplicate repair fingerprint validation
**Finding key:** loop-ee4458c7f4f907d519d5
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactFingerprintAuthority` repeats the same `REPAIR_FINGERPRINT_PATTERN` validation and error construction for result and review fingerprints.  
**Suggestion:** Add a small helper such as `assertValidRepairFingerprint(fileName, value)` and call it for both artifacts. This keeps fail-closed behavior unchanged while making future fingerprint validation changes harder to apply inconsistently.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactFingerprintAuthority` repeats the same `REPAIR_FINGERPRINT_PATTERN` validation and error construction for result and review fingerprints.  
**Suggestion:** Add a small helper such as `assertValidRepairFingerprint(fileName, value)` and call it for both artifacts. This keeps fail-closed behavior unchanged while making future fingerprint validation changes harder to apply inconsistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 2. Extract artifact link path assertions
**Finding key:** loop-e25b8a5a055b488b7c68
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactLinkAuthority` has three near-identical path checks that differ only by artifact field and expected value.  
**Suggestion:** Introduce a helper like `assertArtifactPath(fileName, fieldName, actual, expected)` to remove duplication and standardize error messages.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactLinkAuthority` has three near-identical path checks that differ only by artifact field and expected value.  
**Suggestion:** Introduce a helper like `assertArtifactPath(fileName, fieldName, actual, expected)` to remove duplication and standardize error messages.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 3. Limit exported surface for internal authority classes
**Finding key:** loop-aeb2be6c1afcc2366267
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R1  
**Issue:** `IntegrationArtifactFingerprintAuthority`, `IntegrationArtifactLinkAuthority`, and `IntegrationArtifactTrustAssessment` are exported even though the diff only shows internal construction through `validateIntegrationArtifactTrust`. Exporting these classes expands the module API without clear need.  
**Suggestion:** Make these classes module-private unless external tests or consumers explicitly instantiate them. Keep the exported behavior at the existing function boundary.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R1  
**Issue:** `IntegrationArtifactFingerprintAuthority`, `IntegrationArtifactLinkAuthority`, and `IntegrationArtifactTrustAssessment` are exported even though the diff only shows internal construction through `validateIntegrationArtifactTrust`. Exporting these classes expands the module API without clear need.  
**Suggestion:** Make these classes module-private unless external tests or consumers explicitly instantiate them. Keep the exported behavior at the existing function boundary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 1. Extract Flow State Fixture Builder
**Finding key:** loop-6042da9ee93eb6a69709
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** Each test repeats the same `flowState.reviewConvergence.version/records` wrapper, which makes the tests noisier and obscures the behavior under review.  
**Suggestion:** Add a small helper such as `flowStateWithRecords(records)` and use it across the tests.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** Each test repeats the same `flowState.reviewConvergence.version/records` wrapper, which makes the tests noisier and obscures the behavior under review.  
**Suggestion:** Add a small helper such as `flowStateWithRecords(records)` and use it across the tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 2. Rename `toolingRecord` to Clarify Its Fixture Semantics
**Finding key:** loop-4c2cedca4f6ec6f48756
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `toolingRecord` sounds generic, but the helper always creates a failed tooling-result record with `TOOLING_ERROR` and `stage: "result_recording"`.  
**Suggestion:** Rename it to something more precise, such as `toolingErrorRecord` or `failedToolingRecord`, so test intent is clearer.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `toolingRecord` sounds generic, but the helper always creates a failed tooling-result record with `TOOLING_ERROR` and `stage: "result_recording"`.  
**Suggestion:** Rename it to something more precise, such as `toolingErrorRecord` or `failedToolingRecord`, so test intent is clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 3. Avoid Hard-Coded Attempt Math in Fixture
**Finding key:** loop-6dff5d9ac3b863b6e72c
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `remainingAttempts: 2 - attempt` duplicates the implicit `maxAttempts: 2` value. If `maxAttempts` changes, the fixture can become internally inconsistent.  
**Suggestion:** Introduce a local `const maxAttempts = 2;` inside the helper and set both `maxAttempts` and `remainingAttempts: maxAttempts - attempt` from it.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `remainingAttempts: 2 - attempt` duplicates the implicit `maxAttempts: 2` value. If `maxAttempts` changes, the fixture can become internally inconsistent.  
**Suggestion:** Introduce a local `const maxAttempts = 2;` inside the helper and set both `maxAttempts` and `remainingAttempts: maxAttempts - attempt` from it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 1. Normalize Review Artifact Metadata
**Finding key:** loop-867f3681e10bf33166da
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-repair.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`
**Requirement:** R5
**Issue:** Review artifacts in the same family use inconsistent provenance metadata: `draft-review-coverage.json` includes `generatedAt`, while `draft-questions-repair.json` and `draft-questions-triage.json` omit it.
**Suggestion:** Add `generatedAt` to both question review artifacts using the same ISO format and placement convention as `draft-review-coverage.json`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`
**Requirement:** R5
**Issue:** Review artifacts in the same family use inconsistent provenance metadata: `draft-review-coverage.json` includes `generatedAt`, while `draft-questions-repair.json` and `draft-questions-triage.json` omit it.
**Suggestion:** Add `generatedAt` to both question review artifacts using the same ISO format and placement convention as `draft-review-coverage.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 2. Standardize Review Evidence JSON Formatting
**Finding key:** loop-ca33170311432c9886ff
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`
**Requirement:** R8
**Issue:** Multiple review-evidence JSON artifacts are stored as compact single-line JSON, while review-history artifacts appear to use readable formatting. This creates inconsistent generated artifact conventions and makes evidence diffs harder to review.
**Suggestion:** Apply one canonical JSON formatting policy across all `review-evidence/*.json` files, preferably stable pretty-printing with consistent indentation and key ordering.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`
**Requirement:** R8
**Issue:** Multiple review-evidence JSON artifacts are stored as compact single-line JSON, while review-history artifacts appear to use readable formatting. This creates inconsistent generated artifact conventions and makes evidence diffs harder to review.
**Suggestion:** Apply one canonical JSON formatting policy across all `review-evidence/*.json` files, preferably stable pretty-printing with consistent indentation and key ordering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 3. Unify Review History Finding Schemas
**Finding key:** loop-be65f174a25b257f571e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json`
**Requirement:** R1
**Issue:** Review history artifacts use inconsistent names and structures for finding groups: `nonBlockingImprovements`, `advisoryFindings`, `blockingFindings`, and duplicated `findings` arrays. Shared consumers would need phase-specific branching for conceptually similar data.
**Suggestion:** Define one review-history schema with a canonical `findings` array plus severity/disposition fields, and make grouped fields either derived or lightweight references by finding ID.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json`
**Requirement:** R1
**Issue:** Review history artifacts use inconsistent names and structures for finding groups: `nonBlockingImprovements`, `advisoryFindings`, `blockingFindings`, and duplicated `findings` arrays. Shared consumers would need phase-specific branching for conceptually similar data.
**Suggestion:** Define one review-history schema with a canonical `findings` array plus severity/disposition fields, and make grouped fields either derived or lightweight references by finding ID.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 4. Generate Unique Finding Identifiers Consistently
**Finding key:** loop-b0f68bbc4dc4ae2860c4
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`
**Requirement:** R5
**Issue:** Several test review artifacts repeat the same `findingId`, `fingerprint`, or `id` for distinct findings, while issue-log entries also show repeated normalized finding identifiers. This undermines cross-artifact deduplication and tracking.
**Suggestion:** Generate stable IDs from requirement ID plus normalized finding title/body/target, and use that scheme consistently across review-history and issue-log artifacts.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`
**Requirement:** R5
**Issue:** Several test review artifacts repeat the same `findingId`, `fingerprint`, or `id` for distinct findings, while issue-log entries also show repeated normalized finding identifiers. This undermines cross-artifact deduplication and tracking.
**Suggestion:** Generate stable IDs from requirement ID plus normalized finding title/body/target, and use that scheme consistently across review-history and issue-log artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 5. Align Review Phase Naming
**Finding key:** loop-88dc5ba7b02fc827a2cf
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/test-review.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/test-review.json`
**Requirement:** R8
**Issue:** Related artifacts use inconsistent phase names: `test-review.json` has `"phase": "test"`, while file paths, `contractSummary.targetStep`, and coverage artifacts refer to `test-review`.
**Suggestion:** Use `test-review` consistently for the review phase unless the schema explicitly reserves `"test"`; if so, document the distinction in the artifact schema.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/test-review.json`
**Requirement:** R8
**Issue:** Related artifacts use inconsistent phase names: `test-review.json` has `"phase": "test"`, while file paths, `contractSummary.targetStep`, and coverage artifacts refer to `test-review`.
**Suggestion:** Use `test-review` consistently for the review phase unless the schema explicitly reserves `"test"`; if so, document the distinction in the artifact schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 6. Deduplicate Persisted Process History
**Finding key:** loop-469eb7223228ecea1401
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`
**Requirement:** R8
**Issue:** `flow.json`, `issue-log.json`, raw logs, and review-history artifacts all appear to persist overlapping runtime attempts, failures, timestamps, and repair history. This duplicates transient execution state across files and increases drift risk.
**Suggestion:** Keep durable state in `flow.json`, concise final issue summaries in `issue-log.json`, and move verbose attempt/runtime logs to ignored generated evidence unless they are required fixtures.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`
**Requirement:** R8
**Issue:** `flow.json`, `issue-log.json`, raw logs, and review-history artifacts all appear to persist overlapping runtime attempts, failures, timestamps, and repair history. This duplicates transient execution state across files and increases drift risk.
**Suggestion:** Keep durable state in `flow.json`, concise final issue summaries in `issue-log.json`, and move verbose attempt/runtime logs to ignored generated evidence unless they are required fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 7. Rename Tree SHA Resolver Consistently
**Finding key:** loop-85d1e71b78f5a34b6ae9
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `resolveTreeSha` is used across `review-convergence.js`, `get-next-action.js`, and `get-status.js`, but reviewers flagged both naming ambiguity and repeated callback resolution. The interface name obscures that callers should provide a synchronous, stable current tree SHA value.
**Suggestion:** Rename the option consistently to `getTreeSha` or `readTreeSha`, and have callers memoize or precompute the SHA once per operation before passing the callback.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `resolveTreeSha` is used across `review-convergence.js`, `get-next-action.js`, and `get-status.js`, but reviewers flagged both naming ambiguity and repeated callback resolution. The interface name obscures that callers should provide a synchronous, stable current tree SHA value.
**Suggestion:** Rename the option consistently to `getTreeSha` or `readTreeSha`, and have callers memoize or precompute the SHA once per operation before passing the callback.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 8. Keep Integration Artifact Authority API Private
**Finding key:** loop-fa64d1f75041c8b29e65
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R1
**Issue:** Authority classes are exported from `test-artifacts.js` while surrounding files appear to consume only higher-level validation behavior. This expands the cross-file interface without a clear consumer contract.
**Suggestion:** Keep authority classes module-private and export only stable functions such as `validateIntegrationArtifactTrust`, unless tests or other modules need direct construction.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`
**Requirement:** R1
**Issue:** Authority classes are exported from `test-artifacts.js` while surrounding files appear to consume only higher-level validation behavior. This expands the cross-file interface without a clear consumer contract.
**Suggestion:** Keep authority classes module-private and export only stable functions such as `validateIntegrationArtifactTrust`, unless tests or other modules need direct construction.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
