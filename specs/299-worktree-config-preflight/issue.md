## Background

If `senti flow prepare --worktree` is run while `.senti/config.json` has not been reflected in the branch used to create the worktree, the generated worktree either does not correctly contain the config required by subsequent flow steps or contains stale content.

Investigation confirmed the following two cases:

- If `.senti/config.json` is untracked, `flow prepare --worktree` starts by reading the config from the main repository, but after the worktree is created, the worktree-side `.senti/config.json` does not exist and the command fails with `ERR_MISSING_FILE`.
- If `.senti/config.json` is tracked but has unstaged changes, `flow prepare --worktree` itself succeeds. However, the worktree receives the old committed `.senti/config.json` rather than the modified content, and the flow proceeds with stale config.

In the current implementation, after `run-prepare-spec.js` runs `git worktree add`, `syncPluginRuntimeToWorktree()` copies only `.senti/config.local.json` and the plugin runtime. `.senti/config.json` is not copied, so the worktree only contains the content included in the branch commit. After that, `runDocsScanAndValidate()` runs inside the worktree and requires `.senti/config.json`.

## Recommended Approach

Do not perform implicit automatic commits. In `--worktree` mode, before running `git worktree add`, perform a preflight check that files required inside the worktree have already been reflected in the source branch.

Initially, limit the required files to:

- `.senti/config.json`

If a required file does not exist in HEAD/base, or if it is in a staged / unstaged / untracked state that will not be reflected in the worktree, stop before creating the worktree and let the user choose:

1. Commit the required file changes and continue
2. Abort flow prepare

Avoid automatically copying local files into the worktree. That would cause the worktree state to diverge from the branch history and make it ambiguous whether the config change is part of the feature or a temporary injection.

Also avoid automatic commits without confirmation. `.senti/config.json` may contain shared settings such as scan targets, agent settings, plugin settings, and flow behavior, so the side effect of adding history should require an explicit user decision.

## Acceptance Criteria

- `senti flow prepare --worktree` detects a missing `.senti/config.json` before creating the worktree.
- It detects staged / unstaged / untracked `.senti/config.json` changes that would not be reflected in the new worktree.
- It returns a clear halt envelope or prompt context before any `git worktree add` side effects occur.
- The user can choose either "commit the required files and continue" or "abort".
- The existing `.senti/config.local.json` overlay sync behavior is preserved.

<details>
<summary>ja</summary>

[BUG] flow worktree 作成前に必須 config の分岐反映を検査する

## 背景

`.senti/config.json` が worktree 作成元のブランチに反映されていない状態で `senti flow prepare --worktree` を実行すると、生成された worktree に後続 flow が必要とする config が正しく存在しない、または古い内容になる。

調査で次の 2 ケースを確認した。

- `.senti/config.json` が untracked の場合、main リポジトリ側の config を読んで `flow prepare --worktree` は開始するが、worktree 作成後に worktree 側の `.senti/config.json` が存在せず、`ERR_MISSING_FILE` で失敗する。
- `.senti/config.json` が tracked だが unstaged 変更を持つ場合、`flow prepare --worktree` 自体は成功する。しかし worktree 側には変更後の内容ではなく commit 済みの古い `.senti/config.json` が入り、flow が stale config で進む。

現状の実装では、`run-prepare-spec.js` が `git worktree add` を実行した後、`syncPluginRuntimeToWorktree()` で `.senti/config.local.json` と plugin runtime のみをコピーしている。`.senti/config.json` はコピー対象外のため、worktree にはブランチ commit に含まれる内容だけが入る。その後 `runDocsScanAndValidate()` が worktree 側で実行され、`.senti/config.json` を要求する。

## 推奨方針

暗黙の自動コミットはしない。`--worktree` mode では `git worktree add` の前に、worktree 側で必須となるファイルが作成元ブランチに反映済みか preflight で検査する。

初期の必須ファイルは次に絞る。

- `.senti/config.json`

必須ファイルが HEAD/base に存在しない、または worktree に反映されない staged / unstaged / untracked 状態の場合は、worktree を作る前に停止してユーザーに選択させる。

1. 必須ファイルの変更を commit して続行する
2. flow prepare を中止する

local file を worktree に自動コピーする案は避ける。worktree の状態がブランチ履歴と乖離し、config 変更が feature に含まれるのか一時注入なのかが曖昧になるため。

確認なしの自動コミットも避ける。`.senti/config.json` には scan 対象、agent 設定、plugin 設定、flow 挙動など共有設定が含まれ得るため、履歴を増やす副作用は明示的なユーザー判断にすべき。

## 受け入れ条件

- `senti flow prepare --worktree` が worktree 作成前に `.senti/config.json` の欠落を検出する。
- staged / unstaged / untracked の `.senti/config.json` 変更が新しい worktree に反映されない状態を検出する。
- `git worktree add` の副作用が発生する前に、明確な halt envelope または prompt context を返す。
- ユーザーは「必須ファイルを commit して続行」または「中止」を選べる。
- 既存の `.senti/config.local.json` overlay 同期の挙動は維持する。

</details>