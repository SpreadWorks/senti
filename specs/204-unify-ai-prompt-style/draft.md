# Draft: unify-ai-prompt-style

**開発種別:** 品質改善（prompt template 標準化）

**目的:** sdd-forge が AI にユーザー向け質問・選択肢を生成させる際、文体・前提知識・選択肢提示形式を単一ソースのルールで規定し、モデル差に起因する出力ばらつきを抑える。

## Impact on Existing Features

- **Skill 本体テンプレート**: 新ルールが追加で表示される。既存フロー挙動は変わらない。
- **Step instruction テンプレート（質問・選択肢を生成するもの）**: 新ルールが追加で表示される。既存の instruction 本文は維持される。
- **配布**: 次回アップグレード時に skill 本体のルール追加が既存プロジェクトに反映される。
- **対象外**: subagent プロンプト生成ロジック（gate 理由文・review 指摘文の生成）、draft テンプレート構造や section 検証（4a7d の領域）、lint / guardrail DSL。

## Priority

Requirements の優先順位:

1. **P1（必須）**: R1, R2 — ルールの単一ソース化と両層への一貫適用
2. **P2（必須）**: R3, R4 — 配布と整合性の検証
3. **P3（推奨）**: R5 — few-shot 例示

## Q&A

### Q1: 対象スコープ（層）

**Ask:** AI が生成する質問・選択肢の発生源は複数層ある。どこまでを対象とするか。

**Answer:** ユーザーに直接表示される質問・選択肢を生成する層のみ。subagent が生成する評価文（gate 理由・review 指摘）は別 spec に分離。

**Recommendation rationale:** Issue 原文がユーザー向け UI を主対象としていること、および subagent プロンプトの共通化は設計コスト・既存テスト影響が大きく Guardrail「Single Responsibility」に反することから、スコープを絞る。

### Q2: ルール配置方法

**Ask:** 同一ルールを複数のテンプレートで共有する方法。

**Answer:** 単一ソース（共通パーシャル）として保持し、各テンプレートから参照する。

**Recommendation rationale:** プロジェクト CLAUDE.md 「同じパターンが 2 箇所以上で繰り返される場合、共通ヘルパーに抽出する」に従い、DRY を優先する。既存の共通パーシャル運用パターンと整合する。

### Q3: ルール内容

**Ask:** パーシャルに含める制約カテゴリ。

**Answer:** Issue e162 記載の 3 カテゴリ（文体 / 前提知識 / 選択肢提示）に加え、各カテゴリに最低 1 組の good/bad 例を添付。

**Recommendation rationale:** Issue e162「検討ポイント」で few-shot 例示の追加可否が挙がっている。例示なしではモデル間の解釈ブレが残り、本 spec の目的（モデル差の抑制）を達成しにくい。

### Q4: テスト戦略

**Ask:** 自動テストの粒度。

**Answer:** 構造テスト（参照配線の整合性、展開結果の正しさ）のみ。AI 出力の性質テストは対象外。

**Recommendation rationale:** LLM 出力は非決定的で自動テスト困難。既存プロジェクトの静的整合性テスト方針と整合する。

### Q5: 層 A の適用範囲

**Ask:** Step instruction テンプレート群のうち、全てに適用するか質問生成 step に絞るか。

**Answer:** ユーザーに質問・選択肢を提示する step のみ。

**Recommendation rationale:** 非対話 step（gate / spec 記述 / implement 等）に質問・選択肢ルールを適用する意義が薄く、Guardrail「Single Responsibility」に沿って範囲を絞る。

## Requirements

- **R1（P1）**: When skill 本体層または step instruction 層のテンプレートがリポジトリに追加・編集される時、system shall 共通ルールの定義を単一の正規ソースに保持し、両層のテンプレートがそこを参照する形式を維持する。
- **R2（P1）**: When ユーザーに質問・選択肢を表示するテンプレートが render される時、system shall 共通ルール本文を出力結果に含める（skill 本体層・step instruction 層の両方で）。
- **R3（P2）**: When ユーザーが skill のアップグレードコマンドを実行する時、system shall 更新された共通ルールを対象プロジェクトの skill 本体に反映する。
- **R4（P2）**: When リポジトリの test suite が実行される時、system shall 共通ルールの参照配線と展開結果の整合性を検証する検査ケースを通過する。
- **R5（P3）**: When 共通ルール本文がコミットされる時、system shall 各ルールカテゴリ（文体 / 前提知識 / 選択肢提示）に少なくとも 1 組の good/bad 例を含んだ状態とする。

## Acceptance Criteria

- **AC-1 (R1, R2)**: ユーザーに質問・選択肢を表示するテンプレート全てで、共通ルールが render 結果に現れる。
- **AC-2 (R2)**: skill 本体層と step instruction 層の両方で同じ共通ルールが適用される（ルール本文が両層の render 結果に重複なく反映されている）。
- **AC-3 (R3)**: skill アップグレード後、プロジェクト側の skill 本体に新ルール本文が現れる。
- **AC-4 (R4)**: 参照配線の整合性テストと展開ユニットテストが通る。
- **AC-5 (R5)**: 共通ルール内に、文体 / 前提知識 / 選択肢提示 の各カテゴリで少なくとも 1 組の good/bad 例が含まれる。
- **AC-6**: 共通ルールが避けるべきとする曖昧語リストは、既存 draft/spec gate 相当の曖昧語判定と矛盾しない。

## Alternatives Considered

- **subagent プロンプトも統合スコープに含める**: gate/review 出力まで一貫改善できるが、JS ロジックの共通化は設計コストが高く、既存テストへの影響も大きい。Single Responsibility 違反。別 spec に分離。
- **共通化せずテンプレート単位で個別記述**: 参照配線を省略できるが、同一ルールが複数箇所に存在し編集時の同期漏れリスク。DRY 違反。
- **4a7d と統合**: touch 領域が異なる（4a7d はドラフトテンプレート構造と section 検証、本 spec はテンプレート間の共通ルール配線）。Single Responsibility に沿って分離。

## Open Questions

- 共通ルール内の good/bad 例の具体文面は、実装時に既存プロンプトから抽出して確定する。
- 共通ルール参照機構の技術実装（既存パターンの流用範囲）は、実装時の設計判断とする。

## User Confirmation

- [x] User approved this draft
- Date: 2026-04-21
