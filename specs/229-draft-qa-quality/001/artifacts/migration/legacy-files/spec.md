# Feature Specification: 229-draft-qa-quality

**Feature Branch**: `feature/229-draft-qa-quality`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #260

## Goal

Draft フェーズの成果物を非構造化 markdown（draft.md）から構造化 JSON（draft.json）に移行し、Q&A にエビデンスフィールドを導入、前提検証ステップを追加することで、draft → spec 間の知識損失を構造的に解消する。

## Background

Draft Q&A で議論された知識（根拠・代替案・調査結果）が spec/impl に伝搬しない。原因は 2 層:
1. **キャプチャ層**: draft が非構造化 markdown であり、「根拠」「代替案」がフリーテキストに埋もれて後工程で機械的に抽出できない。
2. **転記層**: spec プロンプトが「reflect Q&A and decisions」としか指示しておらず、何をどこにマッピングするか未定義。spec.json の decisions は `{text}` のみで evidence を保持できない。

加えて AI が要求を表面的に受け入れ、前提の妥当性を検証しないまま進める傾向がある。

## Scope

- draft.md → draft.json への移行（skeleton 生成、gate 検証、auto-check 入力）
- Q&A エントリに evidence, why, considered フィールドを追加
- 前提検証フィールド（analysis）を draft.json に追加
- gate-draft で JSON スキーマ検証 + evidence / analysis の存在チェック
- draft プロンプトにリサーチ→自己検証→質問生成手順を追加
- draft プロンプトにコミュニケーションルール（言語統一、用語定義、質問自己完結性）を追加
- spec プロンプトに draft.json → spec.json の構造的転記ルールを追加
- spec.json の overview.decisions[] に evidence, consideredAlternatives フィールドを追加

## Out of Scope

- 既存 specs/ の draft.md マイグレーション（alpha 版ポリシーにより不要）
- draft.md のレンダリング（draft.json のみ生成）
- spec.md レンダラの変更

## Impact on Existing Features

- draft skeleton 生成機能 — markdown テンプレートから JSON テンプレートへ置換
- gate-draft 検証機能 — markdown regex 検証から JSON スキーマ検証へ置換
- gate-draft AI 評価 — 入力形式を draft.json に変更
- auto-check 入力解決機能 — draft 読み込み形式を JSON に変更
- draft フェーズのプロンプト — JSON 記入指示に改修
- spec フェーズのプロンプト — 構造的転記ルールに改修
- gate-draft フェーズのプロンプト — draft.json 参照に変更
- 関連テスト群 — draft.json 形式に対応するよう修正（ユーザー承認済み）

## Migration Plan

draft.md → draft.json の変更は内部成果物フォーマットの変更であり、CLI コマンドやオプションの変更ではない。`sdd-forge flow prepare` の出力ファイル名が変わるが、このコマンドの出力は AI が消費するものであり、ユーザーが直接操作するインターフェースではない。alpha 版ポリシーにより既存 specs/ の draft.md マイグレーションは行わない。

## Constraints

- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換コード不要

## Design Principles

- draft.json は spec.json と同様の構造化データ。人間が読むための markdown レンダリングは行わない（消費者は全て機械: gate CLI, auto-check, AI）
- gate-draft は JSON スキーマの構造検証（フィールド存在・型・enum）を行い、内容の質は AI 評価に委ねる
- draft.json → spec.json の転記はフィールドマッピングとして明示的に定義する

## Overview

### Modules

- `run-prepare-spec.js`: draft.json skeleton 生成
- `run-gate.js`: `checkDraftJson()` による JSON スキーマ検証
- `resolve-auto-check-input.js`: draft.json 読み込み
- `prompts/plan/draft.md`: AI への draft.json 記入指示 + 品質ルール
- `prompts/plan/spec.md`: 構造的転記ルール
- `prompts/plan/gate-draft.md`: draft.json 参照

### Data Flow

1. `flow prepare` → draft.json skeleton を spec ディレクトリに生成
2. AI が draft.json を埋める（Q&A 含む）
3. `flow run gate --phase draft` → `checkDraftJson()` で構造検証 + AI 評価
4. AI が spec 作成時に draft.json を読み、フィールドマッピングに従い spec.json に転記
5. `auto-check` が draft.json を読んで auto-mode 判定の入力を構築

### Decisions

- draft.md を廃止し draft.json のみ生成する。根拠: draft の消費者は全て機械であり markdown レンダリングの利点がない。JSON 化により gate 検証が正規表現から JSON スキーマ検証に改善される。
- 前提検証（analysis フィールド）は全開発種別で必須とする。根拠: gate の条件分岐コストより形骸化リスクが低い。「前提に問題なし」も許容する。
- gate-draft の evidence チェックは「判断を伴う Q&A」に限定する。根拠: 単純な確認 Q&A（「これで進めてよいか」）に evidence を強制すると形骸化する。

## Clarifications (Q&A)

draft.md の Q&A セクションから転記。

- Q: gate-draft にも Evidence チェックを追加すべきか？ → A: はい。モデルの質的退行が動機である以上 prompt 遵守を前提にできない。既存 gate-draft の構造検証パターンの自然な拡張。
- Q: draft.json を導入するか？ → A: はい。markdown → JSON の構造ミスマッチが知識損失の根本原因。spec 227 の overview.decisions で evidence 保持不能を確認。
- Q: draft.md のレンダリングは必要か？ → A: 不要。消費者 3 箇所（gate, auto-check, AI）は全て機械。

## Alternatives Considered

- **draft.md のまま markdown フィールド追加**: Q&A に `Evidence:` `Considered:` 等のラベル付き行を追加し、正規表現で抽出する案。構造ミスマッチ（markdown → JSON 転記）の根本原因に対処しないため却下。
- **draft.json + draft.md レンダリング**: spec.json → spec.md と同じパターン。draft の消費者に人間が含まれないため、レンダリングの利点がなく同期リスクが増えるため却下。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-25
- Notes:

## Requirements

R1 (must). When `flow prepare` が新しい spec を作成する, draft.json skeleton を生成する（draft.md は生成しない）。
R2 (must). When gate-draft が draft.json を検証する, 判断を伴う Q&A エントリの evidence フィールドが空でないことを検証する。draft.json の各 Q&A エントリは evidence, why, considered フィールドを持つ。
R3 (must). When gate-draft が draft.json を検証する, analysis オブジェクト（problem, proposedApproach, validation）の存在を検証する。全開発種別で適用する。
R4 (must). When AI が draft Q&A で質問を生成する, コードを調査し前提を検証してから質問する手順を draft プロンプトに規定する。
R5 (should). When AI が draft Q&A でユーザーに質問する, 以下を遵守する: (a) 質問は config.lang の言語で記述し 1 質問内で言語を混在させない, (b) 専門用語の初出時に 1-2 行の定義を添える, (c) 質問は前のターンの文脈を参照せず単独で理解できる形にする。draft プロンプトに規定する。
R6 (must). When AI が spec を作成する, draft.json の Q&A evidence/considered を spec.json の decisions[].evidence, overview.alternatives_considered に転記する。フィールドマッピングを spec プロンプトに定義する。
R7 (must). When spec.json を生成・検証する, overview.decisions[] は evidence, consideredAlternatives フィールドを受け入れる。

## Acceptance Criteria

AC1. `flow prepare` 実行後、spec ディレクトリに draft.json が存在し draft.md が存在しない。
AC2. draft.json の Q&A エントリに evidence, why, considered フィールドが含まれる。判断を伴う Q&A で evidence が空の場合、gate-draft が FAIL を返す。
AC3. draft.json に analysis オブジェクトがない場合、gate-draft が FAIL を返す。
AC4. draft プロンプトに「質問前にコード調査と前提検証を行う」手順が記載されている。
AC5. draft プロンプトに言語統一・用語定義・質問自己完結性のルールが記載されている。
AC6. spec プロンプトに draft.json → spec.json のフィールドマッピング（qa[].evidence → decisions[].evidence, qa[].considered → alternatives_considered）が記載されている。
AC7. spec.json の overview.decisions[] が evidence, consideredAlternatives フィールドを受け入れる。
AC8. auto-check が draft.json を正常に読み込んで入力を構築する。
AC9. 既存テスト（gate-draft, auto-check）が draft.json 形式に対応して全て PASS する。

## Implementation Targets

- `src/flow/lib/run-prepare-spec.js`
- `src/flow/lib/run-gate.js`
- `src/flow/lib/resolve-auto-check-input.js`
- `src/flow/prompts/plan/draft.md`
- `src/flow/prompts/plan/spec.md`
- `src/flow/prompts/plan/gate-draft.md`

## Open Questions
- (なし)
