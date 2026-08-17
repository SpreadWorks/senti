## Overview

Issue #452 completed the separation of `review disposition` and `tooling failure`, but the real-flow validation in Issue #451 still shows three boundary inconsistencies around `review convergence`. Because of these inconsistencies, the process can stop at canonical recording or acceptance handoff even when the correct review result has been obtained.

## Remaining Inconsistencies

1. Separate test-review findings that point to the same target are collapsed into the same `findingId`, causing canonical evidence recording to fail.
2. After review tooling is exhausted, even if the tree SHA changes, retry recovery cannot safely resume the tooling state, and atomic save is rejected due to callback scope inconsistency.
3. When deferring flow-level canonical semantic exhaustion to acceptance, the remaining `currentTaskId` prevents creation of a flow-scope completion record.

## Problem

The core contract of #452 has been implemented, but the following three boundaries are not fully closed with the existing retry API.

- finding identity
- bounded recovery after tree changes
- separation of flow/task scope

As a result, execution can stop during canonical evidence saving, tooling recovery, or acceptance handoff.

## Fix Direction

- Generate `findingId` from a stable canonical key that includes not only the target but also finding-specific content.
- After tooling exhaustion, recovery should restore one bounded retry only when the tree SHA has changed. Preserve the semantic attempt count.
- Determine the scope for canonical exhaustion deferral from the active review phase, and at flow level explicitly record completion with `taskId: null`.
- Preserve the scope, CAS, duplicate execution, defense, and retry-limit contracts established in #448 and #452.

## Acceptance Criteria

- Different findings for the same target have different stable `findingId`s, and re-parsing the same finding produces the same ID.
- IDs do not change when finding order changes, and only true duplicates are rejected as duplicates.
- After tooling retry exhaustion, recovery cannot resume for the same tree SHA, and tooling attempts can resume within the configured limit only when the tree SHA has changed.
- Recovery on tree changes does not alter `semanticAttempt`, `semanticMax`, provenance, or the target guard.
- The recovery mutation completes as a single CAS update and leaves no callback scope error or partial update.
- Canonical exhaustion in flow-level test/impl review completes with `taskId: null` even if `currentTaskId` remains, and hands off findings to acceptance exactly once.
- Task-level review preserves the correct `taskId` and does not alter the flow-level lifecycle.
- There are no regressions in duplicate execution prevention for the same tree/evidence, tooling retry limits, or any contracts from #448 and #452.

## Evidence

- Three entries from the Issue #451 issue-log: duplicate `findingId`, retry recovery callback scope error, and flow scope omission in canonical deferral.
- Unmerged evidence commits: `daa1900a`, `6923e01a`, `53a38a1c`
- Evidence branch: `fix/test-review-finding-identity`

This branch is not patch-equivalent to the current `main`; treat it as an evidence branch for reference only. It is not a direct merge candidate.

## Main Targets

- `src/flow/commands/review.js`
- `src/flow/lib/review-convergence.js`
- `src/flow/lib/set-retry.js`
- `src/flow/lib/run-review.js`
- focused review/convergence tests

## Out of Scope

- Increasing the number of review retries
- Fixing providers or the sandbox itself
- Changing semantic judgment of finding content
- Full redesign of the acceptance policy

## Verification

- same-target distinct/duplicate finding matrix
- same-tree/changed-tree recovery matrix
- flow/task scope x PASS/ADVISORY/REJECTED/exhaustion matrix
- independent audit with a fixed tree SHA
- related unit/e2e tests and `npm test`

<details>
<summary>ja</summary>

#452後に残るreview convergence境界不整合を閉じる

## 概要

Issue #452 で `review disposition` と `tooling failure` の分離は完了したが、Issue #451 の実フロー検証では `review convergence` 周辺に 3 つの境界不整合が残っている。この不整合により、正しい review 結果が得られていても canonical 記録や acceptance handoff で停止する。

## 残っている不整合

1. 同一 target を指す別々の test-review finding が同じ `findingId` に潰れ、canonical evidence の記録に失敗する。
2. review tooling が exhaustion したあと tree SHA が変わっても、retry recovery が tooling state を安全に再開できず、callback の scope 不整合で atomic save が拒否される。
3. flow-level の canonical semantic exhaustion を acceptance に defer する際、残留した `currentTaskId` に引かれて flow scope の完了記録を作れない。

## 問題

#452 の中心契約は実装済みだが、以下 3 つの境界が既存 retry API と完全に閉じていない。

- finding identity
- tree 変更後の bounded recovery
- flow/task scope の切り分け

その結果、canonical evidence の保存、tooling recovery、acceptance handoff のいずれかで停止しうる。

## 修正方針

- `findingId` は target だけでなく finding 固有内容を含む安定した canonical key から生成する。
- tooling exhaustion 後の recovery は、tree SHA が変わった場合に限って 1 回分の bounded retry へ戻す。semantic attempt 数は保持する。
- canonical exhaustion の defer は active review phase から scope を決定し、flow-level では明示的に `taskId: null` で完了を記録する。
- #448 と #452 で確立した scope、CAS、duplicate execution、防御、retry 上限の契約は維持する。

## Acceptance Criteria

- 同じ target に対する異なる finding は異なる安定 `findingId` を持ち、同一 finding の再 parse では同じ ID になる。
- finding の順序が変わっても ID は変化せず、真の duplicate だけが duplicate として拒否される。
- tooling retry exhaustion 後、同じ tree SHA では再開できず、tree SHA が変わった場合のみ既定上限内で tooling attempt を再開できる。
- tree 変更時の recovery は `semanticAttempt`、`semanticMax`、provenance、target guard を変更しない。
- recovery mutation は単一の CAS 更新で完了し、callback scope error や部分更新を残さない。
- flow-level の test/impl review における canonical exhaustion は、`currentTaskId` が残っていても `taskId: null` で完了し、finding を acceptance へ 1 回だけ handoff する。
- task-level review は正しい `taskId` を維持し、flow-level lifecycle を変更しない。
- 同一 tree/evidence の重複実行禁止、tooling retry 上限、#448、#452 の全契約に回帰がない。

## Evidence

- Issue #451 issue-log の 3 件: duplicate `findingId`、retry recovery callback scope error、canonical deferral の flow scope omission。
- 証拠用の未統合 commit: `daa1900a`, `6923e01a`, `53a38a1c`
- 証拠 branch: `fix/test-review-finding-identity`

この branch は現行 `main` に対する patch-equivalent ではなく、参照用の証拠 branch として扱う。直接の merge 候補にはしない。

## 主な対象

- `src/flow/commands/review.js`
- `src/flow/lib/review-convergence.js`
- `src/flow/lib/set-retry.js`
- `src/flow/lib/run-review.js`
- focused review/convergence tests

## Out of Scope

- review retry 回数の増加
- provider や sandbox 自体の修正
- finding 内容の semantic 判断変更
- acceptance policy の全面再設計

## 検証

- same-target distinct/duplicate finding matrix
- same-tree/changed-tree recovery matrix
- flow/task scope × PASS/ADVISORY/REJECTED/exhaustion matrix
- fixed tree SHA での独立監査
- 関連 unit/e2e tests と `npm test`

</details>