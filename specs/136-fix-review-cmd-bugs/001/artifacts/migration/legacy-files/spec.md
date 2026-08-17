# Feature Specification: 136-fix-review-cmd-bugs

**Feature Branch**: `feature/136-fix-review-cmd-bugs`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User request (spec #135 フロー中に検出)

## Goal

review コマンド（spec review / test review）の3つのバグを修正する。(1) spec review がAI応答テキストをファイルに書き込むデータ破損、(2) サブプロセス失敗時の誤解を招くエラーメッセージ、(3) AI生成テストコードの品質改善。

## Scope

- `src/flow/commands/review.js`: spec fix 出力バリデーション追加、test fix プロンプト改善、バリデーション関数のエクスポート追加
- `src/flow/lib/run-review.js`: パーサーのエラーメッセージ改善

## Out of Scope

- review コマンドのリファクタリング（構造変更なし）
- review の AI 精度向上（プロンプト以外のアプローチ）
- test review / spec review の新機能追加

## Clarifications (Q&A)

- Q: バグ#1 のバリデーション基準は？
  - A: spec.md は `# Feature Specification` または `## Goal` を含む。これがないAI出力は不正として拒否し、元の spec を保持する
- Q: バグ#2 でパースできない場合のメッセージは？
  - A: `gapCount`/`issueCount` がパースできなかった場合、"N gap(s) remaining" ではなく stderr/stdout の実テキストを含むエラーを報告する
- Q: バグ#3 のプロンプト改善は何を追加するか？
  - A: `buildTestFixPrompt` に「定数定義は `Object.freeze()` 等のラッパーで包まれている場合がある。正規表現で定義を検索する際はこのパターンを考慮すること」というガイダンスを追加する

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: Gate PASS (all 12 guardrails)

## Requirements

1. **P1**: `src/flow/commands/review.js` の spec review fix 関数（line ~734）に、AI 出力が有効な spec であることをバリデーションする。`# Feature Specification` または `## Goal` を含まない出力は拒否し、元の spec.md を保持してログに警告を出力する。バリデーション関数（`isValidSpecOutput`）をエクスポートする
2. **P2**: `src/flow/lib/run-review.js` の `parseTestReviewOutput` と `parseSpecReviewOutput` で、stderr から gap/issue 数がパースできなかった場合、デフォルト 0 ではなく stderr/stdout の内容を含む詳細エラーメッセージを報告する
3. **P3**: `src/flow/commands/review.js` の `buildTestFixPrompt` に、定数定義が `Object.freeze()` 等のラッパーで包まれる可能性を考慮するようガイダンスを追加する
4. 既存の CLI インターフェース（コマンド引数・出力形式・終了コード）に変更がないこと

## Acceptance Criteria

- バグ#1: AI が `"It seems I don't have write permissions..."` のような非 spec テキストを返した場合、spec.md が上書きされずに保持されること
- バグ#1: AI が正常な spec テキストを返した場合、従来通り spec.md が更新されること
- バグ#2: サブプロセスが例外で crash した場合（stderr に gaps= が存在しない）、エラーメッセージに "0 gap(s) remaining" と表示されないこと
- バグ#3: `buildTestFixPrompt` の出力に `Object.freeze` に関する注意が含まれること

## Test Strategy

配置先: `specs/136-fix-review-cmd-bugs/tests/` — spec 検証テスト。

テスト手法: Node.js の `node:test` + `node:assert` を使用。

テストケース:
1. **spec fix バリデーション — 正常な spec テキストを受け入れること**
2. **spec fix バリデーション — 非 spec テキスト（AI 応答ゴミ）を拒否すること**
3. **spec fix バリデーション — 空文字列を拒否すること**
4. **parseTestReviewOutput — gaps= がパースできない場合に "0 gap(s)" と表示しないこと**
5. **parseSpecReviewOutput — issues= がパースできない場合に "0 issue(s)" と表示しないこと**
6. **buildTestFixPrompt — Object.freeze ガイダンスを含むこと**

## Open Questions

(none)
