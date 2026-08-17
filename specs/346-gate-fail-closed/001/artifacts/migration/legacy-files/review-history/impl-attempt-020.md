# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 2. Reduce duplicated requirement-to-file mappings
**Finding key:** loop-ad45abd0e3d0731ad647
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/file-map.json
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/file-map.json`  
**Requirement:** R5  
**Issue:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js` is repeated under every requirement, and `src/flow/lib/run-gate.js` is repeated under most requirements. This makes the map harder to maintain and increases the chance of drift when touched files change.  
**Suggestion:** If the spec format allows it, introduce a shared/common touched-files section or generate this map from a single source. If the format requires per-requirement arrays, consider keeping the current shape but ordering entries consistently by shared files first, then requirement-specific files, to make duplication easier to scan.
**Suggestion:** **File:** `specs/346-gate-fail-closed/file-map.json`  
**Requirement:** R5  
**Issue:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js` is repeated under every requirement, and `src/flow/lib/run-gate.js` is repeated under most requirements. This makes the map harder to maintain and increases the chance of drift when touched files change.  
**Suggestion:** If the spec format allows it, introduce a shared/common touched-files section or generate this map from a single source. If the format requires per-requirement arrays, consider keeping the current shape but ordering entries consistently by shared files first, then requirement-specific files, to make duplication easier to scan.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Add a newline at EOF
**Finding key:** loop-c3d38b6e5f01be88e8e8
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, which is inconsistent with common repository formatting conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after the closing `</details>` tag.
**Suggestion:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, which is inconsistent with common repository formatting conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after the closing `</details>` tag.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Align Task Status With Requirement Status
**Finding key:** loop-5c50ec3c6191c0d300e1
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.json
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R2  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That makes the spec internally inconsistent and weakens downstream automation that may rely on task state.  
**Suggestion:** Either mark completed tasks as `"done"` or keep requirements non-done until their implementation tasks are complete.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R2  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That makes the spec internally inconsistent and weakens downstream automation that may rely on task state.  
**Suggestion:** Either mark completed tasks as `"done"` or keep requirements non-done until their implementation tasks are complete.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Make The Bounded Retry Limit Easier To Maintain
**Finding key:** loop-a70190ece8350687bcc8
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R1  
**Issue:** The semantic retry bound appears as prose: “configured maximum of five semantic gate retries.” If implementation or tests consume this requirement, the bound is not mechanically discoverable.  
**Suggestion:** Add a structured field such as `"semantic_gate_retry_limit": 5` or include the value in a dedicated constraint object, while keeping the prose for readability.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R1  
**Issue:** The semantic retry bound appears as prose: “configured maximum of five semantic gate retries.” If implementation or tests consume this requirement, the bound is not mechanically discoverable.  
**Suggestion:** Add a structured field such as `"semantic_gate_retry_limit": 5` or include the value in a dedicated constraint object, while keeping the prose for readability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Remove Empty Placeholder Sections
**Finding key:** loop-33df5dfb873032b1e388
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Clarifications (Q&A)`, `Implementation Targets`, and `Open Questions` contain only empty placeholders, which add noise and can be mistaken for incomplete spec work.  
**Suggestion:** Remove these sections when they have no content, or replace them with explicit `None` entries if the spec format requires the headings.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Clarifications (Q&A)`, `Implementation Targets`, and `Open Questions` contain only empty placeholders, which add noise and can be mistaken for incomplete spec work.  
**Suggestion:** Remove these sections when they have no content, or replace them with explicit `None` entries if the spec format requires the headings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Avoid Duplicated Spec Content Across Markdown And JSON
**Finding key:** loop-d7a6716dc4ee53b475f5
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The markdown file duplicates much of `spec.json` verbatim: goal, background, scope, constraints, overview, requirements, acceptance criteria, tasks, and approval metadata. This creates two sources that can drift.  
**Suggestion:** Treat one file as canonical. If both formats are required, generate `spec.md` from `spec.json` or add a short note identifying which file is authoritative.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The markdown file duplicates much of `spec.json` verbatim: goal, background, scope, constraints, overview, requirements, acceptance criteria, tasks, and approval metadata. This creates two sources that can drift.  
**Suggestion:** Treat one file as canonical. If both formats are required, generate `spec.md` from `spec.json` or add a short note identifying which file is authoritative.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Extract Repeated Temp Project Setup
**Finding key:** loop-77ffe9c0f098d30da11c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** Several tests repeat the same temporary root creation, `.senti/config.json` setup, and cleanup pattern. This makes the test file longer and increases the chance that future cases diverge accidentally.  
**Suggestion:** Add a small helper such as `withTempSentiProject(prefix, config, fn)` that creates the directory, writes config, runs the callback, and performs `rmSync` cleanup in `finally`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** Several tests repeat the same temporary root creation, `.senti/config.json` setup, and cleanup pattern. This makes the test file longer and increases the chance that future cases diverge accidentally.  
**Suggestion:** Add a small helper such as `withTempSentiProject(prefix, config, fn)` that creates the directory, writes config, runs the callback, and performs `rmSync` cleanup in `finally`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Extract CLI Failure Assertions
**Finding key:** loop-267a4a9cf047a2845991
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats `execFileSync` calls and stdout/stderr matching for each forbidden CLI path. The duplicated structure obscures the actual cases being tested.  
**Suggestion:** Introduce a helper like `assertCliFails(args, pattern)` and call it for `--skip-guardrail`, `--test-fixture`, and `--test-fixture=...`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats `execFileSync` calls and stdout/stderr matching for each forbidden CLI path. The duplicated structure obscures the actual cases being tested.  
**Suggestion:** Introduce a helper like `assertCliFails(args, pattern)` and call it for `--skip-guardrail`, `--test-fixture`, and `--test-fixture=...`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Rename `executeProductionGate`
**Finding key:** loop-5e82c77adb72e6e7d0fe
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `executeProductionGate` sounds like it invokes the public production CLI, but it directly calls `runGate.runGateFlow` with injected test doubles. That naming can mislead future reviewers around the R5 bypass-isolation requirement.  
**Suggestion:** Rename it to something more precise, such as `runGateFlowWithRequiredEvaluationScenario` or `runRequiredEvaluationScenario`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `executeProductionGate` sounds like it invokes the public production CLI, but it directly calls `runGate.runGateFlow` with injected test doubles. That naming can mislead future reviewers around the R5 bypass-isolation requirement.  
**Suggestion:** Rename it to something more precise, such as `runGateFlowWithRequiredEvaluationScenario` or `runRequiredEvaluationScenario`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 4. Always Include `targetStateDigest` in Canonical Evidence Documents
**Finding key:** loop-e68790ffa0f675dfba3b
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `canonicalEvidenceDocument` conditionally omits `targetStateDigest` with `...(targetStateDigest && { targetStateDigest })`. Since R6 requires canonical evidence for the current state fingerprint, conditional omission creates two document shapes and makes it less obvious whether the fingerprint was intentionally absent or accidentally dropped.  
**Suggestion:** Serialize the field explicitly, for example `targetStateDigest: targetStateDigest ?? null`, so canonical evidence has a stable schema.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `canonicalEvidenceDocument` conditionally omits `targetStateDigest` with `...(targetStateDigest && { targetStateDigest })`. Since R6 requires canonical evidence for the current state fingerprint, conditional omission creates two document shapes and makes it less obvious whether the fingerprint was intentionally absent or accidentally dropped.  
**Suggestion:** Serialize the field explicitly, for example `targetStateDigest: targetStateDigest ?? null`, so canonical evidence has a stable schema.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Fail closed when state digest is missing
**Finding key:** loop-1265f19d5fb8cf76617b
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget()` only rejects a state mismatch when `this.evidence.targetStateDigest != null`. That means an artifact with no stored state digest can still validate when the caller supplies a current `targetStateDigest`, which weakens the R6 requirement to reject artifacts whose target state does not match.  
**Suggestion:** Require digest equality when `targetStateDigest` is provided, including rejecting missing artifact digests:

```js
if (targetStateDigest != null && this.evidence.targetStateDigest !== targetStateDigest) {
  throw new Error("review evidence state digest target mismatch");
}
```

If legacy artifacts without a digest must remain valid, make that exception explicit in naming or a narrowly scoped compatibility branch.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget()` only rejects a state mismatch when `this.evidence.targetStateDigest != null`. That means an artifact with no stored state digest can still validate when the caller supplies a current `targetStateDigest`, which weakens the R6 requirement to reject artifacts whose target state does not match.  
**Suggestion:** Require digest equality when `targetStateDigest` is provided, including rejecting missing artifact digests:

```js
if (targetStateDigest != null && this.evidence.targetStateDigest !== targetStateDigest) {
  throw new Error("review evidence state digest target mismatch");
}
```

If legacy artifacts without a digest must remain valid, make that exception explicit in naming or a narrowly scoped compatibility branch.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Consolidate Required Evaluation Failure Construction
**Finding key:** loop-848f10d632847b51c718
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Required gate failure payloads are built in multiple shapes: `requiredGuardrailFailure(...)` is used for guardrail loading failures, while missing agent and evaluation failures manually construct equivalent objects inline. This duplicates failure object structure and increases the risk of inconsistent `failureKind`, `failureCode`, or `failureReason` handling.  
**Suggestion:** Reuse `requiredGuardrailFailure(...)` for all required-evaluation failure returns in `checkGuardrail`, or rename it to a more general helper such as `requiredEvaluationFailure(...)`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Required gate failure payloads are built in multiple shapes: `requiredGuardrailFailure(...)` is used for guardrail loading failures, while missing agent and evaluation failures manually construct equivalent objects inline. This duplicates failure object structure and increases the risk of inconsistent `failureKind`, `failureCode`, or `failureReason` handling.  
**Suggestion:** Reuse `requiredGuardrailFailure(...)` for all required-evaluation failure returns in `checkGuardrail`, or rename it to a more general helper such as `requiredEvaluationFailure(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Remove Duplicate Test Fixture Rejection Branches
**Finding key:** loop-6739c24764bfaa848f85
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `RunGateCommand.run()` rejects `publicArguments.testFixture` and `input.testFixture` with two identical `Envelope.fail(...)` blocks.  
**Suggestion:** Combine them into one condition:

```js
if (publicArguments.testFixture || input.testFixture) {
  return Envelope.fail(...);
}
```

This keeps the public-route isolation behavior intact while reducing duplication.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `RunGateCommand.run()` rejects `publicArguments.testFixture` and `input.testFixture` with two identical `Envelope.fail(...)` blocks.  
**Suggestion:** Combine them into one condition:

```js
if (publicArguments.testFixture || input.testFixture) {
  return Envelope.fail(...);
}
```

This keeps the public-route isolation behavior intact while reducing duplication.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Simplify Guardrail Unset Handling
**Finding key:** loop-faa94037e21a0a3189cd
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `checkGuardrail()` has separate branches for `!guardrails` and `guardrails.length === 0`, but both return the same failure payload.  
**Suggestion:** Normalize the condition into one check:

```js
if (!Array.isArray(guardrails) || guardrails.length === 0) {
  return requiredEvaluationFailure(...);
}
```

This also makes the expected return type from `loadGuardrails` clearer.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `checkGuardrail()` has separate branches for `!guardrails` and `guardrails.length === 0`, but both return the same failure payload.  
**Suggestion:** Normalize the condition into one check:

```js
if (!Array.isArray(guardrails) || guardrails.length === 0) {
  return requiredEvaluationFailure(...);
}
```

This also makes the expected return type from `loadGuardrails` clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Extract Shared Bypass/Test Fixture Error Helpers
**Finding key:** loop-c2632ef3e740408521bf
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** The bypass and fixture rejection messages/codes are hard-coded in multiple places across `parsePublicGateArguments()` and `RunGateCommand.run()`.  
**Suggestion:** Define small constants or helper functions for the public CLI rejection codes/messages. This reduces drift between thrown parser errors and `Envelope.fail(...)` responses.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** The bypass and fixture rejection messages/codes are hard-coded in multiple places across `parsePublicGateArguments()` and `RunGateCommand.run()`.  
**Suggestion:** Define small constants or helper functions for the public CLI rejection codes/messages. This reduces drift between thrown parser errors and `Envelope.fail(...)` responses.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 5. Avoid Mutating Persisted Review Artifact During Validation
**Finding key:** loop-246023d6c3e3c4a00a3d
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `persistCanonicalReviewArtifact()` now validates selected fields, then mutates the loaded artifact and writes it back to disk. That mixes validation/registration with artifact rewriting, which is surprising for a function whose primary role is persistence into canonical evidence.  
**Suggestion:** If the provider artifact is supposed to remain immutable once finalized, avoid rewriting it here. Instead, construct a normalized in-memory copy for registration. If rewriting is intentional, extract it into a clearly named helper such as `normalizeFinalizedReviewArtifactTargetFields(...)`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `persistCanonicalReviewArtifact()` now validates selected fields, then mutates the loaded artifact and writes it back to disk. That mixes validation/registration with artifact rewriting, which is surprising for a function whose primary role is persistence into canonical evidence.  
**Suggestion:** If the provider artifact is supposed to remain immutable once finalized, avoid rewriting it here. Instead, construct a normalized in-memory copy for registration. If rewriting is intentional, extract it into a clearly named helper such as `normalizeFinalizedReviewArtifactTargetFields(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 6. Extract Finalized Artifact Target Validation
**Finding key:** loop-18a6eabe7dae342eefe2
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Target matching logic appears in two forms: explicit comparisons in `recoverFinalizedFlowReviewPostHookFailure()` and field-loop validation in `persistCanonicalReviewArtifact()`. Both enforce the same stale artifact contract.  
**Suggestion:** Extract a shared helper such as `assertFinalizedReviewArtifactMatchesTarget(artifact, expected)` and reuse it in both paths. This improves consistency for phase/tree/task/fingerprint rejection behavior.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Target matching logic appears in two forms: explicit comparisons in `recoverFinalizedFlowReviewPostHookFailure()` and field-loop validation in `persistCanonicalReviewArtifact()`. Both enforce the same stale artifact contract.  
**Suggestion:** Extract a shared helper such as `assertFinalizedReviewArtifactMatchesTarget(artifact, expected)` and reuse it in both paths. This improves consistency for phase/tree/task/fingerprint rejection behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 7. Use a Named Lock-Conflict Predicate
**Finding key:** loop-a0b587b326924b20619d
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `recoverFinalizedFlowReviewPostHookFailure()` embeds `/lock|busy|atomic stale/i` directly in the control flow. The meaning is domain-specific and likely to be reused or adjusted.  
**Suggestion:** Extract the regex into a helper such as `isReviewPostHookLockConflict(error)`. This makes the recovery precondition clearer and isolates future changes to lock-conflict classification.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `recoverFinalizedFlowReviewPostHookFailure()` embeds `/lock|busy|atomic stale/i` directly in the control flow. The meaning is domain-specific and likely to be reused or adjusted.  
**Suggestion:** Extract the regex into a helper such as `isReviewPostHookLockConflict(error)`. This makes the recovery precondition clearer and isolates future changes to lock-conflict classification.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Remove unused registration method
**Finding key:** loop-0e897f97be39147f547a
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact.toRegistration()` is not used by the new recovery path. It duplicates the same phase/task/tree/state fields already carried by `artifact.evidence`, which makes the adapter look like it has a second registration contract when `canonicalEvidenceStore.register(artifact.evidence)` is the actual boundary.  
**Suggestion:** Remove `toRegistration()` unless a caller in this same file needs it. If registration metadata is needed later, derive it from `artifact.evidence` or return it explicitly from `recoverFinalizedFlowReviewEvidence`.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact.toRegistration()` is not used by the new recovery path. It duplicates the same phase/task/tree/state fields already carried by `artifact.evidence`, which makes the adapter look like it has a second registration contract when `canonicalEvidenceStore.register(artifact.evidence)` is the actual boundary.  
**Suggestion:** Remove `toRegistration()` unless a caller in this same file needs it. If registration metadata is needed later, derive it from `artifact.evidence` or return it explicitly from `recoverFinalizedFlowReviewEvidence`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Replace wrapper class with focused helper functions
**Finding key:** loop-fc13e946b1f50ddc9285
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact` combines validation, field copying, provenance fallback, evidence construction, freezing, and an unused registration formatter. For a single-use adapter, this adds indirection without much design value.  
**Suggestion:** Split it into `assertFinalizedFlowArtifactMatchesState(providerArtifact, state)` and `buildRecoveredReviewEvidence(providerArtifact, state)`. Then `recoverFinalizedFlowReviewEvidence` can validate, build evidence, register it, and return the evidence directly.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact` combines validation, field copying, provenance fallback, evidence construction, freezing, and an unused registration formatter. For a single-use adapter, this adds indirection without much design value.  
**Suggestion:** Split it into `assertFinalizedFlowArtifactMatchesState(providerArtifact, state)` and `buildRecoveredReviewEvidence(providerArtifact, state)`. Then `recoverFinalizedFlowReviewEvidence` can validate, build evidence, register it, and return the evidence directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Add explicit bounds for recovered finding arrays
**Finding key:** loop-357ea412d9474e40cf8d
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `blockingFindings` and `advisoryFindings` are copied directly from the provider artifact with no size bound. That conflicts with the bounded-resource-usage guardrail for bulk data loading, especially because this path accepts an existing artifact and turns it into canonical evidence.  
**Suggestion:** Validate that findings arrays are arrays and enforce an existing project limit if one exists in this file’s review-evidence path. If there is no local constant, add a small file-local maximum and reject artifacts that exceed it before constructing `ReviewDisposition`.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `blockingFindings` and `advisoryFindings` are copied directly from the provider artifact with no size bound. That conflicts with the bounded-resource-usage guardrail for bulk data loading, especially because this path accepts an existing artifact and turns it into canonical evidence.  
**Suggestion:** Validate that findings arrays are arrays and enforce an existing project limit if one exists in this file’s review-evidence path. If there is no local constant, add a small file-local maximum and reject artifacts that exceed it before constructing `ReviewDisposition`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 4. Use a clearer name for the recovered artifact input
**Finding key:** loop-d026d8f88b1603e48f70
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `providerArtifact` is broad, but this function only accepts a finalized, flow-level, PASS artifact. The generic name makes the strict validation rules less obvious at call sites and in errors.  
**Suggestion:** Rename the parameter locally to something like `finalizedFlowArtifact` or `finalizedPassArtifact` so the recovery contract is visible before reading the validation block.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `providerArtifact` is broad, but this function only accepts a finalized, flow-level, PASS artifact. The generic name makes the strict validation rules less obvious at call sites and in errors.  
**Suggestion:** Rename the parameter locally to something like `finalizedFlowArtifact` or `finalizedPassArtifact` so the recovery contract is visible before reading the validation block.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Avoid duplicating explicit target resolution metadata
**Finding key:** loop-8e7dcdc2d623ed448be6
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `set step` now declares `explicitTargetResolution` both in the registry and in the command constructor. This duplicates routing/command metadata and makes it unclear which layer is authoritative.  
**Suggestion:** Keep `explicitTargetResolution` in one place, preferably the registry where the other route-level metadata lives, and remove the redundant constructor unless the base `FlowCommand` specifically requires command-level configuration.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `set step` now declares `explicitTargetResolution` both in the registry and in the command constructor. This duplicates routing/command metadata and makes it unclear which layer is authoritative.  
**Suggestion:** Keep `explicitTargetResolution` in one place, preferably the registry where the other route-level metadata lives, and remove the redundant constructor unless the base `FlowCommand` specifically requires command-level configuration.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Remove public bypass flag for required evaluations
**Finding key:** loop-24f8cddf6a029530549d
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `flow run gate` now registers `--skip-required-evaluation` as a public CLI flag while the help text says “Required evaluations cannot be bypassed from the public CLI.” Even if downstream code rejects it, exposing the flag in production routing is inconsistent with R5 and creates an avoidable bypass surface.  
**Suggestion:** Remove `--skip-required-evaluation` from the public `flags` list, or gate it behind an internal/test-only route that is not reachable from production CLI command registration.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `flow run gate` now registers `--skip-required-evaluation` as a public CLI flag while the help text says “Required evaluations cannot be bypassed from the public CLI.” Even if downstream code rejects it, exposing the flag in production routing is inconsistent with R5 and creates an avoidable bypass surface.  
**Suggestion:** Remove `--skip-required-evaluation` from the public `flags` list, or gate it behind an internal/test-only route that is not reachable from production CLI command registration.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Avoid Rebuilding Option Arrays Per Argument
**Finding key:** loop-3129c9be131367608404
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R5
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `const equalsOption = [...optionSet].find(...)` allocates a new array and scans all options for every argv token. This duplicates work inside argument parsing and scales unnecessarily with both argument count and option count.  
**Suggestion:** Precompute the equals-capable options once before the loop, for example `const optionList = [...optionSet];`, then reuse `optionList.find(...)` inside the loop.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `const equalsOption = [...optionSet].find(...)` allocates a new array and scans all options for every argv token. This duplicates work inside argument parsing and scales unnecessarily with both argument count and option count.  
**Suggestion:** Precompute the equals-capable options once before the loop, for example `const optionList = [...optionSet];`, then reuse `optionList.find(...)` inside the loop.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Handle Missing Config Before Reading `type`
**Finding key:** loop-1816e650e6254bc8936e
**Failure mode:** refactor
**File:** src/lib/presets.js
**Requirement:** R1
**Issue:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** `validateConfiguredPresetChains()` documents that `loadConfig(projectRoot)` may return `null`, but immediately reads `config.type`. If no config exists, this throws an untyped runtime error instead of returning `null` as documented.  
**Suggestion:** Add an explicit null guard: `if (!config) return null;` before checking `config.type`.
**Suggestion:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** `validateConfiguredPresetChains()` documents that `loadConfig(projectRoot)` may return `null`, but immediately reads `config.type`. If no config exists, this throws an untyped runtime error instead of returning `null` as documented.  
**Suggestion:** Add an explicit null guard: `if (!config) return null;` before checking `config.type`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Centralize Finalized Review Artifact Target Validation
**Finding key:** loop-5d5bc395221b7b297033
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R6
**Issue:** Target-state validation for finalized review artifacts is being introduced in multiple places with slightly different shapes: `run-review.js` compares target fields in recovery/persistence paths, while `set-review-evidence.js` validates the recovered finalized artifact before registering evidence. This creates a cross-file interface drift risk for phase, tree, task, and `targetStateDigest` checks.
**Suggestion:** Extract a shared validator, for example `assertFinalizedReviewArtifactMatchesTarget(artifact, expectedTarget)`, and use it from both `run-review.js` and `set-review-evidence.js`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R6
**Issue:** Target-state validation for finalized review artifacts is being introduced in multiple places with slightly different shapes: `run-review.js` compares target fields in recovery/persistence paths, while `set-review-evidence.js` validates the recovered finalized artifact before registering evidence. This creates a cross-file interface drift risk for phase, tree, task, and `targetStateDigest` checks.
**Suggestion:** Extract a shared validator, for example `assertFinalizedReviewArtifactMatchesTarget(artifact, expectedTarget)`, and use it from both `run-review.js` and `set-review-evidence.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Normalize Canonical Evidence State Digest Shape Across Producers And Validators
**Finding key:** loop-8811d65652c8f5509232
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R6
**Issue:** `review-convergence.js` may omit `targetStateDigest` from canonical evidence, while `review-evidence-store.js` validation depends on whether that field exists. That creates two valid-looking evidence schemas across files and weakens fail-closed behavior for stale artifacts.
**Suggestion:** Always serialize `targetStateDigest` explicitly, using `targetStateDigest: targetStateDigest ?? null`, and update evidence validation to reject missing artifact digests when a current digest is supplied.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R6
**Issue:** `review-convergence.js` may omit `targetStateDigest` from canonical evidence, while `review-evidence-store.js` validation depends on whether that field exists. That creates two valid-looking evidence schemas across files and weakens fail-closed behavior for stale artifacts.
**Suggestion:** Always serialize `targetStateDigest` explicitly, using `targetStateDigest: targetStateDigest ?? null`, and update evidence validation to reject missing artifact digests when a current digest is supplied.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Consolidate Public Gate Bypass And Fixture Rejection Contracts
**Finding key:** loop-84c1a5c8cc59c3a06f33
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R5
**Issue:** Public CLI bypass rejection is defined across `registry.js`, `run-gate.js`, and tests with duplicated flag names, error codes, and messages. One proposal notes `--skip-required-evaluation` is still exposed in the registry while other code rejects bypasses later, which is an interface inconsistency between command registration and runtime enforcement.
**Suggestion:** Remove public registration of bypass-only flags, then centralize rejection codes/messages in `run-gate.js` constants or helpers used by parsing, runtime envelope failures, and tests.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R5
**Issue:** Public CLI bypass rejection is defined across `registry.js`, `run-gate.js`, and tests with duplicated flag names, error codes, and messages. One proposal notes `--skip-required-evaluation` is still exposed in the registry while other code rejects bypasses later, which is an interface inconsistency between command registration and runtime enforcement.
**Suggestion:** Remove public registration of bypass-only flags, then centralize rejection codes/messages in `run-gate.js` constants or helpers used by parsing, runtime envelope failures, and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Use One Required-Evaluation Failure Payload Interface
**Finding key:** loop-76a046a070c49d0e8471
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R2
**Issue:** Required gate failure payloads are manually constructed in some paths and built through `requiredGuardrailFailure(...)` in others. Tests also use names like `executeProductionGate`, which obscures whether the public CLI or injected gate-flow path is under review. This creates cross-file ambiguity around the required-evaluation failure contract.
**Suggestion:** Rename the helper to a broader `requiredEvaluationFailure(...)`, use it for all required-evaluation failures, and align test helper names with the actual call path.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R2
**Issue:** Required gate failure payloads are manually constructed in some paths and built through `requiredGuardrailFailure(...)` in others. Tests also use names like `executeProductionGate`, which obscures whether the public CLI or injected gate-flow path is under review. This creates cross-file ambiguity around the required-evaluation failure contract.
**Suggestion:** Rename the helper to a broader `requiredEvaluationFailure(...)`, use it for all required-evaluation failures, and align test helper names with the actual call path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 5. Avoid Competing Sources For Spec And Routing Metadata
**Finding key:** loop-e75e66b360b70e275d64
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`
**Requirement:** R3
**Issue:** Several files duplicate authoritative metadata: `spec.md` repeats much of `spec.json`, `file-map.json` repeats shared file mappings under each requirement, and `set-step.js` duplicates `explicitTargetResolution` metadata with the registry. These are separate instances of the same cross-file maintainability problem: multiple sources can drift.
**Suggestion:** Pick a canonical owner for each metadata type. Generate Markdown/file maps from structured data where possible, and keep command routing metadata in the registry unless command-level configuration is explicitly required.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`
**Requirement:** R3
**Issue:** Several files duplicate authoritative metadata: `spec.md` repeats much of `spec.json`, `file-map.json` repeats shared file mappings under each requirement, and `set-step.js` duplicates `explicitTargetResolution` metadata with the registry. These are separate instances of the same cross-file maintainability problem: multiple sources can drift.
**Suggestion:** Pick a canonical owner for each metadata type. Generate Markdown/file maps from structured data where possible, and keep command routing metadata in the registry unless command-level configuration is explicitly required.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
