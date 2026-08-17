# Draft: 097-flow-impl-finalize-rework

## Q&A

### Q1: impl 最終確認導線
- Q: finalize 前の確認をどう変えるか？
- A: 「承認 / 概要確認 / 詳細確認 / その他」の4択。flow run impl-confirm --mode overview|detail を使用。

### Q2: review 方針と指摘提示
- Q: review の進め方は？
- A: 方針3択（自動改善 / レビューのみ / しない）。「レビューのみ」選択時のみ1件ずつ提示（(n/N) 進捗表示、各件質問で終了、全回答収集後にまとめて反映）。自動改善は現行通り一括。

### Q3: finalize context/path 解決
- Q: worktree のパス取り違えをどう防ぐか？
- A: finalize 開始時に flow get resolve-context でパス確定。mainRepoPath/worktreePath を以後の全操作で使用。

### Q4: finalize step 0 説明
- Q: 選択肢の説明を追加するか？
- A: はい。finalize.mode の各 choice に description を追加。prompt.js を更新。

### Q5: merge/cleanup 分岐
- Q: worktree/branch の判定ロジックをどこに置くか？
- A: CLI 側（flow run merge/cleanup）に寄せる。skill は結果を使って次の行動を決めるだけ。

### Q6: prompt kind 更新
- Q: どの kind を更新するか？
- A: impl.review-mode（自動改善/レビューのみ/しない）、impl.confirmation（承認/概要/詳細/その他）、finalize.mode（description 追加）。

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-29
