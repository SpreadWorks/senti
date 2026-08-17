# Feature Specification: 211-finalize-auto-recovery

**Feature Branch**: `feature/211-finalize-auto-recovery`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #213

## Goal
- finalize 段階で頻発する merge conflict (21 specs) と no-changes (13 specs) の定型失敗を自動復旧・早期検出し、手動介入を削減する。

## Background
- issue-log 横断調査 (85 specs, 2026-04-18) で finalize 段階の同一原因の失敗が多数記録されており、いずれも resolution null で手動復旧に委ねられている。
- 典型例: spec-133 / 142 / 146 / 159 等で並行 spec 実行により main が先行し、finalize 時に worktree 側で衝突。
- spec-142 / 146 / 149 / 152 では flow.json 更新のみのスコープや implement 未コミット状態で finalize が走り「no changes found against base branch」で失敗。

## Scope
- worktree モードの squash route で、base branch が feature の分岐点より進んでいる場合、finalize は base を feature に取り込んでから merge を試行する。
- base branch と feature branch の間に commit 差分がない状態で finalize が起動した場合、finalize は以降の step を実行せず失敗結果を返す。
- 事前取り込み自体が衝突した場合、finalize は worktree を原状復帰し、衝突ファイルパス一覧と手動復旧手順テキストを失敗結果に添える。
- worktree に未コミット変更が残っている状態で finalize が起動した場合、finalize はその事実を含む失敗結果を返す。

## Out of Scope
- gate-impl 側の git-state 同期チェック（finalize 側で十分カバーでき、変更範囲が広がるため別 spec に分離）。
- PR ルートでの自動同期（PR head は remote 管理のためローカル同期戦略ではカバーできない）。
- merge conflict の自動解決（意味的判断を要するため手動ガイダンスに留める）。

## Constraints
- 外部依存追加禁止。Node.js 組み込みモジュールと既存ヘルパーのみ使用する。
- alpha 版ポリシー: 後方互換のための旧コード保持は不要。ただし finalize 結果フォーマットの既存基本フィールド (`status`, `message`) は外部契約として互換維持する。
- CLI インターフェース (`sdd-forge flow run finalize` のオプション) の意味変更はしない。
- 事前取り込み / 差分検査で追加する git 操作は bounded (1 回の fetch, 1 回の rebase, 1 回の rev-list)。
- **Exit code contract**: 新たに導入する失敗ケース (rebase 衝突 / no-commits / dirty-worktree) で `finalize run` が失敗結果を返す場合、プロセスは non-zero exit code で終了すること。結果の `status: "failed"` と exit code の双方で失敗を表現する。

## Design Principles
- 衝突処理の分岐を一箇所に集約する（事前同期で base を先取りし、squash merge 実行時点では衝突発生要因を排除する）。
- 早期失敗: finalize 実行開始時点で差分ゼロ・未コミット変更などの前提条件違反を検出して停止する。
- 情報性のある失敗結果: 失敗時は原因特定に必要な情報（衝突ファイル、差分有無、ブランチ名、復旧手順）を結果オブジェクトに含める。
- 既存失敗結果の呼び出し元は変更なく動作する（付加情報はフィールド追加のみ）。

## Overview
### Modules
- `src/lib/git-helpers.js`: fetch / rebase / rebase --abort / rev-list / status ヘルパーの追加。副作用のある git 操作を単一箇所に集約。
- `src/flow/commands/merge.js`: squash merge 前に base を取り込む事前同期処理を追加。rebase 衝突時は abort + 構造化エラー。
- `src/flow/lib/run-finalize.js`: preflight に no-changes / dirty-worktree 検知を追加し、該当時は以降の step を skip して失敗結果を返す。

### Data Flow
- finalize 起動 → preflight: git write access 確認 + base/feature 差分チェック + worktree dirty チェック。問題があれば即停止。
- preflight OK → step1 commit (既存) → step2 merge: 事前 fetch + rebase → squash merge → commit。rebase 失敗 or squash merge 失敗で失敗結果を返す。
- step2 で失敗 → step3 sync / step4 cleanup は skip（既存の "skipped due to merge failure" パターンを踏襲）。

### Decisions
- 常に事前同期（merge 前に rebase）: 現行 squash merge は衝突時に reset 済み前提の即エラーで、後追いリカバリは状態管理が複雑化する。事前同期なら並行 spec で base が先行するケースを常にカバーでき、衝突処理を一箇所に集約できる。
- 衝突自動解決は行わず手動ガイダンスのみ: 意味判断が必要なため。
- no-changes は preflight で早期検出: commit 段階まで進んでから失敗するより待ち時間が短い。

## Clarifications
- Q: merge conflict 自動復旧の発火条件は？
  - A: 常に事前同期。merge step 開始時に worktree で `git fetch origin <base> && git rebase <base>` を必ず試行する。
- Q: 事前同期が衝突した場合は？
  - A: `git rebase --abort` で worktree を原状復帰。失敗結果に衝突ファイル一覧と手動復旧手順（rebase → 衝突解決 → continue → 再 finalize）を含め、後続 step は skip。
- Q: no-changes の検知方法は？
  - A: preflight で base と feature 間の `git rev-list --count <base>..<feature>` を評価。0 なら早期停止し、未コミット変更有無を結果に含める。
- Q: 後方互換性の扱いは？
  - A: 結果オブジェクトの `status` / `message` 基本フィールドは維持。付加情報 (`conflictFiles`, `baseBranch`, `featureBranch`, `hasNoCommits`, `hasUncommitted`, `recoveryHint`) はフィールド追加で導入。

## Alternatives Considered
- **衝突時のみ rebase リトライ**: 不要時の処理を省けるが、squash merge で失敗した後の worktree 状態（reset 済み）から rebase に移行する分岐が複雑化。却下。
- **separate pre-flight 確認プロンプト**: ユーザに事前同期可否を問う UX だが auto モード実行を阻害し、21 件中多くは単純な base 先行ケースで対話不要。却下。
- **gate-impl 側でチェック**: impl フェーズと finalize フェーズで重複実装になる。finalize のみで十分かつ変更範囲が狭い。本 spec では finalize 側のみに限定。

## User Confirmation
- [x] User approved this spec (autoApprove via harness auto mode after Q1/Q2 interactive confirmation)
- Confirmed at: 2026-04-22
- Notes: draft 段階で Q1 (意図確認) と Q2 (merge conflict 発火条件) はユーザ対話で確認。残りの設計判断はハーネス auto モード指示に従い自律判断。

## Requirements
- **[P1][R1]** worktree モードの squash route で `finalize run` が merge step を実行する際、merge step は事前に `git fetch origin <baseBranch>` と `git rebase <baseBranch>` を worktree で実行してから squash merge を行うこと。
- **[P1][R2]** `finalize run` 開始時に、`git rev-list --count <baseBranch>..<featureBranch>` == 0 の場合、preflight は以降の step を実行せず `status: "failed"` の結果を返すこと。結果には `reason: "no-commits"`, `baseBranch`, `featureBranch`, `hasUncommitted` (未コミット変更の有無) を含めること。
- **[P2][R3]** R1 の rebase が衝突した場合、merge step は `git rebase --abort` を実行して worktree を原状復帰し、`status: "failed"`, `conflictFiles: <string[]>`, `recoveryHint: <string>` を含む結果を返すこと。後続 step (sync, cleanup) は `status: "skipped", message: "skipped due to merge failure"` とすること。
- **[P3][R4]** `finalize run` 開始時に worktree で `git status --porcelain` が非空の場合、preflight は `status: "failed"`, `reason: "dirty-worktree"`, `uncommittedFiles: <string[]>` を含む結果を返すこと。
- **[P2][R5]** 上記すべての失敗ケースで、結果オブジェクトは既存の `status` および `message` フィールドを保持し、付加情報は新規フィールドとして追加すること（既存呼び出し元は破壊しない）。
- **[P2][R6]** spec-only モード (`featureBranch == baseBranch`) と PR route (`mergeStrategy: "pr"`) では R1/R3 の事前同期処理は実行しないこと。

## Acceptance Criteria
- worktree モードで base branch が 1 commit 進んだ状態から finalize を実行すると、rebase が透過的に成功し squash merge も成功する（自動テスト）。
- 故意に衝突するファイル変更を base と feature 双方で行った状態で finalize を実行すると、worktree が rebase 前の状態に戻り、結果に `conflictFiles` と `recoveryHint` が含まれる（自動テスト）。
- feature branch に commit を追加せず finalize を実行すると、preflight で `status: "failed", reason: "no-commits"` が返り、commit/merge step は実行されない（自動テスト）。
- worktree にステージされていない変更を残して finalize を実行すると、preflight で `status: "failed", reason: "dirty-worktree"` が返る（自動テスト）。
- PR route では事前同期処理が呼び出されないことを確認（自動テスト）。
- 既存の finalize 成功ケース（base 非先行、クリーン状態）が既存挙動と同じ成功ステータスを返すこと（既存テストが pass する）。

## Implementation Targets
- `src/lib/git-helpers.js`: 新規ヘルパー関数を追加
  - `fetchBranch(remote, branch, opts)`: `git fetch <remote> <branch>` を実行
  - `rebaseOnto(baseRef, opts)`: `git rebase <baseRef>` を実行。衝突時は { ok: false, conflictFiles } を返す
  - `abortRebase(opts)`: `git rebase --abort` を実行
  - `countCommitsBetween(base, head, opts)`: `git rev-list --count <base>..<head>` の数値を返す
  - `listUncommittedFiles(opts)`: `git status --porcelain` の出力から変更ファイル配列を返す
- `src/flow/commands/merge.js`:
  - `runSquashMerge` 呼び出し前に `fetchBranch` + `rebaseOnto` を呼ぶ処理を追加（worktree モードかつ squash route のみ）
  - rebase 衝突時は `abortRebase` を呼び、衝突情報を含む Error を throw
- `src/flow/lib/run-finalize.js`:
  - `runFinalizePreflight` に `countCommitsBetween` と `listUncommittedFiles` のチェックを追加
  - 差分ゼロ or dirty worktree 検出時は以降の step を skip し、構造化結果を返す
- `tests/` 配下: 上記変更に対応する自動テストを追加

## Open Questions
- （なし）
