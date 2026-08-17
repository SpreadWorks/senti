## Background
After finalize, the Retro section in report.json / report display shows '-', and the aggregated results from the generated retro.json are not displayed.

## Investigation
- retro.json itself is generated and contains requirements and summary.
- generateReport only populates data.retro when results.retro.status is done and a summary exists.
- Running `flow run report` standalone reads retro.json and restores results.retro.
- executeCommitPost in the finalize post-hook reads test-execute-result.json and test-result-review.json, but does not read retro.json and restore results.retro.
- The 2026-05-06 commit 07325b39 "rewrite run-retro to aggregate test-execute artifacts" removed Retro execution from the finalize post-hook, but likely did not add logic to pass an existing retro.json back as report input.
- tests/unit/flow/run-finalize-retro-invocation.test.js verifies that finalize does not create results.retro, and does not verify that Retro appears in the report.

## Fix Direction
- Before report generation in finalize, read retro.json and construct results.retro = { status: "done", summary, requirements }.
- Add a regression test verifying that a report generated via finalize displays the summary from retro.json.

## Relevant Locations
- src/flow/lib/run-finalize.js — executeCommitPost
- src/flow/lib/run-report.js — retro.json reading logic
- src/flow/commands/report.js — Retro condition in generateReport
- tests/unit/flow/run-finalize-retro-invocation.test.js

<details>
<summary>ja</summary>

[BUG] Finalize report に Retro 結果が出ない

## 背景
finalize 後の report.json / report 表示で Retro セクションが '-' になり、生成済みの retro.json の集計結果が表示されない。

## 調査結果
- retro.json 自体は生成されており、requirements と summary は存在する。
- generateReport は results.retro.status が done で summary がある場合だけ data.retro を作る。
- flow run report 単体は retro.json を読み、results.retro を補っている。
- finalize post-hook の executeCommitPost は test-execute-result.json と test-result-review.json は読むが、retro.json を読んで results.retro に戻していない。
- 2026-05-06 の 07325b39 rewrite run-retro to aggregate test-execute artifacts で finalize post-hook から Retro 実行が外されたが、既存 retro.json を report 入力へ戻す処理が追加されなかった可能性が高い。
- tests/unit/flow/run-finalize-retro-invocation.test.js は finalize が results.retro を作らないことを確認しており、report に Retro が表示されることを検証していない。

## 修正方向
- finalize の report 生成前に retro.json を読み込み、results.retro = { status: "done", summary, requirements } を構築する。
- 併せて finalize 経由の report が retro.json の summary を表示する回帰テストを追加する。

## 参考箇所
- src/flow/lib/run-finalize.js executeCommitPost
- src/flow/lib/run-report.js retro.json 読み込み処理
- src/flow/commands/report.js generateReport の Retro 条件
- tests/unit/flow/run-finalize-retro-invocation.test.js

</details>