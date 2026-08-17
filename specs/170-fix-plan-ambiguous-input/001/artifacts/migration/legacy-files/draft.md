# Draft: flow-plan 曖昧入力時の解釈ロジック修正と明確化フェーズの必須化

**開発種別:** 機能改善（スキルテンプレート + CLI コード変更）

**目的:** flow-plan における曖昧入力（`#133`, `133` 等）の誤解釈を防止し、draft フェーズを必須化することで要件未確定のまま実装に進むことを防ぐ。

## Q&A

### Q1: スコープ
**Q:** SKILL.md ルール変更、`--exclude` CLI 拡張、プロンプト変更を1つの spec にまとめるか？
**A:** すべて1つの spec でまとめる。ただし `--exclude` CLI 拡張は不要と判断（後述）。

### Q2: draft 固定開始の実装方法
**Q:** `plan.approach` プロンプト（draft vs spec 選択）をどう変更するか？
**A:** `plan.approach` プロンプトを削除し、Step 1 を「リクエスト解釈確認」に置換する。常に draft → spec の順で進む。

### Q3: autoApprove 時の解釈確認
**Q:** autoApprove が有効な状態で flow-plan に入った場合、解釈確認は必要か？
**A:** 不要。auto が有効 = request/issue が確定済みなのでスキップする。

### Q4: `--exclude specs/**` オプション
**Q:** `flow get context` に `--exclude` オプションを追加するか？
**A:** 不要。`flow get context --search` は analysis.json を検索するもので、specs/ は通常スキャン対象外。Issue の懸念は AI の振る舞い（SKILL.md ルール）で対処する。

## 要件まとめ

### 1. SKILL.md テンプレート変更
- Step 1: approach 選択を廃止 → 「リクエスト解釈確認」ステップに置換
- 入力解釈ルール:
  - `#<number>` → 常に GitHub Issue として優先解釈
  - `issue N` → Issue 扱い
  - `spec N` / `specs/N-...` → ローカル spec 扱い
  - 数字のみ（例: `133`）→ 曖昧入力、確認必須
- 確認完了前に `flow get context --search` を実行しない
- draft フェーズは常に実行（spec 直行の選択肢なし）
- autoApprove 時は解釈確認スキップ（request/issue 確定済み）

### 2. get-prompt.js 変更
- `plan.approach` プロンプト定義を削除（ja/en 両方）
- SKILL.md の Available step IDs から `approach` を削除

### 3. 既存機能への影響
- `flow prepare` の動作は変更なし
- `flow get context` は変更なし
- `flow-auto` スキルは変更なし
- gate / spec / impl 以降のフローは変更なし

## Approval

- [x] User approved this draft (2026-04-13)
