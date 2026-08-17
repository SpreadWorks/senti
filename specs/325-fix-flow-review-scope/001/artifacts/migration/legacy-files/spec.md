# Feature Specification: 325-fix-flow-review-scope

**Feature Branch**: `feature/325-fix-flow-review-scope`
**Created**: 2026-07-21
**Status**: Draft
**Input**: GitHub Issue #448

## Goal
flow-level impl-review の scope を active review leaf に一致させ、残留 currentTaskId が task-scoped artifact、retry、step outcome、lifecycle 停止を引き起こさないようにする。

## Background
Task synchronization may leave currentTaskId pointing to a valid task after task work has ceased to be the active lifecycle. `run-review.js` currently uses that cursor directly in retry precheck, review step selection, task spec selection, and post-result handling. A flow-level impl-review therefore runs as task review, writes task identity into an otherwise successful artifact, and prevents the existing flow lifecycle from recognizing PASS. The codebase already has active flow/task leaves and a correct artifact-driven lifecycle consumer; the missing contract is a single pre-mutation review scope decision shared by every producer-side operation.

## Scope
- `src/flow/lib/task-scope.js` に active `impl-review` / `task-review` leaf を権威とする review scope decision を追加する。
- `src/flow/lib/run-review.js` の impl review precheck、task spec 選択、retry、StepAttempt、result artifact scope を同じ review scope decision に統一する。
- `src/flow/definition.js` の既存 flow/task impl review lifecycle を source verification と regression tests で固定し、production change は行わない。
- spec-local tests と既存 shared tests で flow PASS / ADVISORY / FAIL、task review、ambiguous/inconsistent scope、explicit broad mode、Issue #325 task cursor enforcement、target guards を検証する。

## Out of Scope
- `FindingDispositionPolicy`、impl-review finding schema、verdict bucket rules の変更。
- Issue #446 の trusted loop proposal serializer/disposition 不整合の変更。
- review finding 内容、gate policy、retry budget、flow definition の step ID / order / maxAttempts の変更。
- Issue #444、#445、#447 の製品差分または既存 flow.json / review artifact の手修復。
- 新しい CLI option、artifact schema version、allowlist、外部 dependency の追加。

## Constraints
- Node.js 組み込みモジュールだけを使用し、外部 dependency を追加しない。
- `src/` に Issue number、spec id、runId、worktree path など project 固有値を含めない。
- review scope は既存 `TaskScopeDecision` class で表現し、constructor invariant と `instanceof` を維持する。object literal の scope union は追加しない。
- flow-level `impl-review` と task-level `task-review` が同時に active、active task review と currentTaskId が不一致、または currentTaskId が未知 task を指す場合は review subprocess、stop-state clear、metric、StepAttempt、artifact、step mutation より前に typed failure とする。
- 既存 `BROAD_STEPS`、`broadModeHistory` record schema、safe task promotion predicate、recovery messages、review retry maximum は変更しない。
- テストの assertion 削減、skip、allowlist は行わず、変更契約に対応する assertion を追加する。
- spec-local behavior tests は各ファイル先頭に `// spec: R<N>` header を持ち、shared test だけで requirement coverage を代替しない。

## Design Principles
- cursor は task の選択状態、active leaf は現在実行中の lifecycle authority として分離する。
- review execution、retry、outcome、artifact、post-hook が同じ immutable scope decision を使用し、段階ごとの再推論を避ける。
- flow result に `taskId: null`、task result に selected task id を明示し、既存 definition lifecycle に active leaf と一致する scope identity を渡す。
- scope mismatch は fail-closed とし、永続化前の一つの system boundary で拒否する。

## Overview
### Modules
- `src/flow/lib/task-scope.js`: task cursor enforcement、safe promotion、explicit broad mode と、impl review の active-leaf scope decision を所有する。
- `src/flow/lib/run-review.js`: resolved review scope に従って precheck、task spec、subprocess、retry metric、StepAttempt、result artifact を処理する。
- `src/flow/definition.js` と `src/flow/registry.js`: result artifact の taskId と active step を使用して flow/task lifecycle mutation を行う既存 consumer。

### Data Flow
- impl review command は durable mutation 前に flow `impl-review` と selected task `task-review` の active 状態を検査し、flow、task、broad、invalid の一つへ解決する。
- flow decision は task spec を渡さず `taskId: null` を結果へ設定し、task decision は selected task spec と taskId を使用する。broad decision は既存 audited broad record を結果へ保持する。
- post-hook は同じ result scope で reviewRetry と StepAttempt を記録し、既存 definition lifecycle が flow PASS / ADVISORY を review・triage・repair done、flow FAIL を review done・triage in_progress、task result を task-review だけへ反映する。

### Decisions
- [VERIFY] checked draft policy against task-scope.js; result=match for the existing cursor, promotion, and broad-mode contracts that must remain unchanged.
- [VERIFY] checked active-leaf and lifecycle consumers; result=match: correct result taskId is sufficient for the existing flow/task status transitions.
- [CORRECTION] interpret Issue wording 'ADVISORY with zero findings' as zero blocking findings, while PASS remains zero total findings; retain the existing finding contract.
- [VERIFY] migration parity inventory and owner mapping retain every public surface; result=match with no intended removal.
- The user selected the existing 07c9 bug first and published the same files, exclusions, and acceptance matrix as Issue #448; current flow artifacts from #444/#445 are evidence only and are not repaired by this spec.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Clear currentTaskId before every flow-level impl-review. — Rejected because the cursor is valid task lifecycle state, forced deletion would affect unrelated task operations, and it would not detect simultaneous or mismatched active leaves.
- Keep cursor-based review execution and strip taskId from the completed artifact. — Rejected because the wrong task spec, retry budget, StepAttempt scope, and subprocess target would already have been selected before serialization.
- Change `resolveImplReviewLifecycle()` to ignore artifact taskId. — Rejected because it would route genuine task-review results into flow leaves and weaken the existing flow/task consumer contract.
- Repair the blocked #444/#445 flow.json and artifacts directly. — Rejected because manual repair does not prevent recurrence and those issue artifacts are explicitly outside Issue #448 product scope.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-21T03:10:44.044Z
- Notes: Auto-approved per the user's explicit no-confirmation policy after spec-review PASS and spec-gate PASS; scope remains limited to Issue #448.

## Requirements
- R1 [must]: The impl review scope resolver shall return an existing `TaskScopeDecision` derived from active review leaves. For this requirement, actionable task work means at least one task whose `spec` is a non-empty string and whose status is neither `done` nor `skipped`. Exactly one active flow `impl-review` with no active task review resolves to flow when currentTaskId names an existing task, or when currentTaskId is null and no actionable task work remains; a null cursor with actionable task work retains the existing broad/blocked decision; exactly one active `task-review` resolves to that task only when currentTaskId matches it; both active, multiple task reviews, no active review leaf, an unknown currentTaskId, or a task/currentTaskId mismatch resolve to a blocked or invalid decision with a non-empty reason.
- R2 [must]: `RunReviewCommand` shall resolve impl review scope once before clearing review stop state or starting any subprocess, then use that decision for max-attempt precheck, task spec selection, audited broad-mode metadata, parsing, reviewRetry, StepAttempt stepId/taskId, and result artifacts; flow scope shall not pass `--task-spec` and shall expose taskId null, while task scope shall pass the selected task spec and expose its taskId. The existing bounds remain four semantic impl-review attempts and at most two subprocess retries after the first subprocess attempt, with retry delay capped at 30000 ms.
- R3 [must]: When flow `impl-review` is active and currentTaskId names an existing task whose `task-review` is not active, PASS with zero total findings and ADVISORY with zero blocking findings shall complete flow `impl-review`, `impl-triage`, and `impl-repair` through the existing lifecycle and route to `impl-gate`; no task step shall change.
- R4 [must]: A flow-scoped FAIL shall complete flow `impl-review`, start flow `impl-triage`, and leave `impl-repair` and `impl-gate` incomplete; a task-scoped PASS/ADVISORY/FAIL shall retain the selected taskId, metric/outcome scope, and task-review lifecycle without mutating flow `impl-review`, `impl-triage`, or `impl-repair`.
- R5 [must]: An invalid review scope shall return an `ok:false` envelope with code `REVIEW_SCOPE_INVALID` before subprocess launch and before durable changes to flow.json, review stop state, metrics, stepAttempts, review artifacts, runtime review state, or step status; the envelope shall include currentTaskId and the non-empty scope decision reason.
- R6 [must]: When at least one task has a non-empty `spec` string and status other than `done` or `skipped` while currentTaskId is null, the existing Issue #325 contract shall remain: impl review fails before subprocess launch without an audited broad-mode record and succeeds as broad only with a matching non-empty reason record; matching runId/Issue/spec guards proceed, while any mismatched guard returns `ACTIVE_FLOW_MISMATCH` before scope resolution or durable mutation.

## Acceptance Criteria
- AC1 (R1, R2): A fixture with only flow `impl-review` in_progress, currentTaskId=T-1 naming an existing task, and no active task review reproduces the pre-fix task-scoped result; after the fix it launches without `--task-spec`, writes `impl-review.json.taskId=null`, returns result artifact taskId=null, and records flow-scoped retry/outcome data.
- AC2 (R3): The AC1 fixture with PASS and zero total findings, and with ADVISORY, blocking=0, nonBlocking=1, each marks flow `impl-review`, `impl-triage`, and `impl-repair` done, leaves every task step unchanged, and routes to `impl-gate`.
- AC3 (R4): The same flow fixture with FAIL, blocking=1 marks only flow `impl-review` done and flow `impl-triage` in_progress; a fixture with only T-1 `task-review` active preserves taskId=T-1 and does not mutate the three flow review leaves.
- AC4 (R1, R5): Fixtures with both flow and task review active, two task reviews active, unknown currentTaskId, mismatched active task/currentTaskId, and no active review leaf each return `REVIEW_SCOPE_INVALID`, do not invoke the review subprocess, do not create or replace review artifacts, and leave the serialized durable flow state unchanged.
- AC5 (R6): A null-cursor fixture with actionable task work returns the existing task-cursor failure without broad audit, while the same fixture with a matching `impl-review` broadModeHistory entry and non-empty reason succeeds and exposes the existing broadMode metadata unchanged.
- AC6 (R6): The focused target-guard regression observes a matching runId/Issue/spec invocation reaching review scope resolution and each single-field mismatch returning `ACTIVE_FLOW_MISMATCH` before subprocess invocation, artifact creation, metric append, StepAttempt append, or step mutation.
- AC7 (R1-R6): Spec-local tests under `specs/325-fix-flow-review-scope/tests/` carry `// spec: R<N>` headers and cover AC1-AC6. `tests/unit/flow/run-review-advisory.test.js`, `tests/unit/flow/post-hook-flow-scope.test.js`, `specs/258-task-scoped-impl-flow/tests/task-scoped-flow.test.js`, and `tests/e2e/231-task-e2e-full-lifecycle.test.js` pass on the fixed commit.
- AC8 (R1-R6): The fixed commit changes production behavior only in task-scope.js and run-review.js, adds spec-local coverage plus assertions in the named shared regression files, adds no dependency or allowlist, passes `git diff --check`, and has passing focused, related, and full `npm test` execution summaries.

## Implementation Targets
- src/flow/lib/task-scope.js
- src/flow/lib/run-review.js
- tests/unit/flow/run-review-advisory.test.js
- tests/unit/flow/post-hook-flow-scope.test.js
- specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Resolve implementation review scope
  - Make impl review execution, retry, artifacts, outcomes, and lifecycle consume one active-leaf scope decision while preserving task cursor and broad-mode contracts.
  - see `tasks/T-1.md` for full spec
