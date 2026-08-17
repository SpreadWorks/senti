# Draft: 229-draft-qa-quality

**開発種別:** feature
**目的:** draft フェーズの成果物を markdown（draft.md）から構造化 JSON（draft.json）に移行し、Q&A にエビデンスフィールドを追加、前提検証ステップを導入、spec への構造的な知識転記を実現する。

## Analysis (前提検証)

- **問題の本質:** Draft Q&A で議論された知識（根拠・代替案・調査結果）が spec/impl に伝搬しない。原因は draft が非構造化 markdown であり、spec.json への転記が「reflect Q&A and decisions」という曖昧な指示に依存していること。加えて AI が要求を表面的に受け入れ、前提の妥当性を検証しないまま進める傾向がある。
- **提案された方法の妥当性:** Issue #260 の元の提案（markdown にフィールド追加 + 転記ルール追加）は知識キャプチャを改善するが、markdown→JSON の構造ミスマッチという根本原因に対処しない。draft.json 導入により、フォーマット拡張・gate 検証・spec 転記が全て構造化の副産物として実現される。

## Requirements (優先順)

R1 (must). When flow prepare が新しい spec を作成する, draft.json skeleton を生成する（draft.md は生成しない）。AI は draft.json に書き込む。
R2 (must). When gate-draft が draft.json を検証する, 判断を伴う Q&A エントリの evidence フィールドが空でないことを検証する。draft.json の各 Q&A エントリは evidence, why, considered フィールドを持つ。
R3 (must). When gate-draft が draft.json を検証する, analysis オブジェクト（problem, proposedApproach, validation）の存在を検証する。全開発種別で適用する。
R4 (must). When AI が draft Q&A で質問を生成する, コードを調査し前提を検証してから質問する手順を draft プロンプトに規定する。
R5 (should). When AI が draft Q&A でユーザーに質問する, 以下を遵守する: (a) 質問は config.lang の言語で記述し 1 質問内で言語を混在させない, (b) 専門用語の初出時に 1-2 行の定義を添える, (c) 質問は前のターンの文脈を参照せず単独で理解できる形にする。draft プロンプトに規定する。
R6 (must). When AI が spec を作成する, draft.json の Q&A evidence/considered を spec.json の decisions[].evidence, overview.alternatives_considered に転記する。フィールドマッピングを spec プロンプトに定義する。
R7 (must). When spec.json を生成・検証する, overview.decisions[] は evidence, consideredAlternatives フィールドを受け入れる。

## Scope Verification
- In scope:
  - R1〜R7 の実装
  - R1〜R3 に伴う既存テストの修正
- Out of scope:
  - 既存 specs/ の draft.md マイグレーション（alpha 版ポリシーにより不要）
  - spec.md レンダラの変更
  - draft.md のレンダリング

## Impact on Existing Features
- 影響ありの既存機能:
  - draft skeleton 生成機能 — markdown テンプレートから JSON テンプレートへ置換
  - gate-draft 検証機能 — markdown regex 検証から JSON スキーマ検証へ置換
  - gate-draft AI 評価 — 入力形式を draft.json に変更
  - auto-check 入力解決機能 — draft 読み込み形式を JSON に変更
  - draft フェーズのプロンプト — JSON 記入指示に改修
  - spec フェーズのプロンプト — 構造的転記ルールに改修
  - gate-draft フェーズのプロンプト — draft.json 参照に変更
  - 関連テスト群

## Q&A

全項目はユーザーとの対話で決定済み（ブレストではなく最終決定）。

- Q1: Issue #260 の内容（4項目の変更）で進めてよいか？ → 決定: はい
  - 推奨根拠: Issue 本文の変更提案が具体的で、背景セクションに問題の動機が明記されている（Issue #260 本文）
- Q2: gate-draft に Evidence 構造チェックを追加するか？ → 決定: はい (R2)
  - 推奨根拠: 既存 gate-draft の構造フィールド検証パターン（既存コードパターン）+ Issue の動機がモデル退行である点（guardrail: prompt 遵守を前提にしない）
- Q3: 前提検証ステップを追加するか？ → 決定: はい (R3)
  - 推奨根拠: この会話自体が問題を再現 — AI が Issue を表面的に受け入れ根本原因を調査しなかった（実行時の観察）。spec 227 の draft Q&A 対 spec.json decisions の比較で知識損失を実証（既存コード）
- Q4: draft.json を導入するか？ → 決定: はい (R1)
  - 推奨根拠: draft(md) → spec(json) の構造ミスマッチが知識損失の根本原因。spec 227 の overview.decisions は {text} のみで evidence を保持不能（既存コード）。draft.json 化で R2, R3, R6, R7 が構造化の副産物として実現
  - 却下案: draft.md のまま markdown フィールド追加 → 構造ミスマッチの根本原因に対処しない
- Q5: draft.md のレンダリングは必要か？ → 決定: 不要
  - 推奨根拠: draft の消費者は gate CLI, auto-check, AI の 3 箇所のみで全て機械消費（既存コード grep で確認）
- Q6: 前提検証の適用条件は？ → 決定: 全開発種別で必須 (R3)
  - 推奨根拠: gate の条件分岐コスト対形骸化リスクの比較。「前提に問題なし」を許容することで低コスト運用が可能（設計判断）
- Q7: テスト戦略 → 決定: 承認
  - 推奨根拠: 変更対象の各機能（gate 検証、skeleton 生成、auto-check 入力、スキーマ、プロンプト）に対応するテストが既存パターンとして存在し、JSON 化に伴う置換が必要（既存コードパターン）

## Open Questions
- (なし)

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-25
- Notes: draft.json 移行を含む拡張スコープで合意
