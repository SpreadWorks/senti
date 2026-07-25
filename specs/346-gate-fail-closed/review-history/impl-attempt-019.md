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

### 12. 1. Consolidate required failure object construction
**Finding key:** loop-15d341235455d73843c0
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Required failure objects are built both through `requiredGuardrailFailure()` and inline in `checkGuardrail()`, with repeated `passed: false`, `evaluations: []`, `failureKind`, `failureCode`, and `failureReason` shapes.  
**Suggestion:** Reuse `requiredGuardrailFailure()` for the `agent-unset` and caught agent evaluation failure paths as well. This keeps failure artifact shape centralized and reduces drift risk.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Required failure objects are built both through `requiredGuardrailFailure()` and inline in `checkGuardrail()`, with repeated `passed: false`, `evaluations: []`, `failureKind`, `failureCode`, and `failureReason` shapes.  
**Suggestion:** Reuse `requiredGuardrailFailure()` for the `agent-unset` and caught agent evaluation failure paths as well. This keeps failure artifact shape centralized and reduces drift risk.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Deduplicate public fixture rejection
**Finding key:** loop-aeaf44df8d78399fe30e
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `RunGateCommand.run()` has two identical `Envelope.fail(...)` blocks for `publicArguments.testFixture` and `input.testFixture`.  
**Suggestion:** Combine them into one condition, e.g. `if (publicArguments.testFixture || input.testFixture)`, and return the shared failure once.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `RunGateCommand.run()` has two identical `Envelope.fail(...)` blocks for `publicArguments.testFixture` and `input.testFixture`.  
**Suggestion:** Combine them into one condition, e.g. `if (publicArguments.testFixture || input.testFixture)`, and return the shared failure once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Rename `parsePublicGateArguments` for narrower intent
**Finding key:** loop-eb39491d7772f013d332
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `parsePublicGateArguments()` sounds like a general CLI parser, but it only detects forbidden bypass/test-fixture flags. That broader name may invite future callers to treat it as authoritative parsing.  
**Suggestion:** Rename it to something like `parsePublicGateBypassControls()` or `detectForbiddenPublicGateArgs()` to reflect its limited security gatekeeping purpose.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `parsePublicGateArguments()` sounds like a general CLI parser, but it only detects forbidden bypass/test-fixture flags. That broader name may invite future callers to treat it as authoritative parsing.  
**Suggestion:** Rename it to something like `parsePublicGateBypassControls()` or `detectForbiddenPublicGateArgs()` to reflect its limited security gatekeeping purpose.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Avoid mutating recovered review result in helper
**Finding key:** loop-4134a8bfb612b07a02d7
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `recoverFinalizedFlowReviewPostHookFailure()` both performs evidence recovery and mutates `result.artifacts`. That mixes recovery registration with caller-facing result shaping, making the helper harder to reason about and test.  
**Suggestion:** Return the recovery metadata from the helper, then let the caller update `result.artifacts`. If mutation is intentionally part of the helper contract, rename it to make that side effect explicit.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `recoverFinalizedFlowReviewPostHookFailure()` both performs evidence recovery and mutates `result.artifacts`. That mixes recovery registration with caller-facing result shaping, making the helper harder to reason about and test.  
**Suggestion:** Return the recovery metadata from the helper, then let the caller update `result.artifacts`. If mutation is intentionally part of the helper contract, rename it to make that side effect explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 5. Guard artifact JSON parsing
**Finding key:** loop-a4115353b28935928a68
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `JSON.parse(fs.readFileSync(...))` can throw, which makes the recovery helper fail hard instead of simply declining recovery for an unusable artifact.  
**Suggestion:** Wrap the read/parse in `try/catch` and return `null` on parse/read failure, consistent with the helper’s other “not recoverable” exits.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `JSON.parse(fs.readFileSync(...))` can throw, which makes the recovery helper fail hard instead of simply declining recovery for an unusable artifact.  
**Suggestion:** Wrap the read/parse in `try/catch` and return `null` on parse/read failure, consistent with the helper’s other “not recoverable” exits.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Remove unused registration method
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

### 18. 2. Replace wrapper class with focused helper functions
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

### 19. 3. Add explicit bounds for recovered finding arrays
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

### 20. 4. Use a clearer name for the recovered artifact input
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

### 21. 1. Remove Duplicate Target Resolution Configuration
**Finding key:** loop-d1ed7d30bd538e549e38
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `SetStepCommand` now sets `explicitTargetResolution: true` in its constructor, while `src/flow/registry.js` also sets `explicitTargetResolution: true` for `flow set step`. This splits the same routing behavior across two places and makes ownership unclear.  
**Suggestion:** Keep the setting in one layer only. Since other commands in the diff use registry-level `explicitTargetResolution`, remove the constructor from `SetStepCommand` and let the registry remain the single source of truth.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `SetStepCommand` now sets `explicitTargetResolution: true` in its constructor, while `src/flow/registry.js` also sets `explicitTargetResolution: true` for `flow set step`. This splits the same routing behavior across two places and makes ownership unclear.  
**Suggestion:** Keep the setting in one layer only. Since other commands in the diff use registry-level `explicitTargetResolution`, remove the constructor from `SetStepCommand` and let the registry remain the single source of truth.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Do Not Expose Required Evaluation Bypass on Public Gate Command
**Finding key:** loop-e6df378a9e32d3119fc7
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `flow run gate` adds `--skip-required-evaluation` to public CLI flags while the help text says required evaluations cannot be bypassed from the public CLI. This is internally inconsistent and appears to violate R5: production public CLI routes cannot bypass required evaluations.  
**Suggestion:** Remove `--skip-required-evaluation` from the public `flow run gate` flags. If tests need this bypass, route it through an isolated fixture/test-only command path instead of production routing.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `flow run gate` adds `--skip-required-evaluation` to public CLI flags while the help text says required evaluations cannot be bypassed from the public CLI. This is internally inconsistent and appears to violate R5: production public CLI routes cannot bypass required evaluations.  
**Suggestion:** Remove `--skip-required-evaluation` from the public `flow run gate` flags. If tests need this bypass, route it through an isolated fixture/test-only command path instead of production routing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 3. Extract Flow-State Optional Handling for Gate Hooks
**Finding key:** loop-4649e53d2406c1289770
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `flow run gate` now has repeated `if (!ctx.flowState) return` checks in `pre`, `post`, and `gateRuntimeLogStepId`. The behavior is valid, but the null-flow path is spread across several hook locations.  
**Suggestion:** Introduce a small helper such as `hasFlowState(ctx)` or a gate-specific wrapper for optional flow-state hooks, then use it consistently. This would make the `requiresFlow: false` design easier to audit and reduce repeated defensive checks.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `flow run gate` now has repeated `if (!ctx.flowState) return` checks in `pre`, `post`, and `gateRuntimeLogStepId`. The behavior is valid, but the null-flow path is spread across several hook locations.  
**Suggestion:** Introduce a small helper such as `hasFlowState(ctx)` or a gate-specific wrapper for optional flow-state hooks, then use it consistently. This would make the `requiresFlow: false` design easier to audit and reduce repeated defensive checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 4. Name the Review Post-Hook Recovery Branch More Explicitly
**Finding key:** loop-26bc4126a28e4adf56e9
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** The variable name `recovery` is vague for `recoverFinalizedFlowReviewPostHookFailure(...)`. The branch performs lifecycle actions and returns, so the value represents whether the failure was handled, not a recovery payload.  
**Suggestion:** Rename it to something like `postHookFailureHandled` or `finalizedReviewRecoveryHandled` to clarify that the branch is control-flow oriented.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** The variable name `recovery` is vague for `recoverFinalizedFlowReviewPostHookFailure(...)`. The branch performs lifecycle actions and returns, so the value represents whether the failure was handled, not a recovery payload.  
**Suggestion:** Rename it to something like `postHookFailureHandled` or `finalizedReviewRecoveryHandled` to clarify that the branch is control-flow oriented.
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

### 27. 1. Public gate bypass flag is exposed and rejected across layers
**Finding key:** loop-0dee924ec4b905d67470
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `src/flow/registry.js` reportedly exposes `--skip-required-evaluation` on the public `flow run gate` command, while `src/flow/lib/run-gate.js` treats public bypass/test-fixture controls as forbidden. That creates an interface inconsistency: help/registry suggests the flag exists, but command execution should fail closed.  
**Suggestion:** Remove `--skip-required-evaluation` from the public registry flags and keep bypass controls only in isolated test/fixture paths.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `src/flow/registry.js` reportedly exposes `--skip-required-evaluation` on the public `flow run gate` command, while `src/flow/lib/run-gate.js` treats public bypass/test-fixture controls as forbidden. That creates an interface inconsistency: help/registry suggests the flag exists, but command execution should fail closed.  
**Suggestion:** Remove `--skip-required-evaluation` from the public registry flags and keep bypass controls only in isolated test/fixture paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Target resolution ownership is duplicated
**Finding key:** loop-aea58f1eb89ced527183
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `SetStepCommand` sets `explicitTargetResolution: true` in its constructor, while `src/flow/registry.js` also configures the same behavior for `flow set step`. This duplicates routing configuration across command and registry layers.  
**Suggestion:** Keep `explicitTargetResolution` in one place, preferably the registry if that matches the surrounding command pattern.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `SetStepCommand` sets `explicitTargetResolution: true` in its constructor, while `src/flow/registry.js` also configures the same behavior for `flow set step`. This duplicates routing configuration across command and registry layers.  
**Suggestion:** Keep `explicitTargetResolution` in one place, preferably the registry if that matches the surrounding command pattern.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Spec content has two canonical-looking sources
**Finding key:** loop-27b624fce473ac5b5e4c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The summaries indicate `spec.md` duplicates much of `spec.json`, while `spec.json` also carries statuses and structured requirement data. This cross-file duplication can drift, especially around requirement/task status and retry-limit wording.  
**Suggestion:** Make `spec.json` canonical and generate `spec.md`, or add an explicit note in `spec.md` identifying the authoritative source.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The summaries indicate `spec.md` duplicates much of `spec.json`, while `spec.json` also carries statuses and structured requirement data. This cross-file duplication can drift, especially around requirement/task status and retry-limit wording.  
**Suggestion:** Make `spec.json` canonical and generate `spec.md`, or add an explicit note in `spec.md` identifying the authoritative source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Recovered evidence registration contract is unclear across files
**Finding key:** loop-15072fe58412c5be10d2
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `set-review-evidence.js` has a `toRegistration()` adapter, but the recovery path appears to register `artifact.evidence` directly, while `run-review.js` handles recovery results and artifact mutation. This creates multiple apparent contracts for the same recovered evidence boundary.  
**Suggestion:** Remove the unused adapter or make recovery return a single explicit registration object consumed by `run-review.js`.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `set-review-evidence.js` has a `toRegistration()` adapter, but the recovery path appears to register `artifact.evidence` directly, while `run-review.js` handles recovery results and artifact mutation. This creates multiple apparent contracts for the same recovered evidence boundary.  
**Suggestion:** Remove the unused adapter or make recovery return a single explicit registration object consumed by `run-review.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 5. Gate execution helper naming blurs production versus injected test flow
**Finding key:** loop-4e1f566ec7aa96ba2b42
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** The test helper `executeProductionGate` directly invokes `runGate.runGateFlow` with injected test doubles, while production public routing is handled through `src/flow/lib/run-gate.js` and `src/flow/registry.js`. The name suggests parity with the public production CLI interface when it is actually a lower-level injected flow.  
**Suggestion:** Rename it to reflect the boundary, such as `runGateFlowWithRequiredEvaluationScenario` or `runRequiredEvaluationScenario`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** The test helper `executeProductionGate` directly invokes `runGate.runGateFlow` with injected test doubles, while production public routing is handled through `src/flow/lib/run-gate.js` and `src/flow/registry.js`. The name suggests parity with the public production CLI interface when it is actually a lower-level injected flow.  
**Suggestion:** Rename it to reflect the boundary, such as `runGateFlowWithRequiredEvaluationScenario` or `runRequiredEvaluationScenario`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
