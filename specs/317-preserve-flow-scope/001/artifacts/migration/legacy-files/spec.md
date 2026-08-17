# Feature Specification: 317-preserve-flow-scope

**Feature Branch**: `feature/317-preserve-flow-scope`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #430

## Goal
currentTaskId が non-null の flow でも、flow-level lifecycle mutation と runtime log persistence を top-level scope に固定し、task-level runtime metadata と lifecycle routing、test header validation、target guard を維持する。

## Background
Approval synchronization can set `currentTaskId` before plan-level test lifecycle steps finish. FlowStore infers the active task when callers omit a parent selector, so top-level `test`, `scenario-validity`, and `test-review` mutations can search inside the task and fail or update the wrong scope. Dispatcher runtime log persistence has the same defect because it explicitly derives `taskId` from `currentTaskId`. The fix belongs at the flow-level mutation boundaries; changing FlowStore would alter every implicit task-scoped caller and exceed Issue #430.

## Scope
- `src/flow/lib/set-step.js` の top-level `flow set step` mutation に `taskId: null` を渡す。
- `src/lib/dispatcher.js` の runtime log metadata persistence を resolved runtime step の flow/task scope に一致させる。
- `src/flow/registry.js` の `scenario-validity` と `test-review` lifecycle completion に `taskId: null` を渡す。
- currentTaskId 設定済み fixture で top-level test completion、header rejection、runtime log、scenario-validity、test-review を検証する。
- task-impl、task-review、task-gate の task scope と lifecycle target guard の parity を検証する。

## Out of Scope
- FlowStore の scope inference logic の変更。
- 新しい scope flag、CLI option、state recovery command の追加。
- Issue #414、Issue #429、または他の lifecycle behavior の変更。
- 外部 dependency、push、publish、release。

## Constraints
- Node.js built-in module だけを使用し、外部 dependency を追加しない。
- `src/` に project 固有の spec id、Issue number、worktree path を含めない。
- FlowStore の既存 inference contract と public CLI syntax を変更しない。
- flow-level caller は既存 selector `taskId: null` を使用し、task-level caller は明示された task id を維持する。
- 既存 shared suite の変更は対象 boundary の regression に限定し、spec-local behavior coverage を必ず追加する。

## Design Principles
- scope ownership は mutation boundary で明示し、global store inference に flow-level intent を推測させない。
- validation と target guard は mutation より前に実行される既存 ordering を保持する。
- flow-level と task-level の routing contract を同じ fixture で対比し、scope regression を観測可能にする。

## Overview
### Modules
- `src/flow/lib/set-step.js`: top-level step completion の validation、status mutation、side effect dispatch を所有する。
- `src/lib/dispatcher.js`: command lifecycle、target guard、runtime log capture、step metadata persistence を所有する。
- `src/flow/registry.js`: `scenario-validity` と review/gate を含む command lifecycle post hook を FlowManager mutation へ接続する。

### Data Flow
- `flow set step test done` は target guard と `// spec:` header validation を通過後、top-level `test` step status を更新する。
- dispatcher は command runtime log block を閉じ、resolved runtime step が flow-level なら top-level scope、task-level なら explicit current task scope に metadata を保存する。
- `scenario-validity` と `test-review` の成功結果は registry lifecycle post hook から対応する top-level step を完了する一方、task review/gate は current task の step を更新する。

### Decisions
- [CORRECTION] checked flow step mutation in `src/flow/lib/set-step.js`; current options omit parent scope, so adopt `taskId: null` while retaining `specId` routing.
- [CORRECTION] checked runtime metadata mutation in `src/lib/dispatcher.js`; derive mutation scope from the resolved runtime step so flow-level steps use `taskId: null` and task-level steps use explicit `currentTaskId`.
- [CORRECTION] checked lifecycle completion in `src/flow/registry.js`; flow-level scenario-validity and test-review updates omit parent scope, so pass `taskId: null` at those boundaries.
- [VERIFY] checked task review/gate resolution; result=match: task phases resolve task-review/task-gate separately from top-level review/gate ids and must retain current task routing.
- [VERIFY] checked dispatcher ordering; result=match: target mismatch is evaluated before command execution and lifecycle hooks that persist step status.
- Impact inventory: intended impact is successful top-level lifecycle progression and correct top-level runtime metadata when `currentTaskId` is non-null. Unchanged behavior includes task-scoped task-impl/review/gate status and runtime metadata routing, `// spec:` header acceptance/rejection, target guards, and the FlowStore API.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Change FlowStore so omitted scope always means top-level flow scope. — Rejected because task-level callers rely on active-task inference and Issue #430 explicitly excludes FlowStore changes.
- Add a CLI scope flag and thread it through dispatcher input. — Rejected because the internal `taskId: null` selector already expresses the required invariant and the Issue excludes new flags or options.
- Repair blocked flow.json files directly after a mutation fails. — Rejected because manual state repair does not prevent recurrence and is explicitly out of scope.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T08:31:11.316Z
- Notes: Parent pre-approved the corrected Issue #430 resolved-step scope after revised spec-gate PASS.

## Requirements
- R1 [must]: `flow set step` shall pass explicit `taskId: null` for top-level step mutations, including the existing `specId` path, so `test=done` updates the top-level step when `currentTaskId` is non-null; valid `// spec:` headers shall be accepted and invalid or missing headers shall still return `TEST_HEADER_VALIDATION_FAILED` without persisting the transition.
- R2 [must]: Dispatcher runtime log persistence shall derive parent scope from the resolved runtime step: a top-level runtime step shall call `setStepRuntimeLog` with `taskId: null`, while task-impl, task-review, and task-gate runtime steps shall use the explicit `currentTaskId`; both paths shall preserve any resolved `specId`.
- R3 [must]: Registry lifecycle completion for passing `scenario-validity` and passing or advisory `test-review` results shall update the corresponding top-level step with explicit `taskId: null` when `currentTaskId` is non-null.
- R4 [must]: Task-scoped task-impl, task-review, and task-gate lifecycle status and runtime metadata routing shall continue to use the explicitly selected current task and shall not redirect those mutations or logs to top-level flow steps.
- R5 [must]: Target-sensitive lifecycle commands shall continue to enforce existing run ID, Issue, and spec guards before validation, command execution, runtime log step metadata persistence, or lifecycle status mutation; a mismatched target shall return `ACTIVE_FLOW_MISMATCH` and leave both flow and task steps unchanged.

## Acceptance Criteria
- AC1: With `currentTaskId=T-1` and valid spec-local test headers, `flow set step test done` returns success, marks only the top-level `test` step done, and does not search for `test` in T-1.
- AC2: With the same active-task fixture, invalid and missing `// spec:` headers each return `TEST_HEADER_VALIDATION_FAILED` and leave the top-level `test` step and task steps unchanged.
- AC3: Dispatcher unit tests with non-null `currentTaskId` observe `setStepRuntimeLog(stepId, metadata, { specId, taskId: null })` for a resolved top-level runtime step and `{ specId, taskId: "T-1" }` for resolved task-impl, task-review, and task-gate runtime steps.
- AC4: Registry unit tests with non-null `currentTaskId` observe `scenario-validity` PASS and `test-review` PASS or ADVISORY completion using `{ taskId: null }` and updating the top-level steps.
- AC5: Task lifecycle regression tests observe task-impl, task-review, and task-gate status mutations and runtime log metadata retaining explicit T-1 scope while equivalent flow-level steps and logs remain unchanged.
- AC6: A command using matching `--expect-run-id`, `--expect-issue`, and `--expect-spec` guards succeeds; changing any one guard returns `ACTIVE_FLOW_MISMATCH` before runtime log metadata or lifecycle step mutation.
- AC7: Spec-local tests under `specs/317-preserve-flow-scope/tests/` include `// spec: R<N>` coverage for R1-R5, and the focused existing unit suites plus configured regression commands pass.

## Implementation Targets
- src/flow/lib/set-step.js
- src/lib/dispatcher.js
- src/flow/registry.js
- tests/unit/flow/set-step.test.js
- tests/unit/lib/dispatcher.test.js
- tests/unit/flow/run-review-advisory.test.js
- tests/unit/flow/gate-phase-inference.test.js
- specs/317-preserve-flow-scope/tests/flow-scope-regression.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Pin flow-level mutation scope
  - Make every Issue #430 flow-level mutation boundary select the top-level step explicitly while retaining task routing, header validation, and target guards.
  - see `tasks/T-1.md` for full spec
