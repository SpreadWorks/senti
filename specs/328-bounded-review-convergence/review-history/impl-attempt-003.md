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

### 6. 1. Deduplicate Requirement File Entries
**Finding key:** loop-c269e26c5262184ca4ef
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/file-map.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/file-map.json`
**Requirement:** R7
**Issue:** `R7` lists `src/flow/lib/get-next-action.js` and `src/flow/lib/get-status.js` twice, which makes ownership mapping noisier and can create redundant downstream processing.
**Suggestion:** Remove the duplicate entries from the `R7` array and keep each file path once.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/file-map.json`
**Requirement:** R7
**Issue:** `R7` lists `src/flow/lib/get-next-action.js` and `src/flow/lib/get-status.js` twice, which makes ownership mapping noisier and can create redundant downstream processing.
**Suggestion:** Remove the duplicate entries from the `R7` array and keep each file path once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Add Bounds To Persisted Flow History
**Finding key:** loop-f1b8f306f0516f38739f
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R6
**Issue:** `metrics` and `stepAttempts` are append-only arrays with no explicit persisted size, count, or compaction bound. This conflicts with the bounded-resource-usage guardrail because repeated review/tooling attempts can grow the flow state without limit.
**Suggestion:** Add an explicit retention/compaction policy to this artifact, such as keeping the latest N metric entries per phase/task plus summarized counters, or persisting a configured maximum attempt/history count that the implementation must enforce.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R6
**Issue:** `metrics` and `stepAttempts` are append-only arrays with no explicit persisted size, count, or compaction bound. This conflicts with the bounded-resource-usage guardrail because repeated review/tooling attempts can grow the flow state without limit.
**Suggestion:** Add an explicit retention/compaction policy to this artifact, such as keeping the latest N metric entries per phase/task plus summarized counters, or persisting a configured maximum attempt/history count that the implementation must enforce.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Remove Stale Runtime Log From Pending Step
**Finding key:** loop-4658176f76a90e411b99
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R8
**Issue:** The `impl-review` step is `pending` in the shown final state but still contains a `runtimeLog` for a completed `flow run review` command. That mixes historical execution details into the current pending step state and makes status projection ambiguous.
**Suggestion:** Either remove `runtimeLog` from pending steps or move historical command records into `stepAttempts`/`metrics` only, keeping the active step object as the current-state projection.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R8
**Issue:** The `impl-review` step is `pending` in the shown final state but still contains a `runtimeLog` for a completed `flow run review` command. That mixes historical execution details into the current pending step state and makes status projection ambiguous.
**Suggestion:** Either remove `runtimeLog` from pending steps or move historical command records into `stepAttempts`/`metrics` only, keeping the active step object as the current-state projection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Populate Requirement Traceability
**Finding key:** loop-dd13dbbcbf22eb471fdd
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** The top-level `"requirements": []` and each task’s `"requirements": []` are empty even though `file-map.json` defines R1-R9 and the review contract requires requirement-level attribution. This makes the flow state less useful for coverage and review convergence.
**Suggestion:** Populate the relevant requirement IDs at the flow/task level, or remove the empty arrays if requirement mapping is intentionally centralized in `file-map.json`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** The top-level `"requirements": []` and each task’s `"requirements": []` are empty even though `file-map.json` defines R1-R9 and the review contract requires requirement-level attribution. This makes the flow state less useful for coverage and review convergence.
**Suggestion:** Populate the relevant requirement IDs at the flow/task level, or remove the empty arrays if requirement mapping is intentionally centralized in `file-map.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Keep one canonical impl review artifact
**Finding key:** loop-5e055948d8eff3cf9e31
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/impl-review.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The diff shows two separate new-file versions for the same path: one `PASS` artifact and one later `ADVISORY` artifact with 64 improvements. This makes the reviewed state ambiguous and leaves reviewers unable to tell which artifact is authoritative.
**Suggestion:** Commit only the final canonical `impl-review.json` state, or move earlier attempts into `review-history` with attempt-specific filenames.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/impl-review.json`
**Requirement:** R9
**Issue:** The diff shows two separate new-file versions for the same path: one `PASS` artifact and one later `ADVISORY` artifact with 64 improvements. This makes the reviewed state ambiguous and leaves reviewers unable to tell which artifact is authoritative.
**Suggestion:** Commit only the final canonical `impl-review.json` state, or move earlier attempts into `review-history` with attempt-specific filenames.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Reduce duplicated gate observation payloads
**Finding key:** loop-bba6e007d16ab73a6667
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R7
**Issue:** The first issue-log entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`. The duplicated text increases artifact size and creates drift risk if one projection changes.
**Suggestion:** Store detailed failure data once, preferably in `observations`, and make `failedEvaluations` lightweight references using `guardrail_id` plus an observation id or index.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R7
**Issue:** The first issue-log entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`. The duplicated text increases artifact size and creates drift risk if one projection changes.
**Suggestion:** Store detailed failure data once, preferably in `observations`, and make `failedEvaluations` lightweight references using `guardrail_id` plus an observation id or index.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Bound issue-log growth
**Finding key:** loop-b2353fee83031742cdfb
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R3
**Issue:** The issue log appends full historical entries, observations, long reasons, and repair descriptions without an explicit retention or size bound. That conflicts with the bounded-resource-usage guardrail for bulk data accumulation.
**Suggestion:** Add an explicit cap for retained entries and per-entry text size, or archive older entries into bounded attempt artifacts while keeping only the latest summary and references in `issue-log.json`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`
**Requirement:** R3
**Issue:** The issue log appends full historical entries, observations, long reasons, and repair descriptions without an explicit retention or size bound. That conflicts with the bounded-resource-usage guardrail for bulk data accumulation.
**Suggestion:** Add an explicit cap for retained entries and per-entry text size, or archive older entries into bounded attempt artifacts while keeping only the latest summary and references in `issue-log.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 7. Add trailing newline to the issue document
**Finding key:** loop-18c8b882d0dc1c56f113
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/issue.md`
**Requirement:** R9
**Issue:** The Markdown file is missing a trailing newline, which creates avoidable formatting churn and is inconsistent with normal text-file conventions.
**Suggestion:** Ensure generated or copied Markdown issue files always end with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue.md`
**Requirement:** R9
**Issue:** The Markdown file is missing a trailing newline, which creates avoidable formatting churn and is inconsistent with normal text-file conventions.
**Suggestion:** Ensure generated or copied Markdown issue files always end with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 6. Remove volatile workflow plugin output from committed artifacts
**Finding key:** loop-faf713e1032c8a1a675d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`
**Requirement:** R9
**Issue:** The file records a transient workflow status mutation, including `changed` and `previousStatus`. This looks like command execution output rather than stable source or review evidence.
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow result must be versioned.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`
**Requirement:** R9
**Issue:** The file records a transient workflow status mutation, including `changed` and `previousStatus`. This looks like command execution output rather than stable source or review evidence.
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow result must be versioned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Normalize empty review-history attempt artifacts
**Finding key:** loop-b66fbca6cb363a332090
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json`
**Requirement:** R9
**Issue:** This no-finding artifact has the same structure as `draft-questions-attempt-001.json`, differing only by phase, source artifact, and timestamp. Persisting full empty attempt records adds mechanical noise.
**Suggestion:** Generate empty PASS review-history artifacts from a shared template, or omit no-op attempt files when the source review artifact already records the empty result.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/draft-coverage-attempt-001.json`
**Requirement:** R9
**Issue:** This no-finding artifact has the same structure as `draft-questions-attempt-001.json`, differing only by phase, source artifact, and timestamp. Persisting full empty attempt records adds mechanical noise.
**Suggestion:** Generate empty PASS review-history artifacts from a shared template, or omit no-op attempt files when the source review artifact already records the empty result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 5. Normalize empty review-history attempt artifacts
**Finding key:** loop-c18d8f793f1ca70e3808
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json`
**Requirement:** R9
**Issue:** This file repeats the same empty PASS schema used by the draft coverage attempt, including empty finding arrays and the same summary text.
**Suggestion:** Use the same template/generation path as other empty draft review attempts, and persist only phase-specific metadata plus references when no findings exist.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/draft-questions-attempt-001.json`
**Requirement:** R9
**Issue:** This file repeats the same empty PASS schema used by the draft coverage attempt, including empty finding arrays and the same summary text.
**Suggestion:** Use the same template/generation path as other empty draft review attempts, and persist only phase-specific metadata plus references when no findings exist.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Use consistent count field names across history JSON files
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

### 18. 1. Avoid duplicating finding records in the JSON history artifact
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

### 19. 3. Add trailing newline to Markdown artifact
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

### 20. 3. Add trailing newline to Markdown artifact
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

### 21. 1. Remove duplicated finding payloads from JSON history artifacts
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

### 22. 2. Remove duplicated finding payloads from later JSON attempts
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

### 23. 3. Remove duplicated finding payloads from single-finding attempt
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

### 24. 4. Normalize duplicated Markdown rendering structure
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

### 25. 5. Add trailing newline
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

### 26. 6. Add trailing newline
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

### 27. 1. Use distinct finding identities
**Finding key:** loop-4dc9fd55f822e575acfb
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` despite describing different missing coverage areas. This can collapse distinct findings during deduplication or tracking.  
**Suggestion:** Generate separate stable identifiers for the stale target tree coverage finding and the completed-review idempotence finding.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` despite describing different missing coverage areas. This can collapse distinct findings during deduplication or tracking.  
**Suggestion:** Generate separate stable identifiers for the stale target tree coverage finding and the completed-review idempotence finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Remove duplicated finding payloads
**Finding key:** loop-662fd796c05cda9d1cf7
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

### 29. 3. Add trailing newline to Markdown artifact
**Finding key:** loop-fc126d9c471f84a57208
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

### 30. 7. Resolve contradictory review artifact content
**Finding key:** loop-f388b106172d73cc55f8
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The diff shows the same new file first containing a large `ADVISORY` review with many proposals, then a second version containing `PASS` with no improvements. That makes the artifact history noisy and obscures which review result is authoritative.  
**Suggestion:** Commit only the final authoritative rendered review content, and ensure the generation path overwrites rather than appends or stages multiple competing render outputs.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The diff shows the same new file first containing a large `ADVISORY` review with many proposals, then a second version containing `PASS` with no improvements. That makes the artifact history noisy and obscures which review result is authoritative.  
**Suggestion:** Commit only the final authoritative rendered review content, and ensure the generation path overwrites rather than appends or stages multiple competing render outputs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Clarify scenario result naming
**Finding key:** loop-4c386543a88ff37708ed
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/scenario-validity-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** `process.exitCode` is `1` and all requirements are classified as `expected_fail`, but the top-level `result` is `"pass"`. The field name conflates scenario-validity success with command execution failure.  
**Suggestion:** Split or rename the field, for example `scenarioResult: "pass"` and `commandResult: "fail"`, or use a clearer value such as `"expected_failures_observed"`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** `process.exitCode` is `1` and all requirements are classified as `expected_fail`, but the top-level `result` is `"pass"`. The field name conflates scenario-validity success with command execution failure.  
**Suggestion:** Split or rename the field, for example `scenarioResult: "pass"` and `commandResult: "fail"`, or use a clearer value such as `"expected_failures_observed"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 5. Deduplicate repeated evidence command strings
**Finding key:** loop-96aa9914dc23269992bd
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/scenario-validity-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** The same long `command` value is repeated at the top level and inside every `summary[*].evidence`, increasing artifact size and drift risk.  
**Suggestion:** Keep the command only once at the top level, and have each evidence entry refer to the top-level command implicitly or by a short `commandRef`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** The same long `command` value is repeated at the top level and inside every `summary[*].evidence`, increasing artifact size and drift risk.  
**Suggestion:** Keep the command only once at the top level, and have each evidence entry refer to the top-level command implicitly or by a short `commandRef`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 6. Deduplicate module ownership entries
**Finding key:** loop-2cf657ce2bf5ba6b81ac
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

### 34. 1. Remove Duplicate Module Ownership Bullet
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

### 35. 2. Remove Empty Placeholder Sections
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

### 36. 3. Avoid Duplicating Full Finding Payloads
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

### 37. 5. Remove Generated Task Markdown From Review-Oriented Diff
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

### 38. 6. Remove Generated Task Markdown From Review-Oriented Diff
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

### 39. 4. Tighten Evidence Coverage Status Naming
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

### 40. 3. Avoid Stale Generated Timestamp In Review Fixture
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

### 41. 2. Deduplicate Review Finding Text Across JSON And Markdown
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

### 42. 1. Remove Committed Raw Failure Log
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

### 43. 1. Extract Shared Test Import Helpers
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

### 44. 2. Extract Repeated Stage List
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

### 45. 3. Remove Unused Fixture Return Fields
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

### 46. 4. Name Tooling Helpers By New Domain Language
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

### 47. 5. Extract Review Verdict Constants
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

### 48. 1. Bound review convergence record processing
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

### 49. 2. Bound canonical evidence file reads
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

### 50. 3. Extract duplicate latest-review-record logic
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

### 51. 4. Reuse handoff source-step derivation
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

### 52. 5. Replace repeated verdict literals with a local constant
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

### 53. 1. Remove Unused Max-Attempts Helper
**Finding key:** loop-928ae2fd1658d17edde6
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R6  
**Issue:** `resolveActiveStepMaxAttempts()` remains in the file but is no longer called after status switched from `reviewStop`/review retry recovery to `reviewAction`.  
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` to remove dead code and avoid implying status still computes review retry budgets locally.
**Suggestion:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R6  
**Issue:** `resolveActiveStepMaxAttempts()` remains in the file but is no longer called after status switched from `reviewStop`/review retry recovery to `reviewAction`.  
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` to remove dead code and avoid implying status still computes review retry budgets locally.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 2. Bound Recursive Canonicalization And Freezing
**Finding key:** loop-4455e77ecca99fb97f3d
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `stableStringify()` and `deepFreeze()` recurse through caller/provider-controlled evidence structures without an explicit depth bound. The byte limit is enforced after canonical text generation, so deeply nested input can still cause excessive recursion before size checks apply.  
**Suggestion:** Add explicit maximum depth constants, pass depth through both recursive functions, and fail with a review evidence validation error when exceeded.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `stableStringify()` and `deepFreeze()` recurse through caller/provider-controlled evidence structures without an explicit depth bound. The byte limit is enforced after canonical text generation, so deeply nested input can still cause excessive recursion before size checks apply.  
**Suggestion:** Add explicit maximum depth constants, pass depth through both recursive functions, and fail with a review evidence validation error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 3. Extract Shared Review Step Resolution
**Finding key:** loop-7f6f59324d36b9901555
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same `scope` and `stepId` resolution logic.  
**Suggestion:** Extract a helper like `reviewDefinitionTarget(phase, taskId)` returning `{ scope, stepId }`, and use it in both functions.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same `scope` and `stepId` resolution logic.  
**Suggestion:** Extract a helper like `reviewDefinitionTarget(phase, taskId)` returning `{ scope, stepId }`, and use it in both functions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 4. Extract Default Tooling Blocker
**Finding key:** loop-b66ab619fae30c3f4d4b
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `resolveReviewPermittedOperation()` constructs the same default `ReviewBlocker` object in two branches.  
**Suggestion:** Add a small helper such as `defaultToolingAttemptsBlocker()` and use it in both `StopAsBlocker` paths.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `resolveReviewPermittedOperation()` constructs the same default `ReviewBlocker` object in two branches.  
**Suggestion:** Add a small helper such as `defaultToolingAttemptsBlocker()` and use it in both `StopAsBlocker` paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 5. Consolidate Repeated Review Result Promotion
**Finding key:** loop-3fa1b2a281632ebf68bd
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** The draft, test, spec, and impl branches all parse a result, call `persistCanonicalReviewResult(...)`, then return the result. This repeats the same promotion pattern in multiple places.  
**Suggestion:** Introduce a helper like `promoteParsedReviewResult(reviewCtx, result, persistedPhase, revision)` and use it for each parser branch.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** The draft, test, spec, and impl branches all parse a result, call `persistCanonicalReviewResult(...)`, then return the result. This repeats the same promotion pattern in multiple places.  
**Suggestion:** Introduce a helper like `promoteParsedReviewResult(reviewCtx, result, persistedPhase, revision)` and use it for each parser branch.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 6. Rename Tooling Failure Compatibility Function
**Finding key:** loop-e39096970ae4379e74f5
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `appendIssueLogFromTestReviewToolingFailure()` now handles `TOOLING_ERROR` via `artifacts.toolingOutcome`, but its name still says `ToolingFailure`, which matches the legacy terminology being removed.  
**Suggestion:** Rename it to `appendIssueLogFromTestReviewToolingError()` and update call sites within the touched change set.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `appendIssueLogFromTestReviewToolingFailure()` now handles `TOOLING_ERROR` via `artifacts.toolingOutcome`, but its name still says `ToolingFailure`, which matches the legacy terminology being removed.  
**Suggestion:** Rename it to `appendIssueLogFromTestReviewToolingError()` and update call sites within the touched change set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 1. Use the actual tree SHA for convergence checks
**Finding key:** loop-19734da84ac37ea864b9
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `unchangedReviewConvergenceTarget()` compares `record.treeSha` against `git rev-parse HEAD`, which returns the commit SHA, not the tree SHA. That makes the unchanged-target guard likely ineffective or incorrectly named.  
**Suggestion:** Resolve the tree object instead, e.g. `runGit(["rev-parse", "HEAD^{tree}"], { cwd: ctx.root })`, or rename the persisted field/check if the intended identity is the commit SHA.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `unchangedReviewConvergenceTarget()` compares `record.treeSha` against `git rev-parse HEAD`, which returns the commit SHA, not the tree SHA. That makes the unchanged-target guard likely ineffective or incorrectly named.  
**Suggestion:** Resolve the tree object instead, e.g. `runGit(["rev-parse", "HEAD^{tree}"], { cwd: ctx.root })`, or rename the persisted field/check if the intended identity is the commit SHA.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 2. Avoid unbounded scan and allocation over convergence records
**Finding key:** loop-10913c1fa1295316325c
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `records.filter(...)` scans every convergence record and allocates a full matching array just to use the last match. If `reviewConvergence.records` grows with retries/reviews, this has no explicit upper bound and violates the bounded-resource-usage guardrail.  
**Suggestion:** Iterate backward and stop at the first matching record, preferably with an explicit inspected-record cap or by storing the latest phase/task convergence record separately when records are written.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `records.filter(...)` scans every convergence record and allocates a full matching array just to use the last match. If `reviewConvergence.records` grows with retries/reviews, this has no explicit upper bound and violates the bounded-resource-usage guardrail.  
**Suggestion:** Iterate backward and stop at the first matching record, preferably with an explicit inspected-record cap or by storing the latest phase/task convergence record separately when records are written.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 3. Extract duplicated current Git identity resolution
**Finding key:** loop-1141ef166d3e0df44af7
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `currentTreeSha()` duplicates the same `runGit(["rev-parse", "HEAD"])`, trim, lowercase, error-wrapping pattern introduced in `src/flow/lib/set-retry.js`, while both paths are part of review evidence/convergence identity handling.  
**Suggestion:** Keep one clearly named helper for resolving the current review target identity and reuse it from both touched command files. While doing so, align the implementation with the persisted identity name, likely `HEAD^{tree}` for `treeSha`.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `currentTreeSha()` duplicates the same `runGit(["rev-parse", "HEAD"])`, trim, lowercase, error-wrapping pattern introduced in `src/flow/lib/set-retry.js`, while both paths are part of review evidence/convergence identity handling.  
**Suggestion:** Keep one clearly named helper for resolving the current review target identity and reuse it from both touched command files. While doing so, align the implementation with the persisted identity name, likely `HEAD^{tree}` for `treeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 4. Preserve coded review errors through mutation
**Finding key:** loop-77b10bbe5453cb1e8b70
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** One shown version removed `passThroughError`, which means registrar errors with review-specific `error.code` values may be wrapped or hidden by `flowManager.mutate()`. That weakens exit-visible failures required for manual evidence registration.  
**Suggestion:** Keep a `passThroughError` predicate for review evidence errors, and consider accepting both `REVIEW_` and explicitly mapped stale-target codes such as `STALE_REVIEW_TARGET` if those can be thrown inside the mutation.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** One shown version removed `passThroughError`, which means registrar errors with review-specific `error.code` values may be wrapped or hidden by `flowManager.mutate()`. That weakens exit-visible failures required for manual evidence registration.  
**Suggestion:** Keep a `passThroughError` predicate for review evidence errors, and consider accepting both `REVIEW_` and explicitly mapped stale-target codes such as `STALE_REVIEW_TARGET` if those can be thrown inside the mutation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 1. Remove legacy override wording
**Finding key:** loop-e1cf645fa50e21b340ee
**Failure mode:** refactor
**File:** src/flow/prompts/plan/test-review.md
**Requirement:** R7
**Issue:** **File:** `src/flow/prompts/plan/test-review.md`  
**Requirement:** R7  
**Issue:** The new TOOLING_ERROR section says “Completion overrides do not substitute for canonical review evidence,” but the later bullet still says TOOLING_ERROR “must be recovered or explicitly overridden.” That keeps the removed completion-override model alive in the prompt.  
**Suggestion:** Replace “recovered or explicitly overridden” with wording aligned to `reviewAction`, e.g. “must be recovered through `retry_review`, registered through `register_alternative_evidence`, handed off through `move_to_acceptance`, or stopped through `stop_as_blocker`.”
**Suggestion:** **File:** `src/flow/prompts/plan/test-review.md`  
**Requirement:** R7  
**Issue:** The new TOOLING_ERROR section says “Completion overrides do not substitute for canonical review evidence,” but the later bullet still says TOOLING_ERROR “must be recovered or explicitly overridden.” That keeps the removed completion-override model alive in the prompt.  
**Suggestion:** Replace “recovered or explicitly overridden” with wording aligned to `reviewAction`, e.g. “must be recovered through `retry_review`, registered through `register_alternative_evidence`, handed off through `move_to_acceptance`, or stopped through `stop_as_blocker`.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 2. Rename legacy test variable
**Finding key:** loop-70a350aebea647190887
**Failure mode:** refactor
**File:** tests/e2e/231-task-e2e-full-lifecycle.test.js
**Requirement:** R9
**Issue:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R9  
**Issue:** `failedReview` still reflects the old `FAIL` verdict terminology even though the assertion now expects `REJECTED`.  
**Suggestion:** Rename `failedReview` to `rejectedReview` or `rejectedReviewResult` to keep the test language consistent with the migrated verdict model.
**Suggestion:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R9  
**Issue:** `failedReview` still reflects the old `FAIL` verdict terminology even though the assertion now expects `REJECTED`.  
**Suggestion:** Rename `failedReview` to `rejectedReview` or `rejectedReviewResult` to keep the test language consistent with the migrated verdict model.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 65. 1. Extract repeated rejected review fixture
**Finding key:** loop-a7f435f1b987cec277ef
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests construct the same `test-review.json` shape with `verdict: "REJECTED"` and a single semantic blocking finding. This keeps the verdict string and artifact structure duplicated across the file.  
**Suggestion:** Add a small helper such as `writeRejectedTestReview(fixture, findingId)` and use it in the repeated cases.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests construct the same `test-review.json` shape with `verdict: "REJECTED"` and a single semantic blocking finding. This keeps the verdict string and artifact structure duplicated across the file.  
**Suggestion:** Add a small helper such as `writeRejectedTestReview(fixture, findingId)` and use it in the repeated cases.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 66. 2. Rename stale `failReview` fixture
**Finding key:** loop-fbceb21a245bc2e6f284
**Failure mode:** refactor
**File:** tests/unit/flow/gate-spec-sanity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict vocabulary changed from `FAIL` to `REJECTED`. That mismatch makes the test intent less clear.  
**Suggestion:** Rename it to `rejectedReview` or `rejectedSpecReview`.
**Suggestion:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict vocabulary changed from `FAIL` to `REJECTED`. That mismatch makes the test intent less clear.  
**Suggestion:** Rename it to `rejectedReview` or `rejectedSpecReview`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 67. 3. Extract repeated tooling outcome fixture
**Finding key:** loop-aba1b039b6aa05424eb5
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same `toolingOutcome` object is duplicated in the parser assertion and the post-hook test input. This increases maintenance cost if the structured tooling outcome contract changes again.  
**Suggestion:** Define a local helper or constant like `parserToolingErrorOutcome` and reuse it in both tests.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same `toolingOutcome` object is duplicated in the parser assertion and the post-hook test input. This increases maintenance cost if the structured tooling outcome contract changes again.  
**Suggestion:** Define a local helper or constant like `parserToolingErrorOutcome` and reuse it in both tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 68. 4. Use a verdict constant for rejected impl review cases
**Finding key:** loop-32279b356dd1e7e9ba5c
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** `"REJECTED"` is repeated across case tables, assertions, test names, and helper logic. Since this file explicitly tests verdict routing, repeated string literals make future vocabulary changes noisy.  
**Suggestion:** Add a local constant such as `const REJECTED = "REJECTED";` near the relevant describe block and use it in the impl/spec review routing tests.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** `"REJECTED"` is repeated across case tables, assertions, test names, and helper logic. Since this file explicitly tests verdict routing, repeated string literals make future vocabulary changes noisy.  
**Suggestion:** Add a local constant such as `const REJECTED = "REJECTED";` near the relevant describe block and use it in the impl/spec review routing tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 69. 1. Standardize Review History Finding Shape
**Finding key:** loop-1b1de7bdd475b6a480dd
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple review-history JSON files store full finding payloads both in grouped arrays such as `blockingFindings`/`advisoryFindings` and in flattened `findings`. This duplicated schema appears across test attempts and creates cross-file drift risk.
**Suggestion:** Define one canonical findings representation for all review-history JSON artifacts. Keep grouped sections as lightweight `findingId` references or derive them from the canonical list.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple review-history JSON files store full finding payloads both in grouped arrays such as `blockingFindings`/`advisoryFindings` and in flattened `findings`. This duplicated schema appears across test attempts and creates cross-file drift risk.
**Suggestion:** Define one canonical findings representation for all review-history JSON artifacts. Keep grouped sections as lightweight `findingId` references or derive them from the canonical list.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 70. 2. Normalize Review History Count Fields
**Finding key:** loop-43e17f6d0e11a239e27c
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/impl-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** `impl-attempt-001.json` uses `summary`, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for equivalent review result totals. Consumers must branch by phase even though these files belong to the same artifact family.
**Suggestion:** Standardize on one field name, preferably `counts`, across all review-history JSON artifacts.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** `impl-attempt-001.json` uses `summary`, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for equivalent review result totals. Consumers must branch by phase even though these files belong to the same artifact family.
**Suggestion:** Standardize on one field name, preferably `counts`, across all review-history JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 71. 3. Consolidate Review Verdict Vocabulary
**Finding key:** loop-58171326182ea8508256
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R7
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** The new verdict vocabulary, especially `"REJECTED"`, is repeated across flow definitions, review command code, prompts, and tests. Some names still use legacy “fail/failure” terminology while values use `REJECTED` or `TOOLING_ERROR`.
**Suggestion:** Introduce shared verdict/tooling outcome constants or local constants at module boundaries, then rename stale helpers and fixtures such as `failReview`, `failedReview`, and `ToolingFailure` names to `rejectedReview` or `ToolingError`.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** The new verdict vocabulary, especially `"REJECTED"`, is repeated across flow definitions, review command code, prompts, and tests. Some names still use legacy “fail/failure” terminology while values use `REJECTED` or `TOOLING_ERROR`.
**Suggestion:** Introduce shared verdict/tooling outcome constants or local constants at module boundaries, then rename stale helpers and fixtures such as `failReview`, `failedReview`, and `ToolingFailure` names to `rejectedReview` or `ToolingError`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 72. 4. Share Review Target Identity Resolution
**Finding key:** loop-4c01b7fc9de8706c9b96
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-retry.js`
**Requirement:** R5
**Issue:** `set-retry.js` and `set-review-evidence.js` both resolve the current Git identity for review evidence/convergence, but duplicate the command/error-handling pattern and appear to compare a persisted `treeSha` against `HEAD` commit SHA.
**Suggestion:** Extract one helper for the current review target identity, use it from both files, and align the implementation with the persisted field name, likely `git rev-parse HEAD^{tree}` for `treeSha`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`
**Requirement:** R5
**Issue:** `set-retry.js` and `set-review-evidence.js` both resolve the current Git identity for review evidence/convergence, but duplicate the command/error-handling pattern and appear to compare a persisted `treeSha` against `HEAD` commit SHA.
**Suggestion:** Extract one helper for the current review target identity, use it from both files, and align the implementation with the persisted field name, likely `git rev-parse HEAD^{tree}` for `treeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 73. 5. Align Handoff Source-Step Derivation
**Finding key:** loop-ea589f9631f7efd15fe7
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** `flow-findings.js` defaults handoff source steps to `"review"`, while `acceptance-review-artifacts.js` derives source steps from phase/task context. The same handoff findings can therefore be summarized differently across files.
**Suggestion:** Use one shared derivation rule, for example `reviewHandoffSourceStep(record, finding)`, in both acceptance artifact generation and deferred finding summaries.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** `flow-findings.js` defaults handoff source steps to `"review"`, while `acceptance-review-artifacts.js` derives source steps from phase/task context. The same handoff findings can therefore be summarized differently across files.
**Suggestion:** Use one shared derivation rule, for example `reviewHandoffSourceStep(record, finding)`, in both acceptance artifact generation and deferred finding summaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 74. 6. Extract Latest Review Record Keying
**Finding key:** loop-46ba2b07f50d906d644b
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** Latest-record selection by `${record.phase}:${record.taskId ?? ""}` is duplicated between `flow-findings.js` and `acceptance-review-artifacts.js`. A future change to key semantics could update one file but not the other.
**Suggestion:** Move the phase/task keying and latest-record lookup into one shared helper within the flow review/convergence module boundary.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** Latest-record selection by `${record.phase}:${record.taskId ?? ""}` is duplicated between `flow-findings.js` and `acceptance-review-artifacts.js`. A future change to key semantics could update one file but not the other.
**Suggestion:** Move the phase/task keying and latest-record lookup into one shared helper within the flow review/convergence module boundary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 75. 7. Use One Generated Artifact Policy For JSON And Markdown Reviews
**Finding key:** loop-5a7c84e499817438009d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/test-review.md
**Requirement:** R2
**Issue:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R2
**Issue:** Several Markdown review artifacts duplicate full content already present in paired JSON artifacts, while other proposals note competing rendered versions of the same review file. This makes source-of-truth unclear across formats.
**Suggestion:** Treat JSON as canonical and Markdown as a generated projection, with generation metadata or an overwrite-only renderer so reviewers do not evaluate both as independent sources.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R2
**Issue:** Several Markdown review artifacts duplicate full content already present in paired JSON artifacts, while other proposals note competing rendered versions of the same review file. This makes source-of-truth unclear across formats.
**Suggestion:** Treat JSON as canonical and Markdown as a generated projection, with generation metadata or an overwrite-only renderer so reviewers do not evaluate both as independent sources.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 76. 8. Deduplicate Requirement Ownership Maps
**Finding key:** loop-67e9bf5efb0277edc42a
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** Requirement/module ownership is duplicated inconsistently across `spec.json`, `spec.md`, and `file-map.json`, including repeated entries for `src/flow/lib/review-convergence.js` and duplicate R7 file paths.
**Suggestion:** Keep ownership data canonical in one structured artifact, then generate Markdown and file-map projections from it with de-duplication by path.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** Requirement/module ownership is duplicated inconsistently across `spec.json`, `spec.md`, and `file-map.json`, including repeated entries for `src/flow/lib/review-convergence.js` and duplicate R7 file paths.
**Suggestion:** Keep ownership data canonical in one structured artifact, then generate Markdown and file-map projections from it with de-duplication by path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 77. 9. Apply Consistent Bounds To Review State And Evidence Processing
**Finding key:** loop-5440c91689f16632ff17
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files introduce append-only or full-scan review data handling: convergence records, handoff findings, issue logs, flow metrics, and canonical evidence reads. The bounded-resource rule is therefore inconsistently enforced across the review pipeline.
**Suggestion:** Define shared maximums for review records, findings, evidence bytes, recursion depth, and retained issue history, then enforce them wherever artifacts are read, written, or summarized.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files introduce append-only or full-scan review data handling: convergence records, handoff findings, issue logs, flow metrics, and canonical evidence reads. The bounded-resource rule is therefore inconsistently enforced across the review pipeline.
**Suggestion:** Define shared maximums for review records, findings, evidence bytes, recursion depth, and retained issue history, then enforce them wherever artifacts are read, written, or summarized.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
