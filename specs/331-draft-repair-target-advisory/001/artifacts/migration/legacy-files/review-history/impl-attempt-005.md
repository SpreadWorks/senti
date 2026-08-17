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

### 3. 1. Bound Accumulating Flow History
**Finding key:** loop-a3cd4d6af503f44565cc
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records`, `evidenceHistory`, `stepAttempts`, and `reviewRecoveryBaselines` appear to grow by appending run history. The file shows no explicit retention/count bound, which conflicts with the `bounded-resource-usage` guardrail for bulk/history accumulation.  
**Suggestion:** Add or enforce a documented maximum retention policy for these arrays in the producer that writes `flow.json`, such as capping retained records per phase/task and preserving only canonical/latest evidence plus a bounded audit tail. If this is intentionally unbounded, add a valid matched-spec acknowledgment rationale for `bounded-resource-usage`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records`, `evidenceHistory`, `stepAttempts`, and `reviewRecoveryBaselines` appear to grow by appending run history. The file shows no explicit retention/count bound, which conflicts with the `bounded-resource-usage` guardrail for bulk/history accumulation.  
**Suggestion:** Add or enforce a documented maximum retention policy for these arrays in the producer that writes `flow.json`, such as capping retained records per phase/task and preserving only canonical/latest evidence plus a bounded audit tail. If this is intentionally unbounded, add a valid matched-spec acknowledgment rationale for `bounded-resource-usage`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Reduce Repeated Evidence Identity Blocks
**Finding key:** loop-42f0e090e696942fc721
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** Each review convergence record repeats the same evidence identity fields across `evidenceIdentity`, `evidenceHistory`, `handoffFindings`, and `canonicalEvidenceRef`. This makes the persisted state large and increases the chance of inconsistent updates.  
**Suggestion:** Store the evidence identity once per record and have nested findings reference it by digest/ref only. For example, keep `canonicalEvidenceRef` and `evidenceDigest` at the convergence-record level, then remove duplicated provider/invocation/tree metadata from each handoff finding unless the finding genuinely needs distinct provenance.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** Each review convergence record repeats the same evidence identity fields across `evidenceIdentity`, `evidenceHistory`, `handoffFindings`, and `canonicalEvidenceRef`. This makes the persisted state large and increases the chance of inconsistent updates.  
**Suggestion:** Store the evidence identity once per record and have nested findings reference it by digest/ref only. For example, keep `canonicalEvidenceRef` and `evidenceDigest` at the convergence-record level, then remove duplicated provider/invocation/tree metadata from each handoff finding unless the finding genuinely needs distinct provenance.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Normalize Repeated Runtime Log Shape
**Finding key:** loop-b4db44e87477f20b4a8e
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** Many step entries repeat identical `runtimeLog` structure with `runId`, `attempt`, `command`, timestamps, and exit code. As the flow grows, this creates a noisy state format and makes meaningful changes harder to review.  
**Suggestion:** Consider moving runtime logs into a separate bounded log collection keyed by step id and sequence, while steps keep only `runtimeLogSequence` or `lastRuntimeLogId`. This keeps the workflow state focused on current status while preserving auditability.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** Many step entries repeat identical `runtimeLog` structure with `runId`, `attempt`, `command`, timestamps, and exit code. As the flow grows, this creates a noisy state format and makes meaningful changes harder to review.  
**Suggestion:** Consider moving runtime logs into a separate bounded log collection keyed by step id and sequence, while steps keep only `runtimeLogSequence` or `lastRuntimeLogId`. This keeps the workflow state focused on current status while preserving auditability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Consolidate Repeated Gate-Failure Entries
**Finding key:** loop-eed412bd7e0ece1285e5
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** Several consecutive `spec-gate` entries repeat the same `project-test-integrity` failure with only minor wording changes, making the issue log harder to scan and increasing maintenance noise.  
**Suggestion:** Replace the repeated near-duplicate entries with one canonical failure entry plus subsequent repair/retry entries that reference the same `normalizedFindingId` or guardrail ID.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** Several consecutive `spec-gate` entries repeat the same `project-test-integrity` failure with only minor wording changes, making the issue log harder to scan and increasing maintenance noise.  
**Suggestion:** Replace the repeated near-duplicate entries with one canonical failure entry plus subsequent repair/retry entries that reference the same `normalizedFindingId` or guardrail ID.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Remove Redundant Recovery Identifiers
**Finding key:** loop-9507fd3f478d8760829f
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The `retry-recovery` entry stores the same UUID in `grantId`, `id`, and `issueLogId`, which duplicates identity fields without adding meaning.  
**Suggestion:** Keep one canonical identifier field for the recovery record, or document distinct semantics if all three are required by the consumer.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The `retry-recovery` entry stores the same UUID in `grantId`, `id`, and `issueLogId`, which duplicates identity fields without adding meaning.  
**Suggestion:** Keep one canonical identifier field for the recovery record, or document distinct semantics if all three are required by the consumer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Normalize Step Naming
**Finding key:** loop-2cc0abbdcb44a0c9007e
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The log mixes step names such as `task.impl`, `task-impl`, `impl-gate`, and `task-review`. The `task.impl` dotted form is inconsistent with the surrounding kebab-case naming.  
**Suggestion:** Rename `task.impl` to `task-impl` if it represents the same phase, or use a clearly distinct canonical step name consistently across entries.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The log mixes step names such as `task.impl`, `task-impl`, `impl-gate`, and `task-review`. The `task.impl` dotted form is inconsistent with the surrounding kebab-case naming.  
**Suggestion:** Rename `task.impl` to `task-impl` if it represents the same phase, or use a clearly distinct canonical step name consistently across entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Bound Issue Log Growth
**Finding key:** loop-885b2b37427c53382a6c
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The `entries` array has no visible size or retention bound. Under the `bounded-resource-usage` guardrail, append-only logs should have an explicit maximum count, archival policy, or truncation behavior.  
**Suggestion:** Add or enforce a documented maximum number of retained entries for this spec issue log, or summarize older repeated gate attempts into a bounded aggregate entry.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The `entries` array has no visible size or retention bound. Under the `bounded-resource-usage` guardrail, append-only logs should have an explicit maximum count, archival policy, or truncation behavior.  
**Suggestion:** Add or enforce a documented maximum number of retained entries for this spec issue log, or summarize older repeated gate attempts into a bounded aggregate entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Remove Duplicated Bilingual Body
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

### 11. 2. Clarify Requirement Mapping For Acceptance Criteria
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

### 12. 3. Add Explicit Bound To Evidence Fixture Size
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

### 13. 1. Remove duplicated issue number if schema allows
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

### 14. 1. Consolidate Repeated Draft Phase Wording
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

### 15. 2. Remove Implementation Status From Initial Spec
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

### 16. 3. Simplify Overlapping Verification Text
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

### 17. 4. Add Explicit Resource Bounds For Checkpoint Fixture Processing
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

### 18. 1. Extract Repeated Review Constants
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

### 19. 2. Add JSON Read Helper
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

### 20. 3. Extract Temporary Spec Directory Creation
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

### 21. 4. Extract Advisory Disposition Helper
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

### 22. 5. Clarify Fixture Naming
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

### 23. 6. Extract Checkpoint Proposal Builder
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

### 24. I’ll ground the review in the touched file only and check the surrounding helper behavior so the proposals line up with the actual implementation, not just the diff hunk.The provided path is relative to the repository root, while this workspace appears to be the `.tmp` review area. I’m locating the file in the current worktree before finalizing the review.### 1. Add an explicit bound when merging finding arrays
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

### 25. 2. Avoid hiding `repairTargets` inside the generic advisory list
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

### 26. 3. Centralize draft repair-target phase logic
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

### 27. 1. Extract Draft Review Artifact Fixtures
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

### 28. 2. Replace Inline Phase-to-Artifact Mapping
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

### 29. 3. Rename `recordCanonicalDraftEvidence`
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

### 30. I’ll compare the per-file findings for issues that only become visible across files: shared terms, duplicated helpers/contracts, and lifecycle/schema mismatches between spec, fixtures, tests, and implementation.### 1. Canonicalize Draft Repair-Target Phase Naming
**Finding key:** loop-587c22bfe8bf9dca6382
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`
**Requirement:** R6
**Issue:** Multiple files use slightly different names for the same concept: `draft repair phases`, `draft repair-target phases`, `single-pass repairTargets checkpoint fixture`, `Issue #453 checkpoint-shaped fixture`, and `DraftReviewFixture`. This creates cross-file drift between spec language, fixture names, and test helper names.
**Suggestion:** Define one canonical term, such as `draft repair-target phases`, and apply it consistently across `spec.json`, `draft.json`, `issue.md`, and the related tests. Keep issue numbers only as provenance, not as fixture names.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`
**Requirement:** R6
**Issue:** Multiple files use slightly different names for the same concept: `draft repair phases`, `draft repair-target phases`, `single-pass repairTargets checkpoint fixture`, `Issue #453 checkpoint-shaped fixture`, and `DraftReviewFixture`. This creates cross-file drift between spec language, fixture names, and test helper names.
**Suggestion:** Define one canonical term, such as `draft repair-target phases`, and apply it consistently across `spec.json`, `draft.json`, `issue.md`, and the related tests. Keep issue numbers only as provenance, not as fixture names.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Centralize The ReviewDisposition Invariant
**Finding key:** loop-6c4a9fdfb22551e018de
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/draft.json
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/draft.json`
**Requirement:** R4
**Issue:** The same PASS/ADVISORY/REJECTED invariant is repeated across `draft.json`, `spec.json`, `issue.md`, `src/flow/lib/run-review.js`, and tests. Because implementation behavior and spec text are both duplicating the contract, future changes could update one layer without the others.
**Suggestion:** Keep the full invariant in one authoritative spec location, reference it elsewhere by name, and mirror that in code with a single helper or policy boundary used by both production logic and tests.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/draft.json`
**Requirement:** R4
**Issue:** The same PASS/ADVISORY/REJECTED invariant is repeated across `draft.json`, `spec.json`, `issue.md`, `src/flow/lib/run-review.js`, and tests. Because implementation behavior and spec text are both duplicating the contract, future changes could update one layer without the others.
**Suggestion:** Keep the full invariant in one authoritative spec location, reference it elsewhere by name, and mirror that in code with a single helper or policy boundary used by both production logic and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Align Repair Target Shape Between Extraction And Tests
**Finding key:** loop-20c96202d79c82854fbe
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R3
**Issue:** The implementation proposal notes that `repairTargets` are folded into `advisory`, while test proposals focus on helpers that build artifacts with separate `blockingFindings`, `advisoryFindings`, and `repairTargets`. This creates an interface mismatch: tests and specs treat repair targets as a distinct input category, but the helper output hides that distinction.
**Suggestion:** Return `repairTargets` separately from extraction and merge only at the canonicalization boundary. Then update test helpers to preserve the same three-part artifact shape until canonical advisory recording.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R3
**Issue:** The implementation proposal notes that `repairTargets` are folded into `advisory`, while test proposals focus on helpers that build artifacts with separate `blockingFindings`, `advisoryFindings`, and `repairTargets`. This creates an interface mismatch: tests and specs treat repair targets as a distinct input category, but the helper output hides that distinction.
**Suggestion:** Return `repairTargets` separately from extraction and merge only at the canonicalization boundary. Then update test helpers to preserve the same three-part artifact shape until canonical advisory recording.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 4. Use One Draft Phase To Artifact Mapping
**Finding key:** loop-ecae21a32a1aedb21d86
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`
**Requirement:** R2
**Issue:** Phase/artifact names are repeated across tests and spec artifacts, including `draft-questions`, `draft-coverage`, `draft-review-questions.json`, and related fixture descriptions. The per-file reviews propose constants in more than one place, which risks duplicate local mappings.
**Suggestion:** Create one shared local test mapping for draft review phases to artifact filenames and reuse it across all draft repair-target tests, including spec fixture tests if they need the same mapping.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`
**Requirement:** R2
**Issue:** Phase/artifact names are repeated across tests and spec artifacts, including `draft-questions`, `draft-coverage`, `draft-review-questions.json`, and related fixture descriptions. The per-file reviews propose constants in more than one place, which risks duplicate local mappings.
**Suggestion:** Create one shared local test mapping for draft review phases to artifact filenames and reuse it across all draft repair-target tests, including spec fixture tests if they need the same mapping.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 5. Apply One Bounded Retention Policy Across State Files
**Finding key:** loop-153a2b02538bb63e38c3
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** `flow.json`, `issue-log.json`, `issue.md`, `spec.json`, and `src/flow/lib/run-review.js` all mention unbounded or potentially unbounded accumulation: evidence history, runtime logs, issue log entries, checkpoint fixtures, and merged finding arrays. These are currently described as separate concerns, but they represent one cross-file resource-bound policy gap.
**Suggestion:** Define a single bounded-resource policy for review evidence, issue logs, checkpoint fixtures, and provider finding arrays, then reference that policy from the spec and enforce it in the producer code.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** `flow.json`, `issue-log.json`, `issue.md`, `spec.json`, and `src/flow/lib/run-review.js` all mention unbounded or potentially unbounded accumulation: evidence history, runtime logs, issue log entries, checkpoint fixtures, and merged finding arrays. These are currently described as separate concerns, but they represent one cross-file resource-bound policy gap.
**Suggestion:** Define a single bounded-resource policy for review evidence, issue logs, checkpoint fixtures, and provider finding arrays, then reference that policy from the spec and enforce it in the producer code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 6. Normalize Workflow Identity Fields
**Finding key:** loop-ccdbfeeb6c9745f637e0
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/plugin-artifacts/workflow/prepare.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/plugin-artifacts/workflow/prepare.json`
**Requirement:** R8
**Issue:** Several files duplicate identity concepts: `prepare.json` repeats issue number fields, `issue-log.json` repeats recovery UUID fields, and `flow.json` repeats evidence identity across nested structures. The same cross-file pattern increases consistency risk in persisted workflow artifacts.
**Suggestion:** Establish canonical identity ownership per artifact type: one issue identifier, one recovery identifier, and one evidence identity reference. Nested records should reference canonical IDs instead of duplicating full identity blocks.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/plugin-artifacts/workflow/prepare.json`
**Requirement:** R8
**Issue:** Several files duplicate identity concepts: `prepare.json` repeats issue number fields, `issue-log.json` repeats recovery UUID fields, and `flow.json` repeats evidence identity across nested structures. The same cross-file pattern increases consistency risk in persisted workflow artifacts.
**Suggestion:** Establish canonical identity ownership per artifact type: one issue identifier, one recovery identifier, and one evidence identity reference. Nested records should reference canonical IDs instead of duplicating full identity blocks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 7. Align Requirement Status With Task Lifecycle
**Finding key:** loop-2aefbf4ff404af80299b
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`
**Requirement:** R8
**Issue:** `spec.json` marks requirements as `done` while task `T-1` is still `pending`, and other files still contain review proposals and open verification concerns. Across the spec package, the lifecycle state appears inconsistent.
**Suggestion:** Keep completion state in one authoritative workflow field, or ensure requirement status changes only after implementation evidence and review convergence are recorded.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`
**Requirement:** R8
**Issue:** `spec.json` marks requirements as `done` while task `T-1` is still `pending`, and other files still contain review proposals and open verification concerns. Across the spec package, the lifecycle state appears inconsistent.
**Suggestion:** Keep completion state in one authoritative workflow field, or ensure requirement status changes only after implementation evidence and review convergence are recorded.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
