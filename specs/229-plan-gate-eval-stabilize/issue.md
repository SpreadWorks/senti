## Symptoms

The plan phase gates (gate-draft / gate-spec) produce FAIL results on different guardrails across runs against the same draft.md / spec.json, requiring many retries before reaching PASS.

Actual measurements from spec 221 (fix-hook-post-cleanup-cd):
- gate-draft: 8 AI calls total required
  - Run 1: prioritize-requirements FAIL
  - Run 2: draft-scope-boundary FAIL (file path included in requirements)
  - Run 3: complete-context FAIL (R1 missing When/If trigger)
  - Run 4: draft-scope-boundary FAIL (regression after fixing run 3)
  - Run 5: unambiguous-requirements FAIL ('cannot fuse' in R1 is not verifiable)
  - Run 6: complete-context + draft-confirm-brainstorm-vs-decide FAIL
  - Run 7+: PASS
- gate (spec): 4 calls total
  - schema validation fail → spec.json schema mismatch
  - prioritize-requirements FAIL (R1–R4 all marked must)
  - unambiguous-requirements FAIL ('immediately' is ambiguous)
  - Final run: PASS

## Discussion

Content that would have passed a previous run can still FAIL from a different angle on the next run. Because each guardrail is evaluated in an independent AI call, the judgment criteria shift slightly between runs, resulting in a fail-reason whack-a-mole situation.

c612 / 83b6 addressed this for gate-impl only by introducing retry limits, baseline diffs, and test-change distinction to achieve convergence. The same kind of FAIL reason shifting exists in plan phase gates but has not yet been addressed.

## Impact

- Increased gate call cost per spec (gate-draft alone cost 302 seconds / 178k input tokens for this spec)
- AI may introduce edits that merely appease a FAIL reason (e.g., rewriting 'immediately' with verbose explanation) without genuinely improving spec quality
- Even small, document-centric specs get stuck in lengthy retry loops

## Potential Approaches

1. Evaluate all guardrails in a single AI call, listing all issues at once (if that's not already the case)
2. Fix the evaluation prompt more strictly (e.g., temperature=0) to reduce judgment variance
3. Apply a retry limit to plan phase gates as well, escalating with the full FAIL reason history when the limit is reached (same as c612/A)
4. Add a short-circuit logic: when the same guardrail verdict flips from PASS to FAIL across consecutive re-evaluations of the same content, treat it as AI judgment noise and skip guardrails that passed in the previous run

## Related

- c612 (#194): Prior task addressing the same retry-cycle issue for gate-impl (Done)
- 83b6 (#180): Prior task addressing over-detection (pre-existing code) in gate-impl (Done)
- 0280: SKILL.md description drift for gate retry limit (Done)
- 5b0e (#208): Reset mechanism after retry limit is reached (Done)

## Source

Measured during the spec 221 (fix-hook-post-cleanup-cd) session. PASS required gate-draft 8 retries + gate (spec) 4 retries — a total of 12 plan-phase gate AI calls (~467 seconds, 254k input tokens).

<details>
<summary>ja</summary>

[BUG] gate-draft / gate-spec の AI 評価が run 毎に不安定で不要なリトライを誘発する

## 症状

plan phase の gate（gate-draft / gate-spec）が、同一 draft.md / spec.json に対して run 毎に異なる guardrail で FAIL を出し、PASS まで多数のリトライを要する。

spec 221 (fix-hook-post-cleanup-cd) の実測:
- gate-draft: 合計 8 回の AI 呼び出しが必要だった
  - 1回目: prioritize-requirements FAIL
  - 2回目: draft-scope-boundary FAIL（要件に file path を含めたため）
  - 3回目: complete-context FAIL（R1 に When/If trigger が無いため）
  - 4回目: draft-scope-boundary FAIL（上記 3 を直した結果再発）
  - 5回目: unambiguous-requirements FAIL（R1 の 'cannot fuse' が非検証可能）
  - 6回目: complete-context + draft-confirm-brainstorm-vs-decide FAIL
  - 7回目以降で PASS
- gate (spec): 合計 4 回
  - schema validation fail → spec.json schema 不一致
  - prioritize-requirements FAIL（R1〜R4 が全て must）
  - unambiguous-requirements FAIL（'immediately' が曖昧）
  - 最終で PASS

## 論点

前回の PASS 相当の内容でも、別の観点が新たに FAIL になる挙動がある。各 guardrail の評価が独立した AI 呼び出しで行われ、判定基準が run 毎にわずかに揺らぐため、fail-reason-whack-a-mole 状態になる。

c612 / 83b6 は gate-impl のみを対象として retry 上限・baseline 差分・test 変更区別を導入して収束させた。plan phase gate にも同種の FAIL reason shifting が存在するが、対策未着手。

## 影響

- spec 1 本あたりの gate 呼び出しコスト増大（本 spec では gate-draft だけで 302 秒 / 17.8万 input tokens）
- AI が FAIL reason をなだめるだけの編集（例: 'immediately' を冗長な説明に書き換える等）で本質的な spec 品質改善ではない変更が入りうる
- 文書中心の小さな spec でも retry ループに時間がかかる

## 考えられるアプローチ

1. 全 guardrail 評価を単一の AI 呼び出しで実施し、一回で全指摘を列挙させる（現状がそうでないなら）
2. 評価 prompt を stricter に固定し（temperature=0 等）、判定差分を減らす
3. plan phase gate にも retry 上限を設け、上限に達したら fail reason 履歴と共にエスカレーションする（c612/A と同様）
4. 同一 guardrail の verdict が前回と逆転するのは多くの場合 AI の判断揺らぎなので、連続して同内容で gate を再評価する場合に前回 PASS した guardrail は skip する短絡ロジックを入れる

## 関連

- c612 (#194): gate-impl について同種の retry-cycle 課題を対処した先行タスク（Done）
- 83b6 (#180): gate-impl の過検出（pre-existing code）を対処した先行タスク（Done）
- 0280: gate retry 上限の SKILL.md 記述乖離（Done）
- 5b0e (#208): retry 上限到達後の reset 手段（Done）

## 出典

spec 221 (fix-hook-post-cleanup-cd) セッションで実測。gate-draft 8 retry, gate (spec) 4 retry で PASS。合計 12 回の plan-phase gate AI 呼び出し（約 467 秒, 25.4万 input tokens）が必要だった。

</details>