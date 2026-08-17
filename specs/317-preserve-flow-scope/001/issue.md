## Background

After approval sync sets `currentTaskId`, some flow-level mutations do not pass an explicit parent scope. Because `FlowStore` infers the active task when no parent scope is specified, `flow set step test done`, which should update the top-level step, searches for `test` inside T-1 and fails with `unknown step: test`.

The same missing scope also exists in runtime log persistence and in `scenario-validity` / `test-review` lifecycle completion through the registry. As a result, mutations target the active task instead of the top-level step, making a fresh Senti flow impossible to progress using only normal CLI operations. This also blocks starting work on Issue #429.

## Goal

At flow-level mutation boundaries, always pass the existing explicit parent selector `taskId: null`, ensuring top-level steps are updated even when `currentTaskId` is non-null.

Preserve explicit task-level mutations, existing `// spec:` header validation, and target guard behavior.

## Implementation Scope

- `src/flow/lib/set-step.js`: Explicitly pass `taskId: null` for top-level `flow set step` mutations.
- `src/lib/dispatcher.js`: Pin runtime log persistence to the top-level active step instead of the active task.
- `src/flow/registry.js`: Pin `scenario-validity` and `test-review` lifecycle completion to top-level steps.
- Add focused unit / integration regression tests to the related existing suites that reproduce a state where `currentTaskId` is already set.

## Acceptance Criteria

- Completion of the top-level `test` step succeeds when `currentTaskId` is non-null.
- `// spec:` header validation still runs through the paths above, and invalid or missing headers are rejected as before.
- Runtime logs are persisted to the top-level active step instead of the active task.
- `scenario-validity` and `test-review` lifecycle completion completes the corresponding top-level step instead of the active task.
- Task-level `task-impl` / `review` / `gate` routing continues to target the explicitly specified task scope as before.
- The lifecycle mutation target guard continues to be enforced, and unauthorized targets are rejected.
- Existing related unit / integration tests and the added regression tests pass.

## Out of Scope

- Do not change `FlowStore` inference logic.
- Do not add a new scope flag or CLI option.
- Do not add a recovery mechanism that manually rewrites flow state.
- Do not add external dependencies.
- Do not include work for #414. This issue should be fixed independently as a bootstrap prerequisite for #429.

## Verification Points

- With a fixture that has an active task, verify success and failure cases for top-level `test` completion and spec header validation.
- Verify that runtime logs, `scenario-validity`, and `test-review` choose the top-level scope.
- Verify there are no regressions in task-level routing for `task-impl` / `review` / `gate` or in the target guard.

<details>
<summary>ja</summary>

ライフサイクルのステップ更新でフロースコープを保持する

## 背景

承認同期によって `currentTaskId` が設定された後、フローレベルの mutation が明示的な親スコープを渡していない箇所がある。`FlowStore` は親スコープ未指定時に active task を推論するため、本来トップレベル step を更新する `flow set step test done` が T-1 内で `test` を検索し、`unknown step: test` で失敗する。

同じスコープ欠落は runtime log の永続化、および registry 経由の `scenario-validity` / `test-review` lifecycle completion にも存在する。その結果、トップレベル step ではなく active task 側が mutation 対象になり、fresh Senti flow が正規の CLI 操作だけでは進行不能になる。これは Issue #429 の作業開始もブロックしている。

## 目的

フローレベルの mutation 境界では既存の明示的 parent selector `taskId: null` を常に渡し、`currentTaskId` が非 null でもトップレベル step を確実に更新する。

明示的な task-level mutation、既存の `// spec:` header validation、target guard の挙動は維持する。

## 実装スコープ

- `src/flow/lib/set-step.js`: トップレベル `flow set step` の mutation に `taskId: null` を明示する。
- `src/lib/dispatcher.js`: runtime log の永続化先を active task ではなくトップレベル active step に固定する。
- `src/flow/registry.js`: `scenario-validity` と `test-review` の lifecycle completion をトップレベル step に固定する。
- 関連する既存 suite に、`currentTaskId` 設定済み状態を再現する focused unit / integration regression tests を追加する。

## 受け入れ条件

- `currentTaskId` が非 null の状態で、トップレベル `test` step の completion が成功する。
- 上記経路でも `// spec:` header validation は従来どおり実行され、不正または不足した header は拒否される。
- runtime log は active task ではなくトップレベル active step に永続化される。
- `scenario-validity` と `test-review` の lifecycle completion は、active task ではなく対応するトップレベル step を完了する。
- task-level の `task-impl` / `review` / `gate` routing は既存どおり明示された task scope を対象にする。
- lifecycle mutation の target guard は引き続き強制され、許可されていない target は拒否される。
- 既存の関連 unit / integration tests と追加した regression tests が通る。

## 非スコープ

- `FlowStore` の推論ロジックは変更しない。
- 新しい scope flag や CLI option は追加しない。
- flow state を手動で書き換える回復手段は追加しない。
- 外部依存は追加しない。
- #414 の対応は含めない。本件は #429 の bootstrap prerequisite として独立して修正する。

## 検証観点

- active task を持つ fixture で、トップレベル `test` completion と spec header validation の成功・失敗ケースを確認する。
- runtime log、`scenario-validity`、`test-review` がトップレベル scope を選ぶことを確認する。
- `task-impl` / `review` / `gate` の task-level routing と target guard に回帰がないことを確認する。

</details>