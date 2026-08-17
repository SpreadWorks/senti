# Feature Specification: 333-failure-atomic-gate

**Feature Branch**: `feature/333-failure-atomic-gate`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #456

## Goal
Make inferred gate phase transitions failure-atomic so validation, agent, or artifact persistence failures leave the durable flow state unchanged while completed evaluations commit the intended transition exactly once, preserve the parked-resume no-discovery guarantee in shared CLI help, and reconcile this flow's audited repair fingerprint history without rewriting existing ledger entries.

## Background
When phase is inferred from multiple in-progress gate steps, the command currently marks earlier stale steps done and marks the selected owner in progress before the phase-specific gate path validates inputs, calls the agent, or completes required persistence. A later error therefore leaves durable state from an execution that never reached its commit boundary. Retries then observe mutated phase state, and the existing test codifies this partial mutation. This change retains inference precedence and semantic judgment behavior while moving durable transitions to an explicit post-persistence commit. Final regression also exposed that shared help renders only the first flow command summary line, which omitted the existing statement that parked resume performs no discovery. During audited operational recovery, the repair fingerprint manifest advanced beyond the internally continuous five-entry ledger; the normal impl-repair append correctly rejects that discontinuity, so this flow needs one explicit history-preserving bridge before it can resume.

## Scope
- Separate gate phase resolution from durable step mutation in `src/flow/lib/run-gate.js`.
- Represent the inferred stale-step recovery and active gate ownership as an explicit transition value that can be committed only at the successful boundary.
- Commit inferred transitions only after structural validation, agent evaluation, and required gate artifact persistence complete.
- Cover validation, agent, and artifact-write failures with before/after state snapshots and a bounded one-failure/one-retry assertion for each boundary.
- Preserve valid semantic PASS/FAIL behavior while preventing duplicate transitions, findings, and artifacts.
- Keep the parked-resume no-discovery guarantee visible when `senti flow resume --help` is rendered through shared command metadata.
- Append one identity-bound reconciliation bridge from the existing impl-repair ledger tail to the current repair fingerprint manifest while preserving every existing ledger entry.

## Out of Scope
- Changing gate judgment criteria, guardrail content, semantic retry budgets, or dispatcher routing.
- Changing phase inference precedence or the set of steps reported as stale.
- Changing flow commands other than the parked-resume help summary, or adding a repository-wide transaction framework.
- Adding external dependencies, compatibility shims for partial mutation, public CLI options, publish, or release work.

## Constraints
- Use only Node.js built-in modules and existing FlowManager, lifecycle transition, GateMutationOwner, envelope, and artifact patterns.
- Keep gate transition orchestration within `src/flow/lib/run-gate.js`; `GateMutationOwner` may own the task-aware transition-status capture and revalidation needed by that orchestration, while the regression repair in `src/flow/registry.js` remains limited to the parked-resume help summary.
- Represent the staged transition as a dedicated class whose constructor validates the inferred phase, pre-transition state, stale step IDs, and target gate owner.
- Do not mutate flow state, write findings, emit committed-transition diagnostics, or persist gate artifacts while constructing or validating the transition value.
- A structural validation error, agent exception/protocol failure, or artifact-write failure shall leave durable step state byte-identical to the pre-transition snapshot.
- A completed valid semantic PASS or FAIL evaluation with successfully persisted required artifacts may commit the inferred recovery transition once; existing PASS/FAIL routing remains unchanged.
- Each fault-injection retry scenario is bounded to two command attempts: one injected failure followed by one retry after removing the fault; production retry budgeting remains owned by the existing dispatcher definition.
- Replace tests that expect partial mutation with failure-atomic assertions; do not weaken valid scenarios or alter unrelated test expectations.
- Run targeted gate phase-inference tests, dispatcher help E2E tests, and `node tests/run.js` without adding dependencies.
- The repair-ledger reconciliation shall bind the exact run, spec, Issue, preexisting ledger tail, current manifest hash, changed-path inventory, and delta digest; any mismatch shall fail before writing.
- `code-placement` acknowledged one-time migration exception: the exact run/spec/Issue authority is project-specific and therefore shall remain in this spec directory rather than distributed under `src/`; the spec-local adapter may compose the existing typed ledger and fingerprint owners but shall not change their schemas or add a public command.

## Design Principles
- Resolve first, evaluate second, persist artifacts third, and commit lifecycle state last.
- Model a pending transition as data with invariants rather than as an eager side effect.
- Use one explicit commit owner and make repeated commit attempts idempotent or fail closed before duplicate effects.
- Treat recovery from multiple in-progress gate steps as an auditable transition, not an inference-time completion.
- Preserve semantic PASS/FAIL behavior and change only the failure-atomicity boundary.
- Preserve audit history by appending a verified bridge; never delete, regenerate, reorder, or rewrite existing repair entries.

## Overview
### Modules
- `src/flow/lib/run-gate.js` resolves the effective phase, builds a validated pending gate transition, executes the existing gate pipeline, and commits the transition only after required persistence succeeds.
- `tests/unit/flow/gate-phase-inference.test.js` verifies pure inference, boundary failure isolation, successful exactly-once commit, and retry behavior.
- `src/flow/registry.js` supplies the parked-resume summary consumed by shared help, including the no-discovery guarantee.
- Spec-local tests provide fault-injection evidence for validation, agent, and artifact-write boundaries without depending on external services.
- `src/flow/lib/run-gate.js` now owns a validated `InferredGateTransition` that stages stale-step recovery and selected gate ownership without mutating durable state.
- Spec-local repair ledger and delta artifacts record the one-time, identity-bound bridge needed to resume this flow without changing product command scope.

### Data Flow
- The command resolves the effective phase and stale step IDs from the invocation state, then constructs a pending transition without calling FlowManager mutation methods.
- The existing phase-specific gate path performs structural validation and obtains a valid semantic PASS/FAIL judgment. Tooling or validation failures return or throw before commit.
- Required gate artifacts are persisted. If persistence fails, the pending transition is discarded and the durable flow state remains equal to the invocation snapshot.
- After successful persistence, one commit applies the stale-step recovery and target gate transition through existing lifecycle ownership. Retrying a failed attempt starts from the unchanged original state and produces no duplicate durable effects.
- Inferred gate execution resolves and validates a pending transition, completes semantic evaluation, persists required integration evidence, and only then commits lifecycle recovery.
- Shared help extracts the first non-usage line from the flow registry entry, so the parked-resume safety guarantee is present in that summary line.
- The reconciliation validates the existing ledger tail and current manifest authority, appends one bridge entry and matching delta, and leaves all preexisting entries unchanged; a mismatch produces no ledger write.

### Decisions
- [VERIFY] checked eager phase inference in `RunGateCommand.execute`; result=match: stale steps and the selected gate owner are mutated before phase-specific validation and evaluation run.
- [VERIFY] checked current regression expectation; result=match: the phase-inference test accepts downstream throw/FAIL and still requires the stale spec gate to have transitioned to done.
- [VERIFY] checked lifecycle ownership; result=match: `GateMutationOwner` already creates definition-aware transitions and owns the route options for the selected gate step.
- Use a dedicated pending transition class in the gate module so construction is pure, invariants are enforced once, and durable mutation belongs to a single explicit commit operation.
- Migration inventory: `senti flow run gate`, its `--phase` input, RunGateCommand exports, registry gate pre/post/onError hooks, and existing configuration keys are retained with no rename, removal, or new public surface.
- Migration owner map: RunGateCommand retains phase selection and PASS/FAIL envelopes; existing gate artifact writers retain source/result artifacts; registry hooks retain retry, issue-log, side-effect, and routing ownership; GateMutationOwner retains selected-step lifecycle writes.
- Explicit removal: inference-time stale-step completion and selected-owner mutation before evaluation are replaced by a pending transition committed after artifact persistence. Failed attempts retain the original active state; no compatibility path, duplicate legacy artifact, config flag, or hook is added.
- Mechanical validation, agent/protocol exceptions, and artifact persistence failures return or throw before inferred lifecycle commit; explicit-phase persistence behavior remains unchanged.
- [VERIFY] checked shared help extraction and parked-resume help output; result=match: shared metadata keeps only the first descriptive line, while the original no-discovery statement was on a later line.
- [VERIFY] checked repair history; result=match: repair-001 through repair-005 are internally continuous, but the ledger tail does not equal the current manifest hash, so ordinary append fails closed.
- The applied repair-006 bridge preserves the first five ledger entries byte-equivalently and binds the active flow identity plus the edfb1316… → 704826e3… hash transition to delta digest 50a11da1….

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Keep eager inference mutation and roll it back in catch/finally handlers. — Rejected because every validation, provider, persistence, and future return path would need correct compensation, and rollback itself can fail after partial durability.
- Stop resolving stale gate steps and leave all in-progress steps unchanged after successful evaluation. — Rejected because it removes the existing recovery intent and leaves ambiguous phase state instead of recording an explicit successful transition.
- Introduce a generic repository-wide transaction manager. — Rejected because Issue #456 concerns one gate transition boundary and existing lifecycle owners already provide the required mutation primitives.
- Preserve the current partial mutation for compatibility. — Rejected because the behavior is the bug, contradicts the failure-atomic invariant, and the project alpha policy forbids compatibility code for retired behavior.
- Revert the parked-resume help correction and record the unrelated regression failure. — Rejected because the user explicitly selected retaining the product fix and regenerating fingerprint-bound evidence.
- Delete or regenerate the existing impl-repair ledger, or roll the manifest back to its last recorded ledger hash. — Rejected because either choice discards audited history or misrepresents the current source fingerprint; the user selected a history-preserving migration.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T00:45:09.620Z
- Notes: Auto-approved for the gate-passed correction that preserves existing repair history and appends one fail-closed R8 bridge, per the user's selected migration policy.

## Requirements
- R1 [must]: Gate phase inference shall return the effective phase, stale step IDs, and selected gate ownership without mutating FlowManager state, flow.json, issue-log, findings, gate artifacts, or diagnostics that claim a committed transition.
- R2 [must]: The inferred lifecycle change shall be represented by a dedicated class that validates one non-empty effective phase, a pre-transition flow-state identity, unique stale step IDs, and the selected GateMutationOwner; constructing and inspecting this value shall be side-effect free.
- R3 [must]: A validation failure, agent execution or output-protocol failure, or required gate artifact-write failure shall occur before transition commit and shall leave persisted step state byte-identical to the pre-transition snapshot, including every stale and selected gate step.
- R4 [must]: After a valid semantic PASS or FAIL judgment and successful required artifact persistence, the pending inferred transition shall commit through existing definition-aware lifecycle ownership exactly once; stale-step recovery shall be recorded as an explicit transition rather than an inferred completion side effect.
- R5 [must]: For each pre-commit failure boundary, a sequence bounded to two command attempts—one injected failure followed by one retry after fault removal—shall begin the retry from the unchanged original step state, create no duplicate lifecycle transitions, findings, successful-judgment issue-log entries, or gate artifacts, and produce one durable result on the retry; production retry limits remain unchanged.
- R6 [must]: Parity tests shall verify this finite inventory: explicit `--phase` selects its supplied phase without inferred recovery; multi-step inference selects integration and reports the earlier spec gate stale; the default RunGateCommand, `resolveEffectiveGatePhase`, and `resolveGateStepId` exports remain importable; the existing config key selects the same provider stub; semantic PASS/FAIL retain their result fields; completed judgments call registry pre/post but not onError while validation, agent, and persistence exceptions call pre/onError but not post; semantic failure consumes one existing retry unit while tooling failure consumes none; existing phase source/result artifact paths remain unchanged; PASS advances to the configured next step while FAIL/retry retains its configured active-step route.
- R7 [must]: Shared help for `senti flow resume --help` shall state that `--parked` restores one exact inactive managed-worktree pointer with no discovery, while retaining existing usage and target-guard option output.
- R8 [must]: This flow's repair fingerprint history shall be reconciled by appending exactly one bridge entry whose previous hash equals the unchanged preexisting ledger tail and whose current hash equals the expected manifest; the authority shall bind the exact run, spec, Issue, changed-path inventory, and delta digest, preserve every earlier entry, and perform no write when any identity, hash, or evidence value differs.

## Acceptance Criteria
- AC1: A phase-inference unit test with `spec-gate` and `impl-gate` both in progress resolves integration and reports `spec-gate` as stale while recording zero FlowManager mutations before evaluation completes.
- AC2: Fault injection at structural validation compares serialized durable flow state before and after the attempt and shows byte-identical stale and selected gate step state.
- AC3: Fault injection at agent execution or output validation shows the same byte-identical flow state and no committed-transition diagnostic, finding, or successful gate artifact.
- AC4: Fault injection at required gate artifact persistence shows byte-identical flow state and leaves no partial or duplicate artifact accepted as successful evidence.
- AC5: A valid semantic PASS path persists required artifacts before applying one explicit stale-step recovery and one selected-owner transition; observing or invoking the commit path again does not duplicate effects.
- AC6: A valid semantic FAIL path preserves existing FAIL envelope, retry accounting, and routing while committing only the lifecycle changes authorized after successful judgment persistence.
- AC7: For each injected boundary, exactly two command attempts are executed: the first fails with unchanged state, and the second runs after fault removal, applies one durable transition, and produces one canonical finding/artifact set with no duplicate entries.
- AC8: Explicit `--phase` invocations and single-step inferred invocations retain existing phase selection and semantic behavior without introducing unrelated lifecycle changes.
- AC9: The obsolete test expectation that a downstream throw/FAIL leaves `spec-gate` done is replaced by an assertion that failed attempts preserve the original in-progress state.
- AC10: Direct-import tests exercise the existing default RunGateCommand export plus `resolveEffectiveGatePhase` and `resolveGateStepId` through explicit, single-step inferred, and multi-step inferred inputs, preserving their input/output behavior except for deferred mutation timing.
- AC11: Registry integration tests show a completed PASS/FAIL result uses the existing gate pre/post path without onError, while an injected validation, agent, or artifact-write exception uses pre/onError without post and leaves inferred step state unchanged.
- AC12: A gate fixture using the existing configuration and container-resolved agent profile reaches the same provider stub and produces the same valid semantic envelope through the deferred-transition path; no new or renamed configuration key is read.
- AC13: Existing phase gate source/result artifact names, issue-log ownership, retry accounting, and routing side effects remain unchanged on completed evaluations; only the eager inference-time step writes and their committed-transition warning timing move.
- AC14: Spec-local tests contain `// spec: R<N>` headers covering R1-R8; targeted gate, dispatcher help, and repair-ledger reconciliation tests pass.
- AC15: `node tests/run.js` exits 0 with zero failing tests after the gate transition, parked-resume help, and repair-ledger reconciliation changes.
- AC16: The first five impl-repair ledger entries are byte-equivalent before and after reconciliation, and the sixth entry links `edfb1316…` to `704826e3…` with one matching `repair-006` delta artifact.
- AC17: The reconciliation authority records run `8aff4832-7b44-4d54-9e37-5e72db35e88e`, Issue 456, the active spec path, both expected hashes, the changed-path inventory, and its digest.
- AC18: A fixture with a different run, spec, Issue, ledger tail, manifest hash, changed path, or delta digest is rejected before changing ledger or delta bytes.

## Implementation Targets
- src/flow/lib/run-gate.js
- src/flow/registry.js
- tests/unit/flow/gate-phase-inference.test.js
- tests/e2e/dispatchers.test.js
- specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
- specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
- specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
- specs/333-failure-atomic-gate/repair-ledger-reconciliation.json
- specs/333-failure-atomic-gate/impl-repair.json
- specs/333-failure-atomic-gate/repair-deltas/repair-006.json

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Make gate inference transitions atomic
  - Stage inferred gate lifecycle changes as a validated value and commit them only after gate evaluation and required persistence complete.
  - see `tasks/T-1.md` for full spec

### Round 1
- **T-2** [pending]: Expose parked resume safety summary
  - Keep the existing no-discovery guarantee visible through the shared help renderer without changing parked-resume behavior or CLI options.
  - see `tasks/T-2.md` for full spec

### Round 2
- **T-3** [pending]: Reconcile repair fingerprint ledger
  - Append one verified bridge from the preserved repair ledger tail to the current manifest so the ordinary impl-repair chain can resume.
  - see `tasks/T-3.md` for full spec
