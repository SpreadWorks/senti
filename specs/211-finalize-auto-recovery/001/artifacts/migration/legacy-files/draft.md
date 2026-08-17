# Draft: 211-finalize-auto-recovery

**開発種別:** feature
**目的:** finalize 段階で頻発する merge conflict (21 specs) と no-changes (13 specs) の定型失敗を自動復旧・早期検出し、手動介入を削減する。

## Scope Verification
- In scope (priority 順):
  - **[P1]** worktree モードの squash route で、base branch が feature の分岐点より進んでいる場合、finalize は base を feature に取り込んでから merge を試行する
  - **[P1]** base branch と feature branch の間に commit 差分がない状態で finalize が起動した場合、finalize は以降の step を実行せず失敗結果を返す。結果メッセージには「差分なし」事実、未コミット変更の有無、対象となる base / feature ブランチ名を含める
  - **[P2]** 事前取り込み自体が衝突した場合、finalize は worktree を原状復帰し、失敗結果に衝突箇所と手動復旧手順を添える。後続 step は skip する
  - **[P3]** worktree に未コミット変更が残っている状態で finalize が起動した場合、finalize はその事実を含む失敗結果を返す
- Out of scope:
  - gate-impl 側の git-state 同期チェック（finalize 側で十分カバーでき、変更範囲が広がるため別 spec に分離）
  - PR ルートでの自動同期（PR の head は remote 管理であり、本 spec のローカル同期戦略ではカバーできない）
  - merge conflict の自動解決（意味的判断を要するため手動ガイダンスに留める）

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow run finalize` (worktree モード、squash ルート): base 取り込み処理が 1 回追加で発生する。同期成功時は最終的な finalize 結果は従来と同じ成功ステータスを返す。同期失敗時は失敗結果に衝突ファイルパス一覧と手動復旧手順テキストを追加する
  - finalize 失敗時の結果フォーマット: 既存の基本フィールドは維持。付加情報 (衝突ファイル一覧、base / feature ブランチ名、差分なし事実、未コミット変更の有無) はフィールド追加で導入
- 影響なし:
  - PR ルート (`mergeStrategy: "pr"`): 本変更は squash ルートのみに作用
  - spec-only mode (`featureBranch == baseBranch`): 従来通り skip
  - draft / spec / gate / test / implement / review フェーズ: 変更なし

## Q&A
- Q: merge conflict 自動復旧の発火条件は？
  - A: 常に事前同期（merge 前に base を取り込む）。
  - 根拠: **既存コードパターン** (現行の squash merge は衝突時に即エラーで、リカバリ経路を追加すると状態管理が複雑化)。常に事前同期なら並行 spec で base が進んでいるケースを常にカバーでき、衝突処理が一箇所に集約される。
- Q: 事前同期自体が衝突した場合の扱いは？
  - A: worktree を原状復帰し、衝突箇所と手動復旧手順を結果に添えて停止。finalize は失敗扱い、後続 step は skip。
  - 根拠: **guardrail "Backward-Compatible CLI Interface"** と **既存コードパターン** (失敗結果への付加情報で呼び出し元互換)。衝突解決はユーザの意味判断が必要なため自動化せずガイダンスのみ提示する。
- Q: no-changes の検知方法は？
  - A: finalize 実行開始時点で base と feature 間の差分ゼロを判定し、該当すれば以降を実行せず停止する。
  - 根拠: **既存コードパターン** (既存の preflight チェック構造に並列配置)。commit 後の merge 段階で失敗するより実行開始時点で止める方がユーザの待ち時間が短い。
- Q: 後方互換性の扱いは？
  - A: 結果フォーマットの既存基本フィールドは維持。付加情報はフィールド追加のみで導入。
  - 根拠: **guardrail "Backward-Compatible CLI Interface"**。外部契約である結果フォーマットは互換を維持する。
- Q: テスト戦略は？
  - A: 次の 4 シナリオそれぞれに対する自動テストを用意する: (1) base が先行し事前同期が成功するケース、(2) 事前同期が衝突するケース、(3) 差分ゼロで早期停止するケース、(4) 未コミット変更検出ケース。
  - 根拠: **既存コードパターン** (プロジェクトの既存テスト構成に追随)。

## Open Questions
- （なし）

## User Approval
- [x] User approved this draft (autoApprove via harness auto mode after Q1/Q2 interactive confirmation)
- Confirmed at: 2026-04-22
- Notes: Q1 (意図確認) と Q2 (merge conflict 発火条件) はユーザ対話で確認。残りの設計判断はハーネス auto モード指示に従い自律判断。
