## Overview
Even when starting a flow by explicitly specifying an Issue, such as `$senti.flow #399`, if an active flow exists for another Issue, the skill may read the bare `senti flow get status` and treat that active flow as the continuation target. As a result, erroneous behavior occurs where it proceeds to `next-action` or `finalize-cleanup` for an out-of-scope flow.

## Reproduced Problem
- Start by specifying Issue `#399`.
- At that point, a flow for another Issue, `#397`, is active.
- The skill references the context-based `senti flow get status` and mistakenly identifies the `#397` flow as the continuation target for `#399`.
- It attempts to proceed with next-action determination or cleanup for an unrelated flow.

## Cause
- `src/skills/partials/core-principle.md` fixes the execution of `exactly senti flow get status` before presenting options.
- Because of this constraint, the skill cannot use the safer CLI path `senti flow get status <runId>`.
- In `src/flow/lib/get-status.js`, `resolveByRunId` can be used when a `runId` is specified, but the current skill wording prevents its use.
- As a result, it references another flow in the current active context instead of the flow associated with the target Issue.

## Expected Fix
1. When entering a flow with an Issue specified, compare `status.data.issue` with the specified Issue before proceeding to the dispatcher.
2. If the active flow's Issue does not match the specified Issue, stop immediately and explicitly report the mismatch.
3. When this mismatch occurs, do not execute continuation commands such as `next-action`, `flow run`, or `finalize-cleanup`.
4. After the `runId` is known, the `autoApprove` check should use `senti flow get status <runId>` instead of the bare `senti flow get status`.
5. Replace the `exactly senti flow get status` rule in `src/skills/partials/core-principle.md` with a runId-aware procedure that prioritizes `runId`.
6. Add a clear CLI-side error such as `ACTIVE_FLOW_MISMATCH` to prevent mixing up the requested Issue / `runId` with the active context.

## Acceptance Criteria
- When `$senti.flow #399` is run, commands for the active Issue `#397` flow are not executed.
- If there is an Issue mismatch, execution stops and the mismatch details are made explicit.
- If a `runId` exists, `autoApprove` is always read only from the target flow's status.
- The old assumption of a bare `senti flow get status` is removed from the skill wording.
- The new runId-aware guidance is verified by tests or placement assertions.
- A new CLI mismatch error is added, preventing incorrect association between Issue / `runId` and the active flow.

<details>
<summary>ja</summary>

flow status の対象 flow 不一致ガード

## 概要
`$senti.flow #399` のように Issue を明示して flow を開始した場合でも、別 Issue の active flow が存在すると、skill が裸の `senti flow get status` を読んでその active flow を継続対象として扱ってしまうことがある。結果として、対象外の flow に対する `next-action` や `finalize-cleanup` へ進む誤動作が発生する。

## 再現している問題
- Issue `#399` を指定して開始する。
- その時点で別 Issue `#397` の flow が active になっている。
- skill が context-based な `senti flow get status` を参照し、`#397` 側の flow を `#399` の継続対象として誤認する。
- 無関係な flow に対して次アクション判定や cleanup を進めようとする。

## 原因
- `src/skills/partials/core-principle.md` が、選択肢提示前に `exactly senti flow get status` の実行を固定している。
- この制約により、CLI が持っている `senti flow get status <runId>` の安全な経路を skill 側から使えない。
- `src/flow/lib/get-status.js` では `runId` 指定時に `resolveByRunId` を使えるが、現状の skill 文言がその利用を妨げている。
- そのため、対象 Issue に紐づく flow ではなく、現在の active context にある別 flow を参照してしまう。

## 期待する修正
1. Issue 指定で flow に入る場合、dispatcher に進む前に `status.data.issue` と指定 Issue を比較する。
2. active flow の Issue が指定 Issue と一致しない場合は、その場で停止して不一致を明示的に報告する。
3. この不一致時は `next-action`、`flow run`、`finalize-cleanup` など継続系コマンドを実行しない。
4. `runId` が判明した後の `autoApprove` 確認は、裸の `senti flow get status` ではなく `senti flow get status <runId>` を使う。
5. `src/skills/partials/core-principle.md` の `exactly senti flow get status` ルールを、`runId` を優先する runId-aware な手順へ置き換える。
6. CLI 側にも `ACTIVE_FLOW_MISMATCH` のような明確なエラーを追加し、要求した Issue / `runId` と active context の取り違えを防ぐ。

## 受け入れ条件
- `$senti.flow #399` 実行時に、active Issue `#397` の flow 用コマンドが実行されない。
- Issue 不一致がある場合は停止し、不一致内容が明示される。
- `runId` がある場合、`autoApprove` は必ず対象 flow の status からのみ読まれる。
- skill 文言から旧来の裸 `senti flow get status` 前提が除去されている。
- 新しい runId-aware guidance がテスト、または placement assertion で検証されている。
- CLI の不一致エラーが追加され、Issue / `runId` と active flow の誤結合を防げる。

</details>