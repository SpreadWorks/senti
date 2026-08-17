# Feature Specification: 129-fix-merge-conflict-recovery

**Feature Branch**: `feature/129-fix-merge-conflict-recovery`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #65

## Goal
finalize の squash merge で conflict が発生した場合に、`git merge --abort` で clean な状態に戻し、後続ステップ（sync, cleanup）をスキップしてユーザーに rebase を案内する。また registry.js の post フックで flow.json 不在時のクラッシュを防止する。

## Scope
- `src/flow/commands/merge.js`: conflict 時に `git merge --abort` + エラー返却
- `src/flow/run/finalize.js`: merge failed 時に後続ステップをスキップ
- `src/flow/registry.js`: post フックで flow.json 不在時のクラッシュ防止
- `src/templates/skills/sdd-forge.flow-finalize/SKILL.md`: Worktree Mode に rebase 案内追加

## Out of Scope
- conflict の自動解決（AI による conflict resolution）
- rebase の自動実行（ユーザーに案内するのみ）
- branch モード（非 worktree）での conflict ハンドリング改善

## Clarifications (Q&A)
- Q: conflict 時に自動で abort するか、conflict 状態を残すか？
  - A: 自動で abort する。finalize は自動化パイプラインであり、conflict 状態を残しても AI が手動解決することはできない。
- Q: registry.js の post フック修正はこの spec のスコープに含めるか？
  - A: 含める。merge conflict → finalize 失敗 → post フックで flow.json 不在クラッシュ、という一連の流れで発生する問題。
- Q: flow-finalize SKILL.md に rebase 案内を追加するか？
  - A: 追加する。予防（SKILL.md で案内）とリカバリ（コードで abort + スキップ）の両方があるほうが堅牢。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-02
- Notes: autoApprove mode

## Requirements

要件は実装順序に沿って番号付けされている。優先順位は R1 > R2 > R3 > R4 の順。

### R1: merge.js の conflict リカバリ
`merge.js` の squash merge（worktree モード・branch モード両方）で `execFileSync("git", ["merge", "--squash", ...])` が例外を throw した場合、`git reset --merge` を実行して clean な状態に戻し、conflict 情報を含むエラーオブジェクトを返す。（squash merge の conflict は `git merge --abort` では解除できず、`git reset --merge` が必要。）

### R2: finalize.js の後続スキップ
`finalize.js` で merge ステップの結果が `{ status: "failed" }` の場合、以下の後続ステップを実行せずスキップする:
- sync（ドキュメント同期）
- cleanup（ワークツリー/ブランチ削除）

merge failed 時のエラーメッセージに「rebase してから再度 finalize してください」の案内を含める。

### R3: registry.js の post フック安全化
`registry.js` の post フックで `loadFlowState()` を呼ぶ際、flow.json が存在しない場合（cleanup 後など）にクラッシュせず、フックを静かにスキップする。

### R4: flow-finalize SKILL.md の rebase 案内
`src/templates/skills/sdd-forge.flow-finalize/SKILL.md` の Worktree Mode セクションに以下を追加する:
「Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid merge conflicts.」

### 破壊的変更
なし。merge conflict 時の動作が「クラッシュ/不整合」から「abort + スキップ + 案内」に改善されるのみ。

## Acceptance Criteria
- squash merge で conflict が発生した場合、`git merge --abort` が実行されて作業ディレクトリが clean に戻る
- merge failed 時、sync と cleanup はスキップされる
- merge failed 時、finalize の結果に rebase の案内メッセージが含まれる
- cleanup 後に registry.js の post フックがクラッシュしない
- flow-finalize SKILL.md の Worktree Mode セクションに rebase 案内がある
- 既存テストがパスする

## Open Questions
(none)
