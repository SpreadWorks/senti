# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Consolidate repeated invariant wording
**Finding key:** loop-be70f22fd770c66db6d8
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/draft.json
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R4  
**Issue:** The PASS/ADVISORY/REJECTED invariants and duplicate-protection constraints are repeated across `analysis`, `decisionMap`, `scopeVerification`, `impactOnExisting`, and `qa`. This increases the chance that future edits update one section but leave another inconsistent.  
**Suggestion:** Define the invariant set once in a dedicated requirement/contract section, then reference it from the surrounding narrative instead of restating the full rule each time.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R4  
**Issue:** The PASS/ADVISORY/REJECTED invariants and duplicate-protection constraints are repeated across `analysis`, `decisionMap`, `scopeVerification`, `impactOnExisting`, and `qa`. This increases the chance that future edits update one section but leave another inconsistent.  
**Suggestion:** Define the invariant set once in a dedicated requirement/contract section, then reference it from the surrounding narrative instead of restating the full rule each time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Use behavior-based fixture naming
**Finding key:** loop-75ff279db52a77450366
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/draft.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R6  
**Issue:** The phrase “Issue #453 checkpoint-shaped fixture” appears multiple times and ties the validation description to another issue number rather than the actual behavior being tested. That makes the spec harder to understand without external context.  
**Suggestion:** Rename this fixture concept to a behavior-oriented name such as `single-pass repairTargets checkpoint fixture`, and keep `Issue #453` only as supporting evidence where needed.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R6  
**Issue:** The phrase “Issue #453 checkpoint-shaped fixture” appears multiple times and ties the validation description to another issue number rather than the actual behavior being tested. That makes the spec harder to understand without external context.  
**Suggestion:** Rename this fixture concept to a behavior-oriented name such as `single-pass repairTargets checkpoint fixture`, and keep `Issue #453` only as supporting evidence where needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Bound accumulated flow history arrays
**Finding key:** loop-dce9045338be3b22da26
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` grow by appending historical entries, but the state file records no explicit retention bound. This violates the `bounded-resource-usage` guardrail because repeated retries/reviews can grow the flow state without a count or size cap.  
**Suggestion:** Add or enforce a documented retention policy in the flow state producer, then reflect it in this file with bounded arrays or retention metadata, for example `maxRecords`, `maxMetrics`, or pruning to the latest N entries per phase/task while preserving canonical evidence references.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` grow by appending historical entries, but the state file records no explicit retention bound. This violates the `bounded-resource-usage` guardrail because repeated retries/reviews can grow the flow state without a count or size cap.  
**Suggestion:** Add or enforce a documented retention policy in the flow state producer, then reflect it in this file with bounded arrays or retention metadata, for example `maxRecords`, `maxMetrics`, or pruning to the latest N entries per phase/task while preserving canonical evidence references.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Deduplicate repeated provenance/evidence identity blocks
**Finding key:** loop-8bbbccffaac7a0130cc7
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R4  
**Issue:** Each `handoffFindings` entry repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values that are already present on the parent review-convergence record. This makes the state bulky and increases the chance of inconsistent updates.  
**Suggestion:** Store shared evidence identity and disposition fields only at the record level, and let findings contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R4  
**Issue:** Each `handoffFindings` entry repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values that are already present on the parent review-convergence record. This makes the state bulky and increases the chance of inconsistent updates.  
**Suggestion:** Store shared evidence identity and disposition fields only at the record level, and let findings contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Remove captured reviewer chatter from finding summaries
**Finding key:** loop-612ef7b4b6dce3e3a18c
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R3  
**Issue:** One finding summary includes process narration before the actual proposal title: `I’ll ground the review...### 1. Add an explicit bound...`. This looks like dead/non-domain text captured into persisted advisory data.  
**Suggestion:** Normalize persisted finding summaries to the proposal title/body only, and strip reviewer progress text before recording canonical findings.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R3  
**Issue:** One finding summary includes process narration before the actual proposal title: `I’ll ground the review...### 1. Add an explicit bound...`. This looks like dead/non-domain text captured into persisted advisory data.  
**Suggestion:** Normalize persisted finding summaries to the proposal title/body only, and strip reviewer progress text before recording canonical findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 4. Normalize duplicated proposal numbering inside summaries
**Finding key:** loop-26c3d247767038a2e299
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R5  
**Issue:** Many `summary` values embed local numbering like `1.`, `2.`, `3.` even though each finding already has a stable `findingId` and the array position is not semantically meaningful. Repeated local numbering from separate reviews creates misleading duplicates such as multiple `1.` entries.  
**Suggestion:** Persist summaries without presentation numbering, or store display order separately if needed. For example, use `summary: "Consolidate repeated invariant wording"` instead of `summary: "1. Consolidate repeated invariant wording"`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R5  
**Issue:** Many `summary` values embed local numbering like `1.`, `2.`, `3.` even though each finding already has a stable `findingId` and the array position is not semantically meaningful. Repeated local numbering from separate reviews creates misleading duplicates such as multiple `1.` entries.  
**Suggestion:** Persist summaries without presentation numbering, or store display order separately if needed. For example, use `summary: "Consolidate repeated invariant wording"` instead of `summary: "1. Consolidate repeated invariant wording"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 5. Align lifecycle status with completed runtime logs
**Finding key:** loop-1bd05945a4e7dbde5475
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R6  
**Issue:** Some steps are marked `pending` while also carrying completed `runtimeLog` entries, such as `retro` and `acceptance-review`. This mixes lifecycle state with historical execution data and makes the flow status harder to reason about.  
**Suggestion:** Either clear runtime logs from pending steps or update the step status model so prior attempts are stored under an explicit `attemptHistory` field, separate from the current lifecycle status.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R6  
**Issue:** Some steps are marked `pending` while also carrying completed `runtimeLog` entries, such as `retro` and `acceptance-review`. This mixes lifecycle state with historical execution data and makes the flow status harder to reason about.  
**Suggestion:** Either clear runtime logs from pending steps or update the step status model so prior attempts are stored under an explicit `attemptHistory` field, separate from the current lifecycle status.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Remove Duplicated Bilingual Body
**Finding key:** loop-9264f4b0dd55c1f957e5
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue.md`  
**Requirement:** R1  
**Issue:** The Japanese `<details>` section duplicates nearly the entire English issue body. This creates a high drift risk: future edits may update one version but not the other, especially for acceptance criteria and invariants.  
**Suggestion:** Keep the English canonical issue body and replace the Japanese section with a short localized summary plus a pointer that the English sections are authoritative. If full bilingual text is required, explicitly mark one section as canonical.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue.md`  
**Requirement:** R1  
**Issue:** The Japanese `<details>` section duplicates nearly the entire English issue body. This creates a high drift risk: future edits may update one version but not the other, especially for acceptance criteria and invariants.  
**Suggestion:** Keep the English canonical issue body and replace the Japanese section with a short localized summary plus a pointer that the English sections are authoritative. If full bilingual text is required, explicitly mark one section as canonical.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Clarify Requirement Mapping For Acceptance Criteria
**Finding key:** loop-f4983abcf3fa98f92f67
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue.md`  
**Requirement:** R8  
**Issue:** The acceptance criteria are numbered 1-8, but the review contract refers to requirement IDs `R1` through `R8`. The document does not explicitly map criterion numbers to requirement IDs, which can cause ambiguity in implementation review output.  
**Suggestion:** Rename the acceptance criteria entries to `R1` through `R8`, or add a short sentence such as “Acceptance Criteria 1-8 correspond to requirements R1-R8.”
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue.md`  
**Requirement:** R8  
**Issue:** The acceptance criteria are numbered 1-8, but the review contract refers to requirement IDs `R1` through `R8`. The document does not explicitly map criterion numbers to requirement IDs, which can cause ambiguity in implementation review output.  
**Suggestion:** Rename the acceptance criteria entries to `R1` through `R8`, or add a short sentence such as “Acceptance Criteria 1-8 correspond to requirements R1-R8.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Add Explicit Bound To Evidence Fixture Size
**Finding key:** loop-6816ba94f46c70eb44c5
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue.md`  
**Requirement:** R8  
**Issue:** The focused verification asks to convert Issue #453 raw evidence into a fixture, but does not state a size or scope bound. This touches the `bounded-resource-usage` guardrail because raw evidence fixtures can grow into unbounded bulk data if copied wholesale.  
**Suggestion:** Specify that the fixture should be minimal and bounded, for example: “Use a minimized fixture containing only the fields required to reproduce producer -> canonical recording; do not import full review history or unrelated artifact payloads.”
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue.md`  
**Requirement:** R8  
**Issue:** The focused verification asks to convert Issue #453 raw evidence into a fixture, but does not state a size or scope bound. This touches the `bounded-resource-usage` guardrail because raw evidence fixtures can grow into unbounded bulk data if copied wholesale.  
**Suggestion:** Specify that the fixture should be minimal and bounded, for example: “Use a minimized fixture containing only the fields required to reproduce producer -> canonical recording; do not import full review history or unrelated artifact payloads.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Remove duplicated issue number if schema allows
**Finding key:** loop-eb9dd2bec264a192ec2a
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/plugin-artifacts/workflow/prepare.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The issue number is stored twice as `issue` and `result.issueNumber`, which creates a small consistency risk if one value is later updated without the other.  
**Suggestion:** Keep a single source of truth for the issue number, preferably `result.issueNumber` if this file mirrors workflow command output, or remove `result.issueNumber` if the top-level `issue` field is the intended artifact key.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The issue number is stored twice as `issue` and `result.issueNumber`, which creates a small consistency risk if one value is later updated without the other.  
**Suggestion:** Keep a single source of truth for the issue number, preferably `result.issueNumber` if this file mirrors workflow command output, or remove `result.issueNumber` if the top-level `issue` field is the intended artifact key.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Consolidate Repeated Draft Phase Wording
**Finding key:** loop-7fce8a737b9b733e8dc7
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R1  
**Issue:** The spec repeats the same `draft-questions` / `draft-coverage` canonical advisory contract across `scope.in`, requirements R1/R2, acceptance criteria AC1/AC2, and task acceptance. This makes future edits more error-prone because the same behavior is described in several slightly different places.  
**Suggestion:** Introduce a single shared phrase such as “draft repair phases (`draft-questions`, `draft-coverage`)” in the relevant descriptions, then keep R1/R2 only for phase-specific acceptance. This reduces duplication while preserving separate requirement traceability.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R1  
**Issue:** The spec repeats the same `draft-questions` / `draft-coverage` canonical advisory contract across `scope.in`, requirements R1/R2, acceptance criteria AC1/AC2, and task acceptance. This makes future edits more error-prone because the same behavior is described in several slightly different places.  
**Suggestion:** Introduce a single shared phrase such as “draft repair phases (`draft-questions`, `draft-coverage`)” in the relevant descriptions, then keep R1/R2 only for phase-specific acceptance. This reduces duplication while preserving separate requirement traceability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Remove Implementation Status From Initial Spec
**Finding key:** loop-3afb1a6ae6831fd44f11
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R8  
**Issue:** All requirements are marked `"status": "done"` while task `T-1` is still `"status": "pending"`. That creates an inconsistent lifecycle signal inside the same spec.  
**Suggestion:** Set requirement statuses to a planning-state value if supported by the project convention, or omit them until implementation evidence has been recorded. Keep completion state in one authoritative place.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R8  
**Issue:** All requirements are marked `"status": "done"` while task `T-1` is still `"status": "pending"`. That creates an inconsistent lifecycle signal inside the same spec.  
**Suggestion:** Set requirement statuses to a planning-state value if supported by the project convention, or omit them until implementation evidence has been recorded. Keep completion state in one authoritative place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Simplify Overlapping Verification Text
**Finding key:** loop-053731574c842f26e7ea
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R6  
**Issue:** The same invariant is repeated in `constraints`, `overview.decisions`, `acceptance_criteria`, and `tasks.acceptance`: PASS has zero findings, ADVISORY has advisory findings only, REJECTED has blocking findings. The repetition is useful for emphasis but increases maintenance cost.  
**Suggestion:** Keep the full invariant once in `constraints`, then refer to it elsewhere as “the existing ReviewDisposition invariant” unless a section needs a specific test expectation.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R6  
**Issue:** The same invariant is repeated in `constraints`, `overview.decisions`, `acceptance_criteria`, and `tasks.acceptance`: PASS has zero findings, ADVISORY has advisory findings only, REJECTED has blocking findings. The repetition is useful for emphasis but increases maintenance cost.  
**Suggestion:** Keep the full invariant once in `constraints`, then refer to it elsewhere as “the existing ReviewDisposition invariant” unless a section needs a specific test expectation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Add Explicit Resource Bounds For Checkpoint Fixture Processing
**Finding key:** loop-32998d4fa7ebe3d27059
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R8  
**Issue:** The bounded-resource-usage guardrail requires explicit upper bounds for bulk data loading or recursive processing. R8 and the test strategy mention replaying a checkpoint-shaped artifact, but the spec does not state a maximum number of repair targets, findings, or artifact size for that processing path.  
**Suggestion:** Add a constraint or matched acknowledgment rationale that defines the applicable bound, for example by referencing the existing finding budget or specifying that checkpoint replay processes only the single provided artifact and its bounded finding buckets.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R8  
**Issue:** The bounded-resource-usage guardrail requires explicit upper bounds for bulk data loading or recursive processing. R8 and the test strategy mention replaying a checkpoint-shaped artifact, but the spec does not state a maximum number of repair targets, findings, or artifact size for that processing path.  
**Suggestion:** Add a constraint or matched acknowledgment rationale that defines the applicable bound, for example by referencing the existing finding budget or specifying that checkpoint replay processes only the single provided artifact and its bounded finding buckets.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Extract Repeated Review Constants
**Finding key:** loop-028dd6b7731be43727ae
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R1
**Issue:** String literals such as `"draft-questions"`, `"draft-review-questions.json"`, `"ADVISORY"`, and `{ configuredSemanticMaxAttempts: 4 }` are repeated across many tests, making future changes noisy and increasing typo risk.
**Suggestion:** Add small constants like `DRAFT_QUESTIONS_PHASE`, `DRAFT_QUESTIONS_ARTIFACT`, `ADVISORY_VERDICT`, and `REVIEW_OPTIONS`, then reuse them throughout the fixture and tests.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R1
**Issue:** String literals such as `"draft-questions"`, `"draft-review-questions.json"`, `"ADVISORY"`, and `{ configuredSemanticMaxAttempts: 4 }` are repeated across many tests, making future changes noisy and increasing typo risk.
**Suggestion:** Add small constants like `DRAFT_QUESTIONS_PHASE`, `DRAFT_QUESTIONS_ARTIFACT`, `ADVISORY_VERDICT`, and `REVIEW_OPTIONS`, then reuse them throughout the fixture and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Add JSON Read Helper
**Finding key:** loop-06144b0729456053f895
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R4
**Issue:** The pattern `JSON.parse(fs.readFileSync(path, "utf8"))` appears multiple times, adding low-value repetition to tests.
**Suggestion:** Introduce a local helper such as `readJson(filePath)` and use it for `written.latestPath` and `written.historyJsonPath`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R4
**Issue:** The pattern `JSON.parse(fs.readFileSync(path, "utf8"))` appears multiple times, adding low-value repetition to tests.
**Suggestion:** Introduce a local helper such as `readJson(filePath)` and use it for `written.latestPath` and `written.historyJsonPath`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Extract Temporary Spec Directory Creation
**Finding key:** loop-bb5fe999b54eeb93e3e7
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R4
**Issue:** Temporary directory creation and registration are duplicated in multiple tests:
`fs.mkdtempSync(path.join(os.tmpdir(), "..."))` followed by `tempDirs.push(specDir)`.
**Suggestion:** Add a helper like `makeTempSpecDir(prefix)` that creates the directory, tracks it in `tempDirs`, and returns the path.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R4
**Issue:** Temporary directory creation and registration are duplicated in multiple tests:
`fs.mkdtempSync(path.join(os.tmpdir(), "..."))` followed by `tempDirs.push(specDir)`.
**Suggestion:** Add a helper like `makeTempSpecDir(prefix)` that creates the directory, tracks it in `tempDirs`, and returns the path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Extract Advisory Disposition Helper
**Finding key:** loop-5180b2aa2cf6fe092998
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R7
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R7
**Issue:** Several tests manually create `new ReviewDisposition({ value: "ADVISORY", ...canonical })` or go through fixture setup just to produce advisory disposition data.
**Suggestion:** Add a helper such as `advisoryDispositionFromArtifact(artifact, phase = "draft-questions")` or extend `DraftReviewFixture` with a static factory for common advisory cases.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R7
**Issue:** Several tests manually create `new ReviewDisposition({ value: "ADVISORY", ...canonical })` or go through fixture setup just to produce advisory disposition data.
**Suggestion:** Add a helper such as `advisoryDispositionFromArtifact(artifact, phase = "draft-questions")` or extend `DraftReviewFixture` with a static factory for common advisory cases.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 5. Clarify Fixture Naming
**Finding key:** loop-70dd34ca38982a8c87ff
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R2
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R2
**Issue:** `DraftReviewFixture` is broad, but the fixture specifically models draft review artifacts and canonical finding conversion. The name does not make the fixture’s role obvious.
**Suggestion:** Rename it to something more precise, such as `DraftReviewArtifactFixture` or `CanonicalDraftReviewFixture`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R2
**Issue:** `DraftReviewFixture` is broad, but the fixture specifically models draft review artifacts and canonical finding conversion. The name does not make the fixture’s role obvious.
**Suggestion:** Rename it to something more precise, such as `DraftReviewArtifactFixture` or `CanonicalDraftReviewFixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 6. Extract Checkpoint Proposal Builder
**Finding key:** loop-5d1e4529060d5595cd10
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R8
**Issue:** The R8 test builds a checkpoint-shaped proposal inline with markdown field formatting. That makes the test long and mixes artifact-shape setup with the behavior being asserted.
**Suggestion:** Move the proposal construction into a helper like `checkpointRepairTargetProposal(target = REPAIR_TARGET)`, keeping the test focused on recording and transition behavior.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R8
**Issue:** The R8 test builds a checkpoint-shaped proposal inline with markdown field formatting. That makes the test long and mixes artifact-shape setup with the behavior being asserted.
**Suggestion:** Move the proposal construction into a helper like `checkpointRepairTargetProposal(target = REPAIR_TARGET)`, keeping the test focused on recording and transition behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. I’ll review only the touched file from the supplied diff and focus on concrete quality improvements, including the bounded-resource guardrail.### 1. Extract Blocker Summary Builders
**Finding key:** loop-c3d8bfb19421382a7f54
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `AcceptanceEvidenceRefresh.supports()` matches blockers by reconstructing exact summary strings inline. This duplicates message formats owned elsewhere and makes recovery fragile if wording changes.  
**Suggestion:** Extract small helpers such as `invalidArtifactSummary(file)` and `missingDeferredSourceSummary(sourceArtifact, sourceFindingId)`, then use them both where blockers are created and where refresh support is checked.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `AcceptanceEvidenceRefresh.supports()` matches blockers by reconstructing exact summary strings inline. This duplicates message formats owned elsewhere and makes recovery fragile if wording changes.  
**Suggestion:** Extract small helpers such as `invalidArtifactSummary(file)` and `missingDeferredSourceSummary(sourceArtifact, sourceFindingId)`, then use them both where blockers are created and where refresh support is checked.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Rename Refresh Class To Recovery Plan
**Finding key:** loop-822f8bc71dbdcd1031b7
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `AcceptanceEvidenceRefresh` sounds like an action/result, but the class mostly models whether stale evidence can be recovered and then optionally performs recovery.  
**Suggestion:** Rename it to something more explicit, such as `AcceptanceEvidenceRecoveryPlan`, and rename `evidenceRefresh` to `evidenceRecoveryPlan` where passed through context/application code.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `AcceptanceEvidenceRefresh` sounds like an action/result, but the class mostly models whether stale evidence can be recovered and then optionally performs recovery.  
**Suggestion:** Rename it to something more explicit, such as `AcceptanceEvidenceRecoveryPlan`, and rename `evidenceRefresh` to `evidenceRecoveryPlan` where passed through context/application code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Avoid Redundant Result State
**Finding key:** loop-72168bab92677744b77d
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `AcceptanceEvidenceRefreshResult` hardcodes `recovered = true` for every instance. Since the object is only returned when recovery happened, this field adds little value and can drift from the actual control flow.  
**Suggestion:** Remove `recovered` from the class and JSON output, or replace the custom result class with a plain purpose-built return object from `recover()`.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `AcceptanceEvidenceRefreshResult` hardcodes `recovered = true` for every instance. Since the object is only returned when recovery happened, this field adds little value and can drift from the actual control flow.  
**Suggestion:** Remove `recovered` from the class and JSON output, or replace the custom result class with a plain purpose-built return object from `recover()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Make Previous Fingerprint Selection Deterministic By Validation
**Finding key:** loop-f882f46f0d99841fbdb8
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `previousFingerprint` is taken from the first stale artifact, but `staleArtifacts` could theoretically contain multiple different previous fingerprints. The invalidation call then receives only one previous fingerprint, which may under-describe the stale state.  
**Suggestion:** Either validate that all stale artifacts share the same previous fingerprint before recovery, or store/report all previous fingerprints in the refresh result. This keeps the recovery behavior explicit.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `previousFingerprint` is taken from the first stale artifact, but `staleArtifacts` could theoretically contain multiple different previous fingerprints. The invalidation call then receives only one previous fingerprint, which may under-describe the stale state.  
**Suggestion:** Either validate that all stale artifacts share the same previous fingerprint before recovery, or store/report all previous fingerprints in the refresh result. This keeps the recovery behavior explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Cap Deferred Source Materialization
**Finding key:** loop-9dddec50382ff3a3f53e
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `DeferredFindingSources` eagerly copies all flow findings and review handoff findings into arrays without an explicit count bound. Under the `bounded-resource-usage` guardrail, bulk data loading should have a defined upper limit.  
**Suggestion:** Introduce a module-level maximum for deferred finding sources and enforce it when constructing `DeferredFindingSources`, throwing a clear error if the artifact exceeds the supported count.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `DeferredFindingSources` eagerly copies all flow findings and review handoff findings into arrays without an explicit count bound. Under the `bounded-resource-usage` guardrail, bulk data loading should have a defined upper limit.  
**Suggestion:** Introduce a module-level maximum for deferred finding sources and enforce it when constructing `DeferredFindingSources`, throwing a clear error if the artifact exceeds the supported count.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Clarify normalization helper naming
**Finding key:** loop-520e50a5e720537b7054
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `invalidationFingerprint()` is a bit ambiguous: it sounds like it computes a special invalidation fingerprint, but the behavior is actually normalizing either a raw hash string or a fingerprint object into the fingerprint shape expected by `planRepairInvalidation`.  
**Suggestion:** Rename it to something more explicit, such as `normalizeInvalidationFingerprint(value, field)`, to make the string-or-object input handling obvious at call sites.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `invalidationFingerprint()` is a bit ambiguous: it sounds like it computes a special invalidation fingerprint, but the behavior is actually normalizing either a raw hash string or a fingerprint object into the fingerprint shape expected by `planRepairInvalidation`.  
**Suggestion:** Rename it to something more explicit, such as `normalizeInvalidationFingerprint(value, field)`, to make the string-or-object input handling obvious at call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Extract `result.evidenceRefresh` Before Return
**Finding key:** loop-838e4c92105b5d2f30f3
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R8  
**Issue:** `result.evidenceRefresh` is read three times inside the returned object, including inside a nested ternary. This makes the return shape slightly harder to scan and increases repetition.  
**Suggestion:** Assign it once before the return, then reuse it:

```js
const evidenceRefresh = result.evidenceRefresh || null;

return {
  ...
  evidenceRefresh,
  next: evidenceRefresh
    ? evidenceRefresh.activeStep
    : result.verdict === "pass"
      ? "final-regression"
      : ...
};
```
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R8  
**Issue:** `result.evidenceRefresh` is read three times inside the returned object, including inside a nested ternary. This makes the return shape slightly harder to scan and increases repetition.  
**Suggestion:** Assign it once before the return, then reuse it:

```js
const evidenceRefresh = result.evidenceRefresh || null;

return {
  ...
  evidenceRefresh,
  next: evidenceRefresh
    ? evidenceRefresh.activeStep
    : result.verdict === "pass"
      ? "final-regression"
      : ...
};
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. I’ll ground the review in the touched file only and check the surrounding helper behavior so the proposals line up with the actual implementation, not just the diff hunk.The provided path is relative to the repository root, while this workspace appears to be the `.tmp` review area. I’m locating the file in the current worktree before finalizing the review.### 1. Add an explicit bound when merging finding arrays
**Finding key:** loop-b51a0f3b0d52bac76865
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** `reviewArtifactFindingLists()` now merges `advisory` and `repairTargets` with `[...advisory, ...repairTargets]` without an explicit item limit. That newly added bulk processing path violates the `bounded-resource-usage` guardrail unless an upstream acknowledged cap is enforced here.  
**Suggestion:** Introduce a local maximum for provider artifact findings/repair targets and reject or truncate with a clear error before canonicalization.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** `reviewArtifactFindingLists()` now merges `advisory` and `repairTargets` with `[...advisory, ...repairTargets]` without an explicit item limit. That newly added bulk processing path violates the `bounded-resource-usage` guardrail unless an upstream acknowledged cap is enforced here.  
**Suggestion:** Introduce a local maximum for provider artifact findings/repair targets and reject or truncate with a clear error before canonicalization.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Avoid hiding `repairTargets` inside the generic advisory list
**Finding key:** loop-61624055b433e890232a
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R3  
**Issue:** `reviewArtifactFindingLists()` now returns `repairTargets` already folded into `advisory`. That makes the helper name less accurate and obscures the distinction between native advisory findings and repair targets, even though the canonical contract depends on preserving repair-target semantics.  
**Suggestion:** Return `{ blocking, advisory, repairTargets }` from `reviewArtifactFindingLists()`, then merge them explicitly inside `canonicalReviewArtifactFindings()` where canonical advisory recording is performed.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R3  
**Issue:** `reviewArtifactFindingLists()` now returns `repairTargets` already folded into `advisory`. That makes the helper name less accurate and obscures the distinction between native advisory findings and repair targets, even though the canonical contract depends on preserving repair-target semantics.  
**Suggestion:** Return `{ blocking, advisory, repairTargets }` from `reviewArtifactFindingLists()`, then merge them explicitly inside `canonicalReviewArtifactFindings()` where canonical advisory recording is performed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Centralize draft repair-target phase logic
**Finding key:** loop-e7a55be2a8429001f172
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** `DRAFT_REPAIR_TARGET_PHASES.has(phase)` is repeated in both list extraction and fallback ID generation. That duplicates policy and makes it easier for future edits to update one path but not the other.  
**Suggestion:** Add a small helper such as `isDraftRepairTargetPhase(phase)` and use it consistently in both places.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** `DRAFT_REPAIR_TARGET_PHASES.has(phase)` is repeated in both list extraction and fallback ID generation. That duplicates policy and makes it easier for future edits to update one path but not the other.  
**Suggestion:** Add a small helper such as `isDraftRepairTargetPhase(phase)` and use it consistently in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Extract Draft Review Artifact Fixtures
**Finding key:** loop-88117bdf51990271e747
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The test repeatedly constructs the same draft review artifact shape with `blockingFindings`, `advisoryFindings`, and `repairTargets`, which makes the canonical advisory contract harder to scan and easier to update inconsistently.  
**Suggestion:** Add a small helper such as `draftReviewArtifact({ verdict = "ADVISORY", blocking = [], advisory = [], repairTargets = [] })` and reuse it across the new tests.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The test repeatedly constructs the same draft review artifact shape with `blockingFindings`, `advisoryFindings`, and `repairTargets`, which makes the canonical advisory contract harder to scan and easier to update inconsistently.  
**Suggestion:** Add a small helper such as `draftReviewArtifact({ verdict = "ADVISORY", blocking = [], advisory = [], repairTargets = [] })` and reuse it across the new tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Replace Inline Phase-to-Artifact Mapping
**Finding key:** loop-f8c94a5282c88802b79b
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R2  
**Issue:** The artifact name selection for `draft-questions` versus `draft-coverage` is embedded as an inline ternary inside the loop. If more assertions are added, this mapping is likely to be duplicated.  
**Suggestion:** Define a local map, for example `DRAFT_REVIEW_ARTIFACT_NAMES`, and read `DRAFT_REVIEW_ARTIFACT_NAMES[phase]` when calling `recordCanonicalDraftEvidence`.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R2  
**Issue:** The artifact name selection for `draft-questions` versus `draft-coverage` is embedded as an inline ternary inside the loop. If more assertions are added, this mapping is likely to be duplicated.  
**Suggestion:** Define a local map, for example `DRAFT_REVIEW_ARTIFACT_NAMES`, and read `DRAFT_REVIEW_ARTIFACT_NAMES[phase]` when calling `recordCanonicalDraftEvidence`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Rename `recordCanonicalDraftEvidence`
**Finding key:** loop-8c35cba6289350876a3b
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R8  
**Issue:** `recordCanonicalDraftEvidence` sounds like it mutates persistent review history, but it only builds canonical findings, constructs review evidence, applies a convergence transition to an in-memory state object, and returns the result.  
**Suggestion:** Rename it to something more test-specific and descriptive, such as `applyCanonicalDraftEvidenceTransition`, to make the helper’s behavior clear.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R8  
**Issue:** `recordCanonicalDraftEvidence` sounds like it mutates persistent review history, but it only builds canonical findings, constructs review evidence, applies a convergence transition to an in-memory state object, and returns the result.  
**Suggestion:** Rename it to something more test-specific and descriptive, such as `applyCanonicalDraftEvidenceTransition`, to make the helper’s behavior clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Extract the Repeated Demo Diff Fixture
**Finding key:** loop-a59a102b032bc09ffef7
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The newly added tests construct the same `src/demo.js` diff inline with nearly identical array literals. This adds noise and makes future fixture changes easier to miss.  
**Suggestion:** Add a small helper in this test file, for example `demoSourceDiff(from, to)`, and use it in both new tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The newly added tests construct the same `src/demo.js` diff inline with nearly identical array literals. This adds noise and makes future fixture changes easier to miss.  
**Suggestion:** Add a small helper in this test file, for example `demoSourceDiff(from, to)`, and use it in both new tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Extract Acceptance Deferred Finding Fixture Creation
**Finding key:** loop-cc08e9e465a6ddf2f0cf
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The first new test manually builds `duplicateFinding`, `uniqueFinding`, `ReviewEvidence`, writes canonical evidence, applies the transition, and writes `flow-findings.json`. This is a dense setup block that obscures the behavior being asserted.  
**Suggestion:** Move the setup into a focused helper such as `prepareDeferredAcceptanceFindings(fixture, state)` returning `{ evidence, duplicateFinding, uniqueFinding, canonicalEvidenceRef }`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The first new test manually builds `duplicateFinding`, `uniqueFinding`, `ReviewEvidence`, writes canonical evidence, applies the transition, and writes `flow-findings.json`. This is a dense setup block that obscures the behavior being asserted.  
**Suggestion:** Move the setup into a focused helper such as `prepareDeferredAcceptanceFindings(fixture, state)` returning `{ evidence, duplicateFinding, uniqueFinding, canonicalEvidenceRef }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Name the Test Intent More Precisely
**Finding key:** loop-3e4a23e1480e3877181b
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** `"acceptance-review deduplicates flow findings and review handoffs by fingerprint"` is accurate but broad. The test specifically verifies that an existing deferred flow finding suppresses a duplicate review handoff while preserving a distinct one.  
**Suggestion:** Rename it to something like `"acceptance-review suppresses duplicate review handoffs when deferred flow finding has same fingerprint"`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** `"acceptance-review deduplicates flow findings and review handoffs by fingerprint"` is accurate but broad. The test specifically verifies that an existing deferred flow finding suppresses a duplicate review handoff while preserving a distinct one.  
**Suggestion:** Rename it to something like `"acceptance-review suppresses duplicate review handoffs when deferred flow finding has same fingerprint"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Replace Repeated Artifact Cleanup Path List With a Named Constant
**Finding key:** loop-ec3f08fdeb264d430c68
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The stale fingerprint test includes an inline list of artifact paths expected to be removed. This list encodes an important rewind contract but is buried inside the assertion loop.  
**Suggestion:** Extract it to a local constant such as `const rewoundArtifactPaths = [...]` near the assertion, or a file-level fixture constant if reused by nearby tests. This makes the test’s expectation easier to scan and update.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The stale fingerprint test includes an inline list of artifact paths expected to be removed. This list encodes an important rewind contract but is buried inside the assertion loop.  
**Suggestion:** Extract it to a local constant such as `const rewoundArtifactPaths = [...]` near the assertion, or a file-level fixture constant if reused by nearby tests. This makes the test’s expectation easier to scan and update.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Centralize draft repair target phase/artifact naming
**Finding key:** loop-d74d36aafdba41e06979
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Draft phase concepts are repeated with slightly different names across spec files and tests: `draft-questions`, `draft-coverage`, `draft-review-questions.json`, behavior names like checkpoint fixture, and helper names such as `recordCanonicalDraftEvidence`. This creates cross-file drift risk between implementation, test fixtures, and spec language.  
**Suggestion:** Introduce shared constants/helpers for draft repair target phases and artifact names in the production module where appropriate, and mirror those names in tests/spec wording. Prefer behavior-based fixture names such as `single-pass repairTargets checkpoint fixture`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Draft phase concepts are repeated with slightly different names across spec files and tests: `draft-questions`, `draft-coverage`, `draft-review-questions.json`, behavior names like checkpoint fixture, and helper names such as `recordCanonicalDraftEvidence`. This creates cross-file drift risk between implementation, test fixtures, and spec language.  
**Suggestion:** Introduce shared constants/helpers for draft repair target phases and artifact names in the production module where appropriate, and mirror those names in tests/spec wording. Prefer behavior-based fixture names such as `single-pass repairTargets checkpoint fixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Keep repair targets distinct until canonicalization
**Finding key:** loop-f81d14c3b359bf5bc234
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R3  
**Issue:** `repairTargets` are reportedly folded into `advisory` in `reviewArtifactFindingLists()`, while specs and tests describe repair targets as a distinct draft advisory source. This interface mismatch can hide whether advisory findings came from native advisory output or repair target conversion.  
**Suggestion:** Return `{ blocking, advisory, repairTargets }` from extraction helpers and merge only at the canonical recording boundary, with tests asserting the distinction is preserved until that point.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R3  
**Issue:** `repairTargets` are reportedly folded into `advisory` in `reviewArtifactFindingLists()`, while specs and tests describe repair targets as a distinct draft advisory source. This interface mismatch can hide whether advisory findings came from native advisory output or repair target conversion.  
**Suggestion:** Return `{ blocking, advisory, repairTargets }` from extraction helpers and merge only at the canonical recording boundary, with tests asserting the distinction is preserved until that point.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 3. Use one lifecycle model for status and history
**Finding key:** loop-67185e4446860d080aa6
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R6  
**Issue:** Multiple files show lifecycle ambiguity: `spec.json` has done requirements with pending tasks, while `flow.json` has pending steps with completed runtime logs. These files expose inconsistent meanings for current status versus historical attempts.  
**Suggestion:** Define one cross-file convention: current lifecycle status lives in `status`, while prior executions live in explicit history fields such as `attemptHistory` or `runtimeHistory`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R6  
**Issue:** Multiple files show lifecycle ambiguity: `spec.json` has done requirements with pending tasks, while `flow.json` has pending steps with completed runtime logs. These files expose inconsistent meanings for current status versus historical attempts.  
**Suggestion:** Define one cross-file convention: current lifecycle status lives in `status`, while prior executions live in explicit history fields such as `attemptHistory` or `runtimeHistory`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 4. Apply bounded-resource policy consistently
**Finding key:** loop-45f03abecbf2af9b59ed
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** Several files independently raise missing bounds for evidence arrays, checkpoint fixtures, review findings, deferred sources, and accumulated flow history. The same bounded-resource concern appears across spec, flow state, production code, and tests without a single shared policy.  
**Suggestion:** Add explicit limits in production code for finding/source materialization and fixture replay, then document those same limits in `spec.json` and `issue.md`. Tests should use the named limits rather than inline unbounded fixtures.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** Several files independently raise missing bounds for evidence arrays, checkpoint fixtures, review findings, deferred sources, and accumulated flow history. The same bounded-resource concern appears across spec, flow state, production code, and tests without a single shared policy.  
**Suggestion:** Add explicit limits in production code for finding/source materialization and fixture replay, then document those same limits in `spec.json` and `issue.md`. Tests should use the named limits rather than inline unbounded fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 5. Normalize persisted review proposal summaries
**Finding key:** loop-b68205e319b5567ce136
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R5  
**Issue:** Review summaries contain local numbering and even captured reviewer narration, while the provider contract requires structured proposal fields and stable requirement IDs. This creates inconsistent proposal identity across `flow.json`, review summaries, and implementation review output.  
**Suggestion:** Persist normalized proposal data: title without numbering, body without process chatter, stable `findingId`, and explicit `Requirement`. Treat numbering as render-time presentation only.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R5  
**Issue:** Review summaries contain local numbering and even captured reviewer narration, while the provider contract requires structured proposal fields and stable requirement IDs. This creates inconsistent proposal identity across `flow.json`, review summaries, and implementation review output.  
**Suggestion:** Persist normalized proposal data: title without numbering, body without process chatter, stable `findingId`, and explicit `Requirement`. Treat numbering as render-time presentation only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 6. Deduplicate evidence identity fields across artifacts
**Finding key:** loop-70aad917985f1073cce8
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R4  
**Issue:** Evidence identity fields are repeated in `flow.json`, while related source/recovery code also reconstructs summaries and deferred source material across artifacts. This duplicates provenance ownership across persisted state and production logic.  
**Suggestion:** Store shared provenance fields once at the review record/evidence level, and let findings reference that record. In code, use helper builders for shared blocker/evidence identity strings instead of reconstructing them inline.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R4  
**Issue:** Evidence identity fields are repeated in `flow.json`, while related source/recovery code also reconstructs summaries and deferred source material across artifacts. This duplicates provenance ownership across persisted state and production logic.  
**Suggestion:** Store shared provenance fields once at the review record/evidence level, and let findings reference that record. In code, use helper builders for shared blocker/evidence identity strings instead of reconstructing them inline.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
