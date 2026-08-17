# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Reduce repeated review-routing prose
**Finding key:** loop-9df2d68ba1bd179d4a38
**Failure mode:** refactor
**File:** .agents/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The updated bullets repeat the same PASS / ADVISORY / REJECTED routing concepts across draft review, `spec-review`, and `test-review`, while mixing common routing rules with phase-specific exceptions. That makes future status vocabulary changes more error-prone.  
**Suggestion:** Introduce a short shared rule sentence for review outcomes, then list only the phase-specific deviations: draft reviews route `REJECTED` to triage, `spec-review` advances to `spec-triage`, and `test-review` remains open on `REJECTED` or `TOOLING_ERROR`.
**Suggestion:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The updated bullets repeat the same PASS / ADVISORY / REJECTED routing concepts across draft review, `spec-review`, and `test-review`, while mixing common routing rules with phase-specific exceptions. That makes future status vocabulary changes more error-prone.  
**Suggestion:** Introduce a short shared rule sentence for review outcomes, then list only the phase-specific deviations: draft reviews route `REJECTED` to triage, `spec-review` advances to `spec-triage`, and `test-review` remains open on `REJECTED` or `TOOLING_ERROR`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 4. Reduce repeated review-routing prose
**Finding key:** loop-5e07ca4c7be3c64b8a86
**Failure mode:** refactor
**File:** .claude/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The updated bullets repeat the same PASS / ADVISORY / REJECTED routing concepts across draft review, `spec-review`, and `test-review`, while mixing common routing rules with phase-specific exceptions. That makes future status vocabulary changes more error-prone.  
**Suggestion:** Introduce a short shared rule sentence for review outcomes, then list only the phase-specific deviations: draft reviews route `REJECTED` to triage, `spec-review` advances to `spec-triage`, and `test-review` remains open on `REJECTED` or `TOOLING_ERROR`.
**Suggestion:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The updated bullets repeat the same PASS / ADVISORY / REJECTED routing concepts across draft review, `spec-review`, and `test-review`, while mixing common routing rules with phase-specific exceptions. That makes future status vocabulary changes more error-prone.  
**Suggestion:** Introduce a short shared rule sentence for review outcomes, then list only the phase-specific deviations: draft reviews route `REJECTED` to triage, `spec-review` advances to `spec-triage`, and `test-review` remains open on `REJECTED` or `TOOLING_ERROR`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Remove duplicated finding payloads
**Finding key:** loop-fd308369005c0f0a43fe
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-gate-source.json`  
**Requirement:** R7  
**Issue:** The same guardrail findings are represented twice, once in `evaluations[*].observations` and again in the top-level `observations` array, with mostly duplicated reason/rationale/disposition metadata. This makes the artifact harder to inspect and increases the chance that future tooling reads inconsistent copies.  
**Suggestion:** Keep one canonical representation of each finding and derive the other view only when needed. If the schema requires both arrays, reduce one side to references such as `findingId`/`fingerprint` instead of repeating the full observation payload.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-gate-source.json`  
**Requirement:** R7  
**Issue:** The same guardrail findings are represented twice, once in `evaluations[*].observations` and again in the top-level `observations` array, with mostly duplicated reason/rationale/disposition metadata. This makes the artifact harder to inspect and increases the chance that future tooling reads inconsistent copies.  
**Suggestion:** Keep one canonical representation of each finding and derive the other view only when needed. If the schema requires both arrays, reduce one side to references such as `findingId`/`fingerprint` instead of repeating the full observation payload.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Collapse empty draft triage artifacts into a generated template path
**Finding key:** loop-a47ac92d4fe38b729939
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-questions-triage.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-questions-triage.json`  
**Requirement:** R7  
**Issue:** This artifact is structurally identical to the other empty draft triage artifact except for phase/source/timestamp values. Persisting many near-identical empty JSON files adds noise and makes review diffs harder to scan.  
**Suggestion:** Prefer a shared generation path for empty triage artifacts that emits the same schema from phase metadata, or omit committing empty no-op artifacts if the workflow can regenerate them deterministically.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-questions-triage.json`  
**Requirement:** R7  
**Issue:** This artifact is structurally identical to the other empty draft triage artifact except for phase/source/timestamp values. Persisting many near-identical empty JSON files adds noise and makes review diffs harder to scan.  
**Suggestion:** Prefer a shared generation path for empty triage artifacts that emits the same schema from phase metadata, or omit committing empty no-op artifacts if the workflow can regenerate them deterministically.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Collapse empty draft repair artifacts into a generated template path
**Finding key:** loop-d72ca3ef810e3db31775
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-questions-repair.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-questions-repair.json`  
**Requirement:** R7  
**Issue:** This artifact repeats the same empty repair shape used by the coverage repair artifact, differing only by phase/source/timestamp. The duplication is mechanical and does not add useful review information.  
**Suggestion:** Generate no-op repair artifacts from a common template or metadata-driven helper, and commit only artifacts that contain actual repair items or nontrivial audit content.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-questions-repair.json`  
**Requirement:** R7  
**Issue:** This artifact repeats the same empty repair shape used by the coverage repair artifact, differing only by phase/source/timestamp. The duplication is mechanical and does not add useful review information.  
**Suggestion:** Generate no-op repair artifacts from a common template or metadata-driven helper, and commit only artifacts that contain actual repair items or nontrivial audit content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 5. Collapse Empty PASS Review Artifacts
**Finding key:** loop-cde496d9dce83750b9ae
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-review-coverage.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`  
**Requirement:** R7  
**Issue:** This artifact repeats the same empty PASS structure as the questions review artifact, differing only in `phase` and `generatedAt`. The repeated full payload adds noise without additional semantic value.  
**Suggestion:** Use a generated empty-review template path or a compact canonical representation for no-finding PASS artifacts, while preserving the phase-specific artifact path for consumers.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`  
**Requirement:** R7  
**Issue:** This artifact repeats the same empty PASS structure as the questions review artifact, differing only in `phase` and `generatedAt`. The repeated full payload adds noise without additional semantic value.  
**Suggestion:** Use a generated empty-review template path or a compact canonical representation for no-finding PASS artifacts, while preserving the phase-specific artifact path for consumers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 6. Collapse Empty PASS Review Artifacts
**Finding key:** loop-edb308cad4fd85515cb2
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-review-questions.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-review-questions.json`  
**Requirement:** R7  
**Issue:** This artifact duplicates the same no-finding PASS payload shape as `draft-review-coverage.json`.  
**Suggestion:** Normalize empty review outputs through the same generated template mechanism or shared schema convention so only phase-specific fields vary.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-review-questions.json`  
**Requirement:** R7  
**Issue:** This artifact duplicates the same no-finding PASS payload shape as `draft-review-coverage.json`.  
**Suggestion:** Normalize empty review outputs through the same generated template mechanism or shared schema convention so only phase-specific fields vary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Remove Stale Runtime Log From Pending Step
**Finding key:** loop-23f1199fe389f27fa370
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R6  
**Issue:** The `impl-review` step is `pending` but still contains a `runtimeLog` from a completed `flow run review` command. That makes the persisted state contradictory and can confuse status/next-action projections.  
**Suggestion:** Remove `runtimeLog` from pending steps, or mark the step consistently with the recorded execution state if that run is meant to be authoritative.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R6  
**Issue:** The `impl-review` step is `pending` but still contains a `runtimeLog` from a completed `flow run review` command. That makes the persisted state contradictory and can confuse status/next-action projections.  
**Suggestion:** Remove `runtimeLog` from pending steps, or mark the step consistently with the recorded execution state if that run is meant to be authoritative.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Bound Persisted Metrics History
**Finding key:** loop-a3884d8d0ecd9c0e0d1b
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R8  
**Issue:** The `metrics` array grows by appending every read, issue-log, retry, gate, and agent event with no visible retention bound. This violates the bounded-resource-usage guardrail for bulk persisted history.  
**Suggestion:** Persist only a bounded recent window or aggregate counters per phase/task, with an explicit maximum entry count in the artifact contract.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R8  
**Issue:** The `metrics` array grows by appending every read, issue-log, retry, gate, and agent event with no visible retention bound. This violates the bounded-resource-usage guardrail for bulk persisted history.  
**Suggestion:** Persist only a bounded recent window or aggregate counters per phase/task, with an explicit maximum entry count in the artifact contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Deduplicate Repeated Retry Metric Entries
**Finding key:** loop-599a0cf6a42b2a4a22e9
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R6  
**Issue:** Five identical `reviewRetry` entries for `phase: "test"` and `recoveredFrom: "unscoped-test-review-fail"` differ only by timestamp. This duplicates state that could be represented more clearly as a single count.  
**Suggestion:** Collapse these into one aggregate retry record with `count: 5`, or rely on `stepAttempts.attempt` as the canonical attempt count.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R6  
**Issue:** Five identical `reviewRetry` entries for `phase: "test"` and `recoveredFrom: "unscoped-test-review-fail"` differ only by timestamp. This duplicates state that could be represented more clearly as a single count.  
**Suggestion:** Collapse these into one aggregate retry record with `count: 5`, or rely on `stepAttempts.attempt` as the canonical attempt count.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Populate Requirement Traceability
**Finding key:** loop-075475af4203943e390d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R9  
**Issue:** Top-level `requirements` and each task’s `requirements` arrays are empty, even though `file-map.json` defines R1-R9 ownership. This weakens traceability and makes the flow state less useful for review convergence decisions.  
**Suggestion:** Populate requirement IDs on the flow and tasks, or remove the empty arrays if requirement traceability is intentionally represented only in `file-map.json`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R9  
**Issue:** Top-level `requirements` and each task’s `requirements` arrays are empty, even though `file-map.json` defines R1-R9 ownership. This weakens traceability and makes the flow state less useful for review convergence decisions.  
**Suggestion:** Populate requirement IDs on the flow and tasks, or remove the empty arrays if requirement traceability is intentionally represented only in `file-map.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Keep only the authoritative impl review artifact
**Finding key:** loop-c75d7f9f88b9c38f7206
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/impl-review.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The diff contains two separate new-file versions for the same path: an earlier `PASS` artifact and a later `ADVISORY` artifact with 77 improvements. That makes the reviewed state ambiguous and obscures which review result is canonical.
**Suggestion:** Commit only the final authoritative `impl-review.json` content. If earlier attempts are useful, store them under attempt-specific review-history filenames instead of the canonical artifact path.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The diff contains two separate new-file versions for the same path: an earlier `PASS` artifact and a later `ADVISORY` artifact with 77 improvements. That makes the reviewed state ambiguous and obscures which review result is canonical.
**Suggestion:** Commit only the final authoritative `impl-review.json` content. If earlier attempts are useful, store them under attempt-specific review-history filenames instead of the canonical artifact path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Deduplicate issue-log failure details
**Finding key:** loop-8f8ed1a6a7cd14ace9f2
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R7
**Issue:** The first entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`. This inflates the artifact and creates drift risk between multiple projections of the same finding.
**Suggestion:** Store the detailed failure payload once, preferably in `observations`, and make `reason` a concise summary while `failedEvaluations` uses lightweight references such as `guardrail_id` plus an observation id or index.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R7
**Issue:** The first entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`. This inflates the artifact and creates drift risk between multiple projections of the same finding.
**Suggestion:** Store the detailed failure payload once, preferably in `observations`, and make `reason` a concise summary while `failedEvaluations` uses lightweight references such as `guardrail_id` plus an observation id or index.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Bound issue-log growth
**Finding key:** loop-909e265536e9dc945c0c
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R3
**Issue:** The issue log is append-only and stores full historical reasons, resolutions, observations, and raw repair notes without an explicit retention or size bound. This conflicts with the `bounded-resource-usage` guardrail for bulk persisted state.
**Suggestion:** Add a retention policy such as keeping the latest N entries plus summarized counters, or split older details into bounded attempt artifacts referenced from the current issue log.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R3
**Issue:** The issue log is append-only and stores full historical reasons, resolutions, observations, and raw repair notes without an explicit retention or size bound. This conflicts with the `bounded-resource-usage` guardrail for bulk persisted state.
**Suggestion:** Add a retention policy such as keeping the latest N entries plus summarized counters, or split older details into bounded attempt artifacts referenced from the current issue log.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Add trailing newline to the issue document
**Finding key:** loop-ab35c3bf6aa57314fc36
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/issue.md`
**Requirement:** R9
**Issue:** The Markdown file ends without a trailing newline, which creates avoidable formatting churn and is inconsistent with normal text-file conventions.
**Suggestion:** Ensure the generated/copied issue Markdown always terminates with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue.md`
**Requirement:** R9
**Issue:** The Markdown file ends without a trailing newline, which creates avoidable formatting churn and is inconsistent with normal text-file conventions.
**Suggestion:** Ensure the generated/copied issue Markdown always terminates with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 5. Avoid committing transient workflow mutation output
**Finding key:** loop-383b8cbd5f399e7c2771
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`
**Requirement:** R9
**Issue:** The artifact records a transient workflow status mutation, including `changed` and `previousStatus`. This looks like command execution output rather than stable source or durable review evidence.
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow result must be versioned.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`
**Requirement:** R9
**Issue:** The artifact records a transient workflow status mutation, including `changed` and `previousStatus`. This looks like command execution output rather than stable source or durable review evidence.
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow result must be versioned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 6. Normalize empty draft review-history artifacts
**Finding key:** loop-243eee46eeee23791b97
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json`
**Requirement:** R9
**Issue:** This no-finding artifact has the same structure as `draft-questions-attempt-001.json`, differing only by phase, source artifact, and timestamp. Persisting full empty attempt records adds mechanical noise.
**Suggestion:** Generate empty `PASS` review-history artifacts from a shared template, or omit no-op attempt files when the source review artifact already records the empty result.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json`
**Requirement:** R9
**Issue:** This no-finding artifact has the same structure as `draft-questions-attempt-001.json`, differing only by phase, source artifact, and timestamp. Persisting full empty attempt records adds mechanical noise.
**Suggestion:** Generate empty `PASS` review-history artifacts from a shared template, or omit no-op attempt files when the source review artifact already records the empty result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 7. Normalize repeated empty draft review shape
**Finding key:** loop-9161fc9a1db3ff6a9793
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json`
**Requirement:** R9
**Issue:** This file repeats the same empty `PASS` schema used by the draft coverage attempt, including empty finding arrays and identical summary text.
**Suggestion:** Use a shared generation path for empty draft review attempts and persist only phase-specific metadata plus references when no findings exist.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json`
**Requirement:** R9
**Issue:** This file repeats the same empty `PASS` schema used by the draft coverage attempt, including empty finding arrays and identical summary text.
**Suggestion:** Use a shared generation path for empty draft review attempts and persist only phase-specific metadata plus references when no findings exist.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Use consistent count field names across history JSON files
**Finding key:** loop-553f5589c538b460c8e7
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/impl-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`  
**Requirement:** R9  
**Issue:** This file uses `summary`, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. The inconsistency makes consumers branch by phase unnecessarily.  
**Suggestion:** Standardize on one field name, preferably `counts`, across review-history JSON artifacts.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`  
**Requirement:** R9  
**Issue:** This file uses `summary`, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. The inconsistency makes consumers branch by phase unnecessarily.  
**Suggestion:** Standardize on one field name, preferably `counts`, across review-history JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Avoid duplicating finding records in the JSON history artifact
**Finding key:** loop-ee416b967da6a77fcb8d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`  
**Requirement:** R9  
**Issue:** The same finding data is represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the flattened `findings` array. Several records also repeat the same `findingId` / `fingerprint`, increasing drift risk between projections.  
**Suggestion:** Keep one canonical findings collection and derive grouped blocking/advisory views when rendering or consuming the artifact, or store only lightweight references in grouped sections.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`  
**Requirement:** R9  
**Issue:** The same finding data is represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the flattened `findings` array. Several records also repeat the same `findingId` / `fingerprint`, increasing drift risk between projections.  
**Suggestion:** Keep one canonical findings collection and derive grouped blocking/advisory views when rendering or consuming the artifact, or store only lightweight references in grouped sections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Add trailing newline to Markdown artifact
**Finding key:** loop-0d6e0489403f2682d726
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/spec-attempt-001.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/spec-attempt-001.md`  
**Requirement:** R9  
**Issue:** The file is missing a trailing newline, which is inconsistent with the other generated Markdown artifacts and can create noisy diffs.  
**Suggestion:** Ensure the renderer always terminates generated Markdown files with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/spec-attempt-001.md`  
**Requirement:** R9  
**Issue:** The file is missing a trailing newline, which is inconsistent with the other generated Markdown artifacts and can create noisy diffs.  
**Suggestion:** Ensure the renderer always terminates generated Markdown files with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Add trailing newline to Markdown artifact
**Finding key:** loop-b754bc65f0be3025bdd7
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec-review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/spec-review.md`  
**Requirement:** R9  
**Issue:** The file is missing a trailing newline, which is inconsistent with the other generated Markdown artifacts and can create noisy diffs.  
**Suggestion:** Ensure the renderer always terminates generated Markdown files with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec-review.md`  
**Requirement:** R9  
**Issue:** The file is missing a trailing newline, which is inconsistent with the other generated Markdown artifacts and can create noisy diffs.  
**Suggestion:** Ensure the renderer always terminates generated Markdown files with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Remove duplicated finding payloads from JSON history artifacts
**Finding key:** loop-0b997118517e06565918
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-002.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-002.json`
**Requirement:** R1
**Issue:** Each finding is represented twice: once in `blockingFindings`/`advisoryFindings` and again in the flattened `findings` array, with duplicated titles, fingerprints, rationale, and issue text. This creates drift risk and makes generated history artifacts larger than needed.
**Suggestion:** Persist one canonical findings list and derive grouped blocking/advisory views when rendering, or store only lightweight grouped references such as finding IDs.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-002.json`
**Requirement:** R1
**Issue:** Each finding is represented twice: once in `blockingFindings`/`advisoryFindings` and again in the flattened `findings` array, with duplicated titles, fingerprints, rationale, and issue text. This creates drift risk and makes generated history artifacts larger than needed.
**Suggestion:** Persist one canonical findings list and derive grouped blocking/advisory views when rendering, or store only lightweight grouped references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Remove duplicated finding payloads from later JSON attempts
**Finding key:** loop-6181c886236294d118e1
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.json`
**Requirement:** R1
**Issue:** The same duplicated structure appears here: full finding records are repeated in both `blockingFindings` and `findings`.
**Suggestion:** Use the same single-source representation as `test-attempt-002.json`, keeping either the grouped arrays or the flat array but not both as full copies.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.json`
**Requirement:** R1
**Issue:** The same duplicated structure appears here: full finding records are repeated in both `blockingFindings` and `findings`.
**Suggestion:** Use the same single-source representation as `test-attempt-002.json`, keeping either the grouped arrays or the flat array but not both as full copies.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Remove duplicated finding payloads from single-finding attempt
**Finding key:** loop-e7c97d7bca0efbed2189
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-004.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-004.json`
**Requirement:** R1
**Issue:** Even with one finding, the artifact stores the same finding details twice. This is unnecessary duplication and can become inconsistent if one copy is updated manually or by a follow-up generator change.
**Suggestion:** Store the finding once and derive the alternate grouping from `severity`/`kind`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-004.json`
**Requirement:** R1
**Issue:** Even with one finding, the artifact stores the same finding details twice. This is unnecessary duplication and can become inconsistent if one copy is updated manually or by a follow-up generator change.
**Suggestion:** Store the finding once and derive the alternate grouping from `severity`/`kind`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Normalize duplicated Markdown rendering structure
**Finding key:** loop-31a079cdaae0f37c3c38
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-003.md
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.md`
**Requirement:** R1
**Issue:** The Markdown files repeat a fixed template that is already represented structurally in the paired JSON artifact. Maintaining both as independent full outputs creates duplication across formats.
**Suggestion:** Treat Markdown as a generated projection from the JSON artifact, and ensure the generator owns formatting consistently. If both files must be committed, add a generated-file marker or generation metadata so reviewers do not treat the Markdown as hand-maintained source.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.md`
**Requirement:** R1
**Issue:** The Markdown files repeat a fixed template that is already represented structurally in the paired JSON artifact. Maintaining both as independent full outputs creates duplication across formats.
**Suggestion:** Treat Markdown as a generated projection from the JSON artifact, and ensure the generator owns formatting consistently. If both files must be committed, add a generated-file marker or generation metadata so reviewers do not treat the Markdown as hand-maintained source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 5. Add trailing newline
**Finding key:** loop-fa5f51981354e6261566
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-003.md
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.md`
**Requirement:** R1
**Issue:** The file has no trailing newline, which is inconsistent with normal text-file conventions and with `test-attempt-002.md`.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.md`
**Requirement:** R1
**Issue:** The file has no trailing newline, which is inconsistent with normal text-file conventions and with `test-attempt-002.md`.
**Suggestion:** End the file with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 6. Add trailing newline
**Finding key:** loop-a0cc9189299c8bdfe8cc
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-004.md
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-004.md`
**Requirement:** R1
**Issue:** The file has no trailing newline, creating avoidable formatting churn in generated review history.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-004.md`
**Requirement:** R1
**Issue:** The file has no trailing newline, creating avoidable formatting churn in generated review history.
**Suggestion:** End the file with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Use distinct finding identities
**Finding key:** loop-72d58625abf56278b360
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`
**Requirement:** R9
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` even though they describe different missing coverage areas.
**Suggestion:** Generate separate stable identifiers for the stale target tree coverage finding and the completed-review idempotence finding so downstream deduplication or tracking does not collapse them.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`
**Requirement:** R9
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` even though they describe different missing coverage areas.
**Suggestion:** Generate separate stable identifiers for the stale target tree coverage finding and the completed-review idempotence finding so downstream deduplication or tracking does not collapse them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Remove duplicated finding payloads
**Finding key:** loop-31810baade19057ab39c
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`
**Requirement:** R9
**Issue:** The same findings are stored twice: once in `blockingFindings` and again in the flattened `findings` array, duplicating title, rationale, issue/body, fingerprint, and disposition data.
**Suggestion:** Persist one canonical findings collection and derive grouped blocking/advisory views when rendering, or make grouped arrays lightweight references by `findingId`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`
**Requirement:** R9
**Issue:** The same findings are stored twice: once in `blockingFindings` and again in the flattened `findings` array, duplicating title, rationale, issue/body, fingerprint, and disposition data.
**Suggestion:** Persist one canonical findings collection and derive grouped blocking/advisory views when rendering, or make grouped arrays lightweight references by `findingId`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Add trailing newline to Markdown artifact
**Finding key:** loop-618d4177517ea7ba001a
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.md`
**Requirement:** R9
**Issue:** The file has no trailing newline, which is inconsistent with normal generated text-file formatting and creates noisy diffs.
**Suggestion:** Ensure this artifact, and the generator that writes it, always terminates Markdown output with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.md`
**Requirement:** R9
**Issue:** The file has no trailing newline, which is inconsistent with normal generated text-file formatting and creates noisy diffs.
**Suggestion:** Ensure this artifact, and the generator that writes it, always terminates Markdown output with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Clarify scenario result naming
**Finding key:** loop-c1c223c2fb9cb1f99a8c
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/scenario-validity-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`
**Requirement:** R9
**Issue:** `process.exitCode` is `1` and all requirements are classified as `expected_fail`, but the top-level `result` is `"pass"`. The field name conflates scenario-validity success with command execution failure.
**Suggestion:** Split the field into clearer names, for example `scenarioResult: "pass"` and `commandResult: "fail"`, or use a value such as `"expected_failures_observed"`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`
**Requirement:** R9
**Issue:** `process.exitCode` is `1` and all requirements are classified as `expected_fail`, but the top-level `result` is `"pass"`. The field name conflates scenario-validity success with command execution failure.
**Suggestion:** Split the field into clearer names, for example `scenarioResult: "pass"` and `commandResult: "fail"`, or use a value such as `"expected_failures_observed"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 5. Deduplicate repeated evidence command strings
**Finding key:** loop-7ca0680320636f694869
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/scenario-validity-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`
**Requirement:** R9
**Issue:** The same long `command` value is repeated at the top level and inside every `summary[*].evidence`, increasing artifact size and drift risk.
**Suggestion:** Keep the command only once at the top level, and have each evidence entry refer to it implicitly or by a short `commandRef`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`
**Requirement:** R9
**Issue:** The same long `command` value is repeated at the top level and inside every `summary[*].evidence`, increasing artifact size and drift risk.
**Suggestion:** Keep the command only once at the top level, and have each evidence entry refer to it implicitly or by a short `commandRef`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 6. Remove duplicate module ownership entry
**Finding key:** loop-cc6dc604c211988a1ba2
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** `overview.modules` lists `src/flow/lib/review-convergence.js` twice with overlapping ownership descriptions.
**Suggestion:** Merge the two module entries into one complete description, preserving `added_by_task` only if workflow metadata requires it.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** `overview.modules` lists `src/flow/lib/review-convergence.js` twice with overlapping ownership descriptions.
**Suggestion:** Merge the two module entries into one complete description, preserving `added_by_task` only if workflow metadata requires it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Remove Duplicate Module Ownership Bullet
**Finding key:** loop-ee8aaa8d6565a4ae0719
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R1  
**Issue:** `src/flow/lib/review-convergence.js` is listed twice under `### Modules` with overlapping ownership descriptions.  
**Suggestion:** Merge the two bullets into one complete description covering dispositions, tooling outcomes, evidence identity, findings, convergence state, attempts, and permitted operations.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R1  
**Issue:** `src/flow/lib/review-convergence.js` is listed twice under `### Modules` with overlapping ownership descriptions.  
**Suggestion:** Merge the two bullets into one complete description covering dispositions, tooling outcomes, evidence identity, findings, convergence state, attempts, and permitted operations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Remove Empty Placeholder Sections
**Finding key:** loop-901e2f21e7dba8b50c5a
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R9  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders that add noise and can be mistaken for unfinished required content.  
**Suggestion:** Either remove these sections or replace them with explicit content such as `None` if the renderer/project convention requires the headings.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R9  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders that add noise and can be mistaken for unfinished required content.  
**Suggestion:** Either remove these sections or replace them with explicit content such as `None` if the renderer/project convention requires the headings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Avoid Duplicating Full Finding Payloads
**Finding key:** loop-9d7448e3a0c5305e4d39
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/task-impl-gate-source.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R9  
**Issue:** The same guardrail failure text and metadata are duplicated across `evaluations[].observations[]` and top-level `observations[]`, with separate fingerprints for essentially the same finding. This increases drift risk in generated review artifacts.  
**Suggestion:** Prefer a single canonical observation record referenced from evaluations, or keep the detailed payload in one place and use a lightweight reference in the other.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R9  
**Issue:** The same guardrail failure text and metadata are duplicated across `evaluations[].observations[]` and top-level `observations[]`, with separate fingerprints for essentially the same finding. This increases drift risk in generated review artifacts.  
**Suggestion:** Prefer a single canonical observation record referenced from evaluations, or keep the detailed payload in one place and use a lightweight reference in the other.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 5. Remove Generated Task Markdown From Review-Oriented Diff
**Finding key:** loop-e24427fc14cbc8cdb45c
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tasks/T-5.md
**Requirement:** R3
**Issue:** **File:** `specs/328-bounded-review-convergence/tasks/T-5.md`
**Requirement:** R3
**Issue:** The task file is marked auto-generated and contains only rendered spec metadata. Keeping generated task projections in a behavior review change set adds maintenance surface without implementation value.
**Suggestion:** Prefer committing the source `spec.json` task definition and regenerate `tasks/T-5.md` during the flow, unless this repository intentionally versions rendered task projections.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tasks/T-5.md`
**Requirement:** R3
**Issue:** The task file is marked auto-generated and contains only rendered spec metadata. Keeping generated task projections in a behavior review change set adds maintenance surface without implementation value.
**Suggestion:** Prefer committing the source `spec.json` task definition and regenerate `tasks/T-5.md` during the flow, unless this repository intentionally versions rendered task projections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 6. Remove Generated Task Markdown From Review-Oriented Diff
**Finding key:** loop-9b8a1ccf9408bca665de
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tasks/T-6.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tasks/T-6.md`
**Requirement:** R9
**Issue:** Like `T-5.md`, this is an auto-generated projection. It duplicates task data that should be owned by the spec source and can drift if edited or regenerated independently.
**Suggestion:** Keep the canonical task content in the spec source and exclude the rendered task markdown from this change, or document that rendered task files are committed artifacts and must not be manually reviewed as source.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tasks/T-6.md`
**Requirement:** R9
**Issue:** Like `T-5.md`, this is an auto-generated projection. It duplicates task data that should be owned by the spec source and can drift if edited or regenerated independently.
**Suggestion:** Keep the canonical task content in the spec source and exclude the rendered task markdown from this change, or document that rendered task files are committed artifacts and must not be manually reviewed as source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Tighten Evidence Coverage Status Naming
**Finding key:** loop-842b483c27f68b8608b5
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/test-coverage.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/test-coverage.json`
**Requirement:** R9
**Issue:** Every requirement is marked `"status": "covered"` while `test-review.json` rejects the test review for missing R2/R3 executable coverage. The name reads like final coverage truth, but the surrounding artifacts contradict it.
**Suggestion:** Rename or split the field so it distinguishes “header/test name observed” from “acceptance coverage satisfied”, for example `observedStatus: "observed"` plus a separate review verdict artifact.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/test-coverage.json`
**Requirement:** R9
**Issue:** Every requirement is marked `"status": "covered"` while `test-review.json` rejects the test review for missing R2/R3 executable coverage. The name reads like final coverage truth, but the surrounding artifacts contradict it.
**Suggestion:** Rename or split the field so it distinguishes “header/test name observed” from “acceptance coverage satisfied”, for example `observedStatus: "observed"` plus a separate review verdict artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 3. Avoid Stale Generated Timestamp In Review Fixture
**Finding key:** loop-09de85d69b1c9d67ccb5
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/test-review.json
**Requirement:** R2
**Issue:** **File:** `specs/328-bounded-review-convergence/test-review.json`
**Requirement:** R2
**Issue:** `generatedAt` is a fixed wall-clock timestamp in a committed generated artifact. If this file is used as fixture evidence, the timestamp adds churn without helping validate review identity or behavior.
**Suggestion:** Either omit `generatedAt` from the committed fixture or use a deterministic fixture timestamp such as a documented constant.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/test-review.json`
**Requirement:** R2
**Issue:** `generatedAt` is a fixed wall-clock timestamp in a committed generated artifact. If this file is used as fixture evidence, the timestamp adds churn without helping validate review identity or behavior.
**Suggestion:** Either omit `generatedAt` from the committed fixture or use a deterministic fixture timestamp such as a documented constant.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Deduplicate Review Finding Text Across JSON And Markdown
**Finding key:** loop-da916fd361e87a1b8197
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/test-review.md
**Requirement:** R2
**Issue:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R2
**Issue:** The markdown file repeats the same finding titles, issues, required changes, and rationale already stored in `test-review.json`. This risks drift between the machine-readable and human-readable review artifacts.
**Suggestion:** Treat `test-review.json` as the canonical source and generate `test-review.md` from it, or remove the markdown artifact if the flow can render human-readable output on demand.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R2
**Issue:** The markdown file repeats the same finding titles, issues, required changes, and rationale already stored in `test-review.json`. This risks drift between the machine-readable and human-readable review artifacts.
**Suggestion:** Treat `test-review.json` as the canonical source and generate `test-review.md` from it, or remove the markdown artifact if the flow can render human-readable output on demand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Remove Committed Raw Failure Log
**Finding key:** loop-cb878b8d4b59f7381ede
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/.raw/scenario-validity.log
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/.raw/scenario-validity.log`
**Requirement:** R9
**Issue:** The committed raw log is 3,510 lines of transient TAP output, duplicated stack traces, and large pasted source excerpts. This is generated evidence rather than maintainable source, and it creates noisy diffs with little review value.
**Suggestion:** Replace this with the structured result artifact already present in the spec, or commit only a bounded summarized fixture containing command, exit code, failing test names, and requirement IDs.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/.raw/scenario-validity.log`
**Requirement:** R9
**Issue:** The committed raw log is 3,510 lines of transient TAP output, duplicated stack traces, and large pasted source excerpts. This is generated evidence rather than maintainable source, and it creates noisy diffs with little review value.
**Suggestion:** Replace this with the structured result artifact already present in the spec, or commit only a bounded summarized fixture containing command, exit code, failing test names, and requirement IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 1. Extract Shared Test Import Helpers
**Finding key:** loop-cd0b48a0d32d710c3f81
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-action-resolution.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R9
**Issue:** `root`, `importRoot`, and `model()` duplicate the same dynamic import setup used in `review-convergence-model.test.js`, and similar helpers appear in the other new spec-local tests.
**Suggestion:** Move the common model import helper into a small helper within the touched spec test set, or at least consolidate per-file constants into a local `loadReviewConvergenceModel()` helper with the same naming across these new files.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R9
**Issue:** `root`, `importRoot`, and `model()` duplicate the same dynamic import setup used in `review-convergence-model.test.js`, and similar helpers appear in the other new spec-local tests.
**Suggestion:** Move the common model import helper into a small helper within the touched spec test set, or at least consolidate per-file constants into a local `loadReviewConvergenceModel()` helper with the same naming across these new files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Extract Repeated Stage List
**Finding key:** loop-043df49cdfeb11f16642
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-convergence-model.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-convergence-model.test.js`
**Requirement:** R9
**Issue:** The tooling stage list `["startup", "communication", "parse", "post_hook", "canonical_write", "projection", "result_recording"]` is repeated across multiple new tests, making future stage changes easy to miss.
**Suggestion:** Define a `toolingStages` constant in each touched test file that loops over all stages, or share one helper if the spec-local tests already allow a local helper module.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-convergence-model.test.js`
**Requirement:** R9
**Issue:** The tooling stage list `["startup", "communication", "parse", "post_hook", "canonical_write", "projection", "result_recording"]` is repeated across multiple new tests, making future stage changes easy to miss.
**Suggestion:** Define a `toolingStages` constant in each touched test file that loops over all stages, or share one helper if the spec-local tests already allow a local helper module.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Remove Unused Fixture Return Fields
**Finding key:** loop-7868cb41c11117091c48
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js`
**Requirement:** R9
**Issue:** `createCliFixture()` returns `specId` and `currentTreeSha`, but the tests do not use those fields outside the helper.
**Suggestion:** Drop unused returned fields to keep fixture outputs limited to the values the tests actually consume: `tmp`, `manager`, `specPath`, and `relativeInput`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js`
**Requirement:** R9
**Issue:** `createCliFixture()` returns `specId` and `currentTreeSha`, but the tests do not use those fields outside the helper.
**Suggestion:** Drop unused returned fields to keep fixture outputs limited to the values the tests actually consume: `tmp`, `manager`, `specPath`, and `relativeInput`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Name Tooling Helpers By New Domain Language
**Finding key:** loop-bb2b253b04037b031106
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/commands/review.js`
**Requirement:** R7
**Issue:** `toolingFailureResult()` and `buildToolingFailureReview()` now produce `ReviewToolingOutcome` / `TOOLING_ERROR` structures, but their names still encode the old “failure” terminology.
**Suggestion:** Rename them to `toolingErrorResult()` and `buildToolingErrorReview()` or `buildToolingOutcomeReview()` so the implementation consistently reflects the migrated model.
**Suggestion:** **File:** `src/flow/commands/review.js`
**Requirement:** R7
**Issue:** `toolingFailureResult()` and `buildToolingFailureReview()` now produce `ReviewToolingOutcome` / `TOOLING_ERROR` structures, but their names still encode the old “failure” terminology.
**Suggestion:** Rename them to `toolingErrorResult()` and `buildToolingErrorReview()` or `buildToolingOutcomeReview()` so the implementation consistently reflects the migrated model.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Extract Review Verdict Constants
**Finding key:** loop-a8497b6d067006977af8
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R7
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** The valid review verdict set is repeated inline as string literals, for example `["PASS", "ADVISORY", "REJECTED"]`, and individual verdict checks repeat throughout lifecycle resolution.
**Suggestion:** Add a local frozen constant such as `REVIEW_VERDICTS` and small predicates like `isAcceptedReviewVerdict(verdict)` / `isRejectedReviewVerdict(verdict)` to reduce drift as the FAIL-to-REJECTED migration settles.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** The valid review verdict set is repeated inline as string literals, for example `["PASS", "ADVISORY", "REJECTED"]`, and individual verdict checks repeat throughout lifecycle resolution.
**Suggestion:** Add a local frozen constant such as `REVIEW_VERDICTS` and small predicates like `isAcceptedReviewVerdict(verdict)` / `isRejectedReviewVerdict(verdict)` to reduce drift as the FAIL-to-REJECTED migration settles.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 1. Bound review convergence record processing
**Finding key:** loop-32be66beba0522a2af85
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `latestReviewConvergenceRecords()` and `reviewHandoffFindings()` process every `flowState.reviewConvergence.records` entry and every `handoffFindings` entry without an explicit count bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add explicit caps for records and handoff findings, preferably named constants near the helper, and throw a mechanical blocker or validation error when exceeded.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `latestReviewConvergenceRecords()` and `reviewHandoffFindings()` process every `flowState.reviewConvergence.records` entry and every `handoffFindings` entry without an explicit count bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add explicit caps for records and handoff findings, preferably named constants near the helper, and throw a mechanical blocker or validation error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 2. Bound canonical evidence file reads
**Finding key:** loop-6e50442a01d20195e59c
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `canonicalReviewSourceMatches()` reads the whole canonical evidence file with `fs.readFileSync(sourcePath)` and then parses/stringifies derived content. There is no maximum file size, so malformed or unexpectedly large artifacts can cause unbounded memory use.  
**Suggestion:** Check `sourceStat.size` against a named maximum before reading. Reuse the project’s existing bounded artifact-reading pattern if available in this file, or add a local constant such as `MAX_CANONICAL_REVIEW_EVIDENCE_BYTES`.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `canonicalReviewSourceMatches()` reads the whole canonical evidence file with `fs.readFileSync(sourcePath)` and then parses/stringifies derived content. There is no maximum file size, so malformed or unexpectedly large artifacts can cause unbounded memory use.  
**Suggestion:** Check `sourceStat.size` against a named maximum before reading. Reuse the project’s existing bounded artifact-reading pattern if available in this file, or add a local constant such as `MAX_CANONICAL_REVIEW_EVIDENCE_BYTES`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 3. Extract duplicate latest-review-record logic
**Finding key:** loop-78606ba836fbac2c5aa2
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** `buildDeferredFindingsSummary()` duplicates the “latest review convergence record by phase/task” logic added in `acceptance-review-artifacts.js`. The key construction `${record.phase}:${record.taskId ?? ""}` is now repeated, making future behavior drift likely.  
**Suggestion:** Extract a small shared helper within a touched module boundary, or mirror a single local helper name and implementation consistently across both touched files. At minimum, introduce a named helper in this file so the keying rule is isolated.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** `buildDeferredFindingsSummary()` duplicates the “latest review convergence record by phase/task” logic added in `acceptance-review-artifacts.js`. The key construction `${record.phase}:${record.taskId ?? ""}` is now repeated, making future behavior drift likely.  
**Suggestion:** Extract a small shared helper within a touched module boundary, or mirror a single local helper name and implementation consistently across both touched files. At minimum, introduce a named helper in this file so the keying rule is isolated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 4. Reuse handoff source-step derivation
**Finding key:** loop-d4f02fa7e140d012bbdc
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** This file defaults handoff source steps to `"review"`, while `acceptance-review-artifacts.js` derives them as `finding.sourceStep || (record.taskId == null ? `${record.phase}-review` : "task-review")`. That inconsistency can make summary counts disagree with acceptance artifacts for the same handoff findings.  
**Suggestion:** Use the same source-step derivation rule in both files, preferably via a helper such as `reviewHandoffSourceStep(record, finding)`.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** This file defaults handoff source steps to `"review"`, while `acceptance-review-artifacts.js` derives them as `finding.sourceStep || (record.taskId == null ? `${record.phase}-review` : "task-review")`. That inconsistency can make summary counts disagree with acceptance artifacts for the same handoff findings.  
**Suggestion:** Use the same source-step derivation rule in both files, preferably via a helper such as `reviewHandoffSourceStep(record, finding)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 5. Replace repeated verdict literals with a local constant
**Finding key:** loop-77591ece2770a2e873a1
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`  
**Requirement:** R7  
**Issue:** The migration from `"FAIL"` to `"REJECTED"` leaves the verdict literal repeated across touched files. This is small now, but verdict names are part of the flow contract and repeated strings make future migrations error-prone.  
**Suggestion:** Introduce a local constant such as `const REVIEW_REJECTED_VERDICT = "REJECTED";` in touched files with multiple references, or use an existing verdict constant if one exists within the touched file set.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`  
**Requirement:** R7  
**Issue:** The migration from `"FAIL"` to `"REJECTED"` leaves the verdict literal repeated across touched files. This is small now, but verdict names are part of the flow contract and repeated strings make future migrations error-prone.  
**Suggestion:** Introduce a local constant such as `const REVIEW_REJECTED_VERDICT = "REJECTED";` in touched files with multiple references, or use an existing verdict constant if one exists within the touched file set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 1. Remove Unused Max-Attempts Helper
**Finding key:** loop-7614b9f50928fcb90520
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R6
**Issue:** `resolveActiveStepMaxAttempts()` is still present but no longer used after status switched from `reviewStop`/review retry recovery to `reviewAction`. This leaves dead code and a now-unused `resolveMaxAttempts` dependency if there are no other references in the file.
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` and remove the `resolveMaxAttempts` import from this file if it becomes unused.
**Suggestion:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R6
**Issue:** `resolveActiveStepMaxAttempts()` is still present but no longer used after status switched from `reviewStop`/review retry recovery to `reviewAction`. This leaves dead code and a now-unused `resolveMaxAttempts` dependency if there are no other references in the file.
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` and remove the `resolveMaxAttempts` import from this file if it becomes unused.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 2. Extract Duplicate Review Step Resolution
**Finding key:** loop-bcf7769fbf464cf3bc50
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same phase/task-to-scope/stepId resolution logic. This makes future review phase routing changes easy to apply inconsistently.
**Suggestion:** Add a helper such as `reviewStepContextForTarget(phase, taskId)` returning `{ scope, stepId }`, and have both functions call it.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same phase/task-to-scope/stepId resolution logic. This makes future review phase routing changes easy to apply inconsistently.
**Suggestion:** Add a helper such as `reviewStepContextForTarget(phase, taskId)` returning `{ scope, stepId }`, and have both functions call it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 3. Extract Default Tooling Blocker Construction
**Finding key:** loop-0f98585b07d7fdf26a8b
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R6
**Issue:** `resolveReviewPermittedOperation()` constructs the same default `ReviewBlocker` for exhausted tooling attempts in two branches.
**Suggestion:** Extract a helper like `defaultToolingAttemptsExhaustedBlocker()` and reuse it in both `StopAsBlocker` paths.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R6
**Issue:** `resolveReviewPermittedOperation()` constructs the same default `ReviewBlocker` for exhausted tooling attempts in two branches.
**Suggestion:** Extract a helper like `defaultToolingAttemptsExhaustedBlocker()` and reuse it in both `StopAsBlocker` paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 4. Avoid Redundant Convergence Record Scans
**Finding key:** loop-97514b41dface8cfd297
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R2
**Issue:** `recordToolingOutcome()` computes `existingRecord` from `convergenceRecords(flowState)`, then calls `convergenceRecords(flowState).some(...)` again for duplicate evidence checks. This repeats the same record lookup and obscures that both checks operate on the same snapshot.
**Suggestion:** Store `const records = convergenceRecords(flowState)` inside the mutation callback and reuse it for both `existingRecord` and duplicate evidence detection.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R2
**Issue:** `recordToolingOutcome()` computes `existingRecord` from `convergenceRecords(flowState)`, then calls `convergenceRecords(flowState).some(...)` again for duplicate evidence checks. This repeats the same record lookup and obscures that both checks operate on the same snapshot.
**Suggestion:** Store `const records = convergenceRecords(flowState)` inside the mutation callback and reuse it for both `existingRecord` and duplicate evidence detection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 5. Replace Trivial Revision Helper
**Finding key:** loop-85108dade5a037a132a2
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R5
**Issue:** `sameRevision(left, right)` only returns `left === right`, which adds a named abstraction without hiding meaningful behavior.
**Suggestion:** Inline the identity comparison in `ReviewEvidenceRegistrar.register()` or rename/expand the helper only if revision comparison is expected to become richer.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R5
**Issue:** `sameRevision(left, right)` only returns `left === right`, which adds a named abstraction without hiding meaningful behavior.
**Suggestion:** Inline the identity comparison in `ReviewEvidenceRegistrar.register()` or rename/expand the helper only if revision comparison is expected to become richer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 6. Extract Reusable Path Validation
**Finding key:** loop-068806a95a7a29128780
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R5
**Issue:** `ReviewEvidenceInput.fromFile()` and `ReviewEvidenceStore.ensureEvidenceDirectory()` both perform inside-spec checks with resolved/real paths. The logic is slightly spread out and could drift.
**Suggestion:** Extract a small helper such as `assertInsideSpec(specDir, candidate, code, message)` for the repeated containment check and error construction.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R5
**Issue:** `ReviewEvidenceInput.fromFile()` and `ReviewEvidenceStore.ensureEvidenceDirectory()` both perform inside-spec checks with resolved/real paths. The logic is slightly spread out and could drift.
**Suggestion:** Extract a small helper such as `assertInsideSpec(specDir, candidate, code, message)` for the repeated containment check and error construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 1. Bound canonical artifact loading and finding normalization
**Finding key:** loop-7a3d29377f6019a027da
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `persistCanonicalReviewArtifact()` reads and parses the full review artifact, then maps every blocking/advisory entry without an explicit size or count bound. This violates the bounded-resource guardrail for bulk data loading and recursive-style normalization surfaces.  
**Suggestion:** Add explicit caps before parsing and normalizing, for example max artifact bytes and max findings per list, and fail as a `TOOLING_ERROR`/canonical write failure path when exceeded.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `persistCanonicalReviewArtifact()` reads and parses the full review artifact, then maps every blocking/advisory entry without an explicit size or count bound. This violates the bounded-resource guardrail for bulk data loading and recursive-style normalization surfaces.  
**Suggestion:** Add explicit caps before parsing and normalizing, for example max artifact bytes and max findings per list, and fail as a `TOOLING_ERROR`/canonical write failure path when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 2. Extract repeated review-result persistence routing
**Finding key:** loop-9c3451a66ef15600b5fd
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** The draft, test, spec, and impl branches all parse a result, call `persistCanonicalReviewResult(...)`, and return the result. The repeated pattern makes it easier for future phase routing changes to miss canonical persistence.  
**Suggestion:** Introduce a helper such as `parseAndPersistReviewResult(reviewCtx, parser, args, persistedPhase, revision)` or `persistAndReturn(...)`, then use it for each phase branch.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** The draft, test, spec, and impl branches all parse a result, call `persistCanonicalReviewResult(...)`, and return the result. The repeated pattern makes it easier for future phase routing changes to miss canonical persistence.  
**Suggestion:** Introduce a helper such as `parseAndPersistReviewResult(reviewCtx, parser, args, persistedPhase, revision)` or `persistAndReturn(...)`, then use it for each phase branch.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 3. Consolidate pipeline rejection construction
**Finding key:** loop-22ffcbbaedc2fdcf5625
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `ReviewExecutionPipeline.execute()` repeats the same return shape for every pre-execution rejection: `executionStarted: false`, optional convergence state, `nextOperation`, and `pipelineRejection(...)`.  
**Suggestion:** Add a small helper like `blockedPipelineResult({ state, operation, code, message })` so the four rejection branches stay consistent and future reviewAction kinds are less likely to diverge.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `ReviewExecutionPipeline.execute()` repeats the same return shape for every pre-execution rejection: `executionStarted: false`, optional convergence state, `nextOperation`, and `pipelineRejection(...)`.  
**Suggestion:** Add a small helper like `blockedPipelineResult({ state, operation, code, message })` so the four rejection branches stay consistent and future reviewAction kinds are less likely to diverge.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 4. Rename tooling-failure compatibility helpers
**Finding key:** loop-d8b881a8f115f6922555
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** New code still uses names like `appendIssueLogFromTestReviewToolingFailure()` and `persistCanonicalToolingFailure()` while the domain language has moved from `TOOLING_FAILURE` to `TOOLING_ERROR`. This creates mixed terminology in the touched file.  
**Suggestion:** Rename them to `appendIssueLogFromTestReviewToolingError()` and `persistCanonicalToolingError()` and update local call sites/exports in this file.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** New code still uses names like `appendIssueLogFromTestReviewToolingFailure()` and `persistCanonicalToolingFailure()` while the domain language has moved from `TOOLING_FAILURE` to `TOOLING_ERROR`. This creates mixed terminology in the touched file.  
**Suggestion:** Rename them to `appendIssueLogFromTestReviewToolingError()` and `persistCanonicalToolingError()` and update local call sites/exports in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 5. Avoid unbounded scan when checking unchanged review target
**Finding key:** loop-ad30c8c1b9afccfbdd55
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `unchangedReviewConvergenceTarget()` filters all convergence records, then reads the last match. As convergence history grows, this does unnecessary bulk allocation and has no explicit bound.  
**Suggestion:** Iterate backward and return on the first matching record, or use a bounded store/query helper if available. This removes the intermediate array and better matches bounded-resource expectations.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `unchangedReviewConvergenceTarget()` filters all convergence records, then reads the last match. As convergence history grows, this does unnecessary bulk allocation and has no explicit bound.  
**Suggestion:** Iterate backward and return on the first matching record, or use a bounded store/query helper if available. This removes the intermediate array and better matches bounded-resource expectations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 65. 6. Preserve review evidence error pass-through consistently
**Finding key:** loop-265c4d59bbfaad3219f1
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** The command normalizes review evidence errors before mutation, but mutation currently passes only `{ expectedOriginal: ctx.flowState }`. If `registrar.register()` throws a review-coded error inside the CAS mutation, it may be wrapped differently than validation errors outside the mutation.  
**Suggestion:** Keep a `passThroughError` predicate for `REVIEW_` errors in the mutate options so command-level validation and registration failures surface consistently.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** The command normalizes review evidence errors before mutation, but mutation currently passes only `{ expectedOriginal: ctx.flowState }`. If `registrar.register()` throws a review-coded error inside the CAS mutation, it may be wrapped differently than validation errors outside the mutation.  
**Suggestion:** Keep a `passThroughError` predicate for `REVIEW_` errors in the mutate options so command-level validation and registration failures surface consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 66. 1. Remove Contradictory TOOLING_ERROR Override Language
**Finding key:** loop-9688f5a2106b5a696a86
**Failure mode:** refactor
**File:** src/flow/prompts/plan/test-review.md
**Requirement:** R7
**Issue:** **File:** `src/flow/prompts/plan/test-review.md`  
**Requirement:** R7  
**Issue:** The new `TOOLING_ERROR evidence recovery` section says “Completion overrides do not substitute for canonical review evidence,” but the later bullet still says `TOOLING_ERROR` “must be recovered or explicitly overridden.” That preserves legacy override wording and conflicts with the new `reviewAction` model.  
**Suggestion:** Replace the later sentence with wording aligned to the new flow, for example: ``TOOLING_ERROR` is non-semantic. It must be resolved through the returned `reviewAction` and does not complete through semantic deferral.`
**Suggestion:** **File:** `src/flow/prompts/plan/test-review.md`  
**Requirement:** R7  
**Issue:** The new `TOOLING_ERROR evidence recovery` section says “Completion overrides do not substitute for canonical review evidence,” but the later bullet still says `TOOLING_ERROR` “must be recovered or explicitly overridden.” That preserves legacy override wording and conflicts with the new `reviewAction` model.  
**Suggestion:** Replace the later sentence with wording aligned to the new flow, for example: ``TOOLING_ERROR` is non-semantic. It must be resolved through the returned `reviewAction` and does not complete through semantic deferral.`
**Disposition:** informational
**Rationale:** Loop review proposal.

### 67. 2. Prefer Consistent Review Action Naming In Prompt Text
**Finding key:** loop-5eb2ac23e02916814af8
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The updated `test-review` sentence says “Follow the single `reviewAction`,” but does not name the allowed actions while the detailed phase prompt does. This makes the skill guidance less concrete and easier to drift from the canonical prompt.  
**Suggestion:** Mirror the concise action names from `src/flow/prompts/plan/test-review.md`: `retry_review`, `register_alternative_evidence`, `move_to_acceptance`, and `stop_as_blocker`.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The updated `test-review` sentence says “Follow the single `reviewAction`,” but does not name the allowed actions while the detailed phase prompt does. This makes the skill guidance less concrete and easier to drift from the canonical prompt.  
**Suggestion:** Mirror the concise action names from `src/flow/prompts/plan/test-review.md`: `retry_review`, `register_alternative_evidence`, `move_to_acceptance`, and `stop_as_blocker`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 68. 3. Avoid Repeating Target Guard Help Assembly Inline
**Finding key:** loop-4bf58cca982bbb970d2d
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** The new `review-evidence` registry entry repeats the same help assembly pattern used by other guarded `flow set` commands: usage line, blank line, command description, validation notes, and `...FLOW_TARGET_GUARD_HELP_LINES`. As guarded commands grow, this pattern becomes easy to update inconsistently.  
**Suggestion:** Extract a small helper for guarded help text in this file, such as `targetGuardedHelp(usage, lines)`, and use it for `review-evidence` and nearby guarded `set` commands where the same pattern already exists.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** The new `review-evidence` registry entry repeats the same help assembly pattern used by other guarded `flow set` commands: usage line, blank line, command description, validation notes, and `...FLOW_TARGET_GUARD_HELP_LINES`. As guarded commands grow, this pattern becomes easy to update inconsistently.  
**Suggestion:** Extract a small helper for guarded help text in this file, such as `targetGuardedHelp(usage, lines)`, and use it for `review-evidence` and nearby guarded `set` commands where the same pattern already exists.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 69. 1. Rename stale `failReview` fixture
**Finding key:** loop-ca092edc7cfdb00d7722
**Failure mode:** refactor
**File:** tests/unit/flow/gate-spec-sanity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict contract has moved from `FAIL` to `REJECTED`. That weakens naming consistency in tests that are documenting the new review states.  
**Suggestion:** Rename `failReview` to `rejectedReview` and update its two references.
**Suggestion:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict contract has moved from `FAIL` to `REJECTED`. That weakens naming consistency in tests that are documenting the new review states.  
**Suggestion:** Rename `failReview` to `rejectedReview` and update its two references.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 70. 2. Extract repeated tooling error artifact fixture
**Finding key:** loop-d7c801b1cdd8b706660e
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same `toolingOutcome` object is duplicated in the parse assertion and the post-hook input artifact. This makes the test noisier and increases the chance of future drift between expected parse output and routed artifact input.  
**Suggestion:** Define a local helper or constant such as `const parserToolingErrorOutcome = { ... }` near the `test-review one-shot verdict routing` tests, then reuse it in both assertions.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same `toolingOutcome` object is duplicated in the parse assertion and the post-hook input artifact. This makes the test noisier and increases the chance of future drift between expected parse output and routed artifact input.  
**Suggestion:** Define a local helper or constant such as `const parserToolingErrorOutcome = { ... }` near the `test-review one-shot verdict routing` tests, then reuse it in both assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 71. 3. Avoid verdict string coupling in helper logic
**Finding key:** loop-394460e0b09219055f58
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** `metricsForImplVerdict()` infers `blockingCount` from `verdict === "REJECTED"`. That helper now bakes the verdict/count relationship into a ternary, while nearby tests already pass explicit counts through `updatesFor()`. If more verdicts or edge cases are added, this helper can silently generate invalid artifacts.  
**Suggestion:** Change `metricsForImplVerdict(verdict)` to accept an optional counts object, or use explicit fixture objects for each case so `blockingCount` and `nonBlockingCount` are stated directly in the test setup.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** `metricsForImplVerdict()` infers `blockingCount` from `verdict === "REJECTED"`. That helper now bakes the verdict/count relationship into a ternary, while nearby tests already pass explicit counts through `updatesFor()`. If more verdicts or edge cases are added, this helper can silently generate invalid artifacts.  
**Suggestion:** Change `metricsForImplVerdict(verdict)` to accept an optional counts object, or use explicit fixture objects for each case so `blockingCount` and `nonBlockingCount` are stated directly in the test setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 72. 1. Standardize canonical finding storage across review artifacts
**Finding key:** loop-388b096dd17bc1473173
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple JSON artifacts duplicate full finding payloads across grouped arrays, flattened arrays, evaluations, observations, and issue-log projections. This appears in review history, gate source, draft source, task gate source, and issue-log artifacts, creating a cross-file drift risk.
**Suggestion:** Define one canonical findings/observations representation for generated review artifacts. Use lightweight references such as `findingId`, `fingerprint`, or observation ids everywhere else.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple JSON artifacts duplicate full finding payloads across grouped arrays, flattened arrays, evaluations, observations, and issue-log projections. This appears in review history, gate source, draft source, task gate source, and issue-log artifacts, creating a cross-file drift risk.
**Suggestion:** Define one canonical findings/observations representation for generated review artifacts. Use lightweight references such as `findingId`, `fingerprint`, or observation ids everywhere else.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 73. 2. Normalize empty generated review artifact shape
**Finding key:** loop-2376409b2d224b5940bc
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-review-coverage.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`
**Requirement:** R7
**Issue:** Empty PASS/review/triage/repair artifacts repeat the same no-op JSON shape across draft coverage, draft questions, review history attempts, and triage/repair outputs. The duplicated generated payloads add review noise without semantic differences.
**Suggestion:** Route empty artifacts through a shared generated template or persist only phase/source metadata when there are no findings.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`
**Requirement:** R7
**Issue:** Empty PASS/review/triage/repair artifacts repeat the same no-op JSON shape across draft coverage, draft questions, review history attempts, and triage/repair outputs. The duplicated generated payloads add review noise without semantic differences.
**Suggestion:** Route empty artifacts through a shared generated template or persist only phase/source metadata when there are no findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 74. 3. Use one review verdict/action vocabulary across code, tests, and docs
**Finding key:** loop-a52f579ed07f95f6ea1e
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R7
**Issue:** The new model uses `REJECTED`, `TOOLING_ERROR`, and `reviewAction`, but several files still use legacy or vague names such as `toolingFailure*`, `failReview`, and prompt wording about explicit overrides. This creates inconsistent domain language across implementation, tests, prompts, and skills.
**Suggestion:** Rename helpers and fixtures to the current vocabulary, and align prompt/skill text around the canonical `reviewAction` names: `retry_review`, `register_alternative_evidence`, `move_to_acceptance`, and `stop_as_blocker`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R7
**Issue:** The new model uses `REJECTED`, `TOOLING_ERROR`, and `reviewAction`, but several files still use legacy or vague names such as `toolingFailure*`, `failReview`, and prompt wording about explicit overrides. This creates inconsistent domain language across implementation, tests, prompts, and skills.
**Suggestion:** Rename helpers and fixtures to the current vocabulary, and align prompt/skill text around the canonical `reviewAction` names: `retry_review`, `register_alternative_evidence`, `move_to_acceptance`, and `stop_as_blocker`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 75. 4. Share review convergence target and handoff derivation logic
**Finding key:** loop-e88a643541ae225cffce
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** Review convergence lookup and source-step derivation are implemented differently across `acceptance-review-artifacts.js`, `flow-findings.js`, and `review-convergence.js`. The same phase/task keying and source-step rules can drift and produce inconsistent acceptance summaries.
**Suggestion:** Extract shared helpers for review target keying and handoff source-step derivation, then use them across these files.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** Review convergence lookup and source-step derivation are implemented differently across `acceptance-review-artifacts.js`, `flow-findings.js`, and `review-convergence.js`. The same phase/task keying and source-step rules can drift and produce inconsistent acceptance summaries.
**Suggestion:** Extract shared helpers for review target keying and handoff source-step derivation, then use them across these files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 76. 5. Apply bounded-resource limits consistently to persisted review data
**Finding key:** loop-0295cc2f2cc6b0aa58b9
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files process or persist unbounded review data: convergence records, handoff findings, canonical evidence files, issue logs, raw logs, and parsed review findings. The bounded-resource requirement is therefore handled inconsistently across artifact readers and writers.
**Suggestion:** Add named maximums for artifact bytes, finding counts, convergence records, handoff entries, and persisted history. Enforce those limits at read/write boundaries with consistent tooling-error behavior.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files process or persist unbounded review data: convergence records, handoff findings, canonical evidence files, issue logs, raw logs, and parsed review findings. The bounded-resource requirement is therefore handled inconsistently across artifact readers and writers.
**Suggestion:** Add named maximums for artifact bytes, finding counts, convergence records, handoff entries, and persisted history. Enforce those limits at read/write boundaries with consistent tooling-error behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 77. 6. Standardize generated Markdown handling
**Finding key:** loop-c9821b042378241b83f3
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-003.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.md`
**Requirement:** R9
**Issue:** Several generated Markdown artifacts are missing trailing newlines, while other paired JSON/Markdown outputs duplicate the same review content. This creates inconsistent generated-file behavior across review history, issue docs, and test review artifacts.
**Suggestion:** Ensure the Markdown renderer always writes a trailing newline and treats Markdown as a generated projection from canonical JSON, with generation metadata if both formats are committed.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-003.md`
**Requirement:** R9
**Issue:** Several generated Markdown artifacts are missing trailing newlines, while other paired JSON/Markdown outputs duplicate the same review content. This creates inconsistent generated-file behavior across review history, issue docs, and test review artifacts.
**Suggestion:** Ensure the Markdown renderer always writes a trailing newline and treats Markdown as a generated projection from canonical JSON, with generation metadata if both formats are committed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 78. 7. Consolidate spec module ownership projections
**Finding key:** loop-0157e2cd94a87de7ee2b
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** `src/flow/lib/review-convergence.js` is duplicated in both `spec.json` and `spec.md` module ownership sections. The duplication exists across source and rendered documentation, so fixing only one file can leave inconsistent spec projections.
**Suggestion:** Merge the module ownership entry in the canonical spec source and regenerate or update the Markdown projection from that source.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** `src/flow/lib/review-convergence.js` is duplicated in both `spec.json` and `spec.md` module ownership sections. The duplication exists across source and rendered documentation, so fixing only one file can leave inconsistent spec projections.
**Suggestion:** Merge the module ownership entry in the canonical spec source and regenerate or update the Markdown projection from that source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 79. 8. Align review-history count field names
**Finding key:** loop-fbf3c44699f951a170fd
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/impl-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** Review-history JSON files use different names for the same summary concept: `summary` in impl history and `counts` in spec/test history. Consumers must branch by phase even though the data shape is conceptually shared.
**Suggestion:** Standardize on one field name, preferably `counts`, across all review-history JSON artifacts.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** Review-history JSON files use different names for the same summary concept: `summary` in impl history and `counts` in spec/test history. Consumers must branch by phase even though the data shape is conceptually shared.
**Suggestion:** Standardize on one field name, preferably `counts`, across all review-history JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 80. 9. Extract shared spec-local test helpers
**Finding key:** loop-4e2f7c15d6972b322445
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-action-resolution.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R9
**Issue:** Dynamic model import helpers, tooling stage lists, and repeated fixture fragments are duplicated across multiple new spec-local and unit test files. This makes test updates noisy when the review convergence interface changes.
**Suggestion:** Add a small shared helper module or consistently named local helpers for model loading, tooling stages, and common tooling-error fixtures.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R9
**Issue:** Dynamic model import helpers, tooling stage lists, and repeated fixture fragments are duplicated across multiple new spec-local and unit test files. This makes test updates noisy when the review convergence interface changes.
**Suggestion:** Add a small shared helper module or consistently named local helpers for model loading, tooling stages, and common tooling-error fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
