# Draft: 219-finalize-preflight-no-commits

**開発種別:** bugfix
**目的:** `flow run finalize` の preflight が、commit step が処理すべきケース（コミット 0 件 + 未コミット差分あり、および dirty-worktree）まで弾く問題を修正する。

## 要件（優先順位順）

- **R1 (Must)**: commit step を実行する finalize 呼び出しでは、未コミット差分があれば preflight を通過し、commit step が初コミットを作成して finalize を継続できること。
- **R2 (Must)**: commit step を実行する finalize 呼び出しでは、ahead > 0 かつ未コミット差分ありの状態でも preflight を通過し、commit step が差分を吸収して継続できること（abe0 相当）。
- **R3 (Must)**: commit step を**含まない** finalize 呼び出し（merge / sync / cleanup のみ実行）では、未コミット差分があれば preflight が `dirty-worktree` で停止すること（後続ステップが不安定な状態で動かないように）。
- **R4 (Must)**: 真に「やる仕事ゼロ」（feature ブランチに commits 0 件かつ未コミット差分も無し）の場合は、引き続き `no-commits` で停止すること。
- **R5 (Should)**: spec-only モード（feature == base）は従来通り全 preflight チェックを skip すること。

## Scope Verification
- In scope:
  - finalize の preflight 判定方針の見直し（commit step 実行有無に応じた分岐）
  - Issue #232 (5b26: no-commits 分岐) と board item abe0 (dirty-worktree 分岐) の両方を本 spec で解決
  - 既存テスト（finalize early-stop 系）を新仕様に合わせて更新
- Out of scope:
  - commit / merge / sync / cleanup の各ステップ本体のロジック変更
  - commit メッセージのカスタマイズ機能
  - finalize の選択実行モードに関する他用途拡張
  - spec 211 の文言修正（必要に応じて挙動更新を本 spec の Notes に記録するに留める）

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow run finalize`: preflight が緩和され、コミット 0 件かつ未コミット差分ありの feature ブランチで finalize が成功するようになる（現在は `preflight_failed` で停止）
  - `sdd-forge flow run finalize` の dirty-worktree 分岐: commit step を含む実行で preflight を通過するようになる
  - finalize early-stop 系の単体テスト: 新仕様に合わせて期待値を更新
- 影響なし: docs 自動生成、commit / merge / sync / cleanup の各ステップ本体、その他の flow コマンド

## Q&A
- Q1: スコープ — abe0 (dirty-worktree 分岐) も本 spec で同時修正するか？
  - A: する。判定条件を一度で正しく書ける。Issue #232 本文も両分岐を一体で扱う方針を明記している。
- Q2: commit step を含まない実行（例 `--mode select --steps 2,3,4`）の dirty-worktree 扱いは？
  - A: 条件分岐方式。commit step を含む時は緩和、含まない時は dirty-worktree で停止。事前に弾く方が原因が明確（merge の事後エラーは状況依存で原因が分かりにくい）。
- Q3: 既存テストの扱いは？
  - A: 新仕様で書き換える。alpha 版・後方互換コードは書かない方針に従う。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes:
  - spec 211 の R2 (no-commits early stop) / R4 (dirty-worktree early stop) は本 spec で挙動が更新される（spec 211 自体の文言修正は out of scope）。
