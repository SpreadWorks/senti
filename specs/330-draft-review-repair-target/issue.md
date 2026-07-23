## Summary

When draft review returns only `repairTargets`, the producer emits the raw artifact as `ADVISORY`, while normalization into canonical findings treats the same repair target as `severity: blocking`. As a result, `result_recording` fails closed with `ADVISORY disposition requires advisory findings and no blocking findings`, stopping the review flow without an official recovery path.

## Source

- Related issue: #453
- Spec: `specs/329-review-convergence-edges/spec.json`
- Step: `draft-questions-review`
- Run ID: `a7aadb80-78ec-419a-b196-41365664b797`
- Issue log: `issue-log-4beb3de6-f593-49b9-b839-ec382afbae51`

## Impact

- A draft review that returns only `repairTargets` fails during canonical recording.
- The semantic review attempt is not consumed, but the only recovery offered by the dispatcher is `retry_review` for the same phase, tree, and evidence.
- If duplicate reviews remain prohibited, there is no official path forward and the original issue cannot be completed.

## Reproduction Evidence

- Checkpoint branch: `checkpoint/issue-453-review-blocker`
- Checkpoint commit: `9f07be31355b05882e165b93e08f9ccdbd76dc29`
- Evidence: `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
- Observed artifact:
  - `disposition=ADVISORY`
  - `blockingFindings=[]`
  - `advisoryFindings=[]`
  - 1 `repairTargets` entry
- Normalized finding: `category=repair_target`, `severity=blocking`
- Failure stage: `result_recording`

This branch / commit is evidence of the incomplete flow and a checkpoint for resumption. It must not be merged as-is.

## Root Cause

- `src/flow/commands/review.js` treats draft reviews containing `repairTargets` as `ADVISORY` in the raw artifact.
- Meanwhile, canonical finding conversion passes the same repair target with `blocking` severity.
- `src/flow/lib/review-convergence.js` is correct as currently implemented: it rejects artifacts where `ADVISORY` contains blocking findings or has no advisory findings.
- In other words, the producer-side classification contract is inconsistent with the canonical disposition invariant.

## Scope

- Fix repair-target normalization for draft reviews in `src/flow/commands/review.js`.
- Confirm integration while preserving the existing disposition invariant in `src/flow/lib/review-convergence.js`.
- Add a focused regression test to `tests/unit/flow/commands/review.test.js`.
- Strengthen the existing focused review-convergence tests if needed.

## Out of Scope

- Changing review retry limits or counter resets
- Allowing re-review for the same phase, tree, and evidence
- Changing providers, prompts, or sandbox behavior
- Manually modifying flow state, review artifacts, or gate artifacts
- New lifecycle functionality for active flow pause / checkpoint behavior
- Implementing the three Acceptance Criteria from Issue #453 itself

## Required Invariants

- `ADVISORY` has at least one advisory finding and no blocking findings.
- `REJECTED` has at least one blocking finding.
- `PASS` has no findings.
- Repair targets retain `category=repair_target` and their triage path after canonical recording.
- Invalid artifacts continue to fail closed; validation must not be relaxed.
- The duplicate review prohibition for the same phase, tree, and evidence, as well as the default semantic / tooling limits, must remain in place.

## Acceptance Criteria

1. When a `draft-questions` review contains only `repairTargets`, it can be recorded as canonical advisory findings consistent with the raw `ADVISORY`, and `result_recording` succeeds.
2. The same contract works when a `draft-coverage` review contains only `repairTargets`.
3. `advisoryFindings + repairTargets` are both preserved and recorded as `ADVISORY` without generating blocking findings.
4. The repair target `category=repair_target` and propagation to triage are preserved.
5. If all buckets are empty, the result is `PASS` with 0 findings.
6. `ADVISORY + blockingFindings`, `PASS + finding`, and `REJECTED` without `blockingFindings` continue to be rejected.
7. The fix does not allow re-registering the same artifact or re-running review for the same phase, tree, and evidence.
8. A repair-target artifact equivalent to the Issue #453 checkpoint evidence can be processed once and advance to triage after canonical recording.

## Focused Verification

- Add a matrix to `tests/unit/flow/commands/review.test.js` for `draft-questions` / `draft-coverage` x `empty` / `repairTargets-only` / `advisory+repair` / `invalid blocking`.
- Confirm the negative matrix for `PASS` / `ADVISORY` / `REJECTED` in the existing review-convergence invariant tests.
- Convert the raw evidence shape from Issue #453 into a fixture and reproduce producer -> canonical recording without re-running the review AI.
- Run the required full regression once only after an independent audit of the fixed commit.

## Resume Condition

Resume #453 as the official next action only after this bug has reached remote, the issue is closed, the board is moved to Done, cleanup is complete, and the Issue #453 run ID / spec / checkpoint HEAD / tree have been reconciled.

<details>
<summary>ja</summary>

draft reviewのrepair targetとADVISORYの分類不整合を解消する

## Summary

draft review が `repairTargets` のみを返した場合、producer は raw artifact を `ADVISORY` として出力する一方、canonical finding への正規化では同じ repair target を `severity: blocking` として扱っている。これにより `result_recording` が `ADVISORY disposition requires advisory findings and no blocking findings` で fail closed し、正式な回復経路なしに review フローが停止する。

## Source

- Related issue: #453
- Spec: `specs/329-review-convergence-edges/spec.json`
- Step: `draft-questions-review`
- Run ID: `a7aadb80-78ec-419a-b196-41365664b797`
- Issue log: `issue-log-4beb3de6-f593-49b9-b839-ec382afbae51`

## Impact

- `repairTargets` だけを返す draft review が canonical recording で失敗する。
- semantic review attempt は消費されないが、dispatcher が提示する回復は同一 phase・tree・evidence に対する `retry_review` のみである。
- 重複 review 禁止を維持すると正式経路で先へ進めず、元 Issue を完了できない。

## Reproduction Evidence

- Checkpoint branch: `checkpoint/issue-453-review-blocker`
- Checkpoint commit: `9f07be31355b05882e165b93e08f9ccdbd76dc29`
- Evidence: `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
- Observed artifact:
  - `disposition=ADVISORY`
  - `blockingFindings=[]`
  - `advisoryFindings=[]`
  - `repairTargets` が 1 件
- Normalized finding: `category=repair_target`, `severity=blocking`
- Failure stage: `result_recording`

この branch / commit は未完成フローの証拠と再開用 checkpoint であり、そのまま merge してはならない。

## Root Cause

- `src/flow/commands/review.js` は `repairTargets` を含む draft review を raw artifact では `ADVISORY` として扱っている。
- 一方で canonical finding 化では同じ repair target を `blocking` severity として渡している。
- `src/flow/lib/review-convergence.js` は現行どおり正しく、`ADVISORY` に blocking finding が含まれる、または advisory finding が 1 件もない artifact を拒否する。
- つまり producer 側の分類契約と canonical disposition invariant が不整合になっている。

## Scope

- `src/flow/commands/review.js` における draft review の repair-target 正規化を修正する。
- `src/flow/lib/review-convergence.js` の既存 disposition invariant を維持したまま統合確認する。
- `tests/unit/flow/commands/review.test.js` に focused regression test を追加する。
- 必要に応じて review-convergence の既存 focused test を補強する。

## Out of Scope

- review retry 上限の変更や counter reset
- 同一 phase・tree・evidence の再 review 許可
- provider / prompt / sandbox の変更
- flow state / review artifact / gate artifact の手動修正
- active flow の pause / checkpoint に関する新しい lifecycle 機能
- Issue #453 の 3 つの Acceptance Criteria そのものの実装

## Required Invariants

- `ADVISORY` は advisory finding を 1 件以上持ち、blocking finding を持たない。
- `REJECTED` は blocking finding を 1 件以上持つ。
- `PASS` は finding を持たない。
- repair target は canonical 記録後も `category=repair_target` と triage 経路を失わない。
- invalid artifact は引き続き fail closed とし、validation を緩和しない。
- 同一 phase・tree・evidence の重複 review 禁止と既定の semantic / tooling 上限を維持する。

## Acceptance Criteria

1. `draft-questions` review で `repairTargets` のみがある場合、raw `ADVISORY` と整合する canonical advisory finding として記録でき、`result_recording` が成功する。
2. `draft-coverage` review で `repairTargets` のみがある場合も同じ契約で記録できる。
3. `advisoryFindings + repairTargets` を両方保持したまま、blocking finding を生成せず `ADVISORY` として記録できる。
4. repair target の `category=repair_target` と triage への伝播を維持する。
5. すべての bucket が空の場合は `PASS` になり、finding は 0 件になる。
6. `ADVISORY + blockingFindings`、`PASS + finding`、`REJECTED + blockingFindings なし` は引き続き拒否される。
7. 修正後も同一 artifact の再登録や、同一 phase・tree・evidence の review 再実行は許可しない。
8. Issue #453 の checkpoint evidence と同等の repair-target artifact を 1 回処理し、canonical 記録後に triage へ進める。

## Focused Verification

- `tests/unit/flow/commands/review.test.js` に `draft-questions` / `draft-coverage` × `empty` / `repairTargets-only` / `advisory+repair` / `invalid blocking` のマトリクスを追加する。
- review-convergence の既存 invariant test で `PASS` / `ADVISORY` / `REJECTED` の negative matrix を確認する。
- Issue #453 の raw evidence 形状を fixture 化し、review AI を再実行せず producer → canonical recording を再現する。
- fixed commit に対する独立監査後にのみ、必要な full regression を 1 回実行する。

## Resume Condition

この bug が remote 到達、Issue close、board Done、cleanup まで完了し、Issue #453 の run ID / spec / checkpoint HEAD / tree を照合できた場合に限り、#453 を正式な next action から再開する。

</details>