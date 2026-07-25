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

### 6. 4. Normalize Draft Review Finding Titles
**Finding key:** loop-8ac906ee50e92098787c
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-review-questions.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** `repairTargets[].title` embeds ordinal prefixes like `1. q2 includes recommendation and rationale`. The ordinal duplicates array ordering and can drift if entries are reordered.  
**Suggestion:** Remove numeric prefixes from titles and rely on array position or stable IDs if ordering must be shown.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** `repairTargets[].title` embeds ordinal prefixes like `1. q2 includes recommendation and rationale`. The ordinal duplicates array ordering and can drift if entries are reordered.  
**Suggestion:** Remove numeric prefixes from titles and rely on array position or stable IDs if ordering must be shown.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 7. Align Artifact Summary With Structured Counts
**Finding key:** loop-8e27e0014d50737b52df
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-review-questions.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R7  
**Issue:** The summary says `0 blocking, 0 advisory, 2 repair target finding(s) recorded` while `verdict` is `ADVISORY` and `advisoryFindings` is empty. This naming split makes the artifact harder to interpret.  
**Suggestion:** Either classify repair targets under advisory findings when the verdict is advisory, or use a verdict/summary vocabulary that clearly distinguishes repair targets from advisory findings.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R7  
**Issue:** The summary says `0 blocking, 0 advisory, 2 repair target finding(s) recorded` while `verdict` is `ADVISORY` and `advisoryFindings` is empty. This naming split makes the artifact harder to interpret.  
**Suggestion:** Either classify repair targets under advisory findings when the verdict is advisory, or use a verdict/summary vocabulary that clearly distinguishes repair targets from advisory findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Avoid Duplicating Policy Text Across QA And Decision Map
**Finding key:** loop-3873fc47800d0c58a826
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R5  
**Issue:** The same stale recovery policy is repeated in `decisionMap.knownFacts`, `scopeVerification`, `impactOnExisting`, and `qa` answers. This increases maintenance cost and creates risk that one copy will be updated without the others.  
**Suggestion:** Keep the policy once in the canonical decision section, and have QA entries reference that decision rather than restating the full boundary text.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R5  
**Issue:** The same stale recovery policy is repeated in `decisionMap.knownFacts`, `scopeVerification`, `impactOnExisting`, and `qa` answers. This increases maintenance cost and creates risk that one copy will be updated without the others.  
**Suggestion:** Keep the policy once in the canonical decision section, and have QA entries reference that decision rather than restating the full boundary text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 6. Remove Empty Placeholder Fields
**Finding key:** loop-00d1f066a75026727ba9
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft.json
**Requirement:** R6
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R6  
**Issue:** QA entries include empty string fields such as `considered` and `droppedReason` even when no value exists. These placeholders add noise without conveying information.  
**Suggestion:** Omit optional fields when empty, or use `null` only if the schema requires explicit absence.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R6  
**Issue:** QA entries include empty string fields such as `considered` and `droppedReason` even when no value exists. These placeholders add noise without conveying information.  
**Suggestion:** Omit optional fields when empty, or use `null` only if the schema requires explicit absence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Prune Volatile Runtime History
**Finding key:** loop-5ae7e9dac8553932a3b7
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R1  
**Issue:** The checked-in flow state includes thousands of lines of runtime-only data, including repeated `metrics`, `runtimeLog`, `reviewConvergence.handoffFindings`, `evidenceHistory`, `stepAttempts`, and `reviewRecoveryBaselines`. This makes the artifact noisy, hard to review, and likely to churn on every run.  
**Suggestion:** Persist only the canonical current flow state needed to resume or audit the feature, and move detailed attempt history to generated evidence artifacts or a bounded external log.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R1  
**Issue:** The checked-in flow state includes thousands of lines of runtime-only data, including repeated `metrics`, `runtimeLog`, `reviewConvergence.handoffFindings`, `evidenceHistory`, `stepAttempts`, and `reviewRecoveryBaselines`. This makes the artifact noisy, hard to review, and likely to churn on every run.  
**Suggestion:** Persist only the canonical current flow state needed to resume or audit the feature, and move detailed attempt history to generated evidence artifacts or a bounded external log.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Add Explicit Bounds To Recorded Histories
**Finding key:** loop-e45634497227acc241f1
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R2
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R2  
**Issue:** Arrays such as `metrics`, `reviewConvergence.records[].handoffFindings`, `reviewConvergence.records[].evidenceHistory`, and `stepAttempts` appear to grow with every review or gate attempt without an explicit cap. This violates the `bounded-resource-usage` guardrail because repeated retries can produce unbounded persisted state.  
**Suggestion:** Add explicit retention limits, for example max attempts per phase, max evidence history entries per record, and max handoff findings per review record. If older entries are needed for audit, summarize or archive them outside the main flow state.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R2  
**Issue:** Arrays such as `metrics`, `reviewConvergence.records[].handoffFindings`, `reviewConvergence.records[].evidenceHistory`, and `stepAttempts` appear to grow with every review or gate attempt without an explicit cap. This violates the `bounded-resource-usage` guardrail because repeated retries can produce unbounded persisted state.  
**Suggestion:** Add explicit retention limits, for example max attempts per phase, max evidence history entries per record, and max handoff findings per review record. If older entries are needed for audit, summarize or archive them outside the main flow state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Deduplicate Repeated Review Finding Metadata
**Finding key:** loop-16f33608d9591db516b1
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R3  
**Issue:** Each `handoffFindings` entry repeats identical fields such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`. This bloats the file and makes metadata consistency harder to maintain.  
**Suggestion:** Store shared review metadata once at the enclosing record level, and keep each finding limited to its unique fields: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R3  
**Issue:** Each `handoffFindings` entry repeats identical fields such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`. This bloats the file and makes metadata consistency harder to maintain.  
**Suggestion:** Store shared review metadata once at the enclosing record level, and keep each finding limited to its unique fields: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 8. Remove Stale Generated Review State From Source Diff
**Finding key:** loop-c0f09551d1df7ad7e958
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R8  
**Issue:** The file records prior failed and superseded review outputs, including rejected findings and retry history that no longer represents the current implementation state. This is effectively dead generated state inside the change set.  
**Suggestion:** Regenerate or compact `flow.json` so it contains only the current authoritative state, plus bounded audit references to historical evidence files where needed.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R8  
**Issue:** The file records prior failed and superseded review outputs, including rejected findings and retry history that no longer represents the current implementation state. This is effectively dead generated state inside the change set.  
**Suggestion:** Regenerate or compact `flow.json` so it contains only the current authoritative state, plus bounded audit references to historical evidence files where needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Deduplicate Repeated Fingerprint Records
**Finding key:** loop-81dc1345615a763f4d1b
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** Several `changedFileFingerprints` arrays contain duplicate path/fingerprint entries, for example repeated `spec.json`, `spec.md`, `test-review.json`, `test-review.md`, `tests/stale-test-evidence-recovery.test.js`, and `tests/unit/flow/review-convergence-action.test.js` records. This makes the evidence noisy and harder to review without adding information.  
**Suggestion:** Normalize each `changedFileFingerprints` list to one record per unique `path` and `fingerprint` pair before persisting the issue log.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** Several `changedFileFingerprints` arrays contain duplicate path/fingerprint entries, for example repeated `spec.json`, `spec.md`, `test-review.json`, `test-review.md`, `tests/stale-test-evidence-recovery.test.js`, and `tests/unit/flow/review-convergence-action.test.js` records. This makes the evidence noisy and harder to review without adding information.  
**Suggestion:** Normalize each `changedFileFingerprints` list to one record per unique `path` and `fingerprint` pair before persisting the issue log.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Bound Large Evidence Snapshots
**Finding key:** loop-2eb36738ff7e9ce995b6
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** The log embeds very large `changedFileFingerprints` snapshots directly in multiple final-regression entries. Without an explicit cap or reference strategy, this can grow unbounded as the spec accumulates artifacts, conflicting with the `bounded-resource-usage` guardrail.  
**Suggestion:** Store a bounded summary in `issue-log.json`, such as counts plus the first N relevant fingerprints, and move full fingerprint manifests to a referenced artifact path.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`  
**Requirement:** R8  
**Issue:** The log embeds very large `changedFileFingerprints` snapshots directly in multiple final-regression entries. Without an explicit cap or reference strategy, this can grow unbounded as the spec accumulates artifacts, conflicting with the `bounded-resource-usage` guardrail.  
**Suggestion:** Store a bounded summary in `issue-log.json`, such as counts plus the first N relevant fingerprints, and move full fingerprint manifests to a referenced artifact path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Remove Duplicated Bilingual Content Or Split It
**Finding key:** loop-5186661ff720812bcf03
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue.md`  
**Requirement:** R1  
**Issue:** The English issue body and Japanese `<details>` section duplicate the same structure and content. This increases maintenance cost because future edits must keep two full copies aligned.  
**Suggestion:** Keep the canonical issue content in one language and either replace the second section with a short summary or move translations into a separate localized artifact if bilingual documentation is required.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue.md`  
**Requirement:** R1  
**Issue:** The English issue body and Japanese `<details>` section duplicate the same structure and content. This increases maintenance cost because future edits must keep two full copies aligned.  
**Suggestion:** Keep the canonical issue content in one language and either replace the second section with a short summary or move translations into a separate localized artifact if bilingual documentation is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Add Final Newline
**Finding key:** loop-9f78a89c702cecd652df
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue.md`  
**Requirement:** R1  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can create avoidable diff churn.  
**Suggestion:** Add a final newline after the closing `</details>` tag.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue.md`  
**Requirement:** R1  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can create avoidable diff churn.  
**Suggestion:** Add a final newline after the closing `</details>` tag.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Pretty-print spec evidence JSON
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

### 19. 1. Pretty-print dense evidence JSON
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

### 20. 3. Pretty-print draft coverage evidence JSON
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

### 21. 3. Format generated JSON consistently
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

### 22. 1. Normalize duplicated finding content
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

### 23. 2. Avoid conflicting advisory counts
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

### 24. 2. Normalize empty finding field names across review history artifacts
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

### 25. 3. Add trailing newline
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

### 26. 3. Add trailing newline
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

### 27. 1. Remove duplicated finding payloads
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

### 28. 3. Normalize newline handling
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

### 29. 1. Use distinct finding identifiers
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

### 30. 2. Remove duplicated rationale text inside each finding
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

### 31. 4. Normalize newline handling
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

### 32. 4. Normalize newline handling
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

### 33. 1. Use unique finding identifiers
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

### 34. 2. Remove duplicated finding payloads
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

### 35. 3. Align process result naming with exit status
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

### 36. 4. Factor repeated evidence fields
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

### 37. 2. Deduplicate Generated Overview Entries
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

### 38. 1. Remove Empty Placeholder Sections
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

### 39. 3. Deduplicate Rendered Overview Bullets
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

### 40. 1. Align review phase naming
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

### 41. 2. Add final newline
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

### 42. 1. Remove Checked-In Failing Test Log
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

### 43. 2. Extract Shared Stale Recovery Assertions
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

### 44. 3. Reuse Invalid Authority Case Fixtures
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

### 45. 4. Rename `prepareEvidence` To Reflect Fixture Creation
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

### 46. 5. Avoid Recomputing Review Tree SHA Per Resolver Call
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

### 47. 1. Memoize review tree SHA resolution
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

### 48. 2. Avoid repeated invalidation projection work
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

### 49. 3. Rename stored invalidation records for clarity
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

### 50. 4. Extract Scoped Review Record Resolution
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

### 51. 5. Rename `resolveTreeSha` For Consistency
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

### 52. 6. Extract Artifact Outcome Failure Formatting
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

### 53. 1. Collapse The Transaction Helper Classes
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

### 54. 2. Rename `additional` To Reflect Existing Invalidations
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

### 55. 3. Avoid Duplicate Rollback Error Aggregation
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

### 56. 1. Remove Unused Artifact Map Method
**Finding key:** loop-579191a8611e46020427
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R1  
**Issue:** `IntegrationArtifactFingerprintAuthority.toArtifactMap()` is introduced but not used in the diff. It adds API surface without a current caller.  
**Suggestion:** Remove `toArtifactMap()` unless a follow-up change needs it, or use it where artifact maps are required.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R1  
**Issue:** `IntegrationArtifactFingerprintAuthority.toArtifactMap()` is introduced but not used in the diff. It adds API surface without a current caller.  
**Suggestion:** Remove `toArtifactMap()` unless a follow-up change needs it, or use it where artifact maps are required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 2. Extract Repair Fingerprint Validation Helper
**Finding key:** loop-8324fb665b4a0697d7b3
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactFingerprintAuthority` repeats the same repair fingerprint validation logic for result and review artifacts, differing only by filename.  
**Suggestion:** Add a small helper such as `assertValidRepairFingerprint(fileName, value)` and call it for both artifacts. This keeps error behavior consistent and makes future changes to fingerprint validation less error-prone.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactFingerprintAuthority` repeats the same repair fingerprint validation logic for result and review artifacts, differing only by filename.  
**Suggestion:** Add a small helper such as `assertValidRepairFingerprint(fileName, value)` and call it for both artifacts. This keeps error behavior consistent and makes future changes to fingerprint validation less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 3. Preserve Trust Contract On Late Structural Failures
**Finding key:** loop-5f6cd96d0d6aa41e8e53
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `validateIntegrationArtifactTrust()` builds `contract`, but if `IntegrationArtifactTrustAssessment` throws during fingerprint or link validation, the `catch` returns `new GateArtifactTrustFailure(err.message)` without the contract. Earlier outcome failures preserve the contract through `evaluateOutcome()`, so this is inconsistent.  
**Suggestion:** Return `new GateArtifactTrustFailure(err.message, { contract })` when `contract` is available, or narrow the `try` block so post-contract failures consistently carry contract context.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `validateIntegrationArtifactTrust()` builds `contract`, but if `IntegrationArtifactTrustAssessment` throws during fingerprint or link validation, the `catch` returns `new GateArtifactTrustFailure(err.message)` without the contract. Earlier outcome failures preserve the contract through `evaluateOutcome()`, so this is inconsistent.  
**Suggestion:** Return `new GateArtifactTrustFailure(err.message, { contract })` when `contract` is available, or narrow the `try` block so post-contract failures consistently carry contract context.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 1. Extract a shared test fixture helper for repeated tooling records
**Finding key:** loop-407fcf1e4234d4b5d32f
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** Each test repeats the same `flowState.reviewConvergence` wrapper around `toolingRecord(...)`, which makes the assertions harder to scan and increases setup noise.  
**Suggestion:** Add a small helper such as `flowStateWithRecords(records)` and use it in each test. This keeps each case focused on the differing record data and expected action.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** Each test repeats the same `flowState.reviewConvergence` wrapper around `toolingRecord(...)`, which makes the assertions harder to scan and increases setup noise.  
**Suggestion:** Add a small helper such as `flowStateWithRecords(records)` and use it in each test. This keeps each case focused on the differing record data and expected action.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 2. Simplify constant naming around tree identity
**Finding key:** loop-bc14a9ac673fd04e4ab4
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `CURRENT_TREE_SHA` and `STALE_TREE_SHA` are clear, but the tests are specifically validating resolver-target identity, not generic Git tree values.  
**Suggestion:** Consider names like `RESOLVED_TREE_SHA` and `STALE_RECORD_TREE_SHA` to make the relationship between `resolveTreeSha` and stored records explicit.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `CURRENT_TREE_SHA` and `STALE_TREE_SHA` are clear, but the tests are specifically validating resolver-target identity, not generic Git tree values.  
**Suggestion:** Consider names like `RESOLVED_TREE_SHA` and `STALE_RECORD_TREE_SHA` to make the relationship between `resolveTreeSha` and stored records explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 3. Avoid hard-coded arithmetic in test fixture state
**Finding key:** loop-5df96350dbc875425d87
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `remainingAttempts: 2 - attempt` duplicates knowledge of `maxAttempts: 2` inside `toolingRecord`. If `maxAttempts` changes later, the fixture can become internally inconsistent.  
**Suggestion:** Introduce a local `const maxAttempts = 2;` inside `toolingRecord` and compute `remainingAttempts: maxAttempts - attempt`, while assigning `maxAttempts` from the same constant.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `remainingAttempts: 2 - attempt` duplicates knowledge of `maxAttempts: 2` inside `toolingRecord`. If `maxAttempts` changes later, the fixture can become internally inconsistent.  
**Suggestion:** Introduce a local `const maxAttempts = 2;` inside `toolingRecord` and compute `remainingAttempts: maxAttempts - attempt`, while assigning `maxAttempts` from the same constant.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 1. Standardize review phase naming
**Finding key:** loop-3ea99d1fc9d3cff61901
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** The review action interface uses `resolveTreeSha`, while callers in `src/flow/lib/get-status.js` and `src/flow/lib/get-next-action.js` pass callbacks with the same name, and artifacts elsewhere use mixed phase labels such as `"test"` vs `"test-review"`. Together this creates inconsistent naming around whether a value is a resolver callback, a current tree identity, or a lifecycle phase.
**Suggestion:** Rename the callback consistently across implementation and callers to `getTreeSha` or `readTreeSha`, and normalize persisted artifact phase values to the canonical lifecycle step name, e.g. `test-review`.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** The review action interface uses `resolveTreeSha`, while callers in `src/flow/lib/get-status.js` and `src/flow/lib/get-next-action.js` pass callbacks with the same name, and artifacts elsewhere use mixed phase labels such as `"test"` vs `"test-review"`. Together this creates inconsistent naming around whether a value is a resolver callback, a current tree identity, or a lifecycle phase.
**Suggestion:** Rename the callback consistently across implementation and callers to `getTreeSha` or `readTreeSha`, and normalize persisted artifact phase values to the canonical lifecycle step name, e.g. `test-review`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 2. Share tree SHA resolution behavior across callers
**Finding key:** loop-6e7da5a838473ffa5a40
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R7
**Issue:** Both `get-status.js` and `get-next-action.js` pass `resolveTreeSha: () => resolveCurrentReviewTreeSha(...)`, creating the same repeated-resolution risk in two entry points.
**Suggestion:** Introduce a shared helper for lazy current review tree SHA resolution, or memoize the value in both callers using the same pattern before passing it into `resolveReviewActionForFlowState`.
**Suggestion:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R7
**Issue:** Both `get-status.js` and `get-next-action.js` pass `resolveTreeSha: () => resolveCurrentReviewTreeSha(...)`, creating the same repeated-resolution risk in two entry points.
**Suggestion:** Introduce a shared helper for lazy current review tree SHA resolution, or memoize the value in both callers using the same pattern before passing it into `resolveReviewActionForFlowState`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 3. Consolidate finding representations across review artifacts
**Finding key:** loop-f576164c5ce62c488aa4
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** Multiple artifacts store the same findings in parallel arrays such as `findings`, `blockingFindings`, `advisoryFindings`, and `repairTargets`. The summaries identify this duplication in `draft-questions-attempt-001.json`, `test-attempt-001.json`, `test-attempt-003.json`, and `draft-review-questions.json`, with inconsistent counts and labels.
**Suggestion:** Use one canonical `findings` array with normalized fields such as `id`, `requirement`, `severity`, `category`, and `disposition`; derive blocking, advisory, and repair-target views from that canonical list.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** Multiple artifacts store the same findings in parallel arrays such as `findings`, `blockingFindings`, `advisoryFindings`, and `repairTargets`. The summaries identify this duplication in `draft-questions-attempt-001.json`, `test-attempt-001.json`, `test-attempt-003.json`, and `draft-review-questions.json`, with inconsistent counts and labels.
**Suggestion:** Use one canonical `findings` array with normalized fields such as `id`, `requirement`, `severity`, `category`, and `disposition`; derive blocking, advisory, and repair-target views from that canonical list.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 65. 4. Normalize finding identifier generation across attempts
**Finding key:** loop-3207b8581c840fdc121d
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`
**Requirement:** R7
**Issue:** Duplicate `findingId`, `fingerprint`, and `id` values appear in both `test-attempt-002.json` and `test-attempt-003.json` for distinct findings. This is a cross-file tracking problem because history correlation cannot reliably distinguish different requirements or targets.
**Suggestion:** Generate stable finding identifiers from requirement ID plus normalized title/body/target, and apply the same ID scheme to all review-history and review-evidence artifacts.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`
**Requirement:** R7
**Issue:** Duplicate `findingId`, `fingerprint`, and `id` values appear in both `test-attempt-002.json` and `test-attempt-003.json` for distinct findings. This is a cross-file tracking problem because history correlation cannot reliably distinguish different requirements or targets.
**Suggestion:** Generate stable finding identifiers from requirement ID plus normalized title/body/target, and apply the same ID scheme to all review-history and review-evidence artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 66. 5. Use one metadata schema for generated review artifacts
**Finding key:** loop-dc24f76222037550550d
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-repair.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`
**Requirement:** R5
**Issue:** `draft-review-coverage.json` includes `generatedAt`, while related triage and repair artifacts omit it. Review-history and review-evidence files also appear to vary in formatting and provenance fields.
**Suggestion:** Define a shared generated-artifact metadata block, including `generatedAt`, phase/step, source, and schema version where applicable, then apply it consistently to coverage, triage, repair, review-history, and review-evidence artifacts.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`
**Requirement:** R5
**Issue:** `draft-review-coverage.json` includes `generatedAt`, while related triage and repair artifacts omit it. Review-history and review-evidence files also appear to vary in formatting and provenance fields.
**Suggestion:** Define a shared generated-artifact metadata block, including `generatedAt`, phase/step, source, and schema version where applicable, then apply it consistently to coverage, triage, repair, review-history, and review-evidence artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 67. 6. Remove ordinal prefixes consistently from generated titles
**Finding key:** loop-bf516a0a117e198d9513
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-review-questions.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`
**Requirement:** R4
**Issue:** Ordinal prefixes appear in both `draft-review-questions.json` repair target titles and draft question triage/repair item titles. This duplicates array ordering across multiple artifact types and can drift after reordering.
**Suggestion:** Strip numeric prefixes from all generated titles and rely on array position or stable IDs for ordering.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`
**Requirement:** R4
**Issue:** Ordinal prefixes appear in both `draft-review-questions.json` repair target titles and draft question triage/repair item titles. This duplicates array ordering across multiple artifact types and can drift after reordering.
**Suggestion:** Strip numeric prefixes from all generated titles and rely on array position or stable IDs for ordering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 68. 7. Canonicalize JSON artifact formatting
**Finding key:** loop-3e08debc07bb1d72f5ab
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`
**Requirement:** R8
**Issue:** Several review-evidence JSON files are single-line payloads, while review-history files appear to use readable formatting. This creates inconsistent review ergonomics across generated artifacts.
**Suggestion:** Apply one canonical JSON serialization policy, such as stable key order with two-space indentation and trailing newline, to all generated JSON artifacts.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`
**Requirement:** R8
**Issue:** Several review-evidence JSON files are single-line payloads, while review-history files appear to use readable formatting. This creates inconsistent review ergonomics across generated artifacts.
**Suggestion:** Apply one canonical JSON serialization policy, such as stable key order with two-space indentation and trailing newline, to all generated JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 69. 8. Deduplicate stale recovery policy text across spec artifacts
**Finding key:** loop-dae0077c04b84945b644
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`
**Requirement:** R5
**Issue:** The stale recovery policy is repeated in `draft.json`, `spec.json`, and rendered `spec.md` overview sections. The same behavior is described in multiple generated forms, increasing drift risk.
**Suggestion:** Keep the policy in one canonical structured source, then render references or concise derived summaries into human-facing Markdown and QA sections.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`
**Requirement:** R5
**Issue:** The stale recovery policy is repeated in `draft.json`, `spec.json`, and rendered `spec.md` overview sections. The same behavior is described in multiple generated forms, increasing drift risk.
**Suggestion:** Keep the policy in one canonical structured source, then render references or concise derived summaries into human-facing Markdown and QA sections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 70. 9. Normalize EOF newline handling for Markdown artifacts
**Finding key:** loop-4c2d9d1c9cbfb65e8a49
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md`
**Requirement:** R1
**Issue:** Multiple Markdown artifacts lack trailing newlines, including review-history attempt files, `test-review.md`, and `issue.md`. This is a repeated formatting inconsistency across generated text artifacts.
**Suggestion:** Update the artifact writer or formatter so every generated Markdown file ends with exactly one trailing newline.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md`
**Requirement:** R1
**Issue:** Multiple Markdown artifacts lack trailing newlines, including review-history attempt files, `test-review.md`, and `issue.md`. This is a repeated formatting inconsistency across generated text artifacts.
**Suggestion:** Update the artifact writer or formatter so every generated Markdown file ends with exactly one trailing newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 71. 10. Align invalidation naming across implementation classes
**Finding key:** loop-01a5233fa75382e502be
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** `impl-repair-artifacts.js` uses `invalidations` for internal planned records while returning serialized invalidations publicly, and `stale-test-evidence-refresh.js` uses vague names such as `additional` for invalidated artifacts. Across files, similar recovery concepts have different names and levels of specificity.
**Suggestion:** Use consistent terms such as `plannedInvalidations`, `invalidatedArtifacts`, and `invalidationRecords` across both implementation files, reserving public return keys only for serialized artifact data.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** `impl-repair-artifacts.js` uses `invalidations` for internal planned records while returning serialized invalidations publicly, and `stale-test-evidence-refresh.js` uses vague names such as `additional` for invalidated artifacts. Across files, similar recovery concepts have different names and levels of specificity.
**Suggestion:** Use consistent terms such as `plannedInvalidations`, `invalidatedArtifacts`, and `invalidationRecords` across both implementation files, reserving public return keys only for serialized artifact data.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
