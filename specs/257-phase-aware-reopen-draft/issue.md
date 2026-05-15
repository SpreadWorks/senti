## Goal

When user confirmation is needed during the spec phase, allow returning to the draft phase to add QA.

## Background

The design from board 9430 / issue #321 established that when user judgment not captured in the draft is required during the spec phase, instead of confirming ad-hoc, the policy was to return to draft via `sdd-forge flow run reopen-draft --reason "<reason>"`.

However, the current `src/flow/lib/run-reopen-draft.js` assumes that tasks exist and that done tasks are present. As a result, in a pre-task-completion state such as during the spec phase, it fails with `NO_TASKS` or `NO_DONE_TASK` and cannot be used as a pre-spec-completion draft regression.

## Current Observations

- The split into `review-draft-questions` / `review-draft-coverage` is already implemented
- `src/flow/lib/run-reopen-draft.js` still carries assumptions designed for mid-implementation task additions
- `src/flow/prompts/plan/spec.md` instructs in-place user confirmation using Choice Format during spec, which does not align with reopen-draft regression
- `src/templates/skills/sdd-forge.flow/SKILL.md` still describes behavior intended for mid-implementation task additions

## Required Improvements

- Make `reopen-draft` phase-aware so that the done task precondition is not required before spec completion
- For reopen before spec completion, return draft to `in_progress` and reset review-draft-questions / review-draft-coverage / gate-draft / spec / review-spec / gate / approval / test / review-test to `pending`
- Do not delete existing spec artifacts; record them as stale
- Record `--reason` in issue-log so it can be referenced as a reason for additional confirmation on the draft side
- Align the spec prompt and flow skill template descriptions with the implemented behavior

## Acceptance Criteria

- `sdd-forge flow run reopen-draft --reason "..."` works in the spec phase before task completion
- Reopening during implementation phase or later preserves the traditional done task precondition and task-append semantics
- The spec prompt explicitly states the regression procedure when user confirmation is required
- The generated skill describes phase-aware reopen-draft
- Tests verify the reset matrix for pre-spec / post-approval / implementation phases

## Related

- issue #321: Unimplemented spec→draft regression defined in the draft review / gate-draft redesign
- board cdb2: Improving review/gate convergence beyond draft. This issue is a prerequisite inconsistency extracted from cdb2.

<details>
<summary>ja</summary>

[BUG] spec phase から reopen-draft へ戻れない

## ゴール

spec phase で user 確認が必要になった場合に、draft phase へ戻って QA を追加できるようにする。

## 背景

board 9430 / issue #321 の設計では、spec phase で draft にない user 判断が必要になった場合、ad-hoc に確認するのではなく `sdd-forge flow run reopen-draft --reason "<理由>"` で draft に戻す方針だった。

しかし現在の `src/flow/lib/run-reopen-draft.js` は、task が存在し、かつ done task があることを前提にしている。そのため spec phase 中のように task 完了前の状態では `NO_TASKS` または `NO_DONE_TASK` で失敗し、pre-spec-completion の draft 回帰として使えない。

## 現状の観測

- `review-draft-questions` / `review-draft-coverage` への分割は実装済み
- `src/flow/lib/run-reopen-draft.js` は mid-implementation task additions 用の前提のまま
- `src/flow/prompts/plan/spec.md` は spec 中の user 確認を Choice Format でその場確認する指示になっており、reopen-draft 回帰とは一致していない
- `src/templates/skills/sdd-forge.flow/SKILL.md` も mid-implementation task additions 用の説明のまま

## 必要な改善

- `reopen-draft` を phase-aware にし、spec 完了前は done task precondition を不要にする
- spec 完了前の reopen では draft を in_progress に戻し、review-draft-questions / review-draft-coverage / gate-draft / spec / review-spec / gate / approval / test / review-test を pending に戻す
- 既存 spec artifacts は削除せず stale として記録する
- `--reason` を issue-log に記録し、draft 側で追加確認すべき理由として参照できるようにする
- spec prompt と flow skill template の説明を実装済み挙動に合わせる

## 完了条件

- task 完了前の spec phase で `sdd-forge flow run reopen-draft --reason "..."` が使える
- implementation phase 以降の reopen は従来通り done task precondition と task append semantics を維持する
- spec prompt が user 確認必要時の回帰手順を明示している
- generated skill が phase-aware reopen-draft を説明している
- pre-spec / post-approval / implementation phase の reset matrix をテストで確認している

## 関連

- issue #321: draft review / gate-draft 再設計で定義された spec→draft 回帰の未実装部分
- board cdb2: draft 以外の review / gate 収束性改善。本件は cdb2 から切り出した前提不整合。

</details>