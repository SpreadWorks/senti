## Summary

`runFlowCommandHooks()` in `src/lib/plugin-registry.js` catches hook `run()` throws and `ok:false`, normalizes them into `PLUGIN_HOOK_FAILED` warnings and issue-log candidates, and ultimately always returns `{ ok: true }`. Return values that are incompatible with the envelope format also do not become explicit failures and may be treated as implicit successes.

Meanwhile, the spec-local test for Issue #375 fixes `prepare` / `finalize-cleanup` business hook failures as non-fatal warnings, but `src/flow/lib/run-finalize-cleanup.js` later reinterprets that warning as `PLUGIN_LIFECYCLE_FAILED` and turns it into fail-stop behavior.

As a result, fail-open / fail-closed decisions for hook failures are scattered across implicit branches in each caller instead of being defined by the hook contract. Even required integration failures can leave the flow treated as successful, allowing publication to continue or partial updates to occur.

## Decision

Add failure policy metadata to flow command hooks, and register and snapshot each hook as either `required` or `advisory`.

Unify the source of truth for hook execution results around a typed outcome returned by the runner, and remove the contract where callers infer and transform generic warnings later.

- `required` hook: fail-closed. On failure, the caller fails
- `advisory` hook: can leave a warning / issue-log / follow-up while allowing the main command to continue

## Requirements

- Every flow command hook and persisted hook snapshot must explicitly specify a failure policy
- Missing / unknown policies must be rejected during registration or snapshot validation
- Failures in `required` hooks must be treated as caller failures
- Only `advisory` hooks may normalize failures into warnings / issue-log entries / follow-ups while allowing the main command to continue
- Runtime integrity failures such as import failures, `register(api)` mismatches, `FlowCommandHook` inheritance violations, and snapshot metadata mismatches must remain hard failures regardless of policy
- Commands that use `required` hooks must stop before returning a success envelope and must not leave partial durable side effects such as flow state, publication, or plugin artifacts on failure

Business failures covered by `required` / `advisory` hooks must include at least the following:

- `run()` throw
- `ok:false` envelope
- malformed / non-envelope result
- artifact/context write failure during hook execution

Spawn / non-zero / timeout / invalid output inside a hook should be treated as the same kind of failure once the hook surfaces it as a throw or failure envelope.

## Scope

- Hook discovery / snapshot / execution contract in `src/lib/plugin-registry.js`
- The `plugins.flowCommandHooks` schema stored in flow state, plus the fixtures / test helpers that build it
- Hook failure handling on the caller side
- At minimum, replace the warning reinterpretation special case in `src/flow/lib/run-finalize-cleanup.js` with structured policy handling
- Focused unit / spec-local tests that lock down the lifecycle matrix and atomicity

## Out of Scope

- Contract changes for legacy shell hooks in `src/lib/hooks.js`, such as `flow.hooks.PostWorktree`
- Redesigning the entire plugin command framework
- Extending workflow-specific artifact schemas
- Redesigning the board API

## Acceptance Criteria

- Hook policy is saved in snapshots, and missing / unknown policies are rejected with tests
- The matrix of `required` / `advisory` x success / throw / `ok:false` / malformed result / artifact-write failure is locked down by tests
- `required` failures are not converted into `ok: true`, warning-only, or follow-up-only results, and are returned to the caller as typed failures
- Only `advisory` failures may allow the main command to continue while preserving warnings / issue-log entries / follow-ups
- Command-level tests involving `required` hook failures confirm that no partial updates remain in flow state, publication, plugin artifacts, or commit/cleanup state after failure
- No path remains where callers scan `PLUGIN_HOOK_FAILED` warnings to make their own fatal/non-fatal decision, or that behavior is unified under an equivalent structured contract

## Evidence

- `src/lib/plugin-registry.js:1296-1323` catches hook execution failures, normalizes them into warning / issue-log candidates, and always returns `{ ok: true }`
- `specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js:770-790` fixes `prepare` / `finalize-cleanup` hook business failures as non-fatal warnings
- `src/flow/lib/run-finalize-cleanup.js:5439-5475` reinterprets a generic lifecycle warning as `PLUGIN_LIFECYCLE_FAILED` on the caller side, making the contract depend on a command special case rather than hook metadata

<details>
<summary>ja</summary>

required plugin hookのfail-closed契約を定義する

## Summary

`src/lib/plugin-registry.js` の `runFlowCommandHooks()` は、hook `run()` の throw や `ok:false` を catch して `PLUGIN_HOOK_FAILED` warning と issue-log 候補へ正規化し、最終的に常に `{ ok: true }` を返している。envelope 非互換の戻り値も明示失敗にならず、暗黙 success 扱いになりうる。

一方で Issue #375 の spec-local test は `prepare` / `finalize-cleanup` の business hook failure を non-fatal warning として固定しているが、`src/flow/lib/run-finalize-cleanup.js` は後段でその warning を `PLUGIN_LIFECYCLE_FAILED` に再解釈して fail-stop にしている。

このため、hook failure の fail-open / fail-closed 判定が hook contract ではなく caller ごとの暗黙分岐に散っており、required integration failure でも flow 成功扱いのまま publication 継続や部分更新が発生しうる。

## Decision

flow command hook に failure policy metadata を追加し、各 hook を `required` または `advisory` として登録・snapshot 化する。

hook 実行結果の判定源は runner が返す typed outcome に統一し、caller が generic warning を後段で推測変換する契約は廃止する。

- `required` hook: fail-closed。失敗時は caller を失敗させる
- `advisory` hook: warning / issue-log / follow-up を残しつつ main command を継続できる

## Requirements

- すべての flow command hook と persisted hook snapshot は failure policy を明示する
- missing / unknown policy は registration または snapshot validation で reject する
- `required` hook の失敗は caller failure として扱う
- `advisory` hook に限り、失敗を warning / issue-log / follow-up に正規化して main command を継続できる
- import failure、`register(api)` 不整合、`FlowCommandHook` 継承違反、snapshot metadata mismatch などの runtime integrity failure は、policy に関係なく hard fail のまま維持する
- `required` hook を使う command は success envelope を返す前に停止し、失敗時に flow state・publication・plugin artifact などの durable side effect を部分的に残さない

`required` / `advisory` の対象となる hook business failure には少なくとも以下を含める。

- `run()` throw
- `ok:false` envelope
- malformed / non-envelope result
- hook 実行中の artifact/context write failure

hook 内部の spawn / non-zero / timeout / invalid output は、hook が throw または fail envelope として surfacing した時点で同じ failure として扱う。

## Scope

- `src/lib/plugin-registry.js` の hook discovery / snapshot / execution contract
- flow state に保存される `plugins.flowCommandHooks` schema と、それを組み立てる fixture / test helper
- caller 側の hook failure handling
- 少なくとも `src/flow/lib/run-finalize-cleanup.js` の warning 再解釈 special-case を structured policy handling に置き換える
- lifecycle matrix と atomicity を固定する focused unit / spec-local tests

## Out of Scope

- `src/lib/hooks.js` の legacy shell hook (`flow.hooks.PostWorktree` など) の契約変更
- plugin command framework 全体の再設計
- workflow 固有 artifact schema の拡張
- board API の再設計

## Acceptance Criteria

- hook policy が snapshot に保存され、missing / unknown policy は test 付きで reject される
- `required` / `advisory` × success / throw / `ok:false` / malformed result / artifact-write failure の matrix が tests で固定される
- `required` failure は `ok: true`、warning-only、follow-up-only に変換されず、typed failure として caller に返る
- `advisory` failure 時のみ warning / issue-log / follow-up を保持したまま main command を継続できる
- `required` hook failure を含む command-level test で、failure 後に flow state・publication・plugin artifact・commit/cleanup state に部分更新が残らないことを確認する
- caller が `PLUGIN_HOOK_FAILED` warning を走査して独自に fatal/non-fatal 判定する経路が残らない、または等価な structured contract に統一される

## Evidence

- `src/lib/plugin-registry.js:1296-1323` は hook 実行失敗を catch して warning / issue-log 候補へ正規化し、常に `{ ok: true }` を返している
- `specs/288-workflow-plugin-migration/tests/workflow-plugin-migration.test.js:770-790` は `prepare` / `finalize-cleanup` の hook business failure を non-fatal warning として固定している
- `src/flow/lib/run-finalize-cleanup.js:5439-5475` は generic lifecycle warning を caller 側で `PLUGIN_LIFECYCLE_FAILED` に再解釈しており、契約が hook metadata ではなく command special-case に依存している

</details>