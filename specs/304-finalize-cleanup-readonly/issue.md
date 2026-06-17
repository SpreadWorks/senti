## Background

During finalize-cleanup for Spec #303, the cleanup command itself appended agent metrics to specs/<spec>/flow.json inside the worktree targeted for deletion. As a result, the worktree became dirty and git worktree remove failed.

## Problem

The root cause is on the CLI command side. The skill only calls finalize-cleanup; it does not contain any logic that writes metrics to flow.json in the target worktree.

The responsibility of finalize-cleanup is to confirm that the finalized state has already been reflected on the main side and then remove the target worktree. If it writes into the target worktree after cleanup execution starts, cleanup itself interferes with cleanup.

## Approach

During finalize-cleanup execution, treat the worktree targeted for deletion as read-only.

- Do not create, append to, or modify flow.json, issue logs, plugin artifacts, or similar files inside the target worktree
- Write runtime logs / metrics / recovery notes during cleanup outside the target worktree, or complete them before the cleanup phase
- Allow .senti/last-finalized-spec and final state updates on the main repo side
- Move any processing that needs to write inside the target worktree to earlier cleanup phases such as finalize-commit / finalize-sync

## Additional Issue to Handle in the Same Task

Even when --force was specified, the internal git worktree remove could not delete a dirty worktree and failed with the same error as a normal remove. The read-only change above should make this unlikely on the normal path, but as a defensive measure for abnormal cases where the worktree remains dirty due to external factors, verify and fix finalize-cleanup --force so that it actually performs the equivalent of git worktree remove --force.

## Acceptance Criteria

- After finalize-cleanup starts, files inside the target worktree are not modified
- Metrics / logs / notes during cleanup do not make the target worktree dirty
- Normal cleanup completes through removal of a clean worktree
- If the target worktree is dirty due to external factors, finalize-cleanup --force functions as an explicit force cleanup
- A regression test or spec-local reproduction test can detect a worktree remove failure caused by appending flow.json metrics during cleanup

## Reference Observations

- WORKTREE_REMOVE_FAILED: target worktree contains modified or untracked files
- The remaining diff was an agent metrics append to specs/303-workunit-review-resume/flow.json
- Even with --auto-rescue / --force retries, metrics were added on each cleanup execution, causing the dirty state to reappear

<details>
<summary>ja</summary>

[BUG] finalize-cleanup は削除対象 worktree を dirty にしない

## 背景

Spec #303 の finalize-cleanup 中に、cleanup コマンド自身が削除対象 worktree 内の specs/<spec>/flow.json へ agent metrics を追記した。その結果 worktree が dirty になり、git worktree remove が失敗した。

## 問題

主原因は CLI コマンド側。skill は finalize-cleanup を呼ぶだけで、target worktree の flow.json へ metrics を書く処理は持っていない。

finalize-cleanup の責務は、main 側へ反映済みの状態を確認し、target worktree を削除すること。cleanup 実行開始後に target worktree 内へ書き込むと、cleanup 自身が cleanup を妨害する。

## 対応方針

finalize-cleanup 実行中は、削除対象 worktree に対して read-only とする。

- target worktree 内の flow.json、issue-log、plugin artifacts などへ新規書き込み・追記・変更をしない
- cleanup 中の runtime log / metrics / recovery note は target worktree 外へ書く、または cleanup 前段で完了させる
- main repo 側の .senti/last-finalized-spec や最終状態更新は許可する
- target worktree 内へ書く必要がある処理は finalize-commit / finalize-sync など cleanup 前段へ移す

## 同一タスクで扱う追加課題

--force 指定時も内部の git worktree remove が dirty worktree を削除できず、通常 remove と同じエラーになった。上記 read-only 化で通常経路では発生しにくくなるが、外部要因で dirty が残る異常系の防御線として、finalize-cleanup --force が実際に git worktree remove --force 相当を実行することも確認・修正する。

## 受け入れ条件

- finalize-cleanup 開始後、target worktree 内のファイルが変更されない
- cleanup 実行中の metrics / logs / notes が target worktree を dirty にしない
- 通常 cleanup が clean な worktree remove まで完了する
- target worktree が外部要因で dirty な場合、finalize-cleanup --force が明示的な force cleanup として機能する
- 回帰テストまたは spec-local 再現テストで、cleanup 中の flow.json metrics 追記による worktree remove failure を検知できる

## 参考観測

- WORKTREE_REMOVE_FAILED: target worktree contains modified or untracked files
- 残差分は specs/303-workunit-review-resume/flow.json の agent metrics 追記
- --auto-rescue / --force の再試行でも cleanup 実行ごとに metrics が追加され、dirty 状態が再発した

</details>