# Feature Specification: 267-runtime-log-standardization

**Feature Branch**: `feature/267-runtime-log-standardization`
**Created**: 2026-05-25
**Status**: Draft
**Input**: GitHub Issue #342

## Goal
Standardize automatic stdout/stderr runtime logging for every sdd-forge flow command so agents can diagnose flow failures through flow get runtime-log instead of shell redirects or --log-file.

## Background
The current flow runtime log is a flow run only facility. It creates per-command files and captures stderr by replacing process.stderr.write, while stdout envelopes and raw stdout are not saved. Commands such as flow prepare, flow resume, flow get, flow set, and flow report show therefore leave agents without a uniform way to inspect command output after a failure. Issue #342 narrows the change to the flow command family and defines a single per-flow append log plus a retrieval command as the replacement for shell redirects and --log-file.

## Scope
- Capture stdout and stderr for sdd-forge flow prepare, resume, get except get runtime-log, set, run, and report show.
- Append all captured output for a flow to .tmp/logs/<flowId>.log; use .tmp/logs/no-flow.log when no active flow exists.
- Write each command execution as a bounded runtime log block with runId, sequence, attempt, command, startedAt, endedAt, and exitCode.
- Prefix captured output lines with [stdout] or [stderr] without changing the existing visible stdout/stderr behavior.
- Persist runtimeLog metadata on workflow steps only for step-associated commands.
- Add sdd-forge flow get runtime-log with raw text output by default and JSON envelope output with --format json.
- Remove --log-file from flow run argument contracts, help text, generated skills, and tests.
- Update src/skills and src/AGENTS.md so agents use automatic runtime logs and flow get runtime-log for flow command diagnosis.
- Run sdd-forge upgrade after src/skills changes.

## Out of Scope
- Changing logging behavior for docs, check, metrics, spec, setup, upgrade, experimental workflow, or non-flow commands.
- Replacing the existing JSONL Logger event schema.
- Persisting runtime log file paths in flow.json.
- Storing runtime logs under .sdd-forge/.
- Adding external logging dependencies.
- Changing Git command JSONL logging semantics.

## Constraints
- Use only Node.js built-in modules.
- Runtime log files shall live under the repository root .tmp/logs and shall not be stored under .sdd-forge or under paths.agentWorkDir/logs.
- flow.json shall store runtimeLog metadata values but not runtime log file paths or file names.
- stdout shall remain compatible with existing machine-readable JSON envelope and raw-output contracts; logging shall tee output rather than replacing it.
- Runtime log writes shall keep the existing bounded resource behavior by enforcing a maximum captured byte count of 5 MiB per command block.
- User-facing arguments for flow get runtime-log: --sequence must be a positive integer when present; --run-id must be either a non-empty runId or <runId>#<positive-sequence>; --format accepts only json when present. Invalid values return a non-zero exit code and an envelope with code INVALID_ARG_VALUE or ARGS_ERROR.
- Migration plan for backward-compatible-cli-interface: remove --log-file during alpha, update help text, source skills, generated skills, tests, and src/AGENTS.md to point users to automatic runtime logs plus flow get runtime-log.
- Source changes under src/skills require sdd-forge upgrade so .agents/skills and .claude/skills are refreshed.

## Design Principles
- Centralize runtime log tee behavior at the flow dispatch boundary so every flow command uses one capture path.
- Keep runtime logs human-readable and retrieval-oriented; do not introduce a second machine-readable command result contract in log files.
- Represent meaningful runtime log values with classes that own invariant checks and serialization.
- Keep step metadata small and durable by storing identifiers and timing fields only, not paths.
- Treat --log-file removal as an alpha cleanup with an explicit replacement workflow instead of a compatibility alias.

## Overview
### Modules
- src/flow.js routes every flow group into src/lib/dispatcher.js and currently enables runtime logging only for group === "run".
- src/lib/dispatcher.js owns parsed input, stdout/stderr writers, envelope emission, runtime log setup, and command lifecycle exit handling.
- src/flow/registry.js declares flow command argument contracts, help text, and step post hooks that can persist step-associated runtimeLog metadata.
- src/flow/lib/run-report-show.js writes raw report text to process.stdout; runtime logging must tee this raw stdout without changing report output.
- src/skills and generated skill directories contain agent-facing flow instructions that must stop mentioning --log-file for flow diagnostics.

### Data Flow
- flow argv -> flow.js dispatch -> dispatcher runtime log block opens unless command is flow get runtime-log -> command writes stdout/stderr normally -> runtime log records prefixed output -> block closes with exitCode.
- flowId resolves from active flow spec id when available; otherwise no-flow. sequence is derived from existing start blocks in .tmp/logs/<flowId>.log.
- Step-associated command result -> registry/flow manager stores runtimeLog metadata on the target step; non-step commands leave flow.json runtimeLog metadata unchanged.
- flow get runtime-log resolves runId/sequence to a block in .tmp/logs/<flowId>.log or .tmp/logs/no-flow.log and returns raw text or an envelope with text and metadata.

### Decisions
- [VERIFY] Runtime logging is currently limited to flow run.
- [VERIFY] Dispatcher is the correct tee point for stdout/stderr.
- [VERIFY] Existing registry exposes --log-file through FLOW_RUN_RUNTIME_OPTIONS.
- [VERIFY] Raw stdout commands exist in flow.
- [VERIFY] --log-file removal has a replacement path.
- [CORRECTION] Draft gate retry was manually reset after CLI recovery rejected gate draft.
- [VERIFY] Impact on existing features is intentional and bounded to flow command logging, retrieval, help, and agent guidance.

## Clarifications (Q&A)
- Q: Which commands are step-associated for runtimeLog metadata?
  - A: flow prepare maps to prepare-spec; flow run gate/review/scenario-validity/test-execute/test-result-review/retro/final-regression/finalize-commit/finalize-merge/finalize-sync map to their workflow step; flow set step maps to the specified target step. finalize-cleanup is intentionally excluded from step runtimeLog metadata because it commits and removes active flow state before dispatcher finalization.
- Q: Which commands are non-step for this feature?
  - A: flow get status/context/guardrail/prompt/issue/next-action/qa-count/resolve-context/check/runtime-log, flow set note/request/issue/metric/issue-log/summary/req/files/broad/auto/init/retry, flow resume, flow report show, and flow run finalize-cleanup do not receive runtimeLog metadata.
- Q: Does flow.json store the runtime log file path?
  - A: No. flow.json stores only runtimeLog metadata identifiers and timing fields for step-associated commands.
- Q: What is the exit code contract for flow get runtime-log?
  - A: It exits 0 when the requested block is found and printed. It exits non-zero with an error envelope for invalid arguments, missing log files, or missing sequence blocks.
- Q: What replaces --log-file?
  - A: Automatic per-flow runtime logs plus sdd-forge flow get runtime-log. The migration is reflected in help, skills, tests, and AGENTS guidance.
- Q: How does flow get runtime-log avoid selecting itself?
  - A: It is exempt from automatic runtime logging and selects the latest non-runtime-log block from the active flow log, or from no-flow.log when no active flow exists.
- Q: How are block markers parsed?
  - A: Start markers use the prefix ===== start and end markers use the prefix ===== end; sequence assignment and retrieval parse only those marker lines.

## Alternatives Considered
- Keep --log-file as a compatibility alias. — Rejected because Issue #342 explicitly consolidates logging into automatic runtime logs and alpha policy avoids retaining deprecated interfaces.
- Continue storing one runtime log file per command. — Rejected because Issue #342 requires a single append log per flow so sequence-based lookup can retrieve command blocks without storing paths in flow.json.
- Only capture stderr as the current RuntimeLog does. — Rejected because the requested diagnostic surface includes stdout envelopes and raw stdout output.
- Store the runtime log path on each step. — Rejected because the spec requires avoiding path persistence in flow.json and deriving the log file from flowId.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-25T02:42:00.011Z
- Notes: autoApprove selected [1] after spec gate passed for Issue #342

## Requirements
- R1 [must]: Every sdd-forge flow command group except flow get runtime-log shall open a runtime log block before command execution and close it after success or failure.
- R2 [must]: Runtime log blocks shall be appended to .tmp/logs/<flowId>.log, with flowId derived from the active flow spec id or no-flow when no active flow exists.
- R3 [must]: The sequence value shall be assigned by counting existing start blocks in the target log file before appending the new block.
- R4 [must]: Each runtime log block shall include start and end records containing runId, sequence, attempt, command, startedAt, endedAt, and exitCode.
- R5 [must]: stdout and stderr writes shall be copied into the same block in observed write order, with each emitted line prefixed [stdout] or [stderr], while preserving the original stdout/stderr streams.
- R6 [must]: Step-associated commands shall persist runtimeLog metadata on their workflow step without storing file names or paths, except finalize-cleanup which is excluded because it commits and removes flow state before dispatcher finalization.
- R7 [must]: Non-step flow commands shall not add runtimeLog metadata to flow.json; on failure they shall expose runtimeLog.runId and runtimeLog.sequence in the envelope or stderr.
- R8 [must]: sdd-forge flow get runtime-log shall return the selected block as raw stdout by default and shall return an envelope containing text, runId, sequence, command, startedAt, endedAt, and exitCode when --format json is supplied.
- R9 [must]: flow get runtime-log shall select the latest non-runtime-log block for the active flow by default, select .tmp/logs/no-flow.log when no active flow exists, support --sequence <n>, and support --run-id <runId>#<sequence>.
- R10 [must]: --log-file shall be removed from flow run argument parsing, command help, generated skills, source skills, and tests.
- R11 [must]: Agent-facing flow instructions in src/skills and src/AGENTS.md shall tell agents to use automatic runtime logs and flow get runtime-log for flow command failure diagnosis.
- R12 [must]: Tests shall cover stdout/stderr capture for prepare, get, set, run, and report show paths, metadata persistence for step-associated commands, non-step failure runtimeLog exposure, runtime-log retrieval, and --log-file removal.
- R13 [must]: flow report show failures shall return or throw through the dispatcher instead of calling process.exit directly, so runtime log blocks close with endedAt and exitCode.

## Acceptance Criteria
- sdd-forge flow prepare, flow resume, flow get status, flow set note, flow run review, and flow report show each append stdout/stderr output to .tmp/logs/<flowId>.log or .tmp/logs/no-flow.log.
- sdd-forge flow get runtime-log does not create a new runtime log block for itself.
- Captured stdout and stderr lines in a block are prefixed [stdout] and [stderr] without corrupting the command's normal stdout or stderr.
- Each execution block records runId, sequence, attempt, command, startedAt, endedAt, and exitCode.
- Repeated execution appends a new sequence block to the same per-flow log file.
- Step-associated commands persist runtimeLog metadata on the target step and do not store a log path.
- Non-step commands do not add runtimeLog metadata to flow.json.
- A failed non-step command exposes runtimeLog.runId and runtimeLog.sequence in its failure envelope or stderr.
- sdd-forge flow get runtime-log prints raw log block text by default.
- sdd-forge flow get runtime-log --format json returns a JSON envelope with block text and metadata.
- sdd-forge flow get runtime-log --sequence <n> and --run-id <runId>#<sequence> select the requested block or return a non-zero error envelope when absent.
- When no active flow exists, sdd-forge flow get runtime-log reads .tmp/logs/no-flow.log by default.
- flow report show missing-pointer and missing-report failures produce closed runtime log blocks with exitCode recorded.
- --log-file no longer appears in flow run registry options, flow help text, source skills, generated skills, or tests.
- src/AGENTS.md documents that flow commands save runtime logs automatically and that explicit log output is only needed for non-flow commands or special cases.
- sdd-forge upgrade updates generated skill files after source skill edits.

## Implementation Targets
- src/flow.js
- src/lib/dispatcher.js
- src/flow/registry.js
- src/flow/lib/get-runtime-log.js
- src/lib/flow-manager.js
- src/skills
- src/AGENTS.md
- .agents/skills
- .claude/skills
- tests/unit/lib
- tests/unit/flow
- tests/e2e

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Build runtime log blocks
  - Create the bounded per-flow runtime log block model and stdout/stderr tee behavior used by all flow commands.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Integrate flow commands
  - Enable automatic runtime logging for prepare, resume, get, set, run, and report show, and persist step runtimeLog metadata only where a workflow step owns the command.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add log retrieval command
  - Add sdd-forge flow get runtime-log so agents can retrieve the latest or selected runtime log block without reading files directly.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Remove log-file guidance
  - Remove --log-file from flow run contracts and update agent-facing instructions to use automatic runtime logs and flow get runtime-log.
  - see `tasks/T-4.md` for full spec
