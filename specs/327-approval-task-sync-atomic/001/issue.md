## Summary

There is an inconsistency where `approval` completion and spec task synchronization are not part of the same update unit, allowing partial updates to be persisted. Currently, after updating `approval` to `done`, spec task sync is executed. Even if sync fails, only a warning is returned and the overall operation is treated as successful. As a result, the flow state and spec task state can remain inconsistent.

## Problem

In the current implementation, approval completion and spec task synchronization are not atomic.

Expected invariants:

- Approval completion and task synchronization are handled as the same success/failure unit.
- If spec task sync fails, the approval step keeps its pre-update state.
- Broken or missing specs are not swallowed as `sync not required`.

## Scope

- `src/flow/lib/set-step.js`
- `src/flow/lib/sync-spec-tasks.js`
- Regression tests for failure paths
- Retry / idempotency tests

## Acceptance Criteria

- For write failure, parse failure, or target mismatch, both flow state and spec task state remain in their pre-update state.
- Retrying once with the same input produces the same result without leaving a partial update behind.
- Existing contracts for the happy path of approval completion and task updates are preserved.
- Spec load errors do not fall back to warnings, and are returned to the caller as failures.

## Evidence

- `src/flow/lib/set-step.js:299` updates approval to `done` first.
- `src/flow/lib/set-step.js:311-324` converts spec task sync failures into warnings and treats the overall operation as successful.
- `src/flow/lib/sync-spec-tasks.js:33-38` treats spec load errors in general as equivalent to `no active flow`.

<details>
<summary>ja</summary>

approval完了とspec task同期をatomicにする

## Summary

`approval` 完了と spec task 同期が同じ更新単位になっておらず、部分更新が永続化される不整合があります。現在は `approval` を `done` に更新した後で spec task sync を実行しており、sync が失敗しても warning のみを返して処理全体は成功扱いになります。その結果、flow state と spec task state が矛盾したまま残ります。

## Problem

現行実装では、approval completion と spec task synchronization が atomic ではありません。

期待する不変条件:

- approval completion と task synchronization は成功/失敗を同じ単位で扱う。
- spec task sync が失敗した場合、approval step は更新前の状態を保持する。
- 壊れた spec や欠落した spec を `sync不要` として握り潰さない。

## Scope

- `src/flow/lib/set-step.js`
- `src/flow/lib/sync-spec-tasks.js`
- failure path の回帰テスト
- retry / idempotency テスト

## Acceptance Criteria

- write failure、parse failure、target mismatch のいずれでも、flow state と spec task state の両方が更新前の状態を保持する。
- 同じ入力で 1 回だけ retry しても、部分更新を残さず同じ結果になる。
- approval 完了と task 更新の正常系における既存契約は維持される。
- spec load error は warning にフォールバックせず、呼び出し元へ失敗として返る。

## Evidence

- `src/flow/lib/set-step.js:299` で approval を先に `done` に更新している。
- `src/flow/lib/set-step.js:311-324` で spec task sync failure を warning 化し、全体を成功扱いにしている。
- `src/flow/lib/sync-spec-tasks.js:33-38` で spec load error 全般を `no active flow` 相当として扱っている。

</details>