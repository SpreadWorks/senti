## Summary

When an internal agent is launched from `workflow refine`, failures caused by an unresolved CLI are returned only as `spawn codex ENOENT`, which lacks the information needed to investigate the cause. At the same time, we want to clarify that agent provider command resolution is expected to respect the environment from when `senti` was started.

## Background

When running `senti workflow refine 30fc` in OOS_echub, `spawn codex ENOENT` occurred during an agent call inside workflow refine.

At that time, `@openai/codex` itself had been installed via pnpm global, but the `PATH` of the `senti` process launched from the Codex execution environment did not include the pnpm global bin directory, so `spawn("codex", args)` failed.

In the current `src/lib/agent.js`, `spawn()` is passed `env: { ...process.env }`, so it is not intentionally dropping `PATH`. However, `child.on("error")` rejects ENOENT as-is, so the following information is unavailable on failure:

- The command it attempted to execute
- The referenced `PATH`
- Which provider / profile / commandId failed
- How to fix it

The `workflow refine` side is already able to pass `commandId: workflow.refine`, so we want to improve ENOENT diagnostics in the core agent side.

## Problem

With the current failure message, it is difficult for users to determine which of the following applies:

- The target CLI is not in the `PATH` of the environment where `senti` was started
- The provider configuration's `command` is incorrect
- An absolute path is not being used as expected
- It is unclear which call through the workflow agent failed

As a result, `spawn codex ENOENT` alone makes reproduction, isolation, and support difficult.

## Expected Fix

- Agent provider command resolution should, in principle, respect `process.env.PATH` from when `senti` was started.
- Even when passing `env` to `spawn(command, args, options)`, preserve the existing environment with `env: { ...process.env, ...overrides }` so it is not dropped.
- If an absolute path is specified for `command` in the provider configuration, pass that value to `spawn()` as-is.
- Improve the error reported when ENOENT occurs, including at least the following:
  - The `command` it attempted to execute
  - The referenced `PATH`
  - `provider` / `profile` / `commandId`
  - Suggested resolutions, for example: add the target CLI to the `PATH` of the environment where `senti` is started
- Do not implement path completion based on a specific package manager such as pnpm / npm / nvm.

## Acceptance Criteria

- If `command -v codex` succeeds in the shell where `senti` was started, the internal agent spawn in `senti workflow refine <hash>` can also resolve `codex`.
- If `command -v codex` fails in the shell where `senti` was started, the failure does not end with only `spawn codex ENOENT`; instead, it emits a diagnosable error that includes `PATH` and `provider` / `profile` / `commandId`.
- If an absolute path is specified in the provider configuration, that value can be used as-is.
- The fix does not embed environment-specific absolute paths.
- Do not implement PATH completion for specific package managers such as pnpm / npm / nvm.
- Do not break existing behavior for the claude provider, codex provider, or workflow refine.
- Add unit tests for ENOENT diagnostics in `src/lib/agent.js`.

## Related Areas

- `src/lib/agent.js`
- `src/lib/provider.js`
- `.senti/plugin-sources/senti-workflow-plugin/lib/services/agent.js`
- `.senti/plugin-sources/senti-workflow-plugin/lib/services/index.js`

<details>
<summary>ja</summary>

agent spawn ENOENT の診断を改善する

## 概要

`workflow refine` から内部 agent を起動した際、CLI 未解決時の失敗が `spawn codex ENOENT` のみで返り、原因調査に必要な情報が不足している。あわせて、agent provider の command 解決は `senti` 起動時の環境をそのまま尊重する前提であることを明確にしたい。

## 背景

OOS_echub で `senti workflow refine 30fc` を実行した際、workflow refine 内部の agent 呼び出しで `spawn codex ENOENT` が発生した。

このとき `@openai/codex` 自体は pnpm global にインストール済みだったが、Codex 実行環境から起動された `senti` プロセスの `PATH` に pnpm global bin が含まれておらず、`spawn("codex", args)` が失敗していた。

現状の `src/lib/agent.js` では `spawn()` に `env: { ...process.env }` を渡しており、意図的に `PATH` を落としているわけではない。一方で `child.on("error")` では ENOENT をそのまま reject しているため、失敗時に以下が分からない。

- 実行しようとした command
- 参照された `PATH`
- どの provider / profile / commandId で失敗したか
- どう直せばよいか

`workflow refine` 側では `commandId: workflow.refine` まで渡せているため、core agent 側で ENOENT 診断を改善したい。

## 問題

現在の失敗メッセージでは、利用者が次のどれに該当するかを判断しづらい。

- `senti` を起動した環境の `PATH` に対象 CLI が入っていない
- provider 設定の `command` が誤っている
- 絶対パス指定が期待どおり使われていない
- workflow agent 経由のどの呼び出しで失敗したのか不明

その結果、`spawn codex ENOENT` だけでは再現・切り分け・サポートが難しい。

## 期待する修正

- agent provider の command 解決は、原則として `senti` 起動時の `process.env.PATH` をそのまま尊重する。
- `spawn(command, args, options)` に `env` を渡す場合でも、既存環境を落とさないよう `env: { ...process.env, ...overrides }` を維持する。
- provider 設定で `command` に絶対パスが指定された場合は、その値をそのまま `spawn()` に渡せるようにする。
- ENOENT 発生時のエラーを改善し、少なくとも以下を含める。
  - 実行しようとした `command`
  - 参照した `PATH`
  - `provider` / `profile` / `commandId`
  - 解決候補（例: `senti` を起動する環境の `PATH` に対象 CLI を追加してください）
- pnpm / npm / nvm など特定 package manager 前提のパス補完は実装しない。

## 受け入れ条件

- `senti` を起動した shell で `command -v codex` が成功する場合、`senti workflow refine <hash>` の内部 agent spawn でも `codex` を解決できる。
- `senti` を起動した shell で `command -v codex` が失敗する場合、`spawn codex ENOENT` だけで終わらず、`PATH` と `provider` / `profile` / `commandId` を含む診断可能なエラーが出る。
- provider 設定で絶対パスを指定した場合、その値をそのまま使える。
- 修正に環境固有の絶対パスを埋め込まない。
- pnpm / npm / nvm など特定 package manager 向けの PATH 補完を実装しない。
- 既存の claude provider / codex provider / workflow refine の動作を壊さない。
- `src/lib/agent.js` の ENOENT 診断に対する unit test を追加する。

## 関連箇所

- `src/lib/agent.js`
- `src/lib/provider.js`
- `.senti/plugin-sources/senti-workflow-plugin/lib/services/agent.js`
- `.senti/plugin-sources/senti-workflow-plugin/lib/services/index.js`

</details>