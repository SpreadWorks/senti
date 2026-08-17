# Feature Specification: 179-exclude-docs-from-review

**Feature Branch**: `feature/179-exclude-docs-from-review`
**Created**: 2026-04-16
**Status**: Draft
**Input**: GitHub Issue #152 — flow run review の diff 対象から自動生成ファイルを除外

## Goal

`flow run review` が AI に渡す diff から、sdd-forge パイプラインで自動生成・上書きされるファイルを除外する。これによりレビューが実装コードの変更のみに集中し、無意味な提案を防ぐ。

## Scope

- review コマンドの全体 diff 取得（baseBranch との diff を全ファイル対象で取得する fallback 経路）に除外パスを適用する。
- 除外対象パス: `docs/`, `README.md`, `AGENTS.md`, `.sdd-forge/output/`

## Out of Scope

- spec Scope 経由のファイル指定 diff 経路の変更。
- diff 出力の整理・トークン削減（ボード da5d に分離済み）。
- 除外パスの config.json 化。

## Clarifications (Q&A)

- **Q1: 除外パスの定義場所** — 固定値として定義する。sdd-forge の出力先パスは全プロジェクト共通であり config 化は YAGNI。
- **Q2: 除外対象** — `docs/`, `README.md`, `AGENTS.md`, `.sdd-forge/output/`。いずれも sdd-forge パイプラインで上書きされるパス。
- **Q3: 適用経路** — fallback 経路のみ。spec Scope 経由はファイル指定のため除外不要。

## Alternatives Considered

- **config.json に `review.excludePaths` を追加する案**: 除外対象が sdd-forge 固有の出力先のみであり現時点では過剰。
- **ディレクティブ外のコンテンツだけレビューする案**: AI がテンプレート構文を解析する必要がありコスト・精度のバランスが悪い。

## Why This Approach

- **レイヤー分離**: review コマンドは実装コードの品質を、`sdd-forge docs review` はドキュメント品質をそれぞれ担当する。
- **全プロジェクト共通の固定値**: 除外対象はすべて sdd-forge が定義する出力先。
- **最小変更**: diff 取得の引数に除外パスを追加するだけで、ロジック分岐の追加は不要。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-16
- Notes: gate PASS 後承認

## Requirements

**P1（除外動作）**

- R1: When `flow run review` が baseBranch との全体 diff を取得する、shall diff 結果に `docs/` 配下のファイルの変更が含まれない。
- R2: When `flow run review` が baseBranch との全体 diff を取得する、shall diff 結果に `README.md` の変更が含まれない。
- R3: When `flow run review` が baseBranch との全体 diff を取得する、shall diff 結果に `AGENTS.md` の変更が含まれない。
- R4: When `flow run review` が baseBranch との全体 diff を取得する、shall diff 結果に `.sdd-forge/output/` 配下のファイルの変更が含まれない。

**P1（既存動作の維持）**

- R5: When `flow run review` が spec Scope 経由で個別ファイルの diff を取得する、shall 除外パスは適用されず既存動作が維持される。

**P2（エッジケース）**

- R6: When baseBranch との diff に除外対象のファイルしか変更がない、shall review は変更なし（空の diff）として処理する。

## Acceptance Criteria

- AC1: 除外対象ファイルのみを変更したブランチで `flow run review` を実行したとき、AI に渡される diff が空である。
- AC2: `src/` 配下のファイルを変更したブランチで `flow run review` を実行したとき、`src/` の変更は diff に含まれ、除外対象の変更は含まれない。
- AC3: spec Scope に `docs/overview.md` が明示的に含まれている場合、`flow run review` はそのファイルの diff を取得する（除外されない）。

## Test Strategy

- **spec 検証スクリプト**: review コマンドの diff 取得が全体取得時に除外パスを適用することを検証する。formal test には含めない。変更がロジック分岐のない引数追加のみであるため spec 検証で十分。
- **手動検証**: 除外対象ファイルのみ変更したブランチで `flow run review` を実行し、空 diff 応答を確認する。

## Impact on Existing Features

- `flow run review` の全体 diff 取得経路のみ変更。spec Scope 経由の経路には影響なし。
- `flow run gate --phase impl` は独立した diff 取得経路を持つため影響なし。
- CLI の引数・出力形式に変更なし。

## Open Questions

なし（draft 段階で全項目解決済み）
