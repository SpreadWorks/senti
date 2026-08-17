---
issue: 169
---

# Draft: CodexProvider JSON parse 失敗の修正

**開発種別:** バグ修正 + 設計修正

**目的:** `codex` CLI 経由での agent 呼び出しで stdout parse が失敗し、stderr 警告と usage metrics 喪失が発生する問題を根本対応する。併せて、config で上書き不能な暗黙の CLI フラグ自動注入機構を廃止し、profile 定義が literal に解釈される設計に戻す。

## 背景・根本原因

- Issue #169: gate 実行時 (codex 経由) に `agent output parse failed` 警告が頻発
- 根本原因（ユーザー指摘で確定）: builtin profile の args に `--json` 相当のフラグが含まれていない一方、Provider 実装は JSON 出力を前提にしている
- 調査で判明した追加の設計問題: 既存の「Provider が自動的にフラグを注入する仕組み」は、ユーザーが config でフラグ名を上書きできない隠し動作になっている

## 影響（現状）

1. stderr に警告ログ出力（観測時の noise）
2. agent 呼び出しの usage metrics（tokens/cost）が喪失し flow.json に記録されない
3. parse 失敗時の fallback として生 stdout が下流に渡り、下流処理（gate 結果集計等）の信頼性が低下

## 要件（優先順位付き）

### P1: parse 失敗を未然に防ぐ

- **When** agent が JSON 出力をサポートする builtin profile を使って呼び出される、
  **shall** CLI 側から JSON 形式の出力が返り Provider.parse が正常完了する。
- **When** parse が成功する、**shall** usage metrics が flow.json に累積記録される。

### P2: config profile を literal に解釈する

- **When** ユーザーが `config.agent.providers` で profile を定義する、
  **shall** 定義された args がそのまま CLI に渡り、フレームワーク側からの暗黙フラグ追加が行われない。
- **When** CLI のフラグ名が将来変更される、
  **shall** ユーザーは config の args 編集のみで追従でき、本パッケージのコード修正を必要としない。

### P3: 設計原則の明文化

- **When** 新たな builtin Provider が追加される、
  **shall** 必要な CLI フラグは builtin profile の args に literal に記述される（自動注入メカニズムは存在しない）。

## 議論の性質

本件は「最終意思決定」フェーズ。方針は Q&A でユーザー承認済み。実装詳細（どのメソッドを削除するか、どの関数に触るか）は spec / implementation フェーズで扱う。

## Q&A

### Q1: Issue #169 の解釈確認
**AI 推奨（根拠: Issue 本文）:** gate 実行時に codex provider が素テキストを受け取り parse 失敗。(a) parse フォールバック追加 / (b) gate プロンプト JSON 強制 の2案を提示。
**User:** [1] はい、その理解で進めてよい

### Q2: 対応アプローチ選択
**AI 推奨（根拠: Issue の Scope 記述）:** 2案のどちらをメインにするか確認。
**User:** [1] parse 側のフォールバック

### Q3: 後続影響の確認
**User:** 「これが失敗すると後続処理にどのような影響が出るのか？」
**AI 推奨（根拠: agent 呼び出しとメトリクス累積の実装を確認）:** 影響は (1) 警告ログ出力、(2) usage metrics 喪失、(3) fallback text が下流に渡ることの3点。特に (2) は観測価値が高いため根本対応を推奨する。

### Q4: 根本原因の特定（ユーザー主導）
**User:** 「codex に json 出力フラグあるよ？つけ忘れただけ？」
**AI 推奨（根拠: `codex exec --help` で `--json` フラグの存在を確認）:** ご指摘の通り、builtin profile 側に JSON 出力フラグが付与されていない付け忘れが根本原因。

### Q5: config との関係確認
**User:** 「configとの関係は？」
**AI 誤答案:** 自動注入で config 変更不要、と説明。
**User 指摘:** 「全くダメな設計だ」— 自動注入は config で上書き不能な隠し動作で、CLI フラグ名変更時に code 修正まで使い物にならなくなる。builtin args に直接含めるべき。
**AI（訂正）:** 指摘を受け入れ、自動注入機構を廃止し builtin args literal 記述 + config profile literal 解釈の方針へ変更。

### Q6: 最終方針確認
**AI 推奨（根拠: Q5 での設計原則整合性とユーザー指摘）:** builtin args への literal 記述 + 自動注入機構廃止の方針で draft 確定を推奨。config 上書き可能性と CLI 変更追従性の両方を満たす唯一の案。
**User:** [1] 確定

### Q1 再掲の推奨（フォーマット統一のため）
**AI 推奨（根拠: Issue #169 本文の症状/再現/対象セクション）:** Issue の「対象」に明記された 2 案（parse フォールバック / gate プロンプト JSON 強制）を起点に議論を進めることを推奨。

### Q2 推奨補足
**AI 推奨（根拠: provider 実装の汎用性）:** parse 側フォールバックは gate 以外にも波及効果があるため先に検討することを推奨。ただし後続 Q で根本原因判明により方針転換済み。

## Open Questions

- 独自フィールドを config で使っていたユーザーへの移行告知方法（CHANGELOG のみで十分か、ランタイム warning を出すか） → spec フェーズで判断

## 検討した代替案

| 案 | 採否 | 根拠 |
|---|---|---|
| parse 側で非JSON行を無視/連結 | 却下 | 根本原因を残す対症療法。noise は消えるが metrics 喪失は残る。 |
| gate プロンプトを JSON 出力強制 | 却下 | gate 以外の呼び出し（review 等）に効果なし。適用範囲が狭い。 |
| 自動注入機構を維持したまま codex の注入値だけ埋める | 却下 | config 上書き不能な隠し動作が残存し、フラグ名変更時に code 修正必須となる。 |
| **builtin args に JSON フラグを literal 記述 + 自動注入機構を廃止** | **採用** | config は literal 解釈され、フラグ名変更時も config のみで対応可能。設計原則に整合。 |

## Scope

- 対応範囲: agent 呼び出しに関わる Provider 抽象と Agent サービス
- 対象 builtin Provider: JSON 出力をサポートするもの（現状 Claude 系と Codex 系）
- 影響を受ける設定: builtin profile の args 定義、暗黙フラグ注入ロジック

## Out of Scope

- UserProvider の fallback 挙動（`text: stdout, usage: null`）は変更しない
- gate プロンプト自体の出力形式変更は行わない
- 既存ユーザー config の自動マイグレーション機能は提供しない（CHANGELOG 告知のみ）

## 制約・ガードレール

- **alpha 版ポリシー**: 後方互換コードを書かない。廃止対象の機構は完全削除する（deprecated 経由なし）
- **外部依存禁止**: Node.js 組み込みモジュールのみ
- **過剰防御コード禁止**: 新たなフォールバック処理は追加しない
- **OOP 表現**: Provider 抽象を破壊する場合は各実装クラスで invariant を保つ

## エッジケース

- ユーザー profile で既に JSON フラグ相当が args に含まれている → 無害（CLI 側で重複フラグを拒否する場合は CLI 側の動作に従う）
- 独自のフラグ指示フィールドを config で使っていたユーザー → breaking change。CHANGELOG で移行手順を案内
- codex CLI で `--json` フラグ名が将来変更される → ユーザーは config の args 編集のみで対応可能（P2 要件により保証）

## テスト方針

- **成功ケース**: JSON 対応 builtin profile で agent 呼び出し → parse 成功、usage が non-null
- **設計検証**: 自動注入機構が存在せず、config に定義された args がそのまま CLI に渡ることを確認
- **手動検証**: `sdd-forge flow run gate` を codex profile で実行し、parse 警告が出ないこと、metrics に tokens が記録されることを確認

## 将来拡張性

- 新 Provider 追加時: builtin profile args に必要フラグを literal 記述する規約を docs/AGENTS に明記
- CLI フラグ変更への追従: ユーザーは config で独自 profile を定義し args を更新するだけで対応可能

## User Confirmation

- [x] User approved this draft
- 承認日: 2026-04-18
- Note: 自動注入機構を廃止し、builtin args に literal 記述する方針で確定。
