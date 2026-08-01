# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Consolidate Binding Command Wording
**Finding key:** loop-dc6ede3ec6aa45560d89
**Failure mode:** refactor
**File:** .agents/skills/senti.flow/SKILL.md
**Requirement:** R13
**Issue:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeats many near-identical command forms using `--expect-binding <token>`. This raises the chance of future drift when the binding syntax changes again.  
**Suggestion:** Define a short placeholder once, for example `bindingArgs = --expect-binding <token>`, then use that placeholder consistently in the dispatcher-loop examples and command reference.
**Suggestion:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeats many near-identical command forms using `--expect-binding <token>`. This raises the chance of future drift when the binding syntax changes again.  
**Suggestion:** Define a short placeholder once, for example `bindingArgs = --expect-binding <token>`, then use that placeholder consistently in the dispatcher-loop examples and command reference.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 3. Consolidate Binding Command Wording
**Finding key:** loop-8ddcf1dd7b864a81267d
**Failure mode:** refactor
**File:** .claude/skills/senti.flow/SKILL.md
**Requirement:** R13
**Issue:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeats many near-identical command forms using `--expect-binding <token>`. This raises the chance of future drift when the binding syntax changes again.  
**Suggestion:** Define a short placeholder once, for example `bindingArgs = --expect-binding <token>`, then use that placeholder consistently in the dispatcher-loop examples and command reference.
**Suggestion:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeats many near-identical command forms using `--expect-binding <token>`. This raises the chance of future drift when the binding syntax changes again.  
**Suggestion:** Define a short placeholder once, for example `bindingArgs = --expect-binding <token>`, then use that placeholder consistently in the dispatcher-loop examples and command reference.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Avoid Persisting Null Requirement IDs in Review Memory
**Finding key:** loop-92fb8d035679e3d603cd
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R13
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R13  
**Issue:** `ImplReviewFinding.toMemoryObject()` now always emits `requirementId`, even when it is `null`. That creates a noisier memory shape and may force downstream consumers to handle an explicit null where absence would be simpler.  
**Suggestion:** Match the existing optional-field style used for `file` and `guardrailId`: only include `requirementId` when it is non-null.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R13  
**Issue:** `ImplReviewFinding.toMemoryObject()` now always emits `requirementId`, even when it is `null`. That creates a noisier memory shape and may force downstream consumers to handle an explicit null where absence would be simpler.  
**Suggestion:** Match the existing optional-field style used for `file` and `guardrailId`: only include `requirementId` when it is non-null.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Extract the `run-` Action Prefix
**Finding key:** loop-4e0a94a976532adefcae
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R13
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** The lifecycle-owned action prefix is duplicated as the string literal `"run-"` in both validation and `executionCommand` derivation.  
**Suggestion:** Introduce a small constant such as `const RUN_ACTION_PREFIX = "run-";` and use it for both `startsWith()` and `slice()`. This keeps the invariant and command derivation tied to the same definition.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** The lifecycle-owned action prefix is duplicated as the string literal `"run-"` in both validation and `executionCommand` derivation.  
**Suggestion:** Introduce a small constant such as `const RUN_ACTION_PREFIX = "run-";` and use it for both `startsWith()` and `slice()`. This keeps the invariant and command derivation tied to the same definition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 4. Bound diff path extraction
**Finding key:** loop-9c127cc06b21e0150e5b
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R13  
**Issue:** `changedPathsFromDiff(diff)` scans the full diff and materializes all matches without an explicit size or count bound. That conflicts with the bounded-resource-usage guardrail for bulk processing.  
**Suggestion:** Add explicit bounds, for example a maximum diff string length and maximum changed-path count, and fail with a clear validation error when exceeded.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R13  
**Issue:** `changedPathsFromDiff(diff)` scans the full diff and materializes all matches without an explicit size or count bound. That conflicts with the bounded-resource-usage guardrail for bulk processing.  
**Suggestion:** Add explicit bounds, for example a maximum diff string length and maximum changed-path count, and fail with a clear validation error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Prevent caller override of flow boundary marker
**Finding key:** loop-c52f5737d98f53bb9cfe
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `flowCommandBoundary: true` is set before `...input`, so a caller-provided `input.flowCommandBoundary` can overwrite it. That weakens the boundary marker added for target-sensitive validation.  
**Suggestion:** Move `flowCommandBoundary: true` after `...input`, or assign it after object construction so it is not caller-controlled.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `flowCommandBoundary: true` is set before `...input`, so a caller-provided `input.flowCommandBoundary` can overwrite it. That weakens the boundary marker added for target-sensitive validation.  
**Suggestion:** Move `flowCommandBoundary: true` after `...input`, or assign it after object construction so it is not caller-controlled.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Avoid passing the whole command context into binding validation
**Finding key:** loop-5a7e940d6d2ace5af237
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `context: ctx` passes the entire mutable command context into `targetBindingMismatch`, expanding the coupling between the dispatcher and binding validation. This makes the validation surface harder to reason about and easier to accidentally depend on unrelated context fields.  
**Suggestion:** Pass only the specific fields needed by `targetBindingMismatch`, or introduce a small typed/structured validation input object.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `context: ctx` passes the entire mutable command context into `targetBindingMismatch`, expanding the coupling between the dispatcher and binding validation. This makes the validation surface harder to reason about and easier to accidentally depend on unrelated context fields.  
**Suggestion:** Pass only the specific fields needed by `targetBindingMismatch`, or introduce a small typed/structured validation input object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Consolidate guarded command construction
**Finding key:** loop-e21f6a7c471d7c5f807c
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand` and `refreshCommand` now duplicate the same binding-aware command construction pattern: use `binding.guardCommand(...)` when present, otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Add a shared helper such as `guardedCommand(baseCommand, state, binding)` and have both functions delegate to it.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand` and `refreshCommand` now duplicate the same binding-aware command construction pattern: use `binding.guardCommand(...)` when present, otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Add a shared helper such as `guardedCommand(baseCommand, state, binding)` and have both functions delegate to it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Remove now-unused informational disposition computation
**Finding key:** loop-2086fd42259efe9f581e
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `expectedProposal` is still computed as `"informational"` for non-mandatory findings, but the new condition only enforces conflicts when `mandatory` is true. That makes the non-mandatory branch misleading dead logic.  
**Suggestion:** Simplify to compute the policy disposition only inside the mandatory branch, e.g. check `if (mandatory && candidate.proposedDisposition !== null && candidate.proposedDisposition !== "must-fix")`.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `expectedProposal` is still computed as `"informational"` for non-mandatory findings, but the new condition only enforces conflicts when `mandatory` is true. That makes the non-mandatory branch misleading dead logic.  
**Suggestion:** Simplify to compute the policy disposition only inside the mandatory branch, e.g. check `if (mandatory && candidate.proposedDisposition !== null && candidate.proposedDisposition !== "must-fix")`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Avoid suppressing unrelated binding-capture failures
**Finding key:** loop-77ce8defcd415be538e2
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `captureNextActionBinding()` catches all errors and returns `null` when resumed from the main root after worktree removal. That can hide unrelated bugs in `FlowTargetBinding.captureContext()` under the same condition.  
**Suggestion:** Only suppress the specific expected failure mode for missing/removed worktree binding, or inspect the error type/message before returning `null`; otherwise rethrow.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `captureNextActionBinding()` catches all errors and returns `null` when resumed from the main root after worktree removal. That can hide unrelated bugs in `FlowTargetBinding.captureContext()` under the same condition.  
**Suggestion:** Only suppress the specific expected failure mode for missing/removed worktree binding, or inspect the error type/message before returning `null`; otherwise rethrow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Consolidate guarded recovery directive construction
**Finding key:** loop-91931b15f021cf5e1ecf
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `buildPreimplementationBootstrapDirective()` and `buildCanonicalReviewPassRecoveryDirective()` now repeat the same pattern: build a base command, wrap it with `guardedCommand(..., state, binding)`, and construct an `ExecuteCommandDirective`.  
**Suggestion:** Add a small local helper for guarded `ExecuteCommandDirective` creation, or at least for guarded command construction, to keep recovery directive behavior consistent as more target-sensitive recovery commands are added.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `buildPreimplementationBootstrapDirective()` and `buildCanonicalReviewPassRecoveryDirective()` now repeat the same pattern: build a base command, wrap it with `guardedCommand(..., state, binding)`, and construct an `ExecuteCommandDirective`.  
**Suggestion:** Add a small local helper for guarded `ExecuteCommandDirective` creation, or at least for guarded command construction, to keep recovery directive behavior consistent as more target-sensitive recovery commands are added.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Fix Inverted `preserveImplRepair` Filtering
**Finding key:** loop-68240d8bc9b0e945c03b
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `plannedRepairStepChanges()` uses `!preserveImplRepair || stepId !== "impl-repair"`, which appears inverted: the default now includes `impl-repair`, while `{ preserveImplRepair: true }` excludes it. The option name also does not clearly describe whether the step should be excluded from planned changes.  
**Suggestion:** Rename the option to something explicit like `includeImplRepair` or `skipImplRepair`, and align the predicate with the name. For example, `includeImplRepair ? true : stepId !== "impl-repair"`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `plannedRepairStepChanges()` uses `!preserveImplRepair || stepId !== "impl-repair"`, which appears inverted: the default now includes `impl-repair`, while `{ preserveImplRepair: true }` excludes it. The option name also does not clearly describe whether the step should be excluded from planned changes.  
**Suggestion:** Rename the option to something explicit like `includeImplRepair` or `skipImplRepair`, and align the predicate with the name. For example, `includeImplRepair ? true : stepId !== "impl-repair"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Extract Recovery Identity Construction
**Finding key:** loop-2af091c46be91f87da58
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` duplicates nearly identical construction of `previousIdentity` and `nextIdentity`, with only tree/digest/invocation fields changing. This makes future target-binding identity changes easy to apply to one side but miss on the other.  
**Suggestion:** Add a small helper such as `recoveryIdentityForMutation(input, prefix)` or build a shared base object, then spread in previous/next-specific fields.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` duplicates nearly identical construction of `previousIdentity` and `nextIdentity`, with only tree/digest/invocation fields changing. This makes future target-binding identity changes easy to apply to one side but miss on the other.  
**Suggestion:** Add a small helper such as `recoveryIdentityForMutation(input, prefix)` or build a shared base object, then spread in previous/next-specific fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Either Compare Or Remove `dispatchInvocationId`
**Finding key:** loop-c8eca0eeb2e4c2823cca
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` accepts and stores `dispatchInvocationId`, and mutations persist it, but `changedIdentity()` does not compare it. That makes the field look semantically important while having no effect on reuse decisions.  
**Suggestion:** If dispatch invocation identity is part of the audited same-binding recovery receipt, include it in the compared fields. If not, avoid storing it in `ReviewRecoveryIdentity` and keep it only on persisted records where needed.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` accepts and stores `dispatchInvocationId`, and mutations persist it, but `changedIdentity()` does not compare it. That makes the field look semantically important while having no effect on reuse decisions.  
**Suggestion:** If dispatch invocation identity is part of the audited same-binding recovery receipt, include it in the compared fields. If not, avoid storing it in `ReviewRecoveryIdentity` and keep it only on persisted records where needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Clarify Target-Digest State Resolution
**Finding key:** loop-9d0fb76e3034779ab32f
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `convergenceStateForTargetDigest()` now always clears `blocker` and `toolingOutcome`, but `resolveReviewOperationForFlowState()` calls it even when the target digest matches. The function name does not make it obvious that it intentionally strips stored blocker state.  
**Suggestion:** Rename it to reflect the behavior, such as `freshConvergenceStateForTargetDigest()`, or split the exact-match path from the “input changed, blocker no longer applies” path so the blocker-clearing behavior is explicit at the call site.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `convergenceStateForTargetDigest()` now always clears `blocker` and `toolingOutcome`, but `resolveReviewOperationForFlowState()` calls it even when the target digest matches. The function name does not make it obvious that it intentionally strips stored blocker state.  
**Suggestion:** Rename it to reflect the behavior, such as `freshConvergenceStateForTargetDigest()`, or split the exact-match path from the “input changed, blocker no longer applies” path so the blocker-clearing behavior is explicit at the call site.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Clarify Dispatch Invocation ID Lifetime
**Finding key:** loop-4cd11a3cf83cc6ba8e71
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `dispatchInvocationId` is generated once before the dispatch loop, then reused for every agent call in `dispatchContinuation`. The name reads like a single dispatcher invocation, but it is attached to each worker execution environment, which makes the intended lifetime ambiguous.  
**Suggestion:** Either rename it to reflect loop-wide scope, such as `dispatchSessionId`, or generate it inside the loop if each agent call should receive a unique invocation id. This keeps the recovery/context-compaction contract easier to reason about.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `dispatchInvocationId` is generated once before the dispatch loop, then reused for every agent call in `dispatchContinuation`. The name reads like a single dispatcher invocation, but it is attached to each worker execution environment, which makes the intended lifetime ambiguous.  
**Suggestion:** Either rename it to reflect loop-wide scope, such as `dispatchSessionId`, or generate it inside the loop if each agent call should receive a unique invocation id. This keeps the recovery/context-compaction contract easier to reason about.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Avoid mutating the review execution result
**Finding key:** loop-1c81f2b2a3810742992d
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R10  
**Issue:** `persistCanonicalReviewArtifact` now writes a fallback into `result.changed`. That mutates an input object and makes later code observe a value that was not actually reported by the review execution.  
**Suggestion:** Compute a local normalized `changed` array instead, then validate against that:

```js
const reportedChanged = Array.isArray(result.changed) ? result.changed : [];
const changed =
  reportedChanged.length > 0
    ? reportedChanged
    : fs.existsSync(artifactPath)
      ? [path.relative(ctx.root, artifactPath).split(path.sep).join("/")]
      : [];
```

Then check `changed.length` rather than changing `result.changed`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R10  
**Issue:** `persistCanonicalReviewArtifact` now writes a fallback into `result.changed`. That mutates an input object and makes later code observe a value that was not actually reported by the review execution.  
**Suggestion:** Compute a local normalized `changed` array instead, then validate against that:

```js
const reportedChanged = Array.isArray(result.changed) ? result.changed : [];
const changed =
  reportedChanged.length > 0
    ? reportedChanged
    : fs.existsSync(artifactPath)
      ? [path.relative(ctx.root, artifactPath).split(path.sep).join("/")]
      : [];
```

Then check `changed.length` rather than changing `result.changed`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Extract canonical artifact path construction
**Finding key:** loop-9ad16a0391fc5a66b459
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R10  
**Issue:** `persistCanonicalReviewArtifact` now mixes artifact-name selection, spec-dir resolution, fallback `changed` inference, and artifact existence validation inline. The path-building logic is mechanical and likely useful wherever canonical review artifacts are handled.  
**Suggestion:** Extract a small local helper such as `canonicalArtifactPath(ctx, phase)` returning `{ artifactName, artifactPath }`. This keeps the validation flow easier to scan and reduces future duplication if more canonical artifact checks are added.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R10  
**Issue:** `persistCanonicalReviewArtifact` now mixes artifact-name selection, spec-dir resolution, fallback `changed` inference, and artifact existence validation inline. The path-building logic is mechanical and likely useful wherever canonical review artifacts are handled.  
**Suggestion:** Extract a small local helper such as `canonicalArtifactPath(ctx, phase)` returning `{ artifactName, artifactPath }`. This keeps the validation flow easier to scan and reduces future duplication if more canonical artifact checks are added.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Extract Review Recovery Identity Construction
**Finding key:** loop-8b8a4ade4bf1ba73a0df
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` is now constructed in two places with mostly the same contextual fields (`runId`, issue/spec fields, target binding digest, dispatch invocation id). This makes it easy for future changes to update one identity path but not the other, which is risky for convergence and recovery correctness.  
**Suggestion:** Add a small helper, for example `reviewRecoveryIdentityContext(ctx)`, that returns the shared identity fields. Use it in both `currentReviewRecoveryIdentity()` and `unchangedReviewConvergenceTarget()`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` is now constructed in two places with mostly the same contextual fields (`runId`, issue/spec fields, target binding digest, dispatch invocation id). This makes it easy for future changes to update one identity path but not the other, which is risky for convergence and recovery correctness.  
**Suggestion:** Add a small helper, for example `reviewRecoveryIdentityContext(ctx)`, that returns the shared identity fields. Use it in both `currentReviewRecoveryIdentity()` and `unchangedReviewConvergenceTarget()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Rename Normalization Helper To Verb Form
**Finding key:** loop-6a9b8d598e582d73681d
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R4
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R4  
**Issue:** `normalizedExecutionEnvironment()` reads like a value, but it performs validation and may throw. Existing command/agent helper naming appears action-oriented for behavior-heavy helpers.  
**Suggestion:** Rename it to `normalizeExecutionEnvironment()` or `buildExecutionEnvironmentOverride()` to make the validation/construction behavior clearer at call sites.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R4  
**Issue:** `normalizedExecutionEnvironment()` reads like a value, but it performs validation and may throw. Existing command/agent helper naming appears action-oriented for behavior-heavy helpers.  
**Suggestion:** Rename it to `normalizeExecutionEnvironment()` or `buildExecutionEnvironmentOverride()` to make the validation/construction behavior clearer at call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Account For Environment Entry Separators In Byte Limit
**Finding key:** loop-9af13fa6d0483dcf0e57
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R4
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R4  
**Issue:** The byte cap counts only `name` and `entry` bytes, but the actual environment representation also includes at least the `=` separator per variable. The current limit is still bounded, but the implementation undercounts its own stated maximum.  
**Suggestion:** Change the accounting to include separator overhead, e.g. `Buffer.byteLength(name) + 1 + Buffer.byteLength(entry)`, so the bound more accurately reflects the environment payload size.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R4  
**Issue:** The byte cap counts only `name` and `entry` bytes, but the actual environment representation also includes at least the `=` separator per variable. The current limit is still bounded, but the implementation undercounts its own stated maximum.  
**Suggestion:** Change the accounting to include separator overhead, e.g. `Buffer.byteLength(name) + 1 + Buffer.byteLength(entry)`, so the bound more accurately reflects the environment payload size.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Extract Binding Validation Envelope Logic
**Finding key:** loop-040e5a12c798b956e7ba
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R4
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `targetMismatchEnvelopeForInput()` duplicates binding validation paths for `context` versus explicit `flowState/mainRoot/authorityRoot`, including repeated mismatch envelope construction and exception handling. This makes future changes to `ACTIVE_FLOW_MISMATCH` behavior easy to apply inconsistently.  
**Suggestion:** Add a small helper such as `bindingMismatchDataForInput(expectation, { flowState, mainRoot, authorityRoot, worktreePath, context })` that returns mismatch data or `null`, and let `targetMismatchEnvelopeForInput()` only translate that into an envelope.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `targetMismatchEnvelopeForInput()` duplicates binding validation paths for `context` versus explicit `flowState/mainRoot/authorityRoot`, including repeated mismatch envelope construction and exception handling. This makes future changes to `ACTIVE_FLOW_MISMATCH` behavior easy to apply inconsistently.  
**Suggestion:** Add a small helper such as `bindingMismatchDataForInput(expectation, { flowState, mainRoot, authorityRoot, worktreePath, context })` that returns mismatch data or `null`, and let `targetMismatchEnvelopeForInput()` only translate that into an envelope.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Simplify Redundant Expectation Check
**Finding key:** loop-351c864b7278bcc006f7
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R6
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R6  
**Issue:** In `resolveActiveFlow()`, after `if (!expectation) return ...`, the code still computes `const mismatch = expectation ? target.mismatchAgainst(expectation) : null;`. The ternary is dead defensive logic because `expectation` is guaranteed truthy at that point.  
**Suggestion:** Replace it with `const mismatch = target.mismatchAgainst(expectation);` to make the control flow clearer.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R6  
**Issue:** In `resolveActiveFlow()`, after `if (!expectation) return ...`, the code still computes `const mismatch = expectation ? target.mismatchAgainst(expectation) : null;`. The ternary is dead defensive logic because `expectation` is guaranteed truthy at that point.  
**Suggestion:** Replace it with `const mismatch = target.mismatchAgainst(expectation);` to make the control flow clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Fix Inconsistent Formatting In Binding Branch
**Finding key:** loop-f36f152c22ad5cd2ebe7
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R4
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** The `else` block inside `targetMismatchEnvelopeForInput()` is mis-indented, making the binding validation control flow harder to read and review. This is especially risky around mutation-prevention guard code.  
**Suggestion:** Reformat the `else` block so the `if (!flowState || !mainRoot || !authorityRoot)` and following `try/catch` are visibly scoped inside the `else`.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** The `else` block inside `targetMismatchEnvelopeForInput()` is mis-indented, making the binding validation control flow harder to read and review. This is especially risky around mutation-prevention guard code.  
**Suggestion:** Reformat the `else` block so the `if (!flowState || !mainRoot || !authorityRoot)` and following `try/catch` are visibly scoped inside the `else`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Avoid JSON Stringification For Authority Equality
**Finding key:** loop-2b75eb4f83dcf002cc9b
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` compares authorities with `JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON())`. This is brittle and inconsistent with the explicit field-by-field comparison already implemented in `bindingMismatch()`.  
**Suggestion:** Either remove `equals()` if unused, or implement it through a field comparison helper shared with `bindingMismatch()`.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` compares authorities with `JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON())`. This is brittle and inconsistent with the explicit field-by-field comparison already implemented in `bindingMismatch()`.  
**Suggestion:** Either remove `equals()` if unused, or implement it through a field comparison helper shared with `bindingMismatch()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Remove Unused Authority Equality Method
**Finding key:** loop-726d7095bd39d34072fe
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears unused in the diff and adds an extra comparison mechanism alongside `bindingMismatch()`. Multiple comparison paths increase the chance of authority rules diverging.  
**Suggestion:** Delete `equals()` unless there is an existing caller outside the shown diff; use `bindingMismatch()` as the single authority comparison path.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears unused in the diff and adds an extra comparison mechanism alongside `bindingMismatch()`. Multiple comparison paths increase the chance of authority rules diverging.  
**Suggestion:** Delete `equals()` unless there is an existing caller outside the shown diff; use `bindingMismatch()` as the single authority comparison path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 4. Add a parser helper for last agent message semantics
**Finding key:** loop-9a4f5c0abfacca11c971
**Failure mode:** refactor
**File:** src/lib/provider.js
**Requirement:** R13
**Issue:** **File:** `src/lib/provider.js`  
**Requirement:** R13  
**Issue:** `parse()` now keeps only the last `agent_message` by assigning `text = ...`, but the loop gives no local name or helper that documents this behavior. Since the previous behavior accumulated text, this semantic change is easy to miss during maintenance.  
**Suggestion:** Extract the assignment into a small helper or at least use a clearly named local update point such as `lastAgentMessageText = String(...)`, then return that value. This makes the intended “last message wins” behavior explicit.
**Suggestion:** **File:** `src/lib/provider.js`  
**Requirement:** R13  
**Issue:** `parse()` now keeps only the last `agent_message` by assigning `text = ...`, but the loop gives no local name or helper that documents this behavior. Since the previous behavior accumulated text, this semantic change is easy to miss during maintenance.  
**Suggestion:** Extract the assignment into a small helper or at least use a clearly named local update point such as `lastAgentMessageText = String(...)`, then return that value. This makes the intended “last message wins” behavior explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Simplify repeated mismatch-stop wording
**Finding key:** loop-796d310cd7e39edae69a
**Failure mode:** refactor
**File:** src/skills/partials/core-principle.md
**Requirement:** R13
**Issue:** **File:** `src/skills/partials/core-principle.md`  
**Requirement:** R13  
**Issue:** The updated `ACTIVE_FLOW_MISMATCH` guidance repeats the same “refresh target authority through the CLI and continue only when the returned directive or command is for the intended Flow” concept in prose form, while `src/skills/senti.flow/SKILL.md` has similar but not identical wording.  
**Suggestion:** Consolidate the rule into a single reusable sentence in the partial and have the skill text mirror it exactly, reducing drift between the core principle and generated skill artifact.
**Suggestion:** **File:** `src/skills/partials/core-principle.md`  
**Requirement:** R13  
**Issue:** The updated `ACTIVE_FLOW_MISMATCH` guidance repeats the same “refresh target authority through the CLI and continue only when the returned directive or command is for the intended Flow” concept in prose form, while `src/skills/senti.flow/SKILL.md` has similar but not identical wording.  
**Suggestion:** Consolidate the rule into a single reusable sentence in the partial and have the skill text mirror it exactly, reducing drift between the core principle and generated skill artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Extract binding-command wording into one canonical phrase
**Finding key:** loop-6293cae7e9b4d9143d9c
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The new `--expect-binding <token>` contract is repeated in several slightly different forms: “CLI-returned”, “CLI-generated”, “current CLI-generated binding”, and full command examples. This increases the chance future edits reintroduce `targetGuardArgs`-style manual assembly language in one section but not another.  
**Suggestion:** Define one short canonical term near the first binding mention, for example “binding command means the exact CLI-returned command containing `--expect-binding <token>`”, then use that term consistently in the dispatcher loop and command reference.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The new `--expect-binding <token>` contract is repeated in several slightly different forms: “CLI-returned”, “CLI-generated”, “current CLI-generated binding”, and full command examples. This increases the chance future edits reintroduce `targetGuardArgs`-style manual assembly language in one section but not another.  
**Suggestion:** Define one short canonical term near the first binding mention, for example “binding command means the exact CLI-returned command containing `--expect-binding <token>`”, then use that term consistently in the dispatcher loop and command reference.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Remove lingering manual guard examples from binding-era instructions
**Finding key:** loop-8abf9704aa6bedf9027c
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** Early sections still instruct agents to run `senti flow get status <runId> --expect-run-id <runId>` and add `--expect-issue` / `--expect-spec` guards for existing-target continuation. That may be intentional for pre-dispatch verification, but it now sits next to “Do not assemble runId, Issue, or spec guards yourself,” creating an inconsistent pattern.  
**Suggestion:** Clarify the phase boundary explicitly: manual runId/Issue/spec guards are allowed only before a CLI binding exists; once a binding exists, all target-sensitive continuation must use the binding command exactly.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** Early sections still instruct agents to run `senti flow get status <runId> --expect-run-id <runId>` and add `--expect-issue` / `--expect-spec` guards for existing-target continuation. That may be intentional for pre-dispatch verification, but it now sits next to “Do not assemble runId, Issue, or spec guards yourself,” creating an inconsistent pattern.  
**Suggestion:** Clarify the phase boundary explicitly: manual runId/Issue/spec guards are allowed only before a CLI binding exists; once a binding exists, all target-sensitive continuation must use the binding command exactly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Reduce Inline Fixture Boilerplate
**Finding key:** loop-6fd4eddaa8544be4d483
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R6  
**Issue:** The new unauthoritative task review test manually creates the temp spec directory, writes `spec.json`, builds review JSON, runs the review, and reads the artifact inline. This adds setup noise around the behavior being tested.  
**Suggestion:** Extract the repeated fixture creation/readback into a small local helper, for example `runImplReviewWithReviewOutput(...)`, so the test emphasizes the downgrade from `must-fix` to `informational`.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R6  
**Issue:** The new unauthoritative task review test manually creates the temp spec directory, writes `spec.json`, builds review JSON, runs the review, and reads the artifact inline. This adds setup noise around the behavior being tested.  
**Suggestion:** Extract the repeated fixture creation/readback into a small local helper, for example `runImplReviewWithReviewOutput(...)`, so the test emphasizes the downgrade from `must-fix` to `informational`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Extract Binding Assertion Helper
**Finding key:** loop-af1f0f0f60bd4b7c9e7a
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The same `--expect-binding` and legacy flag exclusion assertions are repeated across multiple directive tests.  
**Suggestion:** Add a helper such as `assertUsesTargetBinding(nextAction)` that checks for `--expect-binding` and rejects `--expect-run-id|--expect-issue|--expect-spec`, then reuse it in each test.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The same `--expect-binding` and legacy flag exclusion assertions are repeated across multiple directive tests.  
**Suggestion:** Add a helper such as `assertUsesTargetBinding(nextAction)` that checks for `--expect-binding` and rejects `--expect-run-id|--expect-issue|--expect-spec`, then reuse it in each test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Rename Generic Binding Helper
**Finding key:** loop-95d0f7a6f588bfafb67f
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new helper is named `binding()`, which is vague in a test file with several domain concepts.  
**Suggestion:** Rename it to something more specific, such as `flowTargetBinding()` or `captureTestBinding()`, to make each `NextActionDirectiveResolver` setup clearer.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new helper is named `binding()`, which is vague in a test file with several domain concepts.  
**Suggestion:** Rename it to something more specific, such as `flowTargetBinding()` or `captureTestBinding()`, to make each `NextActionDirectiveResolver` setup clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Extract repeated changed skill source path
**Finding key:** loop-7f2831514376ee7f17b3
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new upgrade-evidence test repeats `src/skills/senti.flow/SKILL.md` in `checkedPaths`, the synthetic diff, `requiredPaths`, and the expected artifact. This makes the test brittle if the fixture path changes.  
**Suggestion:** Introduce a local constant such as `const changedSkillPath = "src/skills/senti.flow/SKILL.md";` and reuse it throughout the test.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new upgrade-evidence test repeats `src/skills/senti.flow/SKILL.md` in `checkedPaths`, the synthetic diff, `requiredPaths`, and the expected artifact. This makes the test brittle if the fixture path changes.  
**Suggestion:** Introduce a local constant such as `const changedSkillPath = "src/skills/senti.flow/SKILL.md";` and reuse it throughout the test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Align help assertion with new binding requirement
**Finding key:** loop-952d0527bcc30ac45846
**Failure mode:** refactor
**File:** tests/unit/flow/rewind-test-evidence.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/rewind-test-evidence.test.js`  
**Requirement:** R7  
**Issue:** The test now passes `--expect-binding`, but the asserted help text still says only `runId, spec, and Issue identity guards are required`. That leaves the test documenting the old contract.  
**Suggestion:** Update the expected help text assertion to include binding identity, or match a newer canonical phrase if the CLI help already changed.
**Suggestion:** **File:** `tests/unit/flow/rewind-test-evidence.test.js`  
**Requirement:** R7  
**Issue:** The test now passes `--expect-binding`, but the asserted help text still says only `runId, spec, and Issue identity guards are required`. That leaves the test documenting the old contract.  
**Suggestion:** Update the expected help text assertion to include binding identity, or match a newer canonical phrase if the CLI help already changed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Consolidate repository fixture setup
**Finding key:** loop-eb77748a14cd52641c4f
**Failure mode:** refactor
**File:** tests/unit/flow/set-retry.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` duplicates most of `initializeRepository`: git init, config, fixture file creation, add, and commit. The only meaningful difference is adding an untracked spec after the initial commit.  
**Suggestion:** Replace the new helper with a smaller wrapper around `initializeRepository(root)`:

```js
function initializeRepositoryWithUntrackedSpec(root) {
  initializeRepository(root);
  fs.mkdirSync(path.join(root, "specs", "001-retry"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "001-retry", "spec.json"), '{"revision":1}\n');
}
```

This keeps fixture setup consistent and avoids future drift between the two repository initialization paths.
**Suggestion:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` duplicates most of `initializeRepository`: git init, config, fixture file creation, add, and commit. The only meaningful difference is adding an untracked spec after the initial commit.  
**Suggestion:** Replace the new helper with a smaller wrapper around `initializeRepository(root)`:

```js
function initializeRepositoryWithUntrackedSpec(root) {
  initializeRepository(root);
  fs.mkdirSync(path.join(root, "specs", "001-retry"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "001-retry", "spec.json"), '{"revision":1}\n');
}
```

This keeps fixture setup consistent and avoids future drift between the two repository initialization paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Extract Repeated Binding Command Assertions
**Finding key:** loop-55b8c13b61b54a41205f
**Failure mode:** refactor
**File:** tests/unit/flow/skill-prelude-auto.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/skill-prelude-auto.test.js`  
**Requirement:** R7  
**Issue:** The test repeats several `assert.match(dispatcher, /... --expect-binding <token>/)` checks with only the command text changing. This makes future binding-contract updates more error-prone.  
**Suggestion:** Store the expected dispatcher command patterns in an array and iterate over them, e.g. `for (const pattern of expectedBindingCommands) assert.match(dispatcher, pattern);`.
**Suggestion:** **File:** `tests/unit/flow/skill-prelude-auto.test.js`  
**Requirement:** R7  
**Issue:** The test repeats several `assert.match(dispatcher, /... --expect-binding <token>/)` checks with only the command text changing. This makes future binding-contract updates more error-prone.  
**Suggestion:** Store the expected dispatcher command patterns in an array and iterate over them, e.g. `for (const pattern of expectedBindingCommands) assert.match(dispatcher, pattern);`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Rename Test Helper To Emphasize In-Memory State
**Finding key:** loop-026e652ff75c2d5ebc3d
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R4  
**Issue:** `mutableFlowManager` is accurate but broad; it does not make clear that this is a lightweight in-memory test double around a shared `state` object.  
**Suggestion:** Rename it to something like `inMemoryFlowManager` or `flowManagerForState` to better match its test-double role and avoid implying it is a production-style mutable manager.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R4  
**Issue:** `mutableFlowManager` is accurate but broad; it does not make clear that this is a lightweight in-memory test double around a shared `state` object.  
**Suggestion:** Rename it to something like `inMemoryFlowManager` or `flowManagerForState` to better match its test-double role and avoid implying it is a production-style mutable manager.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Extract Active Step Counting Helper
**Finding key:** loop-42b4ca5af57e9bd85a79
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R4  
**Issue:** The final assertion builds an inline `flatMap(...).filter(...)` expression to count active leaf steps. That logic is more complex than the assertion’s intent and may be duplicated in future flow-state tests.  
**Suggestion:** Add a small local helper such as `countInProgressLeafSteps(state)` and use it in the assertion. This makes the test read as behavior rather than tree traversal mechanics.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R4  
**Issue:** The final assertion builds an inline `flatMap(...).filter(...)` expression to count active leaf steps. That logic is more complex than the assertion’s intent and may be duplicated in future flow-state tests.  
**Suggestion:** Add a small local helper such as `countInProgressLeafSteps(state)` and use it in the assertion. This makes the test read as behavior rather than tree traversal mechanics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Extract Shared Agent Setup for Environment Limit Tests
**Finding key:** loop-c959449f773a824680ad
**Failure mode:** refactor
**File:** tests/unit/lib/agent.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R1  
**Issue:** The two new execution-environment validation tests duplicate the same `makeAgent({ command: "echo", args: ["{{PROMPT}}"] })` setup.  
**Suggestion:** Introduce a small local helper such as `makeEchoAgent()` inside the describe block, or reuse an existing fixture if one exists in this file, so future environment-limit tests do not repeat the command shape.
**Suggestion:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R1  
**Issue:** The two new execution-environment validation tests duplicate the same `makeAgent({ command: "echo", args: ["{{PROMPT}}"] })` setup.  
**Suggestion:** Introduce a small local helper such as `makeEchoAgent()` inside the describe block, or reuse an existing fixture if one exists in this file, so future environment-limit tests do not repeat the command shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Name the Execution Environment Limits
**Finding key:** loop-f1a7cf25e8c5d317b114
**Failure mode:** refactor
**File:** tests/unit/lib/agent.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R1  
**Issue:** The limits `65`, `64`, and `64 * 1024` are embedded directly in the tests. This makes the intended boundary less obvious and risks drift if the production constants change.  
**Suggestion:** Use named test constants such as `MAX_EXECUTION_ENVIRONMENT_VARIABLES = 64` and `MAX_EXECUTION_ENVIRONMENT_BYTES = 64 * 1024`, then build the failing cases from those names.
**Suggestion:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R1  
**Issue:** The limits `65`, `64`, and `64 * 1024` are embedded directly in the tests. This makes the intended boundary less obvious and risks drift if the production constants change.  
**Suggestion:** Use named test constants such as `MAX_EXECUTION_ENVIRONMENT_VARIABLES = 64` and `MAX_EXECUTION_ENVIRONMENT_BYTES = 64 * 1024`, then build the failing cases from those names.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Reduce Provider Event Fixture Noise
**Finding key:** loop-fb84af2f4224ca3709b6
**Failure mode:** refactor
**File:** tests/unit/lib/provider.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The new provider test repeats verbose event object construction for each `item.completed` agent message, which makes the important distinction between progress and final messages harder to scan.  
**Suggestion:** Add small local helpers like `agentMessage(payload)`, `commandExecution(command)`, and `turnCompleted(usage)` within the test or file. That would make the test emphasize the behavior: earlier agent message is ignored, final agent message is parsed, usage is normalized.
**Suggestion:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The new provider test repeats verbose event object construction for each `item.completed` agent message, which makes the important distinction between progress and final messages harder to scan.  
**Suggestion:** Add small local helpers like `agentMessage(payload)`, `commandExecution(command)`, and `turnCompleted(usage)` within the test or file. That would make the test emphasize the behavior: earlier agent message is ignored, final agent message is parsed, usage is normalized.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Canonicalize Binding Command Wording
**Finding key:** loop-1cc43efe1f3e0f0898ad
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** Binding-era command guidance is duplicated across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, `src/skills/partials/core-principle.md`, and several tests. The wording varies between “CLI-returned”, “CLI-generated”, “current CLI-generated binding”, and manual guard phrasing, which creates a cross-file contract drift risk.
**Suggestion:** Define one canonical phrase for binding continuation, preferably in the shared partial, and mirror it exactly in both skill files and tests. Explicitly state the phase boundary: manual guards are only valid before a binding exists; after that, use the exact CLI-returned `--expect-binding <token>` command.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** Binding-era command guidance is duplicated across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, `src/skills/partials/core-principle.md`, and several tests. The wording varies between “CLI-returned”, “CLI-generated”, “current CLI-generated binding”, and manual guard phrasing, which creates a cross-file contract drift risk.
**Suggestion:** Define one canonical phrase for binding continuation, preferably in the shared partial, and mirror it exactly in both skill files and tests. Explicitly state the phase boundary: manual guards are only valid before a binding exists; after that, use the exact CLI-returned `--expect-binding <token>` command.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 2. Consolidate Guarded Command Construction
**Finding key:** loop-42d2a0a468dd054a162b
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`
**Requirement:** R10
**Issue:** Binding-aware command construction is independently introduced in `finalization-outbox-recovery.js` and `get-next-action.js`, with the same pattern of using `binding.guardCommand(...)` when present and falling back to `guardFlagsForState(state)`. Separate implementations can diverge as recovery paths evolve.
**Suggestion:** Introduce a shared helper such as `guardedCommand(baseCommand, state, binding)` in the appropriate flow utility module, then use it from recovery, refresh, and next-action directive construction.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`
**Requirement:** R10
**Issue:** Binding-aware command construction is independently introduced in `finalization-outbox-recovery.js` and `get-next-action.js`, with the same pattern of using `binding.guardCommand(...)` when present and falling back to `guardFlagsForState(state)`. Separate implementations can diverge as recovery paths evolve.
**Suggestion:** Introduce a shared helper such as `guardedCommand(baseCommand, state, binding)` in the appropriate flow utility module, then use it from recovery, refresh, and next-action directive construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 3. Centralize Review Recovery Identity Construction
**Finding key:** loop-43c2c601aa2d860d2076
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity fields are assembled in multiple places across `review-convergence.js` and `set-retry.js`, including run/spec/issue context, target binding digest, and dispatch invocation id. That makes future identity changes easy to apply inconsistently.
**Suggestion:** Add one helper for shared recovery identity context, for example `reviewRecoveryIdentityContext(ctx)` or `recoveryIdentityForMutation(...)`, and use it for previous identity, next identity, current identity, and unchanged-target checks.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity fields are assembled in multiple places across `review-convergence.js` and `set-retry.js`, including run/spec/issue context, target binding digest, and dispatch invocation id. That makes future identity changes easy to apply inconsistently.
**Suggestion:** Add one helper for shared recovery identity context, for example `reviewRecoveryIdentityContext(ctx)` or `recoveryIdentityForMutation(...)`, and use it for previous identity, next identity, current identity, and unchanged-target checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 4. Resolve Dispatch Invocation Naming Semantics
**Finding key:** loop-e4b4ffbd1765c30af16e
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R6
**Issue:** `dispatchInvocationId` is used across `run-dispatch.js`, `review-convergence.js`, and `set-retry.js`, but its cross-file meaning is unclear: the name suggests a single invocation, while the value appears loop/session scoped and is stored in recovery identity records.
**Suggestion:** Decide whether the value is per dispatch loop or per agent call. Rename it consistently to something like `dispatchSessionId` if loop-scoped, or generate it per worker invocation if per-call identity is required.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R6
**Issue:** `dispatchInvocationId` is used across `run-dispatch.js`, `review-convergence.js`, and `set-retry.js`, but its cross-file meaning is unclear: the name suggests a single invocation, while the value appears loop/session scoped and is stored in recovery identity records.
**Suggestion:** Decide whether the value is per dispatch loop or per agent call. Rename it consistently to something like `dispatchSessionId` if loop-scoped, or generate it per worker invocation if per-call identity is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 5. Align Binding Assertion Helpers Across Tests
**Finding key:** loop-c0e6b0aa1c81626f11e4
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Multiple test files now assert the same binding contract in slightly different ways, including `next-action-directive.test.js`, `skill-prelude-auto.test.js`, `rewind-test-evidence.test.js`, and retry/defer tests. This duplicates the binding interface contract across tests.
**Suggestion:** Add shared or local assertion helpers where appropriate, such as `assertUsesTargetBinding(command)`, and use the same positive `--expect-binding` and negative legacy guard assertions consistently.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Multiple test files now assert the same binding contract in slightly different ways, including `next-action-directive.test.js`, `skill-prelude-auto.test.js`, `rewind-test-evidence.test.js`, and retry/defer tests. This duplicates the binding interface contract across tests.
**Suggestion:** Add shared or local assertion helpers where appropriate, such as `assertUsesTargetBinding(command)`, and use the same positive `--expect-binding` and negative legacy guard assertions consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 6. Use Consistent Test Helper Naming For Flow Binding Doubles
**Finding key:** loop-ad39c92dca6d30a31bc9
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R4
**Issue:** Test helpers related to flow target binding and flow manager state use broad names across files, such as `binding()` and `mutableFlowManager`, even though they represent specific in-memory target-binding fixtures. The naming inconsistency makes cross-file test intent harder to scan.
**Suggestion:** Rename helpers to domain-specific names such as `flowTargetBinding()`, `captureTestBinding()`, and `inMemoryFlowManager()` so binding and state test doubles are consistently recognizable.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R4
**Issue:** Test helpers related to flow target binding and flow manager state use broad names across files, such as `binding()` and `mutableFlowManager`, even though they represent specific in-memory target-binding fixtures. The naming inconsistency makes cross-file test intent harder to scan.
**Suggestion:** Rename helpers to domain-specific names such as `flowTargetBinding()`, `captureTestBinding()`, and `inMemoryFlowManager()` so binding and state test doubles are consistently recognizable.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
