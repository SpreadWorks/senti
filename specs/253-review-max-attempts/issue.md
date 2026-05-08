## Background

Currently, `maxAttempts` for review steps (plan.review-draft, plan.review-spec, plan.review-test, impl.review) is a soft rule that the AI voluntarily observes, and there is no mechanism to stop the AI if it runs away. An incident occurred where the draft phase of spec 251 (Issue #310) iterated 3 times despite being configured for auto:1.

## Existing Reference Implementation

Gates already have a mechanism that records attempt counts in flow.json via `updateGateRetryCounter` (src/flow/lib/run-gate.js). Additionally, the CLI rejects consecutive identical FAILs (`gate-impl re-run rejected: working tree is unchanged`). The same pattern will be introduced for reviews.

## Expected Behavior

- Record review attempt counts in flow.json (state.reviewAttempts or equivalent key)
- When `sdd-forge flow run review --phase <p>` is called, if the current attempt count >= maxAttempts for that phase, the CLI returns `Envelope.fail("REVIEW_MAX_ATTEMPTS_EXCEEDED")`
- The maxAttempts value is derived from the review node attribute in FLOW_DEFINITION via `resolveMaxAttempts(context)` (accounting for auto/manual mode)
- Reset the counter when a review passes

## Out of Scope

- This is a concern independent of the flow integration phase order fix in spec 251 (Issue #310)
- No changes to the review command logic itself are needed (only adding a gate check in the CLI wrapper layer)

## Notes

Raised following the incident where the AI self-iterated 3 times exceeding auto:1 in the draft phase of spec 251. Among 3 proposed approaches running in parallel (improving skill instruction wording, adding memory, and CLI enforcement), CLI enforcement is judged to be the most robust as an invariant that does not depend on AI implementation.

<details>
<summary>ja</summary>

[ENHANCE] review の maxAttempts を CLI 側で強制する

## 背景

現状 review (plan.review-draft, plan.review-spec, plan.review-test, impl.review) の maxAttempts は AI が自主的に守る soft rule であり、AI が誤って自走した場合に止める仕組みが存在しない。spec 251 (Issue #310) の draft phase で auto:1 のところを 3 回イテレーションしてしまった事例が発生した。

## 既存の参考実装

gate には `updateGateRetryCounter` で attempt 数が flow.json に記録される仕組みが既にある (src/flow/lib/run-gate.js)。さらに同一 FAIL の連続検知 (`gate-impl re-run rejected: working tree is unchanged`) でも CLI が拒否する。同じパターンを review にも導入する。

## 期待する動作

- review attempt 数を flow.json (state.reviewAttempts または同等のキー) に記録する
- `sdd-forge flow run review --phase <p>` 呼び出し時に、現在の attempt 数 >= phase ごとの maxAttempts なら CLI が `Envelope.fail("REVIEW_MAX_ATTEMPTS_EXCEEDED")` を返す
- maxAttempts 値は FLOW_DEFINITION の review ノード attribute から resolveMaxAttempts(context) で導出 (auto/manual モード考慮)
- review が PASS したら counter をリセット

## スコープ外

- spec 251 (Issue #310) の flow integration phase 順序修正とは独立した concern
- review コマンド自体のロジック変更は不要 (CLI のラッパー層で gate チェックを追加するだけ)

## 補足

spec 251 の draft phase で AI が auto:1 を超えて 3 回 self-iterate した事象を機に提起。skill instructions の文言改善・memory 追加と並行する 3 案のうち、CLI 強制は AI 実装に依存しない invariant として最も robust と判断。

</details>