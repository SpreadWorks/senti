## Source

Flow-level `impl-review` in Issue #445 / spec `324-standalone-plugin-attribution`.

## Symptoms and Impact

When flow-level `impl-review` is active but `currentTaskId` remains set, the review command incorrectly treats it as task-scoped. PASS / zero-finding artifacts get a `taskId`, so the definition lifecycle cannot recognize them as flow-level PASS results, does not automatically complete empty `impl-triage` / `impl-repair`, and the flow stalls.

In Issue #445, `impl-review.json` was PASS with zero findings but had `taskId: T-1`, and guarded `next-action` returned `impl-triage`, requiring a triage artifact that did not exist. There is no normal path to completion without manually editing flow state or artifacts.

## Code Evidence

- `src/flow/lib/run-review.js` passes a task spec based only on the presence of `currentTaskId`, not the active step.
- `src/flow/lib/task-scope.js` selects task scope when `currentTaskId != null`.
- When a task spec is passed, loop review is disabled and task identity is attached to the artifact.
- `src/flow/definition.js` does not treat artifacts with `taskId` as flow-scoped PASS results, and does not automatically complete flow-level triage/repair.

## Invariants to Preserve

- The authority for mutation/review scope is determined uniquely from the resolved active leaf and target identity.
- Task-level `task-review` preserves the correct taskId and only changes the task lifecycle.
- Flow-level PASS with zero findings completes triage/repair as empty through the normal path.
- If scope is ambiguous or inconsistent with state, stop with a typed failure before mutating artifacts/state.
- Do not weaken #325 task cursor enforcement or the explicit broad mode contract.

## Scope

- `src/flow/lib/run-review.js`
- `src/flow/lib/task-scope.js`
- `src/flow/definition.js` (minimum necessary area for zero-finding lifecycle judgment)
- Focused tests for flow/task review scope and PASS/FAIL lifecycle

## Out of Scope

- `FindingDispositionPolicy`
- Trusted loop proposal serializer/disposition inconsistency (Ideas BUG `f4ec` / Issue #446)
- Review finding content, gate policy, retry budget, manual repair of flow state or artifacts
- Product diff from Issue #445

## Acceptance Criteria

- When flow-level `impl-review` is active, the artifact `taskId` is null even if `currentTaskId` is non-null.
- For PASS or ADVISORY with zero findings, `impl-review`, `impl-triage`, and `impl-repair` complete through the normal path.
- When task-level `task-review` is active, taskId is preserved as before and flow-level leaves are not changed.
- Flow-level FAIL starts triage and is not confused with the PASS path.
- If the active review scope is ambiguous or inconsistent, a typed failure occurs before artifact/state mutation and durable state does not change.
- No regressions in #325 task cursor enforcement, explicit broad mode, or target guard.

## Verification Method

- Run PASS with zero findings using a fixture that keeps `currentTaskId: T-1` and only sets flow-level `impl-review` to `in_progress`.
- Confirm artifact `taskId: null` and normal completion of triage/repair.
- Confirm task-level review, flow-level FAIL, scope mismatch, broad mode, and #325 regression with focused tests.
- Run related flow unit/e2e tests and `npm test` on the fixed commit.

<details>
<summary>ja</summary>

flow-level impl-reviewを残留task cursorから分離する

## 発見元

Issue #445 / spec `324-standalone-plugin-attribution` の flow-level `impl-review`。

## 現象と影響

flow-level `impl-review` が active でも `currentTaskId` が残っていると、review command が task-scoped と誤認する。PASS・0 findings の artifact に `taskId` が付き、definition lifecycle が flow-level PASS と認識できないため、空の `impl-triage` / `impl-repair` を自動完了せず flow が停止する。

Issue #445 では `impl-review.json` が PASS・0 findings である一方 `taskId: T-1` を持ち、guarded `next-action` が存在しない triage artifact を要求する `impl-triage` を返した。flow stateやartifactを手修正せずに完了できる正規経路がない。

## コード上の根拠

- `src/flow/lib/run-review.js` は active step ではなく `currentTaskId` の存在だけを基に task spec を渡す。
- `src/flow/lib/task-scope.js` は `currentTaskId != null` の場合に task scope を選ぶ。
- task spec が渡ると loop review は無効になり、artifactへtask identityが付く。
- `src/flow/definition.js` は `taskId` 付きartifactをflow-scoped PASSとして扱わず、flow-level triage/repairを自動完了しない。

## 維持する不変条件

- mutation/review scopeのauthorityは、解決済みactive leafとtarget identityから一意に決まる。
- task-level `task-review` は正しいtaskIdを保持し、task lifecycleだけを変更する。
- flow-level PASS・0 findingsは通常経路でtriage/repairを空完了する。
- scopeが曖昧またはstateと矛盾する場合、artifact/state mutation前にtyped failureで停止する。
- #325のtask cursor enforcementと明示的broad mode契約を弱めない。

## 対象範囲

- `src/flow/lib/run-review.js`
- `src/flow/lib/task-scope.js`
- `src/flow/definition.js`（zero-finding lifecycle判定に必要な最小範囲）
- flow/task review scopeとPASS/FAIL lifecycleのfocused tests

## 対象外

- `FindingDispositionPolicy`
- trusted loop proposalのserializer/disposition不整合（Ideas BUG `f4ec` / Issue #446）
- review finding内容、gate policy、retry budget、flow stateやartifactの手動修復
- Issue #445 の製品差分

## Acceptance Criteria

- flow-level `impl-review` active時は、`currentTaskId`がnon-nullでもartifactの`taskId`はnullになる。
- PASSまたはADVISORY・0 findingsでは、`impl-review`、`impl-triage`、`impl-repair`が通常経路で完了する。
- task-level `task-review` active時は従来どおりtaskIdを保持し、flow-level leavesを変更しない。
- flow-level FAILではtriageを開始し、PASS経路と混同しない。
- active review scopeが曖昧・不整合なら、artifact/state mutation前にtyped failureとなり durable stateが変わらない。
- #325のtask cursor enforcement、明示的broad mode、target guardに回帰がない。

## 検証方法

- `currentTaskId: T-1`を保持し、flow-level `impl-review`だけを`in_progress`にしたfixtureでPASS・0 findingsを実行する。
- artifactの`taskId: null`とtriage/repairの通常完了を確認する。
- task-level review、flow-level FAIL、scope mismatch、broad mode、#325 regressionをfocused testsで確認する。
- fixed commitで関連flow unit/e2e testsと`npm test`を実行する。

</details>