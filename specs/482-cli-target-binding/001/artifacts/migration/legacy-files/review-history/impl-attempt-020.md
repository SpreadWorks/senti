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

### 5. 1. Avoid Duplicating Upgrade Evidence Serialization
**Finding key:** loop-7d6ef48e05eb3e2c9e0f
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `buildAcceptanceReviewContext` creates `upgradeEvidence`, immediately calls `toJSON()`, and stores only the plain object. This differs from nearby evidence projection patterns where projection objects often own validation and serialization behavior.  
**Suggestion:** Inline the construction where it is assigned, or keep the projection object until the final evidence assembly consistently needs JSON. For example:

```js
upgradeEvidence: new AcceptanceUpgradeEvidenceProjection(
  validateUpgradeEvidenceForGate(...)
).toJSON(),
```

This removes a temporary variable whose only purpose is single-use serialization.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `buildAcceptanceReviewContext` creates `upgradeEvidence`, immediately calls `toJSON()`, and stores only the plain object. This differs from nearby evidence projection patterns where projection objects often own validation and serialization behavior.  
**Suggestion:** Inline the construction where it is assigned, or keep the projection object until the final evidence assembly consistently needs JSON. For example:

```js
upgradeEvidence: new AcceptanceUpgradeEvidenceProjection(
  validateUpgradeEvidenceForGate(...)
).toJSON(),
```

This removes a temporary variable whose only purpose is single-use serialization.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Add an Explicit Bound When Parsing Changed Paths From Diff
**Finding key:** loop-b4050436b5966c61da71
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `changedPathsFromDiff(diff)` scans the entire diff and accumulates every matched path without an explicit upper bound. Under the `bounded-resource-usage` guardrail, bulk parsing over caller-provided diff text should have a clear maximum size or count.  
**Suggestion:** Add a bounded limit, such as a maximum diff string length and/or maximum changed path count, and fail clearly if exceeded. This keeps path extraction predictable even for unusually large diffs.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `changedPathsFromDiff(diff)` scans the entire diff and accumulates every matched path without an explicit upper bound. Under the `bounded-resource-usage` guardrail, bulk parsing over caller-provided diff text should have a clear maximum size or count.  
**Suggestion:** Add a bounded limit, such as a maximum diff string length and/or maximum changed path count, and fail clearly if exceeded. This keeps path extraction predictable even for unusually large diffs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Rename `changedPathsFromDiff` To Clarify Git-Diff Specificity
**Finding key:** loop-7bbd0bd5492fe35b29af
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `changedPathsFromDiff` sounds generic, but the implementation only handles `diff --git a/... b/...` headers. It will not parse all diff formats or file marker lines.  
**Suggestion:** Rename it to something more precise, such as `changedPathsFromGitDiffHeaders`, so callers understand the expected input shape.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `changedPathsFromDiff` sounds generic, but the implementation only handles `diff --git a/... b/...` headers. It will not parse all diff formats or file marker lines.  
**Suggestion:** Rename it to something more precise, such as `changedPathsFromGitDiffHeaders`, so callers understand the expected input shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Avoid Passing Full Context Into Binding Validation
**Finding key:** loop-7df3560004a6926ad7cc
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** The new `context: ctx` field passes the entire command context into `validateFlowBindingForOperation`. That broadens the validation API surface and makes it less clear which fields the binding check actually depends on.  
**Suggestion:** Pass only the specific values needed by the binding validator. If `context` is necessary for compatibility, consider renaming it to a narrower object such as `flowContext` and documenting which properties are consumed.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** The new `context: ctx` field passes the entire command context into `validateFlowBindingForOperation`. That broadens the validation API surface and makes it less clear which fields the binding check actually depends on.  
**Suggestion:** Pass only the specific values needed by the binding validator. If `context` is necessary for compatibility, consider renaming it to a narrower object such as `flowContext` and documenting which properties are consumed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Prefer Explicit Nullish Handling For Root Selection
**Finding key:** loop-8b4f48ddf9629505002a
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `mainRoot: ctx.mainRoot || ctx.root` treats an empty string the same as absence. Path values should usually use nullish fallback semantics so invalid-but-present values do not get silently replaced.  
**Suggestion:** Use `ctx.mainRoot ?? ctx.root` to distinguish missing values from falsy values.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `mainRoot: ctx.mainRoot || ctx.root` treats an empty string the same as absence. Path values should usually use nullish fallback semantics so invalid-but-present values do not get silently replaced.  
**Suggestion:** Use `ctx.mainRoot ?? ctx.root` to distinguish missing values from falsy values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 6. Remove Branching Duplication In Recovery Command Builders
**Finding key:** loop-435051d0dbc9c575278a
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand` and `refreshCommand` now duplicate the same binding-or-guards branching pattern.  
**Suggestion:** Extract a small helper, for example `guardedCommand(command, state, binding)`, and have both functions delegate to it. That keeps command construction consistent as more guarded commands are added.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand` and `refreshCommand` now duplicate the same binding-or-guards branching pattern.  
**Suggestion:** Extract a small helper, for example `guardedCommand(command, state, binding)`, and have both functions delegate to it. That keeps command construction consistent as more guarded commands are added.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Remove now-unused informational disposition computation
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

### 12. 2. Avoid suppressing unrelated binding-capture failures
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

### 13. 3. Consolidate guarded recovery directive construction
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

### 14. 1. Fix inverted `preserveImplRepair` filtering
**Finding key:** loop-0f83f981cbd2973ce421
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R13  
**Issue:** `plannedRepairStepChanges()` uses `!preserveImplRepair || stepId !== "impl-repair"`, which still excludes `"impl-repair"` when `preserveImplRepair` is `true`. The option name and call site imply the opposite behavior.  
**Suggestion:** Change the predicate to `preserveImplRepair || stepId !== "impl-repair"` or rename the option if exclusion is intended.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R13  
**Issue:** `plannedRepairStepChanges()` uses `!preserveImplRepair || stepId !== "impl-repair"`, which still excludes `"impl-repair"` when `preserveImplRepair` is `true`. The option name and call site imply the opposite behavior.  
**Suggestion:** Change the predicate to `preserveImplRepair || stepId !== "impl-repair"` or rename the option if exclusion is intended.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Extract shared review recovery identity construction
**Finding key:** loop-c346bf342f7d48d59411
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` builds `previousIdentity` and `nextIdentity` with nearly identical field sets, duplicating run/spec/issue/phase/task binding logic. This increases the risk that future identity fields are added to one side but not the other.  
**Suggestion:** Add a small helper such as `reviewRecoveryIdentityFor(input, prefix)` or `buildRecoveryIdentity({ input, treeSha, targetStateDigest, ... })` and use it for both identities.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` builds `previousIdentity` and `nextIdentity` with nearly identical field sets, duplicating run/spec/issue/phase/task binding logic. This increases the risk that future identity fields are added to one side but not the other.  
**Suggestion:** Add a small helper such as `reviewRecoveryIdentityFor(input, prefix)` or `buildRecoveryIdentity({ input, treeSha, targetStateDigest, ... })` and use it for both identities.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Clarify or simplify `convergenceStateForTargetDigest`
**Finding key:** loop-72d629c2b67e232d1eaf
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `convergenceStateForTargetDigest()` now always clears `blocker` and `toolingOutcome`, even when the provided digest matches the record. The function name suggests it returns state for a digest, but the behavior specifically strips blocker reuse state.  
**Suggestion:** Rename it to reflect the stripping behavior, or split it into an explicit helper like `convergenceStateWithoutStoredBlocker(record)`. If unchanged target input should allow same-binding recovery, preserve the blocker only after target-state and binding digest validation.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `convergenceStateForTargetDigest()` now always clears `blocker` and `toolingOutcome`, even when the provided digest matches the record. The function name suggests it returns state for a digest, but the behavior specifically strips blocker reuse state.  
**Suggestion:** Rename it to reflect the stripping behavior, or split it into an explicit helper like `convergenceStateWithoutStoredBlocker(record)`. If unchanged target input should allow same-binding recovery, preserve the blocker only after target-state and binding digest validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Include or remove `dispatchInvocationId` from recovery identity comparison
**Finding key:** loop-7cba201f545c561b4516
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` accepts `dispatchInvocationId`, and mutations persist it, but `changesDiffer()` does not compare it. That makes the field look identity-defining in some places but not others.  
**Suggestion:** Either include `dispatchInvocationId` in the compared field list or remove it from `ReviewRecoveryIdentity` and keep it only as persisted receipt metadata.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` accepts `dispatchInvocationId`, and mutations persist it, but `changesDiffer()` does not compare it. That makes the field look identity-defining in some places but not others.  
**Suggestion:** Either include `dispatchInvocationId` in the compared field list or remove it from `ReviewRecoveryIdentity` and keep it only as persisted receipt metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Clarify Dispatch Invocation ID Lifetime
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

### 19. 1. Avoid Mutating Review Result When Inferring Artifact Path
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

### 20. 1. Extract Review Recovery Identity Construction
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

### 21. 2. Rename Normalization Helper To Verb Form
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

### 22. 3. Account For Environment Entry Separators In Byte Limit
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

### 23. 1. Extract Binding Validation Envelope Logic
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

### 24. 2. Simplify Redundant Expectation Check
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

### 25. 3. Fix Inconsistent Formatting In Binding Branch
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

### 26. 4. Avoid JSON Stringification For Authority Equality
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

### 27. 5. Remove Unused Authority Equality Method
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

### 28. 4. Add a parser helper for last agent message semantics
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

### 29. 3. Simplify repeated mismatch-stop wording
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

### 30. 1. Extract binding-command wording into one canonical phrase
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

### 31. 2. Remove lingering manual guard examples from binding-era instructions
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

### 32. 2. Extract Review Fixture Setup
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

### 33. 1. Avoid Hard-Coded Binding Fixture Drift
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

### 34. 1. Reuse the upgrade result fixture object
**Finding key:** loop-1531d31bd42887adfb7c
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The `upgrade-result.json` payload is duplicated almost exactly in the later `assert.deepEqual`, which makes future edits noisy and easy to desynchronize.  
**Suggestion:** Store the upgrade result in a local `const upgradeResult = {...}` before `writeJson`, pass it to `writeJson`, and assert `artifact: upgradeResult`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The `upgrade-result.json` payload is duplicated almost exactly in the later `assert.deepEqual`, which makes future edits noisy and easy to desynchronize.  
**Suggestion:** Store the upgrade result in a local `const upgradeResult = {...}` before `writeJson`, pass it to `writeJson`, and assert `artifact: upgradeResult`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Name the recovery identity fixtures
**Finding key:** loop-0108991819851ea735e8
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The test constructs two `ReviewRecoveryIdentity` instances inline inside `assert.equal`, making the single meaningful difference harder to scan.  
**Suggestion:** Assign them to `previousIdentity` and `nextIdentity`, then assert `assert.equal(nextIdentity.changedFrom(previousIdentity), false)`. This makes the intent and naming consistent with the dispatch IDs.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The test constructs two `ReviewRecoveryIdentity` instances inline inside `assert.equal`, making the single meaningful difference harder to scan.  
**Suggestion:** Assign them to `previousIdentity` and `nextIdentity`, then assert `assert.equal(nextIdentity.changedFrom(previousIdentity), false)`. This makes the intent and naming consistent with the dispatch IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Update help assertion to include binding guard
**Finding key:** loop-df602dc47dda90a910b6
**Failure mode:** refactor
**File:** tests/unit/flow/rewind-test-evidence.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/rewind-test-evidence.test.js`  
**Requirement:** R1  
**Issue:** The test now expects `--expect-binding`, but the asserted help text still says only `runId, spec, and Issue identity guards are required`. That leaves the new binding guard out of the documented behavior being tested.  
**Suggestion:** Update the assertion to match help text that includes binding identity, or add a separate assertion checking that `--expect-binding` is described in the help output.
**Suggestion:** **File:** `tests/unit/flow/rewind-test-evidence.test.js`  
**Requirement:** R1  
**Issue:** The test now expects `--expect-binding`, but the asserted help text still says only `runId, spec, and Issue identity guards are required`. That leaves the new binding guard out of the documented behavior being tested.  
**Suggestion:** Update the assertion to match help text that includes binding identity, or add a separate assertion checking that `--expect-binding` is described in the help output.
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

### 44. 1. Binding Command Wording Drifts Across Skill Docs And Tests
**Finding key:** loop-df7459cbf9eac28bc064
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** Multiple summaries flag duplicated or inconsistent `--expect-binding <token>` wording across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, `src/skills/partials/core-principle.md`, and binding-related tests. This is a cross-file contract risk: the generated skill, agent skill, shared partial, and assertions can diverge on whether agents should use exact CLI-returned binding commands or manually assemble guard flags.  
**Suggestion:** Define one canonical binding rule in the shared partial or source skill, then regenerate/mirror dependent skill artifacts and update tests to assert that exact canonical phrasing.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** Multiple summaries flag duplicated or inconsistent `--expect-binding <token>` wording across `.agents/skills/senti.flow/SKILL.md`, `src/skills/senti.flow/SKILL.md`, `src/skills/partials/core-principle.md`, and binding-related tests. This is a cross-file contract risk: the generated skill, agent skill, shared partial, and assertions can diverge on whether agents should use exact CLI-returned binding commands or manually assemble guard flags.  
**Suggestion:** Define one canonical binding rule in the shared partial or source skill, then regenerate/mirror dependent skill artifacts and update tests to assert that exact canonical phrasing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Review Recovery Identity Construction Is Duplicated Across Runtime Paths
**Finding key:** loop-82c962fc4bd67d550ebc
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` construction is reported as duplicated in both `src/flow/lib/review-convergence.js` and `src/flow/lib/set-retry.js`, with similar run/spec/issue/target binding/dispatch fields. Because recovery correctness depends on identical identity semantics, future field additions could be applied to one path but missed in another.  
**Suggestion:** Extract a shared helper for recovery identity context construction and use it from both convergence mutation code and retry code.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` construction is reported as duplicated in both `src/flow/lib/review-convergence.js` and `src/flow/lib/set-retry.js`, with similar run/spec/issue/target binding/dispatch fields. Because recovery correctness depends on identical identity semantics, future field additions could be applied to one path but missed in another.  
**Suggestion:** Extract a shared helper for recovery identity context construction and use it from both convergence mutation code and retry code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Guarded Command Construction Is Repeated In Recovery Modules
**Finding key:** loop-c7d40618575a4509eef9
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** Multiple files now construct target-guarded recovery commands using similar binding-or-guard branching: `finalization-outbox-recovery.js` duplicates it between `recoveryCommand` and `refreshCommand`, while `get-next-action.js` repeats guarded directive construction. This creates a cross-file risk that recovery commands format binding guards differently.  
**Suggestion:** Introduce one shared helper for building guarded commands or guarded `ExecuteCommandDirective`s, and reuse it in finalization recovery and next-action recovery directive builders.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** Multiple files now construct target-guarded recovery commands using similar binding-or-guard branching: `finalization-outbox-recovery.js` duplicates it between `recoveryCommand` and `refreshCommand`, while `get-next-action.js` repeats guarded directive construction. This creates a cross-file risk that recovery commands format binding guards differently.  
**Suggestion:** Introduce one shared helper for building guarded commands or guarded `ExecuteCommandDirective`s, and reuse it in finalization recovery and next-action recovery directive builders.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Binding Validation API Shape Is Inconsistent Across Callers
**Finding key:** loop-78b40baf24d2a2f762c5
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `base-command.js` passes a broad `context: ctx` into binding validation, while `src/lib/flow-target-guard.js` separately supports both `context` and explicit `flowState/mainRoot/authorityRoot` validation paths. The split interface makes it unclear which fields binding validation actually requires and encourages duplicated validation branches.  
**Suggestion:** Normalize the binding validation API around a narrow input object with explicit fields, then adapt callers to pass that shape instead of whole command context objects.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `base-command.js` passes a broad `context: ctx` into binding validation, while `src/lib/flow-target-guard.js` separately supports both `context` and explicit `flowState/mainRoot/authorityRoot` validation paths. The split interface makes it unclear which fields binding validation actually requires and encourages duplicated validation branches.  
**Suggestion:** Normalize the binding validation API around a narrow input object with explicit fields, then adapt callers to pass that shape instead of whole command context objects.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Authority Comparison Has Competing Implementations
**Finding key:** loop-dc92c24492b6e271f3fc
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** The summaries identify both `FlowExecutionAuthority.equals()` using JSON stringification and existing explicit comparison logic in `bindingMismatch()`. Having two authority equality mechanisms in the same target-guard area can cause cross-file callers to pick different semantics over time.  
**Suggestion:** Keep a single authority comparison path, preferably explicit field comparison shared by `bindingMismatch()`, and remove or rewrite `equals()` to delegate to that shared logic.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** The summaries identify both `FlowExecutionAuthority.equals()` using JSON stringification and existing explicit comparison logic in `bindingMismatch()`. Having two authority equality mechanisms in the same target-guard area can cause cross-file callers to pick different semantics over time.  
**Suggestion:** Keep a single authority comparison path, preferably explicit field comparison shared by `bindingMismatch()`, and remove or rewrite `equals()` to delegate to that shared logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 6. Dispatch Invocation Naming Conflicts With Recovery Identity Usage
**Finding key:** loop-9ae20d12ddc8d64aa0a8
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `dispatchInvocationId` is generated once for the dispatch loop but persisted and compared around review recovery identity in other files. The name suggests per-invocation scope, while its use appears loop/session scoped, creating ambiguity across dispatch, convergence, and retry recovery code.  
**Suggestion:** Rename it consistently to a loop-scoped term such as `dispatchSessionId`, or generate it per worker invocation and update recovery identity comparison semantics accordingly.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `dispatchInvocationId` is generated once for the dispatch loop but persisted and compared around review recovery identity in other files. The name suggests per-invocation scope, while its use appears loop/session scoped, creating ambiguity across dispatch, convergence, and retry recovery code.  
**Suggestion:** Rename it consistently to a loop-scoped term such as `dispatchSessionId`, or generate it per worker invocation and update recovery identity comparison semantics accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
