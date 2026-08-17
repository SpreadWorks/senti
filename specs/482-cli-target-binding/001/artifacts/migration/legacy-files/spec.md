# Feature Specification: 482-cli-target-binding

**Feature Branch**: `feature/482-cli-target-binding`
**Created**: 2026-07-31
**Status**: Draft
**Input**: GitHub Issue #483

## Goal
Bind normal Flow target-sensitive actions to an immutable CLI-owned FlowTargetBinding so agents execute CLI-generated directives or commands without retyping runId, Issue, or spec guard strings.

## Background
Issue #483 follows a prior runId transcription failure where the skill tried to reduce typos by treating runId as opaque and allowing a narrow read-only status recovery. That reduced the frequency of mistakes but left normal Flow continuation dependent on prompt wording and agent-assembled guard strings. The source confirms the current system already has fail-closed target mismatch checks and active target resolution, but next-action and dispatcher still expose target-sensitive command text assembled from guard strings. A managed-worktree recovery also exposed two related authority gaps: process-owned lock resolution varied by invocation root, and an old review provider blocker survived an authorized planning correction whose semantic output was not reflected into the review target digest. This spec moves target, coordination, and recovery identity into a CLI-owned immutable binding while preserving existing mismatch safety.

## Scope
- Normal Flow dispatcher and next-action directive execution for target-sensitive actions.
- CLI-owned binding of runId, Issue or no-Issue identity, spec path, and managed worktree or branch authority.
- Pre-side-effect ACTIVE_FLOW_MISMATCH behavior for runId, Issue/no-Issue, spec, worktree authority, and branch authority mismatches.
- Context compaction and dispatcher resume paths that must reacquire the active target authority before continuing.
- Managed-worktree commands invoked from either the main repository or the worktree must resolve the same active Flow authority and process-owned lock directory.
- Review recovery and convergence records must remain bound to the current FlowTargetBinding and target-state digest so stale blockers cannot suppress review after an authorized planning correction.
- Migration of the existing targetGuardArgs prompt contract to CLI-generated directive or command execution.
- Regression coverage for read-only status recovery removal or internalization, no-Issue flows, multiple target selection, missing target selection, and finalize/cleanup boundaries.
- Skill source and generated skill artifacts only if the CLI directive contract cannot remove agent-side guard transcription without a skill wording update.

## Out of Scope
- Relaxing or removing target guards.
- Automatically rerunning mutating commands after ACTIVE_FLOW_MISMATCH.
- Automatically adopting a different Issue, spec, worktree, branch, or runId target.
- Redesigning direct Flow state machines.
- Redesigning finalize-cleanup state-machine safety.
- Splitting Issue #483 into another spec.

## Constraints
- Use only Node.js built-in modules; do not add external dependencies.
- Represent FlowTargetBinding and other meaningful target values as classes with constructor invariants and behavior, not object-literal pseudo-unions.
- Keep target identity validation inside senti CLI mechanisms; do not depend on Codex hooks, Claude hooks, IDE callbacks, or any agent-host lifecycle feature.
- Do not keep deprecated public targetGuardArgs or read-only transcription recovery behavior as compatibility surfaces after the binding contract replaces them.
- All target-sensitive Flow commands that accept guards must continue to fail closed before side effects when the supplied or serialized binding no longer matches the active authority.
- For a managed-worktree Flow, process-owned coordination locks are rooted in the canonical main repository authority while target-sensitive artifacts remain rooted in the bound worktree.
- Provider recovery must be provider-neutral and digest-bound; do not special-case a provider, Issue number, spec directory, or artifact filename.
- no-sensitive-data-in-logs guardrail acknowledgement: dispatcher executionEnvironment values may be passed directly to the spawned worker process environment, but they must not be logged or serialized into Flow artifacts.
- Do not change src/skills/senti.flow/SKILL.md unless the CLI-side directive contract alone cannot remove the agent-side guard transcription requirement; if changed, run senti upgrade and include generated skill regression coverage.
- Do not edit spec.md in this phase; spec.json remains the source of truth.

## Design Principles
- Make the CLI the owner of target identity, command guard generation, and target mismatch validation.
- Preserve existing fail-closed safety while eliminating agent string transcription as an execution prerequisite.
- Verify migration parity through behavior-level tests for each retained public surface.

## Overview
### Modules
- src/lib/flow-target-guard.js provides target identity value classes and ACTIVE_FLOW_MISMATCH envelope construction before side effects.
- src/lib/flow-manager.js resolves active and explicit Flow targets, including managed worktree and branch authority.
- src/flow/lib/next-action-directive.js serializes the single next action and exposes CLI-generated target-sensitive commands from a binding-owned target.
- src/flow/lib/run-dispatch.js delegates one non-terminal Flow action to the worker using the CLI-provided directive or command and refreshes authority after completion.
- src/lib/flow-target-guard.js now owns immutable FlowTargetBinding and mode-specific execution-authority value classes.
- FlowTargetBinding command serialization and provider-neutral dispatcher execution environment
- src/lib/flow-target-guard.js now validates opaque FlowTargetBinding authority in the generic target mismatch envelope and exposes shared exact-guard requirement detection.
- src/flow/registry.js accepts --expect-binding through common target guard options so binding-generated commands parse across retained target-sensitive commands.
- Repair commands reopen-draft, rewind-test-evidence, recover-existing-implementation, and recover-review-pass share exact-guard recognition for FlowTargetBinding.
- src/lib/flow-manager.js: ResolvedFlowTarget now carries main-root and authority-root data so explicit target resolution and resume paths can validate opaque FlowTargetBinding authority before selecting or continuing a target.
- Spec-local coverage under specs/482-cli-target-binding/tests now pins binding command serialization, authority mismatch behavior, no-Issue and target selection regressions, managed-worktree lock authority, provider-recovery digest scoping, and the retired public transcription contract.
- src/flow/lib/run-dispatch.js resolves dispatcher lease ownership from FlowTargetBinding.dispatchLockRoot so managed-worktree dispatch coordination uses the canonical main repository authority.
- src/flow/lib/review-convergence.js expands ReviewRecoveryIdentity to include runId, Issue/no-Issue, spec, phase/task, tree SHA, target-state digest, target binding digest, and dispatcher invocation scope.
- src/flow/lib/set-retry.js propagates binding digest data into review retry recovery receipts when a guarded binding command is used.

### Data Flow
- A normal Flow command resolves the active target authority from flow state, explicit guards, and worktree or branch metadata.
- The CLI constructs a FlowTargetBinding that contains the canonical runId, Issue/no-Issue identity, spec path, and managed worktree or branch authority for that active target.
- Next-action and dispatcher responses serialize target-sensitive work from the binding, so the consumer executes the returned directive or command without reconstructing guard arguments.
- Before each target-sensitive side effect, the CLI compares the binding against the current authority and returns ACTIVE_FLOW_MISMATCH before mutation when any identity field differs.
- After a worker action, the dispatcher refreshes next-action from the CLI authority rather than trusting stale prompt text.
- When a planning correction changes canonical review input, the CLI compares the persisted convergence record with the refreshed binding and target-state digest before deciding whether an old blocker still applies.
- Flow state and resolved repository authority are captured into a canonical binding whose opaque serialization, digest, guarded command, and pre-mutation comparison are owned by the binding.
- next-action captures one FlowTargetBinding, serializes it into executable directives, and the dispatcher passes the same opaque binding to its worker environment
- Dispatcher and FlowCommand pre-execution guard paths pass resolved mainRoot/authorityRoot/worktreePath into targetMismatchEnvelopeForInput before lifecycle hooks or command bodies mutate state.
- Explicit target resolution derives runId, spec, and Issue/no-Issue selection from --expect-binding when separate guard flags are absent.
- Explicit target selection builds authority-aware ResolvedFlowTarget candidates from active-flow registry entries and preparing flows; binding-backed expectations are matched against current runId, Issue/no-Issue, spec, and authority before a unique target is returned.
- Shared directive and skill-prelude regression tests now expect CLI-owned opaque --expect-binding commands for normal dispatcher continuation instead of agent-assembled runId, Issue, or spec guard strings.
- Dispatcher acquisition captures the current FlowTargetBinding before lease creation; worker artifact mutations still execute in the bound worktree while the process-owned dispatch lock is rooted in the binding authority main root.
- Review action resolution compares the persisted record with the current canonical review-input digest and optional binding digest before reusing an exhausted provider blocker.
- Review retry reset persists recovered convergence records with refreshed target-state digest and binding receipt data, allowing unchanged input to get one same-binding recovery while changed input invalidates old blockers.

### Decisions
- [VERIFY] checked draft policy: src/lib/flow-target-guard.js owns FlowTargetExpectation for runId, Issue/no-Issue, and spec mismatch data; result=match.
- [VERIFY] checked draft policy: src/lib/flow-manager.js resolves explicit targets and managed worktree authority; result=match.
- [VERIFY] checked draft policy: next-action currently derives guarded command text from state rather than a binding object; result=match.
- [VERIFY] checked draft policy: dispatcher worker prompt still receives target guard strings; result=match.
- The existing read-only status transcription recovery is removed as a user-visible contract or converted to an internal bridge; final behavior must not require agent retyping of target identity.
- Skill source updates are conditional, not mandatory.
- [VERIFY] managed-worktree command authority must be independent of invocation root.
- [VERIFY] review blockers must be scoped to current canonical review input.
- For a non-worktree branch Flow, branch authority is the tuple of active-flow mode=branch, canonical main-repository execution root, flowState.featureBranch, and flowState.baseBranch; moving Git ref OIDs and process HEAD are lifecycle state, not binding identity.
- Branch/local authority binds stable mode, canonical main/execution roots, featureBranch, and baseBranch; managed worktree authority binds canonical main and owned worktree roots, while moving Git refs remain lifecycle state.
- Workers no longer assemble runId, Issue, or spec guards; CLI-owned binding data is the sole production command authority
- Preserve old explicit guard behavior while allowing one CLI-generated binding token to satisfy exact-target repair contracts.
- Do not retry after ACTIVE_FLOW_MISMATCH; stale bindings fail closed before side effects.
- Kept the T-4 implementation scoped to flow-manager target resolution instead of changing directive or guard serialization; no-Issue, missing, ambiguous, worktree, branch, and resume behavior now share the same authority-aware matching path.
- T-5 changed skill source wording to remove the public runId transcription recovery contract; senti upgrade was attempted but could not complete because the sandbox cannot resolve github.com for the official presets clone.
- Provider recovery remains provider-neutral: reuse is keyed by binding and canonical target-state identity rather than provider name, Issue number, spec directory, or artifact filename.
- Changed canonical review input drops stale tooling outcomes and blockers instead of carrying an exhausted provider blocker forward.

## Clarifications (Q&A)
- Q: Should the target binding scope be limited to dispatcher prompt wording?
  - A: No. The binding covers normal Flow dispatcher and next-action target-sensitive actions so the CLI, not the agent, owns target identity across the continuation path.
- Q: Should read-only status transcription recovery remain a documented public behavior after binding migration?
  - A: No. It may exist only as a short internal bridge during implementation. Final user-visible behavior relies on CLI-owned binding and authority validation.
- Q: Is skill source modification required?
  - A: No. It is conditional on whether CLI directive changes alone can remove the agent-side guard transcription contract.
- Q: May main-repository and managed-worktree invocations use different coordination authority for the same Flow?
  - A: No. They must resolve the same FlowTargetBinding and canonical main-repository lock authority; differing target metadata is an ACTIVE_FLOW_MISMATCH, not a new target-selection opportunity.
- Q: May an exhausted provider blocker be reused after planning input changes?
  - A: Only when its binding and canonical target-state digest still match. A changed review-input digest invalidates the old blocker; unchanged input may receive one audited same-binding retry per fresh dispatcher invocation.
- Q: What is the canonical authority for a normal non-worktree branch Flow?
  - A: The active-flow entry must remain mode=branch, execution must resolve to the same realpath-normalized main repository, and flowState.featureBranch/baseBranch must match the binding. Ref OIDs can advance during normal commits and process HEAD changes during finalize, so those remain lifecycle checks rather than immutable binding fields.

## Alternatives Considered
- Only adjust worker prompt wording to emphasize copying exact target guards. — Rejected because it keeps Flow continuation dependent on agent string transcription and does not eliminate the Issue #483 typo path.
- Automatically retry mutating commands after ACTIVE_FLOW_MISMATCH using refreshed status. — Rejected because Issue #483 explicitly preserves fail-closed mismatch behavior and excludes automatic retries against a different target.
- Keep read-only status transcription recovery as a public compatibility surface. — Rejected because the project alpha policy removes deprecated paths and the binding migration should not preserve agent-side transcription as a required recovery contract.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-31T04:02:22.177Z
- Notes: Approved by user after spec-review repair and spec-gate PASS.

## Requirements
- R1 [must]: Add a CLI-owned FlowTargetBinding class that stores canonical runId, Issue identity as either a positive issue number or explicit no-Issue, canonical spec path in specs/<specId>/spec.json form, and authority for the active normal Flow target. Managed-worktree authority uses the owned worktree identity; non-worktree branch authority is active-flow mode=branch plus the canonical main-repository execution root and flowState.featureBranch/baseBranch.
- R2 [must]: FlowTargetBinding construction must verify that runId equals the active flow runId, Issue/no-Issue equals the active flow Issue state, spec path equals the active flow canonical spec path, and target authority equals the active Flow authority before the binding can generate a target-sensitive command or directive. For a non-worktree branch Flow this comparison covers registry mode=branch, realpath-normalized main-repository execution root, flowState.featureBranch, and flowState.baseBranch; it does not freeze moving ref OIDs or process HEAD.
- R3 [must]: next-action and dispatcher outputs for target-sensitive normal Flow actions must derive guard arguments or executable command text from FlowTargetBinding, and must not require the worker or skill to re-enter runId, Issue, or spec strings.
- R4 [must]: Before each target-sensitive side effect in normal Flow dispatcher execution and the retained gate, set, reopen-draft, rewind-test-evidence, recover-existing-implementation, recover-review-pass, finalize, and finalize-cleanup command paths, the CLI must compare the binding against the current active authority and return ACTIVE_FLOW_MISMATCH without mutating artifacts when runId, Issue/no-Issue, spec, managed-worktree authority, or the branch authority tuple of registry mode, canonical main-repository execution root, featureBranch, and baseBranch differs.
- R5 [must]: A command generated from a FlowTargetBinding in a dispatcher invocation must proceed past target validation when the current flow.json runId, Issue/no-Issue, spec path, and managed-worktree authority or defined branch authority tuple still equal the binding values; normal commits that advance the bound feature ref must not invalidate the binding.
- R6 [must]: Dispatcher resume and context-compaction recovery paths must reacquire the active target authority from CLI state and reconstruct or validate FlowTargetBinding before issuing the next target-sensitive directive.
- R7 [must]: Remove targetGuardArgs as a public worker prompt contract, or keep it only as an internal implementation detail generated from FlowTargetBinding with no requirement for agent-side string transcription.
- R8 [must]: Preserve no-Issue flow behavior: a binding for an active no-Issue flow must serialize an explicit no-Issue identity and must fail with ACTIVE_FLOW_MISMATCH if the active flow later has an Issue number.
- R9 [must]: Preserve multiple-target and missing-target behavior: explicit target selection must resolve exactly one active Flow before binding construction, and zero or multiple matches must stop without mutating Flow artifacts.
- R10 [must]: Preserve finalize-cleanup boundary behavior without redesign: binding validation must not allow cleanup, finalize, or post-finalize transitions to run with a different registry mode, execution root, featureBranch, or baseBranch, while existing finalize logic remains responsible for lifecycle-specific ref OID and HEAD checks.
- R11 [should]: If src/skills/senti.flow/SKILL.md changes, generated skill artifacts must be refreshed with senti upgrade and tests must cover that workers execute CLI-returned directives or commands as-is.
- R12 [must]: For a managed-worktree Flow, the same explicit runId, Issue/no-Issue, and spec selection invoked from the canonical main repository or the bound worktree must resolve one FlowTargetBinding; process-owned dispatcher locks must use the canonical main-repository lock authority, and any conflicting worktree binding must return ACTIVE_FLOW_MISMATCH before mutation.
- R13 [must]: Review convergence and provider-recovery decisions must validate the current FlowTargetBinding and canonical target-state digest before reusing an exhausted blocker; an authorized draft/spec correction that changes canonical review input must make the old blocker inapplicable, while a fresh retry for unchanged input must be represented by a single audited, same-binding recovery receipt.

## Acceptance Criteria
- For R1 and R2, unit tests construct FlowTargetBinding from matching active Flow state and reject mismatched runId, Issue/no-Issue, spec path, and worktree or branch authority with deterministic error data.
- For R3 and R7, next-action or dispatcher serialization tests show target-sensitive directives/commands are produced from FlowTargetBinding and the worker prompt no longer asks the agent to assemble runId, Issue, or spec guard strings.
- For R4, behavior-level tests cover at least one mutating gate command, one set command, one dispatcher-owned target-sensitive command, and the reopen-draft repair command returning ACTIVE_FLOW_MISMATCH before artifact mutation when the binding is stale or mismatched; focused tests cover the remaining named repair and finalization paths through their shared binding guard.
- For R5, a dispatcher test runs a CLI-generated binding command with unchanged active authority and asserts the command advances to the expected next Flow state instead of ACTIVE_FLOW_MISMATCH.
- For R6, a resume or simulated context-compaction test reloads authority from stored Flow state, regenerates or validates the binding, and continues the next target-sensitive action without agent-provided guard reconstruction.
- For R8, a no-Issue regression asserts the binding emits explicit no-Issue identity and rejects a later Issue-bearing active target before mutation.
- For R9, multiple-target and missing-target regressions assert no Flow artifacts change when target resolution produces zero or more than one matching active Flow.
- For R10, finalize or cleanup boundary regression asserts a mismatched binding returns ACTIVE_FLOW_MISMATCH before cleanup/finalize side effects.
- For R1, R2, R4, R5, and R10 branch-mode tests bind registry mode=branch, canonical main-repository execution root, featureBranch, and baseBranch; each identity-field mismatch fails before mutation, while a feature ref advance under the unchanged tuple remains valid and existing finalize ref/HEAD checks still run.
- For R12, one E2E fixture invokes guarded status and dispatcher acquisition from both the canonical main repository and its managed worktree and asserts they resolve the same runId/spec/Issue binding and the same main-root lock authority; a conflicting worktree binding fails before artifact mutation.
- For R13, convergence tests prove that a changed canonical review-input digest invalidates an old exhausted provider blocker, and that unchanged input receives at most one audited provider-recovery receipt per fresh dispatcher invocation without provider- or spec-specific branching.
- Spec-local tests under specs/482-cli-target-binding/tests/ include // spec: R<N> headers for the new behavior they cover; shared tests under tests/ may be updated for production contract changes but do not replace spec-local coverage.
- If the skill source changes, senti upgrade is run and regression output includes generated skill or skill-prelude coverage.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add FlowTargetBinding
  - Introduce the CLI-owned binding value class and invariants for normal Flow target identity.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Bind directives
  - Make next-action and dispatcher target-sensitive outputs derive their executable guard data from FlowTargetBinding.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Guard side effects
  - Ensure all retained target-sensitive side effects validate the binding against current authority immediately before mutation.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Preserve target selection
  - Keep no-Issue, multiple target, missing target, worktree authority, branch authority, and dispatcher resume behavior under the binding model.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add spec coverage
  - Provide spec-local and shared regression tests that prove the binding migration preserves safety and removes transcription dependence.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Bind coordination recovery
  - Unify managed-worktree coordination authority and make review recovery decisions depend on the current binding and canonical review-input digest.
  - see `tasks/T-6.md` for full spec
