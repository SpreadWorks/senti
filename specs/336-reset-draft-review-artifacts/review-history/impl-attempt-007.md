# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 5. Reduce Empty Artifact Boilerplate Duplication
**Finding key:** loop-1b2dfa843e391fc6fae1
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-coverage-repair.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-coverage-repair.json`  
**Requirement:** R4  
**Issue:** This file duplicates the same empty artifact shape as `draft-coverage-triage.json`, differing only in `phase`, source field name, and summary text.  
**Suggestion:** Use the shared empty-artifact generation path suggested above, parameterized by phase and source artifact, instead of maintaining repeated hand-shaped JSON output.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-coverage-repair.json`  
**Requirement:** R4  
**Issue:** This file duplicates the same empty artifact shape as `draft-coverage-triage.json`, differing only in `phase`, source field name, and summary text.  
**Suggestion:** Use the shared empty-artifact generation path suggested above, parameterized by phase and source artifact, instead of maintaining repeated hand-shaped JSON output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 4. Reduce Empty Artifact Boilerplate Duplication
**Finding key:** loop-28a65fbba3dfc70bb0f1
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-coverage-triage.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-coverage-triage.json`  
**Requirement:** R4  
**Issue:** The empty triage artifact repeats the same structure used by the empty repair artifact: `version`, `phase`, source pointer, timestamp, summary, and empty `items`. This is low-risk now, but repeated generated JSON shapes tend to drift when schemas evolve.  
**Suggestion:** Generate empty triage/repair artifacts through the same helper/template path so the common fields and empty-state wording stay consistent across artifacts.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-coverage-triage.json`  
**Requirement:** R4  
**Issue:** The empty triage artifact repeats the same structure used by the empty repair artifact: `version`, `phase`, source pointer, timestamp, summary, and empty `items`. This is low-risk now, but repeated generated JSON shapes tend to drift when schemas evolve.  
**Suggestion:** Generate empty triage/repair artifacts through the same helper/template path so the common fields and empty-state wording stay consistent across artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Remove Duplicated Gate Findings
**Finding key:** loop-9cbd28d9f0232b4ad867
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same `migration-parity` failures are represented twice: once under `evaluations[].observations` and again in top-level `observations`. This duplicates the same rationale, severity, refs, timestamps, and disposition, making the artifact harder to review and increasing the chance of inconsistent updates.  
**Suggestion:** Keep one canonical representation for each finding. If both views are required by the schema, make one a compact reference list keyed by `findingId`/`fingerprint` instead of duplicating the full observation payload.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same `migration-parity` failures are represented twice: once under `evaluations[].observations` and again in top-level `observations`. This duplicates the same rationale, severity, refs, timestamps, and disposition, making the artifact harder to review and increasing the chance of inconsistent updates.  
**Suggestion:** Keep one canonical representation for each finding. If both views are required by the schema, make one a compact reference list keyed by `findingId`/`fingerprint` instead of duplicating the full observation payload.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Normalize Repair Artifact Metadata
**Finding key:** loop-ee604f1930f036ea6505
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-questions-repair.json
**Requirement:** R2
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-repair.json`  
**Requirement:** R2  
**Issue:** The repaired artifact version shown in the diff drops the `generatedAt` field while the other repair/triage artifacts include it. That makes this file inconsistent with the apparent artifact schema used by the rest of the change set.  
**Suggestion:** Add `generatedAt` back to `draft-questions-repair.json`, or remove it consistently from all generated artifacts if timestamps are intentionally no longer part of the format.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-repair.json`  
**Requirement:** R2  
**Issue:** The repaired artifact version shown in the diff drops the `generatedAt` field while the other repair/triage artifacts include it. That makes this file inconsistent with the apparent artifact schema used by the rest of the change set.  
**Suggestion:** Add `generatedAt` back to `draft-questions-repair.json`, or remove it consistently from all generated artifacts if timestamps are intentionally no longer part of the format.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Avoid Hard-Coded Ordinal In Item Title
**Finding key:** loop-6c164cc76597f2ff0fc8
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-questions-repair.json
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-repair.json`  
**Requirement:** R3  
**Issue:** The item title embeds an ordinal: `"1. Remove Instruction Marker"`. Since `items` is already an ordered array, the prefix duplicates structure and can become stale if items are reordered or filtered.  
**Suggestion:** Change the title to `"Remove Instruction Marker"` and let consumers derive numbering from the array position.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-repair.json`  
**Requirement:** R3  
**Issue:** The item title embeds an ordinal: `"1. Remove Instruction Marker"`. Since `items` is already an ordered array, the prefix duplicates structure and can become stale if items are reordered or filtered.  
**Suggestion:** Change the title to `"Remove Instruction Marker"` and let consumers derive numbering from the array position.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Normalize Triage Metadata
**Finding key:** loop-e0459f3423e1144226e4
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-questions-triage.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`  
**Requirement:** R1  
**Issue:** This artifact omits `generatedAt`, while the other review artifacts include it. That makes the schema less consistent and can force consumers to special-case triage output.  
**Suggestion:** Add `generatedAt` using the same timestamp format as the review artifacts, or explicitly remove `generatedAt` from all sibling artifacts if timestamps are not part of the canonical schema.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`  
**Requirement:** R1  
**Issue:** This artifact omits `generatedAt`, while the other review artifacts include it. That makes the schema less consistent and can force consumers to special-case triage output.  
**Suggestion:** Add `generatedAt` using the same timestamp format as the review artifacts, or explicitly remove `generatedAt` from all sibling artifacts if timestamps are not part of the canonical schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Remove Stale Duplicate Artifact Variants
**Finding key:** loop-fa6dcea51fc49f57d4cf
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft.json`  
**Requirement:** R2  
**Issue:** The diff shows two independent “new file” versions for the same path, with materially different scope: one includes approval freshness and sealed rewind timestamp behavior, while the other does not. This creates review ambiguity and risks landing a stale draft artifact.  
**Suggestion:** Keep only the intended final artifact state and remove the obsolete duplicate version from the change set before merging.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft.json`  
**Requirement:** R2  
**Issue:** The diff shows two independent “new file” versions for the same path, with materially different scope: one includes approval freshness and sealed rewind timestamp behavior, while the other does not. This creates review ambiguity and risks landing a stale draft artifact.  
**Suggestion:** Keep only the intended final artifact state and remove the obsolete duplicate version from the change set before merging.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Align Review Outcome With Repair Targets
**Finding key:** loop-7fcb94aae2cf562b7044
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-review-questions.json
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-review-questions.json`  
**Requirement:** R3  
**Issue:** The artifact says `verdict: "ADVISORY"` while also reporting `0 advisory` and placing the only finding in `repairTargets`. The naming makes the state harder to reason about because “advisory” is both a verdict and a finding category.  
**Suggestion:** Use a clearer verdict such as `REPAIR_TARGETS` if the schema allows it, or update the summary wording so `ADVISORY` clearly means “non-blocking review did not pass cleanly.”
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-review-questions.json`  
**Requirement:** R3  
**Issue:** The artifact says `verdict: "ADVISORY"` while also reporting `0 advisory` and placing the only finding in `repairTargets`. The naming makes the state harder to reason about because “advisory” is both a verdict and a finding category.  
**Suggestion:** Use a clearer verdict such as `REPAIR_TARGETS` if the schema allows it, or update the summary wording so `ADVISORY` clearly means “non-blocking review did not pass cleanly.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Avoid Repeated Long Scope Text
**Finding key:** loop-d63b351e06d799d9d7c2
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft.json`  
**Requirement:** R4  
**Issue:** The same route ownership and canonical artifact behavior is repeated across `analysis.proposedApproach`, `decisionMap`, `scopeVerification`, and `impactOnExisting`. This increases maintenance cost when the scope changes.  
**Suggestion:** Consolidate the repeated invariant into one canonical section, then have other sections reference it briefly instead of restating the full behavior.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft.json`  
**Requirement:** R4  
**Issue:** The same route ownership and canonical artifact behavior is repeated across `analysis.proposedApproach`, `decisionMap`, `scopeVerification`, and `impactOnExisting`. This increases maintenance cost when the scope changes.  
**Suggestion:** Consolidate the repeated invariant into one canonical section, then have other sections reference it briefly instead of restating the full behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Remove Duplicate Artifact Snapshots From The Diff
**Finding key:** loop-91beaef14e1220dabef8
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R4  
**Issue:** The diff shows two separate `new file` hunks for the same `flow.json`, with different lifecycle states and artifact histories. That makes review noisy and suggests stale intermediate flow state was captured alongside the final state.  
**Suggestion:** Keep only the final intended `flow.json` snapshot, or exclude this generated runtime state from the change set if it is not required for review/audit.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R4  
**Issue:** The diff shows two separate `new file` hunks for the same `flow.json`, with different lifecycle states and artifact histories. That makes review noisy and suggests stale intermediate flow state was captured alongside the final state.  
**Suggestion:** Keep only the final intended `flow.json` snapshot, or exclude this generated runtime state from the change set if it is not required for review/audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Bound Runtime History Growth
**Finding key:** loop-0a72d81141e50a92a096
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R4  
**Issue:** `metrics`, `reviewConvergence.records`, `evidenceHistory`, `stepAttempts`, and rewind archive entries grow with every attempt. The artifact does not show an explicit retention cap, which risks violating the `bounded-resource-usage` guardrail for long-running or repeatedly rewound flows.  
**Suggestion:** Add or enforce explicit maximum retained counts for per-run histories, with older entries archived or summarized once the cap is reached.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R4  
**Issue:** `metrics`, `reviewConvergence.records`, `evidenceHistory`, `stepAttempts`, and rewind archive entries grow with every attempt. The artifact does not show an explicit retention cap, which risks violating the `bounded-resource-usage` guardrail for long-running or repeatedly rewound flows.  
**Suggestion:** Add or enforce explicit maximum retained counts for per-run histories, with older entries archived or summarized once the cap is reached.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Avoid Committing Volatile Review Runtime State
**Finding key:** loop-7775f2324e34518445fb
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/impl-review.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/impl-review.json`  
**Requirement:** R6  
**Issue:** The diff includes two different versions of `impl-review.json`: one rejected T-1 review and one passing T-2 review. This creates conflicting review evidence in a single change and makes the artifact look manually assembled rather than canonical.  
**Suggestion:** Commit only the final canonical review artifact for the current attempt, or move prior attempts into an explicit history/archive structure instead of representing them as duplicate file additions.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/impl-review.json`  
**Requirement:** R6  
**Issue:** The diff includes two different versions of `impl-review.json`: one rejected T-1 review and one passing T-2 review. This creates conflicting review evidence in a single change and makes the artifact look manually assembled rather than canonical.  
**Suggestion:** Commit only the final canonical review artifact for the current attempt, or move prior attempts into an explicit history/archive structure instead of representing them as duplicate file additions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Collapse Repeated Issue Narrative
**Finding key:** loop-d90159e050eae1059fce
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R1  
**Issue:** The English issue body is duplicated almost verbatim inside the Japanese `<details>` section; only the one-line Japanese summary is localized. This doubles maintenance cost and can let the two sections drift.  
**Suggestion:** Either fully localize the Japanese details section or replace it with a short Japanese summary that links back to the canonical English sections.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R1  
**Issue:** The English issue body is duplicated almost verbatim inside the Japanese `<details>` section; only the one-line Japanese summary is localized. This doubles maintenance cost and can let the two sections drift.  
**Suggestion:** Either fully localize the Japanese details section or replace it with a short Japanese summary that links back to the canonical English sections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Remove Duplicate Artifact Entries
**Finding key:** loop-7db9617fd59c8cd6248d
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/plugin-artifacts/workflow/prepare.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The diff shows the same new file added twice with identical content, which suggests the generated artifact set or patch assembly contains duplicate entries.  
**Suggestion:** Keep a single `prepare.json` artifact entry in the change set so review output is not duplicated.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The diff shows the same new file added twice with identical content, which suggests the generated artifact set or patch assembly contains duplicate entries.  
**Suggestion:** Keep a single `prepare.json` artifact entry in the change set so review output is not duplicated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Remove Duplicate Review Evidence Entry
**Finding key:** loop-8e499f1f98d2521e6b7e
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/04ab5c92b4a4c09de0e63b3ccd88cb0c9220d7da0e493dbc43ebcf4879f0574d.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/04ab5c92b4a4c09de0e63b3ccd88cb0c9220d7da0e493dbc43ebcf4879f0574d.json`  
**Requirement:** R1  
**Issue:** The same evidence JSON appears twice in the diff with identical content. This adds noise and makes artifact review harder without adding information.  
**Suggestion:** Ensure this evidence file is emitted only once.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/04ab5c92b4a4c09de0e63b3ccd88cb0c9220d7da0e493dbc43ebcf4879f0574d.json`  
**Requirement:** R1  
**Issue:** The same evidence JSON appears twice in the diff with identical content. This adds noise and makes artifact review harder without adding information.  
**Suggestion:** Ensure this evidence file is emitted only once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Remove Duplicate Draft Coverage Evidence Entry
**Finding key:** loop-0637fb0b3cc4da32a410
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/0903a0af117ebca23f13f2a316fe63239fb7607946140a300d980d59b6344dbd.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/0903a0af117ebca23f13f2a316fe63239fb7607946140a300d980d59b6344dbd.json`  
**Requirement:** R1  
**Issue:** The draft coverage evidence artifact is duplicated verbatim in the diff.  
**Suggestion:** Deduplicate the generated review-evidence entry so the change set contains one copy.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/0903a0af117ebca23f13f2a316fe63239fb7607946140a300d980d59b6344dbd.json`  
**Requirement:** R1  
**Issue:** The draft coverage evidence artifact is duplicated verbatim in the diff.  
**Suggestion:** Deduplicate the generated review-evidence entry so the change set contains one copy.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Remove Duplicate Draft Questions Evidence Entry
**Finding key:** loop-90d69d96208360a4465a
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/5e1f4c27d87435c282dbebee129f67e5b2ec5b88740a5c0ed3c5dd44b7b45a2d.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/5e1f4c27d87435c282dbebee129f67e5b2ec5b88740a5c0ed3c5dd44b7b45a2d.json`  
**Requirement:** R1  
**Issue:** The advisory review evidence file appears twice with identical JSON payloads.  
**Suggestion:** Keep only one emitted artifact for this evidence record.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/5e1f4c27d87435c282dbebee129f67e5b2ec5b88740a5c0ed3c5dd44b7b45a2d.json`  
**Requirement:** R1  
**Issue:** The advisory review evidence file appears twice with identical JSON payloads.  
**Suggestion:** Keep only one emitted artifact for this evidence record.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Normalize review evidence JSON formatting
**Finding key:** loop-72c3e11c8980cbd825f2
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/9cee522c4db1b6b03d2cffd9655fccbc8257e01eef808218274f7918fde056bf.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/9cee522c4db1b6b03d2cffd9655fccbc8257e01eef808218274f7918fde056bf.json`
**Requirement:** R8
**Issue:** The evidence artifact is stored as a single-line JSON blob, which makes future diffs hard to review and increases the chance of accidental noisy rewrites.
**Suggestion:** Pretty-print this JSON with stable key ordering and indentation, matching the project’s preferred artifact formatting if one exists.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/9cee522c4db1b6b03d2cffd9655fccbc8257e01eef808218274f7918fde056bf.json`
**Requirement:** R8
**Issue:** The evidence artifact is stored as a single-line JSON blob, which makes future diffs hard to review and increases the chance of accidental noisy rewrites.
**Suggestion:** Pretty-print this JSON with stable key ordering and indentation, matching the project’s preferred artifact formatting if one exists.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Normalize review evidence JSON formatting
**Finding key:** loop-a80543fb1559a69fdf2d
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json`
**Requirement:** R8
**Issue:** The file contains multiple findings in a single-line JSON object, making duplicated fields like `findingId`, `fingerprint`, and `evidenceRefs` difficult to scan or compare.
**Suggestion:** Reformat the artifact as pretty-printed JSON so each finding object is reviewable independently.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json`
**Requirement:** R8
**Issue:** The file contains multiple findings in a single-line JSON object, making duplicated fields like `findingId`, `fingerprint`, and `evidenceRefs` difficult to scan or compare.
**Suggestion:** Reformat the artifact as pretty-printed JSON so each finding object is reviewable independently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Normalize review evidence JSON formatting
**Finding key:** loop-2dd54d8d621eab62cb34
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/c008c7d7d899bf5889b7c9fb1af14e43bb584f88062893e479d9e38bc15d322a.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c008c7d7d899bf5889b7c9fb1af14e43bb584f88062893e479d9e38bc15d322a.json`
**Requirement:** R8
**Issue:** The artifact is minified, which reduces maintainability for spec review evidence and obscures the structure of `blockingFindings` and `provenance`.
**Suggestion:** Apply the same stable JSON formatting used for other checked-in spec artifacts.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c008c7d7d899bf5889b7c9fb1af14e43bb584f88062893e479d9e38bc15d322a.json`
**Requirement:** R8
**Issue:** The artifact is minified, which reduces maintainability for spec review evidence and obscures the structure of `blockingFindings` and `provenance`.
**Suggestion:** Apply the same stable JSON formatting used for other checked-in spec artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 4. Normalize review evidence JSON formatting
**Finding key:** loop-0eb1ee8237c0607430e7
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/c42b7f8a9926883f864f8e385a148930ee8b9467f859dc316db5ef4ceaf001c7.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c42b7f8a9926883f864f8e385a148930ee8b9467f859dc316db5ef4ceaf001c7.json`
**Requirement:** R8
**Issue:** The one-line JSON format makes small future changes appear as whole-file rewrites.
**Suggestion:** Pretty-print the JSON artifact to reduce diff noise and improve consistency with human-reviewed evidence files.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c42b7f8a9926883f864f8e385a148930ee8b9467f859dc316db5ef4ceaf001c7.json`
**Requirement:** R8
**Issue:** The one-line JSON format makes small future changes appear as whole-file rewrites.
**Suggestion:** Pretty-print the JSON artifact to reduce diff noise and improve consistency with human-reviewed evidence files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Collapse duplicated finding payloads
**Finding key:** loop-f5854893cba702326e64
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`
**Requirement:** R6
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated fields (`title`, `issue`/`body`, `rationale`, `requirementId`, `fingerprint`, etc.). This creates drift risk if one copy is updated and the other is not.
**Suggestion:** Keep a single canonical `findings` array and derive `blockingFindings` from `severity: "blocking"` when needed, or make `blockingFindings` contain only stable references such as finding IDs.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`
**Requirement:** R6
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated fields (`title`, `issue`/`body`, `rationale`, `requirementId`, `fingerprint`, etc.). This creates drift risk if one copy is updated and the other is not.
**Suggestion:** Keep a single canonical `findings` array and derive `blockingFindings` from `severity: "blocking"` when needed, or make `blockingFindings` contain only stable references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Normalize duplicate identifier fields
**Finding key:** loop-1e8fad5db31a8d55c187
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`
**Requirement:** R6
**Issue:** Findings carry both `id` and `findingId` with identical values, and top-level blocking findings also include both `findingId` and `fingerprint` with identical values. The naming does not clarify whether these are separate concepts.
**Suggestion:** Use one identifier field for the same concept, preferably `findingId`, and keep `fingerprint` only if it can differ semantically from the finding ID.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`
**Requirement:** R6
**Issue:** Findings carry both `id` and `findingId` with identical values, and top-level blocking findings also include both `findingId` and `fingerprint` with identical values. The naming does not clarify whether these are separate concepts.
**Suggestion:** Use one identifier field for the same concept, preferably `findingId`, and keep `fingerprint` only if it can differ semantically from the finding ID.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Avoid redundant empty finding categories
**Finding key:** loop-80c34e66337b3e6b8b6e
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/draft-coverage-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/draft-coverage-attempt-001.json`
**Requirement:** R6
**Issue:** The artifact stores several empty arrays that express overlapping concepts: `blockingFindings`, `advisoryFindings`, `repairTargets`, and `findings`. For a PASS result with no findings, this adds schema noise without carrying distinct information.
**Suggestion:** Prefer a single empty `findings: []` collection plus `verdict: "PASS"`, or document why the category-specific empty arrays are required by consumers.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/draft-coverage-attempt-001.json`
**Requirement:** R6
**Issue:** The artifact stores several empty arrays that express overlapping concepts: `blockingFindings`, `advisoryFindings`, `repairTargets`, and `findings`. For a PASS result with no findings, this adds schema noise without carrying distinct information.
**Suggestion:** Prefer a single empty `findings: []` collection plus `verdict: "PASS"`, or document why the category-specific empty arrays are required by consumers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Consolidate repair target duplication
**Finding key:** loop-33d64029fd2a740f1b7d
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/draft-questions-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/draft-questions-attempt-001.json`
**Requirement:** R6
**Issue:** The same repair target appears in both `repairTargets` and `findings`, duplicating `title`, `target`, `evidence`, and `rationale` with slightly different field names (`classification` vs. `category`, `rationale` vs. `body`).
**Suggestion:** Store the repair target once in `findings` with `category: "repair_target"`, and derive the `repairTargets` view from that list if a categorized projection is needed.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/draft-questions-attempt-001.json`
**Requirement:** R6
**Issue:** The same repair target appears in both `repairTargets` and `findings`, duplicating `title`, `target`, `evidence`, and `rationale` with slightly different field names (`classification` vs. `category`, `rationale` vs. `body`).
**Suggestion:** Store the repair target once in `findings` with `category: "repair_target"`, and derive the `repairTargets` view from that list if a categorized projection is needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Add Missing Trailing Newline
**Finding key:** loop-dad54ab3ce2b29c5572c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.md`  
**Requirement:** R8  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline after `No non-blocking improvements.`
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.md`  
**Requirement:** R8  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline after `No non-blocking improvements.`
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Add Missing Trailing Newline
**Finding key:** loop-0b21fe4f73c37f0a8913
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec-review.md
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.md`  
**Requirement:** R8  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline after `No non-blocking improvements.`
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.md`  
**Requirement:** R8  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline after `No non-blocking improvements.`
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Remove duplicated attempt diffs/artifacts if they are not intentional
**Finding key:** loop-0a8f0345042474e349f9
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.md`  
**Requirement:** R6  
**Issue:** The same new-file diff for this artifact appears twice, which suggests the review history output may have been duplicated during generation. Keeping duplicated attempt content makes review history noisier and harder to audit.  
**Suggestion:** Ensure the generation path emits each review-history artifact once, and regenerate this file so the change set contains a single canonical addition.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.md`  
**Requirement:** R6  
**Issue:** The same new-file diff for this artifact appears twice, which suggests the review history output may have been duplicated during generation. Keeping duplicated attempt content makes review history noisier and harder to audit.  
**Suggestion:** Ensure the generation path emits each review-history artifact once, and regenerate this file so the change set contains a single canonical addition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Normalize repeated finding text between JSON and Markdown artifacts
**Finding key:** loop-9f6d39b9df4b59f7f728
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** The finding rationale is duplicated verbatim across `rationale` and `whyBlocking`, and the same finding body is also repeated in `blockingFindings` and `findings`. This increases drift risk between equivalent fields.  
**Suggestion:** Prefer a single canonical finding object and derive the Markdown/rendered fields from it, or keep only semantically distinct fields in JSON if the schema allows it.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** The finding rationale is duplicated verbatim across `rationale` and `whyBlocking`, and the same finding body is also repeated in `blockingFindings` and `findings`. This increases drift risk between equivalent fields.  
**Suggestion:** Prefer a single canonical finding object and derive the Markdown/rendered fields from it, or keep only semantically distinct fields in JSON if the schema allows it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Add trailing newlines to Markdown review artifacts
**Finding key:** loop-b2fd94fa26cb167c8c9e
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.md
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.md`  
**Requirement:** R3  
**Issue:** The file has no trailing newline. This is minor, but inconsistent with common text-file conventions and can cause unnecessary diff churn.  
**Suggestion:** Regenerate or edit the Markdown artifact so it ends with a newline.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.md`  
**Requirement:** R3  
**Issue:** The file has no trailing newline. This is minor, but inconsistent with common text-file conventions and can cause unnecessary diff churn.  
**Suggestion:** Regenerate or edit the Markdown artifact so it ends with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Use structured requirement origins instead of slash-delimited strings
**Finding key:** loop-67da660a7588a9533080
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** `"origin": "R1/R2/R3"` encodes multiple requirement IDs as a display string, which is harder to validate, filter, or aggregate consistently.  
**Suggestion:** Replace it with a structured form such as `"origins": ["R1", "R2", "R3"]`, or otherwise use the same requirement representation used by the surrounding review artifacts.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** `"origin": "R1/R2/R3"` encodes multiple requirement IDs as a display string, which is harder to validate, filter, or aggregate consistently.  
**Suggestion:** Replace it with a structured form such as `"origins": ["R1", "R2", "R3"]`, or otherwise use the same requirement representation used by the surrounding review artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Normalize Markdown file endings
**Finding key:** loop-7ef39c031eb977625c03
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike typical repository text-file formatting conventions.  
**Suggestion:** Add a final newline to keep generated Markdown artifacts formatting-consistent.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike typical repository text-file formatting conventions.  
**Suggestion:** Add a final newline to keep generated Markdown artifacts formatting-consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Remove out-of-scope implementation findings
**Finding key:** loop-0bd1507a9508df1d9f07
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review.md`  
**Requirement:** R6  
**Issue:** The review report includes findings against `src/flow/definition.js` and suggests adding tests under `specs/336-reset-draft-review-artifacts/tests/`, but neither path appears in this change set’s diff. That makes the artifact inconsistent with the stated review scope.  
**Suggestion:** Rewrite or remove those findings so `review.md` only reports issues in files present in this diff, or move them to an excluded/out-of-scope section with accurate counts.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review.md`  
**Requirement:** R6  
**Issue:** The review report includes findings against `src/flow/definition.js` and suggests adding tests under `specs/336-reset-draft-review-artifacts/tests/`, but neither path appears in this change set’s diff. That makes the artifact inconsistent with the stated review scope.  
**Suggestion:** Rewrite or remove those findings so `review.md` only reports issues in files present in this diff, or move them to an excluded/out-of-scope section with accurate counts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Normalize Markdown file endings
**Finding key:** loop-78241a357125deac9cdb
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, creating avoidable formatting inconsistency with other text artifacts.  
**Suggestion:** Add a final newline.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, creating avoidable formatting inconsistency with other text artifacts.  
**Suggestion:** Add a final newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Remove stale duplicate artifact snapshots
**Finding key:** loop-9e377812a924a312f8be
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/scenario-validity-result.json
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/scenario-validity-result.json`
**Requirement:** R7
**Issue:** The diff shows two independent “new file” versions for the same path, with different command coverage and requirement summaries. One version includes R7/R8 and the other stops at R6, which makes the artifact state ambiguous and risks dropping the approval freshness validation evidence.
**Suggestion:** Keep a single canonical `scenario-validity-result.json` entry that reflects the final approved spec scope, including all applicable requirements R1-R8 and the actual command that produced the raw output.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/scenario-validity-result.json`
**Requirement:** R7
**Issue:** The diff shows two independent “new file” versions for the same path, with different command coverage and requirement summaries. One version includes R7/R8 and the other stops at R6, which makes the artifact state ambiguous and risks dropping the approval freshness validation evidence.
**Suggestion:** Keep a single canonical `scenario-validity-result.json` entry that reflects the final approved spec scope, including all applicable requirements R1-R8 and the actual command that produced the raw output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Consolidate spec gate output to one final state
**Finding key:** loop-d31dc339f29139051ea2
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec-gate-source.json
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec-gate-source.json`
**Requirement:** R5
**Issue:** The diff contains two conflicting new versions of the same gate artifact: one reports a `migration-parity` failure with evaluations, while the other reports a different `process:gate-structure` failure with empty evaluations. This duplication makes it unclear which gate result is authoritative.
**Suggestion:** Regenerate or normalize the file so only the latest gate result is committed, with `evaluations` and `observations` describing the same final failure or pass state.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec-gate-source.json`
**Requirement:** R5
**Issue:** The diff contains two conflicting new versions of the same gate artifact: one reports a `migration-parity` failure with evaluations, while the other reports a different `process:gate-structure` failure with empty evaluations. This duplication makes it unclear which gate result is authoritative.
**Suggestion:** Regenerate or normalize the file so only the latest gate result is committed, with `evaluations` and `observations` describing the same final failure or pass state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Avoid committing volatile timestamp-only churn
**Finding key:** loop-1051d8e5f0a8bf7e64de
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec-review.json
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.json`
**Requirement:** R5
**Issue:** The two versions of this file differ only by `generatedAt`. If this artifact is regenerated repeatedly, timestamp-only changes create review noise without changing the spec-review outcome.
**Suggestion:** Either commit only the final generated artifact once, or make the generator preserve/deduplicate unchanged PASS review output when only `generatedAt` changed.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.json`
**Requirement:** R5
**Issue:** The two versions of this file differ only by `generatedAt`. If this artifact is regenerated repeatedly, timestamp-only changes create review noise without changing the spec-review outcome.
**Suggestion:** Either commit only the final generated artifact once, or make the generator preserve/deduplicate unchanged PASS review output when only `generatedAt` changed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Resolve conflicting source-reference policy
**Finding key:** loop-20eadb141ecbd735babd
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec.json`
**Requirement:** R1
**Issue:** The two spec versions disagree on whether PASS replacement should preserve existing `sourceReview`/`sourceTriage` values or regenerate them from `DraftReviewRoute`. That conflict affects R1-R3 behavior and could cause implementation drift.
**Suggestion:** Keep one policy consistently throughout `constraints`, `decisions`, `requirements`, and `acceptance_criteria`. The later expanded version appears more internally consistent: use route-owned `reviewArtifact` and `triageArtifact` as the canonical current-view references.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec.json`
**Requirement:** R1
**Issue:** The two spec versions disagree on whether PASS replacement should preserve existing `sourceReview`/`sourceTriage` values or regenerate them from `DraftReviewRoute`. That conflict affects R1-R3 behavior and could cause implementation drift.
**Suggestion:** Keep one policy consistently throughout `constraints`, `decisions`, `requirements`, and `acceptance_criteria`. The later expanded version appears more internally consistent: use route-owned `reviewArtifact` and `triageArtifact` as the canonical current-view references.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Remove obsolete pre-expansion requirement set
**Finding key:** loop-26c5b184af70f1d3c340
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec.json`
**Requirement:** R8
**Issue:** One version of the spec only defines R1-R6, while another adds R7-R8 for rewind freshness and approval completion. Keeping both snapshots in the diff makes the approved scope unclear and can invalidate downstream review/gate artifacts.
**Suggestion:** Retain only the final spec version that includes R1-R8, updated scope, constraints, acceptance criteria, tasks, and approval notes.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec.json`
**Requirement:** R8
**Issue:** One version of the spec only defines R1-R6, while another adds R7-R8 for rewind freshness and approval completion. Keeping both snapshots in the diff makes the approved scope unclear and can invalidate downstream review/gate artifacts.
**Suggestion:** Retain only the final spec version that includes R1-R8, updated scope, constraints, acceptance criteria, tasks, and approval notes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Remove Stale Render Variant From Diff
**Finding key:** loop-6978788f17f5f6185b6e
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec.md`  
**Requirement:** R7  
**Issue:** The diff shows two different `new file` versions of the same spec, with conflicting scope, requirements, user confirmation time, and task list. This makes the review artifact ambiguous and risks implementing the older R1-R6-only plan instead of the expanded R1-R8 scope.  
**Suggestion:** Keep only the current rendered spec version that includes R7/R8 and the T-2 task, and ensure the submitted diff contains a single creation of `spec.md`.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec.md`  
**Requirement:** R7  
**Issue:** The diff shows two different `new file` versions of the same spec, with conflicting scope, requirements, user confirmation time, and task list. This makes the review artifact ambiguous and risks implementing the older R1-R6-only plan instead of the expanded R1-R8 scope.  
**Suggestion:** Keep only the current rendered spec version that includes R7/R8 and the T-2 task, and ensure the submitted diff contains a single creation of `spec.md`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Align Generated Task Coverage With Expanded Requirements
**Finding key:** loop-310bb3bb8a44b10a37e4
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tasks/T-1.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tasks/T-1.md`  
**Requirement:** R6  
**Issue:** The diff contains two competing versions of `T-1.md`. One requires the actual non-PASS hook, set-step workflow, reopen-draft command, and registry PASS hook; the other simplifies this to stale artifacts retained across rewind and PASS. The simpler version weakens the design pattern consistency promised by R6.  
**Suggestion:** Keep the fuller generated task text that explicitly names the production paths exercised by the tests, so implementation and tests stay aligned with the spec’s behavior-level requirement.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tasks/T-1.md`  
**Requirement:** R6  
**Issue:** The diff contains two competing versions of `T-1.md`. One requires the actual non-PASS hook, set-step workflow, reopen-draft command, and registry PASS hook; the other simplifies this to stale artifacts retained across rewind and PASS. The simpler version weakens the design pattern consistency promised by R6.  
**Suggestion:** Keep the fuller generated task text that explicitly names the production paths exercised by the tests, so implementation and tests stay aligned with the spec’s behavior-level requirement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Regenerate Coverage Artifact From The Final Spec Only
**Finding key:** loop-f1fce8879200acc2d857
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/test-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/test-coverage.json`  
**Requirement:** R8  
**Issue:** `test-coverage.json` also appears in two conflicting generated versions: one covers R1-R8 and includes `approval-rewind-freshness.test.js`, while the other covers only R1-R6. This duplicate generated state can cause stale coverage reporting and hides whether R7/R8 are actually covered.  
**Suggestion:** Regenerate `test-coverage.json` once from the final spec state and keep only the R1-R8 coverage artifact.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/test-coverage.json`  
**Requirement:** R8  
**Issue:** `test-coverage.json` also appears in two conflicting generated versions: one covers R1-R8 and includes `approval-rewind-freshness.test.js`, while the other covers only R1-R6. This duplicate generated state can cause stale coverage reporting and hides whether R7/R8 are actually covered.  
**Suggestion:** Regenerate `test-coverage.json` once from the final spec state and keep only the R1-R8 coverage artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 4. Avoid Persisting Superseded Test Review Results
**Finding key:** loop-94d46808a89b246cd9cb
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/test-review.json
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/test-review.json`  
**Requirement:** R7  
**Issue:** The diff shows both a PASS review and a later ADVISORY review for the same artifact path. Keeping both in the change representation creates naming/state ambiguity around the canonical current review result.  
**Suggestion:** Ensure the committed artifact contains only the latest intended `test-review.json` state. If the ADVISORY is accepted as current, remove the superseded PASS variant from the submitted diff.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/test-review.json`  
**Requirement:** R7  
**Issue:** The diff shows both a PASS review and a later ADVISORY review for the same artifact path. Keeping both in the change representation creates naming/state ambiguity around the canonical current review result.  
**Suggestion:** Ensure the committed artifact contains only the latest intended `test-review.json` state. If the ADVISORY is accepted as current, remove the superseded PASS variant from the submitted diff.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 1. Remove Conflicting Duplicate Diff Content
**Finding key:** loop-076f6ca8737c8953ed57
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/test-review.md
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/test-review.md`
**Requirement:** R5
**Issue:** The diff shows two separate “new file” versions for the same path with conflicting verdicts: one `ADVISORY` with an advisory finding, and one `PASS` with no findings. This makes the artifact history ambiguous and risks reviewers or tooling consuming the wrong review result.
**Suggestion:** Keep only the final intended review artifact content in this file. If the `PASS` result is authoritative, remove the stale advisory version entirely.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/test-review.md`
**Requirement:** R5
**Issue:** The diff shows two separate “new file” versions for the same path with conflicting verdicts: one `ADVISORY` with an advisory finding, and one `PASS` with no findings. This makes the artifact history ambiguous and risks reviewers or tooling consuming the wrong review result.
**Suggestion:** Keep only the final intended review artifact content in this file. If the `PASS` result is authoritative, remove the stale advisory version entirely.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Do Not Commit Failed Scenario Logs As Final Artifacts
**Finding key:** loop-808643cf9f893f80b3b5
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/.raw/scenario-validity.log
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/.raw/scenario-validity.log`
**Requirement:** R5
**Issue:** The committed raw log records failing test runs even though `test-review.md` reports `PASS`. This creates contradictory evidence in the same change set and leaves dead/stale artifact content around.
**Suggestion:** Regenerate this log from the passing final test run, or remove it if raw failed attempts are not intentionally part of the accepted artifact set.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/.raw/scenario-validity.log`
**Requirement:** R5
**Issue:** The committed raw log records failing test runs even though `test-review.md` reports `PASS`. This creates contradictory evidence in the same change set and leaves dead/stale artifact content around.
**Suggestion:** Regenerate this log from the passing final test run, or remove it if raw failed attempts are not intentionally part of the accepted artifact set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Extract Shared Flow Fixture Helpers
**Finding key:** loop-1384565eebe87048cebf
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`
**Requirement:** R7
**Issue:** `stepsAt` duplicates the same helper implementation also introduced in `draft-review-pass-artifacts.test.js`.
**Suggestion:** Since only touched files may be changed, move the shared helper into one touched test-support module only if acceptable in this spec folder, or otherwise rename/localize it to clarify intentional duplication. A small shared helper would reduce drift between the two new suites.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`
**Requirement:** R7
**Issue:** `stepsAt` duplicates the same helper implementation also introduced in `draft-review-pass-artifacts.test.js`.
**Suggestion:** Since only touched files may be changed, move the shared helper into one touched test-support module only if acceptable in this spec folder, or otherwise rename/localize it to clarify intentional duplication. A small shared helper would reduce drift between the two new suites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Extract Shared Flow Fixture Helpers
**Finding key:** loop-9fd4d95ab96b3eea6ce2
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R6
**Issue:** `stepsAt` duplicates the implementation in `approval-rewind-freshness.test.js`, including the same `FLOW_STEPS` lookup and status assignment logic.
**Suggestion:** Reuse a single helper within the touched spec test area so future changes to flow step initialization do not require parallel edits in both files.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R6
**Issue:** `stepsAt` duplicates the implementation in `approval-rewind-freshness.test.js`, including the same `FLOW_STEPS` lookup and status assignment logic.
**Suggestion:** Reuse a single helper within the touched spec test area so future changes to flow step initialization do not require parallel edits in both files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Reduce Repeated Sequence Execution
**Finding key:** loop-26e5ebd910027cf95c5c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R6
**Issue:** `runInvalidatedAttemptSequence("questions")` is executed independently in R1, R2, R4, R5, and R6, and coverage is also repeated several times. This makes the suite slower and duplicates setup-heavy lifecycle coverage.
**Suggestion:** Combine related assertions per route into table-driven subtests or a shared per-test route assertion helper so each route sequence is exercised fewer times while still keeping requirement-specific assertions clear.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R6
**Issue:** `runInvalidatedAttemptSequence("questions")` is executed independently in R1, R2, R4, R5, and R6, and coverage is also repeated several times. This makes the suite slower and duplicates setup-heavy lifecycle coverage.
**Suggestion:** Combine related assertions per route into table-driven subtests or a shared per-test route assertion helper so each route sequence is exercised fewer times while still keeping requirement-specific assertions clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 6. Replace Stringified Artifact Search With Direct Assertions
**Finding key:** loop-f8afb5e46a77c1d0ed6c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R4
**Issue:** `JSON.stringify(sequence.afterPass).includes("stale")` is a broad string scan that can produce false positives if unrelated metadata later contains the word `stale`.
**Suggestion:** Assert directly on the current artifact item arrays, for example `triage.items` and `repair.items`, and on relevant finding fields if needed.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R4
**Issue:** `JSON.stringify(sequence.afterPass).includes("stale")` is a broad string scan that can produce false positives if unrelated metadata later contains the word `stale`.
**Suggestion:** Assert directly on the current artifact item arrays, for example `triage.items` and `repair.items`, and on relevant finding fields if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 7. Give Fixture Source Names More Precise Names
**Finding key:** loop-24855d69f9e0faca72c2
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R1
**Issue:** `existingSourceReview` and `existingSourceTriage` are named as generic existing sources, but they specifically represent intentionally stale retained artifacts from before rewind.
**Suggestion:** Rename them to `staleSourceReview` and `staleSourceTriage`, or similar, to make the test intent clearer at assertion sites.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`
**Requirement:** R1
**Issue:** `existingSourceReview` and `existingSourceTriage` are named as generic existing sources, but they specifically represent intentionally stale retained artifacts from before rewind.
**Suggestion:** Rename them to `staleSourceReview` and `staleSourceTriage`, or similar, to make the test intent clearer at assertion sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 1. Replace Artifact Classes With a Shared Factory
**Finding key:** loop-5dd08465daccc7c79ca0
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R1
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R1  
**Issue:** `EmptyDraftReviewTriageArtifact` and `EmptyDraftReviewRepairArtifact` are almost identical data containers. The class form adds ceremony without behavior, and the duplicated constructor structure makes future changes to the canonical empty artifact shape easier to miss.  
**Suggestion:** Use a small shared factory/helper for empty draft review artifacts, with route-specific fields supplied as parameters. This would keep the overwrite semantics while reducing duplication.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R1  
**Issue:** `EmptyDraftReviewTriageArtifact` and `EmptyDraftReviewRepairArtifact` are almost identical data containers. The class form adds ceremony without behavior, and the duplicated constructor structure makes future changes to the canonical empty artifact shape easier to miss.  
**Suggestion:** Use a small shared factory/helper for empty draft review artifacts, with route-specific fields supplied as parameters. This would keep the overwrite semantics while reducing duplication.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 2. Remove Unused Occurrence Field
**Finding key:** loop-7449d93428f72832b1bd
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.occurredAt` is assigned but never read. The freshness check only uses `epochMilliseconds`, so the normalized ISO string is currently dead state.  
**Suggestion:** Either remove `occurredAt` from the class entirely, or use it meaningfully in diagnostics if the timestamp needs to be preserved for error reporting.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.occurredAt` is assigned but never read. The freshness check only uses `epochMilliseconds`, so the normalized ISO string is currently dead state.  
**Suggestion:** Either remove `occurredAt` from the class entirely, or use it meaningfully in diagnostics if the timestamp needs to be preserved for error reporting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 3. Simplify Timestamp Wrapper
**Finding key:** loop-cef8a1429baf035e542e
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R8  
**Issue:** `PlanRewindOccurrence` wraps only one active value and one comparison method. That may be heavier than the surrounding procedural style in this module, especially since malformed records already fail closed through `null`.  
**Suggestion:** Consider replacing the class with a focused helper such as `planRewindOccurrenceEpochMilliseconds(record)`, returning a finite number or `null`. Then `isPlanEvidenceFresh` can compare directly while preserving the fail-closed behavior.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R8  
**Issue:** `PlanRewindOccurrence` wraps only one active value and one comparison method. That may be heavier than the surrounding procedural style in this module, especially since malformed records already fail closed through `null`.  
**Suggestion:** Consider replacing the class with a focused helper such as `planRewindOccurrenceEpochMilliseconds(record)`, returning a finite number or `null`. Then `isPlanEvidenceFresh` can compare directly while preserving the fail-closed behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 1. Canonicalize Duplicate Artifact Snapshots
**Finding key:** loop-e17f2dfa82dd661b238a
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec.json`
**Requirement:** R8
**Issue:** Multiple summaries report duplicate or conflicting “new file” versions across `spec.json`, `spec.md`, `draft.json`, `flow.json`, `impl-review.json`, `test-review.json`, `scenario-validity-result.json`, and related generated artifacts. This is a cross-file artifact lifecycle problem: reviewers and tools cannot know which generated state is authoritative.
**Suggestion:** Regenerate the artifact set from the final approved R1-R8 spec state and ensure each artifact path appears once, with prior attempts stored only in explicit history/archive files if needed.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec.json`
**Requirement:** R8
**Issue:** Multiple summaries report duplicate or conflicting “new file” versions across `spec.json`, `spec.md`, `draft.json`, `flow.json`, `impl-review.json`, `test-review.json`, `scenario-validity-result.json`, and related generated artifacts. This is a cross-file artifact lifecycle problem: reviewers and tools cannot know which generated state is authoritative.
**Suggestion:** Regenerate the artifact set from the final approved R1-R8 spec state and ensure each artifact path appears once, with prior attempts stored only in explicit history/archive files if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 2. Normalize Generated Artifact Metadata
**Finding key:** loop-4c77fc890a34f5eabe22
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-questions-triage.json
**Requirement:** R2
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`
**Requirement:** R2
**Issue:** `generatedAt` appears inconsistently across sibling triage, repair, review, and evidence artifacts. Some files include it, while others omit it or differ only by timestamp-only churn.
**Suggestion:** Define one metadata contract for generated review artifacts. Either require `generatedAt` everywhere with stable formatting, or remove/preserve it consistently when content is otherwise unchanged.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`
**Requirement:** R2
**Issue:** `generatedAt` appears inconsistently across sibling triage, repair, review, and evidence artifacts. Some files include it, while others omit it or differ only by timestamp-only churn.
**Suggestion:** Define one metadata contract for generated review artifacts. Either require `generatedAt` everywhere with stable formatting, or remove/preserve it consistently when content is otherwise unchanged.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 3. Unify Finding And Repair Target Representations
**Finding key:** loop-ff7b99dec7b974c795a0
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`
**Requirement:** R6
**Issue:** Several artifacts duplicate the same finding data across `findings`, `blockingFindings`, `repairTargets`, `advisoryFindings`, and parallel fields like `id`/`findingId`, `rationale`/`body`, and `classification`/`category`. This creates interface drift between JSON history, current review artifacts, and rendered Markdown.
**Suggestion:** Store one canonical finding object shape and derive category-specific views or Markdown output from it. Keep distinct fields only when they represent distinct concepts.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`
**Requirement:** R6
**Issue:** Several artifacts duplicate the same finding data across `findings`, `blockingFindings`, `repairTargets`, `advisoryFindings`, and parallel fields like `id`/`findingId`, `rationale`/`body`, and `classification`/`category`. This creates interface drift between JSON history, current review artifacts, and rendered Markdown.
**Suggestion:** Store one canonical finding object shape and derive category-specific views or Markdown output from it. Keep distinct fields only when they represent distinct concepts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 4. Use Structured Requirement References Consistently
**Finding key:** loop-7486b7245e3339d71eb2
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json`
**Requirement:** R1
**Issue:** Requirement references are represented inconsistently: most artifacts use explicit `Requirement: Rn` or `requirementId`, while one artifact encodes multiple IDs as `"origin": "R1/R2/R3"`. That makes validation and aggregation harder across the artifact set.
**Suggestion:** Replace slash-delimited strings with structured arrays such as `"requirementIds": ["R1", "R2", "R3"]`, aligned with the surrounding schema.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json`
**Requirement:** R1
**Issue:** Requirement references are represented inconsistently: most artifacts use explicit `Requirement: Rn` or `requirementId`, while one artifact encodes multiple IDs as `"origin": "R1/R2/R3"`. That makes validation and aggregation harder across the artifact set.
**Suggestion:** Replace slash-delimited strings with structured arrays such as `"requirementIds": ["R1", "R2", "R3"]`, aligned with the surrounding schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 5. Share Empty Artifact Generation Logic
**Finding key:** loop-f384faef219e874ef94f
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R4
**Issue:** Empty triage and repair artifacts duplicate the same shape in both implementation classes and generated JSON outputs. The same boilerplate is noted across `draft-coverage-triage.json`, `draft-coverage-repair.json`, and the implementation containers.
**Suggestion:** Introduce a shared empty-artifact factory/helper used by both routes, parameterized by phase and source artifact field, so generated output stays consistent.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R4
**Issue:** Empty triage and repair artifacts duplicate the same shape in both implementation classes and generated JSON outputs. The same boilerplate is noted across `draft-coverage-triage.json`, `draft-coverage-repair.json`, and the implementation containers.
**Suggestion:** Introduce a shared empty-artifact factory/helper used by both routes, parameterized by phase and source artifact field, so generated output stays consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 6. Extract Shared Test Flow Fixture Helper
**Finding key:** loop-34f04d60e2a8c70fe668
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`
**Requirement:** R7
**Issue:** The `stepsAt` helper is introduced independently in both `approval-rewind-freshness.test.js` and `draft-review-pass-artifacts.test.js` with the same `FLOW_STEPS` lookup and status setup behavior.
**Suggestion:** Move the helper into shared test support within the spec test area, or intentionally localize and rename it if duplication is required.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`
**Requirement:** R7
**Issue:** The `stepsAt` helper is introduced independently in both `approval-rewind-freshness.test.js` and `draft-review-pass-artifacts.test.js` with the same `FLOW_STEPS` lookup and status setup behavior.
**Suggestion:** Move the helper into shared test support within the spec test area, or intentionally localize and rename it if duplication is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 7. Normalize Human-Reviewed Artifact Formatting
**Finding key:** loop-94f40c127dbc2353573a
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/9cee522c4db1b6b03d2cffd9655fccbc8257e01eef808218274f7918fde056bf.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/9cee522c4db1b6b03d2cffd9655fccbc8257e01eef808218274f7918fde056bf.json`
**Requirement:** R8
**Issue:** Formatting varies across generated evidence and Markdown artifacts: several JSON evidence files are minified, while multiple Markdown history files lack trailing newlines. This creates noisy diffs and inconsistent review ergonomics across the same artifact family.
**Suggestion:** Apply one formatter policy for generated artifacts: pretty-printed stable JSON for review evidence and trailing newlines for Markdown outputs.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/9cee522c4db1b6b03d2cffd9655fccbc8257e01eef808218274f7918fde056bf.json`
**Requirement:** R8
**Issue:** Formatting varies across generated evidence and Markdown artifacts: several JSON evidence files are minified, while multiple Markdown history files lack trailing newlines. This creates noisy diffs and inconsistent review ergonomics across the same artifact family.
**Suggestion:** Apply one formatter policy for generated artifacts: pretty-printed stable JSON for review evidence and trailing newlines for Markdown outputs.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
