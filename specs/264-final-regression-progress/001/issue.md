## Background
final-regression tends to produce no output for extended periods, making it difficult to tell whether it is still running or has stalled. The raw log location is also not visible at startup, making it hard to monitor in practice.

## Goals
- Display the command and raw log path at execution start
- Emit a heartbeat or elapsed time during long-running executions
- Provide a clear link to open artifacts on failure

## Acceptance Criteria
During final-regression execution, there is no silent period; intermediate progress and where to check are immediately visible.

<details>
<summary>ja</summary>

[ENHANCE] final-regression: 実行中の進捗と raw log path を表示する

## 背景
final-regression は長時間無出力になりやすく、進行中なのか停止しているのか判断しづらい。raw log の場所も開始時に見えないため、運用で追いにくい。

## やりたいこと
- 実行開始時にコマンドと raw log path を表示する
- 長時間実行では heartbeat または elapsed time を出す
- 失敗時に artifact を開く導線を明確にする

## 完了条件
final-regression 実行中に無反応に見えず、途中経過と確認先がすぐ分かる。

</details>