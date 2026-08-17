# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Preserve useful error context without relying on full stack text
**Finding key:** loop-eb700217b425dbc83284
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R13
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R13  
**Issue:** Changing classification input from `err.stack || err.message` to only `err.message` removes fallback context that may contain the schema validation detail if the thrown error wrapper has a generic message but a more descriptive stack/cause chain.  
**Suggestion:** If stack matching was intentionally removed to avoid brittle classification, add an explicit fallback through structured error causes, e.g. collect `err.message`, `err.cause?.message`, and nested causes into a bounded string. That keeps classification deterministic without depending on full stack formatting.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R13  
**Issue:** Changing classification input from `err.stack || err.message` to only `err.message` removes fallback context that may contain the schema validation detail if the thrown error wrapper has a generic message but a more descriptive stack/cause chain.  
**Suggestion:** If stack matching was intentionally removed to avoid brittle classification, add an explicit fallback through structured error causes, e.g. collect `err.message`, `err.cause?.message`, and nested causes into a bounded string. That keeps classification deterministic without depending on full stack formatting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 3. Avoid truthiness fallback for command authority roots
**Finding key:** loop-2d7fc4759866481a4231
**Failure mode:** refactor
**File:** src/flow/lib/base-command.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `mainRoot: ctx.mainRoot || ctx.root` treats any falsy `ctx.mainRoot` as absent. Paths are normally non-empty, but authority-sensitive code should distinguish “missing” from “present but unexpected” as clearly as possible.  
**Suggestion:** Use nullish coalescing: `mainRoot: ctx.mainRoot ?? ctx.root`. This better communicates that only `null`/`undefined` should fall back to `ctx.root`.
**Suggestion:** **File:** `src/flow/lib/base-command.js`  
**Requirement:** R4  
**Issue:** `mainRoot: ctx.mainRoot || ctx.root` treats any falsy `ctx.mainRoot` as absent. Paths are normally non-empty, but authority-sensitive code should distinguish “missing” from “present but unexpected” as clearly as possible.  
**Suggestion:** Use nullish coalescing: `mainRoot: ctx.mainRoot ?? ctx.root`. This better communicates that only `null`/`undefined` should fall back to `ctx.root`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Consolidate guarded command construction
**Finding key:** loop-dbc66b33b40da741cab1
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand()` and `refreshCommand()` now duplicate the same binding-aware command construction pattern: if `binding` exists, use `binding.guardCommand(...)`; otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Extract a shared helper, for example `guardedCommand(command, state, binding)`, and have both functions call it. This keeps finalization boundary command formatting consistent and reduces the chance that future guard behavior changes in one path but not the other.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** `recoveryCommand()` and `refreshCommand()` now duplicate the same binding-aware command construction pattern: if `binding` exists, use `binding.guardCommand(...)`; otherwise append `guardFlagsForState(state)`.  
**Suggestion:** Extract a shared helper, for example `guardedCommand(command, state, binding)`, and have both functions call it. This keeps finalization boundary command formatting consistent and reduces the chance that future guard behavior changes in one path but not the other.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Rename `binding` to clarify its role
**Finding key:** loop-b46621c497a328435d7b
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** The new constructor field `binding` is generic, but its behavior is specifically to produce target-binding guard flags for recovery/refresh commands. The name does not make that responsibility obvious at call sites like `recoveryCommand(command, this.state, this.binding)`.  
**Suggestion:** Rename it to something more specific such as `targetBinding` or `flowTargetBinding`, including the helper parameter and class field. This would align the naming with the requirement language and make boundary validation intent clearer.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`  
**Requirement:** R10  
**Issue:** The new constructor field `binding` is generic, but its behavior is specifically to produce target-binding guard flags for recovery/refresh commands. The name does not make that responsibility obvious at call sites like `recoveryCommand(command, this.state, this.binding)`.  
**Suggestion:** Rename it to something more specific such as `targetBinding` or `flowTargetBinding`, including the helper parameter and class field. This would align the naming with the requirement language and make boundary validation intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Remove the Redundant `expectedProposal` Comparison Branch
**Finding key:** loop-011b9c48dd9dc0ad40d1
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** After the change, the conflict check only runs when `mandatory` is true. In that branch, `expectedProposal` is always `"must-fix"`, so the variable still carries a now-unused informational case and makes the condition look more general than it is.  
**Suggestion:** Simplify the branch to compare directly against `"must-fix"` inside the mandatory block, or move `expectedProposal` inside the `if (mandatory)` block so the policy intent is explicit.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** After the change, the conflict check only runs when `mandatory` is true. In that branch, `expectedProposal` is always `"must-fix"`, so the variable still carries a now-unused informational case and makes the condition look more general than it is.  
**Suggestion:** Simplify the branch to compare directly against `"must-fix"` inside the mandatory block, or move `expectedProposal` inside the `if (mandatory)` block so the policy intent is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Add the Missing `FlowTargetExpectation` Import
**Finding key:** loop-76b84281c68584df513a
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `resolveTargetSelection()` now instantiates `FlowTargetExpectation`, but the diff does not show an added import. If this file does not already import it, the new path will fail at runtime with `ReferenceError: FlowTargetExpectation is not defined`.  
**Suggestion:** Import `FlowTargetExpectation` from the same module that defines the target binding/guard API, likely `../../lib/flow-target-guard.js`, matching the new `FlowTargetBinding` usage in `get-next-action.js`.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `resolveTargetSelection()` now instantiates `FlowTargetExpectation`, but the diff does not show an added import. If this file does not already import it, the new path will fail at runtime with `ReferenceError: FlowTargetExpectation is not defined`.  
**Suggestion:** Import `FlowTargetExpectation` from the same module that defines the target binding/guard API, likely `../../lib/flow-target-guard.js`, matching the new `FlowTargetBinding` usage in `get-next-action.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Rename generic binding parameter
**Finding key:** loop-4bc97d422390445dae42
**Failure mode:** refactor
**File:** src/flow/lib/next-action-directive.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/next-action-directive.js`  
**Requirement:** R3  
**Issue:** The new `binding` parameter is generic, while the requirement and surrounding behavior are specifically about `FlowTargetBinding`. This makes it less obvious that command guarding must come from the target binding.  
**Suggestion:** Rename `binding` to `targetBinding` throughout this file, including constructor input, instance field, and helper parameters.
**Suggestion:** **File:** `src/flow/lib/next-action-directive.js`  
**Requirement:** R3  
**Issue:** The new `binding` parameter is generic, while the requirement and surrounding behavior are specifically about `FlowTargetBinding`. This makes it less obvious that command guarding must come from the target binding.  
**Suggestion:** Rename `binding` to `targetBinding` throughout this file, including constructor input, instance field, and helper parameters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Extract shared recovery identity construction
**Finding key:** loop-21670a4895eff277a45d
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` builds `previousIdentity` and `nextIdentity` with duplicated target/run/spec/phase/task fields, increasing the chance that future identity fields are added to one side but not the other.  
**Suggestion:** Add a small helper such as `recoveryIdentityInput(input, prefix, phase, taskId)` or a private method to construct both identities from the same field mapping.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R13  
**Issue:** `ReviewRecoveryMutation` builds `previousIdentity` and `nextIdentity` with duplicated target/run/spec/phase/task fields, increasing the chance that future identity fields are added to one side but not the other.  
**Suggestion:** Add a small helper such as `recoveryIdentityInput(input, prefix, phase, taskId)` or a private method to construct both identities from the same field mapping.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Split provider failure matcher pattern
**Finding key:** loop-c65c09ca5bcc4175b6ce
**Failure mode:** refactor
**File:** src/flow/lib/review-failure.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-failure.js`  
**Requirement:** R13  
**Issue:** `matchesProviderFailure` now contains a dense regular expression with several unrelated alternatives, making future edits error-prone.  
**Suggestion:** Extract the pattern to a named constant, or split provider-related alternatives into a small array of regexes and use `.some((pattern) => pattern.test(text))` for readability and easier extension.
**Suggestion:** **File:** `src/flow/lib/review-failure.js`  
**Requirement:** R13  
**Issue:** `matchesProviderFailure` now contains a dense regular expression with several unrelated alternatives, making future edits error-prone.  
**Suggestion:** Extract the pattern to a named constant, or split provider-related alternatives into a small array of regexes and use `.some((pattern) => pattern.test(text))` for readability and easier extension.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Avoid widening the module API for dispatch work
**Finding key:** loop-4cebce812910754db238
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** `FlowDispatchWork` changed from an internal class to an exported class, but the diff does not show a production caller that needs it. This expands the public surface for dispatcher internals.  
**Suggestion:** Keep `FlowDispatchWork` unexported unless another touched file or test genuinely imports it. If tests need access, prefer testing through `RunDispatchCommand` behavior or document why this internal type is intentionally exported.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R7  
**Issue:** `FlowDispatchWork` changed from an internal class to an exported class, but the diff does not show a production caller that needs it. This expands the public surface for dispatcher internals.  
**Suggestion:** Keep `FlowDispatchWork` unexported unless another touched file or test genuinely imports it. If tests need access, prefer testing through `RunDispatchCommand` behavior or document why this internal type is intentionally exported.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Name both dispatch environment variables consistently
**Finding key:** loop-f95323f286d25511d345
**Failure mode:** refactor
**File:** src/flow/lib/run-dispatch.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R3  
**Issue:** `DISPATCH_INVOCATION_ENV` is named as a constant, but `SENTI_FLOW_TARGET_BINDING` remains an inline string in `executionEnvironment()`. That makes the two injected environment variables inconsistent and slightly increases typo risk.  
**Suggestion:** Add a sibling constant such as `FLOW_TARGET_BINDING_ENV = "SENTI_FLOW_TARGET_BINDING"` and use it in `executionEnvironment()`.
**Suggestion:** **File:** `src/flow/lib/run-dispatch.js`  
**Requirement:** R3  
**Issue:** `DISPATCH_INVOCATION_ENV` is named as a constant, but `SENTI_FLOW_TARGET_BINDING` remains an inline string in `executionEnvironment()`. That makes the two injected environment variables inconsistent and slightly increases typo risk.  
**Suggestion:** Add a sibling constant such as `FLOW_TARGET_BINDING_ENV = "SENTI_FLOW_TARGET_BINDING"` and use it in `executionEnvironment()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Avoid Mutating Review Result When Inferring Artifact Path
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

### 13. 1. Extract Review Recovery Identity Construction
**Finding key:** loop-04bfec205e015c595b95
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `currentReviewRecoveryIdentity` and `unchangedReviewConvergenceTarget` now duplicate several identity fields: `runId`, issue presence/value, `spec`, target binding digest, and dispatch invocation id. This makes future identity changes easy to apply inconsistently.  
**Suggestion:** Add a small helper such as `reviewRecoveryIdentityBase(ctx)` or `buildReviewRecoveryIdentity(ctx, overrides)` and use it in both places.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R13  
**Issue:** `currentReviewRecoveryIdentity` and `unchangedReviewConvergenceTarget` now duplicate several identity fields: `runId`, issue presence/value, `spec`, target binding digest, and dispatch invocation id. This makes future identity changes easy to apply inconsistently.  
**Suggestion:** Add a small helper such as `reviewRecoveryIdentityBase(ctx)` or `buildReviewRecoveryIdentity(ctx, overrides)` and use it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Bound Execution Environment Size
**Finding key:** loop-df378bc5c345884421f2
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R13
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R13  
**Issue:** `normalizedExecutionEnvironment` iterates over every entry in `options.executionEnvironment` without an explicit count or size bound. This violates the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Add explicit limits, for example max variable count plus max key/value length, and throw a clear error when exceeded.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R13  
**Issue:** `normalizedExecutionEnvironment` iterates over every entry in `options.executionEnvironment` without an explicit count or size bound. This violates the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Add explicit limits, for example max variable count plus max key/value length, and throw a clear error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Rename `normalizedExecutionEnvironment`
**Finding key:** loop-8d71b911e413fc1219e6
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R13
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R13  
**Issue:** The function name is adjectival, but the function performs validation and returns a normalized copy. Existing naming would be clearer as an action.  
**Suggestion:** Rename it to `normalizeExecutionEnvironment` or `buildExecutionEnvironmentOverrides`.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R13  
**Issue:** The function name is adjectival, but the function performs validation and returns a normalized copy. Existing naming would be clearer as an action.  
**Suggestion:** Rename it to `normalizeExecutionEnvironment` or `buildExecutionEnvironmentOverrides`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Consolidate Binding Input Construction
**Finding key:** loop-e4e2717dd7537f7f940d
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R6
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R6  
**Issue:** The dispatcher manually constructs `{ mainRoot, authorityRoot, worktreePath }` using the same rules as `FlowTargetBinding.captureContext()`. This duplicates target-authority derivation logic and makes resume/context recovery easier to drift.  
**Suggestion:** Move the context-to-binding-input construction behind a shared helper in `flow-target-guard.js`, then call that helper from the dispatcher and binding capture paths.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R6  
**Issue:** The dispatcher manually constructs `{ mainRoot, authorityRoot, worktreePath }` using the same rules as `FlowTargetBinding.captureContext()`. This duplicates target-authority derivation logic and makes resume/context recovery easier to drift.  
**Suggestion:** Move the context-to-binding-input construction behind a shared helper in `flow-target-guard.js`, then call that helper from the dispatcher and binding capture paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Bound Serialized Binding Size
**Finding key:** loop-6461f8b004776e73dbac
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowTargetBinding.deserialize()` decodes and parses `expectBinding` without an explicit size limit. This violates the `bounded-resource-usage` guardrail because a very large token can trigger unbounded base64 decoding and JSON parsing.  
**Suggestion:** Add a maximum serialized token length before decoding, for example `MAX_FLOW_TARGET_BINDING_TOKEN_LENGTH`, and reject oversized values with an argument error.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowTargetBinding.deserialize()` decodes and parses `expectBinding` without an explicit size limit. This violates the `bounded-resource-usage` guardrail because a very large token can trigger unbounded base64 decoding and JSON parsing.  
**Suggestion:** Add a maximum serialized token length before decoding, for example `MAX_FLOW_TARGET_BINDING_TOKEN_LENGTH`, and reject oversized values with an argument error.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Remove Unused Authority Equality Method
**Finding key:** loop-c1e75bb05e5c1bf49f1a
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears to be dead code in this change and also relies on `JSON.stringify()` for equality, while actual mismatch handling already uses `bindingMismatch()`.  
**Suggestion:** Remove `equals()` unless there is an existing caller outside the diff. If equality is needed, route it through the existing normalized `toJSON()` plus `bindingMismatch()` path to keep one comparison strategy.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R2  
**Issue:** `FlowExecutionAuthority.equals()` appears to be dead code in this change and also relies on `JSON.stringify()` for equality, while actual mismatch handling already uses `bindingMismatch()`.  
**Suggestion:** Remove `equals()` unless there is an existing caller outside the diff. If equality is needed, route it through the existing normalized `toJSON()` plus `bindingMismatch()` path to keep one comparison strategy.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Rename `authorityRoot` Internally To Execution Root
**Finding key:** loop-34f566928710d9a6b6e6
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R12
**Issue:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R12  
**Issue:** The authority object serializes `executionRoot`, but capture inputs use `authorityRoot`. The two names describe the same value, which makes the managed-worktree/main-root distinction harder to follow.  
**Suggestion:** Standardize the internal parameter name to `executionRoot` and only map from legacy or CLI-facing `authorityRoot` at the boundary if needed.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`  
**Requirement:** R12  
**Issue:** The authority object serializes `executionRoot`, but capture inputs use `authorityRoot`. The two names describe the same value, which makes the managed-worktree/main-root distinction harder to follow.  
**Suggestion:** Standardize the internal parameter name to `executionRoot` and only map from legacy or CLI-facing `authorityRoot` at the boundary if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 4. Add a parser helper for last agent message semantics
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

### 21. 3. Simplify repeated mismatch-stop wording
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

### 22. 1. Extract binding-command wording into one canonical phrase
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

### 23. 2. Remove lingering manual guard examples from binding-era instructions
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

### 24. 3. Extract unauthoritative must-fix fixture construction
**Finding key:** loop-5efbb73e9ea2a7bec8ca
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R13
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new review test builds a full JSON review payload inline. As similar artifact-shape tests accumulate, this makes the test harder to scan and increases duplication around `blockingFindings` / `nonBlockingImprovements` setup.  
**Suggestion:** Move the finding payload creation into a local helper such as `unauthoritativeMustFixReviewOutput()` or `reviewOutputWithBlockingFinding(finding)` so the test focuses on the policy behavior being asserted.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R13  
**Issue:** The new review test builds a full JSON review payload inline. As similar artifact-shape tests accumulate, this makes the test harder to scan and increases duplication around `blockingFindings` / `nonBlockingImprovements` setup.  
**Suggestion:** Move the finding payload creation into a local helper such as `unauthoritativeMustFixReviewOutput()` or `reviewOutputWithBlockingFinding(finding)` so the test focuses on the policy behavior being asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Extract binding command assertions
**Finding key:** loop-b67edc804094da5baed2
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The same assertion pair is repeated across multiple tests: matching `--expect-binding` and rejecting `--expect-run-id|--expect-issue|--expect-spec`. This duplicates the target-binding contract and makes future expectation changes easy to miss.  
**Suggestion:** Add a small helper such as `assertUsesBindingOnly(command)` and replace the repeated `assert.match` / `assert.doesNotMatch` blocks with it.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The same assertion pair is repeated across multiple tests: matching `--expect-binding` and rejecting `--expect-run-id|--expect-issue|--expect-spec`. This duplicates the target-binding contract and makes future expectation changes easy to miss.  
**Suggestion:** Add a small helper such as `assertUsesBindingOnly(command)` and replace the repeated `assert.match` / `assert.doesNotMatch` blocks with it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Rename generic test helper for clarity
**Finding key:** loop-3cdfc1bbab703acc6055
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new helper `binding()` has a broad name that does not describe what kind of binding it creates. In a test file with flow state, convergence state, and directives, the name is a little too generic.  
**Suggestion:** Rename it to something like `flowTargetBinding()` or `branchFlowTargetBinding()` to make the fixture’s intent explicit at call sites.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`  
**Requirement:** R3  
**Issue:** The new helper `binding()` has a broad name that does not describe what kind of binding it creates. In a test file with flow state, convergence state, and directives, the name is a little too generic.  
**Suggestion:** Rename it to something like `flowTargetBinding()` or `branchFlowTargetBinding()` to make the fixture’s intent explicit at call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Rename binding capture for clarity
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

### 28. 3. Avoid brittle accumulated indexing across dispatch runs
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

### 29. 4. Extract repeated review failure construction helpers
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

### 30. 1. Extract shared repository fixture setup
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

### 31. 1. Extract Binding Command Assertions
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

### 32. 2. Name the JSONL Stream Fixture
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

### 33. 1. Standardize Target Binding Naming
**Finding key:** loop-8bbd8ebfb8fe07baea6d
**Failure mode:** refactor
**File:** src/flow/lib/next-action-directive.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/next-action-directive.js`
**Requirement:** R3
**Issue:** Multiple files introduce a generic `binding` name for `FlowTargetBinding` behavior, while other files and tests refer to the same concept as target binding. This creates cross-file naming drift across directive, finalization recovery, and test helpers.
**Suggestion:** Rename generic `binding` parameters/fields/helpers to `targetBinding` or `flowTargetBinding` consistently in production and test files.
**Suggestion:** **File:** `src/flow/lib/next-action-directive.js`
**Requirement:** R3
**Issue:** Multiple files introduce a generic `binding` name for `FlowTargetBinding` behavior, while other files and tests refer to the same concept as target binding. This creates cross-file naming drift across directive, finalization recovery, and test helpers.
**Suggestion:** Rename generic `binding` parameters/fields/helpers to `targetBinding` or `flowTargetBinding` consistently in production and test files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Consolidate Binding-Guarded Command Construction
**Finding key:** loop-f2117208c7938a90ac2d
**Failure mode:** refactor
**File:** src/flow/lib/finalization-outbox-recovery.js
**Requirement:** R10
**Issue:** **File:** `src/flow/lib/finalization-outbox-recovery.js`
**Requirement:** R10
**Issue:** Binding-aware command construction appears in multiple places with the same conditional pattern: use `binding.guardCommand(...)` when available, otherwise append legacy guard flags. This duplicates the interface contract for guarded commands across files.
**Suggestion:** Extract a shared helper such as `guardedCommand(command, state, targetBinding)` and reuse it wherever CLI continuation commands are built.
**Suggestion:** **File:** `src/flow/lib/finalization-outbox-recovery.js`
**Requirement:** R10
**Issue:** Binding-aware command construction appears in multiple places with the same conditional pattern: use `binding.guardCommand(...)` when available, otherwise append legacy guard flags. This duplicates the interface contract for guarded commands across files.
**Suggestion:** Extract a shared helper such as `guardedCommand(command, state, targetBinding)` and reuse it wherever CLI continuation commands are built.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 3. Unify Flow Target Authority Field Names
**Finding key:** loop-308cce82f64957c770bd
**Failure mode:** refactor
**File:** src/lib/flow-target-guard.js
**Requirement:** R12
**Issue:** **File:** `src/lib/flow-target-guard.js`
**Requirement:** R12
**Issue:** The same authority value is referred to as `authorityRoot` in capture inputs and `executionRoot` in serialized authority data. Related dispatcher code also reconstructs the same fields manually, making the target authority interface harder to reason about across files.
**Suggestion:** Standardize on one internal name, preferably `executionRoot`, and expose a shared context-to-binding helper so dispatcher and binding capture paths use the same mapping.
**Suggestion:** **File:** `src/lib/flow-target-guard.js`
**Requirement:** R12
**Issue:** The same authority value is referred to as `authorityRoot` in capture inputs and `executionRoot` in serialized authority data. Related dispatcher code also reconstructs the same fields manually, making the target authority interface harder to reason about across files.
**Suggestion:** Standardize on one internal name, preferably `executionRoot`, and expose a shared context-to-binding helper so dispatcher and binding capture paths use the same mapping.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 4. Extract Shared Review Recovery Identity Construction
**Finding key:** loop-cdd3291b0d809c19efb2
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R13
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity fields are duplicated across `review-convergence.js` and `set-retry.js`, including run/spec/target-binding/dispatch identity details. Future identity changes could be applied inconsistently.
**Suggestion:** Add a shared identity builder, for example `buildReviewRecoveryIdentity(input, overrides)`, and use it from both review convergence and retry code.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R13
**Issue:** Review recovery identity fields are duplicated across `review-convergence.js` and `set-retry.js`, including run/spec/target-binding/dispatch identity details. Future identity changes could be applied inconsistently.
**Suggestion:** Add a shared identity builder, for example `buildReviewRecoveryIdentity(input, overrides)`, and use it from both review convergence and retry code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 5. Centralize Binding Command Assertions In Tests
**Finding key:** loop-fe8bdfbf6ef31eeb150d
**Failure mode:** refactor
**File:** tests/unit/flow/next-action-directive.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Several test files repeat the same binding-only command assertions, checking for `--expect-binding` and absence of manual `--expect-run-id`, `--expect-issue`, and `--expect-spec` guards.
**Suggestion:** Add local or shared test helpers such as `assertUsesBindingOnly(command)` / `assertCommandUsesExpectBinding(command)` and reuse them across directive, review, dispatch, and skill prelude tests.
**Suggestion:** **File:** `tests/unit/flow/next-action-directive.test.js`
**Requirement:** R3
**Issue:** Several test files repeat the same binding-only command assertions, checking for `--expect-binding` and absence of manual `--expect-run-id`, `--expect-issue`, and `--expect-spec` guards.
**Suggestion:** Add local or shared test helpers such as `assertUsesBindingOnly(command)` / `assertCommandUsesExpectBinding(command)` and reuse them across directive, review, dispatch, and skill prelude tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 6. Clarify Binding-Era Skill Wording Across Artifacts
**Finding key:** loop-66f1d001923567509ed0
**Failure mode:** refactor
**File:** src/skills/senti.flow/SKILL.md
**Requirement:** R7
**Issue:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** Binding command guidance is repeated with slightly different wording across `senti.flow` and `core-principle.md`, while some sections still mention manual guard assembly. This creates documentation-level interface inconsistency for agents.
**Suggestion:** Define one canonical phrase for “binding command” and one canonical mismatch-stop rule, then use the same wording in both the skill and shared partial.
**Suggestion:** **File:** `src/skills/senti.flow/SKILL.md`
**Requirement:** R7
**Issue:** Binding command guidance is repeated with slightly different wording across `senti.flow` and `core-principle.md`, while some sections still mention manual guard assembly. This creates documentation-level interface inconsistency for agents.
**Suggestion:** Define one canonical phrase for “binding command” and one canonical mismatch-stop rule, then use the same wording in both the skill and shared partial.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
