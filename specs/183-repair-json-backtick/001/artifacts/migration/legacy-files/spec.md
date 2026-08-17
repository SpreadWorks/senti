# Feature Specification: 183-repair-json-backtick

**Feature Branch**: `feature/183-repair-json-backtick`
**Input**: Issue #159 — Add backtick-contaminated JSON repair to repairJson

## Goal

AI 応答 JSON 修復ユーティリティを拡張し、value の開始引用符がバッククォートになっているケース（および同 value 終端のバッククォート）を救う。これにより、retro 等の AI 応答パース失敗によるフェーズ skip を防ぐ。

## Scope

- 既存 JSON 修復ユーティリティに「value 開始位置がバッククォートのとき、開き引用符として受理し出力に二重引用符を書き込む」修復ルートを追加
- 同 value の終端も二重引用符にバッククォートを置換できるよう終端検出を拡張
- 既存ユニットテストに上記ケースの検証を追加

## Out of Scope

- AI プロンプト側の JSON 形式指示強化
- retro / review の再実行可能化（finalize cleanup の挙動変更）
- 配列要素・キー側のバッククォート開始（現実発生事例なし）

## Clarifications (Q&A)

- Q: Issue #159 の解釈は妥当か → A: 妥当（autoApprove）
- Q: 修復スコープは値の開始/終端バッククォート最小範囲でよいか → A: 最小スコープ採用
- Q: テスト配置は既存ユニットテスト追記でよいか → A: 既存ユニットテストに追記

## Alternatives Considered

- **正規表現で `:` 直後のバッククォート → `"` に単純置換**
  - 却下理由: 値本文中のバッククォート（コード識別子表示）も誤って置換するリスク
- **AI プロンプトで形式指示を強化**
  - 却下理由: AI 出力は完全には防げず、parser 側の防衛が依然必要。並行実施は妨げない
- **JSON5 等の代替パーサー導入**
  - 却下理由: 外部依存禁止に反する

## Why This Approach

- 既存修復ユーティリティの開始文字認識セットを拡張する最小差分で対応でき、修復範囲を文脈で限定できる
- 値本文中のバッククォートは別文脈（開き直後ではない）で出現するため、誤置換リスクを構造的に避けられる
- 公開 API シグネチャを変えないため、既存呼び出し側に変更不要

## Impact on Existing Features

- AI 応答 JSON 修復ユーティリティを呼ぶ既存パスは救済範囲が広がるだけで、正常 JSON の挙動は不変
- 既存ユニットテストは変更なしで pass 維持
- 上記以外の既存機能への影響: なし

## Bounded Resource Usage

- 修復処理は入力文字列の単一走査に収まり、追加ループや再帰深度は発生しない
- バッククォート修復ルートは既存パス内の分岐追加のみで、計算量は O(n)

## Exit Code Contract

- 既存 API は文字列を返すユーティリティであり exit code を持たない
- 上位 caller（retro / review）の exit code 契約は不変

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-17
- Notes: Issue #159 の決定事項に沿って自動承認

## Requirements

### P1（必須）

- **R1** When 修復ユーティリティがプロパティ値の開始位置でバッククォート (\`) を検出したとき, the system shall それを開き二重引用符として扱い、値を文字列としてパースして出力には二重引用符を書き込む
- **R2** When バッククォート開始 value の終端を検出するとき, the system shall 次に現れる二重引用符またはバッククォートのうち、直後（空白を除く）が JSON 構造区切り文字（`,` `}` `]` `:` または EOF）であるものを終端と判定し、出力に二重引用符を書き込む
- **R3** When 値本文中にバッククォートが含まれるとき, the system shall それらを通常の文字としてそのまま保持する

### P2（重要）

- **R4** When 入力が JSON.parse でそのまま受理できる正常 JSON のとき, the system shall 既存ユニットテスト群が変更なしで全て pass する出力を返す
- **R5** When 開始・終端ともにバッククォートの値が含まれるとき, the system shall 双方を二重引用符に置換し、JSON.parse 可能な文字列を出力する

## Acceptance Criteria

- 開き backtick / 閉じ double-quote のハイブリッド value を含む JSON が修復され `JSON.parse` で受理されること
- 開き backtick / 閉じ backtick の value を含む JSON が修復され `JSON.parse` で受理されること
- 値本文中の backtick がそのまま保持されること
- 既存ユニットテスト群が修正なしで全て pass すること
- 新規 unit テスト 3 本以上（R1/R2、R3、R5）が追加され pass すること

## Test Strategy

- **種別**: unit（既存の `repairJson` ユニットテストに追加）
- **検証対象**:
  1. R1/R2/R5: バッククォート開始 value の hybrid / 完全 backtick パターンが修復され `JSON.parse` 可能になる
  2. R3: 値本文に backtick を含む文字列がそのまま保持される
  3. R4: 既存の正常 JSON ケースで出力が変わらない
- **配置判定**: 「将来変更で壊れた場合は常にバグ」→ YES。公式 `tests/` 配下

## Open Questions

（なし）
