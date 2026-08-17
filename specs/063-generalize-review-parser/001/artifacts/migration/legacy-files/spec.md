# Feature Specification: 063-generalize-review-parser

**Feature Branch**: `feature/063-generalize-review-parser`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User request

## Goal
review-parser.js に CakePHP 固有のファイルパスがハードコードされている問題を解決する。
調査の結果、ハードコードを含む `patchGeneratedForMisses()` は review.js が `[MISS]` を出力しなくなった時点で死んだコードになっていた。ハードコード問題の解決策はこの死んだコードの削除である。

## Scope
- review-parser.js から以下を削除:
  - `FALLBACK_PATCH_ORDER`
  - `parseReviewMisses()`
  - `ensureSection()`
  - `patchGeneratedForMisses()`
  - `summarizeNeedsInput()` (`[MISS]` フィルタを含む)
- forge.js から以下を削除:
  - misses パース・パッチブロック (444-467行目)
  - 削除した関数の import
- review-parser.test.js から削除した関数のテストを削除

## Out of Scope
- review.js に新たな coverage チェック (`[MISS]` 出力) を追加すること
- analysis カテゴリと章のマッピング定義 (spec #032 の領域)
- forge local モードの新たなパッチ戦略の設計

## Clarifications (Q&A)
- Q: `[MISS]` は review.js から出力されるのか？
  - A: されない。現在の review.js は `[FAIL]` と `[WARN]` のみ出力する。`parseReviewMisses()` がパースしようとする `[MISS]` 形式は、以前の review 実装の名残。
- Q: 削除後に forge local モードは動くのか？
  - A: 動く。review 失敗時のフィードバックループ (`summarizeReview` + `parseFileResults`) は残る。misses パッチは元々空振りしていたので動作に変化なし。
- Q: `summarizeNeedsInput()` は他から使われているか？
  - A: forge.js の 461行目のみ。misses パッチブロック内なので一緒に削除。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-16
- Notes: 死んだコードの削除のみ。汎用的なパッチ機能の復活は別 spec で対応。

## Requirements
1. review-parser.js から死んだコード 5関数を削除する
2. forge.js から misses パッチブロックと関連 import を削除する
3. review-parser.test.js から削除した関数のテストを削除する
4. 残す関数 (`summarizeReview`, `parseFileResults`, `extractNeedsInput`) が引き続き正しく動作すること
5. 既存テストが通ること

## Acceptance Criteria
- `npm test` が全て PASS
- review-parser.js に CakePHP 固有のパスが含まれていないこと
- forge.js から `patchGeneratedForMisses` への参照がないこと

## Open Questions
- (なし)
