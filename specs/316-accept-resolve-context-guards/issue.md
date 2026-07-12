## Background

`Senti flow get resolve-context` selects and reads the active flow state, and is used for context recovery after compaction. In `finalize-commit`, it must be called with the standard target guards, `--expect-run-id`, `--expect-issue`, and `--expect-spec`, to prevent targeting the wrong flow.

However, the current `resolve-context` command registry entry does not define `args.options`, and the guard options are not exposed in help. As a result, the dispatcher rejects these three options as unknown options, and the flow for Issue #411 is stopping safely during `finalize-commit`.

## Problem

Although `resolve-context` is a command that should accept flow target guards, the registry, help, and dispatcher definitions are not aligned. As a result, the CLI rejects the options before existing guard validation is reached.

## Expected Changes

- Set the existing `FLOW_TARGET_GUARD_OPTIONS` on the `get.resolve-context` definition in `src/flow/registry.js`.
- Show `--expect-run-id`, `--expect-issue`, and `--expect-spec` in `senti flow get resolve-context --help`, keeping the help and dispatcher option definitions aligned.
- Reuse the existing guard validation in `FlowCommand` / flow-context as-is.
- Do not add `resolve-context`-specific validation, exceptions such as `targetGuard: false`, or branches that bypass guards.
- When guards match, return the resolved context as before; when they do not match, return the existing contract’s `ACTIVE_FLOW_MISMATCH` envelope.
- Preserve the existing behavior of `senti flow get resolve-context` when no guards are specified.

## Acceptance Criteria

- The registry options for `senti flow get resolve-context` include `--expect-run-id`, `--expect-issue`, and `--expect-spec`.
- The same three options are displayed in command help, and parity between help and dispatcher option definitions is guaranteed by a unit test.
- `resolve-context` succeeds and returns the resolved context when given a run ID / Issue number / spec that matches the active flow.
- When each of the run ID, Issue number, and spec guards does not match the active flow, the command returns `ACTIVE_FLOW_MISMATCH` rather than an unknown option error or a normal success.
- Target comparison is handled by the existing flow-context validation, with no duplicate validation logic or unguarded exceptions added.
- Existing calls without guards continue to succeed.

## Test Targets

- `tests/unit/flow/ctx-dispatch.test.js`
  - Add `resolve-context` to the parity targets for target-sensitive dispatcher commands.
  - Verify that registry options and help output match.
- `tests/unit/flow/resolve-context-extended.test.js`
  - Verify successful matching guards through CLI dispatch.
  - Verify that mismatches for run ID / Issue / spec each return `ACTIVE_FLOW_MISMATCH`.

## Scope

Limit changes to the following files:

- `src/flow/registry.js`
- `tests/unit/flow/ctx-dispatch.test.js`
- `tests/unit/flow/resolve-context-extended.test.js`

Do not add external dependencies. This is a prerequisite for resuming #411; implementing other issues from #410 through #428 and changing `finalize-commit` itself are out of scope.

<details>
<summary>ja</summary>

flow resolve-context で target guard を受け付ける

## 背景

`Senti flow get resolve-context` は active flow state を選択・読み取り、compaction 後の context recovery に使われる。`finalize-commit` では対象 flow の取り違えを防ぐため、標準の target guard である `--expect-run-id`、`--expect-issue`、`--expect-spec` を付けて呼び出す必要がある。

しかし現在の `resolve-context` command registry entry には `args.options` が定義されておらず、help にも guard options が公開されていない。そのため dispatcher はこれら 3 options を unknown option として拒否し、Issue #411 の flow は `finalize-commit` で安全停止している。

## 問題

`resolve-context` は flow target guard を受け付けるべきコマンドであるにもかかわらず、registry / help / dispatcher の定義が揃っていない。結果として、既存の guard validation に到達する前に CLI 側で拒否される。

## 期待する変更

- `src/flow/registry.js` の `get.resolve-context` definition に既存の `FLOW_TARGET_GUARD_OPTIONS` を設定する。
- `senti flow get resolve-context --help` に `--expect-run-id`、`--expect-issue`、`--expect-spec` を表示し、help と dispatcher option definition を一致させる。
- guard validation は `FlowCommand` / flow-context の既存処理をそのまま再利用する。
- `resolve-context` 専用の validation、`targetGuard: false` のような例外、guard を迂回する分岐は追加しない。
- guard が一致する場合は従来どおり resolved context を返し、不一致の場合は既存 contract の `ACTIVE_FLOW_MISMATCH` envelope を返す。
- guard を指定しない既存の `senti flow get resolve-context` の挙動は維持する。

## 受け入れ条件

- `senti flow get resolve-context` の registry options に `--expect-run-id`、`--expect-issue`、`--expect-spec` が含まれる。
- command help に同じ 3 options が表示され、help と dispatcher option definition の parity が unit test で保証される。
- active flow と一致する run ID / Issue number / spec を指定した `resolve-context` は成功し、resolved context を返す。
- run ID、Issue number、spec の各 guard が active flow と不一致の場合、unknown option や通常成功ではなく `ACTIVE_FLOW_MISMATCH` を返す。
- target comparison は既存の flow-context validation が担い、重複 validation logic や unguarded exception は追加されていない。
- guard なしの既存呼び出しは引き続き成功する。

## テスト対象

- `tests/unit/flow/ctx-dispatch.test.js`
  - `resolve-context` を target-sensitive dispatcher command の parity 対象に追加する。
  - registry options と help 表示の一致を検証する。
- `tests/unit/flow/resolve-context-extended.test.js`
  - matching guards の成功を CLI dispatch 経由で検証する。
  - run ID / Issue / spec の各 mismatch が `ACTIVE_FLOW_MISMATCH` を返すことを検証する。

## スコープ

変更対象は以下に限定する。

- `src/flow/registry.js`
- `tests/unit/flow/ctx-dispatch.test.js`
- `tests/unit/flow/resolve-context-extended.test.js`

外部依存は追加しない。これは #411 を resume するための prerequisite であり、#410〜#428 の他 Issue の実装や `finalize-commit` 自体の変更はスコープ外とする。

</details>