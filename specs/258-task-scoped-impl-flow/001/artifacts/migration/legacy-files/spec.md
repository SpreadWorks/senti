# Feature Specification: 258-task-scoped-impl-flow

**Feature Branch**: `feature/258-task-scoped-impl-flow`
**Created**: 2026-05-17
**Status**: Draft
**Input**: GitHub Issue #325

## Goal
task 分解済み flow で implement / review / gate-impl が current task の範囲で実行されることを CLI が強制する。currentTaskId がない broad 実行は既定で失敗し、明示 opt-in された broad mode だけを監査記録つきで許可する。

## Background
Issue #325 reports that Issue #321 decomposed work into T-1 through T-7, but implementation continued with currentTaskId null. Review and gate-impl then evaluated the whole diff and all requirements, causing excessive input and long-running loops. The codebase already stores tasks[] and currentTaskId and has task-level definitions, but flow-level implementation actions can still run when task work remains. This spec turns task cursor usage into a CLI-enforced invariant.

## Scope
- must: task 分解済み flow における implement / review / gate-impl の currentTaskId 必須化。
- must: current task の requirements / files / task spec へ gate-impl 入力を限定すること。
- must: task 完了後に次 task へ進む手順を CLI 出力で明示すること。
- must: bulk 実装が必要な場合の明示 broad mode と監査記録。
- should: final report への task 単位の実装・検証結果の反映。
- must: 上記を検証するテスト追加または既存テスト更新。

## Out of Scope
- task 分解アルゴリズム自体の再設計。
- Issue #321 の実装内容の再修正。
- docs 生成パイプラインや preset system の挙動変更。
- 外部依存の追加。
- npm publish / dist-tag など release 操作。

## Constraints
- Node.js 組み込みモジュールのみを使い、外部依存は追加しない。
- alpha 版ポリシーに従い、旧 flow 形式や非推奨 broad fallback の後方互換コードは追加しない。
- backward-compatible-cli-interface: currentTaskId がない broad 実行を既定失敗へ変更するため、CLI error output は recovery command と explicit broad mode command を表示する migration plan を含める。
- exit-code-contract: task 分解済み flow で currentTaskId が null のまま implement / review / gate-impl を実行しようとした場合、明示 broad mode がない限り command は ok:false envelope と非ゼロ終了で失敗する。
- validate-user-input-at-entry-point: broad mode を有効化する user-facing argument は reason の非空文字列を必須にし、未知 task id や空 reason を entry point で拒否する。
- src/templates/ または src/presets のテンプレートを変更した場合は sdd-forge upgrade を実行する。

## Design Principles
- task cursor は flow state の正規 source of truth とし、AI や operator の記憶に依存しない。
- task-level gate と integration gate は同じ gate-impl 名を共有しても、入力 scope と phase を明確に分ける。
- broad mode は例外経路として扱い、理由・時刻・対象 step を audit trail に残す。
- task 完了後の次アクションは CLI output に表示し、ユーザーが次 task の開始手順を推測しないで済むようにする。

## Overview
### Modules
- `src/flow/lib/get-next-action.js` resolves the next flow or task action. It must prefer pending task promotion over flow-level implementation steps when tasks remain.
- `src/flow/lib/run-review.js` and `src/flow/lib/run-gate.js` execute review and gate commands. They must reject unintended broad execution for task-decomposed flows.
- `src/lib/flow-store.js` and `src/lib/flow-helpers.js` own tasks[], currentTaskId, notes, metrics, and task promotion state.
- `src/flow/lib/run-finalize-cleanup.js` builds the final report. It must surface task-level implementation and verification results when tasks exist.

### Data Flow
- After approval syncs spec tasks into flow.json, the dispatcher promotes a pending task only when no task is already in_progress and no task step is in_progress.
- Review and gate commands load flow state, derive task scope from currentTaskId, and use the current task spec markdown as the task-scoped input source.
- Explicit broad mode writes an audit entry to flow state before broad implement/review/gate can run; final reporting reads that audit trail with task metrics.

### Decisions
- [VERIFY] Existing flow state already has tasks[] and currentTaskId, so this spec strengthens enforcement instead of introducing a parallel cursor.
- [VERIFY] Task gate and integration gate are already separable phases; the fix should preserve that phase boundary.
- Default behavior is strict task scope. Broad mode remains available only through explicit opt-in with a non-empty reason.
- Mid-implementation null cursor is not auto-recovered. Auto-promotion is allowed only at dispatcher cursor boundaries before task work starts or after task completion.
- Task-scoped gate/review inputs use the rendered current task spec as the source. Parent requirement filtering and file-map filtering are not used for task gates.
- Impact list: task-decomposed implementation rejects unintended broad execution, task review/gate inputs shrink to task spec scope, final reports include task rows, and tests cover new cursor failures.

## Clarifications (Q&A)
- Q: Should broad mode be completely removed?
  - A: No. Broad mode is allowed only as an explicit exception with a non-empty reason and audit record, because Issue #325 includes bulk implementation as a required exceptional path.
- Q: How should existing midway flows with tasks[] and currentTaskId null behave?
  - A: Implementation commands fail unless currentTaskId is null, no task has status in_progress, no task step is in_progress, and a pending leaf task can be promoted before work starts.
- Q: What source defines task-scoped review and gate inputs?
  - A: The rendered current task spec markdown is the task-scoped source. Task gates do not filter parent requirement IDs or file-map entries because the existing task schema does not provide structured requirement IDs or file sets.
- Q: How can broad implementation be opted into?
  - A: A broad mode audit record must be created before get-next-action may return a broad implement action. The record includes step=implement, a non-empty reason, timestamp, and the null cursor state.
- Q: What exit code contract applies to new failures?
  - A: User-triggered task scope violations return ok:false flow envelopes and non-zero process exit through the existing flow command error path.

## Alternatives Considered
- Remove broad mode entirely. — Rejected because Issue #325 requires bulk implementation to be possible when it is recorded as explicit broad mode.
- Keep current broad fallback and rely on skill instructions. — Rejected because the reported bug is that AI or operator memory can bypass task order; CLI state must enforce the cursor.
- Auto-recover any null currentTaskId by choosing the next pending task. — Rejected for mid-implementation commands because the correct task cannot be inferred after manual edits or review changes have occurred.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-17T00:36:05.238Z
- Notes: autoApprove: approved gate-passed spec for Issue #325

## Requirements
- R1 [must]: When currentTaskId is null, no task has status in_progress, no task step is in_progress, and a pending leaf task exists, the dispatcher must promote that leaf before returning implementation actions.
- R2 [must]: When task work remains but the safe promotion predicate is false and currentTaskId is null, flow-level implement, review, and gate-impl must fail unless explicit broad mode is active for the attempted step.
- R3 [must]: Task-level review and gate-impl must use currentTaskId to load the rendered current task spec markdown as the task-scoped input source, and must not use parent requirement IDs or file-map filtering for task gates.
- R4 [must]: Explicit broad mode must require a non-empty reason before get-next-action can return broad implement or before review/gate can run broad, record the step, reason, timestamp, and task cursor state in flow state, and be visible in status or report output.
- R5 [must]: After a task gate passes and task completion side effects run, CLI output must show the completed task id and the next task start or completion state.
- R6 [should]: Final report output should include one row or section per task with task id, task status, implementation summary availability, test-execute result, review result, and gate-impl result when those artifacts exist.

## Acceptance Criteria
- Given a flow with tasks[] containing a pending leaf task, currentTaskId null, no in_progress task, and no in_progress task step, `sdd-forge flow get next-action` returns a task-scoped action and sets currentTaskId to that task.
- Given a flow with an in_progress task or in_progress task step but currentTaskId null, `sdd-forge flow get next-action` fails with recovery guidance unless explicit broad mode for implement is active.
- Given a task-decomposed implementation flow with currentTaskId null and no explicit broad mode, `sdd-forge flow run review` fails before spawning the review agent.
- Given a task-decomposed implementation flow with currentTaskId null and no explicit broad mode, `sdd-forge flow run gate --phase integration` or auto-resolved gate-impl fails before building a broad prompt.
- Given explicit broad mode with a non-empty reason, the broad implement, review, or gate path records the reason and attempted step in flow state.
- Given currentTaskId is set, task review/gate prompt input includes the rendered task spec markdown and excludes parent requirement ID filtering and file-map filtering.
- Given a task gate PASS, the command output shows the completed task id and either the next currentTaskId or that no pending tasks remain.
- Given finalized task-decomposed flow artifacts, the final report includes task-level implementation and verification results.

## Implementation Targets
- src/flow/lib/get-next-action.js
- src/flow/lib/run-review.js
- src/flow/lib/run-gate.js
- src/lib/flow-store.js
- src/lib/flow-helpers.js
- src/flow/lib/run-finalize-cleanup.js
- src/flow/registry.js
- tests/flow

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Enforce task cursor
  - Promote pending tasks before flow-level implementation actions and reject null currentTaskId when task work remains.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Record broad mode
  - Add explicit broad mode opt-in with non-empty reason and an audit record that downstream commands can verify.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Scope task gates
  - Ensure task-level review and gate prompts use current task requirements, task spec, and task metrics instead of flow-wide requirements.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Report task results
  - Show task completion and verification results in task completion output and the final report.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Cover task flow
  - Add regression tests for task cursor enforcement, broad mode audit behavior, task-scoped gate inputs, and task result reporting.
  - see `tasks/T-5.md` for full spec
