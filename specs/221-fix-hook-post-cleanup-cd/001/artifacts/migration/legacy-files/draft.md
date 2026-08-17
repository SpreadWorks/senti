# Draft: 221-fix-hook-post-cleanup-cd

**開発種別:** bugfix
**目的:** finalize cleanup 完了後に AI が main repo への `cd` を拒否する問題を解消する。worktree 境界ルールの文言を「active の定義」と「境界解除条件」に分離し、AI が誤読せず post-cleanup の `cd` を許可できるようにする。

## Scope Verification
- In scope（requirements、優先度順で上から高い順）:
  1. **R1 (最優先):** When the partial defines worktree boundary behavior, the rule text shall place the MUST-forbid clause and the boundary-release condition clause on different top-level bullets (they shall not appear within the same bullet or sentence).
  2. **R2:** If the rule text defines "flow is active", it shall state that "active" means both of two observable conditions hold simultaneously — a status check returning active, AND the worktree directory still existing (AND semantics).
  3. **R3:** When either of the active conditions flips (status returns not-active, or the worktree directory no longer exists), the rule text shall explicitly state that the boundary is lifted and `cd` out of the (former) worktree is allowed.
  4. **R4:** When finalize cleanup has completed, the rule text shall state that the AI must immediately `cd` back to the main repo path (mandatory, not optional).
- Out of scope:
  - 実 PreToolUse hook の追加
  - CLI の出力変更
  - プロジェクト固有 CLAUDE.md の更新
  - 生成済み skill ファイルの直接編集（upgrade 経由で反映する方針）
  - 他 worktree 境界関連ルール（stash 禁止、detached worktree 案内等）の変更
  - テストの追加

## Impact on Existing Features
- 影響ありの既存機能:
  - 共有 partial を include している flow 系 skill: upgrade 経由で再生成されると該当セクションが新文言になる。step 遷移・CLI ロジックには影響しない
- 影響なし:
  - flow state 管理、finalize の cleanup 実装、git helpers などのロジック層
  - 該当 partial を include していない他 skill
  - プロジェクト固有 CLAUDE.md
  - 既存テスト一式

## Q&A
Note: 以下の Q&A は、各項目についてユーザーが意思決定モードで確定した選択を記録したもの。ブレインストーミングではなく、各質問は choice 形式で提示し、ユーザーの明示的承認後に採用を決定した。

- Q: Issue に書かれている「hook」は実際の Claude Code hook なのか？
  - A: No. 環境調査の結果、PreToolUse 等の hook は settings に登録されていない。denial メッセージ中の reason 文は AI 自身がルール文を読んで自己規制した結果の出力。本 spec の修正対象は AI が参照するルール文言のみ。

- Q: 修正アプローチの候補は？
  - A: 以下 4 案を比較した。
    - A: ルール文言のクリア化のみ（docs-only）
    - B: 実 PreToolUse hook を追加して決定論的に制御
    - C: CLI 出力で明示シグナル（例: BOUNDARY RELEASED）を出す
    - D: A + C 併用
  - 選定: **A**。denial はルール文言の解釈ミスに起因しており、文言を一義化すれば解消する見込みが高い。B は hook インフラ導入のコストが大きく alpha 期間のシンプル維持方針と合わない。C は finalize コマンドの UX 変更を伴い副作用が広い。

- Q: 境界解除の判定条件は何にするか？
  - A: 「status 確認が `active: false`」**OR** 「worktree ディレクトリ不在」の OR 条件。どちらも AI が決定論的に観測可能で誤検知リスクが無い。cleanup 完了時は両方が同時に成立する。

- Q: 変更対象範囲はどこまで？
  - A: source template の共有 partial 1 ファイルのみ。生成済み skill は upgrade で反映される。プロジェクト固有 CLAUDE.md は本 spec のスコープ外。

- Q: テスト戦略は？
  - A: テスト無し。ドキュメント文言の変更であり、機械的な回帰検知を入れるほどの価値はない。変更後の skill 出力は手動で確認する。

- Q: 書き換え方針の要点は？
  - A: 「active の定義（AND 条件）」と「境界解除トリガー（OR 条件）」を独立した項として分離し、MUST 禁止条項と解除条件を AI が混同できない構造に書き直す。具体的な文言案は spec フェーズで確定する。

- Q: 既存の他 worktree 境界ルールはどうするか？
  - A: 変更しない。本 spec は「active 定義」「境界解除条件」の明確化に限定する。他ルールは独立した MUST 項として現行のまま残す。

## Open Questions
-

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: アプローチ A（docs-only）、OR 条件、partial 単独変更、テスト無しで合意
