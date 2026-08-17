## Related
- Part of the same "whack-a-mole loop prevention" series as dbf7 / b808 / 44e2.

## Problem

`assertNoRepeatedFail` in `run-gate.js:1158` is an escalation mechanism intended to stop loops that repeatedly fail on the same issue, but it currently uses a **byte-equal comparison** of `(guardrail_id, reason)`. AI-generated reason text varies slightly in wording from iteration to iteration, so even essentially identical feedback slips through and the mechanism does not serve its purpose.

Real example (215-flow-task-decomposition impl-test-preservation, 5 iterations):
- iter 1: `Spec mandates deleting related tests without documenting explicit user approval for modifying existing tests.`
- iter 2: `Spec mandates deleting related tests (REQ-7/REQ-8) without stating user approval for modifying existing tests.`
- iter 3: `Spec mandates deletion of related tests (REQ-7/REQ-8) without stating user approval for modifying/removing existing tests.`
- iter 4: `Spec mandates deleting related tests but does not record explicit user approval for modifying/removing existing tests.`
- iter 5: `The spec explicitly requires deleting existing related tests without noting user approval.`

A human would read these as the same feedback, but the byte-equal comparison lets them all through, consuming retries up to 5 times.

## Fix Direction

Change the comparison used by `buildFailPairKey` to **normalized word Jaccard similarity**:
- Preprocessing: lowercase, remove punctuation, remove stopwords
- Comparison: Jaccard coefficient of word sets
- Threshold: **0.4**
- Scope: escalate when the **maximum similarity** against all prior FAILs in the same phase exceeds the threshold, not only when compared with the immediately previous one (same scan scope as the existing `assertNoRepeatedFail`)

No external dependencies. This can be implemented with Node.js built-ins only.

## Threshold Rationale (Analysis of All Reasons from Spec 216)

Confirmed that loops can be classified into two types:

**A. Rewordings of the same issue (should escalate, high word Jaccard)**:
- 229 no-synchronous-io-in-hot-paths x3: 0.79
- 215 impl-test-preservation x5: 0.61
- 249 spec-test-coverage x5: 0.56
- 235 backward-compatible-cli-interface x3: 0.47
- 228 exit-code-contract x3: 0.44
- 235 review-guardrail spec-test-coverage x3: 0.41

**B. Whack-a-mole on different locations (should not escalate; should continue, b808 lineage)**:
- 215 task-decomp complete-context x6: 0.37
- 213 REQ-SPEC x4: 0.29
- 215 unambiguous-requirements x4: 0.10
- 246 complete-context x4: 0.00
- 236 complete-context / draft-scope-boundary x3-5: 0.00

With a threshold of 0.4, all 6 cases in group A are caught, while all cases in group B pass through. This is a clear separation point.

## Effect

- Repeated instances of the same issue escalate on the 2nd iteration (saving 3-5 wasted AI-cost iterations)
- Whack-a-mole cases (handled separately by b808 / dbf7 / 44e2) are unaffected
- Secondary effect: the AI can no longer evade detection by changing wording

## Boundary Cases

228 exit-code-contract (0.44) and 235 backward-compat (0.47) are barely on the catch side. These are handled separately by the acknowledged exception mechanism (44e2), so whether or not this task escalates them is not the root fix. Start operating with 0.4 and adjust the threshold later if needed.

## Implementation Notes

The expected replacement for `buildFailPairKey` is something like:

```js
const STOPWORDS = new Set(["a", "an", "the", "and", "or", ...]);

function normalize(text) {
  return new Set(
    text.toLowerCase()
        .replace(/[^\w\s-]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1 && !STOPWORDS.has(t))
  );
}

function jaccard(a, b) {
  const intersect = [...a].filter(x => b.has(x)).length;
  const union = a.size + b.size - intersect;
  return union === 0 ? 1 : intersect / union;
}
```

Inside `assertNoRepeatedFail`, make `(matching guardrail_id AND jaccard(normalize(prevReason), normalize(currReason)) >= 0.4)` the escalation condition.

<details>
<summary>ja</summary>

[ENHANCE] もぐら叩きループ対策: assertNoRepeatedFail を word Jaccard 0.4 で類似判定に強化

## 関連
- dbf7 / b808 / 44e2 と同じ「もぐら叩きループ対策」シリーズ。

## 問題

`run-gate.js:1158` の `assertNoRepeatedFail` は同じ問題で繰り返し fail するループを止めるエスカレーション機構だが、現在 `(guardrail_id, reason)` の **byte-equal 比較** を使っている。AI の reason 文は wording が iter ごとに微妙に揺れるため、本質的に同じ指摘でも素通りしてしまい、目的を果たせていない。

実例（215-flow-task-decomposition impl-test-preservation, 5 iter）:
- iter 1: `Spec mandates deleting related tests without documenting explicit user approval for modifying existing tests.`
- iter 2: `Spec mandates deleting related tests (REQ-7/REQ-8) without stating user approval for modifying existing tests.`
- iter 3: `Spec mandates deletion of related tests (REQ-7/REQ-8) without stating user approval for modifying/removing existing tests.`
- iter 4: `Spec mandates deleting related tests but does not record explicit user approval for modifying/removing existing tests.`
- iter 5: `The spec explicitly requires deleting existing related tests without noting user approval.`

人間が読めば全部同じ指摘だが、byte-equal 比較は素通りで 5 回まで retry を消費。

## 修正方針

`buildFailPairKey` の比較を **正規化済み word Jaccard 類似度** に変更:
- 前処理: 小文字化、句読点除去、ストップワード除去
- 比較: word set の Jaccard 係数
- 閾値: **0.4**
- 判定範囲: 直前との比較ではなく、過去の同 phase FAIL すべてとの **最大類似度** が閾値超で escalate（既存 `assertNoRepeatedFail` と同じ走査範囲）

外部依存なし。Node.js 組み込みのみで実装可能。

## 閾値根拠（216 spec の reason 全数を解析）

ループを 2 種類に分類できることを確認:

**A. 同じ問題の言い換え（escalate したい、word Jaccard 高い）**:
- 229 no-synchronous-io-in-hot-paths x3: 0.79
- 215 impl-test-preservation x5: 0.61
- 249 spec-test-coverage x5: 0.56
- 235 backward-compatible-cli-interface x3: 0.47
- 228 exit-code-contract x3: 0.44
- 235 review-guardrail spec-test-coverage x3: 0.41

**B. 異なる箇所のもぐら叩き（escalate せず continue させたい、b808 系列）**:
- 215 task-decomp complete-context x6: 0.37
- 213 REQ-SPEC x4: 0.29
- 215 unambiguous-requirements x4: 0.10
- 246 complete-context x4: 0.00
- 236 complete-context / draft-scope-boundary x3-5: 0.00

閾値 0.4 で A 群 6 件すべて catch、B 群はすべて素通り。明確な分離点。

## 効果

- 同じ問題の繰り返しは 2 iter 目で escalate（無駄な AI コスト 3-5 回分削減）
- もぐら叩き型（b808 / dbf7 / 44e2 で別途対処）は影響なし
- 副次効果: AI が wording を変えて誤魔化せなくなる

## 境界ケースの扱い

228 exit-code-contract (0.44) や 235 backward-compat (0.47) はギリギリで catch される側。これらは acknowledged exception 機構（44e2）で別途対処するので、本タスクで escalate されてもされなくても根本解決は別。0.4 で運用して問題があれば後から閾値調整。

## 実装メモ

`buildFailPairKey` を以下のような形に置き換える想定:

```js
const STOPWORDS = new Set(["a", "an", "the", "and", "or", ...]);

function normalize(text) {
  return new Set(
    text.toLowerCase()
        .replace(/[^\w\s-]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1 && !STOPWORDS.has(t))
  );
}

function jaccard(a, b) {
  const intersect = [...a].filter(x => b.has(x)).length;
  const union = a.size + b.size - intersect;
  return union === 0 ? 1 : intersect / union;
}
```

assertNoRepeatedFail 内で `(guardrail_id 一致 AND jaccard(normalize(prevReason), normalize(currReason)) >= 0.4)` を escalate 条件にする。

</details>