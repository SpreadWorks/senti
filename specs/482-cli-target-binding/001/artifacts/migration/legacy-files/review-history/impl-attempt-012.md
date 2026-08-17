# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Centralize binding-token command wording
**Finding key:** loop-6e5baef5b3261be8759e
**Failure mode:** refactor
**File:** .agents/skills/senti.flow/SKILL.md
**Requirement:** R13
**Issue:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The new `--expect-binding <token>` command forms are repeated throughout the skill text. If the binding command changes again, multiple prose examples must be updated manually, increasing drift risk.  
**Suggestion:** Define a single placeholder near the core principle, such as `bindingArgs = --expect-binding <token>`, then use `bindingArgs` consistently in later examples and reference commands.
**Suggestion:** **File:** `.agents/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The new `--expect-binding <token>` command forms are repeated throughout the skill text. If the binding command changes again, multiple prose examples must be updated manually, increasing drift risk.  
**Suggestion:** Define a single placeholder near the core principle, such as `bindingArgs = --expect-binding <token>`, then use `bindingArgs` consistently in later examples and reference commands.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 3. Centralize binding-token command wording
**Finding key:** loop-a13eadd74cd41fceb86d
**Failure mode:** refactor
**File:** .claude/skills/senti.flow/SKILL.md
**Requirement:** R13
**Issue:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The new `--expect-binding <token>` command forms are repeated throughout the skill text. If the binding command changes again, multiple prose examples must be updated manually, increasing drift risk.  
**Suggestion:** Define a single placeholder near the core principle, such as `bindingArgs = --expect-binding <token>`, then use `bindingArgs` consistently in later examples and reference commands.
**Suggestion:** **File:** `.claude/skills/senti.flow/SKILL.md`  
**Requirement:** R13  
**Issue:** The new `--expect-binding <token>` command forms are repeated throughout the skill text. If the binding command changes again, multiple prose examples must be updated manually, increasing drift risk.  
**Suggestion:** Define a single placeholder near the core principle, such as `bindingArgs = --expect-binding <token>`, then use `bindingArgs` consistently in later examples and reference commands.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Preserve schema-failure classification when errors only expose `stack`
**Finding key:** loop-aae208d087dc8c5cb64a
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R13
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R13  
**Issue:** `classifyReviewCommandError()` now ignores `err.stack`. If a thrown error carries the schema-validation text only in `stack`, provider-recovery classification can fail and fall through to generic failure handling.  
**Suggestion:** Keep stack support while preferring message for cleaner output, e.g. `String(err?.message || err?.stack || err || "")`, or explicitly combine both when matching schema failures.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R13  
**Issue:** `classifyReviewCommandError()` now ignores `err.stack`. If a thrown error carries the schema-validation text only in `stack`, provider-recovery classification can fail and fall through to generic failure handling.  
**Suggestion:** Keep stack support while preferring message for cleaner output, e.g. `String(err?.message || err?.stack || err || "")`, or explicitly combine both when matching schema failures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Avoid deriving CLI command strings from action naming
**Finding key:** loop-bd0d36d5f20c8e1c2218
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R13
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** `executionCommand()` infers `senti flow run <name>` by slicing the `run-` prefix from `action`. This couples action IDs to CLI subcommand names and makes the new constructor invariant enforce a naming convention rather than an explicit contract.  
**Suggestion:** Add an explicit optional execution command or subcommand field to lifecycle-owned nodes, validate that it exists when `definitionLifecycleOwned` is true, and return that value. This keeps action identity separate from CLI rendering.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R13  
**Issue:** `executionCommand()` infers `senti flow run <name>` by slicing the `run-` prefix from `action`. This couples action IDs to CLI subcommand names and makes the new constructor invariant enforce a naming convention rather than an explicit contract.  
**Suggestion:** Add an explicit optional execution command or subcommand field to lifecycle-owned nodes, validate that it exists when `definitionLifecycleOwned` is true, and return that value. This keeps action identity separate from CLI rendering.
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

### 12. 1. Extract shared recovery identity construction
**Finding key:** loop-1d614fa008e039d2104e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` builds `previousIdentity` and `nextIdentity` with nearly identical target/run/spec/phase/task fields, differing only by previous/next tree, target-state digest, target-binding digest, and dispatch invocation id. This duplication makes future identity fields easy to add to one side and miss on the other.  
**Suggestion:** Add a small private helper such as `recoveryIdentityFor(input, { treeSha, targetStateDigest, targetBindingDigest, dispatchInvocationId })` or an instance method that fills the common fields once, then use it for both identities.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` builds `previousIdentity` and `nextIdentity` with nearly identical target/run/spec/phase/task fields, differing only by previous/next tree, target-state digest, target-binding digest, and dispatch invocation id. This duplication makes future identity fields easy to add to one side and miss on the other.  
**Suggestion:** Add a small private helper such as `recoveryIdentityFor(input, { treeSha, targetStateDigest, targetBindingDigest, dispatchInvocationId })` or an instance method that fills the common fields once, then use it for both identities.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Replace field-name string list with a named constant
**Finding key:** loop-201abcb1545a9517fc59
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity.hasChangedFrom()` embeds the full comparison field list inline. These strings now define the semantic identity surface for recovery reuse, so keeping them inside the method makes the contract less visible and easier to accidentally diverge from constructor fields.  
**Suggestion:** Move the list to a module-level constant such as `REVIEW_RECOVERY_IDENTITY_FIELDS`, preferably near `ReviewRecoveryIdentity`, and reuse it in `hasChangedFrom()`.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryIdentity.hasChangedFrom()` embeds the full comparison field list inline. These strings now define the semantic identity surface for recovery reuse, so keeping them inside the method makes the contract less visible and easier to accidentally diverge from constructor fields.  
**Suggestion:** Move the list to a module-level constant such as `REVIEW_RECOVERY_IDENTITY_FIELDS`, preferably near `ReviewRecoveryIdentity`, and reuse it in `hasChangedFrom()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Preserve a single target digest validation path
**Finding key:** loop-1d4c0b53b9f5947278ab
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `resolveReviewOperationForFlowState()` separately validates `record.targetStateDigest` before calling `convergenceStateForTargetDigest(record, targetStateDigest)`, which also exists to produce target-digest scoped state. This splits responsibility and makes it less obvious which function owns digest applicability.  
**Suggestion:** Either let `convergenceStateForTargetDigest()` be the sole target-state gate and have it return an empty/non-actionable state when mismatched, or rename/extract the precheck into a clearly shared helper used by both code paths.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `resolveReviewOperationForFlowState()` separately validates `record.targetStateDigest` before calling `convergenceStateForTargetDigest(record, targetStateDigest)`, which also exists to produce target-digest scoped state. This splits responsibility and makes it less obvious which function owns digest applicability.  
**Suggestion:** Either let `convergenceStateForTargetDigest()` be the sole target-state gate and have it return an empty/non-actionable state when mismatched, or rename/extract the precheck into a clearly shared helper used by both code paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Avoid exporting `FlowDispatchWork` unless required by consumers
**Finding key:** loop-90df265ea9c15378159e
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** `FlowDispatchWork` changed from internal to exported, but the diff does not show an external consumer. Exporting it expands the public module surface around dispatcher prompt construction, which conflicts with the direction of keeping target guard details internal.  
**Suggestion:** Keep `FlowDispatchWork` unexported unless tests or other modules genuinely need it. If tests need access, prefer validating through `RunDispatchCommand` behavior or export only from a dedicated test seam if the project already has that pattern.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** `FlowDispatchWork` changed from internal to exported, but the diff does not show an external consumer. Exporting it expands the public module surface around dispatcher prompt construction, which conflicts with the direction of keeping target guard details internal.  
**Suggestion:** Keep `FlowDispatchWork` unexported unless tests or other modules genuinely need it. If tests need access, prefer validating through `RunDispatchCommand` behavior or export only from a dedicated test seam if the project already has that pattern.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 5. Centralize dispatch invocation environment naming
**Finding key:** loop-5311b0e75d47d84c7dc0
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `DISPATCH_INVOCATION_ENV` stores the env var name, but `executionEnvironment()` still hardcodes `SENTI_FLOW_TARGET_BINDING` directly. These two values are the paired dispatcher environment contract, but only one is named.  
**Suggestion:** Add a `TARGET_BINDING_ENV` constant and use computed keys for both environment entries. This keeps dispatcher recovery environment names in one place and makes future renames less error-prone.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R6  
**Issue:** `DISPATCH_INVOCATION_ENV` stores the env var name, but `executionEnvironment()` still hardcodes `SENTI_FLOW_TARGET_BINDING` directly. These two values are the paired dispatcher environment contract, but only one is named.  
**Suggestion:** Add a `TARGET_BINDING_ENV` constant and use computed keys for both environment entries. This keeps dispatcher recovery environment names in one place and makes future renames less error-prone.
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

### 33. 1. Rename the generic test helper
**Finding key:** loop-98cbf07730bef5ef06df
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new helper is named `binding()`, which is broad and can be confused with arbitrary bindings in a file focused on directive resolution.  
**Suggestion:** Rename it to something intent-specific like `targetBinding()` or `branchTargetBinding()` so each test clearly communicates that the expected command text is derived from `FlowTargetBinding`.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new helper is named `binding()`, which is broad and can be confused with arbitrary bindings in a file focused on directive resolution.  
**Suggestion:** Rename it to something intent-specific like `targetBinding()` or `branchTargetBinding()` so each test clearly communicates that the expected command text is derived from `FlowTargetBinding`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Split cumulative invocation tracking by dispatch run
**Finding key:** loop-d1fd0a5a241274d651ab
**Failure mode:** refactor
**File:** tests/unit/flow/run-dispatch.test.js
**Requirement:** R12
**Issue:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R12  
**Issue:** The new test reuses `invocationIds` and `bindingValues` across two dispatcher executions, then relies on cumulative indexes like `invocationIds[2]` and `invocationIds[3]`. This makes the test harder to read and more brittle if the number of worker calls changes.  
**Suggestion:** Capture the first dispatch’s IDs into local variables after the first execute, then reset the tracking arrays before the second execute. Assert each invocation independently, and compare the first dispatch ID against the second dispatch ID explicitly.
**Suggestion:** **File:** `tests/unit/flow/run-dispatch.test.js`  
**Requirement:** R12  
**Issue:** The new test reuses `invocationIds` and `bindingValues` across two dispatcher executions, then relies on cumulative indexes like `invocationIds[2]` and `invocationIds[3]`. This makes the test harder to read and more brittle if the number of worker calls changes.  
**Suggestion:** Capture the first dispatch’s IDs into local variables after the first execute, then reset the tracking arrays before the second execute. Assert each invocation independently, and compare the first dispatch ID against the second dispatch ID explicitly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Extract shared repository fixture setup
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

### 36. 2. Name the legacy fixture around the behavior under test
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

### 37. 1. Extract Repeated Agent Message Event Construction
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

### 38. 1. Duplicate guarded-command construction paths
**Finding key:** loop-d649d377f474bb39f6ee
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/get-next-action.js`
**Requirement:** R3
**Issue:** Guarded command creation appears in multiple files with slightly different fallback behavior: direct `binding.guardCommand(...)` calls in `get-next-action.js`, `guardedCommand(...)` in `next-action-directive.js`, and similar recovery helpers in `finalization-outbox-recovery.js`. This creates a cross-file interface inconsistency around whether commands must be derived from `FlowTargetBinding` or may fall back to state-derived guard flags.
**Suggestion:** Introduce one shared guarded-command helper or directive-layer API that owns command wrapping. Require `FlowTargetBinding` for target-sensitive paths, and keep any legacy fallback in a clearly named non-target-sensitive helper.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`
**Requirement:** R3
**Issue:** Guarded command creation appears in multiple files with slightly different fallback behavior: direct `binding.guardCommand(...)` calls in `get-next-action.js`, `guardedCommand(...)` in `next-action-directive.js`, and similar recovery helpers in `finalization-outbox-recovery.js`. This creates a cross-file interface inconsistency around whether commands must be derived from `FlowTargetBinding` or may fall back to state-derived guard flags.
**Suggestion:** Introduce one shared guarded-command helper or directive-layer API that owns command wrapping. Require `FlowTargetBinding` for target-sensitive paths, and keep any legacy fallback in a clearly named non-target-sensitive helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Repeated exact-target guard failure wrappers
**Finding key:** loop-1de0f4159d10b043af69
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`
**Requirement:** R4
**Issue:** `run-recover-existing-implementation.js`, `run-recover-review-pass.js`, and `run-reopen-draft.js` each keep a local wrapper around `missingExactTargetGuardNames()` that builds the same mismatch/failure envelope. The only meaningful difference is local naming, which makes enforcement behavior easier to drift across command files.
**Suggestion:** Extract a shared exact-target guard failure helper and have all three command paths call it before target-sensitive side effects.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`
**Requirement:** R4
**Issue:** `run-recover-existing-implementation.js`, `run-recover-review-pass.js`, and `run-reopen-draft.js` each keep a local wrapper around `missingExactTargetGuardNames()` that builds the same mismatch/failure envelope. The only meaningful difference is local naming, which makes enforcement behavior easier to drift across command files.
**Suggestion:** Extract a shared exact-target guard failure helper and have all three command paths call it before target-sensitive side effects.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Inconsistent guard naming across command files
**Finding key:** loop-b00baf96c5cf3567f200
**Failure mode:** refactor
**File:** src/flow/lib/run-reopen-draft.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-reopen-draft.js`
**Requirement:** R4
**Issue:** The same exact-target guard concept is named `validateCorrectionGuards()` in `run-reopen-draft.js` but `requireExactGuards()` in recovery files. This weakens cross-file readability because equivalent guard semantics use different names.
**Suggestion:** Rename the reopen-draft helper to match the shared terminology, preferably `requireExactGuards()`, or remove the local helper entirely if a shared guard failure helper is introduced.
**Suggestion:** **File:** `src/flow/lib/run-reopen-draft.js`
**Requirement:** R4
**Issue:** The same exact-target guard concept is named `validateCorrectionGuards()` in `run-reopen-draft.js` but `requireExactGuards()` in recovery files. This weakens cross-file readability because equivalent guard semantics use different names.
**Suggestion:** Rename the reopen-draft helper to match the shared terminology, preferably `requireExactGuards()`, or remove the local helper entirely if a shared guard failure helper is introduced.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Binding environment constants are only partially centralized
**Finding key:** loop-7307e1e69664170d36e6
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R6
**Issue:** `DISPATCH_INVOCATION_ENV` names one dispatcher environment variable, while `SENTI_FLOW_TARGET_BINDING` remains hardcoded in `executionEnvironment()`. These two env vars form one cross-file dispatcher/recovery contract, but only one has a named constant.
**Suggestion:** Add `TARGET_BINDING_ENV` beside `DISPATCH_INVOCATION_ENV` and use computed keys for both entries.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`
**Requirement:** R6
**Issue:** `DISPATCH_INVOCATION_ENV` names one dispatcher environment variable, while `SENTI_FLOW_TARGET_BINDING` remains hardcoded in `executionEnvironment()`. These two env vars form one cross-file dispatcher/recovery contract, but only one has a named constant.
**Suggestion:** Add `TARGET_BINDING_ENV` beside `DISPATCH_INVOCATION_ENV` and use computed keys for both entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 5. Binding command wording duplicated across generated and source skill docs
**Finding key:** loop-621b73c2524505036526
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** The literal `--expect-binding <token>` command form is repeated across `src/skills/senti.flow/SKILL.md`, `.agents/skills/senti.flow/SKILL.md`, and related partial guidance. This creates a documentation drift risk between source partials and generated skill output.
**Suggestion:** Define one canonical phrase or placeholder in the source partial, such as “current binding command arguments,” and have generated skill text consistently reference that concept instead of repeating the literal flag everywhere.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** The literal `--expect-binding <token>` command form is repeated across `src/skills/senti.flow/SKILL.md`, `.agents/skills/senti.flow/SKILL.md`, and related partial guidance. This creates a documentation drift risk between source partials and generated skill output.
**Suggestion:** Define one canonical phrase or placeholder in the source partial, such as “current binding command arguments,” and have generated skill text consistently reference that concept instead of repeating the literal flag everywhere.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
