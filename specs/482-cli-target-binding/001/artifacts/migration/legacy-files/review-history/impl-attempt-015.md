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

### 5. 1. Consolidate guarded command formatting
**Finding key:** loop-668b05937c31894a4d40
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand()` and `refreshCommand()` now duplicate the same binding-aware command construction pattern: return `binding.guardCommand(...)` when present, otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Extract a small helper such as `commandWithGuards(command, state, binding)` and have both functions call it. This keeps finalize-cleanup boundary behavior consistent if guarded command formatting changes again.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand()` and `refreshCommand()` now duplicate the same binding-aware command construction pattern: return `binding.guardCommand(...)` when present, otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Extract a small helper such as `commandWithGuards(command, state, binding)` and have both functions call it. This keeps finalize-cleanup boundary behavior consistent if guarded command formatting changes again.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Rename the policy variable to match its narrower use
**Finding key:** loop-a41b1722881cdb452c95
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R4  
**Issue:** `expectedProposal` is still computed for both mandatory and non-mandatory findings, but after the change it is only enforced when `mandatory` is true. The name now implies a policy expectation that is no longer applied in the informational case.  
**Suggestion:** Move the `"must-fix"` value inside the mandatory branch or rename the variable to something like `mandatoryProposal`. This makes the relaxed non-mandatory behavior explicit and avoids misleading future edits.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R4  
**Issue:** `expectedProposal` is still computed for both mandatory and non-mandatory findings, but after the change it is only enforced when `mandatory` is true. The name now implies a policy expectation that is no longer applied in the informational case.  
**Suggestion:** Move the `"must-fix"` value inside the mandatory branch or rename the variable to something like `mandatoryProposal`. This makes the relaxed non-mandatory behavior explicit and avoids misleading future edits.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Consolidate Guarded Command Construction
**Finding key:** loop-cd5911a67763ab425dfc
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** `guardedCommand()` is now duplicated in both `get-next-action.js` and `next-action-directive.js`, with slightly different validation behavior. This makes target-binding command generation easier to drift.  
**Suggestion:** Keep one implementation, preferably exported from `next-action-directive.js` or moved to a small shared helper, and reuse it from `get-next-action.js`.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** `guardedCommand()` is now duplicated in both `get-next-action.js` and `next-action-directive.js`, with slightly different validation behavior. This makes target-binding command generation easier to drift.  
**Suggestion:** Keep one implementation, preferably exported from `next-action-directive.js` or moved to a small shared helper, and reuse it from `get-next-action.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Replace Long Positional Parameter List
**Finding key:** loop-3bc76c30e63f22545e74
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `buildNextActionResult()` now takes eight positional arguments, including `binding` inserted before `finalizationRecovery`. This is brittle and makes future changes easy to misorder.  
**Suggestion:** Change it to accept a single options object, e.g. `buildNextActionResult({ ctx, state, target, derived, outputSchema, instruction, binding, finalizationRecovery })`.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `buildNextActionResult()` now takes eight positional arguments, including `binding` inserted before `finalizationRecovery`. This is brittle and makes future changes easy to misorder.  
**Suggestion:** Change it to accept a single options object, e.g. `buildNextActionResult({ ctx, state, target, derived, outputSchema, instruction, binding, finalizationRecovery })`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Extract Resume Exception Predicate
**Finding key:** loop-c66f053bdaee19dd4cda
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `captureNextActionBinding()` contains an inline compound condition named `resumedFromMainAfterWorktreeRemoval`. The intent is important but buried inside error handling.  
**Suggestion:** Extract it to a small helper such as `isMainRootResumeAfterWorktreeRemoval(ctx, state)`, making the recovery exception explicit and easier to test or audit.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `captureNextActionBinding()` contains an inline compound condition named `resumedFromMainAfterWorktreeRemoval`. The intent is important but buried inside error handling.  
**Suggestion:** Extract it to a small helper such as `isMainRootResumeAfterWorktreeRemoval(ctx, state)`, making the recovery exception explicit and easier to test or audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Centralize Recovery Identity Fields
**Finding key:** loop-814eb697d73ca6cefe1e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` now defines identity fields across multiple places: constructor assignments, `changedSince()` field iteration, and mutation construction. This creates drift risk when future binding-related fields are added.  
**Suggestion:** Add a single private/static field list such as `REVIEW_RECOVERY_COMPARABLE_FIELDS` and reuse it in `changedSince()`. Consider a small helper for constructing previous/next identities from `ReviewRecoveryMutation` input to remove duplicated object literals.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` now defines identity fields across multiple places: constructor assignments, `changedSince()` field iteration, and mutation construction. This creates drift risk when future binding-related fields are added.  
**Suggestion:** Add a single private/static field list such as `REVIEW_RECOVERY_COMPARABLE_FIELDS` and reuse it in `changedSince()`. Consider a small helper for constructing previous/next identities from `ReviewRecoveryMutation` input to remove duplicated object literals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Extract Shared Previous/Next Identity Input
**Finding key:** loop-f8e926376af0b4826435
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` repeats the same binding metadata for `previousIdentity` and `nextIdentity`: `runId`, `hasIssue`, `issue`, `spec`, `phase`, `taskId`, and dispatch/binding fields. Only tree and target-state fields differ.  
**Suggestion:** Build a shared base identity object once, then spread it into previous/next identity construction. This makes the target-binding contract easier to audit and reduces copy/paste mistakes.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` repeats the same binding metadata for `previousIdentity` and `nextIdentity`: `runId`, `hasIssue`, `issue`, `spec`, `phase`, `taskId`, and dispatch/binding fields. Only tree and target-state fields differ.  
**Suggestion:** Build a shared base identity object once, then spread it into previous/next identity construction. This makes the target-binding contract easier to audit and reduces copy/paste mistakes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Name Binding Validation Inputs More Explicitly
**Finding key:** loop-5c3d9ba17dfb9b4c05d2
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `resolveReviewOperationForFlowState()` accepts `targetBindingDigest` and `resolveTargetStateDigest`, but the names do not make it clear these are expected/current validation inputs used to reject stale convergence records.  
**Suggestion:** Rename them to something like `expectedTargetBindingDigest` and `resolveExpectedTargetStateDigest`, or add a small local variable with that name before validation. This improves readability around the R13 stale-blocker prevention logic.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `resolveReviewOperationForFlowState()` accepts `targetBindingDigest` and `resolveTargetStateDigest`, but the names do not make it clear these are expected/current validation inputs used to reject stale convergence records.  
**Suggestion:** Rename them to something like `expectedTargetBindingDigest` and `resolveExpectedTargetStateDigest`, or add a small local variable with that name before validation. This improves readability around the R13 stale-blocker prevention logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Avoid Repeating Dispatch Invocation Environment Key
**Finding key:** loop-6dbb679c25687b928e6b
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** `DISPATCH_INVOCATION_ENV` is introduced as a constant, but `SENTI_FLOW_TARGET_BINDING` remains an inline string inside `executionEnvironment()`. Both are dispatcher-owned environment contract names.  
**Suggestion:** Add a sibling constant such as `TARGET_BINDING_ENV = "SENTI_FLOW_TARGET_BINDING"` and use it in `executionEnvironment()`. This keeps environment contract naming consistent and easier to search.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** `DISPATCH_INVOCATION_ENV` is introduced as a constant, but `SENTI_FLOW_TARGET_BINDING` remains an inline string inside `executionEnvironment()`. Both are dispatcher-owned environment contract names.  
**Suggestion:** Add a sibling constant such as `TARGET_BINDING_ENV = "SENTI_FLOW_TARGET_BINDING"` and use it in `executionEnvironment()`. This keeps environment contract naming consistent and easier to search.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 5. Extract Binding Capture Decision
**Finding key:** loop-c16b4d2a8fbde78c5afe
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** The binding capture logic is embedded inline in `dispatchContinuation()` with a ternary using `ctx.flowCommandBoundary`. As dispatcher resume/recovery behavior grows, this inline expression can obscure the target-binding validation path.  
**Suggestion:** Extract a small helper, for example `captureDispatchBinding(ctx, flowState)`, that returns `null` or `FlowTargetBinding.captureContext(...)`. This makes the target-sensitive directive path explicit and easier to test.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** The binding capture logic is embedded inline in `dispatchContinuation()` with a ternary using `ctx.flowCommandBoundary`. As dispatcher resume/recovery behavior grows, this inline expression can obscure the target-binding validation path.  
**Suggestion:** Extract a small helper, for example `captureDispatchBinding(ctx, flowState)`, that returns `null` or `FlowTargetBinding.captureContext(...)`. This makes the target-sensitive directive path explicit and easier to test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Avoid Mutating Review Result When Inferring Artifact Path
**Finding key:** loop-082c7de0a840ac58bbcc
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `persistCanonicalReviewArtifact()` now assigns to `result.changed` when the review result omits changed artifacts but the canonical artifact exists. This mutates the caller-owned execution result and can obscure whether the artifact was actually reported by the review command.  
**Suggestion:** Use a local `changed` variable instead of writing back to `result.changed`, then validate and persist from that normalized value. This keeps the fallback behavior while preserving the original result object for logging/debugging.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `persistCanonicalReviewArtifact()` now assigns to `result.changed` when the review result omits changed artifacts but the canonical artifact exists. This mutates the caller-owned execution result and can obscure whether the artifact was actually reported by the review command.  
**Suggestion:** Use a local `changed` variable instead of writing back to `result.changed`, then validate and persist from that normalized value. This keeps the fallback behavior while preserving the original result object for logging/debugging.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Extract ReviewRecoveryIdentity Construction
**Finding key:** loop-b20a976b36facb1eeb60
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `currentReviewRecoveryIdentity()` and `unchangedReviewConvergenceTarget()` now duplicate several identity fields: `runId`, `hasIssue`, `issue`, `spec`, `targetBindingDigest`, and `dispatchInvocationId`. That makes R13-sensitive comparison logic easier to drift later.  
**Suggestion:** Add a small helper such as `baseReviewRecoveryIdentityFields(ctx)` and reuse it in both identity constructors, with only record-specific fields supplied at the call site.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `currentReviewRecoveryIdentity()` and `unchangedReviewConvergenceTarget()` now duplicate several identity fields: `runId`, `hasIssue`, `issue`, `spec`, `targetBindingDigest`, and `dispatchInvocationId`. That makes R13-sensitive comparison logic easier to drift later.  
**Suggestion:** Add a small helper such as `baseReviewRecoveryIdentityFields(ctx)` and reuse it in both identity constructors, with only record-specific fields supplied at the call site.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Use a Shared Binding Digest Resolver
**Finding key:** loop-d00d31cfc33cba793872
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `FlowTargetBinding.deserialize(ctx.expectBinding).digest` is embedded directly in `currentReviewRecoveryIdentity()`. If another review recovery path needs the same canonical binding digest, this logic will likely be copied.  
**Suggestion:** Extract `currentTargetBindingDigest(ctx)` that returns `null` when no binding is expected and otherwise returns the deserialized digest. This also gives one place to improve error context if binding deserialization fails.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `FlowTargetBinding.deserialize(ctx.expectBinding).digest` is embedded directly in `currentReviewRecoveryIdentity()`. If another review recovery path needs the same canonical binding digest, this logic will likely be copied.  
**Suggestion:** Extract `currentTargetBindingDigest(ctx)` that returns `null` when no binding is expected and otherwise returns the deserialized digest. This also gives one place to improve error context if binding deserialization fails.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Rename Normalized Environment Helper
**Finding key:** loop-059985c8f90d38c66c68
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R1
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** `normalizedExecutionEnvironment()` sounds like a value, but it performs validation and returns a normalized copy. Existing code reads more clearly when functions use verb phrases for work.  
**Suggestion:** Rename it to `normalizeExecutionEnvironment()` or `validateExecutionEnvironment()` depending on whether the intended emphasis is transformation or validation.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** `normalizedExecutionEnvironment()` sounds like a value, but it performs validation and returns a normalized copy. Existing code reads more clearly when functions use verb phrases for work.  
**Suggestion:** Rename it to `normalizeExecutionEnvironment()` or `validateExecutionEnvironment()` depending on whether the intended emphasis is transformation or validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Bound Execution Environment Size
**Finding key:** loop-d47abaa0eb400d68a394
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R1
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** `normalizedExecutionEnvironment()` iterates over all entries in `options.executionEnvironment` without an explicit count or total-size bound. That violates the bounded-resource-usage guardrail for bulk data handling.  
**Suggestion:** Define explicit limits, for example max variable count and max total key/value length, then reject oversized input before copying it into `env`.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** `normalizedExecutionEnvironment()` iterates over all entries in `options.executionEnvironment` without an explicit count or total-size bound. That violates the bounded-resource-usage guardrail for bulk data handling.  
**Suggestion:** Define explicit limits, for example max variable count and max total key/value length, then reject oversized input before copying it into `env`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 5. Avoid duplicating binding input construction
**Finding key:** loop-b40e2e8920638ed0262f
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R6
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R6  
**Issue:** Dispatcher now manually assembles `mainRoot`, `authorityRoot`, `worktreePath`, and `context` for target validation. Similar binding-input construction also exists in `FlowTargetBinding.captureContext()` and `ResolvedFlowTarget.bindingInput()`.  
**Suggestion:** Route dispatcher validation through a single helper or context-capture API so target authority fields are derived consistently in one place.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R6  
**Issue:** Dispatcher now manually assembles `mainRoot`, `authorityRoot`, `worktreePath`, and `context` for target validation. Similar binding-input construction also exists in `FlowTargetBinding.captureContext()` and `ResolvedFlowTarget.bindingInput()`.  
**Suggestion:** Route dispatcher validation through a single helper or context-capture API so target authority fields are derived consistently in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 4. Simplify redundant conditional in `resolveActiveFlow`
**Finding key:** loop-24f1c12babf0644bab14
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R6
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R6  
**Issue:** After `if (!expectation) return ...`, the later line `const mismatch = expectation ? target.mismatchAgainst(expectation) : null;` still treats `expectation` as optional.  
**Suggestion:** Replace it with `const mismatch = target.mismatchAgainst(expectation);` to make the control flow reflect the invariant already established.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R6  
**Issue:** After `if (!expectation) return ...`, the later line `const mismatch = expectation ? target.mismatchAgainst(expectation) : null;` still treats `expectation` as optional.  
**Suggestion:** Replace it with `const mismatch = target.mismatchAgainst(expectation);` to make the control flow reflect the invariant already established.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Bound serialized binding input size
**Finding key:** loop-594345c1317b1d9b45fa
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R4
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `FlowTargetBinding.deserialize(token)` accepts any non-empty string and immediately base64-decodes and parses it. A very large `--expect-binding` value can cause unbounded memory/CPU work, violating `bounded-resource-usage`.  
**Suggestion:** Add an explicit maximum serialized token length before decoding, similar to `MAX_TARGET_TOKEN_LENGTH`, and return `ARGS_ERROR` for oversized tokens.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `FlowTargetBinding.deserialize(token)` accepts any non-empty string and immediately base64-decodes and parses it. A very large `--expect-binding` value can cause unbounded memory/CPU work, violating `bounded-resource-usage`.  
**Suggestion:** Add an explicit maximum serialized token length before decoding, similar to `MAX_TARGET_TOKEN_LENGTH`, and return `ARGS_ERROR` for oversized tokens.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Extract duplicated binding validation path
**Finding key:** loop-080bfdc6fd1e5d891eef
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R4
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `targetMismatchEnvelopeForInput()` now has two separate branches that both capture/validate a binding and convert errors into mismatch envelopes. The nested `else` block is also visibly mis-indented, making future changes risky.  
**Suggestion:** Extract a helper such as `bindingMismatchEnvelope({ expectation, flowState, mainRoot, authorityRoot, worktreePath, context, type, key })` so context and non-context validation share one error-shaping path.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `targetMismatchEnvelopeForInput()` now has two separate branches that both capture/validate a binding and convert errors into mismatch envelopes. The nested `else` block is also visibly mis-indented, making future changes risky.  
**Suggestion:** Extract a helper such as `bindingMismatchEnvelope({ expectation, flowState, mainRoot, authorityRoot, worktreePath, context, type, key })` so context and non-context validation share one error-shaping path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Remove unused comparison helper if not needed
**Finding key:** loop-cad8e50b2adab4c5cf53
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears unused in the changed code and performs equality by `JSON.stringify()`, which is brittle and less clear than field comparison.  
**Suggestion:** Remove `equals()` if there is no caller. If equality is needed, replace it with an explicit authority comparison helper that compares the known authority fields directly.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears unused in the changed code and performs equality by `JSON.stringify()`, which is brittle and less clear than field comparison.  
**Suggestion:** Remove `equals()` if there is no caller. If equality is needed, replace it with an explicit authority comparison helper that compares the known authority fields directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Add a parser helper for last agent message semantics
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

### 26. 3. Simplify repeated mismatch-stop wording
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

### 27. 1. Extract binding-command wording into one canonical phrase
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

### 28. 2. Remove lingering manual guard examples from binding-era instructions
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

### 29. 2. Extract Review Fixture Setup
**Finding key:** loop-692d6b8f7cfe1dd4102b
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new unauthoritative task review test hand-builds the same temp fixture shape, `spec.json`, `reviewOutput`, `runImplReview` call, artifact read, and cleanup pattern used elsewhere in this test file. This adds more setup noise around the actual behavior under test.  
**Suggestion:** Extract a small helper for the common impl-review fixture execution path, for example `runImplReviewFixture({ reviewOutput, taskSpec, touchedFiles })`, returning `{ result, artifact }` while preserving cleanup. Keep the test focused on the downgrade assertion.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new unauthoritative task review test hand-builds the same temp fixture shape, `spec.json`, `reviewOutput`, `runImplReview` call, artifact read, and cleanup pattern used elsewhere in this test file. This adds more setup noise around the actual behavior under test.  
**Suggestion:** Extract a small helper for the common impl-review fixture execution path, for example `runImplReviewFixture({ reviewOutput, taskSpec, touchedFiles })`, returning `{ result, artifact }` while preserving cleanup. Keep the test focused on the downgrade assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Avoid Hard-Coded Binding Fixture Drift
**Finding key:** loop-d1b60a88142786f07022
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new `binding()` helper repeats target details that already exist in `flowState()`, but changes `featureBranch` to `feature/353-durable-finalize-cleanup` while `flowState()` still points at issue/spec `473`. That makes the fixture internally inconsistent and easier to break when tests evolve.  
**Suggestion:** Derive the binding fixture directly from `flowState()` without overriding unrelated target fields, or rename the helper to make the intentional mismatch explicit if it is required for the assertion.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new `binding()` helper repeats target details that already exist in `flowState()`, but changes `featureBranch` to `feature/353-durable-finalize-cleanup` while `flowState()` still points at issue/spec `473`. That makes the fixture internally inconsistent and easier to break when tests evolve.  
**Suggestion:** Derive the binding fixture directly from `flowState()` without overriding unrelated target fields, or rename the helper to make the intentional mismatch explicit if it is required for the assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract Shared Recovery Identity Fixture
**Finding key:** loop-150bb79f0b37d18d3ec1
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R12
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R12  
**Issue:** The new test repeats the same `ReviewRecoveryIdentity` construction twice with only `dispatchInvocationId` changed. That makes the test slightly noisy and obscures the behavior under test: only dispatch invocation identity must be ignored.  
**Suggestion:** Create a small local helper or base object in the test, e.g. `const identity = (dispatchInvocationId) => new ReviewRecoveryIdentity({ ...baseIdentity, dispatchInvocationId });`, then assert `identity("next-dispatch").changedFrom(identity("previous-dispatch")) === false`.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R12  
**Issue:** The new test repeats the same `ReviewRecoveryIdentity` construction twice with only `dispatchInvocationId` changed. That makes the test slightly noisy and obscures the behavior under test: only dispatch invocation identity must be ignored.  
**Suggestion:** Create a small local helper or base object in the test, e.g. `const identity = (dispatchInvocationId) => new ReviewRecoveryIdentity({ ...baseIdentity, dispatchInvocationId });`, then assert `identity("next-dispatch").changedFrom(identity("previous-dispatch")) === false`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Name Captured Binding Values More Precisely
**Finding key:** loop-78ab0c9c39ebb2a12eb6
**Failure mode:** refactor
**File:** tests/unit/flow/run-dispatch.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R3  
**Issue:** `bindingValues` is vague; the test is specifically checking the serialized `SENTI_FLOW_TARGET_BINDING` environment value remains stable across worker calls in one dispatcher invocation.  
**Suggestion:** Rename `bindingValues` to `targetBindingEnvValues` or `serializedTargetBindings` so the assertion intent is clear and aligned with the requirement language.
**Suggestion:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R3  
**Issue:** `bindingValues` is vague; the test is specifically checking the serialized `SENTI_FLOW_TARGET_BINDING` environment value remains stable across worker calls in one dispatcher invocation.  
**Suggestion:** Rename `bindingValues` to `targetBindingEnvValues` or `serializedTargetBindings` so the assertion intent is clear and aligned with the requirement language.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Avoid Hidden Coupling Between Invocation Count And Revision Mutation
**Finding key:** loop-bb36896da879380dc18e
**Failure mode:** refactor
**File:** tests/unit/flow/run-dispatch.test.js
**Requirement:** R12
**Issue:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R12  
**Issue:** The fake agent mutates `state.repositoryRevision` using `invocationIds.length`, which couples revision changes to the incidental implementation detail of when the array push occurs. This makes the test harder to reason about if more captured values are added later.  
**Suggestion:** Track a dedicated `workerCallCount` counter and use it for both revision mutation and assertions where needed. This keeps the test state progression explicit and independent from the collection used for assertion evidence.
**Suggestion:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R12  
**Issue:** The fake agent mutates `state.repositoryRevision` using `invocationIds.length`, which couples revision changes to the incidental implementation detail of when the array push occurs. This makes the test harder to reason about if more captured values are added later.  
**Suggestion:** Track a dedicated `workerCallCount` counter and use it for both revision mutation and assertions where needed. This keeps the test state progression explicit and independent from the collection used for assertion evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Extract shared repository fixture setup
**Finding key:** loop-975c895d4dfb3c74bac3
**Failure mode:** refactor
**File:** tests/unit/flow/set-retry.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` duplicates most of `initializeRepository`: git init, user config, tracked file creation, add, and commit. This makes fixture setup drift more likely as tests evolve.  
**Suggestion:** Extract the common git repository initialization into a shared helper, then have `initializeRepositoryWithUntrackedSpec` call it and add only the untracked `spec.json` setup.
**Suggestion:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` duplicates most of `initializeRepository`: git init, user config, tracked file creation, add, and commit. This makes fixture setup drift more likely as tests evolve.  
**Suggestion:** Extract the common git repository initialization into a shared helper, then have `initializeRepositoryWithUntrackedSpec` call it and add only the untracked `spec.json` setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Name the legacy fixture around the behavior under test
**Finding key:** loop-deba18a910efcd256123
**Failure mode:** refactor
**File:** tests/unit/flow/set-retry.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` describes the file state, but the test is specifically modeling a legacy exhausted review record with no target-state entries. The current name makes the fixture’s purpose less obvious.  
**Suggestion:** Rename it to something like `initializeLegacyRetryRepository` or `initializeRepositoryForLegacyRetryRecord`, keeping the untracked spec setup inside that helper.
**Suggestion:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` describes the file state, but the test is specifically modeling a legacy exhausted review record with no target-state entries. The current name makes the fixture’s purpose less obvious.  
**Suggestion:** Rename it to something like `initializeLegacyRetryRepository` or `initializeRepositoryForLegacyRetryRecord`, keeping the untracked spec setup inside that helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Extract Repeated Agent Message Event Construction
**Finding key:** loop-c163d2a49453036bca67
**Failure mode:** refactor
**File:** tests/unit/lib/provider.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The new test repeats nested `item.completed` / `agent_message` event structure twice, with only the JSON payload changing. This makes the test noisier than the behavior it is trying to assert.  
**Suggestion:** Add a small local helper inside the test, such as `agentMessage(payload)`, returning the event object with `text: JSON.stringify(payload)`. This keeps the setup focused on “progress message then final message” rather than the stream envelope shape.
**Suggestion:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The new test repeats nested `item.completed` / `agent_message` event structure twice, with only the JSON payload changing. This makes the test noisier than the behavior it is trying to assert.  
**Suggestion:** Add a small local helper inside the test, such as `agentMessage(payload)`, returning the event object with `text: JSON.stringify(payload)`. This keeps the setup focused on “progress message then final message” rather than the stream envelope shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Duplicate Guarded Command Construction
**Finding key:** loop-cabd188bca27eb68b287
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/get-next-action.js`
**Requirement:** R3
**Issue:** Binding-aware guarded command formatting appears duplicated across `get-next-action.js`, `next-action-directive.js`, and `finalization-outbox-recovery.js`, with slightly different validation or fallback behavior. This creates a cross-file drift risk for the `--expect-binding` command contract.
**Suggestion:** Move guarded command construction into one shared helper, then reuse it from next-action generation and finalization recovery command builders.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`
**Requirement:** R3
**Issue:** Binding-aware guarded command formatting appears duplicated across `get-next-action.js`, `next-action-directive.js`, and `finalization-outbox-recovery.js`, with slightly different validation or fallback behavior. This creates a cross-file drift risk for the `--expect-binding` command contract.
**Suggestion:** Move guarded command construction into one shared helper, then reuse it from next-action generation and finalization recovery command builders.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Binding Command Wording Drifts Across Skill Artifacts
**Finding key:** loop-1c54970b652df3b6642e
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** The `--expect-binding <token>` contract is described in multiple places across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, and `src/skills/partials/core-principle.md` with slightly different wording. Some sections also still mention manually assembling run/spec/issue guards, which conflicts with binding-era guidance.
**Suggestion:** Define one canonical binding-command phrase in the shared partial, then have generated skill artifacts use that exact wording. Clarify that manual guards are only valid before a CLI binding command exists.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** The `--expect-binding <token>` contract is described in multiple places across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, and `src/skills/partials/core-principle.md` with slightly different wording. Some sections also still mention manually assembling run/spec/issue guards, which conflicts with binding-era guidance.
**Suggestion:** Define one canonical binding-command phrase in the shared partial, then have generated skill artifacts use that exact wording. Clarify that manual guards are only valid before a CLI binding command exists.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Review Recovery Identity Fields Are Repeated Across Modules
**Finding key:** loop-1c9362286d18ed8483a4
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity fields are duplicated in `review-convergence.js` and `set-retry.js`, including run, issue/spec, binding digest, dispatch invocation, and target-state fields. This makes stale recovery detection easy to change inconsistently across retry and convergence paths.
**Suggestion:** Introduce a shared identity-field builder or comparable-field list used by both modules, with only record-specific fields supplied at call sites.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity fields are duplicated in `review-convergence.js` and `set-retry.js`, including run, issue/spec, binding digest, dispatch invocation, and target-state fields. This makes stale recovery detection easy to change inconsistently across retry and convergence paths.
**Suggestion:** Introduce a shared identity-field builder or comparable-field list used by both modules, with only record-specific fields supplied at call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Binding Input Construction Has Multiple Sources Of Truth
**Finding key:** loop-66b66fb994d68b53d14d
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R6
**Issue:** **File:** `src/lib/dispatcher.js`
**Requirement:** R6
**Issue:** Target binding input is assembled manually in dispatcher validation while similar authority/context construction also exists in `FlowTargetBinding.captureContext()` and `ResolvedFlowTarget.bindingInput()`. This risks inconsistent authority fields between dispatch, validation, and directive generation.
**Suggestion:** Route dispatcher validation through a single binding input or context capture helper so `mainRoot`, `authorityRoot`, `worktreePath`, and context are derived consistently.
**Suggestion:** **File:** `src/lib/dispatcher.js`
**Requirement:** R6
**Issue:** Target binding input is assembled manually in dispatcher validation while similar authority/context construction also exists in `FlowTargetBinding.captureContext()` and `ResolvedFlowTarget.bindingInput()`. This risks inconsistent authority fields between dispatch, validation, and directive generation.
**Suggestion:** Route dispatcher validation through a single binding input or context capture helper so `mainRoot`, `authorityRoot`, `worktreePath`, and context are derived consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 5. Environment Contract Names Are Not Centralized
**Finding key:** loop-81dac8f1a1ae633f50a1
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R7
**Issue:** Dispatcher-owned environment names are handled inconsistently: `DISPATCH_INVOCATION_ENV` is centralized, but `SENTI_FLOW_TARGET_BINDING` remains inline. Related tests also use vague naming like `bindingValues`, weakening the same contract vocabulary.
**Suggestion:** Add a `TARGET_BINDING_ENV` constant and use it in production code and tests. Rename test variables to reflect serialized target binding environment values.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R7
**Issue:** Dispatcher-owned environment names are handled inconsistently: `DISPATCH_INVOCATION_ENV` is centralized, but `SENTI_FLOW_TARGET_BINDING` remains inline. Related tests also use vague naming like `bindingValues`, weakening the same contract vocabulary.
**Suggestion:** Add a `TARGET_BINDING_ENV` constant and use it in production code and tests. Rename test variables to reflect serialized target binding environment values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 6. Binding Digest Resolution Is Likely To Be Copied
**Finding key:** loop-8e547b4227ac301c1f9a
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/set-retry.js`
**Requirement:** R13
**Issue:** `FlowTargetBinding.deserialize(ctx.expectBinding).digest` is embedded directly in retry recovery identity construction, while convergence logic also depends on expected/current binding digest semantics. The digest resolution contract is cross-cutting but not named centrally.
**Suggestion:** Extract a shared `currentTargetBindingDigest(ctx)` or equivalent helper and reuse it wherever review recovery or convergence compares binding identity.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`
**Requirement:** R13
**Issue:** `FlowTargetBinding.deserialize(ctx.expectBinding).digest` is embedded directly in retry recovery identity construction, while convergence logic also depends on expected/current binding digest semantics. The digest resolution contract is cross-cutting but not named centrally.
**Suggestion:** Extract a shared `currentTargetBindingDigest(ctx)` or equivalent helper and reuse it wherever review recovery or convergence compares binding identity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 7. Test Fixture Target Data Is Internally Inconsistent
**Finding key:** loop-23ee138b27d700e558d7
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** The binding fixture repeats target details from `flowState()` but overrides unrelated fields, creating a cross-file-style inconsistency between fixture helpers and the state they are meant to represent.
**Suggestion:** Derive binding fixtures directly from `flowState()` unless mismatch is the behavior under test. If mismatch is intentional, encode that intent in the helper name.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** The binding fixture repeats target details from `flowState()` but overrides unrelated fields, creating a cross-file-style inconsistency between fixture helpers and the state they are meant to represent.
**Suggestion:** Derive binding fixtures directly from `flowState()` unless mismatch is the behavior under test. If mismatch is intentional, encode that intent in the helper name.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
