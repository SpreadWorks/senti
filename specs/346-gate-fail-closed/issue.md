## Summary

Unify flow gate prerequisite validation and required evaluations as fail-closed, eliminating paths where execution can proceed to `PASS` / `done` when semantic evaluation cannot run. Also stop treating nonexistent presets as ambiguous warnings inside the gate; instead, handle them once before gate execution as typed prerequisite failures.

## Background

This resolves the following two issues together:

- `8c00`: `null` is normalized to `PASS` even when AI / guardrail evaluation cannot run
- `1278`: missing presets are not finalized as actionable during preflight and are handled as duplicate warnings inside the gate

Currently, even when required context, agents, guardrails, or presets are missing, some conditions allow semantic evaluation to be skipped while still reaching `PASS` / `done`. This behavior is dangerous for a production gate, so failures need to be unified as identifiable blocking outcomes and made fail-closed.

## Expected Contract

- Preset chains are validated deterministically before semantic context resolution
- A missing preset is not a warning; it becomes a typed prerequisite failure that can guide the user to fix configuration or install a plugin
- If any required agent evaluation, guardrail evaluation, or schema validation is not run, cannot run, or fails, fallback to `PASS` is prohibited
- `prerequisite failure`, `agent failure`, `guardrail failure`, `schema failure`, and semantic `finding` are preserved as separate outcomes
- Production guardrails / evaluations cannot be bypassed from the public CLI
- If test fixtures are needed, they are confined to a test harness unreachable from the production route
- Existing contracts for normal agent `PASS` / `FAIL` and foreign / optional policies are preserved

## Scope

- `src/flow/lib/run-gate.js`
- Call boundaries for gate prerequisite / preset resolution
- Related unit / CLI tests

## Acceptance Criteria

1. A missing preset is reported once before gate evaluation as a typed failure and does not consume the semantic retry budget.
2. For unset agents, spawn failures, guardrail failures, invalid output, or schema failures, the gate does not become `done` / `PASS` and does not proceed to the next approval.
3. Existing `PASS` / `FAIL` contracts are preserved for valid configuration and evaluation results.
4. Failure types can be mechanically distinguished from output and artifacts.
5. Missing preset warnings are not emitted repeatedly during the same invocation.

## Evidence

- There is a reproduction with an isolated fixture for an unset agent where the result is `exit 0`, `spec-gate=done`, Decision `PASS`, and execution proceeds to approval.
- There is a reproduction where an unresolved preset with `type: "node-cli"` is warned multiple times during an integration gate and semantic evaluation continues anyway.

## Non-goals

- Changing the normal-path semantic decision logic itself
- Expanding the existing semantics of foreign / optional policies

<details>
<summary>ja</summary>

gateの前提検証と必須評価をfail-closedにする

## 概要

flow gate の前提条件検証と必須評価を fail-closed に統一し、semantic evaluation を実行できない状態で `PASS` / `done` に進む経路をなくす。あわせて、存在しない preset を gate 内の曖昧な warning として扱うのをやめ、gate 実行前に一度だけ診断される typed prerequisite failure として扱う。

## 背景

以下 2 件の問題を統合して解消する。

- `8c00`: AI / guardrail evaluation が実行不能でも `null` が `PASS` に正規化される
- `1278`: missing preset が preflight で actionable に確定されず、gate 内で重複 warning として扱われる

現在は、必要な context・agent・guardrail・preset が欠けていても、条件によっては semantic evaluation をスキップしたまま `PASS` / `done` に到達できる。この挙動は production gate として危険なので、原因を識別可能な blocking outcome に統一し、fail-closed にする必要がある。

## 期待する契約

- preset chain は semantic context 解決より前に deterministic に検証される
- missing preset は warning ではなく、設定修正または plugin 導入を案内できる typed prerequisite failure になる
- 必須の agent evaluation、guardrail evaluation、schema validation のいずれかが未実行・実行不能・失敗の場合、`PASS` への fallback を禁止する
- `prerequisite failure`、`agent failure`、`guardrail failure`、`schema failure`、semantic `finding` を別々の outcome として保持する
- public CLI から production 用 guardrail / evaluation を迂回できない
- test fixture が必要な場合は、production route から到達不能な test harness に閉じ込める
- 正常な agent `PASS` / `FAIL` と、foreign / optional policy の既存契約は維持する

## 対象範囲

- `src/flow/lib/run-gate.js`
- gate prerequisite / preset resolution の呼び出し境界
- 関連する unit / CLI tests

## Acceptance Criteria

1. missing preset は gate evaluation 前に一度だけ typed failure として報告され、semantic retry budget を消費しない。
2. agent 未設定、spawn failure、guardrail failure、invalid output、schema failure のいずれでも gate は `done` / `PASS` にならず、次の approval に進まない。
3. 正常な設定と評価結果では既存の `PASS` / `FAIL` 契約を維持する。
4. 出力と artifact から failure 種別を機械的に区別できる。
5. 同一 invocation 中に missing preset warning が重複出力されない。

## Evidence

- agent 未設定の隔離 fixture で `exit 0`、`spec-gate=done`、Decision `PASS` となり approval へ進む再現がある。
- `type: "node-cli"` の未解決 preset が integration gate 中に複数回 warning され、そのまま semantic evaluation を継続する再現がある。

## 非目標

- 正常系の semantic 判定ロジック自体を変更すること
- foreign / optional policy の既存意味論を広げること

</details>