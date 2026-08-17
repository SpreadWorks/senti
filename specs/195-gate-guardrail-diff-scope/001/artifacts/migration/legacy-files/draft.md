# Draft: gate-impl guardrail diff-scope filtering

**開発種別:** エンハンスメント

**目的:** gate-impl の guardrail AI 判定が、現在の spec で触っていない pre-existing コードに対して誤って FAIL を返す問題を解消する。判定対象を diff 内の追加/変更行に起因する違反のみに限定する。

## 背景

Issue #180 で報告された問題。ある spec の実装フェーズで、数行のみの変更に対して同ファイル内の pre-existing な違反が FAIL として検出され、finalize が進めなくなる事象が発生した。spec の `## Exemptions` セクションや `issue-log` の記録を gate AI は尊重しない（現行仕様）。そのため、spec 書き換えや out-of-scope なリファクタを強いられる状況だった。

## 事前調査（Explore Before Asking）

Q&A 前に以下を調査し、質問対象を絞り込んだ:

- Issue #180 本文（英語・日本語）を読み、3 つの方針候補（diff スコープ / Exemptions 尊重 / override 機構）を把握。
- gate-impl の実装コード（guardrail 判定の呼び出し構造）を読み、AI に渡されるプロンプトに diff 範囲を限定する指示が含まれていないことを確認。
- 既存の guardrail 関連ユニットテストを読み、exemption セクションを無視する方針が現行テストに明記されていること、および prompt 生成関数への単体テストが存在することを確認。
- プロジェクトの guardrail 原則一覧（Single Responsibility, Unambiguous Requirements 等）を読み、新規要件を原則に適合させた。

## 要件（優先度順）

### 必須（Priority 1）

- **R1:** When gate-impl が guardrail AI による違反判定を行うとき, the system shall 判定対象を diff 内の追加/変更行に起因する違反のみに限定するよう AI に指示する。
- **R2:** When 変更行に起因しない pre-existing コードのパターンが diff の前後コンテキストに含まれるとき, the system shall それらを違反判定の対象外として扱う。
- **R3:** When 判定ロジックが変更されるとき, the system shall プロンプトがこの diff スコープ制約を含むことを検証する自動テストを備える。

### 推奨（Priority 2）

- **R4:** When 本変更を適用した後, the system shall Issue #180 の再現シナリオ（impl フェーズの diff が数行の変更のみで、同ファイル内に違反パターンを含む pre-existing 関数が存在するケース）を spec 配下の再現テスト手順書として `specs/<spec>/tests/README.md` に記述し、実行コマンドと期待結果（gate PASS であること）を明記する。

## 影響

- **既存機能への影響:** gate-impl の判定結果にのみ影響。draft/spec フェーズの gate、および guardrail AI 以外の判定ロジック（構造チェック、requirements チェック）は不変。
- **既存テストへの影響:** exemption セクションに関する既存の判定方針（spec の `## Exemptions` を無視する）は本 spec の対象外であり変更しない。
- **CLI 互換性:** 既存コマンド・オプションに変更なし。

## Out of Scope

- spec の `## Exemptions` セクションを gate AI に尊重させる改修
- 明示的な override フラグの追加
- draft/spec フェーズの gate プロンプトの変更

## Q&A

**議論モードの確認:** 本 draft の Q&A は全て意思決定段階（decision）として扱う。ユーザーは Issue #180 の対応を求めており、ブレスト段階（brainstorm）ではない点を事前に確認した上で各 Q を提示している。したがって本 draft 内の AI からの推奨・比較は意思決定前提の評価であり、ブレストでの仮アイデアではない。

### Q1: 対応方針の確認

- AI: Issue #180 の解釈を提示し、本 spec で対応するか確認。推奨は「本 spec で対応する」。根拠は: (1) **guardrail 原則** — 現状 auto mode で gate-impl が停止し finalize 進行を阻む問題は「Impact on Existing Features」の観点で既存フローに悪影響を及ぼしている。(2) **既存コードパターン** — gate の誤検知は prompt 起因の構造的問題であり、個別 spec でのワークアラウンドでは解消できない。(3) **docs/ 方針** — alpha 期間の「後方互換コードは書かない」方針のもと、根本原因に当たるのが筋である。
- User: [1] はい

### Q2: 対応方針の選定

- AI: 意思決定段階として、4 候補を信頼性×実装規模×リスクの観点で比較表化して提示。推奨 [1a]（diff スコープを AI prompt で明示）の根拠は: (1) **既存コードパターン** — 判定ロジックは既に単一プロンプトに集約されており、prompt 拡張が自然な拡張点である。(2) **guardrail 原則** — 「Unambiguous Requirements」および「Single Responsibility」に適合し、AI 判断の信頼性に依存しない構造的解決である。(3) **docs/ 方針** — alpha 期間の後方互換禁止ポリシーと整合し、後付けの逃げ道（Exemptions 尊重・override）を避ける方針。
- User: [1] はい（推奨方針で進める）

### Q3: 検証方法

- AI: 意思決定段階として、検証アプローチを比較し両方採用を推奨。根拠は: (1) **既存コードパターン** — プロジェクトには formal test (`tests/`) と spec-local test (`specs/<spec>/tests/`) の使い分けルールが既に確立している。(2) **guardrail 原則** — 「Complete Context」に従い検証可能な条件（プロンプト文字列の構造）と検証不能部分（AI 判断）を分離する必要がある。(3) **docs/ 方針** — 「テストを通すためにテストコードを修正してはならない」との整合上、AI 挙動依存部分は formal test に含めない。
- User: [1] 両方採用

### Q4: スコープ境界

- AI: 意思決定段階として、スコープ確定の確認。根拠は: (1) **既存コード** — 問題は impl フェーズ固有で、他フェーズには diff という概念が存在しない。(2) **guardrail 原則** — 「Single Responsibility」に従い本 spec は diff スコープ誤検知の解消のみを扱い、Exemptions や override は別トピック。
- User: [1] はい、進める

## Open Questions

（なし）

## 承認

- [x] User approved this draft
- 承認日: 2026-04-19
