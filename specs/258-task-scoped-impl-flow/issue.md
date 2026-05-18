## Background
In the implementation of Issue #321, tasks[] was decomposed into T-1 through T-7, but the implementation phase proceeded with bulk implementation while currentTaskId remained null. As a result, review/gate-impl targeted the entire diff and all requirements rather than the task scope, causing gate-impl to suffer from input overflow and long-running loops.

## Problem
Even with task decomposition in place, the CLI does not enforce the task cursor. If the AI or operator forgets to follow task order, implement/review/gate fall back to broad mode. This is a design weakness in the flow, not an operational mistake.

## Expected Improvements
- Make currentTaskId mandatory in the implementation phase when tasks[] exists
- Limit implement/review/gate-impl to the requirements and files of the current task only
- Have flow state manage the cursor that advances to the next task upon task completion
- Prohibit broad gate with currentTaskId: null, or require an explicit opt-in option
- If a full gate is needed, treat it as a separate step immediately before final
- Include per-task implementation and verification results in the final report

## Acceptance Criteria
- Running implement/review/gate-impl without currentTaskId in a task-decomposed flow fails
- gate-impl input is limited to the current task scope
- The procedure to advance to the next task after task completion is explicitly shown in CLI output
- When bulk implementation is required, it is recorded as an explicit broad mode

<details>
<summary>ja</summary>

[BUG] task分解後に実装/review/gateがtask単位に限定されない

## 背景
Issue #321 の実装で tasks[] は T-1〜T-7 に分解されていたが、実装 phase では currentTaskId が null のまま一括実装に進んだ。その結果、review / gate-impl が task scope ではなく全体差分・全 requirements を対象にし、gate-impl が入力過大および長時間ループになった。

## 問題
タスク分解済みでも、CLI 側が task cursor を強制していない。AI や操作者が task 順実行を忘れると、実装・review・gate が broad mode に落ちる。これは運用ミスではなく flow 設計上の弱点。

## 期待する改善
- tasks[] が存在する実装 phase では currentTaskId を必須にする
- implement / review / gate-impl は current task の requirements と files のみに限定する
- task 完了ごとに次 task へ進む cursor を flow state が管理する
- currentTaskId: null での broad gate は禁止、または明示オプション必須にする
- 全体 gate が必要なら final 直前の別ステップとして扱う
- final report に task 単位の実装・検証結果を出す

## 受け入れ条件
- task 分解済み flow で currentTaskId なしに implement / review / gate-impl を実行すると失敗する
- gate-impl の入力が current task scope に限定される
- task 完了後に次 task へ進む手順が CLI 出力で明示される
- 一括実装が必要な場合は明示的な broad mode として記録される

</details>