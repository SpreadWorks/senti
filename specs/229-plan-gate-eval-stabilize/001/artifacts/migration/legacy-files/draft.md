# Draft: 229-plan-gate-eval-stabilize

**開発種別:** bugfix
**目的:** gate 評価の AI が run 毎に異なる guardrail で FAIL を出す whack-a-mole 問題を、AI prompt への pass 履歴注入により解消する。

## Requirements

1. **[must]** When a gate evaluation is retried after content modification, the AI prompt shall include a list of guardrail IDs that passed in the previous evaluation, instructing the AI to only FAIL those guardrails if the new changes specifically violate them.
2. **[must]** When pass history is available from the issue-log, the prompt builder shall inject a "Previously Passed Guardrails" section into the evaluation prompt for all retry-tracked phases (draft, spec, task-impl, integration).
3. **[must]** When no pass history exists (first evaluation), the prompt shall remain unchanged from the current behavior.
4. **[should]** When the same content is re-evaluated with identical working-tree state, the existing mechanical flip override shall be retained as a fallback safety net alongside the prompt-based pass history.

## Scope Verification
- In scope:
  - Gate 評価 prompt への pass 履歴セクション注入
  - Gate 評価の共通パスで issue-log から pass 履歴を取得し prompt に渡す経路
  - 全 retry-tracked phases への適用
  - ユニットテストの追加
- Out of scope:
  - 同一内容の機械的 override（既存のまま維持）
  - issue-log の記録形式変更（既に pass 履歴が記録されている）
  - retry limit / no-progress guard / repeated-fail escalation の変更
  - AI の出力形式（JSON schema）の変更

## Impact on Existing Features
- gate 評価の AI prompt にセクションが追加される（pass 履歴がある場合のみ）
- 既存の gate 動作に影響なし（pass 履歴がない初回実行は従来どおり）
- 同一内容の機械的 override はそのまま維持され、二重防御として機能する

## Q&A
- Q1: 対処戦略は？
  - A: pass 履歴を AI prompt に注入する方式を選択。根拠: plan phase は文書全体の品質チェックなので差分ベースの再評価は不適切（既存コードの gate 評価は全文を対象としている）。
- Q2: 実装メカニズムは？
  - A: prompt に pass 履歴を注入し AI に判断させる方式を選択。根拠: 品質チェックの意味を維持しつつ judgment noise を抑制する必要がある（評価対象から除外する方式は真の品質問題を見逃すリスクがある）。
- Q3: 適用範囲は？
  - A: 全 retry-tracked phases に適用。根拠: gate 評価の共通パスに追加するため、フェーズごとの分岐は不要（既存コードで retry tracking は全4 phases で共通）。
- Q4: 同一内容の機械的 override の扱いは？
  - A: そのまま維持し二重防御。根拠: prompt 注入は soft ガイダンスで 100% の安定性は保証しないため、同一内容の場合は既存の機械的 override が最終防壁として必要。
- Q5: スコープ確認
  - A: 承認

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-25
- Notes: Issue #254 に対する修正
