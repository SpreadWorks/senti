## Draft: 202 — add-gate-impl-integration-tests

**開発種別:** テスト追加 (bug fix backfill — spec 201 の acceptance criteria 未達部分の補完)

**目的:** spec 201 (gate-impl-eval-accuracy) の acceptance criteria で「integration test で確認できる」と宣言されながら実際には unit test 相当で済ませた項目を、真の end-to-end integration test として補完する。gate-impl の配線（test 変更機械判定・post-hook による counter 更新・retry 上限到達時のエスカレーション）が将来 refactor で切れた際に、unit test だけでは検知できない regression を検知できるようにする。

## Q&A

### Q1: 意図確認
- A: spec 201 acceptance criteria のうち「integration test で確認できる」と明記された 5 項目を integration test として追加する。unit test はそのまま残す。
- 根拠: issue #196 本文（spec 201 merge 後の gap として明記された 5 項目）および spec 201 spec.md の Acceptance Criteria 直接引用。

### Q2: テスト配置先
- A: 長期維持すべき API contract として `tests/` 配下（e2e テスト領域）に配置する。
- 根拠: 「将来 refactor で配線が切れたら常にバグ」に該当するため、project ルール「If a future change breaks this test, is that always a bug? → YES なら tests/」に従う。

### Q3: AI 呼び出しの扱い
- A: 実 AI 呼び出しは行わない。既存 e2e テストと同じ決定論的 provider パターンに倣い、PASS 判定相当の固定応答を返すよう構成する。
- PASS 系ケースのみ AI 経路が到達するため stub が必要。FAIL 系・ESCALATE 系は AI 手前で終わるため stub 無しでも動作可能。

### Q4: 要件の優先順位
- A: issue #196 で明記された 5 項目を以下の優先順で扱う:
  1. **最優先**: PASS wiring（軸 C の積極的な regression 検知）
  2. **最優先**: FAIL wiring（同上、攻撃ベクトル検知）
  3. ESCALATE end-to-end（軸 A の最終防衛線）
  4. post-hook counter 遷移（軸 A の基礎配線）
  5. ESCALATE 戻り値形式一致（run-draft-task との一貫性検証）

### Q5: ESCALATE 戻り値一致の定義
- A: spec 201 既決の「例外形式」に沿い、run-draft-task の retry 尽き時と同一のエラー識別子を使用していることを「形式一致」の定義とする。具体的な識別子シンボル値は spec で明示する。

## Requirements

### R1: PASS wiring（優先度 1）
When 既存 test ファイルに複数行の新規 test case を追加する diff の状況で `sdd-forge flow run gate --phase task-impl` を実行した場合, gate は PASS を返 shall する。

### R2: FAIL wiring（優先度 1）
When 既存 test ファイルに対し assert 書換 / 行削除 / skip 化 / 1 行追加 を含む diff の状況で `sdd-forge flow run gate --phase task-impl` を実行した場合, gate は FAIL を返 shall する。

### R3: ESCALATE end-to-end（優先度 2）
When `state.metrics[phase].gateRetry` が retry 上限値以上の状態で `sdd-forge flow run gate --phase task-impl` を実行した場合, プロセスは非 0 exit code で終了 shall し、stderr または stdout に過去 FAIL 回数と FAIL 理由を含む retry 履歴テキストが含 shall まれる。

### R4: post-hook counter 遷移（優先度 3）
If gate-impl 実行が PASS で終わった場合, retry 回数カウンタは 0 にリセット shall する。If FAIL で終わった場合, retry 回数カウンタは +1 増加 shall する（CLI 実行後の永続状態で検証可能）。

### R5: ESCALATE 戻り値形式の一貫性（優先度 4）
When 上限到達時に gate-impl がエスカレートする場合, 送出されるエラーの識別子は既存の retry 尽き時エスカレーション（run-draft-task）と同一で shall ある（同一 symbol による形式一貫性）。

## Impact on Existing Features

- **production code 変更なし。** 新規テスト追加（および再利用可能な test helper）のみ。
- 既存 unit test は削除・改変しない（unit と integration の 2 層体制となる）。
- `npm test` 全体の実行時間が増加する。許容範囲は spec で定量化する。

## Test Strategy

- 通常の `npm test` で実行される長期維持テストとして追加する。
- AI 呼び出しの扱いは「決定論的な代替（既存プロジェクトの stub パターンに準拠）」とし、実 AI を呼ばない。具体的な配線方式は spec で定義する。

## Alternatives Considered

- **unit test の拡充に留める**: 内部関数を直接呼ぶ unit test では、gate-impl ディスパッチ経路や post-hook の配線変更時の regression を見逃す。「integration test で確認できる」と明記した spec 201 acceptance criteria に反する。
- **acceptance test 領域に置く**: acceptance は fixture ベースの preset/docs 出力検証が中心。gate CLI 挙動の end-to-end 検証は e2e 領域が適切。
- **実 AI 呼び出し**: コスト増・flakiness・外部サービス依存のため却下。既存 e2e と同じ決定論的応答方式で十分。

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-04-21
- Notes: Q&A 3 ラウンドで論点確認（配置 / AI stub 方針 / CLI 方式・fixture・集約方式・ESCALATE 形式）。gate-draft feedback に基づき requirements を When/If + shall 形式に再整理し、優先順位を付与、実装詳細を spec フェーズに委譲。
