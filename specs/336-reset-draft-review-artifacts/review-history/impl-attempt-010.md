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

### 10. 1. Remove Duplicate File Snapshots From The Diff
**Finding key:** loop-38b98e7ab24c83f5d24d
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`
**Requirement:** R4
**Issue:** The diff contains two separate `new file` snapshots for the same path with different contents, making the intended canonical artifact state ambiguous and inflating review noise.
**Suggestion:** Keep only the final intended `flow.json` snapshot in the change set, or regenerate the diff so the file appears once with a single authoritative state.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`
**Requirement:** R4
**Issue:** The diff contains two separate `new file` snapshots for the same path with different contents, making the intended canonical artifact state ambiguous and inflating review noise.
**Suggestion:** Keep only the final intended `flow.json` snapshot in the change set, or regenerate the diff so the file appears once with a single authoritative state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Bound Runtime History Growth
**Finding key:** loop-cbce22ea878907bafac1
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`
**Requirement:** R5
**Issue:** `metrics`, `reviewConvergence.records`, `handoffFindings`, `evidenceHistory`, `stepAttempts`, and `reviewRecoveryBaselines` can grow with every review/gate retry. No explicit retention limit is visible, which violates the `bounded-resource-usage` guardrail for bulk history accumulation.
**Suggestion:** Persist only the current canonical state plus a bounded recent history, for example capped by attempt count, entry count, or byte size, and archive older entries outside the current flow artifact if long-term audit retention is required.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`
**Requirement:** R5
**Issue:** `metrics`, `reviewConvergence.records`, `handoffFindings`, `evidenceHistory`, `stepAttempts`, and `reviewRecoveryBaselines` can grow with every review/gate retry. No explicit retention limit is visible, which violates the `bounded-resource-usage` guardrail for bulk history accumulation.
**Suggestion:** Persist only the current canonical state plus a bounded recent history, for example capped by attempt count, entry count, or byte size, and archive older entries outside the current flow artifact if long-term audit retention is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Collapse Repeated Finding Payloads
**Finding key:** loop-c6b0386b4cac78b0375e
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`
**Requirement:** R6
**Issue:** Many `handoffFindings` repeat the same structural fields (`sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, `finalDispositionOwner`) for every finding in the same record.
**Suggestion:** Store shared review/evidence metadata once at the record level and keep each finding focused on finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/flow.json`
**Requirement:** R6
**Issue:** Many `handoffFindings` repeat the same structural fields (`sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, `finalDispositionOwner`) for every finding in the same record.
**Suggestion:** Store shared review/evidence metadata once at the record level and keep each finding focused on finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Remove Superseded Issue Log Snapshot
**Finding key:** loop-4e671e04ee3b65aabec2
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue-log.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue-log.json`
**Requirement:** R4
**Issue:** The diff contains two `new file` snapshots for `issue-log.json`, one with 598 lines and one with 213 lines. This makes it unclear whether the extra entries are intentional audit history or stale generated state.
**Suggestion:** Regenerate the change so `issue-log.json` appears once, containing only the intended canonical log entries for this change set.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue-log.json`
**Requirement:** R4
**Issue:** The diff contains two `new file` snapshots for `issue-log.json`, one with 598 lines and one with 213 lines. This makes it unclear whether the extra entries are intentional audit history or stale generated state.
**Suggestion:** Regenerate the change so `issue-log.json` appears once, containing only the intended canonical log entries for this change set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 5. Add Missing Trailing Newline
**Finding key:** loop-d9b4e2f414811e4ddc2c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`
**Requirement:** R8
**Issue:** The file ends without a trailing newline, which creates avoidable formatting churn in future edits.
**Suggestion:** Add a final newline after `</details>`.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`
**Requirement:** R8
**Issue:** The file ends without a trailing newline, which creates avoidable formatting churn in future edits.
**Suggestion:** Add a final newline after `</details>`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 6. Avoid Full English Duplication In Localized Section
**Finding key:** loop-f3837991e22ead4b37c5
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`
**Requirement:** R8
**Issue:** The Japanese `<details>` section repeats the English issue content verbatim after a Japanese title, doubling maintenance cost without providing localized content.
**Suggestion:** Either translate the section fully into Japanese or remove the duplicated body and keep a short localized summary that references the canonical English sections above.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`
**Requirement:** R8
**Issue:** The Japanese `<details>` section repeats the English issue content verbatim after a Japanese title, doubling maintenance cost without providing localized content.
**Suggestion:** Either translate the section fully into Japanese or remove the duplicated body and keep a short localized summary that references the canonical English sections above.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Normalize Review Evidence Formatting
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

### 17. 2. Normalize Review Evidence Formatting
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

### 18. 3. Normalize Review Evidence Formatting
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

### 19. 4. Normalize Review Evidence Formatting
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

### 20. 1. Add the missing file reference to the second implementation finding
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

### 21. 2. Add the missing `file` field to the matching JSON finding
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

### 22. 1. Remove duplicated review-history artifacts from the change set
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

### 23. 2. Add trailing newlines to markdown artifacts
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

### 24. 2. Add trailing newlines to markdown artifacts
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

### 25. 4. Avoid duplicating finding details across JSON fields
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

### 26. 3. Add trailing newline to test review markdown artifact
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

### 27. 1. Remove duplicated finding payloads
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

### 28. 3. Add trailing newline
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

### 29. 2. Remove duplicated finding payloads
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

### 30. 4. Add trailing newline
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

### 31. 1. Remove duplicated diff entry for test attempt JSON
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

### 32. 2. Remove duplicated diff entry for test attempt Markdown
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

### 33. 3. Add trailing newline to Markdown artifact
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

### 34. 4. Avoid repeated command strings in scenario evidence
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

### 35. 5. Avoid repeated raw output line ranges
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

### 36. 6. Consolidate duplicated guardrail finding data
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

### 37. 1. Remove stale duplicate spec-review entry from the change set
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

### 38. 2. Remove empty placeholder sections
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

### 39. 3. Deduplicate module ownership bullets
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

### 40. 4. Keep generated task text in sync with the canonical spec
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

### 41. 1. Remove Conflicting Duplicate Artifact Versions
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

### 42. 2. Keep Review Verdict Artifacts Consistent
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

### 43. 3. Avoid Stale Generated Review Markdown
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

### 44. 4. Replace Raw Failure Log With Current Evidence Only
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

### 45. 3. Reduce repeated approval harness setup
**Finding key:** loop-7686712b557f2ce10357
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`  
**Requirement:** R8  
**Issue:** The tests repeat the `try/finally` harness lifecycle pattern several times, which makes the behavioral assertions harder to scan.  
**Suggestion:** Add a local helper like `withApprovalFreshnessHarness(async (harness) => { ... })` to centralize construction and cleanup.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/approval-rewind-freshness.test.js`  
**Requirement:** R8  
**Issue:** The tests repeat the `try/finally` harness lifecycle pattern several times, which makes the behavioral assertions harder to scan.  
**Suggestion:** Add a local helper like `withApprovalFreshnessHarness(async (harness) => { ... })` to centralize construction and cleanup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 4. Parameterize duplicate route artifact assertions
**Finding key:** loop-1e17a5b9ed0d8976302f
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js
**Requirement:** R3
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R3  
**Issue:** The questions and coverage tests repeat nearly identical expected triage/repair artifact shapes, differing only by route metadata.  
**Suggestion:** Add local helpers such as `expectedEmptyTriage(route, generatedAt)` and `expectedEmptyRepair(route, generatedAt)` and reuse them across R1, R2, and R3.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js`  
**Requirement:** R3  
**Issue:** The questions and coverage tests repeat nearly identical expected triage/repair artifact shapes, differing only by route metadata.  
**Suggestion:** Add local helpers such as `expectedEmptyTriage(route, generatedAt)` and `expectedEmptyRepair(route, generatedAt)` and reuse them across R1, R2, and R3.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 5. Clarify destructive artifact writer naming
**Finding key:** loop-758bbd3f09b239ae06ff
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R5
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R5  
**Issue:** `writeEmptyDraftReviewRouteArtifacts` now always overwrites existing triage and repair files, while the previous implementation only wrote missing files. The name does not make that destructive replacement behavior obvious.  
**Suggestion:** Rename the helper or add a narrowly scoped wrapper name such as `replaceWithEmptyDraftReviewRouteArtifacts` so call sites make the PASS replacement semantics explicit.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R5  
**Issue:** `writeEmptyDraftReviewRouteArtifacts` now always overwrites existing triage and repair files, while the previous implementation only wrote missing files. The name does not make that destructive replacement behavior obvious.  
**Suggestion:** Rename the helper or add a narrowly scoped wrapper name such as `replaceWithEmptyDraftReviewRouteArtifacts` so call sites make the PASS replacement semantics explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 1. Remove unused occurrence string state
**Finding key:** loop-84750573694e2e026f80
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.occurredAt` is assigned and frozen but never read. The freshness check only uses `epochMilliseconds`, so the normalized ISO string is dead state.  
**Suggestion:** Drop the `occurredAt` constructor parameter/property, or use it in a concrete diagnostic path if the string form is needed.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R7  
**Issue:** `PlanRewindOccurrence.occurredAt` is assigned and frozen but never read. The freshness check only uses `epochMilliseconds`, so the normalized ISO string is dead state.  
**Suggestion:** Drop the `occurredAt` constructor parameter/property, or use it in a concrete diagnostic path if the string form is needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 2. Simplify timestamp normalization
**Finding key:** loop-8bfa10fcb5a6df4aee04
**Failure mode:** refactor
**File:** src/flow/lib/plan-rewind.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R8  
**Issue:** `PlanRewindOccurrence` is a fairly heavy abstraction for selecting one timestamp field and comparing epoch milliseconds. This adds indirection without much reuse.  
**Suggestion:** Replace the class with a small private helper such as `planRewindOccurrenceMs(record)` that returns a finite timestamp or `null`, then compare directly in `isPlanEvidenceFresh`.
**Suggestion:** **File:** `src/flow/lib/plan-rewind.js`  
**Requirement:** R8  
**Issue:** `PlanRewindOccurrence` is a fairly heavy abstraction for selecting one timestamp field and comparing epoch milliseconds. This adds indirection without much reuse.  
**Suggestion:** Replace the class with a small private helper such as `planRewindOccurrenceMs(record)` that returns a finite timestamp or `null`, then compare directly in `isPlanEvidenceFresh`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 2. Add Missing JSON File Property
**Finding key:** loop-2f418af1dd767c59e0b1
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/impl-review.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/impl-review.json`
**Requirement:** R6
**Issue:** The second `blockingFindings` entry has no `"file"` property, while the first one does. This inconsistency forces downstream tooling to handle two shapes for the same finding type.
**Suggestion:** Add `"file": "src/flow/definition.js"` to the second finding object, or ensure the generator always emits a nullable/file field consistently for every finding.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/impl-review.json`
**Requirement:** R6
**Issue:** The second `blockingFindings` entry has no `"file"` property, while the first one does. This inconsistency forces downstream tooling to handle two shapes for the same finding type.
**Suggestion:** Add `"file": "src/flow/definition.js"` to the second finding object, or ensure the generator always emits a nullable/file field consistently for every finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 1. Add Missing File Field To Second Finding
**Finding key:** loop-addd242c52e71ae81bd1
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review.md
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review.md`
**Requirement:** R6
**Issue:** The second blocking finding omits a `**File:**` line, while the first finding includes one. This makes the review artifact structurally inconsistent and can break consumers or follow-up reviewers that expect every finding to identify an affected file.
**Suggestion:** Add `**File:** src/flow/definition.js` to the second finding, matching the corresponding implementation concern.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review.md`
**Requirement:** R6
**Issue:** The second blocking finding omits a `**File:**` line, while the first finding includes one. This makes the review artifact structurally inconsistent and can break consumers or follow-up reviewers that expect every finding to identify an affected file.
**Suggestion:** Add `**File:** src/flow/definition.js` to the second finding, matching the corresponding implementation concern.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 1. Normalize Timestamp Metadata Across Review Artifacts
**Finding key:** loop-ac5588e4580c7861b309
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-questions-triage.json
**Requirement:** R1
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`  
**Requirement:** R1  
**Issue:** Multiple summaries flag inconsistent `generatedAt` usage: `draft-questions-triage.json` omits it, `draft-questions-repair.json` drops it, while sibling repair/triage/review artifacts include it. This creates a cross-file schema inconsistency for generated artifacts.  
**Suggestion:** Define `generatedAt` as either required or intentionally absent for all generated review artifacts, then regenerate the affected files to match that canonical schema.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-questions-triage.json`  
**Requirement:** R1  
**Issue:** Multiple summaries flag inconsistent `generatedAt` usage: `draft-questions-triage.json` omits it, `draft-questions-repair.json` drops it, while sibling repair/triage/review artifacts include it. This creates a cross-file schema inconsistency for generated artifacts.  
**Suggestion:** Define `generatedAt` as either required or intentionally absent for all generated review artifacts, then regenerate the affected files to match that canonical schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 2. Deduplicate Conflicting Generated Artifact Versions
**Finding key:** loop-e0f167691ab678ab621c
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft.json`  
**Requirement:** R2  
**Issue:** Several files are reported as appearing multiple times in the diff with different or duplicate contents, including `draft.json`, `flow.json`, `issue-log.json`, `spec-review.json`, `test-coverage.json`, `test-review.json`, `test-review.md`, and task artifacts. This is a cross-file generation/change-set integrity problem rather than an isolated file issue.  
**Suggestion:** Regenerate or restage the artifact set so each path appears once with a single authoritative final state.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft.json`  
**Requirement:** R2  
**Issue:** Several files are reported as appearing multiple times in the diff with different or duplicate contents, including `draft.json`, `flow.json`, `issue-log.json`, `spec-review.json`, `test-coverage.json`, `test-review.json`, `test-review.md`, and task artifacts. This is a cross-file generation/change-set integrity problem rather than an isolated file issue.  
**Suggestion:** Regenerate or restage the artifact set so each path appears once with a single authoritative final state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 3. Use One Canonical Finding Representation
**Finding key:** loop-2aad967055592f1daf89
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/spec-gate-source.json
**Requirement:** R5
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/spec-gate-source.json`  
**Requirement:** R5  
**Issue:** The same pattern appears across gate, review-history, and flow artifacts: findings are duplicated between top-level arrays and nested sections such as `evaluations[].observations`, `blockingFindings`, `findings`, or `handoffFindings`, sometimes with different IDs or field names. This creates cross-file drift risk and inconsistent consumer semantics.  
**Suggestion:** Store each full finding once, then use references or derived views for grouping by severity, evaluation, route, or handoff record.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/spec-gate-source.json`  
**Requirement:** R5  
**Issue:** The same pattern appears across gate, review-history, and flow artifacts: findings are duplicated between top-level arrays and nested sections such as `evaluations[].observations`, `blockingFindings`, `findings`, or `handoffFindings`, sometimes with different IDs or field names. This creates cross-file drift risk and inconsistent consumer semantics.  
**Suggestion:** Store each full finding once, then use references or derived views for grouping by severity, evaluation, route, or handoff record.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 4. Align Markdown And JSON Finding Shapes
**Finding key:** loop-84cf543b7e2ddb5f87c0
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`  
**Requirement:** R6  
**Issue:** Missing file references are flagged in both Markdown and JSON review artifacts, including `impl-attempt-001.md`/`.json` and `review.md`/`impl-review.json`. The same logical finding is represented with different completeness across formats.  
**Suggestion:** Update the review artifact generator so every finding emits a consistent file reference in both Markdown and JSON, using the same path for the same finding.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-history/impl-attempt-001.json`  
**Requirement:** R6  
**Issue:** Missing file references are flagged in both Markdown and JSON review artifacts, including `impl-attempt-001.md`/`.json` and `review.md`/`impl-review.json`. The same logical finding is represented with different completeness across formats.  
**Suggestion:** Update the review artifact generator so every finding emits a consistent file reference in both Markdown and JSON, using the same path for the same finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 5. Standardize Review Evidence JSON Formatting
**Finding key:** loop-376508ca7e191fe03e5a
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json
**Requirement:** R6
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json`  
**Requirement:** R6  
**Issue:** Multiple review evidence files are committed as one-line JSON while surrounding generated JSON artifacts appear review-oriented and structured. This creates inconsistent artifact readability across the same artifact family.  
**Suggestion:** Apply one deterministic JSON formatter to all `review-evidence/*.json` files, with stable indentation and key ordering.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/review-evidence/ae4f764a2fa3418fe893e9b06e6feb5e4c1e929362120af89efddaa55fedd3ac.json`  
**Requirement:** R6  
**Issue:** Multiple review evidence files are committed as one-line JSON while surrounding generated JSON artifacts appear review-oriented and structured. This creates inconsistent artifact readability across the same artifact family.  
**Suggestion:** Apply one deterministic JSON formatter to all `review-evidence/*.json` files, with stable indentation and key ordering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 6. Consolidate Repeated Empty Artifact Shapes
**Finding key:** loop-9bb5fd9be9017f1a34ba
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/draft-coverage-triage.json
**Requirement:** R4
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/draft-coverage-triage.json`  
**Requirement:** R4  
**Issue:** Empty triage and repair artifacts repeat nearly identical JSON structure across coverage and questions routes, while tests also duplicate expected shapes for these artifacts. This indicates the generator and tests may drift independently across files.  
**Suggestion:** Introduce a shared empty-artifact builder and shared test expectation helpers parameterized by route, phase, source artifact, and timestamp.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/draft-coverage-triage.json`  
**Requirement:** R4  
**Issue:** Empty triage and repair artifacts repeat nearly identical JSON structure across coverage and questions routes, while tests also duplicate expected shapes for these artifacts. This indicates the generator and tests may drift independently across files.  
**Suggestion:** Introduce a shared empty-artifact builder and shared test expectation helpers parameterized by route, phase, source artifact, and timestamp.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 7. Normalize EOF Newline Policy For Markdown Artifacts
**Finding key:** loop-7504da2038fb47763705
**Failure mode:** refactor
**File:** specs/336-reset-draft-review-artifacts/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R8  
**Issue:** Missing trailing newlines are reported across several Markdown artifacts, including `issue.md`, `spec-attempt-001.md`, `test-attempt-001.md`, `test-attempt-002.md`, `test-attempt-003.md`, and `test-attempt-004.md`. This is a repeated formatting inconsistency across generated text outputs.  
**Suggestion:** Make the Markdown artifact writer always terminate files with a final newline, then regenerate the affected files.
**Suggestion:** **File:** `specs/336-reset-draft-review-artifacts/issue.md`  
**Requirement:** R8  
**Issue:** Missing trailing newlines are reported across several Markdown artifacts, including `issue.md`, `spec-attempt-001.md`, `test-attempt-001.md`, `test-attempt-002.md`, `test-attempt-003.md`, and `test-attempt-004.md`. This is a repeated formatting inconsistency across generated text outputs.  
**Suggestion:** Make the Markdown artifact writer always terminate files with a final newline, then regenerate the affected files.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
