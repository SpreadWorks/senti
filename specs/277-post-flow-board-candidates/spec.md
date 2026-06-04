# Feature Specification: 277-post-flow-board-candidates

**Feature Branch**: `feature/277-post-flow-board-candidates`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #360

## Goal
issue-log 由来のボード登録候補提示を finalize-cleanup 前処理から外し、flow 完了後の任意 post-flow 処理として案内する。

## Background
flowIntegration enable の現在の guidance では、issue-log 由来の board draft candidates が finalize-cleanup の前処理として提示される。これは optional board registration decision を SDD flow 完了前に挟むため、flow completion と post-flow housekeeping の境界が曖昧になる。Issue #360 は、cleanup 成功後に last-finalized-spec を使える既存契約を利用し、候補提示を dispatcher loop exit 後の任意 post-flow 処理へ移すことを求めている。

## Scope
- src/flow/prompts/impl/finalize-cleanup.md から pre-cleanup workflow board integration を削除する
- src/skills/sdd-forge.flow/SKILL.md の dispatcher loop exit 後に post-flow board candidate handling を追加する
- src/skills/ 変更に伴い sdd-forge upgrade で生成済み skill artifacts を更新する
- spec-local tests で pre-cleanup 削除、post-flow 追加、flowIntegration 条件、last-finalized-spec 利用を検証する

## Out of Scope
- src/workflow/lib/commands/issue-log-import.js の候補生成ロジック変更
- workflow add / publish / issue-start / board GraphQL 実装変更
- workflow.flowIntegration の config schema 変更
- finalize-cleanup command 本体の teardown、orphan recovery、report delivery 変更

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 CLI / skill / prompt 構造だけを使う。
- src/ 以下に特定プロジェクト固有の値を入れない。Issue 固有の hash や repository 名は product code / skill source に書かない。
- post-flow の board 登録失敗は flow 完了状態を変更しない。失敗は任意後処理の失敗としてユーザーに通知する。
- workflow.flowIntegration が enable でない場合、post-flow board candidate handling は案内されない。
- bounded-resource-usage: post-flow guidance は issue-log-import が返す bounded candidates だけを処理し、追加の issue-log scan や再帰的な候補展開を行わない。
- 既存機能への影響: flowIntegration enable の flow では board candidate selection の表示タイミングが finalize-cleanup 前から flow 完了後へ変わる。flowIntegration disable / unset、issue-start、issue-log-import 候補生成、workflow add の board 書き込み仕様には影響しない。
- src/skills/ を変更した後は sdd-forge upgrade を実行し、.agents/skills と .claude/skills の生成済み artifact を更新する。

## Design Principles
- finalize-cleanup は flow state cleanup、worktree teardown、report delivery、recovery guidance に集中させる。
- board draft 登録は SDD flow 完了後の任意判断として扱い、flow completion の成否から分離する。
- 既存の issue-log-import は候補生成のみ、workflow add はユーザー承認済み候補の draft 作成という責務分離を維持する。

## Overview
### Modules
- src/flow/prompts/impl/finalize-cleanup.md: cleanup leaf の手順。pre-cleanup board integration を削除し、Required Sequence と recovery/report 指示だけを残す。
- src/skills/sdd-forge.flow/SKILL.md: dispatcher loop と loop exit 後の post-flow 処理を記述する skill source。
- src/workflow/lib/commands/issue-log-import.js: finalized spec の issue-log.json から board draft candidates を JSON envelope で返す既存 command。変更対象外。
- src/workflow/lib/commands/add.js: ユーザー承認済み候補を board draft として作成する既存 command。変更対象外。

### Data Flow
- finalize-cleanup succeeds -> worktree is removed -> .sdd-forge/last-finalized-spec is written in the main repo -> dispatcher loop exits because flow status is active:false.
- loop exit後、workflow.flowIntegration が enable の場合だけ last-finalized-spec の spec path を使って sdd-forge workflow issue-log-import --spec <path> を main repo 側で実行する。
- issue-log-import が candidates を返した場合、screening 後に候補説明と Choice Format を表示し、ユーザー承認済み候補だけ workflow add で Ideas draft として登録する。

### Decisions
- [VERIFY] finalize-cleanup.md has pre-cleanup issue-log-import/workflow add instructions; this spec removes them from cleanup.
- [VERIFY] sdd-forge.flow skill already states cleanup writes last-finalized-spec and subsequent commands run from main repo.
- [VERIFY] issue-log-import is a candidate emitter; board writes remain external through workflow add.
- Post-flow candidate handling uses Issue #360's wording and keeps empty candidates as a no-choice path.

## Clarifications (Q&A)
- Q: post-flow の表示文言と選択肢は Issue #360 の文言案を採用するか。
  - A: 採用する。flow 完了済み、任意後処理、番号指定登録、全登録、登録しない、を明示する。
- Q: 候補が 0 件の場合にユーザーへ選択肢を出すか。
  - A: 出さない。既存の空候補スキップ契約を post-flow に移して維持する。
- Q: post-flow board registration failure は flow failure か。
  - A: 違う。flow completion には影響させず、post-processing failure として通知する。

## Alternatives Considered
- Keep the board candidate handling in finalize-cleanup pre-processing — Rejected because it preserves the problem: optional board registration decisions are still inserted before flow completion.
- Move board writes into issue-log-import — Rejected because issue-log-import is a non-interactive candidate emitter and the skill owns user approval plus workflow add calls.
- Add a new CLI command for post-flow board candidate handling — Rejected because Issue #360 asks for skill guidance relocation and existing commands already cover candidate generation and draft creation.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T13:15:08.788Z
- Notes: autoApprove: spec-gate passed for issue #360

## Requirements
- R1 [must]: src/flow/prompts/impl/finalize-cleanup.md must not contain the pre-cleanup workflow board integration section, nor instructions to run issue-log-import or workflow add before finalize-cleanup.
- R2 [must]: src/skills/sdd-forge.flow/SKILL.md must describe optional post-flow board registration candidate handling after the dispatcher loop exit, and the wording must state that the flow is complete and the processing is optional.
- R3 [must]: The post-flow guidance must run only when finalize-cleanup has succeeded, flow get status reports active:false, and .sdd-forge/config.json has workflow.flowIntegration equal to enable.
- R4 [must]: The post-flow guidance must use .sdd-forge/last-finalized-spec to locate the finalized spec on the main repo side and run sdd-forge workflow issue-log-import --spec <lastFinalizedSpec> from the main repo.
- R5 [must]: When post-flow candidates are present, the guidance must process only the bounded data.candidates array returned by one issue-log-import invocation, screen those candidates for board readiness, present target, problem, cause or evidence, improvement direction, and board reason for each displayed candidate, and call workflow add only for user-approved candidates.
- R6 [must]: Failures in post-flow issue-log import or board draft creation must be described as post-processing failures after flow completion and must not change the flow completion state.
- R7 [must]: Generated skill artifacts must be refreshed so .agents/skills/sdd-forge.flow/SKILL.md and .claude/skills/sdd-forge.flow/SKILL.md include the new post-flow guidance.

## Acceptance Criteria
- AC1 (R1): A spec-local test file under specs/277-post-flow-board-candidates/tests/ has a `// spec: R1` header and confirms finalize-cleanup.md no longer matches `Pre-cleanup: workflow board integration`, `issue-log-import`, or `workflow add`.
- AC2 (R2, R3): A spec-local test confirms src/skills/sdd-forge.flow/SKILL.md contains a loop-exit post-flow section with `flow is complete` wording, `workflow.flowIntegration`, `active:false`, and `finalize-cleanup` success conditions.
- AC3 (R4): A spec-local test confirms the post-flow guidance mentions `.sdd-forge/last-finalized-spec` and `sdd-forge workflow issue-log-import --spec <lastFinalizedSpec>`.
- AC4 (R5): A spec-local test confirms the post-flow guidance includes bounded `data.candidates` processing, candidate screening, and `workflow add` only for user-approved candidates.
- AC5 (R6): A spec-local test confirms the post-flow guidance states issue-log-import / workflow add failures do not affect flow completion state.
- AC6 (R7): After sdd-forge upgrade, a spec-local test file under specs/277-post-flow-board-candidates/tests/ has a `// spec: R7` header and confirms generated .agents and .claude sdd-forge.flow skill files contain the post-flow guidance.

## Implementation Targets
- src/flow/prompts/impl/finalize-cleanup.md
- src/skills/sdd-forge.flow/SKILL.md
- src/skills/partials if shared wording is needed
- specs/277-post-flow-board-candidates/tests/
- .agents/skills/sdd-forge.flow/SKILL.md
- .claude/skills/sdd-forge.flow/SKILL.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Move post-flow guidance
  - Relocate board registration candidate guidance from finalize-cleanup pre-processing to sdd-forge.flow loop-exit post-flow handling.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Refresh generated skills
  - Run sdd-forge upgrade so generated agent skill artifacts reflect the updated sdd-forge.flow source.
  - see `tasks/T-2.md` for full spec
