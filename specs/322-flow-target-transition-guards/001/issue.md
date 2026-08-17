## Summary

Enforce target identity and current-step transition guards across all paths that mutate flows, and prevent durable state from being changed until definition, rule, schema, instruction, and target identity validation have completed.

## Problem

In the current implementation, invalid or ambiguous mutations can be persisted through the following paths:

- Normal target resolution in `src/lib/flow-manager.js` can implicitly select the first candidate even when multiple flows match the same Issue.
- `src/flow/lib/set-step.js` may allow updates to non-current or out-of-order steps.
- `src/flow/lib/get-next-action.js` persists step promotion before validating the rule, schema, and instruction.

As a result, mutations may remain for a different run on the same Issue, a step that is not the current step, or an unexecutable next action.

## Required Invariants

- Specified selectors such as `runId`, `spec`, and `issue` are resolved as AND conditions.
- If selector resolution returns 0 results, fail with a typed not-found error; if it returns 2 or more results, fail with a typed ambiguity error.
- If the target cannot be proven unique, do not change flow state, timestamps, artifacts, runtime logs, or retry counters.
- Normal step updates are limited to the current leaf step, and only transitions allowed by the flow definition are accepted.
- Rewind / recovery are handled only through existing explicit dedicated paths, and are not performed implicitly from normal `set step`.
- Next action promotion occurs only after definition, rule, schema, instruction, and target identity validation all succeed.
- Promotion is performed exactly once using revision-aware CAS.
- If authority or revision changed after validation, do not promote and require re-resolution.

## Scope

Primary paths:

- `src/lib/flow-manager.js`
- `src/flow/lib/set-step.js`
- `src/flow/lib/get-next-action.js`

Only if necessary, the following may also be changed to consolidate shared invariants into a single deep module:

- `base-command.js`
- `flow-context.js`
- `flow-store.js`
- focused tests

Out of scope:

- Changes to the registered step set (#442)
- Failure atomicity for gate phase inference (Ideas BUG `3c9d`)
- Atomicity of approval and spec task sync (Ideas BUG `c9de`)
- Completeness of resume candidate scan (Ideas BUG `0781`)
- Legacy format compatibility

## Acceptance Criteria

- If multiple flows match the same Issue and there is no additional guard proving uniqueness, a typed ambiguity error is returned and durable state remains byte-identical.
- When multiple selectors are provided, they select the exact target using AND conditions; on selector mismatch, no foreign candidate is selected and a typed not-found / mismatch error is returned.
- Non-current steps, already completed steps, out-of-order steps, and transitions not allowed by the definition are rejected, with no state changes or side effects.
- If a rule, schema, instruction, or step definition is missing or invalid, the next action is not promoted.
- If the revision changes between validation and CAS, the stale target is not updated.
- Existing valid transitions for an exact `runId` / `spec` succeed exactly once, and retries do not create duplicate promotions, artifacts, or logs.
- Ambiguity, not-found, out-of-order, validation failure, CAS drift, and success cases are verified through both public CLI paths and direct module tests.

## Verification

- `node --test tests/unit/flow/set-step.test.js tests/unit/flow/get-next-action.test.js`
- Focused tests for target ambiguity / selector composition / concurrent revision drift
- `npm test`

## Scheduling Notes

- No prior dependencies.
- Integrate before `3c9d`, `c9de`, and `0781`.
- Do not implement in parallel with issues that change `flow-manager.js`, `set-step.js`, or the shared authority / transition control plane.

## Evidence

- `src/lib/flow-manager.js:659-717`
- `src/flow/lib/set-step.js:258-323`
- `src/flow/lib/get-next-action.js:305-355`

<details>
<summary>ja</summary>

flow targetの一意性とcurrent-step遷移guardを強制する

## Summary

Flow を mutation する全経路で target identity と current-step transition guard を強制し、definition・rule・schema・instruction・target identity の検証が完了するまで durable state を変更しないようにする。

## Problem

現在の実装では、以下の経路で不正または曖昧な mutation が永続化されうる。

- `src/lib/flow-manager.js` の通常 target 解決は、同じ Issue に複数 flow が一致しても先頭候補を暗黙選択できる。
- `src/flow/lib/set-step.js` は non-current / out-of-order step の更新を許しうる。
- `src/flow/lib/get-next-action.js` は rule・schema・instruction の検証より前に step promotion を永続化する。

この結果、同じ Issue の別 run、現在 step ではない step、または実行不能な next action に対して mutation が残る可能性がある。

## Required Invariants

- `runId`、`spec`、`issue` など指定された selector は AND 条件で解決する。
- selector 解決結果が 0 件なら typed not-found、2 件以上なら typed ambiguity として失敗する。
- target を一意に証明できない場合、flow state、timestamp、artifact、runtime log、retry counter を変更しない。
- 通常の step 更新は current leaf step に限定し、flow definition が許可する transition のみ受け付ける。
- rewind / recovery は既存の明示的な専用経路のみで扱い、通常の `set step` から暗黙実行しない。
- next action は definition・rule・schema・instruction・target identity の検証がすべて成功した後にのみ promotion する。
- promotion は revision-aware CAS で 1 回だけ行う。
- 検証後に authority または revision が変化していた場合は promotion せず、再解決を要求する。

## Scope

Primary paths:

- `src/lib/flow-manager.js`
- `src/flow/lib/set-step.js`
- `src/flow/lib/get-next-action.js`

必要な場合に限り、共通 invariant を単一の深い module に集約するために以下も変更可とする。

- `base-command.js`
- `flow-context.js`
- `flow-store.js`
- focused tests

Out of scope:

- step 登録集合の変更（#442）
- gate phase inference の failure atomicity（Ideas BUG `3c9d`）
- approval と spec task sync の atomicity（Ideas BUG `c9de`）
- resume candidate scan の completeness（Ideas BUG `0781`）
- legacy format compatibility

## Acceptance Criteria

- 同じ Issue に複数 flow が一致し、一意な追加 guard がない場合は typed ambiguity error になり、永続 state は byte-identical に保たれる。
- 複数 selector を与えた場合は AND 条件で exact target を選び、selector mismatch 時に foreign candidate を選ばず typed not-found / mismatch になる。
- non-current step、既に完了した step、順序外 step、definition が許可しない transition を拒否し、state と副作用を変更しない。
- rule・schema・instruction・step definition の欠落または不正時、next action は promotion されない。
- validation と CAS の間に revision が変化した場合、stale target を更新しない。
- exact `runId` / `spec` に対する既存の正常 transition は 1 回だけ成功し、retry で重複 promotion・artifact・log を生成しない。
- public CLI 経路と直接 module test の両方で ambiguity、not-found、out-of-order、validation failure、CAS drift、正常系を検証する。

## Verification

- `node --test tests/unit/flow/set-step.test.js tests/unit/flow/get-next-action.test.js`
- target ambiguity / selector composition / concurrent revision drift の focused tests
- `npm test`

## Scheduling Notes

- 先行依存なし。
- `3c9d`、`c9de`、`0781` より先に統合する。
- `flow-manager.js`、`set-step.js`、共有 authority / transition control plane を変更する Issue とは並列実装しない。

## Evidence

- `src/lib/flow-manager.js:659-717`
- `src/flow/lib/set-step.js:258-323`
- `src/flow/lib/get-next-action.js:305-355`

</details>