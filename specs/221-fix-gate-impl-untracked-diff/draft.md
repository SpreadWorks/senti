# Draft: 221-fix-gate-impl-untracked-diff

**開発種別:** bugfix
**目的:** gate-impl 評価が untracked な新規ファイルを見落とす不具合を修正し、test-first フローで作成された新規テストファイルが gate に必ず反映されるようにする。

## Requirements (priority order)

1. **(P1) untracked ファイルの可視化**: When gate-impl が diff 評価を行う際に untracked ファイル（`.gitignore` で除外されないもの）が作業ツリーに存在する shall 当該ファイルの内容が新規追加として diff 評価に含まれる。
2. **(P1) 既存判定ロジックの非破壊**: When 上記 P1 によって diff 内容が増加する shall 既存のテスト改変検知 (test-file additions/modifications check) およびガードレール評価が従来通り動作する（標準 unified diff 形式が維持される）。
3. **(P2) 副作用の禁止**: When untracked を diff に取り込む処理が実行される shall git index / 作業ツリーに永続的な変更を加えない（一時的な `git add -N` 等を残さない）。
4. **(P2) 同様症状の対称的解決**: When untracked な src 側ファイルが存在する shall そのファイルも同様に diff 評価へ含まれる（テストファイルに限定しない）。

## Scope Verification
- In scope:
  - gate-impl / gate-integration の diff ベース評価における untracked ファイル取り扱いの修正
- Out of scope:
  - draft / spec / task-spec フェーズの挙動変更
  - preflight 警告や `git add -N` の自動実行
  - `.gitignore` ルールの変更

## Impact on Existing Features
- 影響ありの既存機能:
  - **gate-impl / gate-integration**: When gate を実行する shall untracked ファイルも評価対象となる。これにより従来 FAIL になっていた「test-first で新規テストファイルを作成 → 即 gate-impl 実行」の正常ケースが PASS するようになる。
  - **test-file 改変検知**: When untracked テストファイルが新規追加として diff に現れる shall 既存検知ロジックが「multi-line `+` only hunks → PASS」のルールでこれを正しく許可する。
- 影響なし:
  - draft / spec / task-spec フェーズ
  - flow run review / finalize / sync
  - computeGitState（既に porcelain status を hash に含む）

## Q&A
- Q1: Issue #238 の理解は「gate-impl が untracked な新規テストファイルを diff 評価で見落とす不具合の修正」で正しいか？
  - A: [1] はい
  - 根拠: Issue 本文（症状・再現・原因・対応案）と一致

- Q2: 対応方式は A (diff 合成) / B (preflight 警告) / 両方 のどれか？
  - A: [1] A 案 — diff に untracked を合成する
  - 根拠: Issue「影響」節および project memory `feedback_no_shortcuts.md`（場当たり的な修正をしない）に基づき、警告ベースの対症療法ではなく diff 評価そのものを正しくする全体設計を選択

- Q3: untracked ファイルの取り込みに副作用（index 変更等）を許容するか？
  - A: [1] 副作用を許容しない（読み取りのみで diff 評価を完結させる）
  - 根拠: project rule「過剰な防御コードを書かない」「シンプルなインターフェース」と、共有 git 状態を変更しない原則（`feedback_no_shared_repo_git_ops.md`）に整合

- Q4: untracked ファイルのフィルタ範囲は？
  - A: [1] 全 untracked ファイル（テスト限定しない）
  - 根拠: `.gitignore` 由来は git 標準で除外される。untracked な src ファイルも同じ症状を引き起こすため対称的に解決する方が gate-impl の「全変更を見る」設計に合致

- Q5: 回帰検知の戦略は？
  - A: [1] 自動テストを追加する
  - 根拠: project rule「テストを通すためにテストコードを修正してはならない」を遵守するため、untracked 取り込みの正/負シナリオを事前に固定する

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: 5 Q&A 完了。bugfix スコープ・対応方針合意済み
