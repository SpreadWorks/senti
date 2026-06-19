## Summary
Even when a user explicitly starts a target such as `$senti.flow #403`, `senti flow get status` may return a different active flow, for example `#402`, and that flow may be treated as the continuation target, entering the dispatcher loop as-is.

As a result, `finalize`, `cleanup`, `repair`, or step execution may run against a flow that was not specified in the current session, incorrectly advancing work from another session.

## Problem
The current `senti.flow` entry handling checks whether an active flow exists, but verification that the user-specified target matches the active flow's `issue`, `spec`, or `runId` is not acting as an effective stop condition.

Additionally, when `autoApprove: true` or `requires_approval: false` is prioritized in determining whether a step can execute, execution may continue past the safety guard for a target mismatch.

## Impact
- Processing proceeds against an Issue, spec, or runId that the user did not specify
- An active flow being handled in another session is modified by mistake
- `finalize`, `cleanup`, `repair`, or individual step execution runs against the wrong target

## Reproduction Steps
1. A flow for `#402` is active in one session
2. In another session, the user runs `$senti.flow #403`
3. `senti flow get status` returns the active `#402`
4. The dispatcher loop for `#402` is entered without confirming target match
5. `finalize-cleanup` or similar actions are executed against `#402` instead of `#403`

## Expected Behavior
When user input includes an explicit target, that target should be compared with the active flow's `issue`, `spec`, or `runId` before entering the dispatcher.

If they do not match, no flow operations other than status checks should be executed, and execution should stop with at least the following message to the user:

`Another flow is active. It does not match the specified #403, so this flow cannot be started. The existing flow may be in progress in another session.`

## Acceptance Criteria
- When `$senti.flow #403` is run and the active flow is `#402`, the next action for `#402` is not executed
- The active flow's `issue`, `spec`, or `runId` is always compared with the user-specified target
- On mismatch, no flow commands other than status checks are executed
- This target match check is not skipped even when `autoApprove: true` or `requires_approval: false`
- Before `finalize`, `cleanup`, `repair`, or step execution, target mismatch is treated as a stop condition
- It is clarified whether this validation responsibility belongs to the skill side or the CLI side
- A regression test or procedural test can detect that another active flow is not executed by mistake

## Implementation Notes
- Do not treat a flow as the continuation target based only on `active: true`
- When an explicit target is present, determine whether it is the same target before determining whether it is active
- Treat target mismatch as a safety guard, not as an approval policy

<details>
<summary>ja</summary>

flow対象不一致時に別セッションのactive flowを実行してしまう

## 概要
ユーザーが `$senti.flow #403` のように対象を明示して起動した場合でも、`senti flow get status` が返した別の active flow（例: `#402`）を継続対象として扱い、そのまま dispatcher loop に入ってしまうことがある。

その結果、現在のセッションで指定していない flow に対して `finalize` / `cleanup` / `repair` / step 実行が走り、別セッションの作業を誤って進めてしまう。

## 問題
現状の `senti.flow` entry 処理では active flow の有無は確認しているが、ユーザーが明示した対象と active flow の `issue` / `spec` / `runId` が一致するかどうかの検証が実効的な停止条件になっていない。

さらに、`autoApprove: true` や `requires_approval: false` が step 実行可否の判断で優先されることで、対象不一致という安全上のガードを越えて実行が継続してしまう場合がある。

## 影響
- ユーザーが指定していない Issue / spec / runId に対して処理が進む
- 別セッションで扱っている active flow を誤って変更する
- `finalize` / `cleanup` / `repair` / 各 step 実行が誤対象に対して走る

## 再現手順
1. あるセッションで `#402` の flow が active になっている
2. 別セッションでユーザーが `$senti.flow #403` を実行する
3. `senti flow get status` が active な `#402` を返す
4. 対象一致を確認しないまま `#402` の dispatcher loop に入る
5. `#403` ではなく `#402` に対して `finalize-cleanup` などが実行される

## 期待動作
ユーザー入力に明示対象がある場合は、dispatcher に入る前にその対象と active flow の `issue` / `spec` / `runId` を照合する。

不一致の場合は状態確認以外の flow 操作を一切実行せず停止し、少なくとも次の趣旨をユーザーへ返す。

`別 flow が active です。指定された #403 とは一致しないため開始できません。既存 flow は別セッションで作業中の可能性があります。`

## 受け入れ条件
- `$senti.flow #403` 実行時に active flow が `#402` の場合、`#402` の next action を実行しない
- active flow の `issue` / `spec` / `runId` とユーザー指定対象を必ず照合する
- 不一致時は状態確認以外の flow コマンドを実行しない
- `autoApprove: true` または `requires_approval: false` でも、この対象一致チェックはスキップされない
- `finalize` / `cleanup` / `repair` / step 実行の前段で、対象不一致を停止条件として扱う
- この判定責務を skill 側と CLI 側のどちらが持つかを明確化する
- 回帰テストまたは手順テストで、別 active flow を誤実行しないことを検知できる

## 実装メモ
- `active: true` だけで継続対象とみなさない
- 明示対象がある場合は、「active かどうか」より先に「同一対象かどうか」を判定する
- 対象不一致は承認ポリシーではなく安全性ガードとして扱う

</details>