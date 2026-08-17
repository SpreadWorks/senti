## Background

`flow resume` was introduced to restore the context of an in-progress flow after compaction or from outside the worktree. However, in its current state, resume ambiguously combines the responsibilities of "candidate discovery," "target selection," and "starting continuation," and it is tangled with the normal `/senti.flow` entry.

In particular, the current `senti.flow-resume` skill shows the result of `senti flow resume`, then instructs the user to run `/senti.flow` in the mainline phase. Meanwhile, the `spec` / `runId` / `worktreePath` confirmed by resume are not carried over to the subsequent `/senti.flow`. As a result, `/senti.flow` performs active-flow resolution and status rereading again, leaving room to pick up a flow different from the one seen during resume, or a flow from a stale branch/worktree.

There is also a UX and implementation mismatch in `resume --spec`. The help makes it look like a target can be selected from the listed candidates, but the implementation can only select flows registered in `.senti/.active-flow`. Consequently, even if branch/worktree candidates listed by `scanAllFlows()` are displayed, when `.active-flow` does not exist, `senti flow resume --spec <listed-spec>` fails with `spec ... is not in active flows. Active: (none)`.

In this state, the responsibilities of the normal flow continuation path and the recovery/discovery path are not separated, and resume does not function as a safe resumption path.

## Problem

- The target selected by resume is not preserved for subsequent commands, so a different flow can accidentally be continued.
- `resume --spec` is not a selection mechanism that matches the displayed candidates.
- The broad discovery results from `scanAllFlows()` are exposed in a way that resembles normal active-flow detection, making it easy to mix in noise from stale flows or orphan worktrees.
- The skill side also assumes re-entry into `/senti.flow`, so it is not safe as a recovery-only path.

## Goal

Redesign `flow resume` as a recovery-only feature that is separated from the normal flow start/continuation path and restores an explicit target flow from an ambiguous state.

## Proposal

- The normal `/senti.flow` must not depend on resume discovery results.
- Treat `senti flow resume` as a recovery / discovery-only entry point.
- Limit full branch/worktree scanning to explicit discovery operations, not normal active-flow detection.
- After candidate selection, explicitly carry `spec` / `runId` / `worktreePath` into subsequent status / next-action / run commands.
- Abolish the design where resume "only displays candidates and exits, then the next `/senti.flow` resolves a different target again."
- Allow continuation commands to receive target guards such as `--expect-run-id` / `--expect-spec`, and stop if they do not match the target selected by resume.

## Expected Scope

- Clarify responsibilities for `senti flow resume`, `senti flow get resolve-context`, and active flow resolution.
- Revisit the design so the use of `scanAllFlows()` is limited to recovery discovery.
- Consider making `resume --spec` able to reselect listed candidates, or separating it into a discovery-specific option.
- Update the `senti.flow-resume` skill. Do not have it unconditionally call `/senti.flow` after resume.
- Clarify the contract for passing target guards to the continuation commands used after resume.
- Define how stale flows / finalized flows / orphan worktrees / branch-only flows should be handled as recovery candidates.

## Out of Scope

- Prior fixes on the normal flow entry side.
- Fixing the application scope of `ACTIVE_FLOW_MISMATCH` when starting a new flow.
- npm publish / release work.

## Acceptance Criteria

- Even when `.senti/.active-flow` does not exist, starting a new normal `/senti.flow` is not affected by stale candidates from resume discovery.
- When `senti flow resume` presents multiple candidates, the presented candidates can be retrieved again through an explicit selection operation.
- The target consistency between the flow selected by resume and the status / next-action / run command read afterward can be verified by `runId` or `spec`.
- The `senti.flow-resume` skill does not merely instruct the user to "call `/senti.flow` after resume." It shows concrete commands that carry over the target, or a procedure to stop safely.
- Flows from stale branches/worktrees are distinguished from normal active flows and displayed as recovery candidates.
- Even when `.active-flow` is not registered, candidates displayed by discovery can either be reselected by an explicit operation such as `resume --spec`, or, if that is not possible, a consistent UX is provided through another command/option.

## Implementation Notes

- `src/flow/lib/run-resume.js` currently only displays the result of `resolveActiveFlow(ctx.flowState, { selectSpecId })` and does not preserve the target for subsequent operations.
- `src/skills/senti.flow-resume/SKILL.md` instructs the user to use `/senti.flow` in the mainline phase.
- `selectSpecId` in `src/lib/flow-manager.js` only targets flows already registered in `.active-flow`, so it is inconsistent with the candidates listed by `scanAllFlows()`.
- Because `scanAllFlows()` broadly scans specs / worktrees / feature branches, it can easily make `flow.json` files from historical branches or leftover worktrees look like active candidates.

<details>
<summary>ja</summary>

flow resume を recovery 専用として再設計する

## 背景

`flow resume` は、compaction 後や worktree 外から in-progress flow の文脈を復元するために導入された。しかし現状は、resume が「候補探索」「対象選択」「継続開始」の責務を曖昧に兼ねており、通常の `/senti.flow` entry と混線している。

とくに現在の `senti.flow-resume` skill は `senti flow resume` の結果を表示したあと、mainline phase では `/senti.flow` を実行するよう案内する。一方で、resume で確定した `spec` / `runId` / `worktreePath` は後続の `/senti.flow` に引き継がれない。このため `/senti.flow` 側で再度 active-flow 解決や status 読み直しが走り、resume で見ていた対象とは別の flow、または stale な branch/worktree 由来の flow を拾い直す余地がある。

さらに `resume --spec` には UX と実装の不整合がある。help 上は列挙候補から対象を選べるように見えるが、実装上は `.senti/.active-flow` に登録された flow しか選択できない。その結果、`scanAllFlows()` が列挙した branch/worktree 候補が表示されていても、`.active-flow` が無い状態では `senti flow resume --spec <listed-spec>` が `spec ... is not in active flows. Active: (none)` で失敗する。

この状態では、通常の flow 継続経路と recovery/discovery 経路の責務が分離されておらず、resume が安全な再開導線として機能していない。

## 問題

- resume で選んだ対象が後続コマンドへ保持されず、別の flow を誤って継続し得る。
- `resume --spec` が表示候補と一致した選択手段になっていない。
- `scanAllFlows()` の広域探索結果が通常 active 判定に近い顔で露出し、stale flow や orphan worktree のノイズを混ぜやすい。
- skill 側も `/senti.flow` への再入を前提にしており、recovery 専用導線として安全ではない。

## 目的

`flow resume` を通常 flow 開始・継続経路から分離し、曖昧な状態から明示的な対象 flow を復元する recovery 専用機能として再設計する。

## 提案

- 通常の `/senti.flow` は resume の探索結果に依存しない。
- `senti flow resume` は recovery / discovery 専用の入口として扱う。
- branch/worktree 全探索は通常 active 判定ではなく、明示的な discovery 操作に限定する。
- 候補選択後は `spec` / `runId` / `worktreePath` を後続の status / next-action / run command へ明示的に引き継ぐ。
- resume が「候補表示だけして終了し、次の `/senti.flow` が別対象を解決し直す」設計を廃止する。
- 継続コマンド側では `--expect-run-id` / `--expect-spec` のような target guard を受け取り、resume で選ばれた対象と一致しない場合は停止できるようにする。

## 想定スコープ

- `senti flow resume`、`senti flow get resolve-context`、active flow resolution の責務整理。
- `scanAllFlows()` の利用範囲を recovery discovery に限定するための設計見直し。
- `resume --spec` が列挙候補を再指定できるようにする、または discovery 用オプションへ分離する検討。
- `senti.flow-resume` skill の更新。resume 後に `/senti.flow` を無条件で呼ばせない。
- resume 後に使う継続コマンド群へ target guard を渡す契約の明確化。
- stale flow / finalized flow / orphan worktree / branch-only flow を recovery 候補としてどう扱うかの定義。

## Out of Scope

- 通常 flow entry 側の先行修正。
- 新規 flow 開始時の `ACTIVE_FLOW_MISMATCH` 適用範囲の修正。
- npm publish / release 作業。

## 受け入れ条件

- `.senti/.active-flow` が無い状態でも、通常の `/senti.flow` 新規開始は resume discovery の stale 候補に影響されない。
- `senti flow resume` が複数候補を提示した場合、提示された候補は明示的な選択操作で再取得できる。
- resume で選択した flow と、その後に読む status / next-action / run command の対象一致を `runId` または `spec` で検証できる。
- `senti.flow-resume` skill は「resume 後に `/senti.flow` を呼ぶ」だけの案内をしない。対象を引き継ぐ具体的なコマンド、または安全に停止する手順を示す。
- stale な branch/worktree 由来 flow は通常 active flow と区別され、recovery 候補として表示される。
- `.active-flow` 未登録でも、discovery で表示された候補を `resume --spec` などの明示操作で再選択できるか、できない場合は別コマンド/別オプションとして一貫した UX が提供される。

## 実装メモ

- `src/flow/lib/run-resume.js` は現在 `resolveActiveFlow(ctx.flowState, { selectSpecId })` の結果表示に留まっており、後続操作へ対象を保持していない。
- `src/skills/senti.flow-resume/SKILL.md` は mainline phase で `/senti.flow` を案内している。
- `src/lib/flow-manager.js` の `selectSpecId` は `.active-flow` 登録済み flow のみを対象にしており、`scanAllFlows()` の列挙候補と整合していない。
- `scanAllFlows()` は specs / worktrees / feature branches を広く走査するため、履歴ブランチや残存 worktree の `flow.json` を active 候補のように見せやすい。

</details>