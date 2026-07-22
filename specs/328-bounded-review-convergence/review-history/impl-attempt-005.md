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

### 6. 4. Collapse Empty PASS Review Artifacts
**Finding key:** loop-bf2e7ffd1467b9e8f5f7
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-review-coverage.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`
**Requirement:** R9
**Issue:** This file repeats the same empty PASS artifact structure as `draft-review-questions.json`, differing only by `phase` and `generatedAt`.
**Suggestion:** Generate these empty review artifacts from one canonical template or minimal schema path, so empty PASS reviews do not require duplicated persisted payloads.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`
**Requirement:** R9
**Issue:** This file repeats the same empty PASS artifact structure as `draft-review-questions.json`, differing only by `phase` and `generatedAt`.
**Suggestion:** Generate these empty review artifacts from one canonical template or minimal schema path, so empty PASS reviews do not require duplicated persisted payloads.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 5. Collapse Empty PASS Review Artifacts
**Finding key:** loop-18ce0b7fed6ac40b0f3b
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-review-questions.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-review-questions.json`
**Requirement:** R9
**Issue:** This file duplicates the empty PASS review shape used by the coverage review artifact, including identical empty arrays and summary text.
**Suggestion:** Use the same canonical empty-review artifact template suggested for the coverage artifact, with only the phase-specific fields supplied as data.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-review-questions.json`
**Requirement:** R9
**Issue:** This file duplicates the empty PASS review shape used by the coverage review artifact, including identical empty arrays and summary text.
**Suggestion:** Use the same canonical empty-review artifact template suggested for the coverage artifact, with only the phase-specific fields supplied as data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Bound Persisted Flow History Arrays
**Finding key:** loop-a7fbabe12917c7aa400d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** The `metrics` and `stepAttempts` arrays are persisted as full append-only history with no visible retention, count, or size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading and persisted history growth.
**Suggestion:** Store only bounded recent history in this artifact, or add explicit persisted caps such as `metricsLimit`, `stepAttemptsLimit`, and truncation metadata so readers and writers have a deterministic maximum to process.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** The `metrics` and `stepAttempts` arrays are persisted as full append-only history with no visible retention, count, or size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading and persisted history growth.
**Suggestion:** Store only bounded recent history in this artifact, or add explicit persisted caps such as `metricsLimit`, `stepAttemptsLimit`, and truncation metadata so readers and writers have a deterministic maximum to process.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Remove Stale Runtime Log From Pending Step
**Finding key:** loop-f34e2dd94a5d0822328f
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R7
**Issue:** The `impl-review` step has `"status": "pending"` but still contains a completed `runtimeLog` with `exitCode: 0`. That mixes historical execution data into a pending step state and makes status projection ambiguous.
**Suggestion:** Either remove `runtimeLog` from pending steps or move historical attempts exclusively under `stepAttempts`, keeping each step object as the current-state projection.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R7
**Issue:** The `impl-review` step has `"status": "pending"` but still contains a completed `runtimeLog` with `exitCode: 0`. That mixes historical execution data into a pending step state and makes status projection ambiguous.
**Suggestion:** Either remove `runtimeLog` from pending steps or move historical attempts exclusively under `stepAttempts`, keeping each step object as the current-state projection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Deduplicate Requirement File Entries
**Finding key:** loop-3847abd7d902a782d48b
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/file-map.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/file-map.json`
**Requirement:** R7
**Issue:** Several files are repeated across multiple requirement arrays, and broad ownership lists such as `R7` duplicate many paths already covered by narrower requirements. This makes traceability harder to maintain and increases the chance of stale ownership when implementation files move.
**Suggestion:** Keep each requirement list focused on the files uniquely needed for that requirement, and represent shared cross-cutting files through a single explicit shared bucket or generated traceability mechanism.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/file-map.json`
**Requirement:** R7
**Issue:** Several files are repeated across multiple requirement arrays, and broad ownership lists such as `R7` duplicate many paths already covered by narrower requirements. This makes traceability harder to maintain and increases the chance of stale ownership when implementation files move.
**Suggestion:** Keep each requirement list focused on the files uniquely needed for that requirement, and represent shared cross-cutting files through a single explicit shared bucket or generated traceability mechanism.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Keep one canonical impl review artifact
**Finding key:** loop-717d01e8cfc45502c4b6
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/impl-review.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The diff contains two new-file versions for the same path: an earlier `PASS` artifact and a later `ADVISORY` artifact. That makes the canonical review result ambiguous.
**Suggestion:** Commit only the final authoritative `impl-review.json`. If earlier attempts are needed, store them under attempt-specific review-history paths instead of the canonical artifact path.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The diff contains two new-file versions for the same path: an earlier `PASS` artifact and a later `ADVISORY` artifact. That makes the canonical review result ambiguous.
**Suggestion:** Commit only the final authoritative `impl-review.json`. If earlier attempts are needed, store them under attempt-specific review-history paths instead of the canonical artifact path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Deduplicate issue-log failure details
**Finding key:** loop-d567e7c7c50397c57f31
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R7
**Issue:** The first issue-log entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`, creating drift risk between multiple projections of the same finding.
**Suggestion:** Store detailed failure payloads once, preferably in `observations`; make `reason` a concise summary and make `failedEvaluations` reference observations by guardrail/id.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R7
**Issue:** The first issue-log entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`, creating drift risk between multiple projections of the same finding.
**Suggestion:** Store detailed failure payloads once, preferably in `observations`; make `reason` a concise summary and make `failedEvaluations` reference observations by guardrail/id.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Bound issue-log growth
**Finding key:** loop-36244181b212c1edec9b
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R3
**Issue:** The issue log is append-only and stores full historical reasons, resolutions, observations, and repair notes without an explicit retention or size bound, conflicting with the `bounded-resource-usage` guardrail.
**Suggestion:** Add an explicit retention policy, such as latest N entries plus aggregate counters, or split older detailed entries into bounded attempt artifacts referenced from the current log.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R3
**Issue:** The issue log is append-only and stores full historical reasons, resolutions, observations, and repair notes without an explicit retention or size bound, conflicting with the `bounded-resource-usage` guardrail.
**Suggestion:** Add an explicit retention policy, such as latest N entries plus aggregate counters, or split older detailed entries into bounded attempt artifacts referenced from the current log.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 4. Add trailing newline to issue document
**Finding key:** loop-9aecdf663c176e9c6fd0
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/issue.md`
**Requirement:** R9
**Issue:** The Markdown file ends without a trailing newline, causing avoidable formatting churn and inconsistent text-file output.
**Suggestion:** Ensure the issue Markdown generator or copy path always terminates generated `.md` files with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue.md`
**Requirement:** R9
**Issue:** The Markdown file ends without a trailing newline, causing avoidable formatting churn and inconsistent text-file output.
**Suggestion:** Ensure the issue Markdown generator or copy path always terminates generated `.md` files with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 5. Avoid committing transient workflow mutation output
**Finding key:** loop-c0cf20014d719bac10d8
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`
**Requirement:** R9
**Issue:** The artifact records transient workflow status mutation details such as `changed` and `previousStatus`, which look like command output rather than durable source or review evidence.
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow mutation result must be versioned.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`
**Requirement:** R9
**Issue:** The artifact records transient workflow status mutation details such as `changed` and `previousStatus`, which look like command output rather than durable source or review evidence.
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow mutation result must be versioned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 6. Normalize empty draft review-history artifacts
**Finding key:** loop-0493acd37ba4a0d189af
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json`
**Requirement:** R9
**Issue:** This no-finding PASS artifact has the same structure as `draft-questions-attempt-001.json`, differing only by phase, source artifact, and timestamp.
**Suggestion:** Generate empty PASS review-history artifacts from a shared template, or omit no-op attempt files when the source review artifact already records the empty result.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json`
**Requirement:** R9
**Issue:** This no-finding PASS artifact has the same structure as `draft-questions-attempt-001.json`, differing only by phase, source artifact, and timestamp.
**Suggestion:** Generate empty PASS review-history artifacts from a shared template, or omit no-op attempt files when the source review artifact already records the empty result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 7. Collapse repeated empty draft review shape
**Finding key:** loop-d8c8846fc78a402672e6
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json`
**Requirement:** R9
**Issue:** This file repeats the same empty PASS schema used by the draft coverage attempt, including identical empty finding arrays and summary text.
**Suggestion:** Persist only phase-specific metadata plus a reference when no findings exist, or use the same shared empty-review template as the coverage attempt.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json`
**Requirement:** R9
**Issue:** This file repeats the same empty PASS schema used by the draft coverage attempt, including identical empty finding arrays and summary text.
**Suggestion:** Persist only phase-specific metadata plus a reference when no findings exist, or use the same shared empty-review template as the coverage attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Use consistent count field names across history JSON files
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

### 19. 1. Avoid duplicating finding records in the JSON history artifact
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

### 20. 3. Add trailing newline to Markdown artifact
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

### 21. 3. Add trailing newline to Markdown artifact
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

### 22. 1. Remove duplicated finding payloads from JSON history artifacts
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

### 23. 2. Remove duplicated finding payloads from later JSON attempts
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

### 24. 3. Remove duplicated finding payloads from single-finding attempt
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

### 25. 4. Normalize duplicated Markdown rendering structure
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

### 26. 5. Add trailing newline
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

### 27. 6. Add trailing newline
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

### 28. 1. Use distinct finding identities
**Finding key:** loop-29746368e4221e087b3d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` even though they describe different missing coverage areas. Downstream deduplication could collapse one finding and hide a required test gap.  
**Suggestion:** Generate separate stable identifiers for the stale target tree execution guard finding and the completed-review idempotence finding.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` even though they describe different missing coverage areas. Downstream deduplication could collapse one finding and hide a required test gap.  
**Suggestion:** Generate separate stable identifiers for the stale target tree execution guard finding and the completed-review idempotence finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Remove duplicated finding payloads
**Finding key:** loop-fafdebf8e5f9b251f205
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** The same findings are stored twice: once in `blockingFindings` and again in `findings`, duplicating title, rationale, issue/body, fingerprint, and disposition data.  
**Suggestion:** Keep one canonical findings collection and derive grouped blocking/advisory views when rendering, or make grouped arrays lightweight references by `findingId`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** The same findings are stored twice: once in `blockingFindings` and again in `findings`, duplicating title, rationale, issue/body, fingerprint, and disposition data.  
**Suggestion:** Keep one canonical findings collection and derive grouped blocking/advisory views when rendering, or make grouped arrays lightweight references by `findingId`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Add trailing newline
**Finding key:** loop-65f5ce9b9a57ed7b4bb6
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.md`  
**Requirement:** R9  
**Issue:** The Markdown artifact ends without a trailing newline, creating avoidable formatting churn and inconsistent generated text-file output.  
**Suggestion:** Ensure this file, and the generator that writes review-history Markdown, always terminates output with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.md`  
**Requirement:** R9  
**Issue:** The Markdown artifact ends without a trailing newline, creating avoidable formatting churn and inconsistent generated text-file output.  
**Suggestion:** Ensure this file, and the generator that writes review-history Markdown, always terminates output with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 7. Remove ambiguous duplicate canonical review results
**Finding key:** loop-78a48e19a9123f924600
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The diff shows two new-file versions for the same canonical review artifact: one large `ADVISORY` result and a later `PASS` result. This makes it unclear which review result is authoritative.  
**Suggestion:** Commit only the final canonical `review.md` content. If the earlier review is useful, store it under an attempt-specific review-history path rather than the canonical artifact path.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The diff shows two new-file versions for the same canonical review artifact: one large `ADVISORY` result and a later `PASS` result. This makes it unclear which review result is authoritative.  
**Suggestion:** Commit only the final canonical `review.md` content. If the earlier review is useful, store it under an attempt-specific review-history path rather than the canonical artifact path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Clarify scenario result naming
**Finding key:** loop-53f27a71db06edbd8db3
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/scenario-validity-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** `process.exitCode` is `1` and every requirement is classified as `expected_fail`, but the top-level `result` is `"pass"`. The field name conflates scenario-validity success with command execution failure.  
**Suggestion:** Split this into clearer fields such as `scenarioResult: "pass"` and `commandResult: "fail"`, or use a more explicit value like `"expected_failures_observed"`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** `process.exitCode` is `1` and every requirement is classified as `expected_fail`, but the top-level `result` is `"pass"`. The field name conflates scenario-validity success with command execution failure.  
**Suggestion:** Split this into clearer fields such as `scenarioResult: "pass"` and `commandResult: "fail"`, or use a more explicit value like `"expected_failures_observed"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 5. Deduplicate repeated command strings
**Finding key:** loop-a6730bd4070d752c0910
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/scenario-validity-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** The same long `command` value is repeated at the top level and inside every `summary[*].evidence`, increasing artifact size and drift risk.  
**Suggestion:** Store the command once at the top level and have each evidence entry refer to it implicitly or through a short `commandRef`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** The same long `command` value is repeated at the top level and inside every `summary[*].evidence`, increasing artifact size and drift risk.  
**Suggestion:** Store the command once at the top level and have each evidence entry refer to it implicitly or through a short `commandRef`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 6. Merge duplicate module ownership entries
**Finding key:** loop-fca2cb39b4b38e1c7120
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.json`  
**Requirement:** R1  
**Issue:** `overview.modules` lists `src/flow/lib/review-convergence.js` twice with overlapping ownership descriptions.  
**Suggestion:** Merge the two entries into one complete description, preserving `added_by_task` only if workflow metadata requires it.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.json`  
**Requirement:** R1  
**Issue:** `overview.modules` lists `src/flow/lib/review-convergence.js` twice with overlapping ownership descriptions.  
**Suggestion:** Merge the two entries into one complete description, preserving `added_by_task` only if workflow metadata requires it.
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

### 54. 1. Remove Unused Active Attempt Resolver
**Finding key:** loop-651f92aa19a0a629bc30
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R6
**Issue:** `resolveActiveStepMaxAttempts()` is now dead code after review status stopped building `reviewStop`/review retry recovery views. It still references max-attempt behavior but has no callers in the touched diff.
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` to avoid preserving obsolete review-stop/retry-recovery concepts in status projection.
**Suggestion:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R6
**Issue:** `resolveActiveStepMaxAttempts()` is now dead code after review status stopped building `reviewStop`/review retry recovery views. It still references max-attempt behavior but has no callers in the touched diff.
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` to avoid preserving obsolete review-stop/retry-recovery concepts in status projection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 2. Consolidate Review Step Resolution Naming
**Finding key:** loop-d477b782e25b74c50cf2
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R6
**Issue:** `activeReviewStep(state, flowActive)` returns either a task review step or the flow active step, but the name reads like it always returns a review step. That makes the fallback behavior less obvious.
**Suggestion:** Rename it to something like `resolveStatusReviewStep()` or `resolveActiveReviewCandidate()` and keep the task-review lookup inside it.
**Suggestion:** **File:** `src/flow/lib/get-status.js`
**Requirement:** R6
**Issue:** `activeReviewStep(state, flowActive)` returns either a task review step or the flow active step, but the name reads like it always returns a review step. That makes the fallback behavior less obvious.
**Suggestion:** Rename it to something like `resolveStatusReviewStep()` or `resolveActiveReviewCandidate()` and keep the task-review lookup inside it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 3. Extract Repeated Review Target Step Resolution
**Finding key:** loop-f83d8dff7e8a48419453
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same phase/taskId to `{ scope, stepId }` resolution logic.
**Suggestion:** Add a helper such as `reviewDefinitionTarget(phase, taskId)` returning `{ scope, stepId }`, and have both functions use it. This keeps review phase mapping consistent in one place.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same phase/taskId to `{ scope, stepId }` resolution logic.
**Suggestion:** Add a helper such as `reviewDefinitionTarget(phase, taskId)` returning `{ scope, stepId }`, and have both functions use it. This keeps review phase mapping consistent in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 4. Extract Repeated Exhausted Tooling Blocker Construction
**Finding key:** loop-084f471870b4d2ac7bdf
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R6
**Issue:** `resolveReviewPermittedOperation()` constructs the same default `ReviewBlocker` for exhausted tooling attempts in two branches.
**Suggestion:** Add `defaultToolingAttemptsExhaustedBlocker()` and reuse it in both `StopAsBlocker` paths.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R6
**Issue:** `resolveReviewPermittedOperation()` constructs the same default `ReviewBlocker` for exhausted tooling attempts in two branches.
**Suggestion:** Add `defaultToolingAttemptsExhaustedBlocker()` and reuse it in both `StopAsBlocker` paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 5. Remove Redundant Revision Helper
**Finding key:** loop-ab45bf0b53ad3cacf11c
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R5
**Issue:** `sameRevision(left, right)` only performs strict equality and has a single call site, so it hides no meaningful behavior.
**Suggestion:** Inline `flowState !== expectedRevision` in `ReviewEvidenceRegistrar.register()` or rename the helper only if future CAS semantics are actually added here.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`
**Requirement:** R5
**Issue:** `sameRevision(left, right)` only performs strict equality and has a single call site, so it hides no meaningful behavior.
**Suggestion:** Inline `flowState !== expectedRevision` in `ReviewEvidenceRegistrar.register()` or rename the helper only if future CAS semantics are actually added here.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 6. Deduplicate Review Verdict Literals
**Finding key:** loop-58015c3d866e69c01c99
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated directly in validation logic and messages, which makes future review verdict changes more error-prone.
**Suggestion:** Introduce a local constant such as `const REVIEW_VERDICTS = ["PASS", "ADVISORY", "REJECTED"];` and use it for the inclusion check and error message construction.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated directly in validation logic and messages, which makes future review verdict changes more error-prone.
**Suggestion:** Introduce a local constant such as `const REVIEW_VERDICTS = ["PASS", "ADVISORY", "REJECTED"];` and use it for the inclusion check and error message construction.
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

### 69. 4. Rename `failedReview` Local Variable
**Finding key:** loop-132ca145868eb47e9f09
**Failure mode:** refactor
**File:** tests/e2e/231-task-e2e-full-lifecycle.test.js
**Requirement:** R9
**Issue:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R9  
**Issue:** The local variable `failedReview` still reflects the old `FAIL` naming while asserting `REJECTED`.  
**Suggestion:** Rename it to `rejectedReview` so the test name, variable name, and expected verdict use consistent terminology.
**Suggestion:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R9  
**Issue:** The local variable `failedReview` still reflects the old `FAIL` naming while asserting `REJECTED`.  
**Suggestion:** Rename it to `rejectedReview` so the test name, variable name, and expected verdict use consistent terminology.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 70. 1. Extract Shared Rejected Verdict Fixtures
**Finding key:** loop-7421295ba14119fe9f9b
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat the same review artifact shape with `verdict: "REJECTED"` and a single semantic blocking finding. This makes the test file noisy and raises the chance of inconsistent fixture updates.  
**Suggestion:** Add a small helper such as `writeRejectedTestReview(fixture, findings = [semanticFinding("test-semantic")])` and use it for the repeated `writeJson(..., "test-review.json", { verdict: "REJECTED", blockingFindings: ... })` setup.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat the same review artifact shape with `verdict: "REJECTED"` and a single semantic blocking finding. This makes the test file noisy and raises the chance of inconsistent fixture updates.  
**Suggestion:** Add a small helper such as `writeRejectedTestReview(fixture, findings = [semanticFinding("test-semantic")])` and use it for the repeated `writeJson(..., "test-review.json", { verdict: "REJECTED", blockingFindings: ... })` setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 71. 2. Rename Stale `failReview` Fixture
**Finding key:** loop-8af919c253a96f1e7140
**Failure mode:** refactor
**File:** tests/unit/flow/gate-spec-sanity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict terminology changed from `FAIL` to `REJECTED`. The stale name weakens readability and can obscure whether the test is checking legacy or current behavior.  
**Suggestion:** Rename `failReview` to `rejectedReview` and update its uses in this file.
**Suggestion:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict terminology changed from `FAIL` to `REJECTED`. The stale name weakens readability and can obscure whether the test is checking legacy or current behavior.  
**Suggestion:** Rename `failReview` to `rejectedReview` and update its uses in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 72. 3. Avoid Duplicated Tooling Outcome Object
**Finding key:** loop-8c96b3d89d73e829fbe3
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same structured `toolingOutcome` object is repeated in multiple assertions/setup blocks. Because it includes several fields, future contract changes will require duplicated edits.  
**Suggestion:** Extract a local helper or constant, for example `const parserToolingErrorOutcome = Object.freeze({ ... })`, and reuse it in the parse assertion and post-hook artifact setup.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same structured `toolingOutcome` object is repeated in multiple assertions/setup blocks. Because it includes several fields, future contract changes will require duplicated edits.  
**Suggestion:** Extract a local helper or constant, for example `const parserToolingErrorOutcome = Object.freeze({ ... })`, and reuse it in the parse assertion and post-hook artifact setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 73. 1. Standardize canonical review finding storage
**Finding key:** loop-d77f620d359226e13d0a
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple review artifacts duplicate full finding payloads across grouped arrays (`blockingFindings` / `advisoryFindings`) and flat arrays (`findings`), and similar duplication appears in gate-source observations and issue-log projections. This creates cross-file drift risk in the review artifact contract.
**Suggestion:** Define one canonical finding/observation collection for generated review artifacts. Grouped views should be derived at render time or store only lightweight references such as `findingId` / `fingerprint`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple review artifacts duplicate full finding payloads across grouped arrays (`blockingFindings` / `advisoryFindings`) and flat arrays (`findings`), and similar duplication appears in gate-source observations and issue-log projections. This creates cross-file drift risk in the review artifact contract.
**Suggestion:** Define one canonical finding/observation collection for generated review artifacts. Grouped views should be derived at render time or store only lightweight references such as `findingId` / `fingerprint`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 74. 2. Unify review-history count field names
**Finding key:** loop-746c68c1a6cda06d60b1
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/impl-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** `impl-attempt-001.json` uses `summary` for review counts, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. Consumers must branch by phase even though the artifact shape should be phase-neutral.
**Suggestion:** Standardize all review-history JSON artifacts on one field name, preferably `counts`, and update generators/consumers together.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** `impl-attempt-001.json` uses `summary` for review counts, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. Consumers must branch by phase even though the artifact shape should be phase-neutral.
**Suggestion:** Standardize all review-history JSON artifacts on one field name, preferably `counts`, and update generators/consumers together.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 75. 3. Normalize review verdict terminology
**Finding key:** loop-2060797c92dbd73c4e24
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R7
**Issue:** Several files still mix old “failure/fail” naming with the new `REJECTED` / `TOOLING_ERROR` model, including helper names in `run-review.js`, `review.js`, and stale test variables such as `failReview` / `failedReview`.
**Suggestion:** Rename helpers and fixtures consistently around current domain terms: `rejectedReview`, `toolingErrorResult`, `buildToolingErrorReview`, and `persistCanonicalToolingError`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R7
**Issue:** Several files still mix old “failure/fail” naming with the new `REJECTED` / `TOOLING_ERROR` model, including helper names in `run-review.js`, `review.js`, and stale test variables such as `failReview` / `failedReview`.
**Suggestion:** Rename helpers and fixtures consistently around current domain terms: `rejectedReview`, `toolingErrorResult`, `buildToolingErrorReview`, and `persistCanonicalToolingError`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 76. 4. Centralize review verdict constants
**Finding key:** loop-578a0f20a6eb2006d9ef
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R7
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** Review verdict literals such as `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated across lifecycle definition, gate validation, judgment contract code, and tests. This makes future contract changes prone to partial updates.
**Suggestion:** Introduce a shared or local canonical verdict constant/predicate set within the flow review boundary, then reuse it for validation, messages, and branching.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** Review verdict literals such as `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated across lifecycle definition, gate validation, judgment contract code, and tests. This makes future contract changes prone to partial updates.
**Suggestion:** Introduce a shared or local canonical verdict constant/predicate set within the flow review boundary, then reuse it for validation, messages, and branching.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 77. 5. Share review target resolution logic
**Finding key:** loop-a2a70dc958046c4f242e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** Phase/task-to-step resolution is duplicated inside `semanticMaxAttempts()` and `toolingMaxAttempts()`, while related handoff source-step derivation differs between `acceptance-review-artifacts.js` and `flow-findings.js`.
**Suggestion:** Extract shared helpers such as `reviewDefinitionTarget(phase, taskId)` and `reviewHandoffSourceStep(record, finding)` so convergence, acceptance artifacts, and summaries compute the same identities.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** Phase/task-to-step resolution is duplicated inside `semanticMaxAttempts()` and `toolingMaxAttempts()`, while related handoff source-step derivation differs between `acceptance-review-artifacts.js` and `flow-findings.js`.
**Suggestion:** Extract shared helpers such as `reviewDefinitionTarget(phase, taskId)` and `reviewHandoffSourceStep(record, finding)` so convergence, acceptance artifacts, and summaries compute the same identities.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 78. 6. Add bounded processing rules for review artifacts
**Finding key:** loop-61bc93f24ffb3d34de0a
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files introduce unbounded reads or scans of review artifacts/history: canonical evidence file reads, convergence record scans, handoff finding processing, canonical review parsing, and retry target filtering.
**Suggestion:** Define explicit byte/count caps for review artifact loading and convergence history processing, and reuse bounded iteration patterns across `acceptance-review-artifacts.js`, `run-review.js`, `flow-findings.js`, and `set-retry.js`.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files introduce unbounded reads or scans of review artifacts/history: canonical evidence file reads, convergence record scans, handoff finding processing, canonical review parsing, and retry target filtering.
**Suggestion:** Define explicit byte/count caps for review artifact loading and convergence history processing, and reuse bounded iteration patterns across `acceptance-review-artifacts.js`, `run-review.js`, `flow-findings.js`, and `set-retry.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 79. 7. Consolidate generated empty review artifact templates
**Finding key:** loop-62408812ae0f1b753c07
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-review-coverage.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`
**Requirement:** R9
**Issue:** Empty PASS/no-op review artifacts are repeated across draft review files and review-history files with only phase/source/timestamp differences. This creates noisy diffs and inconsistent generated outputs.
**Suggestion:** Generate empty review and triage/repair artifacts from a shared template, or persist only phase-specific metadata plus a reference when there are no findings.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-review-coverage.json`
**Requirement:** R9
**Issue:** Empty PASS/no-op review artifacts are repeated across draft review files and review-history files with only phase/source/timestamp differences. This creates noisy diffs and inconsistent generated outputs.
**Suggestion:** Generate empty review and triage/repair artifacts from a shared template, or persist only phase-specific metadata plus a reference when there are no findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 80. 8. Make canonical review artifact ownership unambiguous
**Finding key:** loop-2fa2f7a020daa9b92e7a
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/impl-review.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The summaries report duplicate canonical review artifacts for the same paths, including multiple versions of `impl-review.json` and `review.md`. That makes it unclear which review result is authoritative.
**Suggestion:** Commit only the final canonical artifact for each review path. Store earlier attempts exclusively under attempt-specific `review-history/` paths.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The summaries report duplicate canonical review artifacts for the same paths, including multiple versions of `impl-review.json` and `review.md`. That makes it unclear which review result is authoritative.
**Suggestion:** Commit only the final canonical artifact for each review path. Store earlier attempts exclusively under attempt-specific `review-history/` paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 81. 9. Keep JSON canonical and Markdown generated
**Finding key:** loop-81ca2dfe2435e1419218
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/test-review.md
**Requirement:** R2
**Issue:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R2
**Issue:** Markdown review artifacts repeat the same findings already present in paired JSON artifacts, and several generated Markdown files have inconsistent trailing-newline behavior. This creates cross-format drift and formatting churn.
**Suggestion:** Treat JSON as canonical and Markdown as a generated projection with a generated marker/metadata. Ensure the Markdown renderer always emits a trailing newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R2
**Issue:** Markdown review artifacts repeat the same findings already present in paired JSON artifacts, and several generated Markdown files have inconsistent trailing-newline behavior. This creates cross-format drift and formatting churn.
**Suggestion:** Treat JSON as canonical and Markdown as a generated projection with a generated marker/metadata. Ensure the Markdown renderer always emits a trailing newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 82. 10. Deduplicate spec module ownership
**Finding key:** loop-481998f4e47dc02b3b13
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** `src/flow/lib/review-convergence.js` is duplicated in both `spec.json` and rendered `spec.md` module ownership sections with overlapping descriptions.
**Suggestion:** Merge the module ownership entry in the canonical spec source, then regenerate the Markdown projection from that single entry.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** `src/flow/lib/review-convergence.js` is duplicated in both `spec.json` and rendered `spec.md` module ownership sections with overlapping descriptions.
**Suggestion:** Merge the module ownership entry in the canonical spec source, then regenerate the Markdown projection from that single entry.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
