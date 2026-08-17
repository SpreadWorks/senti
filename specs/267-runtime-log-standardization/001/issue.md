## Request
For all commands under `sdd-forge flow`, reliably save stdout/stderr to a runtime log so that AI agents can self-diagnose without creating ad-hoc logs via shell redirects or `--log-file`.

## Scope
Only commands under `sdd-forge flow` are in scope.

Included:
- `sdd-forge flow prepare`
- `sdd-forge flow resume`
- `sdd-forge flow get ...`
- `sdd-forge flow set ...`
- `sdd-forge flow run ...`
- `sdd-forge flow report show`

Excluded:
- `docs`, `check`, `metrics`, `spec`, `setup`, `upgrade`
- experimental workflow
- non-flow commands

## Current State Investigation Notes
- There are currently two logging systems. The first is a JSONL log enabled by `logs.enabled: true` in `.sdd-forge/config.json`. When no output path is specified, it writes to `.tmp/logs/sdd-forge-YYYY-MM-DD.jsonl`.
- The JSONL log primarily records `config-loaded`, AI agent start/end, prompt JSON, git commands via `runGit()`, `docs build` pipeline steps, and step changes from `flow set step`.
- The second is a human-readable runtime log exclusive to `flow run`. `src/flow.js` passes `runtimeLog: group === "run"` to the dispatcher, and `src/lib/dispatcher.js` creates `.tmp/logs/<flowId>/<command>-<timestamp>.log`. When `--log-file` is specified, the log is saved to that path.
- The current runtime log captures only stderr by replacing `process.stderr.write`, and appends start/end/fail lines. The stdout envelope JSON and regular output are not saved.
- Commands other than `flow run` — such as `flow get`, `flow set`, `flow prepare`, `flow resume`, and `flow report show` — have no shared runtime log. Only what is explicitly logged via the logger appears in JSONL.
- `logger.event()` and `logger.git()` are near fire-and-forget async calls, and there appears to be no common `logger.flush()` call on the `src` side before CLI exit. JSONL entries may be lost for short-lived commands.
- Most `docs`-related commands use `createLogger()` for on-screen display logging, which is separate from the unified Logger JSONL. The `docs` family is out of scope for this issue.
- In practice, `.tmp/logs/` contains JSONL, prompt JSON, and past runtime logs for `auto-check`, `gate`, `review`, etc. At the time of the latest check, `config-loaded` was recorded in `.tmp/logs/sdd-forge-2026-05-25.jsonl`.

## Desired Specification
- Save stdout/stderr to a runtime log for all commands under `sdd-forge flow`.
- Each flow has a single runtime log file, appended to `.tmp/logs/<flowId>.log`.
- When no active flow exists, use `flowId = no-flow` and write to `.tmp/logs/no-flow.log`.
- Each flow command execution is identified by the existing flow `runId` combined with a runtime log `sequence` number.
- `sequence` is assigned by counting existing blocks in `.tmp/logs/<flowId>.log`. No global sequence counter is stored in flow.json.
- stdout and stderr are recorded in the same log block in chronological order, with `[stdout]` / `[stderr]` prefixes on each line.
- Log block start/end records `runId`, `sequence`, `attempt`, `command`, `startedAt`, `endedAt`, and `exitCode`.
- `command` represents the `flow ...` command that was executed, not a git command.
- No log file names or paths are written to flow.json.
- For step-associated commands only, `runtimeLog` metadata is saved to the corresponding step.
- Read-only or auxiliary commands not tied to a step (e.g., `flow get status`) do not update flow.json.
- When a non-step command fails, the failure envelope or stderr should include `runtimeLog: { runId, sequence }` so the AI can retrieve the log.
- `flow run ... --log-file` is removed. Explicit log path specification is no longer provided; all logging is consolidated into automatic runtime logs and `flow get runtime-log`.

## Example flow.json metadata
Only for step-associated commands, save the following to the corresponding step. File names and paths are not stored.

```json
{
  "runtimeLog": {
    "runId": "<flow-run-id>",
    "sequence": 43,
    "attempt": 2,
    "command": "flow run review",
    "startedAt": "2026-05-25T10:30:00.000Z",
    "endedAt": "2026-05-25T10:30:20.000Z",
    "exitCode": 1
  }
}
```

## Example runtime log format
```text
===== start runId=<flow-run-id> sequence=43 attempt=2 command="flow run review" startedAt="2026-05-25T10:30:00.000Z" =====
[stdout] { "ok": false, ... }
[stderr] [sdd-forge] warning...
===== end runId=<flow-run-id> sequence=43 exitCode=1 endedAt="2026-05-25T10:30:20.000Z" =====
```

## Additional Command
Add `flow get runtime-log`.

Expected usage:
- `sdd-forge flow get runtime-log`
- `sdd-forge flow get runtime-log --sequence <n>`
- `sdd-forge flow get runtime-log --run-id "<flow-run-id>#<sequence>"`
- `sdd-forge flow get runtime-log --format json`

Output:
- Default: print the raw log content to stdout.
- With `--format json`: return an envelope JSON containing `text`, `runId`, `sequence`, `command`, etc.

## AI Operation Rules
- AI must not use shell redirects to save flow command output for logging purposes.
- When a problem occurs with a flow command, use the `runtimeLog` information from the failure envelope/stderr or the step's `runtimeLog` metadata to run `sdd-forge flow get runtime-log` and read the stdout/stderr log.
- Remove `--log-file` usage from flow-related skills in `src/skills/` and replace with `flow get runtime-log`.
- Add a rule to `src/AGENTS.md` stating that flow commands automatically save runtime logs, so explicit log output is only needed in special cases.
- Since `src/skills/` will be modified, run `sdd-forge upgrade` during implementation to propagate changes to `.agents/skills/`.

## Acceptance Criteria (Draft)
- stdout/stderr are saved to `.tmp/logs/<flowId>.log` across different flow paths: `flow prepare`, `flow resume`, `flow get status`, `flow set note`, `flow run review`, `flow report show`, etc.
- stdout and stderr are recorded in the same runtime log block with `[stdout]` / `[stderr]` prefixes.
- Each execution block records `runId`, `sequence`, `attempt`, `command`, `startedAt`, `endedAt`, and `exitCode`.
- On retry or re-execution, a new `sequence` block is appended to the same `.tmp/logs/<flowId>.log`.
- For step-associated commands, `runtimeLog` metadata is saved to the corresponding step in flow.json.
- Read-only commands not tied to a step do not update flow.json.
- On failure of non-step commands, `runtimeLog.runId` and `runtimeLog.sequence` can be obtained from the envelope or stderr.
- `sdd-forge flow get runtime-log` returns the raw log content by default.
- `sdd-forge flow get runtime-log --format json` returns an envelope JSON.
- `flow run ... --log-file` is removed from the registry, help text, skills, and tests.
- AI flow skills describe using `flow get runtime-log` instead of shell redirects or `--log-file`.
- `src/AGENTS.md` includes operational rules for the flow runtime log.
- `sdd-forge upgrade` propagates skill changes.

## Notes
- Capturing stdout must not break the compatibility of existing machine-readable stdout. Simply tee the output to both screen and log.
- Do not place runtime log files under `.sdd-forge/`. Runtime logs are temporary and belong in `.tmp/logs/`. Do not mix log file paths into persistent state.
- Consolidating into `.tmp/logs/<flowId>.log` avoids increasing the masking burden that would arise from logs entering the repository's persistent storage area.
- Detailed git command JSONL logging remains within the scope of the existing Logger. The primary focus of this issue is the stdout/stderr runtime log for all flow commands.
- The risk of missing `flush()` in JSONL Logger is noted as a current investigation finding, but the core of this issue is the flow runtime log. It may be addressed in parallel where necessary.

<details>
<summary>ja</summary>

[ENHANCE] 全コマンドの stdout/stderr runtime log を標準化する

## 要望
`sdd-forge flow` 配下の全コマンドについて、stdout/stderr を runtime log に確実に保存し、AI が shell リダイレクトや `--log-file` で個別にログを作らなくても自己解決できるようにする。

## 対象範囲
対象は `sdd-forge flow` 配下のみ。

含めるもの:
- `sdd-forge flow prepare`
- `sdd-forge flow resume`
- `sdd-forge flow get ...`
- `sdd-forge flow set ...`
- `sdd-forge flow run ...`
- `sdd-forge flow report show`

対象外:
- `docs`, `check`, `metrics`, `spec`, `setup`, `upgrade`
- experimental workflow
- flow 以外の通常コマンド

## 現状調査メモ
- 現在のログは 2 系統。1 つ目は `.sdd-forge/config.json` の `logs.enabled: true` で有効になる JSONL ログ。出力先未指定時は `.tmp/logs/sdd-forge-YYYY-MM-DD.jsonl`。
- JSONL ログは主に `config-loaded`、AI agent start/end、prompt JSON、`runGit()` 経由の git コマンド、`docs build` の pipeline-step、`flow set step` の step change を記録する。
- 2 つ目は `flow run` 専用の human-readable runtime log。`src/flow.js` が dispatcher に `runtimeLog: group === "run"` を渡し、`src/lib/dispatcher.js` が `.tmp/logs/<flowId>/<command>-<timestamp>.log` を作成する。`--log-file` 指定時はそのパスに保存する。
- 現在の runtime log は基本的に `process.stderr.write` の差し替えで stderr だけを捕捉し、start/end/fail 行を追加している。stdout の envelope JSON や通常出力は保存対象ではない。
- `flow run` 以外、たとえば `flow get`、`flow set`、`flow prepare`、`flow resume`、`flow report show` には共通 runtime log がない。JSONL に残るのは logger を明示的に呼ぶ箇所だけ。
- `logger.event()` と `logger.git()` は fire-and-forget に近い非同期呼び出しで、CLI 終了前に共通 `logger.flush()` する処理が src 側に見当たらない。短時間コマンドでは JSONL が欠落する可能性がある。
- docs 系の多くは `createLogger()` による画面表示ログで、統一 Logger の JSONL とは別物。本件では docs 系は対象外。
- 実ファイルとして `.tmp/logs/` には JSONL、prompt JSON、過去の `auto-check`、`gate`、`review` などの runtime log が残っている。直近確認時点では `.tmp/logs/sdd-forge-2026-05-25.jsonl` に `config-loaded` が記録されていた。

## 実現したい仕様
- `sdd-forge flow` 配下の全コマンドで stdout/stderr を runtime log に保存する。
- runtime log 実体は flow ごとに 1 ファイルとし、`.tmp/logs/<flowId>.log` に追記する。
- active flow がない場合は `flowId = no-flow` として `.tmp/logs/no-flow.log` に保存する。
- 各 flow コマンド実行は、既存 flow `runId` と runtime log `sequence` の組で識別する。
- `sequence` は `.tmp/logs/<flowId>.log` 側の既存ブロックから採番する。flow.json にグローバル採番カウンタは置かない。
- stdout/stderr は同じログブロックに時系列で記録し、各行に `[stdout]` / `[stderr]` prefix を付ける。
- ログブロックの start/end には `runId`, `sequence`, `attempt`, `command`, `startedAt`, `endedAt`, `exitCode` を記録する。
- `command` は git コマンドではなく、実行された `flow ...` コマンドを表す。
- flow.json にはログファイル名やパスを書かない。
- step に紐づくコマンドだけ、対象 step に `runtimeLog` metadata を保存する。
- `flow get status` など step に紐づかない read-only / 補助コマンドは flow.json を更新しない。
- step 非対応コマンドで失敗した場合は、失敗 envelope または stderr に `runtimeLog: { runId, sequence }` を出して AI がログを取得できるようにする。
- `flow run ... --log-file` は削除する。明示ログパス指定は提供せず、自動 runtime log と `flow get runtime-log` に統一する。

## flow.json に保存する metadata 例
step に紐づくコマンドのみ、対象 step に以下を保存する。ファイル名・パスは保存しない。

```json
{
  "runtimeLog": {
    "runId": "<flow-run-id>",
    "sequence": 43,
    "attempt": 2,
    "command": "flow run review",
    "startedAt": "2026-05-25T10:30:00.000Z",
    "endedAt": "2026-05-25T10:30:20.000Z",
    "exitCode": 1
  }
}
```

## runtime log 形式例
```text
===== start runId=<flow-run-id> sequence=43 attempt=2 command="flow run review" startedAt="2026-05-25T10:30:00.000Z" =====
[stdout] { "ok": false, ... }
[stderr] [sdd-forge] warning...
===== end runId=<flow-run-id> sequence=43 exitCode=1 endedAt="2026-05-25T10:30:20.000Z" =====
```

## 追加コマンド
`flow get runtime-log` を追加する。

想定:
- `sdd-forge flow get runtime-log`
- `sdd-forge flow get runtime-log --sequence <n>`
- `sdd-forge flow get runtime-log --run-id "<flow-run-id>#<sequence>"`
- `sdd-forge flow get runtime-log --format json`

出力:
- デフォルトは該当ログ本文をそのまま stdout に出す。
- `--format json` の場合は envelope JSON で `text`, `runId`, `sequence`, `command` などを返す。

## AI 運用ルール
- AI は flow コマンドのログ保存目的で shell リダイレクトを使わない。
- flow コマンドで問題が発生した場合は、失敗 envelope/stderr の `runtimeLog` 情報、または step の `runtimeLog` metadata を使って `sdd-forge flow get runtime-log` を実行し、stdout/stderr ログを読む。
- `src/skills/` の flow 系 skill から `--log-file` 利用例を削除し、`flow get runtime-log` に置き換える。
- `src/AGENTS.md` には、flow コマンドは runtime log が自動保存されるため、明示ログ出力は必要な場合に限る、というルールを追記する。
- `src/skills/` を変更するため、実装時は `sdd-forge upgrade` を実行して `.agents/skills/` へ反映する。

## 受け入れ条件案
- `flow prepare`, `flow resume`, `flow get status`, `flow set note`, `flow run review`, `flow report show` など異なる flow 経路で stdout/stderr が `.tmp/logs/<flowId>.log` に保存される。
- stdout と stderr が `[stdout]` / `[stderr]` prefix 付きで同一 runtime log ブロックに保存される。
- 各実行ブロックに `runId`, `sequence`, `attempt`, `command`, `startedAt`, `endedAt`, `exitCode` が記録される。
- retry / 再実行では同一 `.tmp/logs/<flowId>.log` に新しい `sequence` ブロックが追記される。
- step に紐づくコマンドでは、flow.json の対象 step に `runtimeLog` metadata が保存される。
- step に紐づかない read-only コマンドは flow.json を更新しない。
- step 非対応コマンド失敗時は envelope または stderr から `runtimeLog.runId` / `runtimeLog.sequence` を確認できる。
- `sdd-forge flow get runtime-log` がデフォルトでログ本文を返す。
- `sdd-forge flow get runtime-log --format json` が envelope JSON を返す。
- `flow run ... --log-file` は registry, help, skills, tests から削除される。
- AI 用 flow skill は shell リダイレクトや `--log-file` ではなく `flow get runtime-log` を使う説明になる。
- `src/AGENTS.md` に flow runtime log の運用ルールが追加される。
- `sdd-forge upgrade` により skill 変更が反映される。

## 注意点
- stdout を捕捉しても、既存の機械可読 stdout の互換性を壊さないこと。画面出力とログ出力を tee するだけにする。
- `.sdd-forge/` には runtime log 実体を置かない。runtime log は一時ログとして `.tmp/logs/` に置き、永続状態へログファイルパスを混入させない。
- `.tmp/logs/<flowId>.log` に集約することで、リポジトリ内の永続領域へログが入り込むことによるマスキング責務を増やさない。
- git コマンド詳細の JSONL ログは既存 Logger の範囲。本件の主対象は flow コマンド全体の stdout/stderr runtime log。
- JSONL Logger の `flush()` 欠落リスクは現状調査として記録するが、本件の中心は flow runtime log。必要な範囲で同時に扱う。

</details>