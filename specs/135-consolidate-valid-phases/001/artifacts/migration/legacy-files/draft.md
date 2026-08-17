# Draft: Consolidate VALID_PHASES (#79)

**目的:** VALID_PHASES が get-guardrail.js、set-metric.js、review.js にそれぞれ独立定義されドリフトしている問題を、共有定数への統合で解消する。

**開発種別:** Bug fix

## Issue Summary

VALID_PHASES が get-guardrail.js、set-metric.js、review.js にそれぞれ独立定義されており、内容がドリフトしている。

| File | Constant | Values |
|---|---|---|
| get-guardrail.js | VALID_PHASES | draft, spec, impl, test, lint |
| set-metric.js | VALID_PHASES | draft, spec, gate, test, impl |
| review.js | REVIEW_PHASES | test, spec (object) |

## Q&A

### 1. Goal & Scope

**Q: ゴールは何か？**
A: VALID_PHASES を共有定数として1箇所に定義し、3ファイルのドリフトを解消する。

**Q: スコープは明確か？**
A: 対象は `src/flow/lib/get-guardrail.js`、`src/flow/lib/set-metric.js`、`src/flow/commands/review.js` の3ファイル。共有定数の配置先は新規ファイル（例: `src/flow/lib/phases.js`）または既存の共有モジュール。

### 2. Impact on existing

**Q: 既存機能への影響は？**
A: バリデーションロジックの統合のみ。各コマンドの外部インターフェースは変わらない。

**Q: 正しいフェーズリストは何か？**
A: 全ファイルの union を取ると `draft, spec, gate, impl, test, lint` の6フェーズ。
- get-guardrail: `gate` が欠落 → guardrail は gate フェーズでも適用可能であるべき
- set-metric: `lint` が欠落 → メトリクスは lint フェーズでも記録可能であるべき
- review: 独自の `REVIEW_PHASES` は review がサポートするフェーズの定義であり用途が異なるが、キーが共有フェーズの subset であることを保証すべき

**Q: テストへの影響は？**
A: バリデーションエラーメッセージの文言が変わる可能性がある。既存テストがエラーメッセージの完全一致で検証している場合は影響あり。

### 3. Constraints

**Q: 制約は？**
A: 
- 外部依存の追加禁止（Node.js 組み込みのみ）
- review.js の REVIEW_PHASES はフェーズ説明文を持つオブジェクトであり、用途が異なる。共有定数とは別に保持しつつ、キーを共有定数の subset に制約する方式が妥当。

### 4. Edge cases

**Q: 境界条件は？**
A:
- 今後フェーズが追加された場合、1箇所を更新すれば全箇所に反映される（これがそもそもの目的）
- review.js は REVIEW_PHASES のキーが VALID_PHASES の subset であることを保証する必要がある（ランタイムチェックまたは静的保証）

### 5. Test strategy

**Q: テスト方針は？**
A:
- 共有定数が期待値を持つことを検証
- get-guardrail、set-metric が共有定数を使っていることを検証（不正フェーズ拒否テスト）
- review.js の REVIEW_PHASES キーが共有定数の subset であることを検証

## Development Type

Bug fix（定数の不整合修正）

## Approval

- [x] User approved this draft (autoApprove)
