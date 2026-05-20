# Feature Specification: 263-fix-finalize-merge-dirty

**Feature Branch**: `feature/263-fix-finalize-merge-dirty`
**Created**: 2026-05-20
**Status**: Draft
**Input**: User request

## Goal
finalize-commit 後に現在 spec の flow 管理メタデータだけが未コミットで残っても、finalize-merge の pre-merge rebase が dirty worktree として停止しないようにする。

## Background
The observed failure occurs between finalize-commit and finalize-merge. finalize-commit succeeds and its post hook updates flow state and report artifacts. The next-action promotion can then mark finalize-merge in_progress, leaving the current spec's flow.json dirty. If a prior merge failure was recorded, issue-log.json can also be dirty. runPreSync in finalize-merge refuses to rebase a dirty worktree, so flow-generated metadata blocks the flow. The existing finalize-merge pre hook already has a narrowly scoped metadata commit for downstream skipped reset; this spec extends that boundary to current spec flow metadata while preserving the dirty stop for every other file.

## Scope
- must: finalize-merge pre hook は、現在 spec の flow 管理メタデータだけが dirty な場合に pre-merge rebase 前へ staged path を specs/<specId>/flow.json と specs/<specId>/issue-log.json に限定した chore commit を作る。
- must: 自動 commit 対象は specs/<specId>/flow.json と specs/<specId>/issue-log.json の 2 path に限定する。
- must: 対象外 dirty file が 1 つでもある場合は自動 commit せず、既存の dirty worktree 停止を維持する。
- must: 既存の skipped downstream reset commit は維持し、同じ finalize-merge pre hook 内で dirty を残さない。
- should: spec-local test で metadata-only dirty、対象外 dirty 混在、downstream skipped reset の各挙動を検証する。

## Out of Scope
- finalize merge strategy、squash merge、PR route の意味変更。
- finalize-cleanup の orphan commit recovery 仕様変更。
- ユーザー作業や対象外ファイルを自動 commit すること。
- docs build、release、npm publish、dist-tag 操作。
- 外部依存追加や TypeScript 移行。

## Constraints
- 外部依存は追加しない。Node.js 組み込みモジュールと既存 git/process helper のみを使う。
- src/templates と src/presets は変更しない。変更が必要になった場合のみ sdd-forge upgrade を実行する。
- 自動 stage / commit の対象 path は specs/<specId>/flow.json と specs/<specId>/issue-log.json に固定する。その他の dirty path は stage しない。
- dirty 判定は git status --porcelain の path 出力に基づく。対象外 dirty path が 1 件以上ある場合、自動 commit helper は commit を作らず no-op を返す。
- 対象外 dirty path が 1 件以上ある場合、finalize-merge pre hook は downstream skipped reset を含む flow metadata mutation / commit を実行しない。既存の dirty-worktree stop を維持する。
- bounded-resource-usage: 自動 commit 判定で比較する allowed path は 2 件に固定し、git status 出力を 1 回読むだけにする。再帰探索や retry loop は追加しない。
- backward-compatible-cli-interface: `sdd-forge flow run finalize-merge` のコマンド名、引数、option の意味は変えない。dirty 対象が flow 管理メタデータだけの場合に既存の failure を回避する内部 pre hook 挙動だけを追加する。
- exit-code-contract: finalize-merge の成功は既存どおり ok:true / exit 0。対象外 dirty file、rebase conflict、fetch failure、commit failure は既存 dispatcher/error handling により ok:false または thrown error の envelope 変換で non-zero exit を維持する。
- validate-user-input-at-entry-point: 新しい user-facing 引数は追加しない。`--agent-work-dir` と `--log-file` は既存 runtime option の validation をそのまま使う。

## Design Principles
- flow 自身が生成した metadata-only dirty は finalize-merge pre hook の責務として吸収する。
- ユーザー作業の保護を優先し、allowed path 以外の dirty file は既存の dirty stop に任せる。
- 既存 downstream skipped reset の commit precedent を拡張し、finalize-merge の pre hook 後に worktree を clean にする。

## Overview
### Modules
- src/flow/registry.js - finalize-merge pre hook を持ち、既存の downstream skipped reset commit を実行する場所。metadata-only dirty commit の呼び出し地点。
- src/flow/lib/run-finalize.js - finalize sub-step 共通 helper。allowed path 判定と commit helper を置く候補。
- src/flow/commands/merge.js - runPreSync が dirty worktree を pre-merge rebase failure として返す既存停止地点。
- specs/263-fix-finalize-merge-dirty/tests - metadata-only dirty と対象外 dirty 混在を検証する spec-local tests。

### Data Flow
- finalize-commit post hook / next-action promotion -> specs/<specId>/flow.json dirty -> finalize-merge pre hook -> metadata-only commit -> runPreSync rebase
- finalize-merge pre hook -> git status path list -> allowed set comparison -> add allowed paths -> commitOrSkip("chore: record finalize metadata before merge")
- target-external dirty path present -> helper no-op -> runPreSync sees dirty worktree -> existing recoveryHint is returned

### Decisions
- [VERIFY] finalize-commit post hook writes flow state before executeCommitPost, but executeCommitPost commits only durable test/report artifacts.
- [VERIFY] finalize-merge pre hook already commits downstream skipped reset metadata.
- [VERIFY] runPreSync stops dirty worktree before rebase.
- Use a fixed allowed path set instead of relaxing dirty handling.

## Clarifications (Q&A)
- Q: What is flow management metadata in this spec?
  - A: Only the current spec's specs/<specId>/flow.json and specs/<specId>/issue-log.json. No other file is included in this term.
- Q: Does this allow auto-committing user work?
  - A: No. If git status shows any path outside the two allowed metadata paths, the new helper must not commit and finalize-merge keeps the existing dirty-worktree stop.
- Q: Does this change merge or cleanup behavior?
  - A: No. The change is limited to pre-merge metadata persistence. Squash merge, PR route, orphan detection, cleanup, and recovery choices keep their current meaning.

## Alternatives Considered
- Add flow.json to executeCommitPost artifact commit — Rejected because executeCommitPost intentionally stages durable test/report artifacts only. Adding flow state there would couple report artifact persistence to finalize step ledger persistence.
- Relax runPreSync dirty handling — Rejected because runPreSync is the safety boundary for user work and merge conflicts. It must continue to stop on non-metadata dirty paths.
- Require the AI/user to commit metadata manually before retry — Rejected because the dirty paths are produced by the flow itself and this manual step has already interrupted finalize execution.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T05:15:42.497Z
- Notes: autoApprove=true; user selected auto mode and requested direct implementation.

## Requirements
- R1 [must]: finalize-merge pre hook must commit current spec metadata before runPreSync when the only dirty paths are specs/<specId>/flow.json and/or specs/<specId>/issue-log.json.
- R2 [must]: The metadata commit must stage only specs/<specId>/flow.json and specs/<specId>/issue-log.json, and must not stage docs, src, tests, package files, or other spec files.
- R3 [must]: When git status contains any dirty path outside specs/<specId>/flow.json and specs/<specId>/issue-log.json, finalize-merge pre hook must not create a metadata commit or run downstream skipped reset mutation, leaving existing dirty-worktree failure behavior to runPreSync.
- R4 [must]: When no target-external dirty path exists, the existing downstream skipped reset behavior must still reset skipped finalize-sync/finalize-cleanup to pending and commit the resulting flow.json state before runPreSync.
- R5 [should]: Spec-local tests under specs/263-fix-finalize-merge-dirty/tests must cover metadata-only dirty commit, target-external dirty no-op, and downstream skipped reset behavior with // spec: R<N> headers.

## Acceptance Criteria
- Given finalize-merge pre hook runs with only specs/263-fix-finalize-merge-dirty/flow.json dirty, a commit is created before merge execution and git status becomes clean.
- Given finalize-merge pre hook runs with only specs/263-fix-finalize-merge-dirty/issue-log.json dirty, the metadata commit stages issue-log.json and does not require flow.json to be dirty.
- Given flow.json and issue-log.json are both dirty for the current spec, one metadata commit includes those two paths and no other paths.
- Given src/flow/registry.js or another target-external path is dirty, metadata auto-commit and downstream skipped reset mutation are skipped, and the dirty path remains unstaged/uncommitted.
- Given finalize-sync and finalize-cleanup are skipped before finalize-merge retry and no target-external dirty path exists, the pre hook resets them to pending and commits the flow.json reset so the worktree is clean before runPreSync.
- Given finalize-sync and finalize-cleanup are skipped before finalize-merge retry and a target-external dirty path exists, the pre hook does not reset those steps and does not create a commit.
- Spec-local tests include // spec: R1 R2 R3 R4 R5 coverage or per-file headers that together mention all testable requirements.

## Implementation Targets
- src/flow/registry.js
- src/flow/lib/run-finalize.js
- specs/263-fix-finalize-merge-dirty/tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Persist merge metadata
  - Add a finalize helper and pre-hook wiring that commits current-spec flow metadata before pre-merge rebase only when all dirty paths are allowed metadata paths.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Cover metadata boundary
  - Add spec-local tests that lock metadata-only commit behavior, target-external dirty no-op behavior, and skipped downstream reset compatibility.
  - see `tasks/T-2.md` for full spec
