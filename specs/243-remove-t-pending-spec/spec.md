# Feature Specification: 243-remove-t-pending-spec

**Feature Branch**: `feature/243-remove-t-pending-spec`
**Created**: 2026-04-29
**Status**: Draft
**Input**: GitHub Issue #289

## Goal
Remove the T-pending-spec placeholder task and allow tasks: [] in flow.json, fixing the unknown step error caused by currentTaskId pointing to a placeholder with empty steps.

## Background
run-prepare-spec.js creates a T-pending-spec placeholder task with steps: [] to satisfy flow-store.js schema validation that rejects empty tasks arrays. After approval, syncSpecTasksToFlow calls promoteNextPending which promotes T-pending-spec to currentTaskId because it is the first pending task in the array. Subsequently, updateStepStatus via resolveMutationScope scopes step searches to this task's empty steps array, causing 'unknown step' errors for flow-level steps like review. The read path (findActiveNode) has fallthrough to flow-level steps, but the write path (resolveMutationScope) does not.

## Scope
- Remove empty tasks array rejection from assertTaskSchema in flow-store.js
- Replace T-pending-spec placeholder with tasks: [] in run-prepare-spec.js
- Remove filterPendingSpecPlaceholder function and its call site in run-gate.js
- Update test t-a2-strict-load.test.js to verify tasks: [] is accepted

## Out of Scope
- resolveMutationScope fallthrough logic
- Existing flow.json migration
- Changes to promoteNextPending or syncSpecTasksToFlow

## Constraints
- Alpha policy: no backward compatibility code
- No external dependencies
- Test scenarios must remain valid after the change

## Design Principles
- Represent 'no tasks yet' with an empty array, not a placeholder object

## Overview
### Modules
- **flow-store.js**: Schema validation in assertTaskSchema — remove the empty-array rejection
- **run-prepare-spec.js**: Flow initialization — replace T-pending-spec with tasks: []
- **run-gate.js**: Gate evaluation — remove filterPendingSpecPlaceholder and its call site

### Data Flow
1. flow prepare → run-prepare-spec creates flow.json with tasks: [] and currentTaskId: null
2. approval done → syncSpecTasksToFlow appends real tasks from spec.json, promoteNextPending promotes first real task
3. flow run review → post-hook calls updateStepStatus which now correctly operates on task scope (not placeholder)

### Decisions
- Allow tasks: [] instead of requiring a placeholder. Empty array is the natural representation of 'no tasks defined yet'. All downstream functions already handle empty arrays correctly. (Evidence: flow-helpers.js:215 early return on empty tasks, sync-spec-tasks.js:44 early return on empty specTasks)
- Remove filterPendingSpecPlaceholder rather than keeping it as defensive code. Alpha policy prohibits backward-compatibility shims.

## Clarifications (Q&A)
- Q: Does removing the empty-array rejection break downstream code?
  - A: No. promoteNextPending, syncSpecTasksToFlow, and findNextPendingTask all handle empty arrays with early returns.
- Q: Should existing flow.json files be migrated?
  - A: No. Alpha policy: no backward compatibility. Existing flows with T-pending-spec will need to be re-created.

## Alternatives Considered
- Make T-pending-spec non-promotable via a flag — Rejected: adds complexity to solve a problem that shouldn't exist.
- Add fallthrough to resolveMutationScope — Rejected: treats the symptom rather than the cause.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-29
- Notes: autoApprove

## Requirements
- **R1** (must): flow-store.js assertTaskSchema SHALL accept tasks: [] (empty array) without throwing
- **R2** (must): run-prepare-spec.js SHALL initialize flow.json with tasks: [] and currentTaskId: null, with no T-pending-spec placeholder
- **R3** (must): run-gate.js SHALL NOT contain filterPendingSpecPlaceholder function or any reference to T-pending-spec
- **R4** (must): The test file t-a2-strict-load.test.js SHALL verify that tasks: [] is accepted by FlowStore.load()

## Acceptance Criteria
- flow-store.js load() does not throw when tasks is an empty array
- flow prepare creates flow.json with tasks: [] (no T-pending-spec)
- run-gate.js contains no filterPendingSpecPlaceholder function
- npm test passes with updated test expectations
- No references to T-pending-spec remain in src/

## Implementation Targets
- src/lib/flow-store.js
- src/flow/lib/run-prepare-spec.js
- src/flow/lib/run-gate.js
- tests/unit/227-post-226-forest-integration/t-a2-strict-load.test.js

## Open Questions
(none)
