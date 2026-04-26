## Background

In spec 229 (9dcd624d), `draft` was added to `RETRY_TRACKED_PHASES`, applying a 3-attempt limit. As a result, retry exhaustion spiked from 0% to 60%.

- Pre-229: 0 retry exhausted out of 37 specs with draft FAILs (0%)
- 229+: 6 retry exhausted out of 10 specs with draft FAILs (60%)

There are 8 draft guardrails, and fix patterns that conflict with other guardrails (e.g., fixing `scope-boundary` causes `recommend-with-reasoning` to FAIL) fail to converge within 3 attempts.

## Action Items

### 1. Increase the retry limit for draft

With 8 draft guardrails that can mutually conflict, more attempts are needed than for `task-impl` (5–6 guardrails). Consider raising the limit from 3 to ~5–7. Alternatively, remove `draft` from `RETRY_TRACKED_PHASES` (revert to previous behavior).

### 2. Fix the body of `draft-scope-boundary`

There is a structural conflict with the `evidence` field. The `evidence/why/considered` fields were added to QA in `draft.json`, but the guardrail body does not account for them. It incorrectly FAILs by classifying code references in `evidence` as "implementation details". Add a note to the body stating: "Code references within the `evidence/why/considered` fields of QA entries are provided as justification and do not constitute implementation details."

### 3. Consider removing the draft phase from `draft-recommend-with-reasoning`

With the migration to `draft.json`, the `qa[].evidence/why/considered` fields are now structured, and `checkDraftJson` in `gate-draft` mechanically verifies that `evidence` is non-empty. This overlaps with the AI-based quality check this guardrail provides. However, since mechanical checks (existence verification) and AI checks (quality judgment) operate at different layers, the decision to remove it should be made carefully.

## Data

Final blockers in the draft phase (guardrails that caused retry exhaustion):
- `draft-scope-boundary`: 11 times
- `complete-context`: 6 times
- `unambiguous-requirements`: 4 times
- `prioritize-requirements`: 3 times
- `draft-recommend-with-reasoning`: 1 time
- `backward-compatible-cli-interface`: 1 time

## Related

- spec 229 (9dcd624d): commit that added `draft` to `RETRY_TRACKED_PHASES`
- 8286: guardrail handling for the review command (separate axis)

<details>
<summary>ja</summary>

[ENHANCE] draft gate の retry exhaustion 対策（上限引き上げ + guardrail 調整）

## 背景

spec 229 (9dcd624d) で draft が RETRY_TRACKED_PHASES に追加され、3 回制限が適用されるようになった。その結果 retry exhaustion が 0% → 60% に急増。

Pre-229: draft FAIL のある spec 37 件中、retry exhausted 0 件（0%）
229+: draft FAIL のある spec 10 件中、retry exhausted 6 件（60%）

draft guardrail は 8 つあり、修正が別の guardrail と衝突するパターン（scope-boundary を直すと recommend-with-reasoning が FAIL する等）が 3 回以内に収束しない。

## 対応項目

### 1. draft の retry 上限引き上げ

draft guardrail は 8 つあり相互衝突が起きるため、task-impl（5〜6 個）より多くの試行が必要。3 → 5〜7 程度への引き上げを検討。または draft を RETRY_TRACKED_PHASES から外す（元に戻す）。

### 2. draft-scope-boundary の body 修正

evidence フィールドとの構造的衝突がある。draft.json の QA に evidence/why/considered フィールドが追加されたが、guardrail body がこれを想定していない。コード参照を含む evidence を「実装詳細」と判定して FAIL する。body に「QA の evidence/why/considered フィールド内のコード参照は根拠提示であり、実装詳細には該当しない」旨を追記する。

### 3. draft-recommend-with-reasoning の phase 削除検討

draft.json 移行で qa[].evidence/why/considered フィールドが構造化され、gate-draft の checkDraftJson が evidence 非空を機械検証している。AI による品質チェック（この guardrail）との重複がある。ただし機械チェック（存在確認）と AI チェック（品質判定）はレイヤーが異なるため、削除の判断は慎重に行う。

## データ

draft phase の final blocker（retry exhaustion を引き起こした guardrail）:
- draft-scope-boundary: 11 回
- complete-context: 6 回
- unambiguous-requirements: 4 回
- prioritize-requirements: 3 回
- draft-recommend-with-reasoning: 1 回
- backward-compatible-cli-interface: 1 回

## 関連

- spec 229 (9dcd624d): draft を RETRY_TRACKED_PHASES に追加したコミット
- 8286: review コマンドの guardrail 対応（別軸）

</details>