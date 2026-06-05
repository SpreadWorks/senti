## Scope
The flow integration gate / finalize / report, and execution evidence for `sdd-forge upgrade`, which is required after changes to `src/skills` or `src/presets`.

## Problem
Currently, `sdd-forge upgrade` only prints results to stdout and does not leave a machine-readable artifact under the spec directory. The integration gate validates trust inputs such as `test-execute-result.json`, `test-result-review.json`, `file-map.json`, and raw logs, but upgrade execution results are not included in that contract. As a result, for specs that change skills or presets, the gate cannot verify whether upgrade was run as a standard artifact, making it easy to rely on manual issue-log entries or conversation history.

## Cause
The upgrade command runs `deploySkills`, obsolete skill cleanup, preset copy, and config migration, then prints a summary to stdout. It is not connected to the flow's durable artifact list or the integration gate's artifact trust validation. Test-related artifacts are already established as the contract for runtime tests/regressions, but upgrade has no equivalent dedicated contract.

## Improvement Direction
Do not mix upgrade execution evidence into `test-execute`; instead, save a dedicated `upgrade-result.json`, and a raw log if needed, under the spec directory. The artifact should include version, command, dryRun, exitCode, skill results for updated/unchanged/removed, whether config migration occurred, paths checked, and raw log path. The gate should validate this artifact only when there are changes that require upgrade, such as changes under `src/skills` or `src/presets`, and it should also be added to the durable artifact targets for finalize/report.

## Completion Criteria
In a flow that changes `src/skills`, `src/presets`, or similar upgrade-required files, the execution result of `sdd-forge upgrade` remains as a dedicated artifact under the spec directory. The integration gate can validate that artifact when needed, and the evidence remains available after finalize/report. Without manually appending to the issue log, it should be possible to track whether upgrade was run, whether there were no changes, whether updates occurred, or whether it failed.

## Priority
Medium. If skill and preset changes continue to be frequent, this is worth turning into a todo. Treat it not as a one-off guard against operational mistakes, but as flow artifact maintenance to reduce gate retry friction and reliance on manual explanations.

<details>
<summary>ja</summary>

[ENHANCE] flow: upgrade 実行証跡を gate 標準 artifact にする

## 対象
flow の integration gate / finalize / report と、src/skills・src/presets 変更後に必要になる sdd-forge upgrade の実行証跡。

## 問題
現状の sdd-forge upgrade は標準出力に結果を出すだけで、spec 配下に機械可読 artifact を残さない。integration gate は test-execute-result.json、test-result-review.json、file-map.json、raw log などを trust input として検証するが、upgrade 実行結果はその contract に含まれていない。そのため、スキルやプリセットを変更した spec で upgrade 実行の有無を gate が標準 artifact として確認できず、手動 issue-log や会話履歴に依存しやすい。

## 原因
upgrade コマンドは deploySkills、obsolete skill cleanup、preset copy、config migration を実行して summary を標準出力に出す構造で、flow の durable artifact 一覧や integration gate の artifact trust validation に接続されていない。test 系 artifact は runtime test/regression の契約として確立済みだが、upgrade には同等の専用契約がない。

## 改善方針
upgrade 実行証跡を test-execute に混ぜず、専用の upgrade-result.json と必要なら raw log を spec 配下に保存する。artifact には version、command、dryRun、exitCode、updated/unchanged/removed の skill 結果、config migration の有無、確認対象パス、raw log path を含める。src/skills または src/presets 等の upgrade 必須変更がある場合だけ gate がこの artifact を検証できるようにし、finalize/report の durable artifact 対象にも追加する。

## 完了条件
src/skills または src/presets 等を変更する flow で、sdd-forge upgrade の実行結果が spec 配下の専用 artifact として残る。integration gate が必要時にその artifact を検証でき、finalize/report 後も証跡が保持される。手動 issue-log 追記なしでも、upgrade 実行済み・変更なし・更新あり・失敗の判断材料が追跡できる。

## 優先度
中。今後もスキル・プリセット変更が多いなら Todo 化する価値がある。単発の運用ミス対策ではなく、gate 再試行と手動説明依存を減らすための flow artifact 整備として扱う。

</details>