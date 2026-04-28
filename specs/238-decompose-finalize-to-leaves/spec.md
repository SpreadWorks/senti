# Feature Specification: 238-decompose-finalize-to-leaves

**Feature Branch**: `feature/238-decompose-finalize-to-leaves`
**Created**: 2026-04-28
**Status**: Draft
**Input**: GitHub Issue #280

## Goal
finalize を FLOW_DEFINITION の branch に分解し、commit / merge / sync / cleanup を独立 leaf にすることで、ディスパッチャーがサブステップの進行を個別に追跡・制御できるようにする

## Background
spec 236 で FLOW_DEFINITION ツリーを導入した際、finalize は既に STEP_MAP で内部的に4ステップを持つモノリシックなコマンドとして動作していたため、単一 leaf として据え置いた。この結果、ディスパッチャーは finalize 内部のサブステップ進行を把握できず、--mode select --steps による手動選択が定義木の外で独自に実装される状態が続いている。

## Scope
- [must] definition.js: finalize leaf を branch に変換し、commit / merge / sync / cleanup の4 leaf を children に配置
- [must] run-finalize.js を分割し、各 leaf に対応する独立 FlowCommand サブクラスを作成
- [must] registry.js: 個別コマンドを登録し、既存の hooks（commit.post, onError）を移行
- [must] プロンプト: impl/finalize.md を各 leaf 用プロンプトに分割
- [should] run-finalize.js の show-report ステップ ID 参照を削除
- [should] スキルテンプレート（SKILL.md）の finalize 手順記述を新構造に対応
- [should] 既存テストを個別コマンド構成に更新

## Out of Scope
- ディスパッチャーループ（next-action / promoteNextPendingLeaf）自体の変更
- plan フェーズの構造変更
- retro / report 生成ロジックの内部変更（commit の post hook として配置するだけ）
- merge.js / cleanup の内部ロジック変更（独立コマンド化するが、ロジック自体は維持）

## Constraints
- MAX_DEPTH=3 の制約内で配置すること（impl[1] → finalize[2] → commit[3]）
- alpha 版ポリシー: 後方互換コードは不要。統合コマンドは廃止し個別コマンドに置換
- merge 失敗時は後続の sync / cleanup を自動スキップする安全機構を維持すること
- commit の post-hook（retro + report + issue comment + artifacts commit）の動作を維持すること

## Design Principles
- 定義木の既存 branch traversal 機構をそのまま活用し、ディスパッチャーに特別なロジックを追加しない
- 各 leaf は独立した FlowCommand として、単体でテスト・実行可能にする
- run-finalize.js の共有ユーティリティ（preflight, commitOrSkip 等）は共有モジュールとして残す

## Overview
### Modules
- definition.js — finalize ノードを branch に変換し、finalize-commit / finalize-merge / finalize-sync / finalize-cleanup の4 leaf を定義
- run-finalize-commit.js — commit leaf のコマンド実装。migration hook → git add → commit。post-hook で retro/report/issue-comment/artifacts-commit
- run-finalize-merge.js — merge leaf のコマンド実装。squash merge または PR 作成。失敗時に後続 leaf を skipped に遷移
- run-finalize-sync.js — sync leaf のコマンド実装。docs build → git add docs → commit
- run-finalize-cleanup.js — cleanup leaf のコマンド実装。last-finalized-spec ポインタ書き込み → flow state クリア → worktree/branch 削除
- run-finalize.js — 共有ユーティリティ（preflight, commitOrSkip, resolveGitCommonDir 等）のみ残す。RunFinalizeCommand / STEP_MAP は削除
- registry.js — finalize 統合コマンドを4個別コマンドに置換。hooks を各コマンドに移行

### Data Flow
- ディスパッチャー → next-action(finalize-commit) → run-finalize-commit → post-hook(retro/report) → next-action(finalize-merge) → run-finalize-merge → next-action(finalize-sync) → run-finalize-sync → next-action(finalize-cleanup) → run-finalize-cleanup

### Decisions
- finalize を impl branch 内の sub-branch として配置（独立 top-level branch ではない）
- requiresApproval は finalize-commit leaf にのみ設定
- merge 失敗時の後続スキップは merge コマンドの onError hook で実現
- 統合コマンド sdd-forge flow run finalize は廃止

## Clarifications (Q&A)
- Q: FLOW_STEPS の死んだエントリ（push, pr-create 等）の整理は必要か？
  - A: 不要。definition.js にはこれらのエントリは既に存在しない（spec 236 で除去済み）。

## Alternatives Considered
- finalize を独立 top-level branch にする — phase map の意味論が壊れる（finalize 内 leaf が独自の phase になり impl phase ロジックとの整合が失われる）
- 統合コマンドを薄いラッパーとして残す — alpha 版ポリシーに反し、hook 定義やテストが二重化するだけで利点なし

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: FLOW_DEFINITION の finalize ノードが branch になり、finalize-commit / finalize-merge / finalize-sync / finalize-cleanup の4 leaf を children に持つこと。各 leaf は FlowNode インスタンスで、action / instructionsKey / contextKinds が設定されていること。
- R2 [must]: 各 leaf に対応する独立 FlowCommand サブクラスが src/flow/lib/ に存在し、container 経由で run() 呼び出しにより実行可能であること。
- R3 [must]: registry.js に各個別コマンドが登録され、sdd-forge flow run finalize-commit / finalize-merge / finalize-sync / finalize-cleanup として CLI から実行可能であること。
- R4 [must]: finalize-commit の post-hook が retro 実行、report 生成、issue comment 投稿、artifacts commit を行い、現在の executeCommitPost と同等の動作をすること。
- R5 [must]: finalize-merge の実行が失敗した場合、後続の finalize-sync / finalize-cleanup leaf のステップステータスが skipped に遷移すること。
- R6 [must]: finalize-commit leaf に requiresApproval: true が設定され、他の3 leaf には設定されないこと。
- R7 [must]: 各 leaf に対応するプロンプトファイルが src/flow/prompts/impl/ に存在し、ディスパッチャーの next-action で instructionsKey 経由で取得可能であること。
- R8 [must]: buildInitialNestedSteps が新しい定義から正しいステップ構造（finalize が children を持つ branch）を生成すること。
- R9 [should]: run-finalize.js の show-report ステップ ID への updateStepStatus 呼び出しが削除されること。
- R10 [must]: 旧統合コマンド（sdd-forge flow run finalize --mode / --steps）が registry.js から削除されること。
- R11 [must]: finalize-commit 実行時に finalizePreflight（git write access チェック）と preflightChecks（no-commits / dirty-worktree チェック）が実行されること。
- R12 [must]: finalize-cleanup 実行後に、last-finalized-spec ポインタが書き込まれ、worktree/branch の削除と flow state のクリアが行われること。
- R13 [must]: 影響を受ける既存機能: (1) sdd-forge flow run finalize コマンドが廃止され finalize-commit / finalize-merge / finalize-sync / finalize-cleanup に置換される、(2) flow.json の steps 構造で finalize が branch (children 付き) になる、(3) スキルテンプレート (SKILL.md) の finalize 手順記述が新構造に対応する。影響を受けない既存機能: plan フェーズの全ステップ、impl フェーズの implement / gate-impl / review ステップ、ディスパッチャーループの next-action / promoteNextPendingLeaf ロジック。
- R14 [must]: CLI 移行: sdd-forge flow run finalize を廃止する。alpha 版ポリシーにより後方互換ラッパーは作成しない。旧コマンド実行時は registry の標準エラー ('unknown key') が返る。新コマンド名は sdd-forge flow run finalize-commit / finalize-merge / finalize-sync / finalize-cleanup。ディスパッチャーが leaf 単位で自動呼び出しするため、ユーザーが手動で個別コマンドを叩く場面は稀。
- R15 [must]: 各新コマンドの exit code 契約: 成功時は exit 0 + JSON envelope { ok: true }。失敗時は exit 1 + JSON envelope { ok: false } または Error throw (FlowCommand 基底クラスがキャッチして envelope 化)。finalize-commit: preflight 失敗 / commit 失敗で exit 1。finalize-merge: merge conflict / gh pr create 失敗で exit 1。finalize-sync: docs build 失敗で exit 1。finalize-cleanup: worktree remove 失敗で exit 1。
- R16 [must]: 各新コマンドのユーザー入力バリデーション: finalize-commit は --message (任意, 文字列) のみユーザー入力を受け取る。finalize-merge / finalize-sync / finalize-cleanup はユーザー入力を受け取らない (内部自動化専用)。--message が指定されない場合は自動生成メッセージを使用する。

## Acceptance Criteria
- FLOW_DEFINITION の finalize ノードが isBranch === true で、4 children を持つ
- flow.json の steps 構造で finalize が children 配列を持つ branch として生成される
- sdd-forge flow run finalize-commit が単体で実行可能
- sdd-forge flow run finalize-merge が単体で実行可能
- sdd-forge flow run finalize-sync が単体で実行可能
- sdd-forge flow run finalize-cleanup が単体で実行可能
- merge 失敗時に finalize-sync / finalize-cleanup が skipped になる
- npm test が全て pass する

## Implementation Targets
- src/flow/definition.js
- src/flow/lib/run-finalize.js
- src/flow/lib/run-finalize-commit.js
- src/flow/lib/run-finalize-merge.js
- src/flow/lib/run-finalize-sync.js
- src/flow/lib/run-finalize-cleanup.js
- src/flow/registry.js
- src/flow/prompts/impl/finalize.md
- src/flow/prompts/impl/finalize-commit.md
- src/flow/prompts/impl/finalize-merge.md
- src/flow/prompts/impl/finalize-sync.md
- src/flow/prompts/impl/finalize-cleanup.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Decompose finalize node in definition.js
  - FLOW_DEFINITION の finalize leaf を branch に変換し、finalize-commit / finalize-merge / finalize-sync / finalize-cleanup の4 leaf を children に定義する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Create individual FlowCommand classes for finalize sub-steps
  - run-finalize.js の各サブステップロジックを独立した FlowCommand サブクラスに分割する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update registry.js for individual finalize commands
  - registry.js の finalize 統合コマンドを4個別コマンドに置換し、hooks を移行する
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Create prompt files for each finalize leaf
  - 各 finalize leaf に対応するプロンプトファイルを作成し、ディスパッチャーの next-action で取得可能にする
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Clean up dead references and update tests
  - show-report ステップ ID の dead reference を削除し、既存テストを新構造に対応させる
  - see `tasks/T-5.md` for full spec
