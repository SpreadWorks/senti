# Draft: 228-fix-gate-retry-counter-drift

**開発種別:** bugfix
**目的:** gate retry counter の内訳表示を追加し、auto モード中にユーザーがカウンタの消費状況を正確に把握できるようにする。

## Background

spec 221 の gate-impl 実行中、retry counter が 3/3 に到達した際、ユーザーは AI 評価 FAIL が 2 回のみと認識していた。issue-log の解析結果、実際には 3 回の AI FAIL が記録されており、カウンタ自体は正しく動作していた。ユーザーが誤認した原因は表示の透明性不足。本 draft では既存のカウンタロジックは維持し、表示の改善とテストによる不変条件の保証に集中する。

## Requirements (優先順位順)

1. (must) When `flow run gate` が retry-tracked phase で実行されるとき、stderr のカウンタメッセージに内訳カテゴリ（AI-FAIL 回数）を含めて表示する
2. (must) When retry 予算が枯渇したとき、枯渇メッセージに内訳カテゴリ行を含める
3. (must) When 事前拒否（unchanged worktree / missing test evidence）により gate がスキップされたとき、stderr にリトライ予算が消費されなかった旨を表示する
4. (should) When テストスイートを実行したとき、issue-log 記録や事前拒否が gateRetry カウンタを増分しないことが検証される

## Scope Verification
- In scope:
  - gate 実行時のカウンタ内訳表示の追加
  - 事前拒否時の「予算未消費」メッセージ追加
  - 枯渇メッセージへの内訳追加
  - gateRetry 不変条件のテスト追加
- Out of scope:
  - retry max の意味変更（現行: max 回の FAIL を許容。変更なし）
  - retry 戦略の変更（exponential backoff 等）
  - retry history 表示の改善（spec 224 で対応済み）

## Impact on Existing Features
- 影響ありの既存機能:
  - `flow run gate`: stderr 出力にカウンタ内訳が追加される（既存メッセージの拡張）
  - gate 枯渇時のメッセージに内訳行が追加される
  - 事前拒否時の stderr に「予算未消費」メッセージ追加
- 影響なし: gate の判定ロジック自体、カウンタの増分ロジック、エスカレーション判定

## Q&A
- Q1: Issue #250 の報告内容に対する分析結果は?
  - A1: spec 221 の issue-log を解析した結果、実際には 3 回の AI 評価 FAIL が記録されていた。counter=3, max=3 で正しく枯渇。カウンタにバグはなく、表示の透明性不足が原因。根拠: specs/221-fix-gate-impl-untracked-diff/issue-log.json の gate post hook (auto) エントリ 3 件。(autoApprove)

- Q2: issue-log 記録はカウンタを増分するか?
  - A2: しない。根拠: 既存コードの issue-log 登録フックは issueLog カウンタのみ増分しており、gate retry カウンタには触れない。テストで保証する。(autoApprove)

- Q3: 事前拒否はカウンタを消費するか?
  - A3: しない。根拠: 既存の dispatcher が ok:false の結果に対して成功時フックをスキップする設計になっている。(autoApprove)

- Q4: テスト戦略は?
  - A4: 既存テストパターンに合わせ、不変条件テストと表示テストを追加。(autoApprove)

## Open Questions
- なし

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-24
- Notes: auto mode
