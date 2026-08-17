# Feature Specification: 138-fix-review-preamble

**Feature Branch**: `feature/138-fix-review-preamble`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #84

## Goal

spec review の fix フェーズで AI が出力するプリアンブルテキスト（例: "It seems I don't have write permission..."、"Here is the updated spec..."）を除去し、spec.md の破損を防止する。

**Why this approach**: 2 段階の防御（プロンプト改善 + 出力サニタイズ）を組み合わせることで、AI の挙動変化に対して堅牢にする。

## Scope

- `src/flow/commands/review.js` — `buildSpecFixPrompt` のプロンプト改善、`stripPreamble` 関数の追加、fix フェーズでのサニタイズ適用

## Out of Scope

- `isValidSpecOutput` の変更（既存テストへの影響を避ける）
- test review / code review パイプライン（`runReviewLoop` 共通部分は変更しない）
- AI モデル自体のチューニング
- `src/flow/lib/run-review.js` の `parseSpecReviewOutput` は変更不要（exit code + stderr 形式は変わらないため）
- 既存のプリアンブル除去関数（`stripResponsePreamble` 等）との共通ユーティリティ抽出（将来課題）

## Clarifications (Q&A)

- Q: `stripPreamble` はどこに配置するか？
  - A: `review.js` 内にローカル関数として定義。export して spec-138 のテストから参照可能にする。

- Q: サニタイズのロジックは？
  - A: `# Feature Specification` または `## Goal` の最初の出現位置を探し、それより前のテキストを除去する。該当パターンがない場合はテキストをそのまま返す（`isValidSpecOutput` が後で reject する）。

- Q: 既存の `stripResponsePreamble` を再利用しないのはなぜか？
  - A: 既存関数はドキュメント生成用の汎用プリアンブル除去で検出パターンが異なる。本 spec では spec 固有のヘッダパターンを検出起点とするため専用関数を定義する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-04
- Notes: autoApprove mode

## Requirements

1. (P1) When `buildSpecFixPrompt` が呼ばれた場合、プロンプトに「出力にプリアンブルテキストを含めず、spec.md の内容のみを出力する」旨の指示を含める。
2. (P1) When spec review の fix フェーズで AI 出力を spec.md に書き込む前に、`# Feature Specification` または `## Goal` より前のテキスト（プリアンブル）を除去する `stripPreamble` 関数を適用する。
3. (P2) When `stripPreamble` に有効な spec ヘッダを含まないテキストが渡された場合、テキストをそのまま返す（後続の `isValidSpecOutput` による検証に委ねる）。
4. (P2) When AI 出力がマークダウンフェンス（`` ```markdown `` / `` ``` ``）で囲まれている場合、`stripPreamble` はフェンスも除去する。

## Acceptance Criteria

- `stripPreamble` がプリアンブル + spec ヘッダの組み合わせからプリアンブルを除去できることをテストで確認
- `stripPreamble` がプリアンブルなしの正常な spec をそのまま返すことをテストで確認
- `stripPreamble` が spec ヘッダを含まないテキストをそのまま返すことをテストで確認
- `stripPreamble` がマークダウンフェンスで囲まれた spec 出力からフェンスとプリアンブルを除去できることをテストで確認
- `buildSpecFixPrompt` の出力にプリアンブル抑制の指示が含まれることをテストで確認
- 既存の `isValidSpecOutput` テスト（spec-136）が全て PASS すること

## Test Strategy

- `stripPreamble` のユニットテスト: 各パターン（プリアンブルあり/なし/spec ヘッダなし/空文字/markdown fence 付き）
- `buildSpecFixPrompt` のテスト: プロンプトにプリアンブル抑制指示が含まれるか
- テスト配置: `specs/138-fix-review-preamble/tests/`

## Open Questions

None.
