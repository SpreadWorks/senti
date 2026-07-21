## Overview

For the additions payload of `flow run update-overview`, the CLI help, command-boundary validation, and merge / persistence each assume a different contract.

As a result, a payload accepted at the command boundary fails later during merge / persistence, and users see this as `PERSIST_FAILED` rather than a shape error. The acceptable payload shape for `update-overview` must be unified into a single contract, and any payload accepted at the entry point must be in a state that can be merged / persisted as-is.

## Current Inconsistency

- The help in `src/flow/registry.js` shows `{modules?: [{text}], data_flow?: [{text}], decisions?: [{text}]}`
- The entry validator in `src/flow/lib/run-update-overview.js` accepts arbitrary category keys and `{text: string}` entries
- `src/flow/lib/overview-merge.js` and `src/flow/schemas/next-action/update-overview.schema.json` require all 3 categories, `modules` / `data_flow` / `decisions`, and string arrays

Because of this inconsistency, the implementation differs by layer on which payloads are valid happy-path inputs and which payloads should be rejected as shape errors.

## Canonical Contract

Use `src/flow/schemas/next-action/update-overview.schema.json` as the canonical contract for the additions payload.

- All 3 categories, `modules` / `data_flow` / `decisions`, are required
- Each category is an array of strings
- Each category has a maximum of 50 entries
- Each string has a maximum length of 500 characters
- Unknown categories, missing categories, `{text}` object entries, non-arrays, and limit violations are rejected at the command boundary as `INVALID_SHAPE`
- A complete payload accepted at the entry point passes through merge / persistence without contract conversion

## Impact

- CLI help and the actual persistence contract do not match
- Payloads accepted at the entry point fail later
- Whether categories may be omitted and how entries are represented differ by layer
- Users see `PERSIST_FAILED` instead of a validation error

## Acceptance Criteria

- Help, entry validation, merge, and persistence match the canonical contract
- In a valid flow/task context, a complete payload accepted at the entry point can be persisted
- Missing categories and `{text}` object entries become `INVALID_SHAPE` at the command boundary, rather than failing later
- Unknown categories, non-arrays, the 50-entry per-category limit, and the 500-character limit are also rejected at the command boundary
- Focused tests verify the following:
  - Complete payload
  - Missing category
  - `{text}` object entry
  - Unknown category
  - Non-array
  - Entry limit exceeded
  - Character limit exceeded
- Preserve the existing deterministic merge, `added_by_task` stamp, and non-mutating input behavior

## Scope Lock

- Root cause to resolve: duplicate definition mismatch between CLI help / boundary validator and the existing schema / merge contract
- Invariants to preserve: deterministic merge, non-mutating input, normalization of the 3 categories, `added_by_task` stamp, existing size bounds
- Allowed source paths:
  - `src/flow/registry.js`
  - `src/flow/lib/run-update-overview.js`
  - `src/flow/lib/overview-merge.js`
- Allowed test paths:
  - `tests/unit/flow/run-update-overview.test.js`
  - `tests/unit/flow/overview-merge.test.js`
  - `tests/unit/flow/update-overview-schema.test.js`
- Allowed flow artifact: only `specs/<spec>/` for this issue
- Out of scope: Issue #443, flow completion recovery, task lifecycle, semantic changes to the schema, payload contracts for other commands, unrelated refactors
- Base commit: `5c8f38ad6912b1fdabc4ad47260002e35cbdafd2`
- Tests allowed to run: the focused tests above, directly affected `update-overview` related tests, and one `npm test` after the independent scope / AC audit passes for the fixed commit

## Verification

- Pre-fix reproduction: reproduce that a missing category + `{text}` entry is accepted at the entry point and rejected during merge / persistence
- Focused tests: `overview-merge`, `run-update-overview`, `update-overview-schema`
- Related tests: task integration tests that reference `update-overview`
- Independent scope / AC audit against the fixed commit
- Run full `npm test` once after the independent audit passes

<details>
<summary>ja</summary>

update-overview のコマンド契約と永続化契約が一致しない

## 概要

`flow run update-overview` の additions payload について、CLI help、コマンド境界の validation、merge / 永続化がそれぞれ別の契約を前提にしています。

その結果、コマンド境界では受理された payload が後段の merge / 永続化で失敗し、利用者には shape error ではなく `PERSIST_FAILED` として見えます。`update-overview` の受理可能な payload shape を 1 つに揃え、入口で受理した payload はそのまま merge / 永続化できる状態にする必要があります。

## 現状の不一致

- `src/flow/registry.js` の help は `{modules?: [{text}], data_flow?: [{text}], decisions?: [{text}]}` を示している
- `src/flow/lib/run-update-overview.js` の入口 validator は任意 category key と `{text: string}` entry を受理している
- `src/flow/lib/overview-merge.js` と `src/flow/schemas/next-action/update-overview.schema.json` は `modules` / `data_flow` / `decisions` の 3 category 全部と string 配列を要求している

この不一致により、どの payload が正常系で、どの payload が shape error として拒否されるべきかが実装ごとにずれています。

## Canonical contract

`src/flow/schemas/next-action/update-overview.schema.json` を additions payload の canonical contract とする。

- `modules` / `data_flow` / `decisions` の 3 category はすべて必須
- 各 category は string 配列
- 各 category は最大 50 entry
- 各 string は最大 500 文字
- unknown category、category 欠落、`{text}` object entry、非配列、上限超過はコマンド境界で `INVALID_SHAPE` として拒否する
- 入口で受理した完全 payload は、契約変換なしで merge / 永続化まで通る

## 影響

- CLI help と実際の永続化契約が一致していない
- 入口で受理した payload が後段で失敗する
- category の省略可否と entry 表現が層ごとに異なる
- 利用者には validation error ではなく `PERSIST_FAILED` として見える

## Acceptance Criteria

- help、入口 validation、merge、永続化が canonical contract に一致する
- 正常な flow/task context では、入口で受理した完全 payload を永続化できる
- category 欠落と `{text}` object entry は後段失敗ではなく、コマンド境界で `INVALID_SHAPE` になる
- unknown category、非配列、category ごとの 50 entry 上限、500 文字上限もコマンド境界で拒否される
- focused tests で以下を検証する
  - 完全 payload
  - category 欠落
  - `{text}` object entry
  - unknown category
  - 非配列
  - entry 上限超過
  - 文字数上限超過
- 既存の deterministic merge、`added_by_task` stamp、入力非破壊を維持する

## Scope Lock

- 解消対象の root cause: CLI help / boundary validator と既存 schema / merge contract の二重定義不一致
- 維持する不変条件: deterministic merge、入力非破壊、3 category の正規化、`added_by_task` stamp、既存 size bounds
- 許可する source path:
  - `src/flow/registry.js`
  - `src/flow/lib/run-update-overview.js`
  - `src/flow/lib/overview-merge.js`
- 許可する test path:
  - `tests/unit/flow/run-update-overview.test.js`
  - `tests/unit/flow/overview-merge.test.js`
  - `tests/unit/flow/update-overview-schema.test.js`
- 許可する flow artifact: この issue 用の `specs/<spec>/` のみ
- 非スコープ: Issue #443、flow completion recovery、task lifecycle、schema の意味変更、別 command の payload contract、無関係な refactor
- base commit: `5c8f38ad6912b1fdabc4ad47260002e35cbdafd2`
- 実行を許可する test: 上記 focused tests、直接影響する `update-overview` 関連 tests、固定 commit の独立 scope / AC 監査 PASS 後の `npm test` 1回

## Verification

- pre-fix reproduction: category 欠落 + `{text}` entry が入口で受理され、merge / 永続化で拒否されることを再現する
- focused tests: `overview-merge`、`run-update-overview`、`update-overview-schema`
- related tests: `update-overview` を参照する task integration tests
- fixed commit に対する独立 scope / AC 監査
- 独立監査 PASS 後に full `npm test` を 1 回実行する

</details>