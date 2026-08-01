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

### 5. 3. Cache preimplementation repair artifact lookups
**Finding key:** loop-b31207a16fd3f4f7f971
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `ReviewHandoffAcceptanceDisposition.#appliedRepairRef` reads and scans the same repair artifact for each matching review handoff. With many handoffs from the same source step, this repeats file parsing and linear scans.  
**Suggestion:** Build a per-review-step cache in `buildDeferredFindingsFromEvidence` or pass a small lookup object into `ReviewHandoffAcceptanceDisposition`, keyed by `sourceStep` and summary, so each repair artifact is read and indexed once.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `ReviewHandoffAcceptanceDisposition.#appliedRepairRef` reads and scans the same repair artifact for each matching review handoff. With many handoffs from the same source step, this repeats file parsing and linear scans.  
**Suggestion:** Build a per-review-step cache in `buildDeferredFindingsFromEvidence` or pass a small lookup object into `ReviewHandoffAcceptanceDisposition`, keyed by `sourceStep` and summary, so each repair artifact is read and indexed once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Prevent caller input from overriding boundary metadata
**Finding key:** loop-84a47cd2b7c9d3ac55b8
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `flowCommandBoundary: true` is set before `...input`, so an input property named `flowCommandBoundary` can overwrite the internal boundary marker.  
**Suggestion:** Move `flowCommandBoundary: true` after `...input`, or keep internal boundary metadata outside the merged user input object.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `flowCommandBoundary: true` is set before `...input`, so an input property named `flowCommandBoundary` can overwrite the internal boundary marker.  
**Suggestion:** Move `flowCommandBoundary: true` after `...input`, or keep internal boundary metadata outside the merged user input object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Extract shared guarded-command formatting
**Finding key:** loop-6a32f650dff5aa998ea7
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand` and `refreshCommand` now duplicate the same binding-vs-guard fallback pattern.  
**Suggestion:** Add a small helper such as `guardedCommand(command, state, binding)` and have both functions delegate to it. This keeps finalize cleanup command construction consistent as more recovery commands are added.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand` and `refreshCommand` now duplicate the same binding-vs-guard fallback pattern.  
**Suggestion:** Add a small helper such as `guardedCommand(command, state, binding)` and have both functions delegate to it. This keeps finalize cleanup command construction consistent as more recovery commands are added.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Remove now-unused informational disposition computation
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

### 9. 2. Avoid suppressing unrelated binding-capture failures
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

### 10. 3. Consolidate guarded recovery directive construction
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

### 11. 1. Fix Inverted `preserveImplRepair` Filtering
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

### 12. 2. Extract Recovery Identity Construction
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

### 13. 3. Either Compare Or Remove `dispatchInvocationId`
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

### 14. 4. Clarify Target-Digest State Resolution
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

### 15. 1. Clarify Dispatch Invocation ID Lifetime
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

### 16. 1. Avoid mutating the review execution result
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

### 17. 2. Extract canonical artifact path construction
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

### 18. 1. Extract Review Recovery Identity Construction
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

### 19. 2. Rename Normalization Helper To Verb Form
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

### 20. 3. Account For Environment Entry Separators In Byte Limit
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

### 21. 1. Extract Binding Validation Envelope Logic
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

### 22. 2. Simplify Redundant Expectation Check
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

### 23. 3. Fix Inconsistent Formatting In Binding Branch
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

### 24. 4. Avoid JSON Stringification For Authority Equality
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

### 25. 5. Remove Unused Authority Equality Method
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

### 26. 4. Add a parser helper for last agent message semantics
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

### 27. 3. Simplify repeated mismatch-stop wording
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

### 28. 1. Extract binding-command wording into one canonical phrase
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

### 29. 2. Remove lingering manual guard examples from binding-era instructions
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

### 30. 3. Reduce Inline Fixture Boilerplate
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

### 31. 1. Extract Binding Assertion Helper
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

### 32. 2. Rename Generic Binding Helper
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

### 33. 1. Extract Shared Review Handoff Fixture Setup
**Finding key:** loop-7c0e1960578449591239
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The two new handoff tests duplicate a long setup pattern: finding object, `ReviewEvidence`, canonical evidence ref, file write, state creation, transition application, and acceptance context creation. This makes future changes to review evidence shape more error-prone.  
**Suggestion:** Add a small local helper such as `prepareReviewHandoffContext({ fixture, phase, disposition, finding, request, repairArtifact })` and use it in both tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The two new handoff tests duplicate a long setup pattern: finding object, `ReviewEvidence`, canonical evidence ref, file write, state creation, transition application, and acceptance context creation. This makes future changes to review evidence shape more error-prone.  
**Suggestion:** Add a small local helper such as `prepareReviewHandoffContext({ fixture, phase, disposition, finding, request, repairArtifact })` and use it in both tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Avoid Repeating Upgrade Artifact Literal
**Finding key:** loop-566b370d4e6900485169
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The upgrade evidence test writes an `upgrade-result.json` object and then repeats the same object verbatim inside `assert.deepEqual`. This duplicates the expected contract and increases maintenance cost if the artifact schema changes.  
**Suggestion:** Store the artifact in a named constant, write that constant with `writeJson`, and assert `artifact: upgradeArtifact`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The upgrade evidence test writes an `upgrade-result.json` object and then repeats the same object verbatim inside `assert.deepEqual`. This duplicates the expected contract and increases maintenance cost if the artifact schema changes.  
**Suggestion:** Store the artifact in a named constant, write that constant with `writeJson`, and assert `artifact: upgradeArtifact`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 3. Rename Informational Finding To Match Domain Term
**Finding key:** loop-1be13027842eafff2265
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The variable `informationalFinding` is passed as an `advisoryFindings` entry and the test title refers to “legacy advisory review handoffs.” The mixed terminology makes the test intent slightly harder to scan.  
**Suggestion:** Rename `informationalFinding` to `advisoryFinding` or adjust the test title/fixture consistently around “informational” if that is the canonical domain term.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The variable `informationalFinding` is passed as an `advisoryFindings` entry and the test title refers to “legacy advisory review handoffs.” The mixed terminology makes the test intent slightly harder to scan.  
**Suggestion:** Rename `informationalFinding` to `advisoryFinding` or adjust the test title/fixture consistently around “informational” if that is the canonical domain term.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 4. Simplify Review Recovery Identity Assertion
**Finding key:** loop-8fd2d6c3573676af8cc9
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The new test constructs two `ReviewRecoveryIdentity` instances inline inside one assertion, which obscures the actual behavior under test.  
**Suggestion:** Assign them to named locals like `currentIdentity` and `previousIdentity`, then assert `currentIdentity.changedFrom(previousIdentity) === false`. This matches the style of behavior-focused tests and makes failures easier to inspect.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The new test constructs two `ReviewRecoveryIdentity` instances inline inside one assertion, which obscures the actual behavior under test.  
**Suggestion:** Assign them to named locals like `currentIdentity` and `previousIdentity`, then assert `currentIdentity.changedFrom(previousIdentity) === false`. This matches the style of behavior-focused tests and makes failures easier to inspect.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Consolidate repository fixture setup
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

### 38. 1. Extract Repeated Binding Command Assertions
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

### 39. 2. Rename Test Helper To Emphasize In-Memory State
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

### 40. 3. Extract Active Step Counting Helper
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

### 41. 1. Extract Shared Agent Setup for Environment Limit Tests
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

### 42. 2. Name the Execution Environment Limits
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

### 43. 3. Reduce Provider Event Fixture Noise
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

### 44. 1. Centralize Target-Binding Command Wording
**Finding key:** loop-d9086b90d518fdab5411
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** Multiple files propose the same drift-prone fix for `--expect-binding <token>` wording across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, `src/skills/partials/core-principle.md`, and related generated tests. The cross-file problem is that binding-era guidance appears to exist in at least two skill sources plus a partial, with similar but not identical phrasing.
**Suggestion:** Define one canonical binding-command phrase in the source partial or canonical skill source, generate or mirror it into the derived skill artifact, and update tests to assert that canonical wording rather than repeated bespoke strings.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** Multiple files propose the same drift-prone fix for `--expect-binding <token>` wording across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, `src/skills/partials/core-principle.md`, and related generated tests. The cross-file problem is that binding-era guidance appears to exist in at least two skill sources plus a partial, with similar but not identical phrasing.
**Suggestion:** Define one canonical binding-command phrase in the source partial or canonical skill source, generate or mirror it into the derived skill artifact, and update tests to assert that canonical wording rather than repeated bespoke strings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Unify Guarded Command Construction
**Finding key:** loop-4947c4a9febdb2f5e1ab
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-next-action.js`
**Requirement:** R6
**Issue:** Guarded command construction is duplicated across recovery/finalization paths: `finalization-outbox-recovery.js` has repeated binding-vs-guard fallback logic, while `get-next-action.js` repeats guarded `ExecuteCommandDirective` creation. These files are implementing the same target-sensitive command contract independently.
**Suggestion:** Introduce a shared helper for guarded target-sensitive commands, then use it from recovery command builders and next-action directive builders so binding fallback behavior cannot diverge.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`
**Requirement:** R6
**Issue:** Guarded command construction is duplicated across recovery/finalization paths: `finalization-outbox-recovery.js` has repeated binding-vs-guard fallback logic, while `get-next-action.js` repeats guarded `ExecuteCommandDirective` creation. These files are implementing the same target-sensitive command contract independently.
**Suggestion:** Introduce a shared helper for guarded target-sensitive commands, then use it from recovery command builders and next-action directive builders so binding fallback behavior cannot diverge.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Share Review Recovery Identity Context
**Finding key:** loop-076aa97e739cb3b2c8db
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity construction is duplicated within `review-convergence.js` and again in `set-retry.js`, using the same contextual fields such as `runId`, issue/spec data, target binding digest, and dispatch invocation id. This creates a cross-file risk that convergence and retry recovery compare different identity shapes.
**Suggestion:** Add a single identity-context helper or factory used by both `ReviewRecoveryMutation` construction and retry recovery code. Keep comparison semantics in one place, including whether `dispatchInvocationId` participates in identity changes.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity construction is duplicated within `review-convergence.js` and again in `set-retry.js`, using the same contextual fields such as `runId`, issue/spec data, target binding digest, and dispatch invocation id. This creates a cross-file risk that convergence and retry recovery compare different identity shapes.
**Suggestion:** Add a single identity-context helper or factory used by both `ReviewRecoveryMutation` construction and retry recovery code. Keep comparison semantics in one place, including whether `dispatchInvocationId` participates in identity changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Resolve Dispatch Invocation Naming Across Runtime And Recovery
**Finding key:** loop-e443f7ce1e3fa6052abb
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R6
**Issue:** `dispatchInvocationId` is generated once per dispatch loop in `run-dispatch.js`, while recovery identity code stores or compares similarly named data in `review-convergence.js` and `set-retry.js`. The name suggests a per-invocation value, but its cross-file usage appears session-wide.
**Suggestion:** Either rename the field consistently to something loop-scoped like `dispatchSessionId`, or generate a distinct id per worker invocation and update recovery identity semantics accordingly.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R6
**Issue:** `dispatchInvocationId` is generated once per dispatch loop in `run-dispatch.js`, while recovery identity code stores or compares similarly named data in `review-convergence.js` and `set-retry.js`. The name suggests a per-invocation value, but its cross-file usage appears session-wide.
**Suggestion:** Either rename the field consistently to something loop-scoped like `dispatchSessionId`, or generate a distinct id per worker invocation and update recovery identity semantics accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Consolidate Flow Authority Comparison Semantics
**Finding key:** loop-c2618b5770299302b263
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`
**Requirement:** R2
**Issue:** Authority comparison is proposed in two competing forms in the same area: `FlowExecutionAuthority.equals()` uses JSON stringification, while mismatch detection uses explicit field comparison. Other files rely on target-binding correctness, so multiple comparison paths increase cross-file semantic drift.
**Suggestion:** Keep one authority comparison mechanism, preferably explicit field comparison shared by `bindingMismatch()` and any equality caller. Remove `equals()` if it has no external caller.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`
**Requirement:** R2
**Issue:** Authority comparison is proposed in two competing forms in the same area: `FlowExecutionAuthority.equals()` uses JSON stringification, while mismatch detection uses explicit field comparison. Other files rely on target-binding correctness, so multiple comparison paths increase cross-file semantic drift.
**Suggestion:** Keep one authority comparison mechanism, preferably explicit field comparison shared by `bindingMismatch()` and any equality caller. Remove `equals()` if it has no external caller.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 6. Standardize Binding Test Helpers
**Finding key:** loop-4b44f1abe7992bd70325
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Several test files repeat `--expect-binding` assertions or setup helpers independently, including `next-action-directive.test.js`, `skill-prelude-auto.test.js`, and related flow review tests. This duplicates the binding contract in test code and makes future CLI syntax changes harder.
**Suggestion:** Add focused local or shared test helpers for binding assertions, such as `assertUsesTargetBinding(command)`, and reuse them where tests are asserting the same absence of legacy guard flags.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Several test files repeat `--expect-binding` assertions or setup helpers independently, including `next-action-directive.test.js`, `skill-prelude-auto.test.js`, and related flow review tests. This duplicates the binding contract in test code and makes future CLI syntax changes harder.
**Suggestion:** Add focused local or shared test helpers for binding assertions, such as `assertUsesTargetBinding(command)`, and reuse them where tests are asserting the same absence of legacy guard flags.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
