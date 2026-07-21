## Summary
The `default test runner` collapses child process execution failures into the same shape as test assertion failures, making it look like a `0 PASS`-equivalent summary even when a suite was not run due to `ENOENT`, signal termination, `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`, and similar errors. Preserve and report child-process failures as typed results in both the runner and final-regression so the primary cause can be identified from a single execution log.

## Problem
- `tests/run.js` does not reflect `spawnSync()` `error` / `signal` values in pass aggregation or failure display, so suites that did not run can appear as normal test failures or empty summaries when stdout/stderr is sparse.
- `runProcessDetailed()` in `src/flow/lib/test-regression.js` does not preserve `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`, spawn failures, signal termination, and timeouts in a form that downstream code can distinguish sufficiently.
- As a result, abnormal runner termination and assertion failures end up on the same failure surface, making the cause unreadable without rerunning.

## Scope
- `tests/run.js`
- `src/flow/lib/test-regression.js`
- test runner / final-regression contract tests

## Required Changes
- Distinguish at least the following in the execution result contract for `tests/run.js`:
  - assertion failure
  - spawn failure, such as `ENOENT`
  - signal termination, such as `SIGKILL`
  - timeout
  - buffer overflow, `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`
- Preserve the command, exit code, signal, stderr, stdout summary, and the fact that the suite was not executed for each suite, and do not include suites that did not run in pass aggregation.
- In `src/flow/lib/test-regression.js`, pass the primary cause through to final-regression failure classification without losing it, so buffer overflow and signal termination do not look like ordinary assertion failures.
- Add regression fixtures and contract tests reproducible in a single run, and lock down the presentation of child-process failures versus real assertion failures.

## Acceptance Criteria
- `ENOENT`, `SIGKILL`, `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`, and timeout are each reported as non-PASS typed results.
- Each failure result includes the command / exit code / signal / stderr / stdout summary needed for diagnosis.
- Suites that did not run are not included in success counts, `0 PASS`, or the same aggregation as normally completed suites.
- Real test assertion failures preserve the existing meaning of exit code and summary.
- Even with a high-output fixture, primary causes such as buffer overflow and signal termination are not hidden.
- The failure cause can be identified from a single execution log without rerunning the same command.

## Verification
- Add automated tests or fixtures that reproduce `ENOENT`, `SIGKILL`, `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`, and assertion failure.
- Confirm that the tests fail before the fix and preserve the expected typed result and diagnostic information after the fix.
- Confirm there are no regressions in the existing happy-path runner summary or final-regression failure classification.

## Evidence
- `tests/run.js:55-66` primarily uses stdout/stderr and `status` from the `spawnSync()` return value, and does not treat `error` / `signal` as failure types.
- `src/flow/lib/test-regression.js:482-490` expands child-process failures into `spawnError` / `signal` / `timedOut`, but lacks a contract that clearly preserves the primary cause downstream.
- `tests/unit/flow/final-regression.test.js:197-223` has tests that fail closed by treating silent non-zero / zero-detail failures as infra failures, already compensating for missing information in the runner contract.
- In observed behavior, `npm test` selected 294 files and then exited with exit code `1`, while per-suite output showed only `0` items, so the primary cause could not be read in place.

## Out of Scope
- General specification changes to test selection, preset resolution, or label summaries
- Rewriting assertion fixtures that are not directly related to improving child-process failure reporting

<details>
<summary>ja</summary>

default test runnerでchild process失敗を完全に報告する

## Summary
`default test runner` が child process の実行失敗を test assertion failure と同じ形に潰しており、`ENOENT`、signal termination、`ERR_CHILD_PROCESS_STDIO_MAXBUFFER` などで suite が実行されていない場合でも `0 PASS` 相当の集計に見える。1 回の実行ログだけで一次原因を特定できるよう、runner と final-regression の両方で child-process failure を typed result として保持・報告する。

## Problem
- `tests/run.js` は `spawnSync()` の `error` / `signal` を pass 集計と失敗表示に反映しておらず、stdout/stderr が乏しいケースでは未実行 suite が通常の test failure や空の summary に見える。
- `src/flow/lib/test-regression.js` の `runProcessDetailed()` は `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`、spawn failure、signal termination、timeout を downstream が十分に区別できる形で保持していない。
- その結果、runner 自体の異常終了と assertion failure が同じ失敗面に寄り、再実行なしでは原因が読めない。

## Scope
- `tests/run.js`
- `src/flow/lib/test-regression.js`
- test runner / final-regression contract tests

## Required Changes
- `tests/run.js` の実行結果契約で、少なくとも以下を区別する。
  - assertion failure
  - spawn failure（`ENOENT` など）
  - signal termination（`SIGKILL` など）
  - timeout
  - buffer overflow（`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`）
- suite ごとに command、exit code、signal、stderr、stdout 要約、未実行であることを保持し、実行されなかった suite を pass 集計に含めない。
- `src/flow/lib/test-regression.js` 側では一次原因を保持したまま final-regression の failure classification に渡し、buffer overflow や signal termination が通常の assertion failure に見えないようにする。
- 単一実行で再現できる regression fixture と contract test を追加し、child-process failure と実 assertion failure の見え方を固定する。

## Acceptance Criteria
- `ENOENT`、`SIGKILL`、`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`、timeout がそれぞれ non-PASS の typed result として報告される。
- 各失敗結果に、原因診断に必要な command / exit code / signal / stderr / stdout 要約が含まれる。
- 未実行 suite は成功件数、`0 PASS`、または通常の完走 suite と同じ集計に入らない。
- 実際の test assertion failure では、既存の exit code と summary の意味を維持する。
- 大量出力 fixture でも buffer overflow や signal termination などの一次原因が隠れない。
- 同じ command を再実行しなくても、単一の実行ログから失敗原因を特定できる。

## Verification
- `ENOENT`、`SIGKILL`、`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`、assertion failure をそれぞれ再現する automated test または fixture を追加する。
- pre-fix では失敗し、post-fix では期待どおりの typed result と診断情報が残ることを確認する。
- 既存の happy-path runner summary と final-regression failure classification に回帰がないことを確認する。

## Evidence
- `tests/run.js:55-66` は `spawnSync()` の戻り値から stdout/stderr と `status` を主に使っており、`error` / `signal` を失敗種別として扱っていない。
- `src/flow/lib/test-regression.js:482-490` は child-process failure を `spawnError` / `signal` / `timedOut` に展開しているが、downstream で一次原因を明確に残す契約が不足している。
- `tests/unit/flow/final-regression.test.js:197-223` には silent non-zero / zero-detail failure を infra failure として fail-closed するテストがあり、現状でも runner 契約の情報欠落を補正している。
- 実測では `npm test` が 294 files を選択した後に exit code `1` で終了した一方、suite ごとの表示は `0` 件のみで、一次原因をその場で読めなかった。

## Out of Scope
- test selection、preset 解決、label summary の一般的な仕様変更
- child-process failure の報告改善に直接関係しない assertion fixture の書き換え

</details>