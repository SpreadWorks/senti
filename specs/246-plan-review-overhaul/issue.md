## Background

There are two problems with the plan phase review steps (review-draft, review-spec).

### Problem 1: draft review is not fulfilling its original purpose

The current review-draft is designed so that after the draft QA is complete, the AI automatically reviews → automatically fixes (auto-fix). The review prompt (review.js:1241-1253) includes a "coverage gap" detection item, but the response after detection is "AI automatically generates answers and rewrites draft.json" (buildDraftFixPrompt). Since this is a QA that asked the user in interactive mode, having the AI fill in missing parts on its own defeats the purpose.

### Problem 2: spec review is slow

spec review runs 3 serial AI calls per iteration:
1. detect (full spec + context)
2. validate (proposals + full spec resent)
3. fix (approved proposals + full spec sent again)

Up to 3 iterations + verification means at worst 10 AI calls. spec.md is sent as full text 3 times per iteration.

## Revision Plan

### 1. draft review: question plan review + supplemental question approach

```
① Generate question plan
② External agent reviews the plan (adds questions if gaps exist)
③ QA with user
④ External agent reviews QA results
   → Gaps found → return to ③ and continue with additional questions
   → No gaps → complete
```

Design principles:
- **AI detects gaps, but answers come from the user**: no fabricating answers via auto-fix
- **Review is transparent to the user**: from the user's perspective, they just receive additional questions. The underlying review process is invisible.
- **autoApprove mode**: since AI answers its own questions, the current auto-fix equivalent is sufficient

### 2. spec review: unify with impl pattern + token reduction

#### Unification with impl review pattern

impl review works well with the following structure:
- External agent (propose) generates proposals
- Working AI (final) validates proposals (APPROVED/REJECTED)

spec review will align with this pattern. The current spec review has 3 steps (detect/validate/fix), but will be reduced to 2 steps (propose → validate) like impl, and auto-fix (spec.md rewrite) will be abolished.

#### Unified agent naming

Rename draft/final on the impl side to propose/final, unifying all reviews:
- `flow.impl.review.propose` / `flow.impl.review.final` (formerly draft/final)
- `flow.spec.review.propose` / `flow.spec.review.final` (newly added)

The term "draft" conflicts with "QA draft", so unified to "propose".

#### Token reduction via spec.json field selection

Currently the full spec.md (markdown text) is sent, but extracting only the necessary fields from spec.json can significantly reduce token count.

Fields needed for review:
- goal, background, scope, constraints, design_principles, overview
- requirements (id + desc + priority only; status, implementation_notes, test_strategy excluded)

Unnecessary fields:
- tasks (implementation details), acceptance_criteria (derivable from requirements), status, user_approval

Validation results on real data (all 365 specs):
- spec.md total: 1,514,680 bytes
- filtered json total: 611,582 bytes
- **60% reduction compared to spec.md**
- With auto-fix abolished, spec is sent 1 time instead of 3, reducing tokens to less than 1/5 of current

## Related Code

- src/flow/commands/review.js: runSpecReview (L1119), buildSpecReviewPrompt (L1040), buildSpecFixPrompt (L1075), buildDraftReviewPrompt (L1229), buildDraftFixPrompt (L1267), runDraftReview (L1287), runReviewLoop (L672)
- src/flow/prompts/plan/review-draft.md, review-spec.md
- src/flow/definition.js: createPlanReviewNode (L53-64)
- src/flow/lib/run-review.js: PHASE_REVIEW_PARSERS

<details>
<summary>ja</summary>

plan phase のレビュー改修（draft review + spec review）

## 背景

plan phase のレビューステップ（review-draft, review-spec）に2つの問題がある。

### 問題1: draft review が本来の目的を果たしていない

現在の review-draft は draft QA 完了後に AI が自動レビュー → 自動修正（auto-fix）する仕組みになっている。レビュープロンプト（review.js:1241-1253）に「カバレッジ不足」の検出項目があるが、検出後の対応が「AI が自動で回答を生成して draft.json を書き換える」（buildDraftFixPrompt）になっている。インタラクティブモードでユーザーに聞いた QA なのに、欠落部分を AI が勝手に埋めるのは本末転倒。

### 問題2: spec review が遅い

spec review は1イテレーションで3回の AI 呼び出しが直列に走る:
1. detect（spec全文 + context）
2. validate（proposals + spec全文を再送）
3. fix（approved proposals + spec全文をまた再送）

最大3イテレーション + verification で最悪10回の AI 呼び出し。spec.md がイテレーション毎に3回フルテキストで送られている。

## 改修方針

### 1. draft review: 質問計画レビュー + 追加質問方式

```
① 質問計画を生成
② 外部エージェントが計画をレビュー（不足があれば質問を追加）
③ ユーザーと QA
④ 外部エージェントが QA 結果をレビュー
   → 不足あり → ③ に戻って追加質問を続ける
   → 不足なし → 完了
```

設計原則:
- **不足の検出は AI がやるが、回答はあくまでユーザーから得る**: auto-fix で AI が回答を捏造しない
- **レビューはユーザーに透過的**: ユーザーから見ると追加質問が来るだけ。裏のレビュープロセスは見えない
- **autoApprove モード**: AI 自身が自問自答するため、現行の auto-fix 相当でよい

### 2. spec review: impl パターンに統一 + トークン削減

#### impl review パターンへの統一

impl review は以下の構造で上手く機能している:
- 外部エージェント（propose）が proposals を生成
- 作業中の AI（final）が proposals を検証（APPROVED/REJECTED）

spec review もこのパターンに揃える。現在の spec review は detect/validate/fix の3ステップだが、impl と同様に propose → validate の2ステップにし、auto-fix（spec.md 書き換え）は廃止する。

#### エージェント命名の統一

impl 側の draft/final を propose/final にリネームし、全レビューで統一する:
- `flow.impl.review.propose` / `flow.impl.review.final`（旧 draft/final）
- `flow.spec.review.propose` / `flow.spec.review.final`（新設）

draft という語が QA ドラフトと被るため propose に統一。

#### spec.json フィールド選択によるトークン削減

現在 spec.md（markdown 全文）を送っているが、spec.json から必要なフィールドのみ抽出して送ることでトークン量を大幅削減できる。

レビューに必要なフィールド:
- goal, background, scope, constraints, design_principles, overview
- requirements（id + desc + priority のみ。status, implementation_notes, test_strategy は除外）

不要なフィールド:
- tasks（実装詳細）, acceptance_criteria（requirements から導出可能）, status, user_approval

実データ検証結果（全365 spec）:
- spec.md 合計: 1,514,680 bytes
- filtered json 合計: 611,582 bytes
- **spec.md 比 60% 削減**
- auto-fix 廃止で spec 送信が3回→1回になるため、トークン量は現状の約 1/5 以下

## 関連コード

- src/flow/commands/review.js: runSpecReview (L1119), buildSpecReviewPrompt (L1040), buildSpecFixPrompt (L1075), buildDraftReviewPrompt (L1229), buildDraftFixPrompt (L1267), runDraftReview (L1287), runReviewLoop (L672)
- src/flow/prompts/plan/review-draft.md, review-spec.md
- src/flow/definition.js: createPlanReviewNode (L53-64)
- src/flow/lib/run-review.js: PHASE_REVIEW_PARSERS

</details>