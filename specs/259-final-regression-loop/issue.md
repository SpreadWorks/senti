## Implementation Status (as of 2026-05-18)

**Important:** The "Already implemented" items below are already present as uncommitted changes in the current working tree. Do not re-implement these in the next session — start from the existing diff and only finish what is missing.

### Already Implemented

- Added `final-regression` step to the flow definition. Positioned after `retro` and before `finalize`.
- Added `sdd-forge flow run final-regression` to the registry. The post hook validates the artifact and marks `final-regression` as done only on pass.
- Added `src/flow/lib/run-final-regression.js`. Resolves the project regression command, runs a full regression, and writes `final-regression-result.json` and `tests/.raw/final-regression.log`.
- The final-regression artifact stores `failureKind`, `command`, `rawOutputPath`, `retryable`, `nextAction`, `changedFiles`, and `previousFailureKind`.
- final-regression failures are recorded in `issue-log.json`. Repairable failures are retryable on the first occurrence only; the second failure becomes a stop.
- Removed full project regression from the normal `test-execute`. The default is the targeted policy; full regression is deferred to final-regression as `full-regression-deferred`.
- Added `test.testExecuteRegression`: `targeted` / `full` / `skip` to the `.sdd-forge/config.json` schema.
- Targeted project test paths run in the normal repair loop; full regression runs inside `test-execute` only when `full` is explicitly configured.
- Added `full-regression-deferred` / `project-regression-skipped` categories to the `test-execute-result.json` schema and validator.
- Updated report / retro / finalize-commit prompt / flow-tracking template / installed skills / guardrail / locale strings to reflect the final-regression model.
- Added unit tests `tests/unit/flow/final-regression.test.js` and `tests/unit/flow/test-regression-policy.test.js`. Both pass when run individually.

### Remaining Work

- 30a7 has not been filed as an issue yet; no formal SDD spec or finalize has been done.
- Changes are uncommitted. Do not re-implement the existing diff — use the current uncommitted changes as the starting point.
- `get-next-action` related tests are failing. Need to inspect the `final-regression` next-action wiring, schema, instructions, and `requires_approval` handling and fix them.
- `run-test-result-review.js` passes `rawText` to `validateTestExecuteResultEvidence`, but the validator expects `rawOutputText`. This breaks artifact validation for targeted / explicit full regression and needs to be fixed.
- Some files such as `src/flow/prompts/plan/scenario-validity.md` still contain old descriptions stating that `impl/test-execute` is responsible for project verification. All full regression responsibility must be unified under final-regression.
- The `pre_existing` / `caused_by_current_change` classification in final-regression is still coarse. There is a risk of misclassifying unrelated failures as current-change merely because changed files exist; improve classification accuracy as needed.
- It has not yet been measured in an actual SDD flow that full `npm test --` is gone from the normal repair loop. Verify via artifact and issue-log when finishing.

## Background

In the three most recent specs, the normal test-execute ran the full project regression, causing `npm test --` to run on nearly every iteration.

- 258-review-retry-recovery: full npm test
- 258-gate-artifact-validation: full npm test
- 258-flow-runtime-log-options: full npm test

When code is later fixed in response to review or gate-impl feedback, the test artifact becomes stale and full regression runs again from test-execute. This creates a heavy repair loop of test → review → fix → re-test.

## Approach

Remove project full regression (e.g. `npm test --`) from the normal test-execute and run it only as a final-regression at the end.

The normal test-execute focuses on spec-local tests and artifact creation. Project regression is skipped by default and run only when explicitly configured or when targeted conditions apply.

## Recommended Flow

implement → code-review → repair → spec-local test-execute → test-result-review → evidence-review → gate-impl → retro → final-regression → finalize

## On final-regression Failure

Do not route final-regression failures back into the normal gate-impl loop. Choose exactly one return point based on failure kind.

- `caused_by_current_change`: regression-repair → spec-local test → final-regression
- `pre_existing`: log and prompt user, or file as a separate issue. Do not enter the implementation repair loop.
- `infra_failure`, `timeout`, `dependency_failure`: stop
- `sandbox_restriction`, `permission_error`, `child_process_eperm`: stop, or guide to run outside the sandbox. Do not enter the implementation repair loop.
- `invalid_project_test`: test-repair → final-regression

## Loop Prevention

- Automatic repair after final-regression is limited to 1 attempt.
- A second final-regression failure is a stop.
- After a final-regression repair, do not re-run the normal impl review.
- Re-run spec-local tests only if actual files were changed.
- Do not run full `npm test` anywhere other than final-regression.
- Save the failure classification in the artifact so the same failure is not re-classified as an implementation bug on the next retry.

## Additional Investigation Notes (2026-05-18)

There are cases where child node spawning inside a sandbox results in EPERM, while the same code passes with normal permissions. In final-regression, failures must not all be treated as test failures — they need to be classified into environment / sandbox / permission / timeout / dependency / current-change regression categories.

Without this classification, failures that cannot be resolved by implementation changes will enter a `repair → test → repair` loop.

## Implementation Candidates

- Add final-regression step to the flow definition, after retro and before finalize
- Add `flow run final-regression` to the registry
- Remove project full regression from run-test-execute
- Split test-regression classification into one for normal test-execute and one for final-regression
- gate-impl does not treat missing full regression as a blocker
- Save `failureKind`, `command`, raw log path, `retryable`, `nextAction` in the final-regression artifact
- Update prompts, templates, skills, and tests

## Timing

Implement after the three in-progress flow improvement items in other sessions are completed and merged. Because this touches the flow core, doing it earlier will increase conflicts and rework.

## Additional Investigation: Basis for Full Regression Decision

Investigation in another session confirmed that the main cause of long test-execute times is not AI latency but the additional full project regression (`npm test --`) that runs after spec-local tests.

Observed behavior:

- run-test-execute first runs spec-local tests: `node --test specs/<spec>/tests/*.test.js`
- It then runs a project regression based on changed-file classification
- Recent artifacts show `regression.required=true`, `mode=full`, `command=npm test --`
- Spec-local tests themselves are short — e.g. 258-flow-runtime-log-options was ~113ms, 258-gate-artifact-validation was ~854ms
- The slowdown comes from the subsequent full `npm test --` running a large number of unit/integration tests

Reasons why full is easily triggered:

- Changes under `src/` or unknown non-text file changes tilt toward full
- If `test.projectPaths` is absent in `.sdd-forge/config.json`, even test-file-only changes are unlikely to be classified as targeted

Additional factors that increase slowness:

- Agent-type tests have 2 retries, a 3000ms initial wait, and exponential backoff, so failure-case tests wait 3s + 6s
- In measured runs, failure-case tests like `throws on failing command` alone took about 9 seconds

Therefore, the implementation of 30a7 must not merely add a final-regression step — it must also ensure that the normal test-execute does not request a full `npm test --`. Improving `test.projectPaths` and targeted classification are supplementary measures; the primary fix is the design change that removes full regression from the normal repair loop.

<details>
<summary>ja</summary>

[ENHANCE] npm test full regression を final-regression に移す

## 実装状況 (2026-05-18 時点)

重要: 下記の「実装済み」項目は、現 working tree の未コミット差分として既に実装されている。次回作業では同じ機能を再実装せず、差分をレビューして不足分だけ仕上げる。

### 実装済み

- flow definition に `final-regression` step を追加済み。位置は `retro` の後、`finalize` の前。
- registry に `sdd-forge flow run final-regression` を追加済み。post hook は artifact を検証し、pass の場合だけ `final-regression` を done にする。
- `src/flow/lib/run-final-regression.js` を追加済み。project regression command を解決して full regression を実行し、`final-regression-result.json` と `tests/.raw/final-regression.log` を書く。
- final-regression artifact には `failureKind`, `command`, `rawOutputPath`, `retryable`, `nextAction`, `changedFiles`, `previousFailureKind` を保存する実装が入っている。
- final-regression failure は `issue-log.json` に記録する実装済み。修復可能な failure は初回だけ retryable、2 回目は stop になる。
- 通常の `test-execute` から full project regression を外す実装済み。default は targeted policy で、full 判定は `full-regression-deferred` として final-regression に送る。
- `.sdd-forge/config.json` schema に `test.testExecuteRegression`: `targeted` / `full` / `skip` を追加済み。
- targeted project test paths は通常の補修ループで実行し、明示 `full` 設定時だけ `test-execute` 内で full regression を実行する実装済み。
- `test-execute-result.json` schema と validator に `full-regression-deferred` / `project-regression-skipped` category を追加済み。
- report / retro / finalize-commit prompt / flow-tracking template / installed skills / guardrail / locale 文言を final-regression 前提へ更新済み。
- unit test として `tests/unit/flow/final-regression.test.js` と `tests/unit/flow/test-regression-policy.test.js` を追加済み。個別実行では pass 済み。

### 残作業

- 30a7 はまだ issue 化されておらず、正式な SDD spec / finalize は未実施。
- 変更は未コミット。実装済み差分を再実装せず、現在の未コミット差分を出発点にすること。
- `get-next-action` 関連テストが失敗中。`final-regression` の next-action wiring、schema、instructions、requires_approval 周りを確認して直す必要がある。
- `run-test-result-review.js` が `validateTestExecuteResultEvidence` に `rawText` を渡しているが、validator は `rawOutputText` を期待している。targeted / explicit full regression の artifact 検証を壊すため修正が必要。
- `src/flow/prompts/plan/scenario-validity.md` などに、まだ `impl/test-execute` が project verification を担当する旧記述が残っている。full regression は final-regression 担当で統一すること。
- final-regression の `pre_existing` / `caused_by_current_change` 分類はまだ粗い。変更ファイルがあるだけで unrelated failure を current-change と誤分類するリスクがあるため、必要に応じて分類精度を上げる。
- 実際の SDD flow で、通常補修ループから full `npm test --` が消えたことはまだ未実測。仕上げ時に artifact と issue-log で確認すること。

## 背景

直近の spec 3 件では、通常の test-execute で project regression が full 実行され、npm test -- が毎回に近い形で走っていた。

- 258-review-retry-recovery: full npm test
- 258-gate-artifact-validation: full npm test
- 258-flow-runtime-log-options: full npm test

その後 review や gate-impl の指摘でコードを直すと test artifact が stale になり、また test-execute から full regression が走る。これにより、テスト、レビュー、修正、再テストの重い補修ループが発生している。

## 方針

npm test -- のような project full regression は通常の test-execute から外し、最後の final-regression として実行する。

通常の test-execute は spec-local tests と artifact 作成に集中する。project regression は原則 skip し、明示設定や targeted 条件がある場合だけ実行する。

## 推奨フロー

implement -> code-review -> repair -> spec-local test-execute -> test-result-review -> evidence-review -> gate-impl -> retro -> final-regression -> finalize

## final-regression 失敗時

final-regression 失敗を通常の gate-impl ループに戻さない。失敗種別で戻し先を 1 つだけ選ぶ。

- caused_by_current_change: regression-repair -> spec-local test -> final-regression
- pre_existing: 記録してユーザー確認、または別 issue 化。実装修正ループには入れない
- infra_failure, timeout, dependency failure: stop
- sandbox_restriction, permission_error, child_process_eprem: stop または sandbox 外実行を案内。実装修正ループには入れない
- invalid_project_test: test-repair -> final-regression

## ループ防止

- final-regression の自動 repair は最大 1 回
- 2 回目の final-regression failure は stop
- final-regression 後の repair では通常の impl review を再実行しない
- 実ファイル変更があった場合だけ spec-local test を再実行する
- full npm test は final-regression 以外では実行しない
- final-regression の失敗分類は artifact に保存し、次回 retry 時に同じ失敗を実装バグとして再分類しない

## 追加調査メモ (2026-05-18)

sandbox 内で子 node spawn が EPERM になり、通常権限では pass したケースがある。final-regression では、失敗を test failure として一括扱いせず、environment / sandbox / permission / timeout / dependency / current-change regression を分類する必要がある。

この分類がないと、実装修正では解決しない失敗が `repair -> test -> repair` のループに入る。

## 実装候補

- flow definition に final-regression step を retro 後、finalize 前へ追加
- registry に flow run final-regression を追加
- run-test-execute から project full regression を外す
- test-regression の classification を通常 test-execute 用と final-regression 用に分ける
- gate-impl は full regression 未実行を blocker にしない
- final-regression artifact に failureKind, command, raw log path, retryable, nextAction を保存する
- prompts, templates, skills, tests を更新する

## 実施タイミング

別セッションで進行中の flow 改善 3 件が完了、マージされた後に実装する。flow 中核に触るため、先にやるとコンフリクトと再設計が増える。

## 追加調査メモ: full regression 判定の根拠

他セッションの調査では、test-execute が長い主因は AI 待ちではなく、spec-local test の後に project full regression として npm test -- が追加実行されることだった。

確認された挙動:

- run-test-execute は先に spec-local の node --test specs/<spec>/tests/*.test.js を実行する
- その後、変更ファイル分類により project regression を追加実行する
- recent artifact では regression.required=true, mode=full, command=npm test -- になっていた
- spec-local 自体は短く、例として 258-flow-runtime-log-options は約 113ms、258-gate-artifact-validation は約 854ms 程度だった
- 長くなっているのは、その後の full npm test -- が unit / integration を大量に実行しているため

full 判定になりやすい理由:

- src/ 配下の変更や未知の非テキストファイル変更があると full に倒れる
- .sdd-forge/config.json に test.projectPaths が無い場合、test file だけの変更でも targeted 判定へ寄りにくい

追加で遅さを増やす要因:

- Agent 系テストは retry 2 回、初期待機 3000ms、指数バックオフのため、失敗系テストが 3s + 6s を待つ
- 実測で throws on failing command のような失敗系テストだけで約 9 秒かかった

このため、30a7 の実装では単に final-regression step を追加するだけでなく、通常の test-execute が full npm test -- を要求しないようにすることが重要。test.projectPaths や targeted 判定改善は補助策だが、通常補修ループから full regression を外す設計が主対策になる。

</details>