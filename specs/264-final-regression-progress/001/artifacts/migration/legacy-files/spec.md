# Feature Specification: 264-final-regression-progress

**Feature Branch**: `feature/264-final-regression-progress`
**Created**: 2026-05-20
**Status**: Draft
**Input**: GitHub Issue #337

## Goal
final-regression 実行中に、stderr へ実行コマンド、raw log path、30 秒ごとの elapsed time、失敗時の artifact 確認先を表示する。

## Background
final-regression runs the full project regression after retro and before finalize. The existing implementation creates raw log and result artifacts, but users do not see the raw log path before execution and do not receive progress output while the child process is running. Flow commands emit the final JSON envelope on stdout, so new human-readable progress must use stderr to avoid corrupting machine callers.

## Scope
- final-regression 実行開始時に regression command を stderr へ 1 回表示する。
- final-regression 実行開始時に raw log path を stderr へ 1 回表示する。
- final-regression の子プロセスが完了するまで 30 秒ごとに elapsed time を stderr へ表示する。
- final-regression が final-regression-result.json と raw log を書いた failure では、final-regression-result.json と raw log path の両方を stderr へ表示する。
- spec-local tests で開始時表示、30 秒 heartbeat、失敗時 artifact 導線を検証する。

## Out of Scope
- test-execute と他の flow run コマンドの進捗表示変更。
- regression command の探索順、選択ルール、exit code 契約の変更。
- GitHub Issue と Projects board の表示変更。
- 外部ログサービス、外部依存、ユーザー向け CLI option の追加。

## Constraints
- Node.js 組み込みモジュールのみを使い、外部依存を追加しない。
- src/ 配下に sdd-forge プロジェクト固有の絶対パスや環境値を埋め込まない。
- 既存の final-regression-result.json と final-regression-attempt-NNN.log の artifact 契約を維持する。
- final-regression の人間向け progress と artifact 導線は stderr に出す。stdout は JSON envelope 専用として維持する。
- final-regression の成功条件と失敗条件、プロセス exit code の扱い、failureKind 分類、nextAction 分岐を変更しない。
- 新しいユーザー向け CLI 引数は追加しない。テスト用の内部オプションが必要な場合は user-facing argument として公開しない。
- bounded-resource-usage: heartbeat timer は子プロセス終了時に必ず停止し、raw output の保持上限は既存の maxBuffer と raw log 書き込み単位の範囲内に収める。

## Design Principles
- final-regression に閉じた深い実装を優先し、他の flow command の表示契約を変更しない。
- 実行中表示は人間が監視する stderr 側に出し、stdout の machine-readable envelope と artifact JSON の既存形を壊さない。
- 意味のある実行状態や表示イベントは、必要に応じて専用クラスで表現し、object literal の type 分岐を増やさない。

## Overview
### Modules
- src/flow/lib/run-final-regression.js owns final-regression orchestration, artifact paths, classification, and envelope output.
- src/flow/lib/test-regression.js owns regression command discovery and process execution helpers used by final-regression.
- src/lib/process.js owns low-level child_process wrappers and currently returns complete process output after execFile finishes.
- src/flow/lib/base-command.js and src/lib/dispatcher.js define the envelope stdout contract for flow commands.

### Data Flow
- final-regression resolves the next raw log path before starting the child process, prints command/path to stderr, runs the regression command, records output to raw log, validates result JSON, then returns the same stdout envelope artifacts as before.
- During child process execution, elapsed time output is emitted every 30 seconds until the process resolves or fails; timer cleanup happens before result artifact validation and envelope return.

### Decisions
- [VERIFY] run-final-regression already computes attemptPath before process execution and writes rawOutputPath/resultPath into artifacts.
- [VERIFY] current process helper buffers output until completion, so progress visibility requires a live execution path or final-regression-local timer.
- Use elapsed time every 30 seconds as the heartbeat requirement.
- Keep the change scoped to final-regression and preserve existing artifact and transition behavior.
- Failure output must point to both result artifact and raw log path.
- [CORRECTION] Human progress output is constrained to stderr so stdout remains the JSON envelope.
- [CORRECTION] Failure artifact guidance covers every final-regression failure path that writes result and raw log artifacts, including root mismatch.

## Clarifications (Q&A)
- Q: Does heartbeat require forwarding child process output?
  - A: No. Elapsed time output every 30 seconds satisfies the heartbeat requirement even when the child process itself is silent.
- Q: Should this add a user-facing interval option?
  - A: No. The production interval is fixed at 30000 ms for this spec; any shorter interval used by tests must remain internal.
- Q: Does this change final-regression exit behavior?
  - A: No. Success and failure classification stay identical to the existing final-regression behavior.
- Q: Can final-regression progress be printed to stdout?
  - A: No. stdout remains reserved for the JSON envelope; human progress and artifact links must use stderr.

## Alternatives Considered
- Forward only child process stdout/stderr — Rejected because a silent test command can still produce no output for more than 30 seconds, leaving the user unable to distinguish running from stalled.
- Add progress display to all flow run commands — Rejected because Issue #337 targets final-regression only and broader command output changes would expand the spec beyond one concern.
- Show only the raw log path on failure — Rejected because final-regression-result.json records failureKind, retryable, and nextAction while raw log records process output; failure triage requires both.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T07:57:02.106Z
- Notes: Auto-approved via autoApprove after spec gate PASS.

## Requirements
- R1 [must]: When final-regression starts a discovered regression command, stderr shows the command string before the child process starts while stdout remains reserved for the final JSON envelope.
- R2 [must]: When final-regression starts, stderr shows the repo-relative raw log path before the child process starts while stdout remains reserved for the final JSON envelope.
- R3 [must]: While the final-regression child process is running, elapsed time output is emitted to stderr every 30 seconds until the process exits or reports a spawn error.
- R4 [must]: When final-regression fails after artifact paths have been created, including process attempts, discovery errors, and worktree root mismatch, stderr includes both final-regression-result.json and the raw log path.
- R5 [must]: The existing final-regression result artifact schema, raw log artifact path, failureKind classification, nextAction, retryable flag, and success/failure envelope semantics remain unchanged.

## Acceptance Criteria
- A spec-local test for R1 and R2 observes final-regression stderr containing the command string and repo-relative raw log path before the simulated command completes, and stdout remains valid JSON envelope output.
- A spec-local test for R3 observes at least two elapsed-time heartbeat messages on stderr when a simulated final-regression process exceeds two heartbeat intervals; production cadence remains 30000 ms.
- A spec-local test for R4 observes failed final-regression stderr containing final-regression-result.json and the raw log path for a process/discovery failure and for a worktree root mismatch failure.
- A regression test or spec-local assertion for R5 verifies final-regression-result.json still validates with the existing schema fields and envelope artifacts still include result_path and raw_output_path.
- Running the project test command completes without failures before finalize.

## Implementation Targets
- src/flow/lib/run-final-regression.js
- src/flow/lib/test-regression.js
- src/lib/process.js
- src/flow/lib/base-command.js
- src/lib/dispatcher.js
- specs/264-final-regression-progress/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Stream final-regression execution
  - Provide a live final-regression execution path that can emit elapsed-time heartbeat output while preserving the existing process result shape.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Report final-regression artifacts
  - Print the regression command, raw log path, elapsed-time heartbeat, and failure artifact paths from final-regression to stderr without changing artifact JSON or stdout envelope semantics.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover final-regression progress
  - Add spec-local tests that prove the new final-regression progress and artifact-link behavior without relying on wall-clock 30-second waits.
  - see `tasks/T-3.md` for full spec
