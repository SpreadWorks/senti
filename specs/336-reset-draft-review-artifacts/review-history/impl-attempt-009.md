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

### 10. 1. Remove Duplicate File Snapshots
**Finding key:** loop-ca234306bd7ce5467317
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R1  
**Issue:** The diff contains two separate `new file` snapshots for the same `flow.json`, one very large and one shorter, which makes the intended canonical state ambiguous and creates review noise.  
**Suggestion:** Keep only the final intended `flow.json` content in the change set and remove the stale duplicate snapshot before committing.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R1  
**Issue:** The diff contains two separate `new file` snapshots for the same `flow.json`, one very large and one shorter, which makes the intended canonical state ambiguous and creates review noise.  
**Suggestion:** Keep only the final intended `flow.json` content in the change set and remove the stale duplicate snapshot before committing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Bound Runtime History Growth
**Finding key:** loop-96f6385eefae682f637f
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R4  
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, and nested `evidenceHistory` can grow without an explicit cap, which conflicts with the `bounded-resource-usage` guardrail for persisted runtime state.  
**Suggestion:** Persist only bounded current-state data in `flow.json`, such as latest record per phase/task plus a capped history count, and archive older entries separately if audit retention is required.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`  
**Requirement:** R4  
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, and nested `evidenceHistory` can grow without an explicit cap, which conflicts with the `bounded-resource-usage` guardrail for persisted runtime state.  
**Suggestion:** Persist only bounded current-state data in `flow.json`, such as latest record per phase/task plus a capped history count, and archive older entries separately if audit retention is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Remove Duplicate Issue Log Snapshot
**Finding key:** loop-0be8735370359ecd817e
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue-log.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue-log.json`  
**Requirement:** R1  
**Issue:** The diff adds two versions of the same `issue-log.json`, with the later one truncating many entries from the earlier one. This makes it unclear whether the longer audit trail or shorter log is intended.  
**Suggestion:** Collapse the diff to one canonical `issue-log.json` version and ensure it contains only the entries intentionally retained for this change.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue-log.json`  
**Requirement:** R1  
**Issue:** The diff adds two versions of the same `issue-log.json`, with the later one truncating many entries from the earlier one. This makes it unclear whether the longer audit trail or shorter log is intended.  
**Suggestion:** Collapse the diff to one canonical `issue-log.json` version and ensure it contains only the entries intentionally retained for this change.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Add Missing Trailing Newline
**Finding key:** loop-fe64e26eebcc1c20a222
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue.md
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R5  
**Issue:** The markdown file ends without a trailing newline.  
**Suggestion:** Add a trailing newline to keep text artifact formatting consistent with normal repository conventions.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R5  
**Issue:** The markdown file ends without a trailing newline.  
**Suggestion:** Add a trailing newline to keep text artifact formatting consistent with normal repository conventions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 5. Avoid Full English Duplication In Localized Section
**Finding key:** loop-31c88d99e0332d4a53e8
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue.md
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R5  
**Issue:** The `<details>` Japanese section repeats the full English issue text instead of providing a distinct localized summary, doubling maintenance cost.  
**Suggestion:** Either translate the content in that section or remove the duplicated English body and keep a concise Japanese summary that points to the canonical English sections above.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R5  
**Issue:** The `<details>` Japanese section repeats the full English issue text instead of providing a distinct localized summary, doubling maintenance cost.  
**Suggestion:** Either translate the content in that section or remove the duplicated English body and keep a concise Japanese summary that points to the canonical English sections above.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Normalize Review Evidence Formatting
**Finding key:** loop-4ce5d4f8a470c68764b3
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json`  
**Requirement:** R6  
**Issue:** The JSON artifact is committed as a single long line, which makes future diffs noisy and obscures changes to individual findings, provenance fields, or disposition.  
**Suggestion:** Pretty-print the JSON with stable indentation and key ordering consistent with the project’s other review artifacts, if any, before committing generated evidence files.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json`  
**Requirement:** R6  
**Issue:** The JSON artifact is committed as a single long line, which makes future diffs noisy and obscures changes to individual findings, provenance fields, or disposition.  
**Suggestion:** Pretty-print the JSON with stable indentation and key ordering consistent with the project’s other review artifacts, if any, before committing generated evidence files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Normalize Review Evidence Formatting
**Finding key:** loop-71a78c67a15a016c1201
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/c008c7d7d899bf5889b7c9fb1af14e43bb584f88062893e479d9e38bc15d322a.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c008c7d7d899bf5889b7c9fb1af14e43bb584f88062893e479d9e38bc15d322a.json`  
**Requirement:** R6  
**Issue:** The JSON artifact is committed as a single long line, reducing readability and making small future updates hard to review.  
**Suggestion:** Format the JSON with deterministic indentation and key ordering so future diffs isolate the actual changed fields.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c008c7d7d899bf5889b7c9fb1af14e43bb584f88062893e479d9e38bc15d322a.json`  
**Requirement:** R6  
**Issue:** The JSON artifact is committed as a single long line, reducing readability and making small future updates hard to review.  
**Suggestion:** Format the JSON with deterministic indentation and key ordering so future diffs isolate the actual changed fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Normalize Review Evidence Formatting
**Finding key:** loop-c86e36ca13c511f6e6fc
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/c42b7f8a9926883f864f8e385a148930ee8b9467f859dc316db5ef4ceaf001c7.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c42b7f8a9926883f864f8e385a148930ee8b9467f859dc316db5ef4ceaf001c7.json`  
**Requirement:** R6  
**Issue:** The one-line JSON representation makes the artifact harder to inspect and compare against related review evidence files.  
**Suggestion:** Pretty-print this artifact using the same deterministic formatter applied to the other review evidence JSON files.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/c42b7f8a9926883f864f8e385a148930ee8b9467f859dc316db5ef4ceaf001c7.json`  
**Requirement:** R6  
**Issue:** The one-line JSON representation makes the artifact harder to inspect and compare against related review evidence files.  
**Suggestion:** Pretty-print this artifact using the same deterministic formatter applied to the other review evidence JSON files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 4. Normalize Review Evidence Formatting
**Finding key:** loop-3ba9de1efc529607d7cd
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/d0249556e7f0455e4c3f19f23903738a0a903fe375ab306965105fa3a5e0e970.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/d0249556e7f0455e4c3f19f23903738a0a903fe375ab306965105fa3a5e0e970.json`  
**Requirement:** R6  
**Issue:** Even though this artifact has no findings, its one-line JSON format is inconsistent with review-friendly evidence storage and will produce poor diffs if metadata changes.  
**Suggestion:** Store the JSON in a stable pretty-printed format, matching the formatting convention used for the other evidence artifacts.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/d0249556e7f0455e4c3f19f23903738a0a903fe375ab306965105fa3a5e0e970.json`  
**Requirement:** R6  
**Issue:** Even though this artifact has no findings, its one-line JSON format is inconsistent with review-friendly evidence storage and will produce poor diffs if metadata changes.  
**Suggestion:** Store the JSON in a stable pretty-printed format, matching the formatting convention used for the other evidence artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Add the missing file reference to the second implementation finding
**Finding key:** loop-ae3a30f82ee16d43571d
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.md`  
**Requirement:** R6  
**Issue:** The second blocking finding omits a `**File:** ...` line, while the first finding includes one. This makes the Markdown artifact inconsistent and less useful for downstream review consumers that expect every finding to identify a concrete file.  
**Suggestion:** Add `**File:** specs/336-reset-draft-review-artifacts/tests/<test-file>.js` if the missing coverage should point to the absent test artifact location, or another touched/in-scope path if the project convention requires existing files only.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.md`  
**Requirement:** R6  
**Issue:** The second blocking finding omits a `**File:** ...` line, while the first finding includes one. This makes the Markdown artifact inconsistent and less useful for downstream review consumers that expect every finding to identify a concrete file.  
**Suggestion:** Add `**File:** specs/336-reset-draft-review-artifacts/tests/<test-file>.js` if the missing coverage should point to the absent test artifact location, or another touched/in-scope path if the project convention requires existing files only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Add the missing `file` field to the matching JSON finding
**Finding key:** loop-ffc214627e52be7d80e7
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`  
**Requirement:** R6  
**Issue:** The `missing-behavior-sequence-tests` entry in `blockingFindings` has no `file` field, unlike the first blocking finding. The normalized `findings` entry also lacks an equivalent file reference, creating inconsistent schema shape for findings in the same artifact.  
**Suggestion:** Include a file target for this finding in both `blockingFindings[]` and `findings[]`, using the same path chosen for the Markdown artifact so JSON and Markdown remain aligned.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`  
**Requirement:** R6  
**Issue:** The `missing-behavior-sequence-tests` entry in `blockingFindings` has no `file` field, unlike the first blocking finding. The normalized `findings` entry also lacks an equivalent file reference, creating inconsistent schema shape for findings in the same artifact.  
**Suggestion:** Include a file target for this finding in both `blockingFindings[]` and `findings[]`, using the same path chosen for the Markdown artifact so JSON and Markdown remain aligned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Remove duplicated review-history artifacts from the change set
**Finding key:** loop-d8c4a6652fd42c45397f
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.json`  
**Requirement:** R1  
**Issue:** The diff shows the same new file block twice with identical content. Even if this is a diff-generation artifact, the review history is being represented redundantly in the submitted change, which makes the change harder to inspect and can mask real artifact differences.  
**Suggestion:** Ensure each review-history artifact appears only once in the patch output/change set before submission.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.json`  
**Requirement:** R1  
**Issue:** The diff shows the same new file block twice with identical content. Even if this is a diff-generation artifact, the review history is being represented redundantly in the submitted change, which makes the change harder to inspect and can mask real artifact differences.  
**Suggestion:** Ensure each review-history artifact appears only once in the patch output/change set before submission.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Add trailing newlines to markdown artifacts
**Finding key:** loop-e84a71e5d3fae8c4377c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file is missing a trailing newline. This creates unnecessary formatter noise and is inconsistent with typical repository text-file conventions.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file is missing a trailing newline. This creates unnecessary formatter noise and is inconsistent with typical repository text-file conventions.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Add trailing newlines to markdown artifacts
**Finding key:** loop-4f3f717c7a11b07405a8
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec-review.md
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.md`  
**Requirement:** R1  
**Issue:** The markdown file is missing a trailing newline. This creates unnecessary formatter noise and is inconsistent with typical repository text-file conventions.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.md`  
**Requirement:** R1  
**Issue:** The markdown file is missing a trailing newline. This creates unnecessary formatter noise and is inconsistent with typical repository text-file conventions.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 4. Avoid duplicating finding details across JSON fields
**Finding key:** loop-73dbf2a43081a8d1265f
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** Each finding is duplicated in both `blockingFindings` and `findings`, with repeated IDs, titles, rationale/body text, and metadata. This increases artifact size and creates consistency risk if one representation is later changed independently.  
**Suggestion:** Prefer one canonical findings array plus derived counts/grouping, or make `blockingFindings` contain only references to canonical finding IDs if both views are required.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** Each finding is duplicated in both `blockingFindings` and `findings`, with repeated IDs, titles, rationale/body text, and metadata. This increases artifact size and creates consistency risk if one representation is later changed independently.  
**Suggestion:** Prefer one canonical findings array plus derived counts/grouping, or make `blockingFindings` contain only references to canonical finding IDs if both views are required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Add trailing newline to test review markdown artifact
**Finding key:** loop-b8f741082746e1b1bf5c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file is missing a trailing newline, producing avoidable diff noise.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file is missing a trailing newline, producing avoidable diff noise.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Remove duplicated finding payloads
**Finding key:** loop-fdae8f31fead98534b0b
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** The same finding details are duplicated across `blockingFindings` and `findings`, including title, rationale, fingerprint, disposition, and issue/body text. This makes the artifact harder to maintain and creates drift risk if one copy changes without the other.  
**Suggestion:** Prefer a single canonical `findings` array and derive `blockingFindings` from `severity`/`kind`, or reduce `blockingFindings` to references such as finding IDs if the schema requires that section.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** The same finding details are duplicated across `blockingFindings` and `findings`, including title, rationale, fingerprint, disposition, and issue/body text. This makes the artifact harder to maintain and creates drift risk if one copy changes without the other.  
**Suggestion:** Prefer a single canonical `findings` array and derive `blockingFindings` from `severity`/`kind`, or reduce `blockingFindings` to references such as finding IDs if the schema requires that section.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Add trailing newline
**Finding key:** loop-af0aa09304ef6405a446
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.md
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.md`  
**Requirement:** R3  
**Issue:** The markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can cause noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.md`  
**Requirement:** R3  
**Issue:** The markdown file has no trailing newline, which is inconsistent with typical repository text-file formatting and can cause noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Remove duplicated finding payloads
**Finding key:** loop-4a947ea248ff86d895e8
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** The finding content is repeated in both `blockingFindings` and `findings`, with slightly different field names such as `issue` vs `body` and `kind` vs `severity`. This adds avoidable duplication and weakens consistency.  
**Suggestion:** Store the complete finding once, then represent blocking summaries as IDs or generated views from the canonical finding entry.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** The finding content is repeated in both `blockingFindings` and `findings`, with slightly different field names such as `issue` vs `body` and `kind` vs `severity`. This adds avoidable duplication and weakens consistency.  
**Suggestion:** Store the complete finding once, then represent blocking summaries as IDs or generated views from the canonical finding entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Add trailing newline
**Finding key:** loop-0f4584bd50e04ace62f8
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.md
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, creating unnecessary formatting inconsistency.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, creating unnecessary formatting inconsistency.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Remove duplicated diff entry for test attempt JSON
**Finding key:** loop-646565c019f1dfe6e5d4
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.json
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.json`
**Requirement:** R5
**Issue:** The same new-file diff appears twice with identical content, which adds review noise and makes the change set look larger than it is.
**Suggestion:** Ensure the artifact is emitted or staged once so the diff contains a single `test-attempt-004.json` addition.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.json`
**Requirement:** R5
**Issue:** The same new-file diff appears twice with identical content, which adds review noise and makes the change set look larger than it is.
**Suggestion:** Ensure the artifact is emitted or staged once so the diff contains a single `test-attempt-004.json` addition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Remove duplicated diff entry for test attempt Markdown
**Finding key:** loop-1944abc6b0adace6e385
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`
**Requirement:** R5
**Issue:** The Markdown artifact is also shown twice with identical content.
**Suggestion:** Deduplicate the generated or staged artifact so only one addition appears in the diff.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`
**Requirement:** R5
**Issue:** The Markdown artifact is also shown twice with identical content.
**Suggestion:** Deduplicate the generated or staged artifact so only one addition appears in the diff.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Add trailing newline to Markdown artifact
**Finding key:** loop-8d2ccefedc5ae566420c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`
**Requirement:** R5
**Issue:** The file ends without a newline, which is inconsistent with standard text-file formatting and can create unnecessary future diffs.
**Suggestion:** Add a final newline after `No advisory findings.`.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`
**Requirement:** R5
**Issue:** The file ends without a newline, which is inconsistent with standard text-file formatting and can create unnecessary future diffs.
**Suggestion:** Add a final newline after `No advisory findings.`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 4. Avoid repeated command strings in scenario evidence
**Finding key:** loop-a1c37fbab753fde64cf0
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/scenario-validity-result.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/scenario-validity-result.json`
**Requirement:** R6
**Issue:** The same long test command is repeated in the top-level `command` field and again in every `summary[].evidence.command`, creating duplicated data that can drift.
**Suggestion:** Keep the command at the top level and omit per-entry duplicate `evidence.command`, or replace it with a stable reference if the schema requires command provenance.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/scenario-validity-result.json`
**Requirement:** R6
**Issue:** The same long test command is repeated in the top-level `command` field and again in every `summary[].evidence.command`, creating duplicated data that can drift.
**Suggestion:** Keep the command at the top level and omit per-entry duplicate `evidence.command`, or replace it with a stable reference if the schema requires command provenance.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 5. Avoid repeated raw output line ranges
**Finding key:** loop-961bd9ae0566b03acc20
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/scenario-validity-result.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/scenario-validity-result.json`
**Requirement:** R6
**Issue:** Every summary entry repeats the same `raw_output_lines` range, adding bulk without extra information.
**Suggestion:** Move the shared range to a top-level field when all requirements reference the same raw output span, or only include per-entry ranges when they differ.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/scenario-validity-result.json`
**Requirement:** R6
**Issue:** Every summary entry repeats the same `raw_output_lines` range, adding bulk without extra information.
**Suggestion:** Move the shared range to a top-level field when all requirements reference the same raw output span, or only include per-entry ranges when they differ.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 6. Consolidate duplicated guardrail finding data
**Finding key:** loop-66b18b48b0e3c583e6c0
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec-gate-source.json
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec-gate-source.json`
**Requirement:** R5
**Issue:** The same migration-parity violation is represented under both `evaluations[].observations[]` and top-level `observations[]`, with nearly identical fields but different `findingId` / `fingerprint` values. That duplication makes artifact consumers choose between two identities for the same finding.
**Suggestion:** Store the canonical finding once and reference it from the evaluation, or ensure both locations use the same stable finding identity if the schema requires both views.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec-gate-source.json`
**Requirement:** R5
**Issue:** The same migration-parity violation is represented under both `evaluations[].observations[]` and top-level `observations[]`, with nearly identical fields but different `findingId` / `fingerprint` values. That duplication makes artifact consumers choose between two identities for the same finding.
**Suggestion:** Store the canonical finding once and reference it from the evaluation, or ensure both locations use the same stable finding identity if the schema requires both views.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Remove stale duplicate spec-review entry from the change set
**Finding key:** loop-3a724175f7f98336b362
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec-review.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.json`
**Requirement:** R8
**Issue:** The diff shows the same new file added twice with different `generatedAt` values. Keeping multiple generated variants in one change set makes the review artifact ambiguous and creates avoidable churn.
**Suggestion:** Regenerate or keep only the latest `spec-review.json` content so the diff contains a single canonical version.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec-review.json`
**Requirement:** R8
**Issue:** The diff shows the same new file added twice with different `generatedAt` values. Keeping multiple generated variants in one change set makes the review artifact ambiguous and creates avoidable churn.
**Suggestion:** Regenerate or keep only the latest `spec-review.json` content so the diff contains a single canonical version.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Remove empty placeholder sections
**Finding key:** loop-1bc6b00fdd5b9ad364df
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec.md`
**Requirement:** R6
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholder content and make the rendered spec look incomplete.
**Suggestion:** Remove those sections when empty, or populate them with real targets/questions before committing.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec.md`
**Requirement:** R6
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholder content and make the rendered spec look incomplete.
**Suggestion:** Remove those sections when empty, or populate them with real targets/questions before committing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Deduplicate module ownership bullets
**Finding key:** loop-a14d44b1f0587c5ff047
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec.md`
**Requirement:** R1
**Issue:** The Overview Modules section lists `src/flow/definition.js` twice for closely related ownership of PASS lifecycle and empty artifact writing, and `src/flow/lib/plan-rewind.js` twice for freshness normalization. This repeats ownership information without adding much distinction.
**Suggestion:** Merge each pair into a single concise bullet per file, preserving the added task-specific detail.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec.md`
**Requirement:** R1
**Issue:** The Overview Modules section lists `src/flow/definition.js` twice for closely related ownership of PASS lifecycle and empty artifact writing, and `src/flow/lib/plan-rewind.js` twice for freshness normalization. This repeats ownership information without adding much distinction.
**Suggestion:** Merge each pair into a single concise bullet per file, preserving the added task-specific detail.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 4. Keep generated task text in sync with the canonical spec
**Finding key:** loop-676f6d3eb5eac3097d2c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tasks/T-1.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tasks/T-1.md`
**Requirement:** R6
**Issue:** The diff shows two generated versions of `T-1.md` with different Test Strategy text. One version exercises the actual non-PASS review post hook and set-step workflow, while the other is weaker and less aligned with the final R6 wording.
**Suggestion:** Re-render `T-1.md` from the final `spec.json` and keep only the version that matches the canonical R6 test strategy.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tasks/T-1.md`
**Requirement:** R6
**Issue:** The diff shows two generated versions of `T-1.md` with different Test Strategy text. One version exercises the actual non-PASS review post hook and set-step workflow, while the other is weaker and less aligned with the final R6 wording.
**Suggestion:** Re-render `T-1.md` from the final `spec.json` and keep only the version that matches the canonical R6 test strategy.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Remove Conflicting Duplicate Artifact Versions
**Finding key:** loop-e0bd4beeb3eea1b22d6a
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/test-coverage.json
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/test-coverage.json`  
**Requirement:** R7  
**Issue:** The diff shows two different new versions of the same coverage artifact: one includes R7/R8 and `approval-rewind-freshness.test.js`, while the other only includes R1-R6. This makes the intended artifact state ambiguous and can silently drop approval rewind coverage evidence.  
**Suggestion:** Keep a single canonical `test-coverage.json` version. If R7/R8 are in scope for this change set, retain the 116-line version; otherwise remove all R7/R8 references consistently from the review artifacts and raw logs.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/test-coverage.json`  
**Requirement:** R7  
**Issue:** The diff shows two different new versions of the same coverage artifact: one includes R7/R8 and `approval-rewind-freshness.test.js`, while the other only includes R1-R6. This makes the intended artifact state ambiguous and can silently drop approval rewind coverage evidence.  
**Suggestion:** Keep a single canonical `test-coverage.json` version. If R7/R8 are in scope for this change set, retain the 116-line version; otherwise remove all R7/R8 references consistently from the review artifacts and raw logs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Keep Review Verdict Artifacts Consistent
**Finding key:** loop-bde09f067f4e642a9df8
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/test-review.json
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/test-review.json`  
**Requirement:** R7  
**Issue:** The diff contains both an `ADVISORY` and a `PASS` version of the same `test-review.json`. The advisory version references an R7 improvement, while the pass version reports no findings. This duplicated artifact state is inconsistent with the paired markdown review output.  
**Suggestion:** Emit only one review result. If the out-of-order rewind boundary is still a valid advisory, keep the advisory JSON and matching markdown; otherwise remove the stale advisory version entirely.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/test-review.json`  
**Requirement:** R7  
**Issue:** The diff contains both an `ADVISORY` and a `PASS` version of the same `test-review.json`. The advisory version references an R7 improvement, while the pass version reports no findings. This duplicated artifact state is inconsistent with the paired markdown review output.  
**Suggestion:** Emit only one review result. If the out-of-order rewind boundary is still a valid advisory, keep the advisory JSON and matching markdown; otherwise remove the stale advisory version entirely.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Avoid Stale Generated Review Markdown
**Finding key:** loop-96664ae7af1f3fdc8260
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/test-review.md
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/test-review.md`  
**Requirement:** R7  
**Issue:** The markdown review artifact also appears in two conflicting forms: `ADVISORY` with an R7 recommendation and `PASS` with no findings. This duplicates the same generated report and makes downstream consumers unable to determine the authoritative review result.  
**Suggestion:** Regenerate `test-review.md` from the final selected `test-review.json` so the verdict, findings, and coverage reference match exactly.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/test-review.md`  
**Requirement:** R7  
**Issue:** The markdown review artifact also appears in two conflicting forms: `ADVISORY` with an R7 recommendation and `PASS` with no findings. This duplicates the same generated report and makes downstream consumers unable to determine the authoritative review result.  
**Suggestion:** Regenerate `test-review.md` from the final selected `test-review.json` so the verdict, findings, and coverage reference match exactly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 4. Replace Raw Failure Log With Current Evidence Only
**Finding key:** loop-76eb8a771c6ae5c203be
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/.raw/scenario-validity.log
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** The raw scenario log contains failing TAP output, including earlier failures for `approval-rewind-freshness.test.js` in one version and only `draft-review-pass-artifacts.test.js` in another. Keeping obsolete failure logs alongside PASS/ADVISORY review artifacts creates dead evidence and conflicting status.  
**Suggestion:** Re-run the final intended scenario-validity command once and commit only the resulting current log. If tests now pass, replace this file with the passing output; if they still fail, ensure the review verdict reflects that failure.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** The raw scenario log contains failing TAP output, including earlier failures for `approval-rewind-freshness.test.js` in one version and only `draft-review-pass-artifacts.test.js` in another. Keeping obsolete failure logs alongside PASS/ADVISORY review artifacts creates dead evidence and conflicting status.  
**Suggestion:** Re-run the final intended scenario-validity command once and commit only the resulting current log. If tests now pass, replace this file with the passing output; if they still fail, ensure the review verdict reflects that failure.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 3. Deduplicate `stepsAt()` Test Helper
**Finding key:** loop-54fabf4b75f0ea5d3acd
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`  
**Requirement:** R7  
**Issue:** `stepsAt(activeStepId)` is duplicated almost exactly in both new test files. This adds maintenance friction if flow step initialization behavior changes.  
**Suggestion:** Extract the helper into a small local test utility under the same touched spec test area, or import an existing helper if one already exists. Since the scope is limited to touched files, the cleanest option within this changeset is to add a shared helper export in one touched test support file only if project conventions allow it.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`  
**Requirement:** R7  
**Issue:** `stepsAt(activeStepId)` is duplicated almost exactly in both new test files. This adds maintenance friction if flow step initialization behavior changes.  
**Suggestion:** Extract the helper into a small local test utility under the same touched spec test area, or import an existing helper if one already exists. Since the scope is limited to touched files, the cleanest option within this changeset is to add a shared helper export in one touched test support file only if project conventions allow it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 4. Deduplicate `stepsAt()` Test Helper
**Finding key:** loop-2fc9cc3ed9bede7df908
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R6  
**Issue:** This file repeats the same `stepsAt(activeStepId)` implementation used by `approval-rewind-freshness.test.js`. The duplicate logic is not test-specific.  
**Suggestion:** Share the helper between the two touched test files, or define a local reusable helper module for this spec’s tests so future step-tree changes only need one update.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R6  
**Issue:** This file repeats the same `stepsAt(activeStepId)` implementation used by `approval-rewind-freshness.test.js`. The duplicate logic is not test-specific.  
**Suggestion:** Share the helper between the two touched test files, or define a local reusable helper module for this spec’s tests so future step-tree changes only need one update.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 5. Simplify Repeated Sequence Tests With Route Tables
**Finding key:** loop-41b1baa90d96226e2bda
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R3  
**Issue:** The R1, R2, and R3 test cases repeat the same arrange/cleanup/assert structure with only route key and expected artifact shape changing.  
**Suggestion:** Use a small table of route expectations and a shared assertion helper for canonical empty triage/repair artifacts. This would reduce repetition while keeping requirement-specific `it()` blocks if those are useful for traceability.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R3  
**Issue:** The R1, R2, and R3 test cases repeat the same arrange/cleanup/assert structure with only route key and expected artifact shape changing.  
**Suggestion:** Use a small table of route expectations and a shared assertion helper for canonical empty triage/repair artifacts. This would reduce repetition while keeping requirement-specific `it()` blocks if those are useful for traceability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 6. Rename `beforeRewind` For Clarity
**Finding key:** loop-9f3812f88027dbdc3a3c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R5  
**Issue:** `beforeRewind` contains the stale non-PASS artifacts captured before the rewind, but later assertions use it mainly as “invalidated artifacts”. The current name is temporal and slightly vague.  
**Suggestion:** Rename it to `staleArtifacts`, `invalidatedArtifacts`, or `nonPassArtifactsBeforeRewind` so the assertions communicate intent more directly.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R5  
**Issue:** `beforeRewind` contains the stale non-PASS artifacts captured before the rewind, but later assertions use it mainly as “invalidated artifacts”. The current name is temporal and slightly vague.  
**Suggestion:** Rename it to `staleArtifacts`, `invalidatedArtifacts`, or `nonPassArtifactsBeforeRewind` so the assertions communicate intent more directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 1. Keep File Writing Out Of Route Metadata
**Finding key:** loop-3fab651b476bf0caa6ed
**Failure mode:** refactor
**File:** src/flow/lib/draft-review-routes.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/draft-review-routes.js`  
**Requirement:** R1  
**Issue:** `DraftReviewRoute` now owns filesystem writes via `writeEmptyArtifacts()` and `#writeEmptyArtifact()`. This mixes route metadata with artifact persistence behavior, while the previous design kept writing in `src/flow/definition.js`. That makes the route object less purely declarative and increases coupling to `fs`/`path`.  
**Suggestion:** Move the shared artifact construction/writing helper back into `src/flow/definition.js` or a dedicated artifact utility, and keep `DraftReviewRoute` as route configuration only. The helper can still overwrite both triage and repair artifacts unconditionally.
**Suggestion:** **File:** `src/flow/lib/draft-review-routes.js`  
**Requirement:** R1  
**Issue:** `DraftReviewRoute` now owns filesystem writes via `writeEmptyArtifacts()` and `#writeEmptyArtifact()`. This mixes route metadata with artifact persistence behavior, while the previous design kept writing in `src/flow/definition.js`. That makes the route object less purely declarative and increases coupling to `fs`/`path`.  
**Suggestion:** Move the shared artifact construction/writing helper back into `src/flow/definition.js` or a dedicated artifact utility, and keep `DraftReviewRoute` as route configuration only. The helper can still overwrite both triage and repair artifacts unconditionally.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 2. Replace Stringly Source Field With Explicit Artifact Builders
**Finding key:** loop-e657d9e17889e3281e5f
**Failure mode:** refactor
**File:** src/flow/lib/draft-review-routes.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/draft-review-routes.js`  
**Requirement:** R2  
**Issue:** `#writeEmptyArtifact()` takes `sourceField` as a string and uses computed object keys. This saves a few lines but weakens readability and makes typos like `"sourceTriag"` silently shape the artifact incorrectly.  
**Suggestion:** Use explicit `buildEmptyTriageArtifact(route, generatedAt)` and `buildEmptyRepairArtifact(route, generatedAt)` helpers, or pass complete artifact objects to a generic `writeJsonArtifact()` helper. That keeps the schema obvious at the call site.
**Suggestion:** **File:** `src/flow/lib/draft-review-routes.js`  
**Requirement:** R2  
**Issue:** `#writeEmptyArtifact()` takes `sourceField` as a string and uses computed object keys. This saves a few lines but weakens readability and makes typos like `"sourceTriag"` silently shape the artifact incorrectly.  
**Suggestion:** Use explicit `buildEmptyTriageArtifact(route, generatedAt)` and `buildEmptyRepairArtifact(route, generatedAt)` helpers, or pass complete artifact objects to a generic `writeJsonArtifact()` helper. That keeps the schema obvious at the call site.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 1. Use a More Specific Factory Name
**Finding key:** loop-088f5875ec9e8f6a546c
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.from(record)` hides the important domain rule that occurrence time comes from `timestamp` for sealed spec-correction records and `rewoundAt` for guarded rewind records. The generic `from` name makes this easy to misuse later.  
**Suggestion:** Rename it to something domain-specific such as `fromRewindRecord(record)` or `fromPlanRewindRecord(record)`.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.from(record)` hides the important domain rule that occurrence time comes from `timestamp` for sealed spec-correction records and `rewoundAt` for guarded rewind records. The generic `from` name makes this easy to misuse later.  
**Suggestion:** Rename it to something domain-specific such as `fromRewindRecord(record)` or `fromPlanRewindRecord(record)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 2. Avoid Repeated Timestamp Field Access Logic
**Finding key:** loop-308dbe084c57b3acfd6d
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.from` currently combines record validation, occurrence-field selection, string normalization, parsing, and object creation in one method. This is small now, but it makes the R7 field-selection rule less explicit.  
**Suggestion:** Extract the field selection into a small helper, for example `planRewindOccurrenceField(record)`, returning `"timestamp"` for `spec-correction` and `"rewoundAt"` otherwise.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.from` currently combines record validation, occurrence-field selection, string normalization, parsing, and object creation in one method. This is small now, but it makes the R7 field-selection rule less explicit.  
**Suggestion:** Extract the field selection into a small helper, for example `planRewindOccurrenceField(record)`, returning `"timestamp"` for `spec-correction` and `"rewoundAt"` otherwise.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 3. Remove Persisted Review Artifacts From the Change Set
**Finding key:** loop-ae1760246111d3bd399d
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/impl-review.json
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/impl-review.json`  
**Requirement:** R8  
**Issue:** This generated review artifact records a rejected implementation review and includes findings for `src/flow/definition.js`, which is not part of the provided implementation diff. Keeping stale/generated review output in the code change can create noise and confuse the authoritative current review state.  
**Suggestion:** Remove this file from the committed change unless this repository intentionally versions generated review artifacts as part of the workflow.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/impl-review.json`  
**Requirement:** R8  
**Issue:** This generated review artifact records a rejected implementation review and includes findings for `src/flow/definition.js`, which is not part of the provided implementation diff. Keeping stale/generated review output in the code change can create noise and confuse the authoritative current review state.  
**Suggestion:** Remove this file from the committed change unless this repository intentionally versions generated review artifacts as part of the workflow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 4. Remove Duplicate Human-Readable Review Output
**Finding key:** loop-624178fb9b03b918810d
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review.md
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review.md`  
**Requirement:** R8  
**Issue:** `review.md` duplicates the contents of `impl-review.json` in a second format. This creates two sources that can drift and adds no implementation behavior.  
**Suggestion:** If review artifacts must be committed, keep only the canonical machine-readable artifact or generate the Markdown view from it instead of committing both.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review.md`  
**Requirement:** R8  
**Issue:** `review.md` duplicates the contents of `impl-review.json` in a second format. This creates two sources that can drift and adds no implementation behavior.  
**Suggestion:** If review artifacts must be committed, keep only the canonical machine-readable artifact or generate the Markdown view from it instead of committing both.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 1. Normalize Generated Artifact Identity
**Finding key:** loop-e6fe132e87f0eb4725dd
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/test-review.json
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/test-review.json`  
**Requirement:** R7  
**Issue:** Multiple files report conflicting duplicate generated states for the same artifact family, including `test-review.json`, `test-review.md`, `test-coverage.json`, `draft.json`, `flow.json`, `issue-log.json`, and `spec-review.json`. This is a cross-file consistency problem because downstream consumers cannot know which generated artifact is canonical.
**Suggestion:** Regenerate the review artifact set once from the final source state and commit only one version per path, ensuring JSON, Markdown, coverage, raw logs, and history files agree on the same verdict and evidence.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/test-review.json`  
**Requirement:** R7  
**Issue:** Multiple files report conflicting duplicate generated states for the same artifact family, including `test-review.json`, `test-review.md`, `test-coverage.json`, `draft.json`, `flow.json`, `issue-log.json`, and `spec-review.json`. This is a cross-file consistency problem because downstream consumers cannot know which generated artifact is canonical.
**Suggestion:** Regenerate the review artifact set once from the final source state and commit only one version per path, ensuring JSON, Markdown, coverage, raw logs, and history files agree on the same verdict and evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 2. Standardize Finding Representation
**Finding key:** loop-de7d781687e81f3da7dd
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** Several artifacts duplicate the same finding payloads across canonical and summary locations, including `blockingFindings` vs `findings`, `evaluations[].observations` vs top-level `observations`, and repeated command/evidence fields. Some duplicates also use different identity fields or names such as `issue` vs `body` and `kind` vs `severity`.
**Suggestion:** Define one canonical finding schema and store full finding details once. Use ID references or derived summaries for grouped views such as blocking findings, observations, and evaluation attachments.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** Several artifacts duplicate the same finding payloads across canonical and summary locations, including `blockingFindings` vs `findings`, `evaluations[].observations` vs top-level `observations`, and repeated command/evidence fields. Some duplicates also use different identity fields or names such as `issue` vs `body` and `kind` vs `severity`.
**Suggestion:** Define one canonical finding schema and store full finding details once. Use ID references or derived summaries for grouped views such as blocking findings, observations, and evaluation attachments.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 3. Align Metadata Schema Across Review Artifacts
**Finding key:** loop-1fbd74d1781e31e26e3a
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-questions-triage.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`  
**Requirement:** R1  
**Issue:** `generatedAt` is present in some repair, triage, review, and evidence artifacts but omitted from others, including `draft-questions-triage.json` and `draft-questions-repair.json`. This creates an inconsistent interface for consumers reading sibling generated artifacts.
**Suggestion:** Decide whether `generatedAt` is part of the canonical generated artifact schema. Then add or remove it consistently across all triage, repair, review, coverage, and evidence JSON artifacts.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`  
**Requirement:** R1  
**Issue:** `generatedAt` is present in some repair, triage, review, and evidence artifacts but omitted from others, including `draft-questions-triage.json` and `draft-questions-repair.json`. This creates an inconsistent interface for consumers reading sibling generated artifacts.
**Suggestion:** Decide whether `generatedAt` is part of the canonical generated artifact schema. Then add or remove it consistently across all triage, repair, review, coverage, and evidence JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 4. Deduplicate Shared Test Helpers
**Finding key:** loop-20acc1fc782cee360449
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js
**Requirement:** R7
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`  
**Requirement:** R7  
**Issue:** The `stepsAt(activeStepId)` helper is duplicated across `approval-rewind-freshness.test.js` and `draft-review-pass-artifacts.test.js`. This creates cross-file test maintenance drift if flow step initialization changes.
**Suggestion:** Move `stepsAt()` into a shared local test helper for this spec area and import it from both test files.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`  
**Requirement:** R7  
**Issue:** The `stepsAt(activeStepId)` helper is duplicated across `approval-rewind-freshness.test.js` and `draft-review-pass-artifacts.test.js`. This creates cross-file test maintenance drift if flow step initialization changes.
**Suggestion:** Move `stepsAt()` into a shared local test helper for this spec area and import it from both test files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 5. Keep Markdown Formatting Consistent
**Finding key:** loop-d526cfb77de17a55b716
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`  
**Requirement:** R5  
**Issue:** Multiple Markdown artifacts are missing trailing newlines, including `issue.md`, `spec-attempt-001.md`, `test-attempt-001.md`, `test-attempt-002.md`, `test-attempt-003.md`, and `test-attempt-004.md`. This is a repeated formatting inconsistency across generated human-readable artifacts.
**Suggestion:** Update the artifact writer or formatter so all generated Markdown files end with exactly one trailing newline.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/test-attempt-004.md`  
**Requirement:** R5  
**Issue:** Multiple Markdown artifacts are missing trailing newlines, including `issue.md`, `spec-attempt-001.md`, `test-attempt-001.md`, `test-attempt-002.md`, `test-attempt-003.md`, and `test-attempt-004.md`. This is a repeated formatting inconsistency across generated human-readable artifacts.
**Suggestion:** Update the artifact writer or formatter so all generated Markdown files end with exactly one trailing newline.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
