# Draft: Fix review command bugs

**目的:** review コマンド（spec review / test review）の3つのバグを修正する。

**開発種別:** Bug fix

## Q&A

### 1. Goal & Scope

**Q: ゴールは何か？**
A: review コマンドの3つのバグを修正する（優先順位順）:
1. **P1** spec review の fix 関数が AI 応答テキスト（"It seems I don't have write permissions..."等）をそのまま spec.md に書き込む — データ破損のため最優先
2. **P2** test review / spec review サブプロセスが失敗した際、`run-review.js` が gap/issue 数 0 でも FAIL を報告する — 誤解を招くエラーメッセージ
3. **P3** test review の AI 生成テストコードが `Object.freeze([...])` パターンに非対応のフィルターを生成する — ベストエフォート改善

**Q: スコープは明確か？**
A: 対象は `src/flow/commands/review.js` と `src/flow/lib/run-review.js` の2ファイル。

### 2. Impact on existing

**Q: 既存機能への影響は？**
A: review コマンドの内部ロジック修正のみ。CLI インターフェース変更なし。
- バグ#1: spec review の fix 関数に出力バリデーションを追加。不正な出力時は元の spec を保持する
- バグ#2: `parseTestReviewOutput` / `parseSpecReviewOutput` のエラーメッセージ改善。gaps/issues のパースに失敗した場合、デフォルト 0 ではなく実際の状況を報告する
- バグ#3: `buildTestFixPrompt` にプロンプトガイダンスを追加。AI が Object.freeze 等のラッパーを考慮したコードを生成するよう誘導する

### 3. Constraints

- 外部依存なし（Node.js 組み込みのみ）
- バグ#3 は AI プロンプト改善であるため効果が保証できない。ベストエフォート

### 4. Edge cases

- バグ#1: AI が markdown fences を含まない spec テキストを返す場合（正常ケース）→ バリデーション PASS でそのまま書き込む
- バグ#1: AI が空文字列を返す場合 → バリデーション FAIL で元の spec を保持
- バグ#2: サブプロセスが例外で crash した場合（gaps/issues がパースできない）→ エラーメッセージで「パース不能」を明示

### 5. Test strategy

- `specs/136-fix-review-cmd-bugs/tests/` に配置
- バグ#1: spec fix 出力のバリデーション関数のユニットテスト
- バグ#2: parseTestReviewOutput / parseSpecReviewOutput の各パターンテスト

## Approval

- [x] User approved this draft (autoApprove)
