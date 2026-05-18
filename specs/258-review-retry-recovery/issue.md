## Purpose

Organize the review retry / recovery model to match the current flow implementation. In particular, avoid conflating review verdict FAIL, subprocess failure, provider failure, input size failure, and reaching maxAttempts, so that stop reasons and recovery procedures can be handled consistently.

## Current State

The following have already been implemented or substantially organized.

- Review verdict FAIL and subprocess failure are being separated
- `reviewRetry` is recorded based on the review verdict
- `REVIEW_MAX_ATTEMPTS_EXCEEDED` is returned by the CLI
- `flow set retry reset <gate|review> <phase> --yes` exists
- maxAttempts for plan review is centralized in `definition.js`
- `review-draft-questions` / `review-draft-coverage` / `review-spec` all have maxAttempts 1 for both auto and manual
- `review-test` has maxAttempts 3
- `TEST_REVIEW_PROMPT_TOO_LARGE` does not trigger subprocess retry

## Remaining Problems

- Recovery hints for rate limit / provider quota / API error / input length error are not systematized
- Display and recovery procedures for subprocess failure and verdict FAIL are not yet unified
- The next-action contract is weak for returning the stop reason, resolved maxAttempts, recovery command, and whether retry budget was consumed
- Task-scope review relies on a prompt-level soft limit and does not have the same CLI enforcement as flow-scope review
- The classification of failures that should be mechanically retried versus failures that should stop immediately is prone to being scattered in the code
- Artifacts / issue-log entries that clarify whether provider failure consumes `reviewRetry` are weak

## Scope

- Define classifications for review verdict FAIL, subprocess failure, provider failure, input size failure, and reaching maxAttempts
- Decide, for each classification, whether retry budget is consumed, whether step status advances, and what is recorded in the issue-log
- Make subprocess retry targets / non-targets in `run-review` an explicit classification
- Have the CLI return recovery hints for rate limit / input length / provider error
- Enable next-action / status to display the stop reason and recovery command
- Decide whether to align task-scope review retry enforcement with flow-scope review or explicitly keep it as a soft limit

## Out of Scope

- Separating blocking / non-blocking review itself
- Reducing input for `review-test`
- Detecting breakage in project-level tests
- The no-progress guard in gate-impl

These will be handled on separate boards.

## Completion Criteria

- The review failure taxonomy is defined in code or docs
- Failures that trigger subprocess retry / do not trigger subprocess retry are explicitly classified
- Provider quota / input size failure does not consume `reviewRetry` and returns recovery hints
- The envelope returned when maxAttempts is reached includes phase / attempts / max / recovery command
- next-action or status makes it clear why review is stopped and what the next recovery operation is
- The retry policy for task-scope review is documented

## Related

- cdb2: Parent topic for improving review convergence outside drafts
- aba9: Limit `review-test` input and writes to spec-local tests
- b4a6: Guarantee detection of project-level test breakage in `test-execute` / `gate-impl`

<details>
<summary>ja</summary>

[ENHANCE] Review retry と recovery モデルの整理

## 目的

review の retry / recovery model を、現在の flow 実装に合わせて整理する。特に、review verdict FAIL、subprocess failure、provider failure、input size failure、maxAttempts 到達を混同せず、停止理由と復旧手順を一貫して扱えるようにする。

## 現状

以下は既に実装済み、またはかなり整理済み。

- review verdict FAIL と subprocess failure は分離されつつある
- `reviewRetry` は review verdict に基づいて記録される
- `REVIEW_MAX_ATTEMPTS_EXCEEDED` は CLI 側で返す
- `flow set retry reset <gate|review> <phase> --yes` がある
- plan review の maxAttempts は `definition.js` に集約されている
- `review-draft-questions` / `review-draft-coverage` / `review-spec` は auto/manual とも maxAttempts 1
- `review-test` は maxAttempts 3
- `TEST_REVIEW_PROMPT_TOO_LARGE` は subprocess retry しない

## 残る問題

- rate limit / provider quota / API error / input length error の recovery hint が体系化されていない
- subprocess failure と verdict FAIL の表示・復旧手順がまだ統一されていない
- next-action が停止理由、resolved maxAttempts、復旧コマンド、retry 消費有無を十分に返す契約が弱い
- task-scope review は prompt 上の soft limit に寄っており、flow-scope review と同じ CLI enforcement になっていない
- 機械的 retry すべき失敗と、即停止すべき失敗の分類がコード上で散らばりやすい
- provider failure が reviewRetry を消費するかどうかの扱いを明文化した artifact / issue-log が弱い

## 扱う内容

- review verdict FAIL、subprocess failure、provider failure、input size failure、maxAttempts 到達の分類を定義する
- 各分類について、retry budget を消費するか、step status を進めるか、issue-log に何を残すかを決める
- `run-review` の subprocess retry 対象 / 非対象を明示的な分類にする
- rate limit / input length / provider error に対して、CLI が復旧ヒントを返す
- next-action / status が、停止理由と復旧コマンドを表示できるようにする
- task-scope review の retry enforcement を flow-scope と揃えるか、明確に soft limit として残すかを決める

## 扱わない内容

- review の blocking / non-blocking 分離そのもの
- `review-test` の入力削減
- project-level tests の破壊検知
- gate-impl の no-progress guard

これらは別ボードで扱う。

## 完了条件

- review failure taxonomy がコードまたは docs に定義されている
- subprocess retry する失敗 / しない失敗が明示的に分類されている
- provider quota / input size failure は reviewRetry を消費せず、復旧ヒントを返す
- maxAttempts 到達時の envelope に phase / attempts / max / recovery command が含まれる
- next-action または status で、review が止まっている理由と次の復旧操作が分かる
- task-scope review の retry policy が明文化されている

## 関連

- cdb2: draft 以外のレビュー収束性改善の親論点
- aba9: `review-test` の入力と書き込みを spec-local tests に限定する
- b4a6: project-level tests の破壊検知を `test-execute` / `gate-impl` 側で保証する

</details>