## Symptom

Running `sdd-forge flow run tests --baseline` internally spawns `npm test` to capture the baseline. The exit code of this wrapper command represents "whether the baseline was written successfully" and is independent of whether npm test itself passed or failed.

## Observed Behavior

Baseline capture at the start of spec 221 flow:
- Notification: "Background command \"Capture baseline tests\" completed (exit code 0)"
- Actual output: `summary: { unit: 2144, integration: 261, exitCode: 0 }`

In this case both pass and baseline success are 0, so there is no problem. However, if tests are already FAILING at the time the baseline is captured, the baseline write itself still succeeds, so exit 0 is returned.

## Problem

- A caller that only looks at the exit code may incorrectly assume "baseline is green"
- The accurate state cannot be determined without reading `data.exitCode` in the JSON envelope
- When an AI is driving the flow, there is a risk that exit code = 0 is treated as success and the flow proceeds

## Points to Confirm

- Intended design: is baseline meant to only care about "whether measurement succeeded"?
- If so, as long as the baseline pass/fail info is recorded in flow.json, the subsequent gate-impl can compare the diff, so there may be no practical harm
- Determine whether there is actual harm and whether the exit code design should be changed

## Proposed Fixes (if needed)

A. Mirror the wrapper exit code to the subprocess exit code
B. Leave as-is and document in docs/call sites that "exit code is for envelope-level judgment; test results must be read from data.exitCode"

## Discovered In Spec

- 221-worktree-edit-path-guard

<details>
<summary>ja</summary>

[BUG] flow run tests --baseline の exit code が subprocess の結果を隠す

## 症状

`sdd-forge flow run tests --baseline` を実行すると、内部で `npm test` を起動してベースラインを計測する。このラッパーコマンド自体の exit code は「baseline 書き込みに成功したか」を表しており、npm test 自体の pass/fail とは独立している。

## 観測事実

spec 221 flow 開始時の baseline 計測:
- 通知: "Background command \"Capture baseline tests\" completed (exit code 0)"
- 実出力: `summary: { unit: 2144, integration: 261, exitCode: 0 }`

この場合は pass / baseline 成功ともに 0 で問題ないが、もし baseline 取得時に既に test が FAIL していても、baseline 書き込み自体は成功するため exit 0 が返る。

## 問題点

- 呼び出し側が exit code だけを見ると「baseline は green」と誤解する可能性
- JSON envelope の `data.exitCode` を読まないと正確な状態が分からない
- AI がフロー駆動している場合、exit code = 0 を success として先に進むリスク

## 確認が必要な点

- 仕様上の意図: baseline は「計測に成功したか」だけ気にすればよい設計か？
- もしそうなら、flow.json 側に baseline の pass/fail 情報が記録されていれば後続 gate-impl が差分比較できるため実害なし
- 実害の有無と、exit code 設計を変えるべきかを判断する

## 対策案 (必要な場合)

A. ラッパー exit code を subprocess の exit code にミラーする
B. そのままにし、ドキュメント / 呼び出し側で「exit code は envelope 判断用、テスト結果は data.exitCode を見る」ことを明記する

## 発覚 spec

- 221-worktree-edit-path-guard

</details>