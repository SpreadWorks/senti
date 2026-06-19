## Background

When `final-regression` / `finalize-regression` fails, the workflow may currently be unable to proceed to the next step even if the user wants to skip it, leaving it stuck.

However, it is not acceptable to uniformly ignore failures and proceed. Regressions caused by the current diff should be fixed or stopped, and it is inappropriate for the same flow to keep carrying existing bugs or execution-environment issues that are outside the flow's responsibility.

## Purpose

When `final-regression` fails, classify the failure and allow the user or auto policy to choose the next action.

- Failures caused by the current diff should lead to fixing or stopping
- Existing failures, out-of-scope failures, and environment-related failures should be eligible for `record-and-proceed` after preserving evidence
- Choosing `record-and-proceed` must not treat the result as passed

## Expected Behavior

### Options on Failure

When `final-regression` fails, classify the failure and present the following options as needed.

Recommended order on the first failure:

1. Fix the error and rerun
2. Record the error and proceed to the next step

Recommended order if it fails again after attempting a fix:

1. Record the error and proceed to the next step
2. Fix the error and rerun

In auto mode, automatically select the recommended option. This avoids the workflow remaining stuck at the same point by attempting a fix on the first failure, then recording and proceeding if it fails again.

### Failures That May Allow `record-and-proceed`

- Tests that have been failing continuously from before
- Failures in functionality outside the changed scope
- Issues that require fixes outside the flow scope
- Environment-related causes such as external services, Docker, network, permissions, missing CLI, etc.
- Failures originating from the execution environment, such as sandbox / permission / child process `EPERM`
- Failures strongly suspected to be timeouts or flaky
- Failures that, after investigation, can be judged outside the responsibility of the current flow

### Failures That Must Not Allow `record-and-proceed`

- Tests are failing because of code changed in this diff
- Core behavior of the current specification or implementation is broken
- Build or artifact generation does not succeed
- State files or artifacts required for subsequent finalize processing cannot be written
- The cause of failure is clearly tied to the current diff
- The workflow internal state is broken and assumptions for subsequent steps no longer hold

In these cases, do not fall back to `record-and-proceed`; fix or stop instead.

## Classification Requirements

- Distinguish test assertion failures from test execution failures
- Since assertion failures may indicate implementation bugs, focus on determining whether they are caused by the diff
- Allow `spawn EPERM`, permission errors, missing CLI, dependency issues, timeouts, etc. to be treated as execution failures
- When determining `caused_by_current_change`, always record the evidence linking it to which diff, which behavior, and which log line
- Save the failure classification once classified as an artifact, and do not reclassify the same failure as a current-change regression on every rerun

## Recording Requirements

Even when `record-and-proceed` is selected, leave at least the following in the artifact equivalent to `final-regression-result` and in the final report.

- That the regression did not pass
- Failure kind
  - `caused_by_current_change`
  - `existing_failure`
  - `out_of_scope`
  - `environment`
  - `sandbox`
  - `timeout`
  - `dependency`
  - `flaky_suspected`
- Failed command
- Exit code
- Raw log path
- Failure summary
- Relationship to the current diff
- Number of fix attempts
- The fact that `record-and-proceed` was selected
- Remaining risk
- Next recommended action

## Display Requirements

Even after `record-and-proceed`, the final summary / report / status must clearly show that the regression did not pass. Do not display it in a way that makes it look successful.

## Non-Goals

- Treating test failures as success
- Proceeding while overlooking regressions caused by the current diff
- Forcing progress when the workflow internal state is broken or artifacts cannot be written
- Always presenting a stop option to the user

In cases where stopping is appropriate, the agent may stop based on its own judgment.

## Acceptance Criteria

- When `final-regression` fails, the first failure recommends fix and rerun
- If it fails again after a fix, record the error and proceed to the next step becomes recommended
- In auto mode, follow the recommendation: fix on the first failure, then record and proceed on repeated failure
- Even when `record-and-proceed` is selected, report / status / artifact clearly indicate that it did not pass
- Failures caused by the current diff do not fall back to `record-and-proceed`; they are fixed or stopped
- Existing failures, out-of-scope failures, environment causes, and sandbox / permission / timeout / dependency failures can proceed to the next step with evidence
- Broken workflow internal state, inability to write artifacts, and collapsed assumptions for subsequent steps are excluded from `record-and-proceed` and cause a stop
- Assertion failures and execution failures are distinguished in artifacts / reports
- `caused_by_current_change` decisions record the relationship to the diff and evidence from logs
- Even after `record-and-proceed`, the final summary clearly indicates that the regression did not pass and lists remaining risks

<details>
<summary>ja</summary>

final-regression 失敗時に分類・記録して進む選択肢を出す

## 背景

`final-regression` / `finalize-regression` が失敗したとき、現在はユーザーがスキップを望んでも workflow が次へ進めず、停止状態が続くことがある。

ただし、失敗を一律に無視して進めるのは不可。今回の差分が原因の regression は修正または停止すべきであり、flow の責務外の既存不具合や実行環境要因まで同一 flow で抱え続けるのは不適切。

## 目的

`final-regression` 失敗時に、失敗を分類したうえで、ユーザーまたは auto policy が次の行動を選べるようにする。

- 今回の差分起因の失敗は、修正または停止に倒す
- 既存失敗、範囲外失敗、環境要因は、証跡を残したうえで `record-and-proceed` を選べるようにする
- `record-and-proceed` を選んでも pass 扱いにはしない

## 期待する挙動

### 失敗時の選択肢

`final-regression` が失敗したら、失敗分類を行い、必要に応じて次の選択肢を提示する。

初回失敗時の推奨順:

1. エラーを修正して再実行する
2. エラーとして記録して次のステップへ進む

修正を試みた後も再度失敗した場合の推奨順:

1. エラーとして記録して次のステップへ進む
2. エラーを修正して再実行する

auto mode では recommended option を自動選択する。これにより、初回は修正を試み、再失敗時は記録して先へ進むことで、workflow が同じ地点で停止し続けることを避ける。

### `record-and-proceed` を許可してよい失敗

- 既存から継続して落ちているテスト
- 変更範囲外の機能の失敗
- flow scope 外の修正が必要な問題
- 外部サービス、Docker、ネットワーク、権限、CLI 不在などの環境要因
- sandbox / permission / child process `EPERM` など実行環境由来の失敗
- timeout や flaky の疑いが強い失敗
- 調査の結果、今回の flow の責務外と判断できる失敗

### `record-and-proceed` を許可してはいけない失敗

- 今回変更したコードが原因でテストが落ちている
- 今回の仕様・実装の主要動作が壊れている
- build や成果物生成が成立していない
- 後続 finalize 処理に必要な状態ファイルや成果物を書けない
- 失敗原因が明確に今回の差分に紐づいている
- workflow 内部状態が壊れており、後続 step の前提が崩れている

この場合は `record-and-proceed` に倒さず、修正または停止する。

## 分類要件

- test assertion failure と test execution failure を区別する
- assertion failure は実装不具合の可能性があるため、差分起因かどうかを重点的に判定する
- `spawn EPERM`、permission error、CLI 不在、dependency 問題、timeout などは execution failure として扱えるようにする
- `caused_by_current_change` と判断する場合は、どの差分・どの挙動・どのログ行に紐づくかの根拠を必ず残す
- 一度分類した failure classification は artifact に保存し、再実行時に同じ失敗を毎回 current-change regression として再分類しない

## 記録要件

`record-and-proceed` を選んだ場合も、`final-regression-result` 相当の artifact と final report に少なくとも以下を残す。

- regression は未通過であること
- failure kind
  - `caused_by_current_change`
  - `existing_failure`
  - `out_of_scope`
  - `environment`
  - `sandbox`
  - `timeout`
  - `dependency`
  - `flaky_suspected`
- 失敗コマンド
- exit code
- raw log path
- 失敗要約
- 今回の差分との関係
- 修正を試みた回数
- `record-and-proceed` を選択した事実
- 残リスク
- 次の推奨アクション

## 表示要件

`record-and-proceed` 後も、final summary / report / status では regression 未通過を明確に表示する。成功扱いに見える表示にはしない。

## 非目標

- テスト失敗を成功扱いにすること
- 今回差分起因の regression を見逃して進むこと
- workflow 内部状態破損や成果物書き込み不能でも無理に進むこと
- 常に stop option をユーザーへ提示すること

停止が妥当なケースでは、agent 判断で停止してよい。

## 受け入れ条件

- `final-regression` 失敗時、初回は「修正して再実行」が recommended になる
- 修正後に再失敗した場合は「エラーとして記録して次へ進む」が recommended になる
- auto mode では recommended に従い、初回は修正、再失敗時は記録して進む
- `record-and-proceed` を選んでも、report / status / artifact 上は未通過として明示される
- 今回差分起因の失敗は `record-and-proceed` に倒さず、修正または停止される
- 既存失敗、範囲外失敗、環境要因、sandbox / permission / timeout / dependency failure は、証跡付きで次ステップへ進める
- workflow 内部状態破損、成果物書き込み不能、後続 step の前提崩壊は `record-and-proceed` 対象外として停止する
- assertion failure と execution failure が artifact / report 上で区別される
- `caused_by_current_change` 判定には、差分との関係とログ上の根拠が記録される
- `record-and-proceed` 後も final summary に regression 未通過と残リスクが明示される

</details>