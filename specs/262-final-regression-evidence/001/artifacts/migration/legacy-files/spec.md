# Feature Specification: 262-final-regression-evidence

**Feature Branch**: `feature/262-final-regression-evidence`
**Created**: 2026-05-20
**Status**: Draft
**Input**: GitHub Issue #334

## Goal
Make final-regression evidence unambiguous by renaming the unattributed existing-failure classification, keeping result artifacts scoped to the current run, preserving every attempt log, and refusing to run project tests from the wrong worktree root.

## Background
final-regression is the flow's full project regression point after retro and before finalize. Its output currently mixes several concerns: the failureKind value `pre_existing` reads like a proven historical failure, success artifacts can still contain `previousFailureKind`, and the raw log is overwritten at `tests/.raw/final-regression.log`. The recent infra classification changes already keep silent nonzero exits and spawn errors out of `pre_existing`; this spec completes the cleanup by renaming the unattributed failure kind, separating current-run artifacts from issue-log history, preserving per-attempt raw logs, and preventing worktree flows from running full project tests against the wrong root.

## Scope
- must: Replace the final-regression public failureKind value `pre_existing` with `unattributed_existing_failure` in command data, artifacts, validation, prompts, report summaries, and tests.
- must: Silent nonzero exits, spawnError, signal, sandbox, permission, dependency, timeout, and invalid project-test failures must never be classified as `unattributed_existing_failure`.
- must: `final-regression-result.json` must describe only the current final-regression invocation and must not contain `previousFailureKind` or any past-failure field on pass or fail.
- must: Historical final-regression failures must remain available through `issue-log.json` entries that include result, failureKind, command, rawOutputPath, retryable, nextAction, and timestamp.
- must: Each final-regression invocation must write a distinct raw log under `tests/.raw/final-regression-attempt-<N>.log`, with `<N>` zero-padded to at least three digits and increasing for the spec.
- must: The latest `final-regression-result.json` and matching issue-log entry must reference the raw log path for the same attempt.
- must: In worktree mode, if the active worktree root and `ctx.root` resolve to different directories, final-regression must stop before starting the project test command and return an infra failure artifact/envelope.
- must: Failure artifacts and raw logs must expose `result` for project test pass/fail, `failureKind` for attribution, `retryable` for retry allowance, and `nextAction` for flow transition.
- should: final-regression prompt/report/durable artifact guidance must mention `unattributed_existing_failure`, attempt log paths, no pass-artifact past failureKind, and retained attempt logs.
- must: Unit and spec-local tests must cover the failureKind rename, environment failure classification boundary, previousFailureKind removal, attempt-log retention, worktree root assertion, and output field separation.

## Out of Scope
- Changing test-execute or scenario-validity artifact schemas.
- Changing when full project regression runs in the flow.
- Changing external AI agent providers or test runner dependencies.
- Changing GitHub Issue or Project workflow behavior.
- Adding a compatibility reader or alias for the old `pre_existing` failureKind.
- Migrating already-finalized historical spec artifacts.
- Publishing or releasing the package.

## Constraints
- No external dependencies; use Node.js built-ins and existing helper modules only.
- Alpha policy applies: do not keep a compatibility layer for `pre_existing`; update production code, schema validation, prompts, reports, and tests to the new value.
- Exit code contract: `sdd-forge flow run final-regression` keeps exit 0 only for project regression pass and keeps non-zero failure envelopes for project regression fail, infra failure, timeout, dependency failure, sandbox restriction, permission error, child-process EPERM, invalid project test, and root mismatch.
- Backward-compatible CLI interface: command name and user-facing arguments do not change. The public artifact value changes from `pre_existing` to `unattributed_existing_failure` because this alpha package does not preserve deprecated artifact values.
- Validate user input at entry point: this spec adds no user-facing CLI arguments. Any new internal helper inputs for attempt paths or root assertion must be constructed from validated flow state, config, and repo paths.
- No silent error swallowing: root mismatch, command discovery errors, process spawn errors, log write errors, and artifact validation errors must be surfaced through existing envelope or thrown-error paths.
- Bounded resource usage: attempt-log discovery must only scan the spec's `tests/.raw` directory for final-regression attempt file names and must not read historical raw log contents to choose the next attempt number.
- Full project test exitCode must never be rewritten to pass. A failing project test remains `result: fail`; attribution and flow action are expressed by separate fields.
- When adding structured values, follow the existing class-based pattern used by `FinalRegressionDecision`, `FinalRegressionProcess`, and `FinalRegressionArtifact` instead of ad-hoc discriminated unions.
- If `src/templates/` or generated skill templates change, run `sdd-forge upgrade` and include generated `.agents/skills/` and `.claude/skills/` diffs when they change.
- During this active worktree flow, all edits and tests must run inside the active worktree path.

## Design Principles
- Separate test execution result, failure attribution, retry policy, and flow transition into distinct fields.
- Treat `final-regression-result.json` as a current-run artifact and `issue-log.json` as historical audit storage.
- Preserve raw evidence for every final-regression attempt so later success cannot erase earlier failure evidence.
- Fail before running expensive or misleading project tests when the flow root is not the active worktree root.
- Update prompts and reports to reflect product contracts, but verify behavior through artifacts and executable tests.

## Overview
### Modules
- src/flow/lib/run-final-regression.js - owns final project regression execution, failure classification, decision mapping, raw log writing, result artifact writing, and issue-log recording.
- src/flow/lib/test-artifacts.js - validates final-regression artifact schema, allowed failureKind values, raw output path fields, and downstream test result summaries.
- src/flow/prompts/impl/final-regression.md - tells agents how to interpret failureKind and nextAction after final-regression fails.
- src/flow/commands/report.js - summarizes final-regression results in flow reports.
- tests/unit/flow/final-regression.test.js - existing unit coverage for pass artifacts, current-change failures, unattributed failures, infra failures, and repeated failures.
- src/templates/partials/flow-tracking.md and src/templates/skills/sdd-forge.flow/SKILL.md - generated guidance and durable artifact expectations when final-regression output paths change.

### Data Flow
- flow run final-regression -> assert worktree root if worktree mode -> discover project test command -> run process -> classify failure -> allocate attempt raw log path -> write raw log -> write current-run result artifact -> append issue-log entry on failure
- project test fail -> result remains fail -> failureKind records attribution or infra category -> retryable records whether one repair retry is allowed -> nextAction records flow transition
- multiple final-regression invocations -> final-regression-result.json overwritten with latest current-run artifact -> final-regression-attempt-001.log, -002.log, ... remain in tests/.raw -> issue-log points each failure entry at the matching attempt log

### Decisions
- [VERIFY] final-regression currently uses `pre_existing` as a public failureKind.
- [VERIFY] current code already separates several infra/environment failures from unattributed failures.
- [VERIFY] pass artifacts can currently retain past final-regression failure attribution.
- [VERIFY] final-regression raw output currently uses a single overwritten path.
- [VERIFY] final-regression failure history already belongs to issue-log.
- Adopt `unattributed_existing_failure` as the replacement value.
- Remove `previousFailureKind` from final-regression-result.json entirely.
- Use distinct attempt logs instead of preserving only the latest log.
- Classify worktree root mismatch as infra failure before command execution.
- [IMPACT] Final-regression command and artifact consumers must use the renamed failureKind.
- [IMPACT] Current-run result artifacts stop carrying historical failure state.
- [IMPACT] Raw output consumers move from one fixed final-regression log path to per-attempt logs.

## Clarifications (Q&A)
- Q: What does `unattributed_existing_failure` mean?
  - A: The project test failed, but the failure cannot be attributed to the changes in the current flow run. It does not mean the failure was proven to predate the branch.
- Q: Where is past failure history stored?
  - A: Past final-regression failures are stored in `issue-log.json` entries with timestamps and rawOutputPath. `final-regression-result.json` is only the latest invocation artifact.
- Q: Does a failed project test ever become a pass because the failure is unattributed?
  - A: No. `result` remains `fail`; `failureKind`, `retryable`, and `nextAction` separately explain attribution and flow handling.
- Q: What happens to the old `tests/.raw/final-regression.log` path?
  - A: New final-regression runs use attempt log paths. The old single-log path is not kept as an active compatibility output because alpha policy rejects deprecated parallel formats.
- Q: What is the worktree root assertion checking?
  - A: When the flow is in worktree mode, final-regression checks that the resolved active worktree root for the flow and the resolved execution root are the same directory before discovering or spawning the project test command.
- Q: Are new CLI arguments added?
  - A: No. `sdd-forge flow run final-regression` keeps the same invocation shape and validation surface.

## Alternatives Considered
- Keep `pre_existing` and add explanatory text. — Rejected because the machine-readable value remains ambiguous and existing prompts/reports can still make AI agents treat it as a proven historical failure.
- Keep `previousFailureKind` only on failure artifacts. — Rejected because it still mixes current-run result data with historical audit data. `issue-log.json` already owns historical failure entries.
- Keep only the latest `final-regression.log` and rely on issue-log timestamps. — Rejected because the raw evidence for earlier attempts is overwritten and cannot be inspected after retry or later pass.
- Warn on worktree root mismatch and continue project testing. — Rejected because it creates misleading full-regression evidence from a checkout different from the active flow worktree.
- Add old-value compatibility for existing artifact readers. — Rejected because the project is in alpha and explicitly avoids backward-compatibility layers for deprecated formats.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T01:45:46.440Z
- Notes: autoApprove: approved gate-passed spec for Issue #334 final-regression evidence cleanup

## Requirements
- R1 [must]: Final-regression must use `unattributed_existing_failure` instead of `pre_existing` in `FAILURE_NEXT_ACTION`, classification output, envelopes, `final-regression-result.json`, issue-log entries, schema validation, prompts, report summaries, and tests.
- R2 [must]: Final-regression classification must return infra or environment failure kinds, not `unattributed_existing_failure`, for silent nonzero output, spawnError text, process signal, sandbox text, permission errors, dependency command-not-found cases, timeouts, child-process EPERM, and invalid project-test discovery.
- R3 [must]: `final-regression-result.json` must represent only the current invocation and must not contain `previousFailureKind` or any other past-failure field on pass or fail.
- R4 [must]: Each final-regression invocation must write raw output to `specs/<spec>/tests/.raw/final-regression-attempt-<N>.log`, where `<N>` is a monotonically increasing decimal number padded to at least three digits within that spec.
- R5 [must]: The latest `final-regression-result.json` and each final-regression failure issue-log entry must set `rawOutputPath` to the attempt log path for the same invocation.
- R6 [must]: When flow state is worktree mode and the resolved active worktree root differs from the resolved `ctx.root`, final-regression must not run the project test command and must return a failure artifact/envelope with `result: "fail"`, `failureKind: "infra_failure"`, `retryable: false`, and `nextAction: "stop"`.
- R7 [must]: Failure artifacts and raw logs must keep separate entries for `result`, `failureKind`, `retryable`, and `nextAction`, where those fields respectively mean project test pass/fail, failure attribution, retry allowance, and flow transition.
- R8 [should]: Final-regression prompt/report/durable artifact guidance must mention `unattributed_existing_failure`, attempt log paths, absence of past failureKind in pass artifacts, and durable retention of `tests/.raw/final-regression-attempt-*.log`.
- R9 [must]: Spec-local tests under `specs/262-final-regression-evidence/tests/` must cover R1 through R7 with `// spec: R<N>` headers, and shared unit tests must cover the production failureKind rename, previousFailureKind removal, attempt log allocation, and worktree root assertion.

## Acceptance Criteria
- Given a project-test failure that cannot be attributed to current changes, `flow run final-regression` returns non-zero with `failureKind: "unattributed_existing_failure"`, `retryable: false`, and `nextAction: "user-confirmation"`.
- Given silent nonzero output, spawnError text, process signal, sandbox text, permission error, dependency command-not-found text, timeout, child-process EPERM, or invalid project-test discovery, the returned failureKind is not `unattributed_existing_failure`.
- Given final-regression passes after an earlier final-regression failure exists in issue-log, `final-regression-result.json` contains `result: "pass"`, `failureKind: null`, and no `previousFailureKind` field.
- Given final-regression fails after an earlier final-regression failure exists in issue-log, the latest `final-regression-result.json` contains the current failure fields and no `previousFailureKind` field.
- Given final-regression runs twice for the same spec, both `tests/.raw/final-regression-attempt-001.log` and `tests/.raw/final-regression-attempt-002.log` exist after the second run.
- Given the second run is the latest run, `final-regression-result.json.rawOutputPath` points to `tests/.raw/final-regression-attempt-002.log`.
- Given a final-regression failure is recorded in issue-log, that issue-log entry's `rawOutputPath` points to the same attempt log path as the result artifact from that invocation.
- Given worktree mode flow state has an active worktree root different from `ctx.root`, final-regression stops before `runProcessDetailed()` is called and writes a failure artifact/envelope with `failureKind: "infra_failure"` and `nextAction: "stop"`.
- Given any failure artifact, JSON has distinct `result`, `failureKind`, `retryable`, and `nextAction` fields and the attempt raw log contains corresponding lines for the same invocation.
- Given report or prompt text references final-regression unattributed failures, it uses `unattributed_existing_failure` and does not mention `pre_existing` as an active failureKind.
- Given durable artifact path lists include final-regression raw output, they retain attempt log paths or a pattern covering `tests/.raw/final-regression-attempt-*.log`.
- Given `src/templates/` or generated skill templates changed, `sdd-forge upgrade` has been run and generated skill diffs are included or the command reports no generated file changes.

## Implementation Targets
- src/flow/lib/run-final-regression.js
- src/flow/lib/test-artifacts.js
- src/flow/schemas/next-action/final-regression.schema.json
- src/flow/prompts/impl/final-regression.md
- src/flow/commands/report.js
- src/templates/partials/flow-tracking.md
- src/templates/skills/sdd-forge.flow/SKILL.md
- tests/unit/flow/final-regression.test.js
- specs/262-final-regression-evidence/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Rename failure attribution
  - Replace the ambiguous `pre_existing` final-regression failureKind with `unattributed_existing_failure` across production outputs, validators, reports, prompts, and shared tests.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Separate current artifact
  - Make `final-regression-result.json` represent only the latest invocation and keep historical failure data in issue-log entries.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve attempt logs
  - Write a distinct final-regression raw log for each invocation and point result artifacts and issue-log entries at the matching attempt log.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Assert worktree root
  - Prevent final-regression from running project tests when the execution root is not the active worktree root for a worktree flow.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Update guidance outputs
  - Align prompts, report summaries, and durable artifact guidance with the renamed failureKind and attempt-log contract.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add spec evidence
  - Add spec-local tests for the new final-regression behavior and connect them to the requirements with `// spec: R<N>` headers.
  - see `tasks/T-6.md` for full spec
