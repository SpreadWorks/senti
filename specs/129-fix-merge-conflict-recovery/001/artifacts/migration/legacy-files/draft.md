# Draft: Fix merge conflict recovery in finalize

## Goal
finalize の squash merge で conflict が発生した場合のリカバリ処理を追加する。

## Decisions

### merge.js: conflict 時に git merge --abort
- `execFileSync("git", ["merge", "--squash", ...])` が例外を throw したら `git merge --abort` で clean な状態に戻す
- エラーを返す（throw ではなく、呼び出し元が判断できる形で）

### finalize.js: merge failed 時に後続ステップをスキップ
- merge が failed なら sync と cleanup を実行しない
- ユーザーに「rebase してから再度 finalize してください」と案内する

### registry.js: post フックで flow.json 不在時のクラッシュ防止
- cleanup でワークツリーが削除された後に post フックが flow.json を読もうとしてクラッシュする問題を修正

### flow-finalize SKILL.md: Worktree Mode に rebase 案内追加
- flow-plan と flow-impl には既にある「Before merge, consider running `git rebase <baseBranch>`」を flow-finalize にも追加

## Impact
- `src/flow/commands/merge.js`: conflict 時の abort + エラー返却
- `src/flow/run/finalize.js`: merge failed 時の後続スキップ
- `src/flow/registry.js`: post フックの flow.json 不在ガード
- `src/templates/skills/sdd-forge.flow-finalize/SKILL.md`: rebase 案内追加

## Test Strategy
- merge.js の conflict 時 abort 動作をテスト（git repo を fixture で作成し、conflict を再現）
- finalize.js の merge failed 時に後続がスキップされることを検証

- [x] User approved this draft (2026-04-02)
