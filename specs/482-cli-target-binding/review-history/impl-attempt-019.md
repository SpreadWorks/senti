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

### 7. 2. Extract Binding Resolution From Target Selection
**Finding key:** loop-4ff2953f7e4612a7a03a
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `resolveTargetSelection` now performs both binding parsing and target selection fallback logic, which makes the function do two distinct jobs.  
**Suggestion:** Extract the `expectBinding` conversion into a helper like `bindingFromTargetExpectation(input)` and keep `resolveTargetSelection` focused on choosing `runId`, `spec`, and issue filters.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `resolveTargetSelection` now performs both binding parsing and target selection fallback logic, which makes the function do two distinct jobs.  
**Suggestion:** Extract the `expectBinding` conversion into a helper like `bindingFromTargetExpectation(input)` and keep `resolveTargetSelection` focused on choosing `runId`, `spec`, and issue filters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Centralize Guarded Recovery Directive Construction
**Finding key:** loop-b8a6192d4af8f1bdad31
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** `buildPreimplementationBootstrapDirective` and `buildCanonicalReviewPassRecoveryDirective` now repeat the same `ExecuteCommandDirective` pattern with `guardedCommand(..., state, binding)`.  
**Suggestion:** Add a small local helper such as `buildGuardedRecoveryDirective({ actionId, command, state, binding, instruction, reason })` to remove duplication and make future target-bound recovery commands harder to implement inconsistently.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** `buildPreimplementationBootstrapDirective` and `buildCanonicalReviewPassRecoveryDirective` now repeat the same `ExecuteCommandDirective` pattern with `guardedCommand(..., state, binding)`.  
**Suggestion:** Add a small local helper such as `buildGuardedRecoveryDirective({ actionId, command, state, binding, instruction, reason })` to remove duplication and make future target-bound recovery commands harder to implement inconsistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Clarify Binding Capture Error Suppression
**Finding key:** loop-5768936c56e87a1e1653
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `captureNextActionBinding` embeds a narrow exception case named `resumedFromMainAfterWorktreeRemoval` directly inside the catch block. The condition is meaningful but dense, and future callers may miss why capture errors are sometimes suppressed.  
**Suggestion:** Extract the condition into a named helper such as `canSkipBindingAfterRemovedWorktree(ctx, state)` and use it in the catch block. This preserves behavior while making the recovery exception explicit.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R6  
**Issue:** `captureNextActionBinding` embeds a narrow exception case named `resumedFromMainAfterWorktreeRemoval` directly inside the catch block. The condition is meaningful but dense, and future callers may miss why capture errors are sometimes suppressed.  
**Suggestion:** Extract the condition into a named helper such as `canSkipBindingAfterRemovedWorktree(ctx, state)` and use it in the catch block. This preserves behavior while making the recovery exception explicit.
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

### 16. 1. Extract Review Recovery Identity Construction
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

### 17. 2. Rename Normalization Helper To Verb Form
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

### 18. 3. Account For Environment Entry Separators In Byte Limit
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

### 19. 1. Extract Binding Validation Envelope Logic
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

### 20. 2. Simplify Redundant Expectation Check
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

### 21. 3. Fix Inconsistent Formatting In Binding Branch
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

### 22. 4. Avoid JSON Stringification For Authority Equality
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

### 23. 5. Remove Unused Authority Equality Method
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

### 24. 4. Add a parser helper for last agent message semantics
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

### 25. 3. Simplify repeated mismatch-stop wording
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

### 26. 1. Extract binding-command wording into one canonical phrase
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

### 27. 2. Remove lingering manual guard examples from binding-era instructions
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

### 28. 2. Extract Review Fixture Setup
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

### 29. 1. Avoid Hard-Coded Binding Fixture Drift
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

### 30. 1. Extract Shared Recovery Identity Fixture
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

### 31. 2. Name Captured Binding Values More Precisely
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

### 32. 3. Avoid Hidden Coupling Between Invocation Count And Revision Mutation
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

### 33. 1. Extract shared repository fixture setup
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

### 34. 2. Name the legacy fixture around the behavior under test
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

### 35. 1. Name the execution environment limits
**Finding key:** loop-8ab2248f7a61e496bfad
**Failure mode:** refactor
**File:** tests/unit/lib/agent.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R3  
**Issue:** The new tests hardcode `65`, `64`, and `65536`, which makes the boundary intent less obvious and can drift from the implementation constants.  
**Suggestion:** Introduce test-local constants like `MAX_EXECUTION_ENVIRONMENT_VARIABLES = 64` and `MAX_EXECUTION_ENVIRONMENT_BYTES = 64 * 1024`, then derive the failing cases from them.
**Suggestion:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R3  
**Issue:** The new tests hardcode `65`, `64`, and `65536`, which makes the boundary intent less obvious and can drift from the implementation constants.  
**Suggestion:** Introduce test-local constants like `MAX_EXECUTION_ENVIRONMENT_VARIABLES = 64` and `MAX_EXECUTION_ENVIRONMENT_BYTES = 64 * 1024`, then derive the failing cases from them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Extract provider stream event helpers
**Finding key:** loop-eb914e6629b4f016b763
**Failure mode:** refactor
**File:** tests/unit/lib/provider.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The added parse test repeats the verbose `{ type: "item.completed", item: ... }` structure, making the actual scenario harder to scan.  
**Suggestion:** Add small test-local helpers such as `agentMessage(payload)`, `commandExecution(command)`, and `turnCompleted(usage)`, then build the event list from those named helpers. This keeps the test focused on “progress message vs final agent message” behavior.
**Suggestion:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The added parse test repeats the verbose `{ type: "item.completed", item: ... }` structure, making the actual scenario harder to scan.  
**Suggestion:** Add small test-local helpers such as `agentMessage(payload)`, `commandExecution(command)`, and `turnCompleted(usage)`, then build the event list from those named helpers. This keeps the test focused on “progress message vs final agent message” behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Canonicalize Binding Command Wording
**Finding key:** loop-d870c64eaa3bd94dd3b1
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** Binding-era CLI wording is duplicated across `src/skills/senti.flow/SKILL.md`, `.agents/skills/senti.flow/SKILL.md`, and `src/skills/partials/core-principle.md` with slightly different phrases for `--expect-binding <token>` and mismatch recovery. This creates a cross-file documentation drift risk.
**Suggestion:** Define one canonical binding-command phrase and mismatch-stop sentence in the shared partial or source skill, then regenerate or mirror the agent skill artifact from that source.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** Binding-era CLI wording is duplicated across `src/skills/senti.flow/SKILL.md`, `.agents/skills/senti.flow/SKILL.md`, and `src/skills/partials/core-principle.md` with slightly different phrases for `--expect-binding <token>` and mismatch recovery. This creates a cross-file documentation drift risk.
**Suggestion:** Define one canonical binding-command phrase and mismatch-stop sentence in the shared partial or source skill, then regenerate or mirror the agent skill artifact from that source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Centralize Review Recovery Identity Construction
**Finding key:** loop-2377676aefb8d82e54f4
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` field sets are being repeated across `src/flow/lib/review-convergence.js`, `src/flow/lib/set-retry.js`, and related convergence tests. The same binding/run/spec/dispatch fields now appear in multiple construction paths, increasing the chance that future identity fields are added inconsistently.
**Suggestion:** Add a shared helper for recovery identity context construction and reuse it in production callers. Tests can use a small fixture helper based on the same field shape.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` field sets are being repeated across `src/flow/lib/review-convergence.js`, `src/flow/lib/set-retry.js`, and related convergence tests. The same binding/run/spec/dispatch fields now appear in multiple construction paths, increasing the chance that future identity fields are added inconsistently.
**Suggestion:** Add a shared helper for recovery identity context construction and reuse it in production callers. Tests can use a small fixture helper based on the same field shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Consolidate Guarded Command Construction
**Finding key:** loop-890b808459e7a1f04db3
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** Binding-aware command construction appears in multiple files, including recovery/refresh command helpers and next-action recovery directives. Each place independently decides whether to use `binding.guardCommand(...)` or append guard flags, which can diverge as target binding behavior evolves.
**Suggestion:** Introduce one command formatting helper for guarded or binding-backed flow commands and use it from recovery command builders and directive builders.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** Binding-aware command construction appears in multiple files, including recovery/refresh command helpers and next-action recovery directives. Each place independently decides whether to use `binding.guardCommand(...)` or append guard flags, which can diverge as target binding behavior evolves.
**Suggestion:** Introduce one command formatting helper for guarded or binding-backed flow commands and use it from recovery command builders and directive builders.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Align Target Binding Environment Naming
**Finding key:** loop-a9ffa968e51620628203
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** Dispatcher-owned environment contract names are handled inconsistently: `DISPATCH_INVOCATION_ENV` is centralized, while `SENTI_FLOW_TARGET_BINDING` is still inline and tests refer to serialized binding environment values with vague local names.
**Suggestion:** Add a `TARGET_BINDING_ENV` constant beside `DISPATCH_INVOCATION_ENV`, export or reuse it where appropriate, and align test variable names with that contract.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** Dispatcher-owned environment contract names are handled inconsistently: `DISPATCH_INVOCATION_ENV` is centralized, while `SENTI_FLOW_TARGET_BINDING` is still inline and tests refer to serialized binding environment values with vague local names.
**Suggestion:** Add a `TARGET_BINDING_ENV` constant beside `DISPATCH_INVOCATION_ENV`, export or reuse it where appropriate, and align test variable names with that contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 5. Unify Binding Validation Naming
**Finding key:** loop-a49fadf51ea30ede553d
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** Binding validation inputs and helpers are named differently across convergence, dispatch, flow-context, and guard code (`targetBindingDigest`, `resolveTargetStateDigest`, binding capture helpers, mismatch envelope helpers). The same expected/current target-binding concept is expressed with different names.
**Suggestion:** Standardize on explicit names such as `expectedTargetBindingDigest`, `currentTargetStateDigest`, and `captureTargetBinding`, then apply that vocabulary consistently across the binding validation path.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** Binding validation inputs and helpers are named differently across convergence, dispatch, flow-context, and guard code (`targetBindingDigest`, `resolveTargetStateDigest`, binding capture helpers, mismatch envelope helpers). The same expected/current target-binding concept is expressed with different names.
**Suggestion:** Standardize on explicit names such as `expectedTargetBindingDigest`, `currentTargetStateDigest`, and `captureTargetBinding`, then apply that vocabulary consistently across the binding validation path.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
