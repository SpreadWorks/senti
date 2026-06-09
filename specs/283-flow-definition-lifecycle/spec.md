# Feature Specification: 283-flow-definition-lifecycle

**Feature Branch**: `feature/283-flow-definition-lifecycle`
**Created**: 2026-06-08
**Status**: Draft
**Input**: GitHub Issue #370

## Goal
Refactor the SDD flow definition/registry boundary so registry.js remains the CLI command registry while definition-side APIs own lifecycle decisions derived from the flow structure.

## Background
The SDD flow currently has a blurred boundary between definition.js and registry.js. definition.js is the flow blueprint, but it also exposes raw definition data and owns generic steps-array utilities. registry.js is the CLI command registry, but it contains flow lifecycle decisions such as runtime step maps, review status transitions, gate step resolution through registry-side maps, and finalize downstream skip/reset behavior. Issue #370 requests a responsibility cleanup: registry.js remains the command registry, while decisions derivable from the flow definition move to definition-side APIs.

## Scope
- must: Keep registry.js as the CLI command registry while removing direct lifecycle decisions from hooks.
- must: Add definition-side APIs for node lookup, task node lookup, maxAttempts, sideEffects, runtime step resolution, lifecycle resolution, active node lookup, and definition order queries.
- must: Represent lifecycle actions as dedicated classes with constructor-enforced invariants instead of object literal action records.
- must: Move flow.json steps-array-only utilities to a dedicated step-tree module.
- must: Remove raw FLOW_DEFINITION/TASK_DEFINITION exports and update production modules, helper modules, and tests to use APIs or step-tree utilities.
- must: Preserve existing flow CLI command names, options, help text, JSON envelope shapes, step ids, status transitions, and exit behavior.

## Out of Scope
- must: Keep registry.js.
- must: Avoid external dependencies and TypeScript migration.
- must: Avoid backward-compatible aliases for raw definition exports.
- must: Keep complex finalize git, filesystem, metadata, report, and issue-comment side effects in normal handler modules behind lifecycle hook actions.

## Constraints
- Only Node.js built-in modules may be used; no external dependency may be added.
- The alpha policy applies: old raw definition exports must be removed instead of preserved as compatibility aliases.
- Meaningful lifecycle values must be represented by dedicated classes that enforce invariants in constructors.
- No user-facing flow command, option, help text, JSON envelope shape, step id, status transition, or exit-code contract may change unless the spec is reopened and explicitly approved.
- No new CLI command or user-facing argument is introduced by this spec; validate-user-input-at-entry-point and exit-code-contract guardrails are satisfied by preserving existing command entry points.
- Docs are source-generated. Rebuild/update docs only if implementation changes documented flow internals.

## Design Principles
- Keep registry.js deep enough for command metadata and dispatch wiring, but make lifecycle decisions query definition-side APIs.
- Separate data-structure traversal from flow definition knowledge: steps-array utilities belong in a step-tree module, while definition order and lifecycle resolution stay definition-side.
- Use declarative lifecycle action classes for simple status, skip, metric, issue-log, and side-effect decisions; use hook actions as escape hatches for complex execution side effects.
- Make the new boundary visible in tests so raw definition data does not remain an implicit contract.

## Overview
### Modules
- src/flow/definition.js defines flow and task nodes, definition-side query APIs, lifecycle action classes, and lifecycle resolution.
- src/flow/lib/step-tree.js will own utilities that operate only on flow.json steps arrays, such as flattenSteps, findStepById, findFirstPendingLeaf, and findInProgressLeaf.
- src/flow/registry.js remains the flow command registry and delegates lifecycle post/onError decisions through definition-side APIs or shared lifecycle application helpers.
- src/flow/lib/gate-step.js, get-next-action.js, run-gate.js, run-review.js, get-status.js, flow-store.js, flow-manager.js, flow-helpers.js, skill-rules.js, and tests are expected consumers of the new APIs or step-tree utilities.

### Data Flow
- A flow command runs through registry.js, which supplies command metadata and invokes command modules.
- Registry hook connection points call lifecycle application helpers instead of hardcoding phase maps, step ids, or status transitions.
- Definition-side APIs resolve nodes, maxAttempts, sideEffects, runtime log steps, lifecycle actions, and definition order from encapsulated flow/task definitions.
- Step-tree utilities read and mutate flow.json step arrays without importing raw definition data.

### Decisions
- [VERIFY] Checked draft policy: definition.js currently mixes raw definition exports, definition queries, and steps-array utilities; result=match.
- [VERIFY] Checked draft policy: registry.js currently contains lifecycle decisions; result=match.
- Treat every lifecycle leak named in Issue #370 as in scope when the decision is derivable from the definition.
- Use dedicated lifecycle action classes and remove object literal action records from lifecycle definitions.
- Preserve user-visible CLI behavior while changing internal ownership.
- Remove raw definition data as an import contract for production, helpers, and tests.
- [VERIFY] Checked review findings: draft PASS lifecycle includes required empty draft triage/repair artifact generation, and impl review proposals include evidence reset plus downstream step reset.

## Clarifications (Q&A)
- Q: Does this spec remove registry.js?
  - A: No. registry.js remains the CLI command registry and keeps command metadata plus hook connection points.
- Q: Does this spec introduce a new CLI command, option, argument, or exit-code contract?
  - A: No. CLI entry points are preserved; user-facing input validation and exit behavior remain unchanged.
- Q: Do complex finalize git/filesystem/report side effects become declarative lifecycle primitives?
  - A: No. They stay in normal handler modules and are reached through lifecycle hook escape hatches.
- Q: Can old raw definition exports remain as compatibility aliases?
  - A: No. The alpha policy and Issue #370 require removing raw exports rather than preserving aliases.

## Alternatives Considered
- Keep raw FLOW_DEFINITION/TASK_DEFINITION exports during a phased migration. — Rejected because alpha policy prohibits backward-compatible migration aliases and raw exports would keep the old structure as an active contract.
- Move only one registry lifecycle leak in this spec. — Rejected because Issue #370 names the registry/definition boundary as one concern and project rules prohibit splitting the user-defined Issue by default.
- Represent lifecycle actions as object literals with type fields. — Rejected because project rules require OOP-based value representation for meaningful values.
- Push all finalize behavior into declarative lifecycle configuration. — Rejected because Issue #370 explicitly keeps complex git/filesystem/report behavior in normal JavaScript functions behind an escape hatch.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-08T10:31:05.820Z
- Notes: User approved gate-passed spec.

## Requirements
- R1 [must]: definition.js shall stop exporting raw FLOW_DEFINITION and TASK_DEFINITION and instead expose definition-side APIs for node lookup, task node lookup, leaf id collection, phase/action mapping, definition order, active node lookup, maxAttempts, sideEffects, runtime step resolution, and lifecycle resolution.
- R2 [must]: Steps-array-only utilities shall move out of definition.js into a dedicated step-tree module, and all consumers shall import those utilities from the step-tree module.
- R3 [must]: FlowNode or equivalent definition-side node objects shall carry lifecycle behavior using dedicated action classes with constructor-enforced invariants for status transitions, keep-in-progress behavior, metric increments, issue-log appends, side-effect execution, skip behavior, and hook escape hatches.
- R4 [must]: Definition-side lifecycle resolution shall cover review/gate/finalize status transitions, draft PASS empty triage/repair artifact generation, implementation-review proposal evidence reset from test-execute through finalize-cleanup, downstream skip/reset behavior, sideEffects, maxAttempts, and runtime log step resolution for the lifecycle cases named in Issue #370.
- R5 [must]: registry.js hooks shall delegate lifecycle decisions to definition-side APIs or shared lifecycle application helpers and shall not hardcode flow step ids, review phase maps, gate phase maps, or finalize downstream leaf lists for definition-derived decisions.
- R6 [must]: Production modules, helper modules, and tests shall be migrated away from raw definition imports so no caller depends on FLOW_DEFINITION or TASK_DEFINITION as exported data.
- R7 [must]: Existing flow CLI command names, options, help text, JSON envelope shapes, step ids, status transitions, and exit behavior shall remain user-visible compatible after the refactor.
- R8 [must]: Spec-local tests shall verify the new definition/registry boundary, raw export removal, step-tree utility relocation, lifecycle action class invariants, draft PASS artifact preservation, implementation-review proposal evidence reset, and representative review/gate/finalize lifecycle transitions.
- R9 [should]: If implementation changes documented flow internals, docs shall be rebuilt or updated through the project flow; otherwise docs shall remain unchanged.

## Acceptance Criteria
- A reviewer can inspect src/flow/definition.js and confirm raw FLOW_DEFINITION/TASK_DEFINITION exports are absent while definition-side APIs provide the required query and lifecycle operations.
- A reviewer can inspect src/flow/lib/step-tree.js and confirm steps-array utilities live there, with production and test imports updated to that module.
- A reviewer can inspect lifecycle definitions and confirm lifecycle action values are dedicated classes rather than object literal action records.
- A reviewer can inspect src/flow/registry.js and confirm hook entries delegate lifecycle decisions instead of hardcoding review phase maps, gate step ids, or finalize downstream leaf lists for definition-derived behavior.
- A reviewer can inspect lifecycle handling and confirm draft review PASS still writes or invokes the existing empty draft triage/repair artifact generation before draft-gate validation.
- A reviewer can inspect lifecycle handling and confirm proposal-producing implementation reviews still reset rebuildable evidence and downstream leaves from test-execute through finalize-cleanup.
- Spec-local tests under specs/283-flow-definition-lifecycle/tests/ cover R1 through R8 using // spec: R<N> headers.
- Existing shared unit/e2e tests that rely on flow behavior continue to pass, and full regression remains deferred to final-regression.
- No user-facing flow command, option, help text, JSON envelope shape, step id, status transition, or exit behavior is changed by the diff.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Extract step-tree utilities
  - Move steps-array-only utilities out of definition.js into a dedicated step-tree module.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Encapsulate definition access
  - Replace raw definition data exports with definition-side query APIs for flow and task definition access.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Model lifecycle actions
  - Add lifecycle action classes and attach declarative lifecycle behavior to flow definition nodes where simple lifecycle decisions are definition-derived.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Delegate registry lifecycle
  - Update registry.js hooks so lifecycle decisions are applied through definition-side lifecycle resolution instead of registry-local hardcoded maps and step ids.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Migrate definition consumers
  - Update production modules, helper modules, and tests to use the new definition APIs and step-tree module while preserving flow behavior.
  - see `tasks/T-5.md` for full spec
