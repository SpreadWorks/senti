## Related
- Same "whack-a-mole loop fix" series as dbf7 (draft-scope-boundary whack-a-mole loop fix). Different approach.

## Target guardrails

Multiple guardrails share the same "missed vague expressions" loop structure, so addressing them together:

- **complete-context** (loops in 14 of 216 specs, max 6 iterations): specificity of overall requirements
- **unambiguous-requirements** (loops in 4 specs, max 4 iterations): use of vague adjectives

The two have significant overlap (often both fail on the same spec) and share a common remediation approach.

## Fix strategy candidates

A. **Reviewer prompt revision**: Have the reviewer enumerate **all** violations exhaustively, not just examples (root fix, generalizable)
B. **Author-side step addition**: Before fixing, have the author do a "full-document scan for the same pattern" and fix all at once

A and B are not mutually exclusive and can be combined.

## Background

Both guardrails have "the rule itself is valid" and "the reviewer operates correctly," but the cited locations change with each iteration, causing the author's partial fixes to create loops.

Example (complete-context, spec 246, 4 iterations):
- iter 1: "significant reduction," "ensure reliability"
- iter 2: "structure that allows identifying and applying target locations"
- iter 3: "update" (3 should items)
- iter 4: "so that it can be consumed correctly"

Example (unambiguous-requirements, spec 215, 4 iterations):
- iter 1: "minor edits acceptable"
- iter 2: "when deemed necessary," "dedicated flow"
- iter 3: "deemed necessary," "official flow"
- iter 4: "dedicated flow operation," "existing log destination"

## Distinction from dbf7

| guardrail | Rule nature | Root cause of whack-a-mole | Fix strategy |
|---|---|---|---|
| draft-scope-boundary | Boundary is subjective | Reviewer judgment fluctuates | dbf7: relax + add safety net downstream |
| complete-context | Criteria are objective | Author makes partial fixes | This task: enumerate all / fix all |
| unambiguous-requirements | Criteria are objective | Same | This task |

## Potential for broader application

If A (reviewer exhaustive enumeration) works, the same mechanism can be applied to other whack-a-mole guardrails (REQ-SPEC, etc.). A leading candidate for fundamentally fixing whack-a-mole across multiple guardrails.

<details>
<summary>ja</summary>

もぐら叩きループ対策: vague 表現系 guardrail の違反全数化（complete-context, unambiguous-requirements）

## 関連
- dbf7（draft-scope-boundary もぐら叩きループ対策）と同じ「もぐら叩きループ対策」シリーズ。アプローチは別。

## 対象 guardrail

複数 guardrail が同じ「vague 表現の取りこぼし」構造でループしているため、まとめて対処:

- **complete-context** (216 spec 中 14 spec でループ、最大 6 iter): 要件全体の具体性
- **unambiguous-requirements** (4 spec でループ、最大 4 iter): vague 形容詞の使用

両者はオーバーラップが大きく（同じ spec で両方 fail することが多い）、対処方針も共通。

## 修正方針候補

A. **reviewer プロンプト改修**: 違反を例示でなく **全数列挙** させる（根本対策、汎用化可能）
B. **author 側 step 追加**: 修正前に「同種パターンを全文スキャン」してから一括修正させる

A/B は排他ではなく、組み合わせ可能。

## 背景

両 guardrail とも「ルール自体は妥当」「reviewer も正しく動作」だが、cite される箇所が iter ごとに変わるため author の partial fix がループを生む。

実例（complete-context, 246 spec, 4 iter）:
- iter 1: 「大幅削減」「信頼性を確保」
- iter 2: 「対象箇所を特定・適用できる構造」
- iter 3: 「更新」（should 項目 3 つ）
- iter 4: 「正しく消費できるよう」

実例（unambiguous-requirements, 215 spec, 4 iter）:
- iter 1: 「軽微編集可」
- iter 2: 「必要と判断された時」「専用導線」
- iter 3: 「必要と判断」「公式の導線」
- iter 4: 「dedicated flow operation」「existing log destination」

## dbf7 との切り分け

| guardrail | ルール性質 | もぐら叩きの真因 | 対策方針 |
|---|---|---|---|
| draft-scope-boundary | 境界が主観的 | reviewer の判定が揺れる | dbf7: 緩和+保険を後段へ |
| complete-context | 基準は客観的 | author が部分修正 | 本タスク: 全数列挙/全数修正 |
| unambiguous-requirements | 基準は客観的 | 同上 | 本タスク |

## 横展開の可能性

A（reviewer 全数列挙）が機能すれば、他のもぐら叩き系 guardrail（REQ-SPEC など）にも同じ仕組みを横展開可能。複数 guardrail のもぐら叩き根治の本命候補。

</details>