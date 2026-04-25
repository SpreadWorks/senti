# Draft: 228-stabilize-plan-phase-gate

**開発種別:** bugfix
**目的:** plan phase gate (gate-draft / gate-spec) の AI 評価が run 毎に不安定で不要なリトライを誘発するバグを修正する。retry 上限 + escalation と PASS→FAIL flip 検出を導入し、whack-a-mole 問題を解消する。

## Scope Verification
- In scope:
  - P1: When a plan phase gate (draft/spec) FAIL が発生したとき、retry カウンタを記録し、上限（既存設定 config.flow.retry.max、デフォルト 3）に達したら escalation する
  - P1: When plan phase gate を再実行するとき、git state hash が前回 FAIL 時と同一なら reject する
  - P1: When plan phase gate で同一の (guardrail_id, reason) ペアが連続 FAIL したとき、escalation する
  - P2: When plan phase gate の結果が出たとき、PASS した guardrail_id リストを issue-log に記録する
  - P2: When 同一内容（git state hash 同一）で gate を再実行し、前回 PASS だった guardrail が今回 FAIL になったとき、その guardrail を PASS に override する
- Out of scope:
  - gate-impl / integration の既存挙動変更
  - AI プロンプトの変更（temperature 制御等）
  - CLI コマンド引数の変更
  - gate 評価を複数 AI 呼び出しに分割する構造変更

## Impact on Existing Features
- gate 結果のログ記録: PASS した guardrail_id リストを新規フィールドとして追加。既存エントリにはフィールドが存在しないため、不在は「記録なし」として扱う
- plan phase の gate retry: 従来は retry を追跡していなかったが、本修正で追跡開始。retry 上限・no-progress ガード・repeated-fail 検出が plan phase にも適用される
- gate-impl / integration: 挙動変更なし

## Q&A
- Q1: アプローチの選定
  - A: #3（retry 上限 + escalation）を主軸に、#4（PASS→FAIL flip 検出）を補助的に組み合わせる。根拠: c612 (#194) で gate-impl に同じ仕組みを導入し効果が実証済み（既存コードパターン）。#1（全 guardrail を1回の AI 呼び出し）はソースコード上で既に実現済み。
- Q2: flip 検出の挙動
  - A: flip した guardrail は PASS に override し、残りの FAIL のみ報告する。根拠: Issue #254 の計測データで、同一内容に対して PASS/FAIL が反転する挙動が主要なコスト増因であることが判明している。
- Q3: flip override の適用条件
  - A: git state hash が同一の場合のみ適用。根拠: spec 210 の no-progress ガードが同じ手法（git state hash 比較）で内容変更の有無を判定しており、実績あるパターン。
- Q4: スコープ確認
  - A: retry 追跡の対象 phase 拡張 + PASS guardrail 記録フィールド追加 + CLI 変更なし で確定。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-25
- Notes: approach #3 + #4 combination approved
