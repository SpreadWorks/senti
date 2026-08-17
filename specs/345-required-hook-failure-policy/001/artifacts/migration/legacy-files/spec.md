# Feature Specification: 345-required-hook-failure-policy

**Feature Branch**: `feature/345-required-hook-failure-policy`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #469

## Goal
Define explicit required/advisory failure policies for flow command hooks so required business failures stop their caller before prepare writes flow/spec/draft/artifact files or finalize-cleanup creates transactions, commits, removes worktrees, deletes branches, writes completion pointers, or clears active state; advisory failures retain warnings, issue-log entries, and follow-ups without stopping the main command.

## Background
Flow command hooks currently have no explicit failure policy. The shared runner normalizes hook throws and failed envelopes into warnings and always reports success, while finalize-cleanup later treats one generic warning code as fatal. That splits fail-open and fail-closed behavior between an implicit runner default and command-specific warning interpretation. Required integration failures can therefore leave a command successful or allow partial lifecycle effects. This spec makes the policy part of the registered and persisted hook contract, gives callers a typed execution result, and puts stop/continue behavior at one boundary.

## Scope
- Flow command hook discovery, registration, persisted snapshots, runtime execution outcomes, and lifecycle caller failure handling.
- The `prepare` and `finalize-cleanup` lifecycle paths that call `runFlowCommandWithPluginLifecycle`.
- Unit, command-level, and spec-local tests for required/advisory failure behavior and byte/Git-state preservation of the enumerated prepare and finalize-cleanup surfaces.

## Out of Scope
- Legacy shell hooks in `src/lib/hooks.js`.
- A general redesign of plugin commands, workflow artifact schemas, or the board API.
- External dependencies, compatibility shims, publication, or release work.

## Constraints
- Use Node.js built-in modules only and follow existing flow-envelope, plugin registry, lifecycle, and test patterns.
- Represent the hook failure policy, snapshot value, and execution outcome with dedicated classes that enforce their invariants; do not introduce object-literal discriminated unions for these values.
- Keep runtime integrity failures—module import failure, invalid `register(api)`, invalid `FlowCommandHook` inheritance, and snapshot metadata mismatch—as hard failures regardless of policy.
- Do not alter legacy shell-hook behavior or add project- or environment-specific values under `src/`.

## Design Principles
- Make the runner, rather than individual callers, the single authority for classifying hook business failures.
- Separate advisory business-failure reporting from required failure propagation without weakening integrity validation.
- Perform required failure checks before prepare writes its spec/draft/flow-state files or plugin artifact directory, and before finalize-cleanup creates a teardown transaction, commits completion, removes a worktree, deletes a branch, writes the completion pointer, or clears active flow state.
- Preserve retained successful and advisory lifecycle behavior through behavior-level tests.

## Overview
### Modules
- `src/lib/plugin-registry.js` validates hook classes and snapshots, discovers hook plans, executes hooks, and composes the pre/main/post lifecycle result. It becomes the owner of policy validation and typed hook execution outcomes.
- `src/flow/lib/run-prepare-spec.js` and `src/flow/lib/run-finalize-cleanup.js` consume lifecycle outcomes. They must stop on required failure before prepare writes flow/spec/draft/artifact paths or finalize-cleanup creates transactions, commits, removes worktrees, deletes branches, writes completion pointers, or clears active state; they continue only advisory failures with reported data.
- Existing plugin-registry fixtures, lifecycle command tests, and spec-local tests provide the failure matrix plus byte comparisons for prepare files and Git/state comparisons for finalize-cleanup.
- plugin-registry owns failure-policy validation and typed lifecycle outcomes.
- The lifecycle wrapper consumes typed hook outcomes and owns required/advisory control flow.
- Prepare and finalize-cleanup consume structured hook outcomes before any durable lifecycle work; finalize pre-hook failures remove hook artifacts and leave teardown authority untouched.

### Data Flow
- Hook discovery validates each class, including a required policy, and records that policy in the flow command hook snapshot with plugin ID, module, command, hook, class name, and priority.
- At runtime, snapshot loading validates the same policy and integrity metadata before a hook runs. The runner returns typed outcomes that distinguish success, advisory business failure, required business failure, and integrity failure.
- The lifecycle wrapper stops before `main()` when a required pre-hook fails and does not return a success envelope. Advisory failures are accumulated as warnings, issue-log candidates, and follow-ups while the lifecycle continues.
- Prepare and finalize-cleanup consume the structured outcome directly. Finalize-cleanup no longer scans `PLUGIN_HOOK_FAILED` warnings to decide whether to fail; a required outcome prevents teardown transaction work.
- Discovery snapshots required/advisory policy and runtime rejects invalid snapshot policy before hook execution.
- Required pre outcomes return before main; required post outcomes fail the caller while retaining main data; advisory outcomes retain reporting.
- Finalize-cleanup executes required pre-hooks before metadata synchronization and transaction creation, then uses the typed post-hook outcome instead of warning-code reinterpretation.

### Decisions
- [VERIFY] checked the existing runner; result=match: `runFlowCommandHooks` currently catches hook throw and `ok:false`, adds `PLUGIN_HOOK_FAILED`, and returns `ok: true`, so policy ownership must move into this shared runner.
- [VERIFY] checked snapshot integrity; result=match: class name, command, hook, and priority are validated both at discovery and runtime, so policy must join this same registration/snapshot contract.
- [CORRECTION] checked finalize-cleanup failure ownership; replace its generic warning scan with the lifecycle runner's structured required failure outcome before teardown begins.
- Migration parity mapping: discovery and snapshot policy validation remain owned by plugin-registry. Successful hook data/follow-ups and advisory warning/issue-log/follow-up reporting remain owned by the typed runner outcome and lifecycle wrapper. Plugin artifact read/write remains owned by artifact helpers invoked by hooks.
- Migration parity mapping: prepare/finalize-cleanup stop decisions move to structured required outcomes consumed by their lifecycle callers. The finalize-cleanup `PLUGIN_HOOK_FAILED` warning scan is intentionally removed and has no replacement warning-inference owner. Import, registration, inheritance, and snapshot integrity failures remain owned by loader validation.
- Required business failures stop the lifecycle in the shared runner; integrity failures remain thrown validation errors.
- Business failure policy is enforced once in the shared lifecycle wrapper rather than inferred by callers from warnings.
- Required pre-hook failure is handled at each lifecycle boundary before durable prepare or finalize-cleanup effects; finalize does not infer severity from PLUGIN_HOOK_FAILED warnings.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Keep the runner fail-open and let each caller reinterpret `PLUGIN_HOOK_FAILED` warnings. — Rejected because severity remains implicit, callers can disagree, and required failures can be reported as success.
- Make every hook failure fatal without a policy field. — Rejected because advisory integrations must retain their warning, issue-log, and follow-up behavior while allowing the main command to continue.
- Treat integrity failures as advisory when the policy is advisory. — Rejected because a broken module, registration contract, inheritance contract, or snapshot cannot be trusted as a business-level advisory result.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T14:20:46.617Z
- Notes: Auto-approved from the accepted preflight scope after spec gate PASS.

## Requirements
- R1 [must]: Every discovered flow command hook and every persisted `plugins.flowCommandHooks` snapshot entry shall contain one failure policy with the exact value `required` or `advisory`. Registration and snapshot loading shall reject a missing or unknown policy before hook execution.
- R2 [must]: The hook runner shall return a typed execution outcome that classifies hook success, advisory business failure, required business failure, and runtime integrity failure. Callers shall consume this outcome instead of inferring severity by scanning generic warning codes.
- R3 [must]: For a `required` hook, a thrown `run()` error, an `ok:false` envelope, a malformed or non-envelope result, or an artifact write failure shall produce a typed caller failure and shall not be converted into `ok:true`, warning-only, or follow-up-only success.
- R4 [must]: For an `advisory` hook, the same business-failure categories may preserve warning, issue-log, and follow-up information while allowing the lifecycle main command to continue. A successful advisory or required hook shall preserve its hook data and follow-ups.
- R5 [must]: Import failure, invalid `register(api)`, invalid `FlowCommandHook` inheritance, missing snapshot module, and snapshot metadata mismatch shall remain hard failures regardless of the hook policy and shall not be normalized as advisory business failures.
- R6 [must]: A required pre-hook failure shall stop the applicable lifecycle command before it returns a success envelope: prepare shall not create or modify its spec source, draft, flow state, issue-log, or plugin artifact files; finalize-cleanup shall not create a teardown transaction, create a finalize commit, remove its worktree, delete its feature branch, write `.senti/last-finalized-spec`, or clear active flow state.
- R7 [must]: `run-prepare-spec` and `run-finalize-cleanup` shall use the structured runner outcome. Finalize-cleanup shall remove its `PLUGIN_HOOK_FAILED` warning reinterpretation path and shall not start teardown work after a required lifecycle failure.
- R8 [must]: Tests shall cover the required/advisory matrix for success, throw, `ok:false`, malformed result, and artifact write failure; registration/snapshot policy rejection; integrity hard failures; retained advisory behavior; and command-level atomicity for prepare and finalize-cleanup.

## Acceptance Criteria
- AC1: Hook registration and snapshot tests reject omitted and unknown policies, and accepted snapshots record exactly `required` or `advisory` with the existing hook metadata.
- AC2: Unit tests show `required` hooks return typed caller failure for throw, `ok:false`, malformed result, and artifact write failure; none returns `ok:true` or warning-only continuation.
- AC3: Unit tests show advisory failures retain warning, issue-log, and follow-up information while successful main execution continues; successful hooks retain hook data and follow-ups for both policies.
- AC4: Tests show import, registration, inheritance, missing-module, and snapshot-metadata failures stop execution for both policies without advisory normalization.
- AC5: Prepare command tests compare byte-for-byte pre/post snapshots of the target flow state, issue-log, spec/draft files, and plugin artifact directory; a required failure creates no new file and changes no existing byte in those surfaces.
- AC6: Finalize-cleanup command tests show a required hook failure occurs before teardown transaction, commit, worktree removal, branch deletion, completion pointer, and active-flow cleanup effects; advisory behavior follows its retained reporting path.
- AC7: Finalize-cleanup tests prove it no longer scans `PLUGIN_HOOK_FAILED` warnings to choose fatal behavior and instead uses the structured lifecycle outcome.
- AC8: Spec-local tests under `specs/345-required-hook-failure-policy/tests/` contain `// spec: R<N>` headers covering R1-R8; affected shared regression suites are included in the final project regression, and `npm test` passes at final-regression.

## Implementation Targets
- src/lib/plugin-registry.js
- src/flow/lib/run-prepare-spec.js
- src/flow/lib/run-finalize-cleanup.js
- tests/unit/lib/plugin-registry.test.js
- tests/unit/flow/run-prepare-spec.test.js
- tests/unit/flow/run-finalize-cleanup.test.js
- specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define hook failure policy contract
  - Add a validated required/advisory policy to flow command hook registration and persisted snapshots. Define typed hook execution outcomes that distinguish policy-governed business failures from integrity failures.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Propagate lifecycle hook outcomes
  - Make the shared pre/main/post lifecycle wrapper stop required failures and continue advisory failures with their reporting data.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Apply policy to lifecycle callers
  - Replace caller-specific warning severity inference with structured outcomes in prepare and finalize-cleanup, and prove required failures are atomic at command level.
  - see `tasks/T-3.md` for full spec
