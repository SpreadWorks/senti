# Feature Specification: 323-child-process-failure-results

**Feature Branch**: `feature/323-child-process-failure-results`
**Created**: 2026-07-20
**Status**: Draft
**Input**: GitHub Issue #444

## Goal
default test runner と final-regression が child process の起動不能・異常終了・通常の assertion failure を区別し、1 回の実行ログで一次原因と process 状態を診断できるようにする。

## Background
default runner は category ごとに node --test を spawnSync し、status と出力だけで結果を集計するため、ENOENT、signal、timeout、buffer overflow が未実行または 0 PASS に見える。final-regression の shared executor は legacy fields を返すが、maxBuffer を spawn failure と同じ started=false にし、raw log に共通の primary cause contract がない。本 spec は 2 つの producer surface を同じ typed result model に揃え、既存 artifact schema と正常時 summary を維持したまま異常終了を明示する。

## Scope
- tests/run.js の suite process result、異常終了表示、完走 suite だけを対象とする PASS 集計。
- src/flow/lib/test-regression.js の detailed process result、primary cause classification、diagnostic lines。
- spec-local contract tests と各 process behavior を 1 つだけ起動する fixture。
- 既存 tests/unit/test-runner-file-filter.test.js と tests/unit/flow/final-regression.test.js の回帰確認。

## Out of Scope
- test selection、preset 解決、通常時の label summary format の変更。
- Issue #443 の flow transition、review、gate、finalize 実装。
- src/flow/lib/run-final-regression.js、artifact schema、他 board item の変更。
- 関連しない assertion fixture と test command discovery の変更。

## Constraints
- Node.js 組み込みモジュールだけを使い、外部依存を追加しない。
- ChildProcessExecutionResult と stream summary は constructor で kind、状態、field invariant を検証する専用 class とする。
- bounded-resource-usage: tests/run.js は既存 64 MiB maxBuffer、runProcessDetailed は opts.maxBuffer または既定 20 MiB を 1 回の child process ごとの上限とし、stdout/stderr の raw text をその上限を超えて復元・再実行・複製しない。
- 正常完走時の stdout/stderr 転送、exit code、parse 済み unit/integration/acceptance PASS 件数を変更しない。
- 通常 assertion failure は completed=true、non-zero exit code、返却 stdout/stderr、parse 済み PASS 件数を維持する。
- tests/run.js と src/flow/lib/test-regression.js 以外の product file を変更しない。

## Design Principles
- process result の producer が primary cause を typed kind と structured fields に確定し、consumer は stdout/stderr から再分類しない。
- 起動開始 started、正常または assertion まで完走 completed、test pass passed を別 invariant として扱う。
- timeout と max-buffer は signal より優先し、spawn-error は child が開始していない場合だけ選ぶ。
- 既存 consumer 用 started、exitCode、signal、timedOut、spawnError fields を保ち、diagnostic lines に新しい primary cause を追加する。
- 通常時の出力契約は維持し、異常終了時だけ typed diagnostic block と not completed 集計を出す。

## Overview
### Modules
- src/flow/lib/test-regression.js は ChildProcessExecutionResult と ProcessStreamSummary を所有し、async execFile callback と sync spawn result を同じ failure kind へ正規化する。
- tests/run.js は category ごとの spawnSync result を shared result model へ変換し、completed suite だけから PASS 件数を集計する。
- spec-local tests は actual child process と injected spawnSync result の両方を使い、6 kind と runner presentation を固定する。

### Data Flow
- child_process result、command argv、spawn event 到達有無を result factory が受け取り、kind、started、completed、exitCode、signal、errorCode、raw streams、stream summaries を構築する。
- runner は passed/assertion-failure の completed result だけを parsePassCount へ渡し、他の kind は category を not completed として typed diagnostics を stderr へ 1 回出す。
- final-regression は runProcessDetailed result の legacy fields で既存 artifact contract を維持し、processOutputLines の先頭に typed cause と command/stream summary を置いて raw attempt log へ伝播する。

### Decisions
- [VERIFY] tests/run.js は現状 spawnSync の stdout、stderr、status だけを集計し、error と signal を failure type として表示しない。
- [VERIFY] runProcessDetailed は maxBuffer error を spawnError として started=false にし、signal/timeout/assertion と共通の explicit kind を持たない。
- Primary cause order は timeout、max-buffer、spawn-error、signal、assertion-failure、passed とする。
- Migration parity inventory: affected command は node tests/run.js と npm test。affected internal APIs は executeFiles、runProcessDetailed、processPassed、processOutputLines。hook/config discovery は変更なし。affected artifacts は test-execute process fields、final-regression process fields、raw attempt log。side effects は stdout/stderr 転送、process exit code、category summary、raw log append。
- Migration parity mapping: normal CLI output/exit/summary は tests/run.js、legacy started/exitCode/signal/timedOut/spawnError は ChildProcessExecutionResult、typed cause と stream summary は同 result、test-execute/final artifact shape は既存 serializers、raw diagnostics は processOutputLines が所有する。削除する public behavior はない。
- ProcessStreamSummary は UTF-8 byteLength、firstNonEmptyLine、lastNonEmptyLine を持ち、空 stream は byteLength=0 と null lines を返す。

## Clarifications (Q&A)
- Q: What does started mean?
  - A: For async execFile it means the child emitted spawn. For sync results it is false only for pre-spawn errors such as ENOENT/EACCES/EPERM; timeout, max-buffer, signal, and numeric status outcomes are started=true.
- Q: What does completed mean?
  - A: It is true only when the child returned a numeric exit status and no timeout, max-buffer, spawn error, or signal cause exists. Both passed and assertion-failure are completed.
- Q: How are max-buffer error codes normalized?
  - A: ERR_CHILD_PROCESS_STDIO_MAXBUFFER from execFile and ENOBUFS from spawnSync both map to kind=max-buffer while preserving the original errorCode.
- Q: Does this change final-regression artifact schema?
  - A: No. Legacy process fields remain unchanged for artifact consumers; typed metadata is retained by runProcessDetailed and written to the existing raw attempt log through processOutputLines.

## Alternatives Considered
- Parse stdout/stderr strings in each consumer. — Rejected because sparse, assertion-like, or truncated output can hide the process cause and produces different classifications across runner and final-regression.
- Treat every non-zero status as an assertion failure. — Rejected because signal, timeout, max-buffer, and spawn failures may have null or synthetic status and did not complete a normal test run.
- Expand final-regression artifact schemas in this issue. — Rejected because src/flow/lib/run-final-regression.js and schemas are outside the locked Issue #444 product scope; existing legacy fields plus raw diagnostic log can preserve the primary cause.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-20T08:18:59.829Z
- Notes: autoApprove: gate-passed Issue #444 spec approved within locked scope

## Requirements
- R1 [must]: ChildProcessExecutionResult shall classify every outcome as exactly one of passed, assertion-failure, spawn-error, signal, timeout, or max-buffer, using precedence timeout > max-buffer > spawn-error > signal > assertion-failure > passed; its constructor shall enforce consistent started, completed, exitCode, signal, errorCode, timedOut, spawnError, command, stdout, and stderr invariants.
- R2 [must]: Every result shall expose the launched command argv, numeric exit code or null, signal name or null, spawn-event reached state, completion state, Node.js error code or null, raw stdout/stderr returned by child_process, and ProcessStreamSummary values containing UTF-8 byteLength plus first and last non-empty lines or null.
- R3 [must]: The default runner shall convert each category spawnSync outcome into ChildProcessExecutionResult, aggregate PASS counts only for completed passed or assertion-failure suites, print '<category>: not completed' instead of a numeric count for abnormal incomplete categories, print one typed diagnostic block per abnormal result, and return the first numeric non-zero exit code or 1 when no numeric failure code exists.
- R4 [must]: runProcessDetailed shall track actual spawn-event arrival and return ChildProcessExecutionResult without labeling max-buffer or signal outcomes as not-started spawn failures; processOutputLines shall place kind, command, started, completed, exitCode, signal, errorCode, timedOut, and both stream summaries before existing raw output and legacy diagnostic lines.
- R5 [must]: For passed and ordinary assertion-failure outcomes, the runner shall preserve existing stdout/stderr forwarding and parsed category PASS counts; passed shall retain exit code 0, and assertion-failure shall retain completed=true with its numeric non-zero exit code and test output.
- R6 [must]: Spec-local automated tests shall reproduce ENOENT, SIGKILL, timeout, maxBuffer overflow using ERR_CHILD_PROCESS_STDIO_MAXBUFFER or ENOBUFS, assertion failure, and happy path at least once each, assert single-log typed diagnostics and aggregation behavior, and existing runner/final-regression focused regressions shall pass.

## Acceptance Criteria
- AC1: ENOENT produces kind=spawn-error, started=false, completed=false, errorCode=ENOENT, exitCode=null, and command/stream summaries in one diagnostic block.
- AC2: A SIGKILL child produces kind=signal, started=true, completed=false, signal=SIGKILL, and cannot be classified as assertion-failure even when stdout contains assertion-like text.
- AC3: A child exceeding timeout produces kind=timeout and a child exceeding maxBuffer by at least 1 byte produces kind=max-buffer with ERR_CHILD_PROCESS_STDIO_MAXBUFFER or ENOBUFS preserved; both remain started=true and completed=false even when a kill signal is present.
- AC4: An ordinary failed assertion produces kind=assertion-failure, started=true, completed=true, its numeric non-zero exit code, raw test output, stream byte counts/edge lines, and the parsed PASS count from completed output.
- AC5: A happy-path suite produces kind=passed, exitCode=0, started/completed=true, forwards stdout/stderr exactly once, and keeps the pre-change unit/integration/acceptance summary bytes.
- AC6: Runner output for an incomplete category contains '<category>: not completed', the six required diagnostic field names, and no numeric zero count for that category; normally completed categories retain numeric counts.
- AC7: processOutputLines for ENOENT, signal, timeout, max-buffer, assertion-failure, and passed results begins with typed process metadata and includes raw stdout/stderr without rerunning the command.
- AC8: specs/323-child-process-failure-results/tests carry // spec: R<N> headers covering R1-R6, and tests/unit/test-runner-file-filter.test.js plus tests/unit/flow/final-regression.test.js pass without changes outside the locked test scope.

## Implementation Targets
- tests/run.js
- src/flow/lib/test-regression.js
- specs/323-child-process-failure-results/tests/
- tests/unit/test-runner-file-filter.test.js
- tests/unit/flow/final-regression.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Model child-process outcomes
  - Represent async and sync child-process outcomes with one invariant-enforcing typed result and deterministic diagnostic lines.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Report runner process failures
  - Use the typed process result in the default runner so incomplete suites are diagnosed and excluded from numeric PASS aggregation.
  - see `tasks/T-2.md` for full spec
