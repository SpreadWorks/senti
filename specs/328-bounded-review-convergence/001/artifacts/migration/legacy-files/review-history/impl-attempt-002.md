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

### 6. 1. Remove Duplicate File Entries
**Finding key:** loop-5a20155f517c01bfadc6
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/file-map.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/file-map.json`  
**Requirement:** R7  
**Issue:** `src/flow/lib/get-next-action.js` and `src/flow/lib/get-status.js` appear twice under `R7`, which adds noise and can confuse tooling or reviewers about intended coverage.  
**Suggestion:** Deduplicate each requirement’s file list so every path appears at most once.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/file-map.json`  
**Requirement:** R7  
**Issue:** `src/flow/lib/get-next-action.js` and `src/flow/lib/get-status.js` appear twice under `R7`, which adds noise and can confuse tooling or reviewers about intended coverage.  
**Suggestion:** Deduplicate each requirement’s file list so every path appears at most once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Normalize Repeated Retry Metric Records
**Finding key:** loop-2ab6e29d10d786c822bf
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R6  
**Issue:** The `metrics` array records five near-identical `reviewRetry` entries for `phase: "test"` with the same `recoveredFrom` value and timestamps only milliseconds apart. This looks like duplicated state rather than distinct meaningful events, and it weakens the bounded-resource-usage audit trail.  
**Suggestion:** Replace burst duplicate retry metric entries with a single bounded aggregate record, for example one entry with `delta: 5` or an explicit attempt count, so retry accounting remains compact and clearly bounded.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R6  
**Issue:** The `metrics` array records five near-identical `reviewRetry` entries for `phase: "test"` with the same `recoveredFrom` value and timestamps only milliseconds apart. This looks like duplicated state rather than distinct meaningful events, and it weakens the bounded-resource-usage audit trail.  
**Suggestion:** Replace burst duplicate retry metric entries with a single bounded aggregate record, for example one entry with `delta: 5` or an explicit attempt count, so retry accounting remains compact and clearly bounded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Remove Stale Runtime Log From Pending Step
**Finding key:** loop-59214fee0c5d94aa1b02
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R4  
**Issue:** In the second `flow.json` version, `impl-review` has `status: "pending"` but still contains a `runtimeLog` from a completed `flow run review`. That mixes pending state with historical execution state and is inconsistent with nearby step modeling.  
**Suggestion:** Either remove the stale `runtimeLog` from pending steps or move it into `stepAttempts`/metrics/history-only state so active step status and execution history stay separate.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/flow.json`  
**Requirement:** R4  
**Issue:** In the second `flow.json` version, `impl-review` has `status: "pending"` but still contains a `runtimeLog` from a completed `flow run review`. That mixes pending state with historical execution state and is inconsistent with nearby step modeling.  
**Suggestion:** Either remove the stale `runtimeLog` from pending steps or move it into `stepAttempts`/metrics/history-only state so active step status and execution history stay separate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Use consistent count field names across history JSON files
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

### 10. 1. Avoid duplicating finding records in the JSON history artifact
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

### 11. 3. Add trailing newline to Markdown artifact
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

### 12. 1. Avoid duplicating finding records in the JSON history artifact
**Finding key:** loop-a9ee2888193752296ade
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The same finding data is represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the flattened `findings` array. Several records also repeat the same `findingId` / `fingerprint`, increasing drift risk between projections.  
**Suggestion:** Keep one canonical findings collection and derive grouped blocking/advisory views when rendering or consuming the artifact, or store only lightweight references in grouped sections.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The same finding data is represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the flattened `findings` array. Several records also repeat the same `findingId` / `fingerprint`, increasing drift risk between projections.  
**Suggestion:** Keep one canonical findings collection and derive grouped blocking/advisory views when rendering or consuming the artifact, or store only lightweight references in grouped sections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Use consistent count field names across history JSON files
**Finding key:** loop-96f26aff74b8a6ca53c9
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** This file uses `summary`, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. The inconsistency makes consumers branch by phase unnecessarily.  
**Suggestion:** Standardize on one field name, preferably `counts`, across review-history JSON artifacts.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** This file uses `summary`, while `spec-attempt-001.json` and `test-attempt-001.json` use `counts` for the same concept. The inconsistency makes consumers branch by phase unnecessarily.  
**Suggestion:** Standardize on one field name, preferably `counts`, across review-history JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Add trailing newline to Markdown artifact
**Finding key:** loop-9204c65b78be3760795b
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The file is missing a trailing newline, which is inconsistent with the other generated Markdown artifacts and can create noisy diffs.  
**Suggestion:** Ensure the renderer always terminates generated Markdown files with a newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review.md`  
**Requirement:** R9  
**Issue:** The file is missing a trailing newline, which is inconsistent with the other generated Markdown artifacts and can create noisy diffs.  
**Suggestion:** Ensure the renderer always terminates generated Markdown files with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Add trailing newline to Markdown artifact
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

### 16. 1. Remove duplicated finding payloads from JSON history artifacts
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

### 17. 2. Remove duplicated finding payloads from later JSON attempts
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

### 18. 3. Remove duplicated finding payloads from single-finding attempt
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

### 19. 4. Normalize duplicated Markdown rendering structure
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

### 20. 5. Add trailing newline
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

### 21. 6. Add trailing newline
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

### 22. 4. Use distinct finding identities
**Finding key:** loop-a6d2b7892d06540a3e33
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-005.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id` even though they describe different missing coverage areas. This can collapse distinct findings during deduplication or tracking.  
**Suggestion:** Generate separate stable fingerprints for the stale-tree guard finding and the completed-review idempotence finding.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-005.json`  
**Requirement:** R9  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id` even though they describe different missing coverage areas. This can collapse distinct findings during deduplication or tracking.  
**Suggestion:** Generate separate stable fingerprints for the stale-tree guard finding and the completed-review idempotence finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Deduplicate repeated module ownership entry
**Finding key:** loop-ad0b20cac1489c2d5663
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R1  
**Issue:** `src/flow/lib/review-convergence.js` is listed twice under “Modules” with overlapping ownership descriptions. This makes the intended module responsibility less clear.  
**Suggestion:** Merge the two bullets into one complete description of `review-convergence.js`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R1  
**Issue:** `src/flow/lib/review-convergence.js` is listed twice under “Modules” with overlapping ownership descriptions. This makes the intended module responsibility less clear.  
**Suggestion:** Merge the two bullets into one complete description of `review-convergence.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Deduplicate repeated module entry in structured spec
**Finding key:** loop-7a6f3f161c240c6b82bf
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.json`  
**Requirement:** R1  
**Issue:** `overview.modules` contains two entries for `src/flow/lib/review-convergence.js` with partially duplicated responsibilities.  
**Suggestion:** Consolidate them into a single module entry, preserving `added_by_task` only if that metadata is required by the flow.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.json`  
**Requirement:** R1  
**Issue:** `overview.modules` contains two entries for `src/flow/lib/review-convergence.js` with partially duplicated responsibilities.  
**Suggestion:** Consolidate them into a single module entry, preserving `added_by_task` only if that metadata is required by the flow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Remove empty placeholder sections
**Finding key:** loop-70e7a47e6a845a014fb1
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R9  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders and add noise to the generated spec.  
**Suggestion:** Remove these sections when empty, or render explicit empty-state text such as `None`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.md`  
**Requirement:** R9  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders and add noise to the generated spec.  
**Suggestion:** Remove these sections when empty, or render explicit empty-state text such as `None`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Normalize scenario result naming
**Finding key:** loop-1fecf3ab1c99ae400c89
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/scenario-validity-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** `process.exitCode` is `1`, every requirement is classified as `expected_fail`, but top-level `result` is `"pass"`. The name mixes command outcome with scenario-validity outcome and is easy to misread.  
**Suggestion:** Rename or split the field, for example `scenarioResult: "pass"` plus `commandResult: "fail"`, or use a clearer value such as `"expected_failures_observed"`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/scenario-validity-result.json`  
**Requirement:** R9  
**Issue:** `process.exitCode` is `1`, every requirement is classified as `expected_fail`, but top-level `result` is `"pass"`. The name mixes command outcome with scenario-validity outcome and is easy to misread.  
**Suggestion:** Rename or split the field, for example `scenarioResult: "pass"` plus `commandResult: "fail"`, or use a clearer value such as `"expected_failures_observed"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Remove duplicated finding payload
**Finding key:** loop-79d4d3c236d860c3227d
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/task-impl-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R8  
**Issue:** The same guardrail violation is represented twice: once under `evaluations[0].observations[0]` and again under top-level `observations[0]`, with duplicated `observed`, `rationale`, `where`, `refs`, `disposition`, and timing fields. This increases drift risk because future edits must keep both copies consistent.  
**Suggestion:** Store the detailed observation once and have the evaluation reference it by `findingId`/`fingerprint`, or make one section the canonical source and derive the other during rendering.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R8  
**Issue:** The same guardrail violation is represented twice: once under `evaluations[0].observations[0]` and again under top-level `observations[0]`, with duplicated `observed`, `rationale`, `where`, `refs`, `disposition`, and timing fields. This increases drift risk because future edits must keep both copies consistent.  
**Suggestion:** Store the detailed observation once and have the evaluation reference it by `findingId`/`fingerprint`, or make one section the canonical source and derive the other during rendering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Normalize duplicate identifier fields
**Finding key:** loop-0ed292a74904e89bb60f
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/task-impl-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R8  
**Issue:** The JSON mixes `guardrail_id` and `guardrailId`, plus `requirementRef` and `requirementId`. This naming inconsistency makes consumers more complex and encourages duplicate compatibility handling.  
**Suggestion:** Use one canonical naming convention for persisted fields, preferably the existing schema’s convention, and remove redundant aliases from this artifact.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R8  
**Issue:** The JSON mixes `guardrail_id` and `guardrailId`, plus `requirementRef` and `requirementId`. This naming inconsistency makes consumers more complex and encourages duplicate compatibility handling.  
**Suggestion:** Use one canonical naming convention for persisted fields, preferably the existing schema’s convention, and remove redundant aliases from this artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Avoid persisting generated failure output as source input
**Finding key:** loop-0c9252acabc7e41ed8b8
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/task-impl-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R7  
**Issue:** The file appears to persist a concrete failed gate run, including `runId`, `generatedAt`, `reportedAt`, fingerprints, and a reference to a raw local log. This is volatile execution output rather than stable source content, and it can become stale immediately after regeneration.  
**Suggestion:** Keep transient gate results in ignored/generated artifacts, or reduce this checked-in source file to stable fixture data with deterministic IDs/timestamps and no run-specific metadata.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/task-impl-gate-source.json`  
**Requirement:** R7  
**Issue:** The file appears to persist a concrete failed gate run, including `runId`, `generatedAt`, `reportedAt`, fingerprints, and a reference to a raw local log. This is volatile execution output rather than stable source content, and it can become stale immediately after regeneration.  
**Suggestion:** Keep transient gate results in ignored/generated artifacts, or reduce this checked-in source file to stable fixture data with deterministic IDs/timestamps and no run-specific metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Extract shared spec fixture setup
**Finding key:** loop-cedcb3636e315ea0f348
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-action-resolution.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R9
**Issue:** Temporary spec setup, `makeFlowManager` creation, `makeFlowState(...)`, `moveFlowToStep(...)`, and cleanup are repeated across tests, making new convergence fixtures verbose and easier to drift.
**Suggestion:** Add a local helper such as `makeReviewFlowFixture(t, { step = "impl-review", specRequirements = [...] })` that creates the temp root, writes `spec.json`, initializes the flow manager, and returns `{ tmp, manager, context }`.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R9
**Issue:** Temporary spec setup, `makeFlowManager` creation, `makeFlowState(...)`, `moveFlowToStep(...)`, and cleanup are repeated across tests, making new convergence fixtures verbose and easier to drift.
**Suggestion:** Add a local helper such as `makeReviewFlowFixture(t, { step = "impl-review", specRequirements = [...] })` that creates the temp root, writes `spec.json`, initializes the flow manager, and returns `{ tmp, manager, context }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Replace provider loop with explicit scenario names
**Finding key:** loop-c6ad91cbc18299565efd
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-action-resolution.test.js
**Requirement:** R4
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R4
**Issue:** The loop over `["provider-a", "provider-b"]` only changes the reason string, so failures do not clearly identify which provider scenario failed and the provider identity is not part of the state under test.
**Suggestion:** Use named subtests with `t.test(...)` or construct explicit cases with `{ provider, reason }`, so assertion output identifies the failing provider-change case directly.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-action-resolution.test.js`
**Requirement:** R4
**Issue:** The loop over `["provider-a", "provider-b"]` only changes the reason string, so failures do not clearly identify which provider scenario failed and the provider identity is not part of the state under test.
**Suggestion:** Use named subtests with `t.test(...)` or construct explicit cases with `{ provider, reason }`, so assertion output identifies the failing provider-change case directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Avoid storing oversized raw assertion output
**Finding key:** loop-95d73406d7e3ddde383e
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/.raw/scenario-validity.log
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/.raw/scenario-validity.log`
**Requirement:** R9
**Issue:** The raw log embeds a very large source-code dump from a failed regex assertion, making the evidence artifact noisy and expensive to review while adding little diagnostic value.
**Suggestion:** Configure the scenario-validity capture to truncate large assertion payloads or store only the failing assertion summary plus a bounded excerpt. Keep the full command, exit code, test names, and error messages, but cap per-failure output size.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/.raw/scenario-validity.log`
**Requirement:** R9
**Issue:** The raw log embeds a very large source-code dump from a failed regex assertion, making the evidence artifact noisy and expensive to review while adding little diagnostic value.
**Suggestion:** Configure the scenario-validity capture to truncate large assertion payloads or store only the failing assertion summary plus a bounded excerpt. Keep the full command, exit code, test names, and error messages, but cap per-failure output size.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 4. Derive markdown review results from JSON only
**Finding key:** loop-45f6ae8196805dacd818
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/test-review.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R9
**Issue:** `test-review.md` duplicates the same finding titles, issues, required changes, and rationale already present in `test-review.json`, creating two authoritative-looking places that can drift.
**Suggestion:** Treat `test-review.json` as canonical and generate the markdown view from it during render, or remove the markdown artifact from committed changes if consumers can read the JSON directly.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/test-review.md`
**Requirement:** R9
**Issue:** `test-review.md` duplicates the same finding titles, issues, required changes, and rationale already present in `test-review.json`, creating two authoritative-looking places that can drift.
**Suggestion:** Treat `test-review.json` as canonical and generate the markdown view from it during render, or remove the markdown artifact from committed changes if consumers can read the JSON directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Add an Explicit Bound When Reading Canonical Evidence
**Finding key:** loop-45f18d817a386dcb5a08
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `canonicalReviewSourceMatches()` reads `sourcePath` with `fs.readFileSync(sourcePath)` after only checking that it is a regular file. That allows an unbounded canonical evidence read, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Check `sourceStat.size` against an explicit maximum before reading, preferably reusing the same size cap used by `readBoundedSourceArtifact()` if available in this file. Reject or return `false` when the canonical evidence file exceeds the cap.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `canonicalReviewSourceMatches()` reads `sourcePath` with `fs.readFileSync(sourcePath)` after only checking that it is a regular file. That allows an unbounded canonical evidence read, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Check `sourceStat.size` against an explicit maximum before reading, preferably reusing the same size cap used by `readBoundedSourceArtifact()` if available in this file. Reject or return `false` when the canonical evidence file exceeds the cap.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Avoid Recomputing Handoff Findings for Every Deferred Finding
**Finding key:** loop-152e8d6629bc5a02dd51
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `deferredSourceBlockers()` calls `canonicalReviewSourceMatches()` for every deferred finding, and `canonicalReviewSourceMatches()` calls `reviewHandoffFindings(flowState)` each time. This repeatedly rebuilds the same derived list and can become unnecessarily expensive as records/findings grow.  
**Suggestion:** Build the handoff list once in `deferredSourceBlockers()`, index it by `findingId`, and pass the matched handoff into a smaller `canonicalReviewSourceMatches(specDir, finding, handoff)` helper.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `deferredSourceBlockers()` calls `canonicalReviewSourceMatches()` for every deferred finding, and `canonicalReviewSourceMatches()` calls `reviewHandoffFindings(flowState)` each time. This repeatedly rebuilds the same derived list and can become unnecessarily expensive as records/findings grow.  
**Suggestion:** Build the handoff list once in `deferredSourceBlockers()`, index it by `findingId`, and pass the matched handoff into a smaller `canonicalReviewSourceMatches(specDir, finding, handoff)` helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Centralize Tooling Stage Classification
**Finding key:** loop-e2e66d6c593279a76ce7
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** Tooling failure stage mapping is duplicated in several places: `toolingFailureResult()`, `buildToolingFailureReview()`, and the test-review logging branch each translate parser/schema/coverage kinds into `"parse"` or `"communication"` independently.  
**Suggestion:** Extract small helpers such as `implToolingStageForFailureKind()` and `testToolingStageForKind()` or a single stage classifier if the vocabularies can be unified. Use the helper both when constructing `ReviewToolingOutcome` and when logging.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** Tooling failure stage mapping is duplicated in several places: `toolingFailureResult()`, `buildToolingFailureReview()`, and the test-review logging branch each translate parser/schema/coverage kinds into `"parse"` or `"communication"` independently.  
**Suggestion:** Extract small helpers such as `implToolingStageForFailureKind()` and `testToolingStageForKind()` or a single stage classifier if the vocabularies can be unified. Use the helper both when constructing `ReviewToolingOutcome` and when logging.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Replace Repeated Tooling Outcome Checks With a Predicate
**Finding key:** loop-23d0a57bc05224844259
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** The migration from `verdict === "TOOLING_FAILURE"` to `toolingOutcome` leaves several repeated truthiness checks like `if (execution.toolingOutcome)` and `if (reviewOutput?.toolingOutcome)`. This spreads the representation detail through the review command.  
**Suggestion:** Add a local predicate such as `isToolingOutcomeResult(result)` and use it at the loop/single review boundaries. That keeps the new representation consistent and makes future shape changes less invasive.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** The migration from `verdict === "TOOLING_FAILURE"` to `toolingOutcome` leaves several repeated truthiness checks like `if (execution.toolingOutcome)` and `if (reviewOutput?.toolingOutcome)`. This spreads the representation detail through the review command.  
**Suggestion:** Add a local predicate such as `isToolingOutcomeResult(result)` and use it at the loop/single review boundaries. That keeps the new representation consistent and makes future shape changes less invasive.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 5. Define Shared Review Verdict Constants
**Finding key:** loop-8b31fe2615942bf38ac0
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R7
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R7  
**Issue:** Valid review verdict sets and accepted terminal verdict checks are repeated as string arrays and conditionals, for example `["PASS", "ADVISORY", "REJECTED"]` and `verdict === "PASS" || verdict === "ADVISORY"`.  
**Suggestion:** Introduce file-local constants such as `REVIEW_DISPOSITIONS` and `COMPLETING_REVIEW_DISPOSITIONS`, then use `.includes()` or helper predicates. This reduces typo risk during the FAIL to REJECTED migration.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R7  
**Issue:** Valid review verdict sets and accepted terminal verdict checks are repeated as string arrays and conditionals, for example `["PASS", "ADVISORY", "REJECTED"]` and `verdict === "PASS" || verdict === "ADVISORY"`.  
**Suggestion:** Introduce file-local constants such as `REVIEW_DISPOSITIONS` and `COMPLETING_REVIEW_DISPOSITIONS`, then use `.includes()` or helper predicates. This reduces typo risk during the FAIL to REJECTED migration.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 6. Extract Common Test Fixture Constants
**Finding key:** loop-f7e06d32214fcf5a1391
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/tests/review-execution-regression.test.js
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/tests/review-execution-regression.test.js`  
**Requirement:** R9  
**Issue:** The same tooling stage list is repeated in multiple tests, and the same pipeline input shape appears several times. That makes it easy for future test additions to miss a stage or drift from the intended target tuple.  
**Suggestion:** Add constants like `TOOLING_STAGES` and `implReviewTargetInput({ provider = "fixture-provider" } = {})`, then reuse them in the normalization and pipeline tests.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/tests/review-execution-regression.test.js`  
**Requirement:** R9  
**Issue:** The same tooling stage list is repeated in multiple tests, and the same pipeline input shape appears several times. That makes it easy for future test additions to miss a stage or drift from the intended target tuple.  
**Suggestion:** Add constants like `TOOLING_STAGES` and `implReviewTargetInput({ provider = "fixture-provider" } = {})`, then reuse them in the normalization and pipeline tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Remove unused max-attempt resolver
**Finding key:** loop-cf7c341bacbdc0c78b45
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R7  
**Issue:** `resolveActiveStepMaxAttempts()` appears to be dead code after review recovery projection moved from `reviewStop` / `retryRecovery` to `reviewAction`. Keeping it preserves obsolete review-recovery concepts and makes the migration harder to reason about.  
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` if there are no remaining in-file callers.
**Suggestion:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R7  
**Issue:** `resolveActiveStepMaxAttempts()` appears to be dead code after review recovery projection moved from `reviewStop` / `retryRecovery` to `reviewAction`. Keeping it preserves obsolete review-recovery concepts and makes the migration harder to reason about.  
**Suggestion:** Delete `resolveActiveStepMaxAttempts()` if there are no remaining in-file callers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Bound review handoff aggregation
**Finding key:** loop-be886eacf09f7d9d70a1
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** `buildDeferredFindingsSummary()` now iterates all `flowState.reviewConvergence.records` and all nested `handoffFindings` without an explicit count bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Introduce explicit limits for records and handoff findings considered in the summary, ideally via existing project constants if available in this file. For example, cap the number of review convergence records inspected and the number of handoff findings accumulated before counting/projecting them.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** `buildDeferredFindingsSummary()` now iterates all `flowState.reviewConvergence.records` and all nested `handoffFindings` without an explicit count bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Introduce explicit limits for records and handoff findings considered in the summary, ideally via existing project constants if available in this file. For example, cap the number of review convergence records inspected and the number of handoff findings accumulated before counting/projecting them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Extract source-step dedupe helper
**Finding key:** loop-15d1e4210ae2f382e79b
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** `sourceSteps` population now has two nearly identical dedupe blocks: one for persisted artifact entries and one for review handoffs. The repeated `seen.has()` / `seen.add()` / `sourceSteps.push()` pattern is small but easy to drift.  
**Suggestion:** Add a local helper such as `appendSourceStep(sourceSteps, seen, sourceStep)` and use it for both artifact entries and review handoff findings.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** `sourceSteps` population now has two nearly identical dedupe blocks: one for persisted artifact entries and one for review handoffs. The repeated `seen.has()` / `seen.add()` / `sourceSteps.push()` pattern is small but easy to drift.  
**Suggestion:** Add a local helper such as `appendSourceStep(sourceSteps, seen, sourceStep)` and use it for both artifact entries and review handoff findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 4. Clarify review handoff fingerprint handling
**Finding key:** loop-3404d1c8d3be642e2da3
**Failure mode:** refactor
**File:** src/flow/lib/flow-findings.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** The new handoff dedupe assumes every handoff finding has a usable `fingerprint`. If a malformed or transitional record has a missing fingerprint, all such findings collapse into one `undefined` entry, which can make the count inaccurate and hide bad state.  
**Suggestion:** Either skip handoff findings without a fingerprint explicitly, or derive a bounded fallback identity from stable fields already present on the finding. If missing fingerprints are invalid by design, make that explicit with a small predicate/helper name.
**Suggestion:** **File:** `src/flow/lib/flow-findings.js`  
**Requirement:** R3  
**Issue:** The new handoff dedupe assumes every handoff finding has a usable `fingerprint`. If a malformed or transitional record has a missing fingerprint, all such findings collapse into one `undefined` entry, which can make the count inaccurate and hide bad state.  
**Suggestion:** Either skip handoff findings without a fingerprint explicitly, or derive a bounded fallback identity from stable fields already present on the finding. If missing fingerprints are invalid by design, make that explicit with a small predicate/helper name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 2. Bound Review Convergence History Growth
**Finding key:** loop-5a461ba0d58273c88e22
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `reviewConvergence.records` and each record’s `evidenceHistory` are scanned and extended without an explicit upper bound. Duplicate detection via `records.some(...)` and `nextEvidenceHistory(...)` can grow unbounded over repeated review targets, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit caps for stored convergence records and per-record evidence history, or replace array history scans with a bounded/indexed structure keyed by phase/task/tree/digest.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `reviewConvergence.records` and each record’s `evidenceHistory` are scanned and extended without an explicit upper bound. Duplicate detection via `records.some(...)` and `nextEvidenceHistory(...)` can grow unbounded over repeated review targets, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit caps for stored convergence records and per-record evidence history, or replace array history scans with a bounded/indexed structure keyed by phase/task/tree/digest.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 3. Bound Handoff Finding Shape Before Deep Freeze
**Finding key:** loop-55ce2de3f2dba65712c6
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewHandoffFinding` accepts arbitrary object input, `structuredClone`s it, then recursively `deepFreeze`s it without a depth, key-count, or serialized-size bound. A malformed or unexpectedly nested finding can cause unbounded recursive processing.  
**Suggestion:** Normalize handoff findings into a fixed class shape with known fields, or validate maximum object depth/key count/serialized byte size before cloning and freezing.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewHandoffFinding` accepts arbitrary object input, `structuredClone`s it, then recursively `deepFreeze`s it without a depth, key-count, or serialized-size bound. A malformed or unexpectedly nested finding can cause unbounded recursive processing.  
**Suggestion:** Normalize handoff findings into a fixed class shape with known fields, or validate maximum object depth/key count/serialized byte size before cloning and freezing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 4. Consolidate Target Normalization
**Finding key:** loop-d06e1a45103d083ac5e5
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** The same target object construction appears in `emptyConvergenceState`, `applyReviewEvidenceTransition`, `ReviewConvergenceStore.read`, and `recordToolingOutcome`, with repeated phase/task/tree normalization. This creates multiple places where future target validation behavior can diverge.  
**Suggestion:** Introduce a small `ReviewTarget` class or `normalizeReviewTarget()` helper and use it everywhere target identity is constructed or compared.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** The same target object construction appears in `emptyConvergenceState`, `applyReviewEvidenceTransition`, `ReviewConvergenceStore.read`, and `recordToolingOutcome`, with repeated phase/task/tree normalization. This creates multiple places where future target validation behavior can diverge.  
**Suggestion:** Introduce a small `ReviewTarget` class or `normalizeReviewTarget()` helper and use it everywhere target identity is constructed or compared.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 5. Remove Trivial Revision Wrapper
**Finding key:** loop-4d833a7edd9b17306f44
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R5  
**Issue:** `sameRevision(left, right)` only returns `left === right`, adding an indirection that does not clarify domain behavior.  
**Suggestion:** Inline the identity comparison in `ReviewEvidenceRegistrar.register`, or replace it with a named CAS/revision object if richer semantics are intended.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R5  
**Issue:** `sameRevision(left, right)` only returns `left === right`, adding an indirection that does not clarify domain behavior.  
**Suggestion:** Inline the identity comparison in `ReviewEvidenceRegistrar.register`, or replace it with a named CAS/revision object if richer semantics are intended.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 1. Extract Shared Review Persistence Flow
**Finding key:** loop-6785b55c33144ff30372
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** Canonical review persistence is implemented twice: once in `ReviewExecutionPipeline` and again through `persistCanonicalReviewArtifact`, `persistCanonicalToolingFailure`, and `persistCanonicalReviewResult` in `RunReviewCommand`. The two paths duplicate tooling outcome recording, evidence normalization, and next-operation projection, which makes stage handling drift likely.  
**Suggestion:** Make `RunReviewCommand` use `ReviewExecutionPipeline` boundaries, or extract the shared persistence/result-recording logic into one helper used by both paths.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** Canonical review persistence is implemented twice: once in `ReviewExecutionPipeline` and again through `persistCanonicalReviewArtifact`, `persistCanonicalToolingFailure`, and `persistCanonicalReviewResult` in `RunReviewCommand`. The two paths duplicate tooling outcome recording, evidence normalization, and next-operation projection, which makes stage handling drift likely.  
**Suggestion:** Make `RunReviewCommand` use `ReviewExecutionPipeline` boundaries, or extract the shared persistence/result-recording logic into one helper used by both paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 1. Resolve the Actual Tree SHA or Rename the Field
**Finding key:** loop-1b229693f2b6271a259c
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `currentTreeSha()` runs `git rev-parse HEAD`, which returns the commit SHA, while the function name, error text, target field, and requirement all refer to `treeSha`. This naming mismatch makes the review target semantics easy to misunderstand.  
**Suggestion:** If evidence is meant to bind to the source tree, use `git rev-parse HEAD^{tree}`. If it is intentionally commit-bound, rename the helper and local field usage to `currentCommitSha` / `commitSha` consistently.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** `currentTreeSha()` runs `git rev-parse HEAD`, which returns the commit SHA, while the function name, error text, target field, and requirement all refer to `treeSha`. This naming mismatch makes the review target semantics easy to misunderstand.  
**Suggestion:** If evidence is meant to bind to the source tree, use `git rev-parse HEAD^{tree}`. If it is intentionally commit-bound, rename the helper and local field usage to `currentCommitSha` / `commitSha` consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 2. Avoid Loading Evidence Before Verifying Active Review Context
**Finding key:** loop-1b43c7338f831f7b8e65
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** The command reads and parses the evidence file before confirming that the current flow state is actually on a review step. That does unnecessary file work and can surface input errors before the more relevant “review target not active” failure.  
**Suggestion:** Resolve `target = currentReviewTarget(ctx.flowState, currentTreeSha(ctx.root))` before calling `ReviewEvidenceInput.fromFile(...)`, then validate the evidence against the already-established target.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** The command reads and parses the evidence file before confirming that the current flow state is actually on a review step. That does unnecessary file work and can surface input errors before the more relevant “review target not active” failure.  
**Suggestion:** Resolve `target = currentReviewTarget(ctx.flowState, currentTreeSha(ctx.root))` before calling `ReviewEvidenceInput.fromFile(...)`, then validate the evidence against the already-established target.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 3. Normalize the `--file` Argument Once
**Finding key:** loop-ed1fdd0bf37cbf6fcf3b
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** The code checks `ctx.file.trim()` for usage validation but then passes the untrimmed `ctx.file` to `ReviewEvidenceInput.fromFile`. This creates a small inconsistency where whitespace-only is rejected but whitespace-padded paths are handled by downstream path logic.  
**Suggestion:** Assign `const inputPath = ctx.file.trim()` after validation and pass that normalized value to `ReviewEvidenceInput.fromFile`.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R5  
**Issue:** The code checks `ctx.file.trim()` for usage validation but then passes the untrimmed `ctx.file` to `ReviewEvidenceInput.fromFile`. This creates a small inconsistency where whitespace-only is rejected but whitespace-padded paths are handled by downstream path logic.  
**Suggestion:** Assign `const inputPath = ctx.file.trim()` after validation and pass that normalized value to `ReviewEvidenceInput.fromFile`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 1. Rename `failReview` Fixture After Verdict Migration
**Finding key:** loop-2c3787f1e4f3861ff484
**Failure mode:** refactor
**File:** tests/unit/flow/gate-spec-sanity.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict value is now `REJECTED`. This keeps legacy terminology in the test and makes the intent less clear.  
**Suggestion:** Rename `failReview` to `rejectedReview`, and update its usages in the same file.
**Suggestion:** **File:** `tests/unit/flow/gate-spec-sanity.test.js`  
**Requirement:** R9  
**Issue:** The fixture is still named `failReview` even though the verdict value is now `REJECTED`. This keeps legacy terminology in the test and makes the intent less clear.  
**Suggestion:** Rename `failReview` to `rejectedReview`, and update its usages in the same file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 1. Extract repeated rejected review fixture setup
**Finding key:** loop-4fd9cf354782c5706727
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat `writeJson(fixture.specDir, "test-review.json", { verdict: "REJECTED", ... })`, which makes future verdict schema changes noisy and error-prone.  
**Suggestion:** Add a small helper such as `writeRejectedTestReview(fixture, reviewFields)` that injects `verdict: "REJECTED"` and delegates to `writeJson`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R9  
**Issue:** Multiple tests repeat `writeJson(fixture.specDir, "test-review.json", { verdict: "REJECTED", ... })`, which makes future verdict schema changes noisy and error-prone.  
**Suggestion:** Add a small helper such as `writeRejectedTestReview(fixture, reviewFields)` that injects `verdict: "REJECTED"` and delegates to `writeJson`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 2. Extract tooling error artifact fixture
**Finding key:** loop-79076b56bccc9cd85a6c
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same nested `toolingOutcome` object is duplicated in parser assertions and post-hook setup. This is a structured contract fixture, so duplication increases the chance of the two expectations drifting.  
**Suggestion:** Define a local helper or constant, for example `parserToolingErrorOutcome`, and reuse it in both expected artifact objects.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The same nested `toolingOutcome` object is duplicated in parser assertions and post-hook setup. This is a structured contract fixture, so duplication increases the chance of the two expectations drifting.  
**Suggestion:** Define a local helper or constant, for example `parserToolingErrorOutcome`, and reuse it in both expected artifact objects.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 3. Prefer named verdict constants in dense routing tests
**Finding key:** loop-782aab4502799b65fc82
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R9
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The file now has many repeated string literals for lifecycle verdicts, especially `"REJECTED"`, `"PASS"`, and `"ADVISORY"`. In routing tests these literals represent protocol values, not incidental text.  
**Suggestion:** Introduce local constants such as `VERDICT_REJECTED`, `VERDICT_PASS`, and `VERDICT_ADVISORY` within this test file, then use them in case tables and helper calls. This keeps test intent explicit and reduces typo risk.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R9  
**Issue:** The file now has many repeated string literals for lifecycle verdicts, especially `"REJECTED"`, `"PASS"`, and `"ADVISORY"`. In routing tests these literals represent protocol values, not incidental text.  
**Suggestion:** Introduce local constants such as `VERDICT_REJECTED`, `VERDICT_PASS`, and `VERDICT_ADVISORY` within this test file, then use them in case tables and helper calls. This keeps test intent explicit and reduces typo risk.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 1. Remove Generated Upgrade Result Artifact
**Finding key:** loop-a46cb2259bed3e3e603c
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/upgrade-result.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/upgrade-result.json`  
**Requirement:** R9  
**Issue:** This file appears to be a transient command result from `senti upgrade`, including execution metadata and a raw log path. Committing generated run output adds noise and can become stale quickly.  
**Suggestion:** Remove this file from the change set unless the spec explicitly requires preserving upgrade execution evidence in version control.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/upgrade-result.json`  
**Requirement:** R9  
**Issue:** This file appears to be a transient command result from `senti upgrade`, including execution metadata and a raw log path. Committing generated run output adds noise and can become stale quickly.  
**Suggestion:** Remove this file from the change set unless the spec explicitly requires preserving upgrade execution evidence in version control.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 1. Standardize Review Finding Storage Across Artifacts
**Finding key:** loop-8215b277ba451642fcdc
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple review artifacts duplicate full finding payloads in grouped arrays and flattened arrays, and gate source files duplicate observations between evaluation-local and top-level collections. This creates the same drift risk across `review-history/*`, `draft-gate-source.json`, and `task-impl-gate-source.json`.
**Suggestion:** Define one canonical persisted finding/observation representation across review artifacts. Store grouped or evaluation-specific views as lightweight references such as `findingId` or `fingerprint`, then derive expanded views during rendering.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/test-attempt-001.json`
**Requirement:** R9
**Issue:** Multiple review artifacts duplicate full finding payloads in grouped arrays and flattened arrays, and gate source files duplicate observations between evaluation-local and top-level collections. This creates the same drift risk across `review-history/*`, `draft-gate-source.json`, and `task-impl-gate-source.json`.
**Suggestion:** Define one canonical persisted finding/observation representation across review artifacts. Store grouped or evaluation-specific views as lightweight references such as `findingId` or `fingerprint`, then derive expanded views during rendering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 2. Normalize Review Artifact Count Field Names
**Finding key:** loop-11aeff7d83b2242e54aa
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/impl-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** Review history JSON files use different field names for the same summary concept: `impl-attempt-001.json` uses `summary`, while spec/test attempts use `counts`. Consumers must branch by phase even though the shape is conceptually shared.
**Suggestion:** Standardize the schema on one field name, preferably `counts`, across all review-history JSON artifacts.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/impl-attempt-001.json`
**Requirement:** R9
**Issue:** Review history JSON files use different field names for the same summary concept: `impl-attempt-001.json` uses `summary`, while spec/test attempts use `counts`. Consumers must branch by phase even though the shape is conceptually shared.
**Suggestion:** Standardize the schema on one field name, preferably `counts`, across all review-history JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 3. Unify Verdict Terminology After REJECTED Migration
**Finding key:** loop-a7356bebc384cbfbec92
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R7
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** Several files still encode review verdict protocol values independently, while tests and fixtures also retain legacy or repeated terminology such as `failReview` for a `REJECTED` verdict. This spreads naming and protocol drift across source, prompts, and tests.
**Suggestion:** Introduce shared review verdict constants or predicates in production code, mirror them with local constants in dense tests, and rename stale fixtures from `fail*` to `rejected*`.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R7
**Issue:** Several files still encode review verdict protocol values independently, while tests and fixtures also retain legacy or repeated terminology such as `failReview` for a `REJECTED` verdict. This spreads naming and protocol drift across source, prompts, and tests.
**Suggestion:** Introduce shared review verdict constants or predicates in production code, mirror them with local constants in dense tests, and rename stale fixtures from `fail*` to `rejected*`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 4. Consolidate Review Target Identity Naming
**Finding key:** loop-f36e5f64bb6f9604f9f1
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`
**Requirement:** R5
**Issue:** Review target identity is represented inconsistently across files: `treeSha` naming is used while `currentTreeSha()` returns `HEAD`, and target construction is repeated in `review-convergence.js`. This makes it unclear whether review evidence is commit-bound or tree-bound.
**Suggestion:** Decide whether the target uses commit SHA or tree SHA. Then centralize target normalization in a shared helper/class and use consistent field/helper names everywhere.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`
**Requirement:** R5
**Issue:** Review target identity is represented inconsistently across files: `treeSha` naming is used while `currentTreeSha()` returns `HEAD`, and target construction is repeated in `review-convergence.js`. This makes it unclear whether review evidence is commit-bound or tree-bound.
**Suggestion:** Decide whether the target uses commit SHA or tree SHA. Then centralize target normalization in a shared helper/class and use consistent field/helper names everywhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 5. Centralize Review Persistence And Tooling Outcome Handling
**Finding key:** loop-544fc17e87ee0825bf0d
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R4
**Issue:** Review persistence, tooling outcome recording, and stage classification are duplicated across `run-review.js` and `src/flow/commands/review.js`. That creates multiple sources of truth for parse/communication stage mapping and canonical artifact behavior.
**Suggestion:** Extract a shared review persistence/result-recording path, or route `RunReviewCommand` through `ReviewExecutionPipeline` boundaries. Keep tooling stage classification in one helper used by both command and logging paths.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R4
**Issue:** Review persistence, tooling outcome recording, and stage classification are duplicated across `run-review.js` and `src/flow/commands/review.js`. That creates multiple sources of truth for parse/communication stage mapping and canonical artifact behavior.
**Suggestion:** Extract a shared review persistence/result-recording path, or route `RunReviewCommand` through `ReviewExecutionPipeline` boundaries. Keep tooling stage classification in one helper used by both command and logging paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 6. Apply Consistent Bounds To Review Convergence Processing
**Finding key:** loop-d5fd1467ce450f63c9ea
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R2
**Issue:** Bounded-resource concerns appear in several related files: convergence records and evidence histories can grow unbounded, handoff findings can be deeply cloned/frozen without shape limits, deferred summaries scan all records, and canonical evidence reads lack a size check. These are cross-file violations of the same bounded convergence contract.
**Suggestion:** Add shared limits for convergence records, evidence history, handoff findings, and canonical evidence size. Reuse those limits from `review-convergence.js`, `flow-findings.js`, and `acceptance-review-artifacts.js`.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R2
**Issue:** Bounded-resource concerns appear in several related files: convergence records and evidence histories can grow unbounded, handoff findings can be deeply cloned/frozen without shape limits, deferred summaries scan all records, and canonical evidence reads lack a size check. These are cross-file violations of the same bounded convergence contract.
**Suggestion:** Add shared limits for convergence records, evidence history, handoff findings, and canonical evidence size. Reuse those limits from `review-convergence.js`, `flow-findings.js`, and `acceptance-review-artifacts.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 7. Deduplicate Generated Spec And Review Evidence Artifacts
**Finding key:** loop-3fb51ba97340741e9eec
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** Generated or structured spec artifacts repeat the same content across JSON and Markdown, including duplicated module entries and review findings. Similar duplication appears in `spec.md`, `test-review.md`, and paired `review-history/*.md` / `*.json` files.
**Suggestion:** Treat JSON as canonical for structured review/spec data and generate Markdown projections from it. Deduplicate module lists in both `spec.json` and `spec.md`, and mark generated Markdown clearly if it remains committed.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/spec.json`
**Requirement:** R1
**Issue:** Generated or structured spec artifacts repeat the same content across JSON and Markdown, including duplicated module entries and review findings. Similar duplication appears in `spec.md`, `test-review.md`, and paired `review-history/*.md` / `*.json` files.
**Suggestion:** Treat JSON as canonical for structured review/spec data and generate Markdown projections from it. Deduplicate module lists in both `spec.json` and `spec.md`, and mark generated Markdown clearly if it remains committed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 8. Normalize Generated Text File Formatting
**Finding key:** loop-24957c18ffe386fb278f
**Failure mode:** refactor
**File:** specs/328-bounded-review-convergence/review-history/spec-attempt-001.md
**Requirement:** R9
**Issue:** **File:** `specs/328-bounded-review-convergence/review-history/spec-attempt-001.md`
**Requirement:** R9
**Issue:** Several generated Markdown review artifacts are missing trailing newlines, while others include them. This inconsistency creates avoidable cross-file diff noise.
**Suggestion:** Update the Markdown renderer so every generated `.md` artifact ends with a trailing newline.
**Suggestion:** **File:** `specs/328-bounded-review-convergence/review-history/spec-attempt-001.md`
**Requirement:** R9
**Issue:** Several generated Markdown review artifacts are missing trailing newlines, while others include them. This inconsistency creates avoidable cross-file diff noise.
**Suggestion:** Update the Markdown renderer so every generated `.md` artifact ends with a trailing newline.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
