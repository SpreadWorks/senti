# Draft: Fix spec review preamble injection (#84)

**開発種別:** バグ修正

**目的:** spec review の fix フェーズで AI が出力するプリアンブルテキスト（例: "It seems I don't have write permission..."）を除去し、spec.md の破損を防止する。

## Issue Summary

**GitHub Issue**: #84 — Preamble text injection issue in spec review fix phase

spec review の `fix()` 関数内で `callAgent` → `buildSpecFixPrompt` が AI を呼び出し、返された出力を `spec.md` に書き込む。AI が出力の先頭にプリアンブルテキストを付加することがあり、`isValidSpecOutput` で一部検出できるが、プリアンブル + 有効な spec ヘッダの組み合わせはすり抜ける。

## Q&A

### Q1: 問題の発生箇所は？
A: `src/flow/commands/review.js` の `runSpecReview` 内の `fix()` 関数（line 712-756）。`callAgent` の結果（`fixResult`）をそのまま `spec.md` に書き込む際に発生する。

### Q2: 現在の防御策は？
A: `isValidSpecOutput(cleaned)` が `# Feature Specification` または `## Goal` で始まるかチェック。ただしプリアンブル行の後にこれらのヘッダが続く場合は `/m` フラグ（multiline）により true を返す。

### Q3: 修正アプローチは？
A: 2 段階の防御:
1. **プロンプト改善**: `buildSpecFixPrompt` に「プリアンブルテキストを含めない」指示を追加
2. **出力サニタイズ**: `isValidSpecOutput` の前に、spec ヘッダ（`# Feature Specification`）より前のテキストを除去する `stripPreamble` 関数を追加

### Q4: 既存機能への影響は？
A: spec review の fix フェーズのみ。test review や code review には影響しない。`isValidSpecOutput` の挙動は変更しない（既存テストへの影響を避ける）。

### Q5: テスト戦略は？
A: `stripPreamble` 関数のユニットテスト（プリアンブルあり/なし/空文字/ヘッダのみ等）。`isValidSpecOutput` の既存テスト（spec-136）は変更不要。

- [x] User approved this draft (autoApprove)
