# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Avoid committing transient recovery state
**Finding key:** loop-9598cebce94b184287ed
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/.retry-recovery.transaction.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/.retry-recovery.transaction.json`  
**Requirement:** R8  
**Issue:** The file contains only `transaction: null`, which appears to be transient recovery state rather than meaningful spec data. As committed data, it adds noise without carrying useful state.  
**Suggestion:** Omit this file when there is no active transaction, or generate it on demand as runtime state rather than persisting an empty placeholder.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/.retry-recovery.transaction.json`  
**Requirement:** R8  
**Issue:** The file contains only `transaction: null`, which appears to be transient recovery state rather than meaningful spec data. As committed data, it adds noise without carrying useful state.  
**Suggestion:** Omit this file when there is no active transaction, or generate it on demand as runtime state rather than persisting an empty placeholder.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Remove duplicated finding payloads
**Finding key:** loop-fed5ce7c1218475119d5
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R7  
**Issue:** The same guardrail failures are represented twice, once under `evaluations` and again under `observations`, with largely duplicated fields and different `findingId` / `fingerprint` values. This increases drift risk and makes it unclear which collection is authoritative.  
**Suggestion:** Keep one canonical representation, or make one section reference the other by stable IDs instead of duplicating the full payload.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R7  
**Issue:** The same guardrail failures are represented twice, once under `evaluations` and again under `observations`, with largely duplicated fields and different `findingId` / `fingerprint` values. This increases drift risk and makes it unclear which collection is authoritative.  
**Suggestion:** Keep one canonical representation, or make one section reference the other by stable IDs instead of duplicating the full payload.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Normalize guardrail field naming
**Finding key:** loop-c0d0f98964a8722693cc
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R7  
**Issue:** The file mixes `guardrail_id`, `guardrailId`, `requirementRef`, and `requirementId` for closely related concepts. This weakens schema consistency and makes downstream consumers more error-prone.  
**Suggestion:** Use one naming convention for persisted JSON fields, preferably the project’s existing schema convention, and remove redundant aliases unless compatibility requires them.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R7  
**Issue:** The file mixes `guardrail_id`, `guardrailId`, `requirementRef`, and `requirementId` for closely related concepts. This weakens schema consistency and makes downstream consumers more error-prone.  
**Suggestion:** Use one naming convention for persisted JSON fields, preferably the project’s existing schema convention, and remove redundant aliases unless compatibility requires them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Consolidate duplicated review result artifacts
**Finding key:** loop-f664f5c611c2c01dcab0
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `draft-review-questions.json` and `draft-review-coverage.json` duplicate the same PASS artifact shape, differing only by `phase`, `sourceDraft`, and timestamp. This makes future format changes easy to miss in one file.  
**Suggestion:** Prefer generating these artifacts from a shared review-result fixture/template in the spec workflow, or record only the source inputs needed to regenerate them if committed generated artifacts are not required.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `draft-review-questions.json` and `draft-review-coverage.json` duplicate the same PASS artifact shape, differing only by `phase`, `sourceDraft`, and timestamp. This makes future format changes easy to miss in one file.  
**Suggestion:** Prefer generating these artifacts from a shared review-result fixture/template in the spec workflow, or record only the source inputs needed to regenerate them if committed generated artifacts are not required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Avoid repeated requirement file lists
**Finding key:** loop-b2444f184e4026a56161
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/file-map.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/file-map.json`  
**Requirement:** R8  
**Issue:** The same file arrays are repeated across `R1` through `R5`, and again for `R6`/`R7`. This creates maintenance churn if one mapped file changes.  
**Suggestion:** If the file-map schema allows it, introduce grouped aliases or a shared requirement group representation. If the schema requires expanded mappings, consider generating this file from grouped source data rather than hand-maintaining repeated arrays.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/file-map.json`  
**Requirement:** R8  
**Issue:** The same file arrays are repeated across `R1` through `R5`, and again for `R6`/`R7`. This creates maintenance churn if one mapped file changes.  
**Suggestion:** If the file-map schema allows it, introduce grouped aliases or a shared requirement group representation. If the schema requires expanded mappings, consider generating this file from grouped source data rather than hand-maintaining repeated arrays.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Clarify issue reference inconsistency
**Finding key:** loop-4352f14fae92b7f4f13f
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/draft.json`  
**Requirement:** R8  
**Issue:** The draft mixes references to Issue `#453` and Issue `#454`. Some sections describe `#454` as the active acceptance criteria, while other scope statements say not to implement `#453`. The relationship is understandable but easy to misread during implementation or review.  
**Suggestion:** Add a short explicit note near `analysis.problem` or `decisionMap.knownFacts` stating that `#454` is the current repair-target fix and `#453` is only the prior blocker/context being preserved.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft.json`  
**Requirement:** R8  
**Issue:** The draft mixes references to Issue `#453` and Issue `#454`. Some sections describe `#454` as the active acceptance criteria, while other scope statements say not to implement `#453`. The relationship is understandable but easy to misread during implementation or review.  
**Suggestion:** Add a short explicit note near `analysis.problem` or `decisionMap.knownFacts` stating that `#454` is the current repair-target fix and `#453` is only the prior blocker/context being preserved.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Deduplicate recovery baselines
**Finding key:** loop-14accb65d05b00bccde0
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** `reviewRecoveryBaselines` stores five identical `task-impl` baseline records that differ only by `createdAt`. This duplicates persisted state and makes repeat handling harder to reason about.  
**Suggestion:** Store one baseline per `{kind, phase, fingerprint.hash, trigger}` and keep repeated occurrences in a bounded `attempts`/`createdAtHistory` field if those timestamps are required.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** `reviewRecoveryBaselines` stores five identical `task-impl` baseline records that differ only by `createdAt`. This duplicates persisted state and makes repeat handling harder to reason about.  
**Suggestion:** Store one baseline per `{kind, phase, fingerprint.hash, trigger}` and keep repeated occurrences in a bounded `attempts`/`createdAtHistory` field if those timestamps are required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Remove stale active-step runtime metadata
**Finding key:** loop-5def68b08f69a2e3aecb
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** The `impl-review` step is `in_progress`, but its `runtimeLog.endedAt` is earlier than the step’s current `startedAt`, so the active state contains stale execution metadata.  
**Suggestion:** Clear `runtimeLog` when a step is reopened, or move prior executions into `stepAttempts` so the active step only describes the current run.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** The `impl-review` step is `in_progress`, but its `runtimeLog.endedAt` is earlier than the step’s current `startedAt`, so the active state contains stale execution metadata.  
**Suggestion:** Clear `runtimeLog` when a step is reopened, or move prior executions into `stepAttempts` so the active step only describes the current run.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Collapse repeated gate failure issue-log entries
**Finding key:** loop-262baf90c9de2b1a44c5
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R7  
**Issue:** The same scenario-validity failure block is copied across multiple `spec-gate` entries, including nearly identical `reason`, `observations`, and `failedEvaluations`.  
**Suggestion:** Keep one canonical issue entry for the failure and add compact repeat records with `repeatedFromIssueLogId`, `attempt`, and timestamp.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R7  
**Issue:** The same scenario-validity failure block is copied across multiple `spec-gate` entries, including nearly identical `reason`, `observations`, and `failedEvaluations`.  
**Suggestion:** Keep one canonical issue entry for the failure and add compact repeat records with `repeatedFromIssueLogId`, `attempt`, and timestamp.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 4. Make truncation bounds structured
**Finding key:** loop-573e7f4e78446039dda5
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R7  
**Issue:** The `impl-review` entry says recovery discovery was “truncated at 200 entries,” but the bound and candidate count are only in prose. This weakens auditability under `bounded-resource-usage`.  
**Suggestion:** Add structured fields such as `scanLimit: 200`, `candidateCount`, and `truncated: true`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R7  
**Issue:** The `impl-review` entry says recovery discovery was “truncated at 200 entries,” but the bound and candidate count are only in prose. This weakens auditability under `bounded-resource-usage`.  
**Suggestion:** Add structured fields such as `scanLimit: 200`, `candidateCount`, and `truncated: true`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 5. Fix triage scope leakage
**Finding key:** loop-f8bbd218542fc775ed4b
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/impl-triage.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/impl-triage.json`  
**Requirement:** R8  
**Issue:** Many rejected triage items propose changes for files that are not in this supplied diff, which conflicts with the review scope constraint and leaves noisy, unactionable triage state.  
**Suggestion:** Regenerate or filter `impl-triage.json` so its items only reference files actually present in the diff for this change set.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/impl-triage.json`  
**Requirement:** R8  
**Issue:** Many rejected triage items propose changes for files that are not in this supplied diff, which conflicts with the review scope constraint and leaves noisy, unactionable triage state.  
**Suggestion:** Regenerate or filter `impl-triage.json` so its items only reference files actually present in the diff for this change set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 6. Remove volatile timestamp from committed triage artifact
**Finding key:** loop-4904e33e3621c5723387
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/impl-triage.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/impl-triage.json`  
**Requirement:** R8  
**Issue:** `generatedAt` is a volatile timestamp in a committed artifact and will churn whenever the artifact is regenerated, even if the logical triage result is unchanged.  
**Suggestion:** Omit `generatedAt` from committed canonical state, or move generation timestamps into transient runtime logs.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/impl-triage.json`  
**Requirement:** R8  
**Issue:** `generatedAt` is a volatile timestamp in a committed artifact and will churn whenever the artifact is regenerated, even if the logical triage result is unchanged.  
**Suggestion:** Omit `generatedAt` from committed canonical state, or move generation timestamps into transient runtime logs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 7. Add final newline
**Finding key:** loop-69cf5f954db536c24925
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/issue.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline, which creates avoidable diff noise and is inconsistent with normal markdown/text-file conventions.  
**Suggestion:** Ensure the issue markdown writer terminates generated markdown files with `\n`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/issue.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline, which creates avoidable diff noise and is inconsistent with normal markdown/text-file conventions.  
**Suggestion:** Ensure the issue markdown writer terminates generated markdown files with `\n`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Remove duplicated issue number
**Finding key:** loop-dc89987cdcfdee972f2e
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/plugin-artifacts/workflow/prepare.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The same issue number is stored twice as `issue` and `result.issueNumber`, which creates a small consistency risk if one value is updated without the other.  
**Suggestion:** Keep one canonical issue field, preferably `result.issueNumber` if the rest of the workflow result schema already treats `result` as the command output.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The same issue number is stored twice as `issue` and `result.issueNumber`, which creates a small consistency risk if one value is updated without the other.  
**Suggestion:** Keep one canonical issue field, preferably `result.issueNumber` if the rest of the workflow result schema already treats `result` as the command output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Avoid storing duplicate phase aliases when identical
**Finding key:** loop-1de572b7e3c360076f4f
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/retry-recovery.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/retry-recovery.json`  
**Requirement:** R1  
**Issue:** `phase` and `canonicalPhase` both contain `"task-impl"` in the entry. When they are identical, the duplicate field adds noise and can drift later.  
**Suggestion:** Store only `canonicalPhase`, or omit `canonicalPhase` unless normalization changed the original `phase`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/retry-recovery.json`  
**Requirement:** R1  
**Issue:** `phase` and `canonicalPhase` both contain `"task-impl"` in the entry. When they are identical, the duplicate field adds noise and can drift later.  
**Suggestion:** Store only `canonicalPhase`, or omit `canonicalPhase` unless normalization changed the original `phase`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Replace embedded command string with structured command data
**Finding key:** loop-05ca42ffaa474f657639
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/retry-recovery.json
**Requirement:** R4
**Issue:** **File:** `specs/330-draft-review-repair-target/retry-recovery.json`  
**Requirement:** R4  
**Issue:** `recoveryCommand` duplicates data already present in the entry, including phase and reason. The quoted command is harder to safely consume than structured fields.  
**Suggestion:** Store structured recovery intent, such as command name, target phase, reason, and confirmation flag, then render the CLI command only at display time.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/retry-recovery.json`  
**Requirement:** R4  
**Issue:** `recoveryCommand` duplicates data already present in the entry, including phase and reason. The quoted command is harder to safely consume than structured fields.  
**Suggestion:** Store structured recovery intent, such as command name, target phase, reason, and confirmation flag, then render the CLI command only at display time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Avoid committing volatile provenance when evidence is meant to be stable
**Finding key:** loop-37e1b05d73ffcd86f0b0
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-evidence/13066c5a48f3f9f9ecbb11c94180fde01cc71748b445e52d0aa2b6dfebc59a02.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-evidence/13066c5a48f3f9f9ecbb11c94180fde01cc71748b445e52d0aa2b6dfebc59a02.json`  
**Requirement:** R8  
**Issue:** `capturedAt` and `invocationId` are volatile run metadata. If these evidence files are committed as durable review state, they will churn on every regenerated review even when the semantic result is unchanged.  
**Suggestion:** Move volatile provenance to transient logs, or split stable evidence fields from run metadata so committed artifacts only change when the verdict or findings change.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-evidence/13066c5a48f3f9f9ecbb11c94180fde01cc71748b445e52d0aa2b6dfebc59a02.json`  
**Requirement:** R8  
**Issue:** `capturedAt` and `invocationId` are volatile run metadata. If these evidence files are committed as durable review state, they will churn on every regenerated review even when the semantic result is unchanged.  
**Suggestion:** Move volatile provenance to transient logs, or split stable evidence fields from run metadata so committed artifacts only change when the verdict or findings change.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Remove duplicated advisory evidence rollup
**Finding key:** loop-48875f36fcd2756f2020
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-evidence/14335cd58eb8ff2ea5ec7ef9763c7a89a549774d6d6e2a1f444b556b2b65b664.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-evidence/14335cd58eb8ff2ea5ec7ef9763c7a89a549774d6d6e2a1f444b556b2b65b664.json`  
**Requirement:** R8  
**Issue:** The artifact stores a large flat `advisoryFindings` array with repeated finding shapes where `findingId` and `fingerprint` are always identical, and `evidenceRefs` repeats the same `impl-review.json#<id>` derivation. This duplicates derived data and makes the committed evidence noisy and harder to audit.  
**Suggestion:** Store the canonical finding identifier once per entry and derive `fingerprint`/`evidenceRefs` when rendering or validating the evidence, or introduce a compact evidence-entry format for generated review artifacts.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-evidence/14335cd58eb8ff2ea5ec7ef9763c7a89a549774d6d6e2a1f444b556b2b65b664.json`  
**Requirement:** R8  
**Issue:** The artifact stores a large flat `advisoryFindings` array with repeated finding shapes where `findingId` and `fingerprint` are always identical, and `evidenceRefs` repeats the same `impl-review.json#<id>` derivation. This duplicates derived data and makes the committed evidence noisy and harder to audit.  
**Suggestion:** Store the canonical finding identifier once per entry and derive `fingerprint`/`evidenceRefs` when rendering or validating the evidence, or introduce a compact evidence-entry format for generated review artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Normalize repeated rejected test evidence shape
**Finding key:** loop-33edf278f4f414aa18e6
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-evidence/1df24344b3df3fb62c45aa20eb47499165e847d946a13685cac6c7383d8ee0bc.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-evidence/1df24344b3df3fb62c45aa20eb47499165e847d946a13685cac6c7383d8ee0bc.json`  
**Requirement:** R8  
**Issue:** Each blocking finding repeats the same `findingId`/`fingerprint`/`evidenceRefs` pattern, with `evidenceRefs` mechanically derived from `test-review.json` and the same hash. This mirrors the duplication seen in the other evidence files.  
**Suggestion:** Replace the duplicated fields with a single canonical finding reference, for example `{ "source": "test-review.json", "findingId": "..." }`, and have consumers derive the full ref and fingerprint consistently.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-evidence/1df24344b3df3fb62c45aa20eb47499165e847d946a13685cac6c7383d8ee0bc.json`  
**Requirement:** R8  
**Issue:** Each blocking finding repeats the same `findingId`/`fingerprint`/`evidenceRefs` pattern, with `evidenceRefs` mechanically derived from `test-review.json` and the same hash. This mirrors the duplication seen in the other evidence files.  
**Suggestion:** Replace the duplicated fields with a single canonical finding reference, for example `{ "source": "test-review.json", "findingId": "..." }`, and have consumers derive the full ref and fingerprint consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Normalize repeated rejected test evidence shape
**Finding key:** loop-617eeac9e1c717ca5ac9
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-evidence/2128352e7fd65a0d520c6282f2af2897947bdba23da38bbebc075f38f452c5b9.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-evidence/2128352e7fd65a0d520c6282f2af2897947bdba23da38bbebc075f38f452c5b9.json`  
**Requirement:** R8  
**Issue:** The blocking findings repeat the same generated metadata layout as `1df24344...json`, creating another copy of the same evidence-record structure.  
**Suggestion:** Use the same compact canonical finding-reference representation across rejected test evidence artifacts so the schema has one obvious source of truth for finding identity.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-evidence/2128352e7fd65a0d520c6282f2af2897947bdba23da38bbebc075f38f452c5b9.json`  
**Requirement:** R8  
**Issue:** The blocking findings repeat the same generated metadata layout as `1df24344...json`, creating another copy of the same evidence-record structure.  
**Suggestion:** Use the same compact canonical finding-reference representation across rejected test evidence artifacts so the schema has one obvious source of truth for finding identity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 5. Avoid committing volatile provenance when evidence is meant to be stable
**Finding key:** loop-3ba7bab0c2de252f430d
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-evidence/522e86daef92470a1f1b2446a0023441d5bf0e135f370f55f63d951c768f4509.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-evidence/522e86daef92470a1f1b2446a0023441d5bf0e135f370f55f63d951c768f4509.json`  
**Requirement:** R8  
**Issue:** This pass artifact contains only a stable verdict plus volatile `capturedAt`/`invocationId` metadata, making the file mostly timestamp churn.  
**Suggestion:** Keep the stable review result in this artifact and store run-specific provenance elsewhere, or omit provenance for passing artifacts if it is not consumed by downstream logic.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-evidence/522e86daef92470a1f1b2446a0023441d5bf0e135f370f55f63d951c768f4509.json`  
**Requirement:** R8  
**Issue:** This pass artifact contains only a stable verdict plus volatile `capturedAt`/`invocationId` metadata, making the file mostly timestamp churn.  
**Suggestion:** Keep the stable review result in this artifact and store run-specific provenance elsewhere, or omit provenance for passing artifacts if it is not consumed by downstream logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Remove duplicated finding bodies in attempt JSON
**Finding key:** loop-d59acd8bfe5385ca51df
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/impl-attempt-003.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R8  
**Issue:** Each non-blocking improvement stores the full proposal text in both `issue` and `suggestion`, and the same finding is then duplicated again in the top-level `findings` array as `body`. This creates a large generated artifact with multiple sources of truth for the same review text.  
**Suggestion:** Store canonical fields once, for example `issue` as the problem text and `suggestion` as the remediation text, then derive markdown/body renderings during output generation instead of persisting duplicated formatted blocks.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R8  
**Issue:** Each non-blocking improvement stores the full proposal text in both `issue` and `suggestion`, and the same finding is then duplicated again in the top-level `findings` array as `body`. This creates a large generated artifact with multiple sources of truth for the same review text.  
**Suggestion:** Store canonical fields once, for example `issue` as the problem text and `suggestion` as the remediation text, then derive markdown/body renderings during output generation instead of persisting duplicated formatted blocks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Fix markdown renderer field nesting
**Finding key:** loop-9820be5d5ec37ec45922
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/impl-attempt-003.md
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.md`  
**Requirement:** R8  
**Issue:** Each proposal renders nested `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:** blocks inside both the `Issue` and `Suggestion` sections. This makes the review hard to scan and suggests the renderer is passing already-formatted proposal text through a second template.  
**Suggestion:** Normalize review proposal data before rendering so `Issue` contains only the issue description and `Suggestion` contains only the concrete improvement.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.md`  
**Requirement:** R8  
**Issue:** Each proposal renders nested `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:** blocks inside both the `Issue` and `Suggestion` sections. This makes the review hard to scan and suggests the renderer is passing already-formatted proposal text through a second template.  
**Suggestion:** Normalize review proposal data before rendering so `Issue` contains only the issue description and `Suggestion` contains only the concrete improvement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Deduplicate repeated proposals
**Finding key:** loop-d67b6ebeaaafe4fcd238
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/impl-attempt-003.json
**Requirement:** R4
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R4  
**Issue:** Several proposals are semantically duplicated, such as the two `src/flow/commands/review.js` repair-target field preservation findings and the two `spec-review.json` consistency findings. This inflates counts and makes prioritization noisy.  
**Suggestion:** Deduplicate findings by stable fingerprint over normalized `{file, requirementId, issue, suggestion}` content before writing `nonBlockingImprovements` and `findings`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R4  
**Issue:** Several proposals are semantically duplicated, such as the two `src/flow/commands/review.js` repair-target field preservation findings and the two `spec-review.json` consistency findings. This inflates counts and makes prioritization noisy.  
**Suggestion:** Deduplicate findings by stable fingerprint over normalized `{file, requirementId, issue, suggestion}` content before writing `nonBlockingImprovements` and `findings`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Strip conversational text from generated titles
**Finding key:** loop-a23991fb48056a1e3c06
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/impl-attempt-003.md
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.md`  
**Requirement:** R8  
**Issue:** Proposal 35 has a title beginning with conversational status text: “I’ll review only the three files...”. That text is not part of the finding title and appears to have leaked from provider output.  
**Suggestion:** Sanitize generated titles by extracting only the heading text after the proposal marker, and reject or repair provider output that includes preamble text inside a finding title.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.md`  
**Requirement:** R8  
**Issue:** Proposal 35 has a title beginning with conversational status text: “I’ll review only the three files...”. That text is not part of the finding title and appears to have leaked from provider output.  
**Suggestion:** Sanitize generated titles by extracting only the heading text after the proposal marker, and reject or repair provider output that includes preamble text inside a finding title.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Enforce diff-scope filtering before persisting findings
**Finding key:** loop-ebfd0ec8475b7317c990
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/impl-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R1  
**Issue:** The artifact records 40 proposals, but most `file` values point to files not present in the supplied diff. The artifact even reports `outOfScope: 5`, while many more entries appear out of scope for this change set.  
**Suggestion:** Apply the touched-file allowlist before writing review history, so persisted findings only reference files from the reviewed diff and excluded counts reflect every discarded out-of-scope proposal.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R1  
**Issue:** The artifact records 40 proposals, but most `file` values point to files not present in the supplied diff. The artifact even reports `outOfScope: 5`, while many more entries appear out of scope for this change set.  
**Suggestion:** Apply the touched-file allowlist before writing review history, so persisted findings only reference files from the reviewed diff and excluded counts reflect every discarded out-of-scope proposal.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 6. Add explicit bounds for persisted review findings
**Finding key:** loop-686cf74289e5f02b2e74
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/impl-attempt-003.json
**Requirement:** R3
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R3  
**Issue:** `nonBlockingImprovements` and `findings` each contain 40 entries, with large duplicated text blocks. The artifact does not record any maximum finding count or truncation policy, which weakens the bounded-resource-usage guardrail for bulk review output.  
**Suggestion:** Record and enforce a maximum persisted finding count, plus structured fields such as `findingLimit`, `truncated`, and `candidateCount` when provider output exceeds the bound.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/impl-attempt-003.json`  
**Requirement:** R3  
**Issue:** `nonBlockingImprovements` and `findings` each contain 40 entries, with large duplicated text blocks. The artifact does not record any maximum finding count or truncation policy, which weakens the bounded-resource-usage guardrail for bulk review output.  
**Suggestion:** Record and enforce a maximum persisted finding count, plus structured fields such as `findingLimit`, `truncated`, and `candidateCount` when provider output exceeds the bound.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Remove duplicated finding payloads
**Finding key:** loop-e921267915a5352f3b6b
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each finding is stored twice: once in `blockingFindings` and again in `findings`, with largely duplicated title/body/rationale/fingerprint data. This increases drift risk between the two representations.  
**Suggestion:** Keep one canonical finding list and derive grouped views such as `blockingFindings` from it when rendering or reading the artifact.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each finding is stored twice: once in `blockingFindings` and again in `findings`, with largely duplicated title/body/rationale/fingerprint data. This increases drift risk between the two representations.  
**Suggestion:** Keep one canonical finding list and derive grouped views such as `blockingFindings` from it when rendering or reading the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Remove duplicated finding payloads
**Finding key:** loop-5be110bd29b4ac5d0990
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-002.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-002.json`  
**Requirement:** R8  
**Issue:** The same blocking findings are duplicated in both `blockingFindings` and `findings`. This repeats identifiers, fingerprints, rationale, and body text without adding distinct information.  
**Suggestion:** Store findings once, then compute severity-specific collections from the canonical list.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-002.json`  
**Requirement:** R8  
**Issue:** The same blocking findings are duplicated in both `blockingFindings` and `findings`. This repeats identifiers, fingerprints, rationale, and body text without adding distinct information.  
**Suggestion:** Store findings once, then compute severity-specific collections from the canonical list.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Add trailing newline
**Finding key:** loop-9af9050291a899a74ccd
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/spec-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with standard text-file formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with standard text-file formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Add trailing newline
**Finding key:** loop-597c1737c7002a61584f
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The Markdown file has no trailing newline, creating avoidable formatting inconsistency.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The Markdown file has no trailing newline, creating avoidable formatting inconsistency.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Add trailing newline
**Finding key:** loop-4ce7adfe661373a8f101
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec-review.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/spec-review.md`  
**Requirement:** R1  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with standard text-file formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec-review.md`  
**Requirement:** R1  
**Issue:** The Markdown file has no trailing newline, which is inconsistent with standard text-file formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Avoid persisting proposals twice
**Finding key:** loop-51d0bcaad54e424f4fff
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R1  
**Issue:** `rawResponse` stores the full formatted proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates substantial data and can drift if one representation is regenerated or repaired independently.  
**Suggestion:** Keep `success.proposals[]` as the canonical structured representation, and store only a raw response reference, checksum, or omit `rawResponse` after successful parsing.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R1  
**Issue:** `rawResponse` stores the full formatted proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates substantial data and can drift if one representation is regenerated or repaired independently.  
**Suggestion:** Keep `success.proposals[]` as the canonical structured representation, and store only a raw response reference, checksum, or omit `rawResponse` after successful parsing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Remove duplicated work-unit identity fields
**Finding key:** loop-7310faac278106dc1d11
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R1  
**Issue:** Fields such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` appear both inside `identity` and again at the top level with identical values.  
**Suggestion:** Make `identity` the canonical location for identity metadata, or keep top-level fields only when they represent mutable execution state. Avoid storing identical immutable fields in both places.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R1  
**Issue:** Fields such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` appear both inside `identity` and again at the top level with identical values.  
**Suggestion:** Make `identity` the canonical location for identity metadata, or keep top-level fields only when they represent mutable execution state. Avoid storing identical immutable fields in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 3. Remove duplicated work-unit identity fields
**Finding key:** loop-068a992ce9f37fb09a2c
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R1  
**Issue:** This file repeats the same identity duplication pattern: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` are stored both under `identity` and top-level fields.  
**Suggestion:** Use the same single-source-of-truth structure as the other work-unit artifact, preferably by adjusting the generator so all impl-review work units share one normalized schema.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R1  
**Issue:** This file repeats the same identity duplication pattern: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` are stored both under `identity` and top-level fields.  
**Suggestion:** Use the same single-source-of-truth structure as the other work-unit artifact, preferably by adjusting the generator so all impl-review work units share one normalized schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 4. Normalize duplicate result naming
**Finding key:** loop-d2a0e40e3ddedb74ccaa
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** `contractSummary.verdict` and `contractSummary.result` both contain `"PASS"`, creating two names for the same outcome.  
**Suggestion:** Keep one canonical field, ideally `verdict` if that matches the surrounding artifact vocabulary, and derive any display wording from it during rendering.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** `contractSummary.verdict` and `contractSummary.result` both contain `"PASS"`, creating two names for the same outcome.  
**Suggestion:** Keep one canonical field, ideally `verdict` if that matches the surrounding artifact vocabulary, and derive any display wording from it during rendering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Avoid persisting proposals twice
**Finding key:** loop-e6bb6cd9c992a3d7b081
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/test-review.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** `rawResponse` stores the full formatted proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates substantial data and can drift if one representation is regenerated or repaired independently.  
**Suggestion:** Keep `success.proposals[]` as the canonical structured representation, and store only a raw response reference, checksum, or omit `rawResponse` after successful parsing.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** `rawResponse` stores the full formatted proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates substantial data and can drift if one representation is regenerated or repaired independently.  
**Suggestion:** Keep `success.proposals[]` as the canonical structured representation, and store only a raw response reference, checksum, or omit `rawResponse` after successful parsing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Remove duplicated work-unit identity fields
**Finding key:** loop-a2f914e0606e935a8858
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/test-review.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** Fields such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` appear both inside `identity` and again at the top level with identical values.  
**Suggestion:** Make `identity` the canonical location for identity metadata, or keep top-level fields only when they represent mutable execution state. Avoid storing identical immutable fields in both places.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** Fields such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` appear both inside `identity` and again at the top level with identical values.  
**Suggestion:** Make `identity` the canonical location for identity metadata, or keep top-level fields only when they represent mutable execution state. Avoid storing identical immutable fields in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Remove duplicated work-unit identity fields
**Finding key:** loop-7143ad4aa12b9f0c546c
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/test-review.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** This file repeats the same identity duplication pattern: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` are stored both under `identity` and top-level fields.  
**Suggestion:** Use the same single-source-of-truth structure as the other work-unit artifact, preferably by adjusting the generator so all impl-review work units share one normalized schema.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** This file repeats the same identity duplication pattern: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` are stored both under `identity` and top-level fields.  
**Suggestion:** Use the same single-source-of-truth structure as the other work-unit artifact, preferably by adjusting the generator so all impl-review work units share one normalized schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Normalize duplicate result naming
**Finding key:** loop-482deac6a84803ef8e6d
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/test-review.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** `contractSummary.verdict` and `contractSummary.result` both contain `"PASS"`, creating two names for the same outcome.  
**Suggestion:** Keep one canonical field, ideally `verdict` if that matches the surrounding artifact vocabulary, and derive any display wording from it during rendering.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R1  
**Issue:** `contractSummary.verdict` and `contractSummary.result` both contain `"PASS"`, creating two names for the same outcome.  
**Suggestion:** Keep one canonical field, ideally `verdict` if that matches the surrounding artifact vocabulary, and derive any display wording from it during rendering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Remove duplicated work-unit identity fields
**Finding key:** loop-bf259913cc1959192700
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R7  
**Issue:** The work unit stores `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` both at the top level and inside `identity`. The same duplication appears across these generated work-unit artifacts, increasing drift risk without adding information.  
**Suggestion:** Keep immutable identity metadata under `identity` and remove the duplicated top-level copies, or keep top-level fields and reduce `identity` to only fields that are not already represented.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R7  
**Issue:** The work unit stores `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` both at the top level and inside `identity`. The same duplication appears across these generated work-unit artifacts, increasing drift risk without adding information.  
**Suggestion:** Keep immutable identity metadata under `identity` and remove the duplicated top-level copies, or keep top-level fields and reduce `identity` to only fields that are not already represented.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Avoid persisting both raw and parsed proposal payloads
**Finding key:** loop-218394d4891f87903736
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/99d5a512adc8a07b358722f3.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/99d5a512adc8a07b358722f3.json`  
**Requirement:** R7  
**Issue:** `rawResponse` contains the full markdown proposal text, while `success.proposals[*].body` repeats the same content. This doubles bulk artifact size and can cause inconsistencies if one representation is repaired or normalized without the other.  
**Suggestion:** Persist only the parsed `success.proposals` as canonical data. If raw provider output is needed for debugging, move it to bounded debug evidence or store a hash/reference instead.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/99d5a512adc8a07b358722f3.json`  
**Requirement:** R7  
**Issue:** `rawResponse` contains the full markdown proposal text, while `success.proposals[*].body` repeats the same content. This doubles bulk artifact size and can cause inconsistencies if one representation is repaired or normalized without the other.  
**Suggestion:** Persist only the parsed `success.proposals` as canonical data. If raw provider output is needed for debugging, move it to bounded debug evidence or store a hash/reference instead.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 3. Replace formatted numbering inside proposal titles
**Finding key:** loop-589d07f7e23c66f16488
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R8  
**Issue:** `success.proposals[*].title` includes display numbering such as `"1. Split dense validation text into structured cases"`. The array order already provides ordering, so embedding numbers in the title mixes presentation with data and creates renumbering churn.  
**Suggestion:** Store titles without ordinal prefixes and let renderers add numbering when formatting review output.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R8  
**Issue:** `success.proposals[*].title` includes display numbering such as `"1. Split dense validation text into structured cases"`. The array order already provides ordering, so embedding numbers in the title mixes presentation with data and creates renumbering churn.  
**Suggestion:** Store titles without ordinal prefixes and let renderers add numbering when formatting review output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 4. Preserve valid file paths instead of glob-like proposal files
**Finding key:** loop-20a436eda8d0dd91931a
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/99d5a512adc8a07b358722f3.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/99d5a512adc8a07b358722f3.json`  
**Requirement:** R8  
**Issue:** Several parsed proposals use non-concrete file values such as `specs/330-draft-review-repair-target/*.json`, `*-gate-source.json`, and `review-history/*.md`. That is inconsistent with the review contract requiring a specific touched file path and makes downstream validation ambiguous.  
**Suggestion:** Reject or normalize provider proposals whose `file` is not an exact path from the work unit’s `targetFiles`; split cross-file suggestions into separate proposals with concrete files.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/99d5a512adc8a07b358722f3.json`  
**Requirement:** R8  
**Issue:** Several parsed proposals use non-concrete file values such as `specs/330-draft-review-repair-target/*.json`, `*-gate-source.json`, and `review-history/*.md`. That is inconsistent with the review contract requiring a specific touched file path and makes downstream validation ambiguous.  
**Suggestion:** Reject or normalize provider proposals whose `file` is not an exact path from the work unit’s `targetFiles`; split cross-file suggestions into separate proposals with concrete files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 1. Remove duplicated work-unit metadata
**Finding key:** loop-d158f8817275f0191a5c
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R1  
**Issue:** `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` are stored both inside `identity` and again at the top level. This creates drift risk in persisted review artifacts.  
**Suggestion:** Keep `identity` as the canonical metadata block and remove the duplicated top-level fields, or store only a compact reference at the top level if consumers require direct access.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R1  
**Issue:** `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` are stored both inside `identity` and again at the top level. This creates drift risk in persisted review artifacts.  
**Suggestion:** Keep `identity` as the canonical metadata block and remove the duplicated top-level fields, or store only a compact reference at the top level if consumers require direct access.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 2. Store review proposals once
**Finding key:** loop-803fce0175ad4c94bdd0
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json
**Requirement:** R2
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R2  
**Issue:** The same proposals are duplicated in `rawResponse` as rendered markdown and in `success.proposals` as structured data. Any repair to one representation can leave the other stale.  
**Suggestion:** Persist only `success.proposals` and render markdown on demand, or mark `rawResponse` as debug-only output outside the durable artifact schema.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R2  
**Issue:** The same proposals are duplicated in `rawResponse` as rendered markdown and in `success.proposals` as structured data. Any repair to one representation can leave the other stale.  
**Suggestion:** Persist only `success.proposals` and render markdown on demand, or mark `rawResponse` as debug-only output outside the durable artifact schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 3. Apply the same work-unit normalization to the second review artifact
**Finding key:** loop-e9379e3699b14aa3bdb2
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json
**Requirement:** R3
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R3  
**Issue:** This file repeats the same two duplication patterns: identity metadata is copied at two levels, and proposal content is stored both as `rawResponse` markdown and as structured `success.proposals`.  
**Suggestion:** Use the same single-source representation as the other impl-review work unit so all review-history artifacts follow one consistent schema.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R3  
**Issue:** This file repeats the same two duplication patterns: identity metadata is copied at two levels, and proposal content is stored both as `rawResponse` markdown and as structured `success.proposals`.  
**Suggestion:** Use the same single-source representation as the other impl-review work unit so all review-history artifacts follow one consistent schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 4. Extract repeated scenario evidence fields
**Finding key:** loop-317a3486e3b862195dc3
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/scenario-validity-result.json
**Requirement:** R4
**Issue:** **File:** `specs/330-draft-review-repair-target/scenario-validity-result.json`  
**Requirement:** R4  
**Issue:** Every `summary[].evidence` repeats the identical `command` and `raw_output_lines` range. This makes the artifact verbose and increases the chance of inconsistent edits if the command or output range changes.  
**Suggestion:** Move shared evidence such as `command` and common raw output range to a top-level `evidence` or `run` block, and keep per-requirement entries limited to `test_file`, `test_name`, and requirement-specific classification.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/scenario-validity-result.json`  
**Requirement:** R4  
**Issue:** Every `summary[].evidence` repeats the identical `command` and `raw_output_lines` range. This makes the artifact verbose and increases the chance of inconsistent edits if the command or output range changes.  
**Suggestion:** Move shared evidence such as `command` and common raw output range to a top-level `evidence` or `run` block, and keep per-requirement entries limited to `test_file`, `test_name`, and requirement-specific classification.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 5. Normalize duplicated gate findings
**Finding key:** loop-015c965d7dd9586505dc
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec-gate-source.json
**Requirement:** R5
**Issue:** **File:** `specs/330-draft-review-repair-target/spec-gate-source.json`  
**Requirement:** R5  
**Issue:** Each violation appears in both `evaluations[].observations[]` and top-level `observations[]`, with duplicated `where`, `observed`, severity, guardrail, disposition, rationale, and timestamps.  
**Suggestion:** Store one canonical finding list and have evaluations reference finding IDs, or derive top-level observations from evaluations during rendering.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec-gate-source.json`  
**Requirement:** R5  
**Issue:** Each violation appears in both `evaluations[].observations[]` and top-level `observations[]`, with duplicated `where`, `observed`, severity, guardrail, disposition, rationale, and timestamps.  
**Suggestion:** Store one canonical finding list and have evaluations reference finding IDs, or derive top-level observations from evaluations during rendering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 6. Use requirement IDs instead of null
**Finding key:** loop-cf0049817bff31edf314
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** The first evaluation explicitly points to `requirements[R8].desc`, but `requirementId` is `null`. The test-strategy findings also point to task locators that appear tied to requirements, but the structured field is empty.  
**Suggestion:** Populate `requirementId` when the locator or reason identifies a requirement, especially `R8` for `requirements[R8].desc`, and reserve `null` for truly cross-cutting findings.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** The first evaluation explicitly points to `requirements[R8].desc`, but `requirementId` is `null`. The test-strategy findings also point to task locators that appear tied to requirements, but the structured field is empty.  
**Suggestion:** Populate `requirementId` when the locator or reason identifies a requirement, especially `R8` for `requirements[R8].desc`, and reserve `null` for truly cross-cutting findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 2. Fix stale task status inconsistency
**Finding key:** loop-2cf1f5c077eafbf2a404
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R1  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That creates contradictory lifecycle state in the same source of truth.  
**Suggestion:** Either keep requirements pending until their tasks are complete, or update the task statuses to match the completed requirements after verified implementation evidence exists.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R1  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That creates contradictory lifecycle state in the same source of truth.  
**Suggestion:** Either keep requirements pending until their tasks are complete, or update the task statuses to match the completed requirements after verified implementation evidence exists.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 4. Avoid duplicating source module facts
**Finding key:** loop-099b1316d88f43703317
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec.json
**Requirement:** R4
**Issue:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R4  
**Issue:** `overview.modules` lists `src/flow/commands/review.js` twice: once for current responsibility and once for the new repairTargets behavior. This repeats the same module ownership instead of consolidating the design point.  
**Suggestion:** Merge the two entries into one module description that covers both draft artifact normalization and the new repair target advisory mapping.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R4  
**Issue:** `overview.modules` lists `src/flow/commands/review.js` twice: once for current responsibility and once for the new repairTargets behavior. This repeats the same module ownership instead of consolidating the design point.  
**Suggestion:** Merge the two entries into one module description that covers both draft artifact normalization and the new repair target advisory mapping.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 5. Consolidate repeated repair target fixture text
**Finding key:** loop-0213adfdcba2f0a3e412
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R8  
**Issue:** The exact R8 fixture values are repeated across `requirements`, `tasks[T-2].acceptance`, and acceptance criteria. Repeating long literals increases maintenance cost if the fixture changes.  
**Suggestion:** Define the R8 fixture once in a dedicated fixture/example section and reference it from requirement, task, and acceptance text.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R8  
**Issue:** The exact R8 fixture values are repeated across `requirements`, `tasks[T-2].acceptance`, and acceptance criteria. Repeating long literals increases maintenance cost if the fixture changes.  
**Suggestion:** Define the R8 fixture once in a dedicated fixture/example section and reference it from requirement, task, and acceptance text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 3. Remove empty placeholder sections
**Finding key:** loop-2d29277a6106b8f2a8bf
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec.md
**Requirement:** R5
**Issue:** **File:** `specs/330-draft-review-repair-target/spec.md`  
**Requirement:** R5  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders that add no information and can be mistaken for incomplete required content.  
**Suggestion:** Omit empty generated sections entirely, or render them as an explicit `None` only if the project convention requires visible empty sections.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec.md`  
**Requirement:** R5  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders that add no information and can be mistaken for incomplete required content.  
**Suggestion:** Omit empty generated sections entirely, or render them as an explicit `None` only if the project convention requires visible empty sections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 1. Remove duplicated gate findings
**Finding key:** loop-e41b2622aaa657e53370
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/task-impl-gate-source.json
**Requirement:** R6
**Issue:** **File:** `specs/330-draft-review-repair-target/task-impl-gate-source.json`  
**Requirement:** R6  
**Issue:** The same seven guardrail violations are represented twice, once under `evaluations` and again under top-level `observations`, with duplicated rationale, location, severity, and guardrail metadata. This makes the artifact harder to review and risks divergence between two copies of the same evidence.  
**Suggestion:** Keep one canonical representation and derive the other at render/read time, or store only references from `observations` to `evaluations` instead of duplicating full finding payloads.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/task-impl-gate-source.json`  
**Requirement:** R6  
**Issue:** The same seven guardrail violations are represented twice, once under `evaluations` and again under top-level `observations`, with duplicated rationale, location, severity, and guardrail metadata. This makes the artifact harder to review and risks divergence between two copies of the same evidence.  
**Suggestion:** Keep one canonical representation and derive the other at render/read time, or store only references from `observations` to `evaluations` instead of duplicating full finding payloads.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 2. Clarify bounded test execution wording
**Finding key:** loop-d6795860749dc360f6a2
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tasks/T-3.md
**Requirement:** R6
**Issue:** **File:** `specs/330-draft-review-repair-target/tasks/T-3.md`
**Requirement:** R6
**Issue:** The Test Strategy sentence combines several actions and includes “once” in multiple places, making the intended execution bounds harder to verify.
**Suggestion:** Split the Test Strategy into explicit bounded steps, for example: add R6/R7 scenarios, run the focused scenario command once per fixed tree SHA, then run `npm test` exactly once only after one independent audit PASS.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tasks/T-3.md`
**Requirement:** R6
**Issue:** The Test Strategy sentence combines several actions and includes “once” in multiple places, making the intended execution bounds harder to verify.
**Suggestion:** Split the Test Strategy into explicit bounded steps, for example: add R6/R7 scenarios, run the focused scenario command once per fixed tree SHA, then run `npm test` exactly once only after one independent audit PASS.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 1. Consolidate repeated execution evidence
**Finding key:** loop-443d08b72b61c50aa785
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/test-execute-result.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/test-execute-result.json`
**Requirement:** R1
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This duplicates metadata eight times and makes later corrections error-prone.
**Suggestion:** If the result schema permits it, move shared execution metadata to a top-level run/evidence object and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/test-execute-result.json`
**Requirement:** R1
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This duplicates metadata eight times and makes later corrections error-prone.
**Suggestion:** If the result schema permits it, move shared execution metadata to a top-level run/evidence object and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 1. Extract shared repair-target fixtures
**Finding key:** loop-746c3168a173a56c0181
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js
**Requirement:** R4
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`  
**Requirement:** R4  
**Issue:** `REPAIR_TARGET`, temp directory cleanup, and canonical history-to-disposition conversion are duplicated with `review-convergence-contract.test.js`. This makes future contract changes easy to update in one test but miss in the other.  
**Suggestion:** Move the shared repair target fixture and conversion helper into `review-fixture-helpers.js`, then import them from both touched test files.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`  
**Requirement:** R4  
**Issue:** `REPAIR_TARGET`, temp directory cleanup, and canonical history-to-disposition conversion are duplicated with `review-convergence-contract.test.js`. This makes future contract changes easy to update in one test but miss in the other.  
**Suggestion:** Move the shared repair target fixture and conversion helper into `review-fixture-helpers.js`, then import them from both touched test files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 2. Remove stale failing scenario log from passing change set
**Finding key:** loop-6eb73397cf660aa5d573
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/.raw/scenario-validity.log
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This newly added raw log records failing pre-fix output, while `test-review.json` and `test-execution.log` report PASS. Keeping contradictory generated evidence in the same change set makes review and later debugging harder.  
**Suggestion:** Replace this file with the final passing scenario-validity output, or omit the stale raw failure artifact if only final evidence is intended.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This newly added raw log records failing pre-fix output, while `test-review.json` and `test-execution.log` report PASS. Keeping contradictory generated evidence in the same change set makes review and later debugging harder.  
**Suggestion:** Replace this file with the final passing scenario-validity output, or omit the stale raw failure artifact if only final evidence is intended.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 3. Rename issue-specific fixture prefixes
**Finding key:** loop-f617890681e95763723a
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/review-convergence-contract.test.js
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/review-convergence-contract.test.js`  
**Requirement:** R7  
**Issue:** Temporary directory prefixes and provider names use `issue-454-*`, but the spec path is `330-draft-review-repair-target`. The mismatch looks like copied fixture naming and weakens traceability.  
**Suggestion:** Rename prefixes such as `issue-454-convergence-` and provider `issue-454-fixture` to names derived from spec 330, for example `spec-330-convergence-` and `spec-330-fixture`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/review-convergence-contract.test.js`  
**Requirement:** R7  
**Issue:** Temporary directory prefixes and provider names use `issue-454-*`, but the spec path is `330-draft-review-repair-target`. The mismatch looks like copied fixture naming and weakens traceability.  
**Suggestion:** Rename prefixes such as `issue-454-convergence-` and provider `issue-454-fixture` to names derived from spec 330, for example `spec-330-convergence-` and `spec-330-fixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 4. Simplify repeated route assertions
**Finding key:** loop-20f46ddfbfe9eef7bf87
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`  
**Requirement:** R1  
**Issue:** The R1 and R2 tests repeat the same assertions for different routes. The only meaningful variation is `questions` vs `coverage`.  
**Suggestion:** Use a small helper like `assertRepairTargetOnlyRoute(route)` or loop over route cases with requirement-specific test names, so the canonical advisory contract is expressed once.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`  
**Requirement:** R1  
**Issue:** The R1 and R2 tests repeat the same assertions for different routes. The only meaningful variation is `questions` vs `coverage`.  
**Suggestion:** Use a small helper like `assertRepairTargetOnlyRoute(route)` or loop over route cases with requirement-specific test names, so the canonical advisory contract is expressed once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 1. Remove unused fixture helper
**Finding key:** loop-a2e6142a22515dcf84dd
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/review-fixture-helpers.js
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/review-fixture-helpers.js`  
**Requirement:** R8  
**Issue:** This new helper file is not referenced by the shown test diff, so it appears to be dead test support code. It also creates a second conversion path from history records to `ReviewFinding`, which risks drifting from the production normalization path the R8 test is meant to exercise.  
**Suggestion:** Delete the file unless another touched test imports it. Keep the R8 fixture replay test focused on `buildDraftReviewArtifact()` and `writeReviewAttemptHistory()` as the single exercised path.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/review-fixture-helpers.js`  
**Requirement:** R8  
**Issue:** This new helper file is not referenced by the shown test diff, so it appears to be dead test support code. It also creates a second conversion path from history records to `ReviewFinding`, which risks drifting from the production normalization path the R8 test is meant to exercise.  
**Suggestion:** Delete the file unless another touched test imports it. Keep the R8 fixture replay test focused on `buildDraftReviewArtifact()` and `writeReviewAttemptHistory()` as the single exercised path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 2. Make repair-target category explicit during normalization
**Finding key:** loop-d4f4345b580d5ccec0c3
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `repairTarget: true` adds `target` and `evidence`, but `category` still comes from `findingCategory(phase, item)`. If a raw `repairTargets` item does not already carry a category, the normalized record can depend on generic category inference instead of explicitly preserving `category=repair_target`.  
**Suggestion:** When `repairTarget` is true, set `category: "repair_target"` directly, otherwise use `findingCategory(phase, item)`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `repairTarget: true` adds `target` and `evidence`, but `category` still comes from `findingCategory(phase, item)`. If a raw `repairTargets` item does not already carry a category, the normalized record can depend on generic category inference instead of explicitly preserving `category=repair_target`.  
**Suggestion:** When `repairTarget` is true, set `category: "repair_target"` directly, otherwise use `findingCategory(phase, item)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 3. Simplify the R8 fixture object
**Finding key:** loop-62f4851bf4aef63d4598
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R8  
**Issue:** `DraftRepairTargetCheckpoint` is a fairly heavy class for a single immutable fixture used by one test. The methods mostly wrap object literals and make the test harder to scan.  
**Suggestion:** Replace it with a small fixture constant plus two local helper functions, for example `draftRepairTargetFixture`, `fixtureToProposal()`, and `fixtureToRecordingArtifact()`. That keeps the test’s intent visible while avoiding unnecessary object structure.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R8  
**Issue:** `DraftRepairTargetCheckpoint` is a fairly heavy class for a single immutable fixture used by one test. The methods mostly wrap object literals and make the test harder to scan.  
**Suggestion:** Replace it with a small fixture constant plus two local helper functions, for example `draftRepairTargetFixture`, `fixtureToProposal()`, and `fixtureToRecordingArtifact()`. That keeps the test’s intent visible while avoiding unnecessary object structure.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
