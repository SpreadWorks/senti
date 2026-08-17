# Draft: flow run review の diff 対象から自動生成ファイルを除外

**開発種別:** enhance
**目的:** `flow run review` が AI に渡す git diff から、sdd-forge パイプラインで自動生成・上書きされるファイルを除外し、レビュー提案の無駄を防ぐ。

## 背景

`flow run review` は `git diff baseBranch` の出力を AI レビューに渡す。この diff に自動生成ファイルが含まれると、AI が修正を提案しても `sdd-forge build` で上書きされるため無意味。ディレクティブ外の手書きコンテンツは `sdd-forge docs review` や目視で品質担保する（レイヤー分離）。

## スコープ

- review コマンドの全体 diff 取得（fallback 経路）で除外パスを適用する
- 除外対象: `docs/`, `README.md`, `AGENTS.md`, `.sdd-forge/output/`
- spec Scope からのファイル指定経路は変更しない（個別ファイル指定のため除外不要）

## 要件

P1:
- R1: When `flow run review` が baseBranch との diff を全体取得する、shall `docs/`, `README.md`, `AGENTS.md`, `.sdd-forge/output/` の変更が diff 結果に含まれない。
- R2: When `flow run review` が spec Scope 経由で個別ファイルの diff を取得する、shall 除外パスは適用されない（既存動作を維持）。

P2:
- R3: When 除外対象のファイルのみが変更されている、shall review は「変更なし」として扱う。

## 既存機能への影響

- review の fallback diff 経路のみ変更。spec Scope 経由の経路には影響なし。
- gate（`flow run gate --phase impl`）は別の diff 取得経路を持つため影響なし。

## 脱線の記録

draft 中に「diff 出力を整理してトークン数を削減する」改善が議論された。本 spec のスコープ外としてボード `da5d` に分離した。

## Q&A

- **Q1: 除外パスの設定方法**
  - A: 除外パスは固定値として定義する（config 化しない）。根拠: (3) 既存コードパターン — sdd-forge の出力先パスは全プロジェクト共通であり config 化は alpha 版ポリシー上 YAGNI。
- **Q2: 除外対象の範囲**
  - A: `docs/`, `README.md`, `AGENTS.md`, `.sdd-forge/output/`。根拠: (3) 既存コードパターン — いずれも `sdd-forge docs build` / `sdd-forge docs agents` で上書きされるパス。
- **Q3: 適用経路**
  - A: fallback 経路のみ。根拠: (3) 既存コードパターン — spec Scope 経由はファイル指定で呼ぶため除外不要。
- **Q4: テスト戦略**
  - A: spec 検証テストのみ（formal test は不要）。根拠: (2) guardrail `Changes Require Test Coverage` — happy path カバーは必要だが、変更が git diff 引数の追加のみでロジック分岐が無いため spec 検証で十分。

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-04-16
- Notes: Q1-Q4 の合意に基づき承認
