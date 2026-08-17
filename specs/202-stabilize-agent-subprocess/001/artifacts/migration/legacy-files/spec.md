# Feature Specification: 202-stabilize-agent-subprocess

**Feature Branch**: `feature/202-stabilize-agent-subprocess`
**Created**: 2026-04-20
**Status**: Draft
**Input**: GitHub Issue #195 — stabilize agent subprocess invocation

## Goal

Stabilize agent subprocess invocation so that normal-path `sdd-forge flow run review` and acceptance test subprocesses no longer exit with non-zero status due to agent infrastructure issues (stdin write errors, empty responses, soft batch failures). Separate agent-infra failures from flow logic failures, so a single agent flake does not block review or cause acceptance tests to fail.

## Scope

- Agent invocation layer: stdin-fallback error handling, retry defaulting, exponential backoff for transient failures.
- Docs text command: remove in-function `process.exitCode` mutation; move exit-code responsibility to CLI dispatcher.
- Acceptance test harness: classify agent-infra termination separately from test logic failures; remove the fragile `process.exitCode` save/restore workaround once `runText` no longer mutates it.
- Test infrastructure: deterministic agent stub for empty-response / stdin-failure / timeout / non-zero-exit.

## Out of Scope

- Redesign of the provider/registry abstraction.
- Changes to the `claude` / `codex` CLI invocation contract beyond what is required to keep current profiles working.
- New user-facing CLI subcommands or options.
- Rewriting the review or enrich command workflows themselves (only the agent call path is touched).

## Clarifications (Q&A)

- Q: Should candidate approaches (a) stdin hardening, (b) retryable empty response, (c) acceptance-test failure categorization all land in one spec?
  - A: Yes — all three (confirmed in draft Q2).
- Q: Retry opt-in vs default-on?
  - A: Default-on with retryCount = 2 and exponential backoff 3000 ms → 6000 ms (confirmed in draft Q3).
- Q: Do we change the `sdd-forge docs text` user-visible exit behavior?
  - A: No. The command continues to exit non-zero on failure; only the internal ownership of exit-code setting changes (confirmed in draft Q3).

## Alternatives Considered

1. **Keep retry opt-in, only add exponential backoff.** Rejected: Issue #195 proves the current opt-in is not effectively protective — failures appear in default-configured projects.
2. **Leave `process.exitCode` mutation inside `runText` and harden the acceptance test harness save/restore.** Rejected: treating a symptom, not the cause; the `runText` side-effect couples library code to process-global state.
3. **Classify acceptance-test agent failures purely in test assertions without fixing the invocation layer.** Rejected: per guardrail "No Silent Error Swallowing," masking agent flakiness in tests while leaving `sdd-forge flow run review` broken in normal flows violates the real goal.

## Why This Approach

- The agent invocation layer already centralizes retry and stdin-fallback; hardening there is the smallest change with the widest impact.
- Removing `process.exitCode` mutation from library code aligns with the project rule "深いモジュールを作る, 薄いラッパーより" (`CLAUDE.md`): the library returns data, the CLI entry decides exit status.
- A deterministic stub unlocks unit tests for failure paths that are otherwise only observable in end-to-end runs.

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: autoApprove mode; gate-spec PASS confirmed.

## Requirements

**P1 (blocker):**

- **R1**: When the agent invocation layer routes a prompt through its stdin-fallback path and the underlying write fails with EPIPE or ENOTCONN, the layer shall capture the error without terminating the Node process and shall return it to the caller as a retryable failure.
- **R2**: When the docs text module finishes a run with one or more per-file errors, the core `runText` function shall return a result object that lists the failed files and shall not mutate `process.exitCode` from inside that function. The thin CLI-adjacent command wrapper (`DocsTextCommand.execute`) shall throw an Error carrying `exitCode = 1` and a distinguishing marker (e.g., `agentError = true`), so the CLI dispatcher sets the exit code and test harnesses can classify the failure.

**P2 (core):**

- **R3**: When the user has not set `config.agent.retryCount`, the library-level default retry count shall be `2` (previously `0`). When `config.agent.retryCount` is set, that value shall override the library default. When the agent layer waits between retry attempts, the delay shall follow exponential backoff starting at 3000 ms and doubling per attempt (3000 ms, 6000 ms, ...). The absolute upper bound of `MAX_RETRY = 5` remains unchanged.
- **R4**: When an agent call returns an empty response, or terminates with a stdin-write error, or exits with a non-zero code without a kill signal, the agent layer shall treat the outcome as a retryable failure and shall attempt retry up to the configured retry count before surfacing the final error to the caller. When a call is killed by a timeout (SIGTERM from the agent layer's own timer), the layer shall treat the outcome as terminal and shall surface the error without retry, consistent with the existing kill-signal handling.

**P3 (support):**

- **R5**: When the acceptance pipeline harness observes a thrown error from a step whose cause is agent-infra flakiness (empty response, stdin error, timeout, non-zero exit, or an error carrying `agentError = true`), it shall record the step status as `agent-error` (distinct from `error`, which denotes a test-logic failure) and continue the pipeline for the text step rather than aborting. Because `runText` no longer mutates `process.exitCode` (R2), the harness no longer needs the prior `prevExitCode` save/restore workaround.
- **R6**: When unit or integration tests exercise the agent call path, the test infrastructure shall provide a stub agent that can be configured per-call to return empty response, simulate stdin write failure, simulate timeout, or simulate non-zero exit without spawning a real CLI process.

## Test Strategy

- **Unit tests** (`tests/unit/lib/agent.test.js`, new or extended): exercise each failure mode via the stub — empty response (→ retry then error), stdin write failure (→ retry then error), timeout (→ no retry; timeout is terminal), non-zero exit (→ retry then error). Verify retry count defaults to 2 and delays follow exponential backoff (3000 ms, 6000 ms).
- **Unit tests for docs text return contract**: call `runText` with a failing fixture and assert the returned object contains the expected `errors` array, and assert `process.exitCode` is unchanged.
- **Integration test for CLI exit code**: invoke the `sdd-forge docs text` entry (via dispatcher or programmatic entry) with a fixture that produces errors, and assert it exits non-zero via the dispatcher.
- **Acceptance harness test**: inject the stub agent into `pipeline.js`, force an `agent-error`, and assert `runPipeline` returns a step with `status: "agent-error"` and leaves `process.exitCode` untouched.
- **Spec-local tests** (`specs/202-stabilize-agent-subprocess/tests/`): regression scenarios for Case 1 (stdin error during fallback) and Case 2 (text batch failure propagation) drawn from the issue's evidence, kept as history.
- Logs from any test run shall be written to the resolved work directory (`SDD_FORGE_WORK_DIR` / `config.agent.workDir` / `.tmp`) following project rules.

## Acceptance Criteria

- `sdd-forge flow run review` on the 191-preset-di-container reproduction case returns exit code 0 when the agent responds, and surfaces retryable failures rather than crashing with `Reading prompt from stdin`.
- `node tests/run.js --preset base` or equivalent acceptance runs for `tests/e2e/acceptance/report.test.js` exit with code 0 even when agent calls produce soft failures inside `runText` or `enrich`.
- Unit tests exercising each configured failure mode (empty / stdin / timeout / non-zero exit) pass deterministically without spawning real agent CLIs.
- Default-config project (no explicit `retryCount`) observes at least one retry on transient agent failures.
- No CLI subcommand name, option name, or help text changes in user-facing output.

## Backward Compatibility

Per project alpha policy (`CLAUDE.md`), no compatibility shims are added:

1. Library-level retry default changes from `0` to `2`. Consumers who want "fail fast" must set `config.agent.retryCount: 0` or pass `retryCount: 0` per call.
2. `runText` no longer mutates `process.exitCode`; the mutation lives in `DocsTextCommand.execute` which now throws a carrier Error with `exitCode = 1` and `agentError = true`. Library callers that import `runText` directly must read the returned `errors` array; those invoking through `DocsTextCommand` must handle the thrown error.
3. Acceptance pipeline harness recognizes `agent-error` as a step status distinct from `error`. Consumers of the JSON report must accept the expanded enum.

CHANGELOG shall document the retry default change, the exponential backoff introduction, and the new `agent-error` acceptance-step status.

## Open Questions

- [x] Do we want a config knob (e.g. `config.agent.retryBackoffFactor`) to tune the exponential factor, or keep it hard-coded to 2? — Resolved: hard-coded to 2 for simplicity; revisit only if a consumer asks.
