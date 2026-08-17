## Background

The current draft/spec review has partially mixed responsibilities between detection of findings, accept/reject decisions, repair, and the gate. On the spec side, the split into spec-review-triage / spec-repair is already done, but on the draft side a structure remains where draft.json repair is performed during review execution.

## Goal

Shift review toward "the job of recording findings" and separate the accept/reject decision and repair into explicit phases. Shift the gate toward mechanical readiness checks such as schema / guardrail / required field / artifact consistency.

## Changes

- Remove internal repair from review-draft-questions / review-draft-coverage so that review only saves the artifact
- Add explicit draft-review-triage / draft-repair equivalent phases on the draft side
- Save draft review artifacts as machine-readable JSON
- Move draft repair audit from being generated inside the review command to being an output of the repair phase
- Clarify the responsibility boundary between review and gate at the prompt / code / artifact validation level
- Split run-review FAIL / ADVISORY handling into blocking findings, advisory findings, and repair targets
- Update flow definition / migration / next-action / registry hooks
- Add and update related tests

## Out of Scope

- Renaming "gate" / "review" themselves
- Building a generic check framework

These will be handled in separate tasks after the responsibility separation is complete.

<details>
<summary>ja</summary>

[ENHANCE] draft/spec review の責務分離と repair flow 整理

## 背景

現在の draft/spec review は、指摘の検出、採否判断、repair、gate との責務境界が一部混在している。spec 側は spec-review-triage / spec-repair に分離済みだが、draft 側では review 実行中に draft.json repair まで行う構造が残っている。

## 目的

review は「指摘を記録する仕事」に寄せ、指摘を取り入れるかどうかの判断と repair を明示フェーズに分離する。gate は schema / guardrail / required field / artifact 整合性など機械的 readiness check に寄せる。

## 修正内容

- review-draft-questions / review-draft-coverage から内部 repair を外し、review は artifact 保存だけにする
- draft 側にも draft-review-triage / draft-repair 相当の明示フェーズを追加する
- draft review artifact を機械可読 JSON として保存する
- draft repair audit を review コマンド内生成ではなく repair フェーズの成果物に移す
- review と gate の責務境界を prompt / code / artifact validation で整理する
- run-review の FAIL / ADVISORY の扱いを blocking 指摘、advisory 指摘、repair 対象に分ける
- flow definition / migration / next-action / registry hook を更新する
- 関連テストを追加・更新する

## 含めないもの

- gate / review という名称自体の変更
- 汎用チェックフレームワーク化

これらは責務分離が終わった後に別タスクで扱う。

</details>