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

### 6. 1. Remove stale runtime log from pending step
**Finding key:** loop-499075d76cab32fdd67b
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** `impl-review` is `pending` but still carries a `runtimeLog` from an already completed `flow run review` command. That mixes current state with stale execution evidence and makes the artifact harder to reason about.
**Suggestion:** Drop `runtimeLog` from pending steps, or only persist runtime logs on steps whose status reflects that execution result.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** `impl-review` is `pending` but still carries a `runtimeLog` from an already completed `flow run review` command. That mixes current state with stale execution evidence and makes the artifact harder to reason about.
**Suggestion:** Drop `runtimeLog` from pending steps, or only persist runtime logs on steps whose status reflects that execution result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Deduplicate repeated task skeletons
**Finding key:** loop-617380f0260be26b62d0
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** Tasks `T-2` through `T-6` repeat the same pending `task-impl`, `task-review`, and `task-gate` step payloads verbatim.
**Suggestion:** If this artifact is intended to stay compact and reviewable, store a shared task-step template or generate pending task steps from the flow definition instead of materializing identical JSON blocks.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** Tasks `T-2` through `T-6` repeat the same pending `task-impl`, `task-review`, and `task-gate` step payloads verbatim.
**Suggestion:** If this artifact is intended to stay compact and reviewable, store a shared task-step template or generate pending task steps from the flow definition instead of materializing identical JSON blocks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Bound persisted metric history
**Finding key:** loop-6f113b5e0a90a6b1329c
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** The `metrics` array persists every read, issue-log, retry, and agent event inline. The diff already shows repeated `issueLog`, `srcRead`, and retry entries, and there is no visible cap on count or size.
**Suggestion:** Apply an explicit retention bound for persisted metrics, such as latest N entries per phase/task plus aggregate counters, to satisfy bounded-resource-usage and keep flow state from growing without limit.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`
**Requirement:** R9
**Issue:** The `metrics` array persists every read, issue-log, retry, and agent event inline. The diff already shows repeated `issueLog`, `srcRead`, and retry entries, and there is no visible cap on count or size.
**Suggestion:** Apply an explicit retention bound for persisted metrics, such as latest N entries per phase/task plus aggregate counters, to satisfy bounded-resource-usage and keep flow state from growing without limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Deduplicate requirement file mappings
**Finding key:** loop-6530586af2b13f1d76cd
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/file-map.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/file-map.json`
**Requirement:** R7
**Issue:** `R7` repeats paths already listed under other requirements, and within the shown diff `src/flow/lib/get-next-action.js` and `src/flow/lib/get-status.js` appear in multiple requirement arrays. This makes ownership noisy and easier to drift.
**Suggestion:** Keep requirement-specific mappings only where a file materially implements that requirement, or introduce a generated/shared ownership grouping if the same broad file set is expected across many requirements.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/file-map.json`
**Requirement:** R7
**Issue:** `R7` repeats paths already listed under other requirements, and within the shown diff `src/flow/lib/get-next-action.js` and `src/flow/lib/get-status.js` appear in multiple requirement arrays. This makes ownership noisy and easier to drift.
**Suggestion:** Keep requirement-specific mappings only where a file materially implements that requirement, or introduce a generated/shared ownership grouping if the same broad file set is expected across many requirements.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Keep One Canonical Impl Review Artifact
**Finding key:** loop-3dfc54ae203c0a3a7256
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/impl-review.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/impl-review.json`  
**Requirement:** R9  
**Issue:** The diff shows two different new-file versions for the same canonical artifact: one `ADVISORY` result with 82 improvements and one earlier `PASS` result. That makes the authoritative review outcome ambiguous.  
**Suggestion:** Commit only the final canonical `impl-review.json`. If earlier attempts are useful, store them under an attempt-specific `review-history/` path instead of the canonical artifact path.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/impl-review.json`  
**Requirement:** R9  
**Issue:** The diff shows two different new-file versions for the same canonical artifact: one `ADVISORY` result with 82 improvements and one earlier `PASS` result. That makes the authoritative review outcome ambiguous.  
**Suggestion:** Commit only the final canonical `impl-review.json`. If earlier attempts are useful, store them under an attempt-specific `review-history/` path instead of the canonical artifact path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Deduplicate Issue Failure Details
**Finding key:** loop-d8448aa075f56c8ff0fb
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`  
**Requirement:** R7  
**Issue:** The first entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`, creating drift risk between multiple representations of the same findings.  
**Suggestion:** Store detailed failure payloads once, preferably in `observations`; keep `reason` as a concise summary and make `failedEvaluations` reference observations by guardrail/id.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`  
**Requirement:** R7  
**Issue:** The first entry repeats the same guardrail failures in `reason`, `observations`, and `failedEvaluations`, creating drift risk between multiple representations of the same findings.  
**Suggestion:** Store detailed failure payloads once, preferably in `observations`; keep `reason` as a concise summary and make `failedEvaluations` reference observations by guardrail/id.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Bound Issue Log Growth
**Finding key:** loop-95caf349af0542975ddf
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/328-bounded-review-convergence/issue-log.json`  
**Requirement:** R3  
**Issue:** `entries` is an append-only history with full reasons, resolutions, observations, and repair notes but no explicit retention or size bound. This conflicts with the `bounded-resource-usage` guardrail for bulk persisted history.  
**Suggestion:** Add a retention policy such as latest N entries plus aggregate counters, or split older detailed entries into bounded attempt artifacts referenced from the current log.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue-log.json`  
**Requirement:** R3  
**Issue:** `entries` is an append-only history with full reasons, resolutions, observations, and repair notes but no explicit retention or size bound. This conflicts with the `bounded-resource-usage` guardrail for bulk persisted history.  
**Suggestion:** Add a retention policy such as latest N entries plus aggregate counters, or split older detailed entries into bounded attempt artifacts referenced from the current log.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Add Trailing Newline
**Finding key:** loop-d4f7e0d27fcf03fb5bea
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/issue.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/issue.md`  
**Requirement:** R9  
**Issue:** The Markdown file ends without a trailing newline, which creates avoidable formatting churn and inconsistent text-file output.  
**Suggestion:** Ensure the Markdown generator or copy path always terminates generated `.md` files with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/issue.md`  
**Requirement:** R9  
**Issue:** The Markdown file ends without a trailing newline, which creates avoidable formatting churn and inconsistent text-file output.  
**Suggestion:** Ensure the Markdown generator or copy path always terminates generated `.md` files with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 5. Avoid Committing Transient Workflow Mutation Output
**Finding key:** loop-e0530999474f01cc623d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R9  
**Issue:** The file records transient workflow mutation state such as `changed` and `previousStatus`, which looks like command output rather than durable source or review evidence.  
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow mutation result must be versioned.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R9  
**Issue:** The file records transient workflow mutation state such as `changed` and `previousStatus`, which looks like command output rather than durable source or review evidence.  
**Suggestion:** Keep this under ignored runtime artifacts, or add deterministic evidence metadata explaining why this workflow mutation result must be versioned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 6. Collapse Empty Draft Review History Templates
**Finding key:** loop-0cfa4b4ad2168de0f96f
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

### 16. 7. Collapse Repeated Empty Draft Review Shape
**Finding key:** loop-d4351aff31447222d168
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
**Finding key:** loop-29d9d5fd1bc0fa00becc
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`
**Requirement:** R9
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` even though they describe different missing coverage areas. Downstream deduplication could collapse one finding and hide one required test gap.
**Suggestion:** Generate separate stable identifiers for the stale target tree execution guard finding and the completed-review idempotence finding.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`
**Requirement:** R9
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and flattened `id` even though they describe different missing coverage areas. Downstream deduplication could collapse one finding and hide one required test gap.
**Suggestion:** Generate separate stable identifiers for the stale target tree execution guard finding and the completed-review idempotence finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Remove duplicated finding payloads
**Finding key:** loop-c38fe1db590d9c6ceb35
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

### 29. 3. Add trailing newline
**Finding key:** loop-08edf6a35b5b05c0b7a1
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

### 30. 4. Remove ambiguous duplicate canonical review results
**Finding key:** loop-d445f7e6c02d320486ec
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review.md`
**Requirement:** R9
**Issue:** The diff shows two new-file versions for the same canonical review artifact: one large `ADVISORY` result and a later `PASS` result. This makes it unclear which review result is authoritative.
**Suggestion:** Commit only the final canonical `review.md` content. If the earlier review is useful, store it under an attempt-specific review-history path.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review.md`
**Requirement:** R9
**Issue:** The diff shows two new-file versions for the same canonical review artifact: one large `ADVISORY` result and a later `PASS` result. This makes it unclear which review result is authoritative.
**Suggestion:** Commit only the final canonical `review.md` content. If the earlier review is useful, store it under an attempt-specific review-history path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 5. Clarify scenario result naming
**Finding key:** loop-6b148e64f438b630ae8c
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

### 32. 6. Deduplicate repeated command strings
**Finding key:** loop-afce0fbb7007eadda57d
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

### 33. 7. Merge duplicate module ownership entries
**Finding key:** loop-99957d2d22757e758dff
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

### 43. 6. Reuse Attempt State Fixture Setup
**Finding key:** loop-b375bbf2c1f1ba3c1eff
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-action-resolution.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat temp directory cleanup, flow manager creation, and `impl-review` flow setup.  
**Suggestion:** Add a local `createReviewFlowFixture(t, { runId })` helper returning `{ tmp, manager }`, then use it in the persistence and public projection tests.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat temp directory cleanup, flow manager creation, and `impl-review` flow setup.  
**Suggestion:** Add a local `createReviewFlowFixture(t, { runId })` helper returning `{ tmp, manager }`, then use it in the persistence and public projection tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 1. Extract Review Tooling Outcome Construction
**Finding key:** loop-db858989d8bf2f0e9d91
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** Tooling outcome construction repeats stage mapping and permission detection in `toolingFailureResult()` and `buildToolingFailureReview()`, with similar logging stage derivation later in `runTestReview()`.  
**Suggestion:** Add small helpers such as `isPermissionRelated(message)`, `stageFromImplFailureKind(kind)`, and `stageFromTestReviewKind(kind)`, then use them everywhere a `ReviewToolingOutcome` or tooling log line is built.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** Tooling outcome construction repeats stage mapping and permission detection in `toolingFailureResult()` and `buildToolingFailureReview()`, with similar logging stage derivation later in `runTestReview()`.  
**Suggestion:** Add small helpers such as `isPermissionRelated(message)`, `stageFromImplFailureKind(kind)`, and `stageFromTestReviewKind(kind)`, then use them everywhere a `ReviewToolingOutcome` or tooling log line is built.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Centralize Review Verdict Literals
**Finding key:** loop-04347238314d8dc59aa4
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R7
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R7  
**Issue:** `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated across lifecycle branches, including an inline array in `resolveDraftReviewLifecycle()`. This makes future migration cleanup easy to miss.  
**Suggestion:** Introduce local constants like `PASS_VERDICT`, `ADVISORY_VERDICT`, `REJECTED_VERDICT`, and `REVIEW_DISPOSITION_VERDICTS`, then use them throughout this file.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R7  
**Issue:** `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated across lifecycle branches, including an inline array in `resolveDraftReviewLifecycle()`. This makes future migration cleanup easy to miss.  
**Suggestion:** Introduce local constants like `PASS_VERDICT`, `ADVISORY_VERDICT`, `REJECTED_VERDICT`, and `REVIEW_DISPOSITION_VERDICTS`, then use them throughout this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Avoid Unbounded Recursive Snapshot Reads
**Finding key:** loop-ab403c0b1ae9114ced37
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-execution-regression.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-execution-regression.test.js`  
**Requirement:** R9  
**Issue:** `directorySnapshot()` uses `fs.readdirSync(dir, { recursive: true })` and reads every file under the directory without an explicit entry or byte bound. This violates the bounded-resource-usage guardrail even in tests.  
**Suggestion:** Add explicit caps, for example `maxEntries` and `maxBytesPerFile`, and fail the test if the snapshot exceeds those limits.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-execution-regression.test.js`  
**Requirement:** R9  
**Issue:** `directorySnapshot()` uses `fs.readdirSync(dir, { recursive: true })` and reads every file under the directory without an explicit entry or byte bound. This violates the bounded-resource-usage guardrail even in tests.  
**Suggestion:** Add explicit caps, for example `maxEntries` and `maxBytesPerFile`, and fail the test if the snapshot exceeds those limits.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Extract Repeated Pipeline Fixture Setup
**Finding key:** loop-333d3d90e495cc65b42e
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-execution-regression.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-execution-regression.test.js`  
**Requirement:** R9  
**Issue:** Several tests repeat the same temp directory, flow manager, `moveFlowToStep(makeFlowState(...), "impl-review")`, and pipeline construction pattern.  
**Suggestion:** Add a helper like `createPipelineFixture(t, { runId, boundaries })` returning `{ tmp, manager, pipeline }`, and reuse it in the tooling failure, stale tree, completed-once, and telemetry tests.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-execution-regression.test.js`  
**Requirement:** R9  
**Issue:** Several tests repeat the same temp directory, flow manager, `moveFlowToStep(makeFlowState(...), "impl-review")`, and pipeline construction pattern.  
**Suggestion:** Add a helper like `createPipelineFixture(t, { runId, boundaries })` returning `{ tmp, manager, pipeline }`, and reuse it in the tooling failure, stale tree, completed-once, and telemetry tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Extract CLI Fixture State Completion Helper
**Finding key:** loop-dda91fc464d0a6ec3706
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js`  
**Requirement:** R9  
**Issue:** `createCliFixture()` manually marks every task and step as done with nested loops. That setup detail is noisy and distracts from the fixture’s purpose.  
**Suggestion:** Extract `markAllTasksDone(state)` or `createCompletedReviewState(...)` inside this file and call it from `createCliFixture()`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-evidence-registration.test.js`  
**Requirement:** R9  
**Issue:** `createCliFixture()` manually marks every task and step as done with nested loops. That setup detail is noisy and distracts from the fixture’s purpose.  
**Suggestion:** Extract `markAllTasksDone(state)` or `createCompletedReviewState(...)` inside this file and call it from `createCliFixture()`.
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

### 54. 1. Remove dead max-attempt resolver
**Finding key:** loop-1e18c32627ad78d755a1
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R6  
**Issue:** `resolveActiveStepMaxAttempts()` is no longer used after review recovery switched from `reviewStop`/`retryRecovery` to `reviewAction`. Keeping it also preserves an import dependency on `resolveMaxAttempts` that appears unnecessary in this file.  
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` and remove the unused `resolveMaxAttempts` import if no other local usage remains.
**Suggestion:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R6  
**Issue:** `resolveActiveStepMaxAttempts()` is no longer used after review recovery switched from `reviewStop`/`retryRecovery` to `reviewAction`. Keeping it also preserves an import dependency on `resolveMaxAttempts` that appears unnecessary in this file.  
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` and remove the unused `resolveMaxAttempts` import if no other local usage remains.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 2. Extract review target step resolution
**Finding key:** loop-c3064133f080c6cacda9
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same scope/stepId resolution logic for phase/task review targets. This makes future phase routing changes easy to apply inconsistently.  
**Suggestion:** Extract a helper such as `reviewStepTargetFor(phase, taskId)` returning `{ scope, stepId }`, then reuse it from both functions.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `semanticMaxAttempts()` and `toolingMaxAttempts()` duplicate the same scope/stepId resolution logic for phase/task review targets. This makes future phase routing changes easy to apply inconsistently.  
**Suggestion:** Extract a helper such as `reviewStepTargetFor(phase, taskId)` returning `{ scope, stepId }`, then reuse it from both functions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 3. Bound recursive canonicalization depth
**Finding key:** loop-823a51c0c87d9afd938f
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `stableStringify()` and `deepFreeze()` recurse through caller-provided evidence structures without an explicit depth bound. The byte and finding-count limits help total size, but a deeply nested JSON object under 1 MB can still cause excessive recursion or stack overflow. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit maximum depth parameter to recursive helpers, for example `MAX_REVIEW_EVIDENCE_DEPTH`, and throw a validation error when exceeded.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `stableStringify()` and `deepFreeze()` recurse through caller-provided evidence structures without an explicit depth bound. The byte and finding-count limits help total size, but a deeply nested JSON object under 1 MB can still cause excessive recursion or stack overflow. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit maximum depth parameter to recursive helpers, for example `MAX_REVIEW_EVIDENCE_DEPTH`, and throw a validation error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 4. Bound convergence record scans
**Finding key:** loop-116b6b821c6c7fae03c9
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `resolveReviewActionForFlowState()` filters all convergence records and then selects the last match. `convergenceRecords()` accepts the persisted array without an explicit maximum, so status/next-action projection can do unbounded bulk processing.  
**Suggestion:** Introduce a maximum convergence-record count or store records in a bounded per-target form. If the array is retained, validate/truncate/reject above a named limit before scanning.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `resolveReviewActionForFlowState()` filters all convergence records and then selects the last match. `convergenceRecords()` accepts the persisted array without an explicit maximum, so status/next-action projection can do unbounded bulk processing.  
**Suggestion:** Introduce a maximum convergence-record count or store records in a bounded per-target form. If the array is retained, validate/truncate/reject above a named limit before scanning.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 5. Replace sameRevision wrapper
**Finding key:** loop-5c5b69c6b19ec41bc810
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R5  
**Issue:** `sameRevision(left, right)` only returns `left === right`, adding a named abstraction without encoding domain behavior. It makes the CAS check look more meaningful than it currently is.  
**Suggestion:** Inline the identity comparison or replace it with a domain-specific check that actually compares a revision/digest value if one exists in the flow-state model.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R5  
**Issue:** `sameRevision(left, right)` only returns `left === right`, adding a named abstraction without encoding domain behavior. It makes the CAS check look more meaningful than it currently is.  
**Suggestion:** Inline the identity comparison or replace it with a domain-specific check that actually compares a revision/digest value if one exists in the flow-state model.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 6. Centralize review verdict literals
**Finding key:** loop-2604a4bbf6ea56affa83
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated directly in validation logic and messages. The new review domain already defines canonical dispositions, so this file now has duplicated verdict knowledge.  
**Suggestion:** Add a local constant such as `const REVIEW_VERDICTS = ["PASS", "ADVISORY", "REJECTED"];` and reuse it for validation and error text, or import a canonical exported list if available from the touched review module.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `"PASS"`, `"ADVISORY"`, and `"REJECTED"` are repeated directly in validation logic and messages. The new review domain already defines canonical dispositions, so this file now has duplicated verdict knowledge.  
**Suggestion:** Add a local constant such as `const REVIEW_VERDICTS = ["PASS", "ADVISORY", "REJECTED"];` and reuse it for validation and error text, or import a canonical exported list if available from the touched review module.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 1. Extract Repeated Review Result Persistence Branches
**Finding key:** loop-14bb6a6ec9fc86cf1d87
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** The draft/test/spec branches repeat the same pattern: parse output, persist canonical review result, then return. This adds duplication and makes future routing changes easier to miss.  
**Suggestion:** Add a small helper such as `parseAndPersistReviewResult(parser, res, stdout, stderr, reviewCtx, phase, revision)` or a parser map for non-impl phases, then route through that shared path.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** The draft/test/spec branches repeat the same pattern: parse output, persist canonical review result, then return. This adds duplication and makes future routing changes easier to miss.  
**Suggestion:** Add a small helper such as `parseAndPersistReviewResult(parser, res, stdout, stderr, reviewCtx, phase, revision)` or a parser map for non-impl phases, then route through that shared path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 2. Centralize Tooling Error Envelope Decoration
**Finding key:** loop-e6998ba57f2b929e997a
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** The schema failure and immediate block branches both build an `Envelope.fail`, then conditionally merge `reviewAction` into `envelope.data`. The same pattern appears twice with only message text differing.  
**Suggestion:** Extract a helper like `withCanonicalReviewAction(envelope, canonicalTooling)` or `toolingFailureEnvelope(...)` so TOOLING_ERROR response shaping stays consistent.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** The schema failure and immediate block branches both build an `Envelope.fail`, then conditionally merge `reviewAction` into `envelope.data`. The same pattern appears twice with only message text differing.  
**Suggestion:** Extract a helper like `withCanonicalReviewAction(envelope, canonicalTooling)` or `toolingFailureEnvelope(...)` so TOOLING_ERROR response shaping stays consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 3. Avoid Duplicated Permission Detection Regex
**Finding key:** loop-45aa5d16899fab66ac74
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** Permission-related detection is implemented more than once using `/permission|EACCES|EPERM|sandbox/i`, including in `parseToolingOutcome`, `persistCanonicalToolingOutcome`, and `permissionRelatedFailure`.  
**Suggestion:** Reuse `permissionRelatedFailure(...)` everywhere, or rename it to `isPermissionRelatedFailureText(...)` and make all ReviewToolingOutcome construction call that helper.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** Permission-related detection is implemented more than once using `/permission|EACCES|EPERM|sandbox/i`, including in `parseToolingOutcome`, `persistCanonicalToolingOutcome`, and `permissionRelatedFailure`.  
**Suggestion:** Reuse `permissionRelatedFailure(...)` everywhere, or rename it to `isPermissionRelatedFailureText(...)` and make all ReviewToolingOutcome construction call that helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 4. Rename Tooling Failure Helpers To Match New Outcome Model
**Finding key:** loop-ac46880b35e47738da29
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** `persistCanonicalToolingFailure` and `#persistToolingFailure` still use “Failure” terminology while the migration introduces `TOOLING_ERROR` / `ReviewToolingOutcome`. This keeps legacy wording in the new design surface.  
**Suggestion:** Rename them to `persistCanonicalToolingOutcomeResult` and `#persistToolingOutcome`, or similar, so names align with the new model and avoid reintroducing TOOLING_FAILURE concepts.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** `persistCanonicalToolingFailure` and `#persistToolingFailure` still use “Failure” terminology while the migration introduces `TOOLING_ERROR` / `ReviewToolingOutcome`. This keeps legacy wording in the new design surface.  
**Suggestion:** Rename them to `persistCanonicalToolingOutcomeResult` and `#persistToolingOutcome`, or similar, so names align with the new model and avoid reintroducing TOOLING_FAILURE concepts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 5. Replace Full Record Filtering With Reverse Search
**Finding key:** loop-fa391d3f3a0f1a21a996
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `unchangedReviewConvergenceTarget` builds a full `matching` array just to use the last matching record. That does unnecessary bulk allocation over `reviewConvergence.records`.  
**Suggestion:** Iterate backward with `findLast` or a reverse loop and stop at the first matching record. This is simpler and avoids loading all matches.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `unchangedReviewConvergenceTarget` builds a full `matching` array just to use the last matching record. That does unnecessary bulk allocation over `reviewConvergence.records`.  
**Suggestion:** Iterate backward with `findLast` or a reverse loop and stop at the first matching record. This is simpler and avoids loading all matches.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 65. 6. Include Task Scope In Review Reset Identity Check
**Finding key:** loop-8b89672333362bff3445
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `unchangedReviewConvergenceTarget` only considers records where `taskId` is `null`. For task-scoped impl review convergence, the reset identity guard may ignore the active task record.  
**Suggestion:** Resolve the active node/task in the command and pass `taskId` into `unchangedReviewConvergenceTarget(ctx, phase, taskId)`, matching both phase and task identity.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R6  
**Issue:** `unchangedReviewConvergenceTarget` only considers records where `taskId` is `null`. For task-scoped impl review convergence, the reset identity guard may ignore the active task record.  
**Suggestion:** Resolve the active node/task in the command and pass `taskId` into `unchangedReviewConvergenceTarget(ctx, phase, taskId)`, matching both phase and task identity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 66. 7. Share Current Tree SHA Resolution Helper
**Finding key:** loop-725e3136268936ec7636
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `currentTreeSha` duplicates the same `runGit(["rev-parse", "HEAD"])` pattern added in other touched files. This makes error wording and normalization drift likely.  
**Suggestion:** Extract or reuse a shared local helper from the touched review command path if feasible within this changeset, or at least align the helper naming and error behavior with `resolveCurrentReviewTreeSha`.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `currentTreeSha` duplicates the same `runGit(["rev-parse", "HEAD"])` pattern added in other touched files. This makes error wording and normalization drift likely.  
**Suggestion:** Extract or reuse a shared local helper from the touched review command path if feasible within this changeset, or at least align the helper naming and error behavior with `resolveCurrentReviewTreeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 67. 8. Remove Redundant Evidence Conversion Inside Mutation
**Finding key:** loop-66d9b987ad4c1e3409a1
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `input.toEvidence(target)` is called inside the `flowManager.mutate` callback even though it depends only on already validated input and target. That mixes pure conversion with state mutation.  
**Suggestion:** Compute `const evidence = input.toEvidence(target)` before `mutate`, pass that value to `registrar.register`, and return it in `toCommandResult`. This makes the CAS mutation block smaller and easier to reason about.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `input.toEvidence(target)` is called inside the `flowManager.mutate` callback even though it depends only on already validated input and target. That mixes pure conversion with state mutation.  
**Suggestion:** Compute `const evidence = input.toEvidence(target)` before `mutate`, pass that value to `registrar.register`, and return it in `toCommandResult`. This makes the CAS mutation block smaller and easier to reason about.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 68. 1. Remove Contradictory TOOLING_ERROR Override Language
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

### 69. 2. Prefer Consistent Review Action Naming In Prompt Text
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

### 70. 3. Avoid Repeating Target Guard Help Assembly Inline
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

### 71. 4. Rename `failedReview` Local Variable
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

### 72. 1. Extract Shared Rejected Verdict Fixtures
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

### 73. 2. Rename Stale `failReview` Fixture
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

### 74. 3. Avoid Duplicated Tooling Outcome Object
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

### 75. 1. Standardize review finding storage across artifacts
**Finding key:** loop-748af9353a8351726b69
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple JSON artifacts duplicate the same finding payloads across grouped arrays such as `blockingFindings` / `advisoryFindings` and flattened `findings`, while gate source artifacts duplicate observations under both evaluation-local and top-level arrays. This creates a cross-file schema drift risk for the same review data model.
**Suggestion:** Define one canonical finding/observation collection for review artifacts, and make alternate grouped or evaluation views contain only lightweight references such as `findingId`, `fingerprint`, or `observationId`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple JSON artifacts duplicate the same finding payloads across grouped arrays such as `blockingFindings` / `advisoryFindings` and flattened `findings`, while gate source artifacts duplicate observations under both evaluation-local and top-level arrays. This creates a cross-file schema drift risk for the same review data model.
**Suggestion:** Define one canonical finding/observation collection for review artifacts, and make alternate grouped or evaluation views contain only lightweight references such as `findingId`, `fingerprint`, or `observationId`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 76. 2. Unify review-history count field naming
**Finding key:** loop-0fcc32db1c94f92f572f
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/impl-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** `impl-attempt-001.json` uses `summary` for review counts, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. Consumers must branch by phase even though the artifact family is shared.
**Suggestion:** Standardize all review-history JSON artifacts on one field name, preferably `counts`, and update generators/readers together.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** `impl-attempt-001.json` uses `summary` for review counts, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. Consumers must branch by phase even though the artifact family is shared.
**Suggestion:** Standardize all review-history JSON artifacts on one field name, preferably `counts`, and update generators/readers together.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 77. 3. Centralize review verdict vocabulary
**Finding key:** loop-3c9ef12832ca9c8dfb6f
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R7
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** The verdict literals `PASS`, `ADVISORY`, and `REJECTED` are repeated across `src/flow/definition.js`, `src/flow/lib/run-gate.js`, `src/flow/lib/flow-judgment-contract.js`, tests, and prompt/skill text. This makes terminology migrations error-prone, as shown by remaining stale `failReview` / `failedReview` names.
**Suggestion:** Export or locally centralize canonical review verdict constants where appropriate, and rename stale test fixtures/variables to `rejectedReview` so code, tests, and prompts use the same vocabulary.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** The verdict literals `PASS`, `ADVISORY`, and `REJECTED` are repeated across `src/flow/definition.js`, `src/flow/lib/run-gate.js`, `src/flow/lib/flow-judgment-contract.js`, tests, and prompt/skill text. This makes terminology migrations error-prone, as shown by remaining stale `failReview` / `failedReview` names.
**Suggestion:** Export or locally centralize canonical review verdict constants where appropriate, and rename stale test fixtures/variables to `rejectedReview` so code, tests, and prompts use the same vocabulary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 78. 4. Align review handoff source-step derivation
**Finding key:** loop-16717a075355f2fdeb43
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** `flow-findings.js` defaults handoff source steps to `"review"`, while `acceptance-review-artifacts.js` derives source steps from phase/task context. The same handoff findings can therefore be counted or rendered differently depending on the consumer.
**Suggestion:** Extract a shared helper such as `reviewHandoffSourceStep(record, finding)` and use it in both files.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`
**Requirement:** R3
**Issue:** `flow-findings.js` defaults handoff source steps to `"review"`, while `acceptance-review-artifacts.js` derives source steps from phase/task context. The same handoff findings can therefore be counted or rendered differently depending on the consumer.
**Suggestion:** Extract a shared helper such as `reviewHandoffSourceStep(record, finding)` and use it in both files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 79. 5. Share review target resolution logic
**Finding key:** loop-e57be5de54724d2d53d0
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** Review target identity logic is duplicated across `semanticMaxAttempts()`, `toolingMaxAttempts()`, and retry/reset handling, with one reported path ignoring task-scoped records. This risks inconsistent convergence behavior between status, retry, and review execution.
**Suggestion:** Introduce a shared `reviewStepTargetFor(phase, taskId)` or equivalent target identity helper and use it anywhere review convergence records are matched or max attempts are resolved.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** Review target identity logic is duplicated across `semanticMaxAttempts()`, `toolingMaxAttempts()`, and retry/reset handling, with one reported path ignoring task-scoped records. This risks inconsistent convergence behavior between status, retry, and review execution.
**Suggestion:** Introduce a shared `reviewStepTargetFor(phase, taskId)` or equivalent target identity helper and use it anywhere review convergence records are matched or max attempts are resolved.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 80. 6. Normalize tooling outcome naming and permission detection
**Finding key:** loop-789c7bc89201d38f84d5
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R8
**Issue:** Tooling outcome construction and permission-related detection are repeated across `run-review.js` and `src/flow/commands/review.js`, while some helper names still use legacy “Failure” terminology despite the new `TOOLING_ERROR` / `ReviewToolingOutcome` model.
**Suggestion:** Use one helper for permission detection, one helper for tooling outcome construction/envelope decoration, and rename persistence helpers from “Failure” to “Outcome” terminology.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R8
**Issue:** Tooling outcome construction and permission-related detection are repeated across `run-review.js` and `src/flow/commands/review.js`, while some helper names still use legacy “Failure” terminology despite the new `TOOLING_ERROR` / `ReviewToolingOutcome` model.
**Suggestion:** Use one helper for permission detection, one helper for tooling outcome construction/envelope decoration, and rename persistence helpers from “Failure” to “Outcome” terminology.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 81. 7. Apply consistent bounded-resource limits to review state processing
**Finding key:** loop-339dfadefa170196dde2
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files process persisted review data without explicit bounds: convergence records and handoff findings in `acceptance-review-artifacts.js`, convergence record scans in `review-convergence.js`, recursive evidence canonicalization in `review-convergence.js`, issue-log growth, metrics history, and recursive test snapshots.
**Suggestion:** Define named limits for review records, handoff findings, evidence depth/bytes, metric history, issue-log entries, and snapshot size, then enforce them at read/validation boundaries.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R3
**Issue:** Several files process persisted review data without explicit bounds: convergence records and handoff findings in `acceptance-review-artifacts.js`, convergence record scans in `review-convergence.js`, recursive evidence canonicalization in `review-convergence.js`, issue-log growth, metrics history, and recursive test snapshots.
**Suggestion:** Define named limits for review records, handoff findings, evidence depth/bytes, metric history, issue-log entries, and snapshot size, then enforce them at read/validation boundaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 82. 8. Make canonical versus generated artifacts explicit
**Finding key:** loop-28c7a6711f590a06065e
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review.md`
**Requirement:** R9
**Issue:** Several artifact pairs duplicate the same information across JSON and Markdown, and some canonical paths show multiple competing versions such as `review.md` / `impl-review.json` PASS versus ADVISORY outputs. This makes it unclear which file is authoritative.
**Suggestion:** Treat JSON as the canonical source for machine-readable review results, generate Markdown from it with clear generated metadata, and keep prior attempts only under attempt-specific `review-history/` paths.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review.md`
**Requirement:** R9
**Issue:** Several artifact pairs duplicate the same information across JSON and Markdown, and some canonical paths show multiple competing versions such as `review.md` / `impl-review.json` PASS versus ADVISORY outputs. This makes it unclear which file is authoritative.
**Suggestion:** Treat JSON as the canonical source for machine-readable review results, generate Markdown from it with clear generated metadata, and keep prior attempts only under attempt-specific `review-history/` paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 83. 9. Deduplicate generated empty/no-op artifact templates
**Finding key:** loop-5d09e1c9310f1a79a4fc
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/draft-questions-triage.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/draft-questions-triage.json`
**Requirement:** R7
**Issue:** Empty triage, repair, and PASS review-history artifacts repeat the same structure across multiple files with only phase/source/timestamp differences. This adds review noise and increases generator maintenance.
**Suggestion:** Generate empty/no-op artifacts from a shared metadata-driven template, or omit committed no-op artifacts when they can be regenerated deterministically.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/draft-questions-triage.json`
**Requirement:** R7
**Issue:** Empty triage, repair, and PASS review-history artifacts repeat the same structure across multiple files with only phase/source/timestamp differences. This adds review noise and increases generator maintenance.
**Suggestion:** Generate empty/no-op artifacts from a shared metadata-driven template, or omit committed no-op artifacts when they can be regenerated deterministically.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
