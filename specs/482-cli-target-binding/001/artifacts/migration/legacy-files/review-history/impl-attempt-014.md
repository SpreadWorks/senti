# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Clarify current binding ownership in dispatcher docs
**Finding key:** loop-c3b7df488f85fdcd3de8
**Failure mode:** refactor
**File:** .agents/skills/senti.flow/SKILL.md
**Requirement:** R13
**Issue:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeatedly says to use the CLI-generated/current binding token, but it does not explicitly say whether the binding may be refreshed or replaced by later CLI responses during the dispatcher loop. That leaves room for agents to keep using an older token after a command returns a newer binding.  
**Suggestion:** Add one short rule near the first binding-token instruction: after each successful Flow command, treat the latest CLI-returned binding as the current binding and use that exact opaque token for the next target-sensitive command.
**Suggestion:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeatedly says to use the CLI-generated/current binding token, but it does not explicitly say whether the binding may be refreshed or replaced by later CLI responses during the dispatcher loop. That leaves room for agents to keep using an older token after a command returns a newer binding.  
**Suggestion:** Add one short rule near the first binding-token instruction: after each successful Flow command, treat the latest CLI-returned binding as the current binding and use that exact opaque token for the next target-sensitive command.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 3. Clarify current binding ownership in dispatcher docs
**Finding key:** loop-2d301c8b1ea81452e6c4
**Failure mode:** refactor
**File:** .claude/skills/senti.flow/SKILL.md
**Requirement:** R13
**Issue:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeatedly says to use the CLI-generated/current binding token, but it does not explicitly say whether the binding may be refreshed or replaced by later CLI responses during the dispatcher loop. That leaves room for agents to keep using an older token after a command returns a newer binding.  
**Suggestion:** Add one short rule near the first binding-token instruction: after each successful Flow command, treat the latest CLI-returned binding as the current binding and use that exact opaque token for the next target-sensitive command.
**Suggestion:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The document repeatedly says to use the CLI-generated/current binding token, but it does not explicitly say whether the binding may be refreshed or replaced by later CLI responses during the dispatcher loop. That leaves room for agents to keep using an older token after a command returns a newer binding.  
**Suggestion:** Add one short rule near the first binding-token instruction: after each successful Flow command, treat the latest CLI-returned binding as the current binding and use that exact opaque token for the next target-sensitive command.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Centralize action-to-command formatting
**Finding key:** loop-bf411932058e2f61a668
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R13
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** `deriveNextAction` now knows both the `run-` lifecycle prefix convention and how to convert it into a CLI command via `node.action.slice("run-".length)`. The constructor also validates the same prefix convention, so the lifecycle-owned action rule is split across two places.  
**Suggestion:** Add a small `FlowNode` method such as `resolveExecutionCommand()` that returns `null` or `senti flow run <subcommand>`. Keep the prefix validation and command derivation inside `FlowNode`, then call that method from `deriveNextAction`.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** `deriveNextAction` now knows both the `run-` lifecycle prefix convention and how to convert it into a CLI command via `node.action.slice("run-".length)`. The constructor also validates the same prefix convention, so the lifecycle-owned action rule is split across two places.  
**Suggestion:** Add a small `FlowNode` method such as `resolveExecutionCommand()` that returns `null` or `senti flow run <subcommand>`. Keep the prefix validation and command derivation inside `FlowNode`, then call that method from `deriveNextAction`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Name the lifecycle action prefix
**Finding key:** loop-d7de95758dcc90906b14
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R13
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** The literal `"run-"` appears in both validation and slicing. This is easy to mistype and makes the invariant less explicit.  
**Suggestion:** Introduce a module-level constant such as `DEFINITION_LIFECYCLE_ACTION_PREFIX = "run-"` and use it for both `startsWith()` and `slice()`.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** The literal `"run-"` appears in both validation and slicing. This is easy to mistype and makes the invariant less explicit.  
**Suggestion:** Introduce a module-level constant such as `DEFINITION_LIFECYCLE_ACTION_PREFIX = "run-"` and use it for both `startsWith()` and `slice()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Centralize Binding Context Construction
**Finding key:** loop-35a08101b6f351f58119
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** The new `mainRoot`, `authorityRoot`, and `worktreePath` values are derived inline inside the binding validation call. This makes the authority tuple construction less discoverable and easier to duplicate incorrectly in other command paths.  
**Suggestion:** Extract a small helper such as `bindingContextForCommand(ctx, input)` or a method on `FlowCommand` that builds the full `validateActiveFlowBinding` payload. This keeps target-sensitive authority derivation in one place.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** The new `mainRoot`, `authorityRoot`, and `worktreePath` values are derived inline inside the binding validation call. This makes the authority tuple construction less discoverable and easier to duplicate incorrectly in other command paths.  
**Suggestion:** Extract a small helper such as `bindingContextForCommand(ctx, input)` or a method on `FlowCommand` that builds the full `validateActiveFlowBinding` payload. This keeps target-sensitive authority derivation in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Simplify Guarded Command Formatting
**Finding key:** loop-743931ff6081bb96f790
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand()` and `refreshCommand()` now both contain the same conditional pattern: use `binding.guardCommand(...)` when binding exists, otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Add a shared helper, for example `guardedCommand(command, state, binding)`, and have both functions delegate to it. This reduces duplicate guard formatting logic and makes future binding changes less error-prone.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand()` and `refreshCommand()` now both contain the same conditional pattern: use `binding.guardCommand(...)` when binding exists, otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Add a shared helper, for example `guardedCommand(command, state, binding)`, and have both functions delegate to it. This reduces duplicate guard formatting logic and makes future binding changes less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Rename Optional Binding for Intent
**Finding key:** loop-3da54cb95440a505f144
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** The constructor parameter `binding` is generic, but in this context it specifically controls guarded recovery command generation. The name does not communicate whether it is flow binding data, command binding, or validation authority.  
**Suggestion:** Rename it to something more specific such as `commandBinding` or `activeFlowBinding`, and update the helper parameter names accordingly. This would make the finalize-cleanup boundary behavior easier to audit.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** The constructor parameter `binding` is generic, but in this context it specifically controls guarded recovery command generation. The name does not communicate whether it is flow binding data, command binding, or validation authority.  
**Suggestion:** Rename it to something more specific such as `commandBinding` or `activeFlowBinding`, and update the helper parameter names accordingly. This would make the finalize-cleanup boundary behavior easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Avoid contradictory issue target selection
**Finding key:** loop-3371f90b07d6b4efc3ff
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `selectNoIssue` becomes `true` whenever the binding has no issue, even if `input.expectIssue` is explicitly provided. That can produce a target selection with both `selectIssue` and `selectNoIssue` set.  
**Suggestion:** Derive `selectNoIssue` after `selectIssue`, for example: `const selectNoIssue = input.expectNoIssue === true || (selectIssue == null && binding != null && binding.issue == null);`.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `selectNoIssue` becomes `true` whenever the binding has no issue, even if `input.expectIssue` is explicitly provided. That can produce a target selection with both `selectIssue` and `selectNoIssue` set.  
**Suggestion:** Derive `selectNoIssue` after `selectIssue`, for example: `const selectNoIssue = input.expectNoIssue === true || (selectIssue == null && binding != null && binding.issue == null);`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Centralize guarded command construction
**Finding key:** loop-2139120047a19a29fed2
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** Guarded command creation is now split between direct `binding.guardCommand(...)` calls in this file and `guardedCommand(...)` in `next-action-directive.js`. That duplicates the command-wrapping pattern and makes future guard behavior easier to update inconsistently.  
**Suggestion:** Route recovery directives through one shared helper or pass raw command text into directive construction and let the directive layer apply `FlowTargetBinding` guards consistently.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** Guarded command creation is now split between direct `binding.guardCommand(...)` calls in this file and `guardedCommand(...)` in `next-action-directive.js`. That duplicates the command-wrapping pattern and makes future guard behavior easier to update inconsistently.  
**Suggestion:** Route recovery directives through one shared helper or pass raw command text into directive construction and let the directive layer apply `FlowTargetBinding` guards consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Make binding mandatory for target-sensitive directive resolution
**Finding key:** loop-f50ec17c4c36d7e5f395
**Failure mode:** refactor
**File:** src/flow/lib/next-action-directive.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/next-action-directive.js`  
**Requirement:** R3  
**Issue:** `NextActionDirectiveResolver` accepts `binding = null`, and `guardedCommand()` silently falls back to `guardFlagsForState(state)`. For target-sensitive normal actions, this preserves the older state-derived guard path and weakens the new invariant that output commands derive from `FlowTargetBinding`.  
**Suggestion:** Require a binding for resolver paths that emit guarded next actions, remove the fallback for those paths, and keep any legacy fallback only in a clearly named helper if a genuinely non-target-sensitive caller still needs it.
**Suggestion:** **File:** `src/flow/lib/next-action-directive.js`  
**Requirement:** R3  
**Issue:** `NextActionDirectiveResolver` accepts `binding = null`, and `guardedCommand()` silently falls back to `guardFlagsForState(state)`. For target-sensitive normal actions, this preserves the older state-derived guard path and weakens the new invariant that output commands derive from `FlowTargetBinding`.  
**Suggestion:** Require a binding for resolver paths that emit guarded next actions, remove the fallback for those paths, and keep any legacy fallback only in a clearly named helper if a genuinely non-target-sensitive caller still needs it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Clarify `ExecuteStepDirective.nextAction` naming
**Finding key:** loop-d5dc7e57c05b8659e1d1
**Failure mode:** refactor
**File:** src/flow/lib/next-action-directive.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/next-action-directive.js`  
**Requirement:** R3  
**Issue:** `ExecuteStepDirective` now has both `action` and `nextAction`, but `nextAction` is specifically guarded executable command text. The generic name makes it easy to confuse with the higher-level directive/action semantics.  
**Suggestion:** Rename the internal constructor field to something more precise, such as `guardedCommand` or `executionCommand`, while preserving the serialized JSON key if that is part of the CLI output contract.
**Suggestion:** **File:** `src/flow/lib/next-action-directive.js`  
**Requirement:** R3  
**Issue:** `ExecuteStepDirective` now has both `action` and `nextAction`, but `nextAction` is specifically guarded executable command text. The generic name makes it easy to confuse with the higher-level directive/action semantics.  
**Suggestion:** Rename the internal constructor field to something more precise, such as `guardedCommand` or `executionCommand`, while preserving the serialized JSON key if that is part of the CLI output contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Extract shared recovery identity fields
**Finding key:** loop-9c40da1c880c6e5c7c41
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` duplicates the same binding fields when constructing `previousIdentity` and `nextIdentity`, with only tree/digest fields changing. This makes future identity changes easy to apply to one side but not the other.  
**Suggestion:** Build a shared identity base object, then spread it into the previous/next constructors with the differing fields.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` duplicates the same binding fields when constructing `previousIdentity` and `nextIdentity`, with only tree/digest fields changing. This makes future identity changes easy to apply to one side but not the other.  
**Suggestion:** Build a shared identity base object, then spread it into the previous/next constructors with the differing fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Include or deliberately exclude dispatch invocation in identity comparison
**Finding key:** loop-0efda01984e052cdec58
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` stores `dispatchInvocationId`, but `differsFrom()` does not compare it. That makes the field look identity-relevant in construction/persistence while being ignored for applicability checks.  
**Suggestion:** Either add `dispatchInvocationId` to the compared field list, or remove it from `ReviewRecoveryIdentity` and keep it only as receipt metadata. The current middle ground is hard to reason about.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity` stores `dispatchInvocationId`, but `differsFrom()` does not compare it. That makes the field look identity-relevant in construction/persistence while being ignored for applicability checks.  
**Suggestion:** Either add `dispatchInvocationId` to the compared field list, or remove it from `ReviewRecoveryIdentity` and keep it only as receipt metadata. The current middle ground is hard to reason about.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Clarify `convergenceStateForTargetDigest` behavior
**Finding key:** loop-b8fd1d1e635ce7e851ae
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `convergenceStateForTargetDigest()` now always clears `blocker` and `toolingOutcome`, even when the record target digest matches. The name suggests it returns convergence state for a matching digest, not a blocker-stripped state.  
**Suggestion:** Rename it to something like `convergenceStateWithoutReusableBlocker()` or split the behavior so digest matching and blocker stripping are visibly separate.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `convergenceStateForTargetDigest()` now always clears `blocker` and `toolingOutcome`, even when the record target digest matches. The name suggests it returns convergence state for a matching digest, not a blocker-stripped state.  
**Suggestion:** Rename it to something like `convergenceStateWithoutReusableBlocker()` or split the behavior so digest matching and blocker stripping are visibly separate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 5. Simplify provider failure pattern maintenance
**Finding key:** loop-9ed75b10c244289ba0c0
**Failure mode:** refactor
**File:** src/flow/lib/review-failure.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-failure.js`  
**Requirement:** R13  
**Issue:** `matchesProviderFailure()` now has a dense inline regexp with multiple provider-specific alternatives. It is correct-looking but harder to safely extend or audit.  
**Suggestion:** Extract the regexp to a named constant such as `PROVIDER_FAILURE_PATTERN`, or compose named fragments for status code, provider wording, and transient availability terms.
**Suggestion:** **File:** `src/flow/lib/review-failure.js`  
**Requirement:** R13  
**Issue:** `matchesProviderFailure()` now has a dense inline regexp with multiple provider-specific alternatives. It is correct-looking but harder to safely extend or audit.  
**Suggestion:** Extract the regexp to a named constant such as `PROVIDER_FAILURE_PATTERN`, or compose named fragments for status code, provider wording, and transient availability terms.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 4. Generate dispatch invocation IDs per dispatched work item
**Finding key:** loop-d70bfab10742207dc798
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `dispatchInvocationId` is created once before the dispatch loop, then reused for every `FlowDispatchWork` emitted during that continuation. The name implies a single invocation/work execution identity, but the value spans multiple possible agent calls.  
**Suggestion:** Move `crypto.randomUUID()` inside the loop immediately before constructing `FlowDispatchWork`, or rename the value if it is intended to identify the whole continuation session.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `dispatchInvocationId` is created once before the dispatch loop, then reused for every `FlowDispatchWork` emitted during that continuation. The name implies a single invocation/work execution identity, but the value spans multiple possible agent calls.  
**Suggestion:** Move `crypto.randomUUID()` inside the loop immediately before constructing `FlowDispatchWork`, or rename the value if it is intended to identify the whole continuation session.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Reduce Repeated Guard Envelope Wrappers
**Finding key:** loop-deecb10ac28bdc37f237
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R4  
**Issue:** The duplicate missing-guard calculation was removed, but each touched command still keeps a local wrapper that performs the same pattern: call `missingExactTargetGuardNames()`, return `null`/failure envelope depending on length, and emit the same `ACTIVE_FLOW_MISMATCH` style response.  
**Suggestion:** Consolidate the remaining wrapper behavior behind a shared exact-target guard failure helper, then have this file call that helper directly before target-sensitive side effects.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R4  
**Issue:** The duplicate missing-guard calculation was removed, but each touched command still keeps a local wrapper that performs the same pattern: call `missingExactTargetGuardNames()`, return `null`/failure envelope depending on length, and emit the same `ACTIVE_FLOW_MISMATCH` style response.  
**Suggestion:** Consolidate the remaining wrapper behavior behind a shared exact-target guard failure helper, then have this file call that helper directly before target-sensitive side effects.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Reduce Repeated Guard Envelope Wrappers
**Finding key:** loop-72bde5ed72604ed030c3
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-review-pass.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-recover-review-pass.js`  
**Requirement:** R4  
**Issue:** This file now shares the missing-guard calculation, but still duplicates the local failure-envelope construction pattern used by the other touched command paths.  
**Suggestion:** Replace the local `requireExactGuards()` implementation with the same shared exact-target guard failure helper suggested for the recovery implementation path.
**Suggestion:** **File:** `src/flow/lib/run-recover-review-pass.js`  
**Requirement:** R4  
**Issue:** This file now shares the missing-guard calculation, but still duplicates the local failure-envelope construction pattern used by the other touched command paths.  
**Suggestion:** Replace the local `requireExactGuards()` implementation with the same shared exact-target guard failure helper suggested for the recovery implementation path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Align Guard Function Naming
**Finding key:** loop-1daa222c984dbedcddb0
**Failure mode:** refactor
**File:** src/flow/lib/run-reopen-draft.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R4  
**Issue:** `validateCorrectionGuards()` now delegates to `missingExactTargetGuardNames()`, so the function is no longer specific to “correction” behavior. Its name is less precise than the equivalent `requireExactGuards()` helpers in the recovery files.  
**Suggestion:** Rename `validateCorrectionGuards()` to `requireExactGuards()` or another exact-target-oriented name to match the shared guard semantics and improve consistency across the touched flow command files.
**Suggestion:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R4  
**Issue:** `validateCorrectionGuards()` now delegates to `missingExactTargetGuardNames()`, so the function is no longer specific to “correction” behavior. Its name is less precise than the equivalent `requireExactGuards()` helpers in the recovery files.  
**Suggestion:** Rename `validateCorrectionGuards()` to `requireExactGuards()` or another exact-target-oriented name to match the shared guard semantics and improve consistency across the touched flow command files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 4. Reduce Repeated Guard Envelope Wrappers
**Finding key:** loop-7d6757c257ff3f4e57d5
**Failure mode:** refactor
**File:** src/flow/lib/run-reopen-draft.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R4  
**Issue:** This file has the same remaining guard wrapper shape as the two recovery files, with only the local function name differing.  
**Suggestion:** Use a shared exact-target guard failure helper here as well, which would remove the remaining duplication and make R4 enforcement easier to audit consistently.
**Suggestion:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R4  
**Issue:** This file has the same remaining guard wrapper shape as the two recovery files, with only the local function name differing.  
**Suggestion:** Use a shared exact-target guard failure helper here as well, which would remove the remaining duplication and make R4 enforcement easier to audit consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Keep Invocation Metadata Out Of Convergence Identity
**Finding key:** loop-c2d99cc19fbd8f74a776
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `currentReviewRecoveryIdentity()` and `unchangedReviewConvergenceTarget()` include `dispatchInvocationId` in `ReviewRecoveryIdentity`. Since `ReviewRecoveryIdentity.changedFrom()` compares that field when both sides are present, a retry run with unchanged tree SHA, unchanged target-state digest, and unchanged binding can still look “changed” solely because it has a new dispatch invocation id. That weakens the “unchanged input” check and can allow repeated retry resets for the same canonical input.  
**Suggestion:** Treat `dispatchInvocationId` as audit receipt metadata, not identity input. Keep writing `previousDispatchInvocationId` / `nextDispatchInvocationId` in `reviewRecoveryMutation()`, but do not include `dispatchInvocationId` in the identities passed to `changedFrom()` for unchanged-target detection.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `currentReviewRecoveryIdentity()` and `unchangedReviewConvergenceTarget()` include `dispatchInvocationId` in `ReviewRecoveryIdentity`. Since `ReviewRecoveryIdentity.changedFrom()` compares that field when both sides are present, a retry run with unchanged tree SHA, unchanged target-state digest, and unchanged binding can still look “changed” solely because it has a new dispatch invocation id. That weakens the “unchanged input” check and can allow repeated retry resets for the same canonical input.  
**Suggestion:** Treat `dispatchInvocationId` as audit receipt metadata, not identity input. Keep writing `previousDispatchInvocationId` / `nextDispatchInvocationId` in `reviewRecoveryMutation()`, but do not include `dispatchInvocationId` in the identities passed to `changedFrom()` for unchanged-target detection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Keep Guard Option Ordering Consistent With Usage
**Finding key:** loop-677c4673c5c92846bfac
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/registry.js`
**Requirement:** R4
**Issue:** `FLOW_TARGET_GUARD_OPTIONS` lists legacy options before `--expect-binding`, while `FLOW_TARGET_GUARD_USAGE` and help text present `--expect-binding` as the primary preferred guard. This small inconsistency makes the newer binding path less visually prominent in the option metadata.
**Suggestion:** Move `"--expect-binding"` to the front of `FLOW_TARGET_GUARD_OPTIONS` so the constant order matches usage/help order and communicates the preferred path consistently.
**Suggestion:** **File:** `src/flow/registry.js`
**Requirement:** R4
**Issue:** `FLOW_TARGET_GUARD_OPTIONS` lists legacy options before `--expect-binding`, while `FLOW_TARGET_GUARD_USAGE` and help text present `--expect-binding` as the primary preferred guard. This small inconsistency makes the newer binding path less visually prominent in the option metadata.
**Suggestion:** Move `"--expect-binding"` to the front of `FLOW_TARGET_GUARD_OPTIONS` so the constant order matches usage/help order and communicates the preferred path consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Avoid Revalidating Environment On Every Agent Run
**Finding key:** loop-c3e051848e168ed64caa
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R4
**Issue:** **File:** `src/lib/agent.js`
**Requirement:** R4
**Issue:** `normalizedExecutionEnvironment(options.executionEnvironment)` is called inside `run()`, rebuilding and revalidating the same environment object every execution. If `options.executionEnvironment` is stable per `Agent` instance, this adds repeated validation logic to a hot path and keeps normalization coupled to process spawning.
**Suggestion:** Normalize once when the `Agent` is constructed or when options are assigned, store the normalized object, and merge that cached value into `env`.
**Suggestion:** **File:** `src/lib/agent.js`
**Requirement:** R4
**Issue:** `normalizedExecutionEnvironment(options.executionEnvironment)` is called inside `run()`, rebuilding and revalidating the same environment object every execution. If `options.executionEnvironment` is stable per `Agent` instance, this adds repeated validation logic to a hot path and keeps normalization coupled to process spawning.
**Suggestion:** Normalize once when the `Agent` is constructed or when options are assigned, store the normalized object, and merge that cached value into `env`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Clarify Authority Root Naming
**Finding key:** loop-7cfdda8da2af7aef7c3f
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R4
**Issue:** **File:** `src/lib/dispatcher.js`
**Requirement:** R4
**Issue:** The new arguments pass both `mainRoot: hookCtx.mainRoot || hookCtx.root` and `authorityRoot: hookCtx.root`. The distinction is important for target binding, but the names are close enough that future callers may confuse the canonical main repo root with the active execution authority root.
**Suggestion:** Use names that encode the distinction more explicitly, for example `canonicalMainRoot` and `executionAuthorityRoot`, or add a small local object construction with comments if the callee API name cannot change.
**Suggestion:** **File:** `src/lib/dispatcher.js`
**Requirement:** R4
**Issue:** The new arguments pass both `mainRoot: hookCtx.mainRoot || hookCtx.root` and `authorityRoot: hookCtx.root`. The distinction is important for target binding, but the names are close enough that future callers may confuse the canonical main repo root with the active execution authority root.
**Suggestion:** Use names that encode the distinction more explicitly, for example `canonicalMainRoot` and `executionAuthorityRoot`, or add a small local object construction with comments if the callee API name cannot change.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Avoid Duplicate Binding Identity Checks
**Finding key:** loop-3b3108f8c38b83bedfa2
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R4
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `targetMismatchEnvelopeForInput()` validates `expectation.binding.assertCurrent(...)`, then still calls `expectation.mismatchAgainst(flowState)`, which re-checks runId/Issue/spec already covered by the binding path.  
**Suggestion:** After successful binding validation, return `null` unless non-binding guards need separate handling. Since the constructor already rejects conflicting explicit guards, the second mismatch pass is redundant.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R4  
**Issue:** `targetMismatchEnvelopeForInput()` validates `expectation.binding.assertCurrent(...)`, then still calls `expectation.mismatchAgainst(flowState)`, which re-checks runId/Issue/spec already covered by the binding path.  
**Suggestion:** After successful binding validation, return `null` unless non-binding guards need separate handling. Since the constructor already rejects conflicting explicit guards, the second mismatch pass is redundant.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Remove Unused Authority Equality Method
**Finding key:** loop-e9522a7d9fa714309729
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears unused in the introduced code and duplicates equality logic already handled by `bindingMismatch()`.  
**Suggestion:** Remove `equals()` unless there is a concrete caller. Keeping one comparison path makes mismatch reporting easier to reason about.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears unused in the introduced code and duplicates equality logic already handled by `bindingMismatch()`.  
**Suggestion:** Remove `equals()` unless there is a concrete caller. Keeping one comparison path makes mismatch reporting easier to reason about.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Clarify Provider Message Accumulation
**Finding key:** loop-8d757de6b5e64b48a35a
**Failure mode:** refactor
**File:** src/lib/provider.js
**Requirement:** R13
**Issue:** **File:** `src/lib/provider.js`  
**Requirement:** R13  
**Issue:** `parse()` changed from appending agent message text to replacing it. If multiple `agent_message` items are emitted, earlier text is silently discarded; if that is intentional, `text` no longer communicates the behavior.  
**Suggestion:** Either restore `text += ...` or rename the variable to something like `lastAgentMessageText` and add a focused test for multiple completed agent messages.
**Suggestion:** **File:** `src/lib/provider.js`  
**Requirement:** R13  
**Issue:** `parse()` changed from appending agent message text to replacing it. If multiple `agent_message` items are emitted, earlier text is silently discarded; if that is intentional, `text` no longer communicates the behavior.  
**Suggestion:** Either restore `text += ...` or rename the variable to something like `lastAgentMessageText` and add a focused test for multiple completed agent messages.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 4. Simplify Canonical Directory Validation
**Finding key:** loop-638e3ae1d8a21149b16b
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R12
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R12  
**Issue:** `canonicalDirectory()` performs `lstatSync()`, `realpathSync()`, then rejects symlinks and any path where `canonical !== resolved`. This mixes “canonicalize input” with “require caller already passed canonical input,” making call sites stricter and harder to reuse.  
**Suggestion:** Resolve with `fs.realpathSync()` first, then `statSync()` the canonical path and return it. If rejecting symlink input is required, rename the helper to reflect that stricter contract.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R12  
**Issue:** `canonicalDirectory()` performs `lstatSync()`, `realpathSync()`, then rejects symlinks and any path where `canonical !== resolved`. This mixes “canonicalize input” with “require caller already passed canonical input,” making call sites stricter and harder to reuse.  
**Suggestion:** Resolve with `fs.realpathSync()` first, then `statSync()` the canonical path and return it. If rejecting symlink input is required, rename the helper to reflect that stricter contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Clarify Fresh CLI Response Wording
**Finding key:** loop-2039117188453f04ed5d
**Failure mode:** refactor
**File:** src/skills/partials/core-principle.md
**Requirement:** R7
**Issue:** **File:** `src/skills/partials/core-principle.md`  
**Requirement:** R7  
**Issue:** “refresh target authority through the CLI” and “fresh CLI response selects the intended Flow” are conceptually important but vague compared with the surrounding command-oriented instructions. Different agents may interpret this as status, dispatch, or another command.  
**Suggestion:** Replace the phrase with a concrete allowed recovery path, for example: “run the target-aware status or dispatcher command returned by the CLI, and continue only if that response includes a binding/directive for the intended Flow.”
**Suggestion:** **File:** `src/skills/partials/core-principle.md`  
**Requirement:** R7  
**Issue:** “refresh target authority through the CLI” and “fresh CLI response selects the intended Flow” are conceptually important but vague compared with the surrounding command-oriented instructions. Different agents may interpret this as status, dispatch, or another command.  
**Suggestion:** Replace the phrase with a concrete allowed recovery path, for example: “run the target-aware status or dispatcher command returned by the CLI, and continue only if that response includes a binding/directive for the intended Flow.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Extract Repeated Binding Command Text
**Finding key:** loop-4c02875ae7b32b25352d
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The new `--expect-binding <token>` command form is repeated many times across dispatcher instructions. This makes future binding-contract changes easy to apply inconsistently.  
**Suggestion:** Define a short canonical term near the start of the dispatcher section, such as “current binding command arguments = `--expect-binding <token>` from the latest CLI response,” then reference that term consistently instead of restating the literal command text in every bullet.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`  
**Requirement:** R7  
**Issue:** The new `--expect-binding <token>` command form is repeated many times across dispatcher instructions. This makes future binding-contract changes easy to apply inconsistently.  
**Suggestion:** Define a short canonical term near the start of the dispatcher section, such as “current binding command arguments = `--expect-binding <token>` from the latest CLI response,” then reference that term consistently instead of restating the literal command text in every bullet.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Move Review Error Classification Test Near Existing Error Tests
**Finding key:** loop-d8882a5a04ae18c34ebf
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new `review command error classification` describe block is placed near generic helper functions, before the main review command test organization. If this file already groups command-error behavior elsewhere, this placement makes related behavior harder to scan and maintain.  
**Suggestion:** Relocate the new test into the existing review command error/classification test area, or create a nearby grouped section for all `classifyReviewCommandError` coverage.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new `review command error classification` describe block is placed near generic helper functions, before the main review command test organization. If this file already groups command-error behavior elsewhere, this placement makes related behavior harder to scan and maintain.  
**Suggestion:** Relocate the new test into the existing review command error/classification test area, or create a nearby grouped section for all `classifyReviewCommandError` coverage.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Extract Fixture Writing Helper
**Finding key:** loop-4311a0602a8d2b064543
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new unauthoritative task review test manually creates `specs/demo`, writes `spec.json`, builds JSON review output, runs `runImplReview`, and reads `impl-review.json`. This pattern is likely duplicated in nearby impl-review tests.  
**Suggestion:** Reuse or add a small local helper for creating a minimal impl-review fixture and reading the resulting artifact, keeping the test focused on the disposition downgrade assertion.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new unauthoritative task review test manually creates `specs/demo`, writes `spec.json`, builds JSON review output, runs `runImplReview`, and reads `impl-review.json`. This pattern is likely duplicated in nearby impl-review tests.  
**Suggestion:** Reuse or add a small local helper for creating a minimal impl-review fixture and reading the resulting artifact, keeping the test focused on the disposition downgrade assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Extract binding command assertions
**Finding key:** loop-92810f610a2247f5dd67
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The same two assertions for `--expect-binding` presence and legacy target guards absence are repeated across multiple tests. This makes future command-shape changes more error-prone.  
**Suggestion:** Add a small helper such as `assertUsesTargetBinding(nextAction)` that checks `--expect-binding` and rejects `--expect-run-id|--expect-issue|--expect-spec`, then call it from each affected test.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The same two assertions for `--expect-binding` presence and legacy target guards absence are repeated across multiple tests. This makes future command-shape changes more error-prone.  
**Suggestion:** Add a small helper such as `assertUsesTargetBinding(nextAction)` that checks `--expect-binding` and rejects `--expect-run-id|--expect-issue|--expect-spec`, then call it from each affected test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Rename the test binding helper for clarity
**Finding key:** loop-2b5ea965a96d6bcfd567
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The helper name `binding()` is very broad and does not communicate that it creates a branch-mode `FlowTargetBinding` fixture.  
**Suggestion:** Rename it to something more specific, such as `branchTargetBinding()` or `targetBindingFixture()`, so the test setup reads closer to the behavior under test.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The helper name `binding()` is very broad and does not communicate that it creates a branch-mode `FlowTargetBinding` fixture.  
**Suggestion:** Rename it to something more specific, such as `branchTargetBinding()` or `targetBindingFixture()`, so the test setup reads closer to the behavior under test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Rename binding capture for clarity
**Finding key:** loop-48fb90edd6da140dadf1
**Failure mode:** refactor
**File:** tests/unit/flow/run-dispatch.test.js
**Requirement:** R12
**Issue:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R12  
**Issue:** `bindingValues` is vague in a test that is specifically asserting stable `SENTI_FLOW_TARGET_BINDING` propagation.  
**Suggestion:** Rename it to `targetBindings` or `capturedTargetBindings` so the assertion intent is clear without rereading the worker environment assignment.
**Suggestion:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R12  
**Issue:** `bindingValues` is vague in a test that is specifically asserting stable `SENTI_FLOW_TARGET_BINDING` propagation.  
**Suggestion:** Rename it to `targetBindings` or `capturedTargetBindings` so the assertion intent is clear without rereading the worker environment assignment.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Avoid brittle accumulated indexing across dispatch runs
**Finding key:** loop-1fff2993d80bac070065
**Failure mode:** refactor
**File:** tests/unit/flow/run-dispatch.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R3  
**Issue:** The test uses one shared `invocationIds` array across two dispatch executions and asserts positions `[0]`, `[1]`, `[2]`, `[3]`. That makes the second half dependent on all earlier pushes and slightly obscures the per-dispatch invariant.  
**Suggestion:** Capture the first dispatch IDs into a local slice, reset or slice before the second dispatch, and assert each dispatch independently: first run has two equal IDs, second run has two equal IDs, and the two run IDs differ.
**Suggestion:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R3  
**Issue:** The test uses one shared `invocationIds` array across two dispatch executions and asserts positions `[0]`, `[1]`, `[2]`, `[3]`. That makes the second half dependent on all earlier pushes and slightly obscures the per-dispatch invariant.  
**Suggestion:** Capture the first dispatch IDs into a local slice, reset or slice before the second dispatch, and assert each dispatch independently: first run has two equal IDs, second run has two equal IDs, and the two run IDs differ.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Extract repeated review failure construction helpers
**Finding key:** loop-fb3f79666cca6fab5a23
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R13  
**Issue:** The new retry classification tests inline similar `ReviewFailure` construction shapes with repeated `phase: "spec"` setup. As this area already has many retry classification scenarios, additional inline construction increases noise.  
**Suggestion:** Add small local helpers such as `specSubprocessFailure(stderr)` and `specMessageFailure(message)` near the retry tests, then assert only the classification behavior in each test.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R13  
**Issue:** The new retry classification tests inline similar `ReviewFailure` construction shapes with repeated `phase: "spec"` setup. As this area already has many retry classification scenarios, additional inline construction increases noise.  
**Suggestion:** Add small local helpers such as `specSubprocessFailure(stderr)` and `specMessageFailure(message)` near the retry tests, then assert only the classification behavior in each test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Extract shared repository fixture setup
**Finding key:** loop-f61c4f513fd6b25ce168
**Failure mode:** refactor
**File:** tests/unit/flow/set-retry.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` duplicates the git initialization, user config, tracked fixture write, add, and commit logic from `initializeRepository`. This adds maintenance drift for fixture setup.  
**Suggestion:** Reuse `initializeRepository(root)` inside `initializeRepositoryWithUntrackedSpec(root)`, then add only the untracked `specs/001-retry/spec.json` setup afterward.
**Suggestion:** **File:** `tests/unit/flow/set-retry.test.js`  
**Requirement:** R13  
**Issue:** `initializeRepositoryWithUntrackedSpec` duplicates the git initialization, user config, tracked fixture write, add, and commit logic from `initializeRepository`. This adds maintenance drift for fixture setup.  
**Suggestion:** Reuse `initializeRepository(root)` inside `initializeRepositoryWithUntrackedSpec(root)`, then add only the untracked `specs/001-retry/spec.json` setup afterward.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Extract Binding Command Assertions
**Finding key:** loop-b4a10fa464dbe6b8e0e0
**Failure mode:** refactor
**File:** tests/unit/flow/skill-prelude-auto.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/skill-prelude-auto.test.js`  
**Requirement:** R7  
**Issue:** The test repeats the same `--expect-binding <token>` command-shape assertion several times. This makes future binding-token wording changes noisy and easy to update inconsistently.  
**Suggestion:** Define a small local helper such as `assertDispatcherUsesBinding(dispatcher, commandPrefix)` or a shared regex constant for ``--expect-binding <token>`` within this test file, then use it for each command assertion.
**Suggestion:** **File:** `tests/unit/flow/skill-prelude-auto.test.js`  
**Requirement:** R7  
**Issue:** The test repeats the same `--expect-binding <token>` command-shape assertion several times. This makes future binding-token wording changes noisy and easy to update inconsistently.  
**Suggestion:** Define a small local helper such as `assertDispatcherUsesBinding(dispatcher, commandPrefix)` or a shared regex constant for ``--expect-binding <token>`` within this test file, then use it for each command assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Name the JSONL Stream Fixture
**Finding key:** loop-0e89c47139c432462bc6
**Failure mode:** refactor
**File:** tests/unit/lib/provider.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The new provider test builds a mixed event stream inline, so the important behavior, “final agent message wins over earlier progress output,” is slightly buried in fixture setup.  
**Suggestion:** Extract the serialization into a local helper like `toJsonl(events)` or name the fixture `streamWithProgressAndFinalAgentMessage` before calling `provider.parse(...)`. This keeps the test intent clearer without changing behavior.
**Suggestion:** **File:** `tests/unit/lib/provider.test.js`  
**Requirement:** R13  
**Issue:** The new provider test builds a mixed event stream inline, so the important behavior, “final agent message wins over earlier progress output,” is slightly buried in fixture setup.  
**Suggestion:** Extract the serialization into a local helper like `toJsonl(events)` or name the fixture `streamWithProgressAndFinalAgentMessage` before calling `provider.parse(...)`. This keeps the test intent clearer without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Centralize Guarded Command Construction
**Finding key:** loop-b733dbd1d38898dcb5de
**Failure mode:** refactor
**File:** src/flow/lib/next-action-directive.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/next-action-directive.js`
**Requirement:** R3
**Issue:** Guarded command formatting is introduced in multiple places: `next-action-directive.js`, `get-next-action.js`, and `finalization-outbox-recovery.js` each appear to apply `FlowTargetBinding` or fallback guard flags independently. This creates a cross-file interface risk where future binding behavior may diverge between normal next actions, recovery directives, and finalization recovery commands.
**Suggestion:** Introduce one shared helper for guarded Flow command construction, preferably owned near `FlowTargetBinding` or the directive layer, and route all guarded CLI command output through it.
**Suggestion:** **File:** `src/flow/lib/next-action-directive.js`
**Requirement:** R3
**Issue:** Guarded command formatting is introduced in multiple places: `next-action-directive.js`, `get-next-action.js`, and `finalization-outbox-recovery.js` each appear to apply `FlowTargetBinding` or fallback guard flags independently. This creates a cross-file interface risk where future binding behavior may diverge between normal next actions, recovery directives, and finalization recovery commands.
**Suggestion:** Introduce one shared helper for guarded Flow command construction, preferably owned near `FlowTargetBinding` or the directive layer, and route all guarded CLI command output through it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Align Exact Target Guard Validation Helpers
**Finding key:** loop-0e6bbc6024b52586091a
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`
**Requirement:** R4
**Issue:** Several target-sensitive command files now keep local wrappers around the same `missingExactTargetGuardNames()` behavior, with inconsistent names such as `requireExactGuards()` and `validateCorrectionGuards()`. The duplicated envelope construction and naming differences make the exact-target guard contract harder to audit across recovery, review-pass, and reopen-draft flows.
**Suggestion:** Add a shared exact-target guard failure helper that returns the standard `ACTIVE_FLOW_MISMATCH` response, and use the same helper name across all affected command paths.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`
**Requirement:** R4
**Issue:** Several target-sensitive command files now keep local wrappers around the same `missingExactTargetGuardNames()` behavior, with inconsistent names such as `requireExactGuards()` and `validateCorrectionGuards()`. The duplicated envelope construction and naming differences make the exact-target guard contract harder to audit across recovery, review-pass, and reopen-draft flows.
**Suggestion:** Add a shared exact-target guard failure helper that returns the standard `ACTIVE_FLOW_MISMATCH` response, and use the same helper name across all affected command paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 3. Resolve Dispatch Invocation Identity Semantics
**Finding key:** loop-ef20383d6efb140a6486
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** `dispatchInvocationId` is treated inconsistently across files: `review-convergence.js` stores it in `ReviewRecoveryIdentity` but may not compare it, while `set-retry.js` may use it in unchanged-target checks, and `run-dispatch.js` reuses one value across multiple dispatched work items. This makes it unclear whether the field identifies a dispatch session, a single work item, or audit metadata.
**Suggestion:** Define one contract for `dispatchInvocationId`: either make it per work item and identity-relevant everywhere, or keep it as receipt/audit metadata and exclude it from convergence identity comparisons.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** `dispatchInvocationId` is treated inconsistently across files: `review-convergence.js` stores it in `ReviewRecoveryIdentity` but may not compare it, while `set-retry.js` may use it in unchanged-target checks, and `run-dispatch.js` reuses one value across multiple dispatched work items. This makes it unclear whether the field identifies a dispatch session, a single work item, or audit metadata.
**Suggestion:** Define one contract for `dispatchInvocationId`: either make it per work item and identity-relevant everywhere, or keep it as receipt/audit metadata and exclude it from convergence identity comparisons.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 4. Standardize Binding Context Naming
**Finding key:** loop-9df078e59ae94b5f002c
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`
**Requirement:** R4
**Issue:** Binding authority fields are constructed and named across `base-command.js`, `dispatcher.js`, and related guard code using close but ambiguous terms like `mainRoot`, `authorityRoot`, and `worktreePath`. Because these values define target-binding authority, small naming confusion can cause incorrect caller/callee assumptions.
**Suggestion:** Centralize construction of the binding validation context and use explicit names such as `canonicalMainRoot`, `executionAuthorityRoot`, and `activeWorktreePath` consistently at the boundary.
**Suggestion:** **File:** `src/flow/lib/base-command.js`
**Requirement:** R4
**Issue:** Binding authority fields are constructed and named across `base-command.js`, `dispatcher.js`, and related guard code using close but ambiguous terms like `mainRoot`, `authorityRoot`, and `worktreePath`. Because these values define target-binding authority, small naming confusion can cause incorrect caller/callee assumptions.
**Suggestion:** Centralize construction of the binding validation context and use explicit names such as `canonicalMainRoot`, `executionAuthorityRoot`, and `activeWorktreePath` consistently at the boundary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 5. Consolidate Binding Command Documentation
**Finding key:** loop-8b9abcdc0bee0345ff4d
**Failure mode:** refactor
**File:** .agents/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `.agents/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** The `--expect-binding <token>` contract is repeated across generated skill docs and partials, while related wording in `core-principle.md` describes refreshing target authority more vaguely. This creates documentation drift risk between the dispatcher instructions and the shared principles.
**Suggestion:** Define one canonical phrase for “current binding command arguments” near the first binding-token instruction, state that the latest CLI-returned binding replaces earlier bindings, and reuse that term in partials instead of repeating literal command text.
**Suggestion:** **File:** `.agents/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** The `--expect-binding <token>` contract is repeated across generated skill docs and partials, while related wording in `core-principle.md` describes refreshing target authority more vaguely. This creates documentation drift risk between the dispatcher instructions and the shared principles.
**Suggestion:** Define one canonical phrase for “current binding command arguments” near the first binding-token instruction, state that the latest CLI-returned binding replaces earlier bindings, and reuse that term in partials instead of repeating literal command text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 6. Share Binding Assertion Test Helpers
**Finding key:** loop-f7665792795a751017df
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Multiple test files repeat assertions that commands include `--expect-binding` and exclude legacy guards, including `next-action-directive.test.js` and `skill-prelude-auto.test.js`. This duplicates the command-shape contract across tests.
**Suggestion:** Add a focused assertion helper such as `assertUsesTargetBinding(command)` in the relevant test utility area or locally per suite, and use it consistently for binding command checks.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Multiple test files repeat assertions that commands include `--expect-binding` and exclude legacy guards, including `next-action-directive.test.js` and `skill-prelude-auto.test.js`. This duplicates the command-shape contract across tests.
**Suggestion:** Add a focused assertion helper such as `assertUsesTargetBinding(command)` in the relevant test utility area or locally per suite, and use it consistently for binding command checks.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
