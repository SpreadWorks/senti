## Summary
Resolve audit finding `F-005` as an independent fix unit. Ensure that even if an `agent` child process ignores `SIGTERM` after a timeout, the caller does not wait indefinitely and always reaches a settled state.

- Category: Critical / liveness
- F-ID: `F-005`
- Recommended Wave: Wave 1

## Background
The current implementation has paths that continue waiting for `close` / `error` even after timeout, and cannot forcibly terminate child processes that ignore `SIGTERM`. Depending on the race between `timeout` / `close` / `error`, double settlement or leaked listeners / timers may also occur.

## Scope
- Target: `src/lib/agent.js`
- Add: `ChildProcessSupervisor`, `AgentTimeoutError`
- Tests: `tests/agent/`, `tests/unit/lib/`

## Acceptance Criteria
- Send `SIGTERM` immediately when timeout is reached.
- Send `SIGKILL` if the process does not exit within the grace period.
- The `close` / `error` / `timeout` race is settle-once, and the terminal result is observed exactly once.
- Always release listeners and timers on every termination path.
- Timeout-related failures return within `timeout + grace + margin` as either a non-zero exit or `AgentTimeoutError`.
- No child process or descendant process remains after timeout completion.
- Cover the following with automated tests:
  - Child process that ignores `SIGTERM`
  - Timeout race immediately before process exit
  - `spawn error`
  - Case with descendant processes
- Existing success paths do not regress.

## Verification
- Make `F-005` in `.tmp/refactoring/report.md` and its referenced source traceable from the issue.
- Add a failure reproduction before implementation and confirm it fails before the fix.
- After the fix, prove each acceptance criterion with automated tests or reproduction commands.

## Dependencies
- No dependencies.
- Prerequisite for `D-09`.
- Can run in parallel with flow / docs / plugin issues.
- Must run serially with `D-09` because they share the `agent.js` boundary.

## Out of Scope
- Opportunistic fixes for findings not described in this issue
- Running `npm publish`, `npm dist-tag`, or an official release

## Completion Contract
- All listed acceptance criteria can be verified by automated tests or reproduction commands.
- Include regression verification for existing success paths.
- Do not make tests pass by directly rewriting flow state or artifacts.
- If source updates require docs synchronization, perform it in the same change.

<details>
<summary>ja</summary>

agent 子プロセスを timeout 後に確実に収束させる

## Summary
監査 finding `F-005` を独立した修正単位として解消する。`agent` 子プロセスが timeout 後に `SIGTERM` を無視した場合でも、呼び出し側が待ち続けず、必ず収束する状態を作る。

- Category: Critical / liveness
- F-ID: `F-005`
- Recommended Wave: Wave 1

## Background
現状は timeout 後も `close` / `error` を待ち続ける経路があり、`SIGTERM` を無視する子プロセスを強制終了できない。`timeout` / `close` / `error` の race 次第では、二重 settle や listener / timer の取り残しも起こり得る。

## Scope
- 対象: `src/lib/agent.js`
- 追加: `ChildProcessSupervisor`, `AgentTimeoutError`
- テスト: `tests/agent/`, `tests/unit/lib/`

## Acceptance Criteria
- timeout 到達時にただちに `SIGTERM` を送る。
- grace 期間内に終了しない場合は `SIGKILL` を送る。
- `close` / `error` / `timeout` の race は settle-once で、終端結果は 1 回だけ観測される。
- すべての終端経路で listener と timer を必ず解放する。
- timeout 系失敗は `timeout + grace + margin` 内に非 0 終了または `AgentTimeoutError` として返る。
- timeout 完了後に子プロセスおよび子孫プロセスが残存しない。
- 以下を自動テストでカバーする。
  - `SIGTERM` を無視する子プロセス
  - 終了直前の timeout race
  - `spawn error`
  - 子孫プロセスを持つケース
- 既存の正常系は回帰しない。

## Verification
- `.tmp/refactoring/report.md` の `F-005` と参照 source を issue から辿れる状態にする。
- 実装前に failure reproduction を追加し、修正前に失敗することを確認する。
- 修正後は各受け入れ条件を自動テストまたは再現 command で証明する。

## Dependencies
- 依存関係なし。
- `D-09` の前提。
- flow / docs / plugin issue とは並列可。
- `agent.js` 境界を共有するため `D-09` とは直列。

## Out of Scope
- 本 issue に記載していない finding の便乗修正
- `npm publish`, `npm dist-tag`, 正式 release の実行

## Completion Contract
- 記載した全受け入れ条件を、自動テストまたは再現 command で確認できること。
- 既存正常系の回帰確認を含めること。
- flow の状態や artifact をテストから直接書き換えて成功させないこと。
- source 更新に伴って必要な docs 同期がある場合は同一変更で行うこと。

</details>