# Draft: 112-fix-finalize-worktree-cwd (autoApprove self-Q&A)

## 1. Goal & Scope
- flow-finalize SKILL.md の worktree モード指示を修正し、3つの問題を解消する
- SKILL.md テンプレート修正のみ。プロダクトコード変更なし

## 2. Impact on existing
- 問題の原因: SKILL.md 73行目に「MUST: メインリポジトリから実行せよ」と書いてあるが、メインリポジトリにはアクティブフローがないため NO_FLOW エラーになる
- 修正: worktree 内から実行し、完了後に cd でメインリポジトリに戻る手順に変更
- バックグラウンド実行の防止指示を追加

## 3. Constraints
- SKILL.md 修正のみ（プロダクトコード変更なし）

## 4. Edge cases
- finalize コマンドが失敗した場合: worktree は残るので cwd は有効のまま
- finalize コマンドが成功した場合: worktree が削除され cwd が無効になる → cd で復帰が必要

## 5. Test strategy
- specs/<spec>/tests/ に SKILL.md の内容検証テストを配置
- 指示の文字列存在チェック

- [x] User approved this draft (autoApprove)
