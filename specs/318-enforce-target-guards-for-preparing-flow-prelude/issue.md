## Summary

Allow the standard `--expect-run-id` / `--expect-issue` / `--expect-spec` guards to be applied consistently to prelude commands executed against a preparing run. Guard mismatches should be rejected as `ACTIVE_FLOW_MISMATCH` before any mutation, agent execution, or worktree creation.

## Problem

When a preparing run exists, `flow run auto-check` and `flow prepare` depend on the target run, but they do not accept the standard `--expect-*` guards.

Also, `flow set request`, `flow set note`, and `flow set auto` parse the guards, but preparing-mode command routing exposes `flowState: null` as the selection result, so validation is effectively a no-op.

In this state, even if the caller specifies expected values for the run / Issue / spec, the target identity of prelude operations cannot be guaranteed. In addition, an explicit nonexistent `--run-id` must not fall through to another active flow.

The preparing run `ffd8b360-9295-4598-8af8-861ccb16d2fa` for Issue #415 is safely stopped before prepare. This issue should not change or recover that run itself; it only fixes the guard foundation as a prerequisite separate from #415 and #410-#430.

## Scope

- `src/flow/registry.js`
- `src/flow/lib/flow-context.js`
- `src/flow/lib/base-command.js`
- `src/lib/dispatcher.js`
- Focused unit/e2e tests that verify the behavior above

## Requirements

- Keep `flowState: null` as-is in order to preserve preparing-mode command routing.
- Expose the selected preparing run state separately as `preparingFlowState`.
- Run guard validation against `preparingFlowState ?? flowState`.
- An explicit `--run-id` must preserve isolation, including when the run does not exist, and must not fall through to an unrelated active flow.
- Add the standard guard argument definitions to `flow run auto-check` and `flow prepare`, keeping help / registry consistent.
- Provide the same guard semantics for the following commands:
  - `flow set request`
  - `flow set note`
  - `flow set auto`
  - `flow run auto-check`
  - `flow prepare`
- Exclude `flow set init` because it creates a new run.
- Exclude `flow status` because it already performs guard validation.
- Preserve ownership of FlowStore and public commands, and do not add manual state recovery or external dependencies.

## Acceptance Criteria

- [ ] A target command with matching run and Issue guards succeeds against a preparing run before prepare.
- [ ] While the preparing state's spec is `null`, a non-null `--expect-spec` returns `ACTIVE_FLOW_MISMATCH`.
- [ ] Each run / Issue / spec guard mismatch returns `ACTIVE_FLOW_MISMATCH` before mutation, agent execution, or worktree creation.
- [ ] An explicit nonexistent `--run-id` does not fall through to another active / preparing flow.
- [ ] `flow prepare` succeeds with matching guards and returns the spec.
- [ ] After prepare, all three guards, run / Issue / spec, work.
- [ ] Existing documented behavior without guards is unchanged.
- [ ] The help and registry entries for `flow set request`, `flow set note`, `flow set auto`, `flow run auto-check`, and `flow prepare` match the standard guard definitions.
- [ ] Focused unit/e2e tests are added and the target tests pass.

## Verification

- Confirm with a unit test that preparing selection returns both `flowState: null` and `preparingFlowState`.
- Confirm matching / mismatching guards, guard-free invocation, and unknown explicit run IDs for the five commands above with focused tests.
- Confirm that agent / worktree creation is not started in the `flow prepare` mismatch case.
- Confirm that run / Issue / spec guards are all active after a successful `flow prepare`, and confirm help / registry parity.

## Out of Scope

- Preparing, state mutation, or manual recovery of the Issue #415 run
- Integration with the feature implementation for #415 or #410-#430
- Behavior changes for `flow set init` or `flow status`
- Adding new dependencies

<details>
<summary>ja</summary>

preparing-flow prelude command の target guard を強制する

## Summary

preparing run を対象に実行される prelude command でも、標準の `--expect-run-id` / `--expect-issue` / `--expect-spec` guard を一貫して適用できるようにする。guard の不一致は、mutation・agent 実行・worktree 作成より前に `ACTIVE_FLOW_MISMATCH` として拒否する。

## Problem

preparing run が存在する場合、`flow run auto-check` と `flow prepare` は対象 run に依存する一方で、標準の `--expect-*` guard を受け付けない。

また、`flow set request`、`flow set note`、`flow set auto` は guard を parse しているが、preparing-mode の command routing が選択結果として `flowState: null` を公開しているため、validation が実質 no-op になっている。

この状態では、呼び出し側が run / Issue / spec の期待値を指定しても、prelude 操作の対象同一性を保証できない。加えて、存在しない明示的な `--run-id` が別の active flow に fall through してはならない。

Issue #415 の preparing run `ffd8b360-9295-4598-8af8-861ccb16d2fa` は prepare 前で安全に停止している。本件ではその run 自体の変更や復旧は行わず、#415 および #410-#430 とは分離した prerequisite として guard 基盤のみを修正する。

## Scope

- `src/flow/registry.js`
- `src/flow/lib/flow-context.js`
- `src/flow/lib/base-command.js`
- `src/lib/dispatcher.js`
- 上記挙動を検証する focused unit/e2e tests

## Requirements

- preparing-mode の command routing を維持するため、`flowState: null` はそのまま保持する。
- 選択された preparing run の state を `preparingFlowState` として別途公開する。
- guard validation は `preparingFlowState ?? flowState` を対象に行う。
- 明示的な `--run-id` は、該当 run が存在しない場合も含めて isolation を維持し、無関係な active flow へ fall through させない。
- `flow run auto-check` と `flow prepare` に標準 guard の引数定義を追加し、help / registry と一致させる。
- 以下の command で同一の guard semantics を提供する。
  - `flow set request`
  - `flow set note`
  - `flow set auto`
  - `flow run auto-check`
  - `flow prepare`
- `flow set init` は run を新規作成する command のため対象外とする。
- `flow status` は既に guard validation を行うため対象外とする。
- FlowStore と public command の ownership は維持し、手動 state recovery や外部依存は追加しない。

## Acceptance Criteria

- [ ] prepare 前の preparing run に対して、matching な run guard と Issue guard を指定した対象 command が成功する。
- [ ] preparing state の spec が `null` の間、non-null の `--expect-spec` は `ACTIVE_FLOW_MISMATCH` を返す。
- [ ] run / Issue / spec の各 guard mismatch は、それぞれ mutation・agent 実行・worktree 作成より前に `ACTIVE_FLOW_MISMATCH` を返す。
- [ ] 存在しない明示的な `--run-id` は、別の active / preparing flow に fall through しない。
- [ ] matching guards を指定した `flow prepare` が成功し、spec を返す。
- [ ] prepare 後は run / Issue / spec の 3 guard がすべて機能する。
- [ ] guard を指定しない既存の documented behavior は変わらない。
- [ ] `flow set request`、`flow set note`、`flow set auto`、`flow run auto-check`、`flow prepare` の help と registry が標準 guard 定義で一致する。
- [ ] focused unit/e2e tests が追加され、対象テストが pass する。

## Verification

- preparing selection が `flowState: null` と `preparingFlowState` を同時に返すことを unit test で確認する。
- 上記 5 command について、matching / mismatching guards、guard-free invocation、unknown explicit run id を focused test で確認する。
- `flow prepare` の mismatch case で agent / worktree creation が開始されないことを確認する。
- `flow prepare` 成功後に run / Issue / spec guards がすべて有効であること、および help / registry parity を確認する。

## Out of Scope

- Issue #415 の run の prepare、state mutation、手動 recovery
- #415 または #410-#430 の機能実装との統合
- `flow set init`、`flow status` の挙動変更
- 新規依存の追加

</details>