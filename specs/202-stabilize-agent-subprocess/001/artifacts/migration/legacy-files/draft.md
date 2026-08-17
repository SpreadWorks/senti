---
issue: 195
title: stabilize-agent-subprocess
---

**開発種別:** バグ修正

**目的:** agent サブプロセス呼び出しが正常系でも非ゼロ終了する問題を解消し、agent infra 起因の失敗と flow ロジックの失敗を切り分ける。

## Requirements (priority order)

**P1 (blocker):**
- **R1**: When an agent subprocess invocation encounters a stdin-pipe write error (EPIPE / ENOTCONN) during the stdin-fallback code path, the agent layer shall capture the error without crashing the Node process and shall surface it to the caller as a retryable failure.
- **R2**: When the docs text command encounters per-file errors during a run, the docs text module shall return a result object describing failures to its caller and shall not mutate the process exit code from inside the function. The enclosing CLI dispatcher shall set the process exit code based on the returned result.

**P2 (core):**
- **R3**: When the retry count is not explicitly configured by the user, the effective retry count for agent calls shall default to `2` (previously `0`). The inter-attempt delay shall follow exponential backoff starting at 3000 ms and doubling per attempt (3000 ms, 6000 ms), so no attempt uses a constant 3000 ms delay.
- **R4**: When an agent call returns an empty response or fails with a transient error (stdin write error, timeout, non-zero exit without signal kill), the agent layer shall treat the failure as retryable up to the configured retry count.

**P3 (support):**
- **R5**: When an acceptance test subprocess terminates due to agent infrastructure failure (empty response, stdin error, timeout, non-zero exit), the acceptance test harness shall classify the outcome separately from test logic failures in its report output.
- **R6**: When tests exercise agent-related code paths, the test infrastructure shall provide a deterministic stub mechanism for agent invocations so that empty-response, stdin-write-failure, timeout, and non-zero-exit paths can be reproduced without running real agent CLIs.

## Impact on Existing Features

- **Agent invocation layer (shared by docs enrich / text / flow review / flow draft)**: New retry default value and error categorization affect every caller of agent calls. Callers that already pass retry count explicitly are unaffected.
- **Docs text pipeline**: Removing in-function process-exit-code mutation changes the internal contract between the docs text module and its CLI entry; user-visible `sdd-forge docs text` exit behavior is preserved via the CLI dispatcher.
- **Acceptance test harness**: The harness no longer needs to save/restore process exit code for docs text errors, simplifying the pipeline code.
- **External callers of the agent service** (none outside the package today): unaffected.
- No CLI subcommand names, option names, or user-visible output formats change.

## Backward Compatibility Plan

Alpha policy (per project CLAUDE.md) permits breaking internal behavior without compatibility shims. The following behavioral changes apply from this spec onward:

1. Retry count default changes from zero to a positive value. Users who prefer "fail fast, no retry" must opt out explicitly via configuration.
2. The docs text module return shape gains clarified failure semantics; no public CLI contract change.
3. Process exit code is no longer set from within the docs text module. The `sdd-forge docs text` CLI entry continues to exit non-zero on failure.

No deprecated path is retained. Release notes (CHANGELOG) will document the default retry count change.

## Q&A

### Q1. 意図確認

**AI recommendation:** Issue #195 の 3 つの候補アプローチ（stdin ハンドリング堅牢化、empty response / batch 失敗の retryable 化、acceptance test での agent 失敗分離）を包括するスコープで進めることを推奨。
**Basis:** issue body (#195); existing agent invocation structure observed during exploration.
**Mode:** Decision.
**User decision:** [1] はい

### Q2. スコープ

**AI recommendation:** (a)+(b) をスコープ、(c) は別 spec。
**Basis:** Guardrail "Single Responsibility" and "Prioritize Requirements"; agent layer already centralizes retry and stdin-fallback behavior.
**Mode:** Decision.
**User decision:** [2] (a)(b)(c) 全部含める

### Q3. retry / 終了コード方針

**AI recommendation:** retry をデフォルト有効化し backoff を段階的に伸ばす。終了コード伝播の根本原因を調査して修正。
**Basis:** Existing retry structure already supports the feature but is opt-in; guardrail "Complete Context" — opt-in retry is not effectively protective when failures appear in normal scenarios.
**Mode:** Decision.
**User decision:** [1] はい

### Q4. テスト戦略

**AI recommendation:** 既存の dry-run 用シームを拡張した deterministic stub を追加し、failure モード別に unit test を書く。
**Basis:** An internal dry-run seam already exists; project rule "テストを通すためにテストコードを修正してはならない" — stubs must reproduce failure scenarios rather than soften assertions.
**Mode:** Decision.
**User decision:** [1] はい

## Approval

- [x] User approved this draft
- Date: 2026-04-20
