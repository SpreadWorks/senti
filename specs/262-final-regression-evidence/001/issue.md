## Background

When project tests fail during final-regression, current failures, pre-existing failures, and infrastructure-caused failures appear mixed together, making it easy for the AI to choose the wrong next action.

Recent fixes made tests/run.js explicitly output spawn errors / signals / silent nonzero exits, and run-final-regression.js now classifies silent nonzero / spawnError as infra_failure. The remaining work is to clean up failure classification names, artifact responsibilities, log retention, and worktree execution guarantees.

## Tasks

1. Replace `pre_existing` with a clearer `failureKind`. Candidate: `unattributed_existing_failure`. Meaning: "project test failed, but cannot be attributed to changes in this run."
2. Make `final-regression-result.json` represent only the current run's result. Do not emit `previousFailureKind` in success artifacts; move past failure history to the `issue-log.json` side.
3. Save the raw log for each final-regression attempt. Example: `final-regression-attempt-001.log`, `final-regression-attempt-002.log`. Make the latest result reference the corresponding attempt log.
4. Assert that final-regression during a worktree flow is executed from the active worktree root. If the active worktree and `ctx.root` do not match, stop with an infra failure without running project tests.
5. Format the `failureKind` and `nextAction` output so neither humans nor the AI misread it. In particular, distinguish the three states: "the test itself failed", "cannot determine if caused by this change", and "stop/continue the flow".

## Acceptance Criteria

- silent nonzero / spawnError / sandbox-related errors are not classified as `pre_existing` equivalents.
- When final-regression passes, past failures cannot be read from the artifact as if they were current results.
- Running final-regression multiple times still retains the raw log for each attempt.
- In worktree mode, using the main repo root by mistake causes an explicit failure before project tests run.
- In addition to existing tests, unit tests exist for: `failureKind` rename, `previousFailureKind` separation, attempt log, and worktree root assertion.

## Notes

Do not fake the exitCode of a full project test run as passing. If tests fail, record them as failed, and express whether the failure is blocking or requires a user decision in a separate field or via `nextAction`.

<details>
<summary>ja</summary>

[ENHANCE] final-regression の失敗分類と証跡を整理する

## 背景

final-regression で project test が失敗したとき、現在の失敗・過去の失敗・実行環境起因の失敗が混ざって見えると、AI が誤った次アクションを選びやすい。

直近の修正で、tests/run.js は spawn error / signal / silent nonzero exit を明示出力し、run-final-regression.js は silent nonzero / spawnError を infra_failure に分類するようになった。残対応として、失敗分類名・artifact の責務・ログ保持・worktree 実行保証を整理する。

## やること

1. pre_existing をより明確な failureKind に置き換える。候補は unattributed_existing_failure。意味は「project test は fail したが、今回変更起因とは証明できない失敗」。
2. final-regression-result.json は現在の実行結果だけを表すようにする。previousFailureKind は成功 artifact から出さず、過去の失敗履歴は issue-log.json 側に寄せる。
3. final-regression の raw log を試行ごとに保存する。例: final-regression-attempt-001.log, final-regression-attempt-002.log。最新結果からも該当 attempt log を参照できるようにする。
4. worktree flow 中の final-regression は active worktree root で実行されていることを assert する。active worktree と ctx.root が一致しない場合は project test を走らせず infra failure として止める。
5. failureKind と nextAction の表示を人間と AI が誤読しない形にする。特に「テスト自体は fail」「今回変更起因とは判断不能」「flow を止める/進める」の3つを分けて表現する。

## 受け入れ条件

- silent nonzero / spawnError / sandbox 系は pre_existing 相当に分類されない。
- final-regression が pass のとき、artifact から過去 failure が現在結果のように読めない。
- final-regression を複数回実行しても、各 attempt の raw log が残る。
- worktree mode で main repo 側の root を誤って使うと、project test 実行前に明示的に失敗する。
- 既存テストに加えて、failureKind 改名、previousFailureKind 分離、attempt log、worktree root assert の unit test がある。

## 注意

full project test の exitCode を pass に偽装しない。テストが fail した場合は fail と記録し、その failure が blocking かどうか、または user decision が必要かどうかを別フィールドまたは nextAction で表現する。

</details>