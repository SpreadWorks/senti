# Draft: 223-fix-test-summary-shape

**開発種別:** bugfix
**目的:** `flow set test-summary` の partial 入力が baseline と shape 不一致を起こし、gate-impl が「regression evidence incomplete」と誤判定する問題を解消する。

## Scope Verification
- In scope（優先順位順）:
  1. **[最優先]** `flow set test-summary` に baseline shape 継承を導入する。baseline が存在する場合、未指定の count フィールド (unit/integration/acceptance) を baseline の値で補完して保存する
  2. legacy flag モード (`--unit/--integration/--acceptance`) と `--json` モードの `counts` の両方に継承を適用する
  3. baseline が未記録の場合は現行挙動を維持する（指定フィールドのみ保存）
  4. exitCode は継承しない
  5. 上記挙動を検証する unit test を追加する
- Out of scope:
  - gate-impl の評価プロンプト変更
  - skill / prompts ドキュメントの文言変更
  - `flow run tests` 経由のパス（現状すでに full shape を記録）
  - `--mode fallback` のパス（counts を書かないため無関係）
  - `--baseline` 書き込み自身の継承（継承元が存在しない）
  - tool monopoly (TEST_SUMMARY_LOCKED) ロジック

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow set test-summary --unit N` 等の partial 入力: baseline 存在時は未指定フィールドが baseline 値で自動補完される
  - gate-impl: head が baseline と同一 shape になり、shape mismatch による「evidence incomplete」誤判定が消える
- 影響なし:
  - `flow run tests` / `flow run tests --baseline`（すでに full shape で書いているため）
  - `flow set test-summary --mode fallback`（failed[] 専用で counts を書かない）
  - TEST_SUMMARY_LOCKED チェック
  - baseline 自身の書き込み

## Q&A
- Q: 対応案 A/B/C のうちどれを採用するか
  - A: A（baseline shape 継承）を採用。
  - 根拠: (1) 既存コードパターン — ツール経由の test 実行はすでに full shape を CLI 側で書いており、これに揃える方が一貫する。(2) CLAUDE.md「シンプルなインターフェースに十分な実装を隠す」原則 — ユーザ側の指示を増やす B/C より CLI 内部で解決する方が整合。(3) Issue #251 本文で推奨として挙げられた案。
- Q: baseline が無い場合の挙動
  - A: 現行通り partial 保存。
  - 根拠: gate-impl は baseline 無しの場合すでに head-only 評価に分岐するため、shape mismatch 問題はそのパスでは発生しない。0 埋め等の追加処理は不要。
- Q: `--json` モードの counts にも同じ継承を適用するか
  - A: 適用する。
  - 根拠: 入力経路ごとに挙動を分けると継承が抜けた経路で同じバグが再発する。両経路で共通の保存形を保証するのが DRY 原則に沿う。

## Backward Compatibility / Migration
- CLI 名・オプション・必須引数に変更なし。`--unit/--integration/--acceptance/--json/--mode/--baseline` のシグネチャは保持する。
- 挙動変更: partial 入力 + baseline あり時のみ、保存される JSON 形が「指定フィールドのみ」から「baseline shape にマージ」へ変わる。これはバグ修正として整合性を回復する変更。
- プロジェクトは alpha 期間（CLAUDE.md「後方互換コードは書かない」）のため migration shim は追加しない。旧挙動に依存した user コードは存在しない（head 側の partial shape を参照する CLI 内部の gate-impl 経路が唯一の consumer で、本修正の対象）。
- ドキュメント追記: 本修正をリリースノート／changelog で「head shape を baseline shape に合わせて補完」と明記する対応は、`flow run sync` の通常フローに任せる。

## Open Questions
-

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: A (baseline shape 継承) を採用。プロンプト・skill は out of scope。
