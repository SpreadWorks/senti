# Feature Specification: 258-flow-runtime-log-options

**Feature Branch**: `feature/258-flow-runtime-log-options`
**Created**: 2026-05-16
**Status**: Draft
**Input**: GitHub Issue #326

## Goal
Add first-class flow runtime options for agent work directory selection and human-readable execution logs, replacing env SDD_FORGE_WORK_DIR and shell redirect guidance for flow run commands while keeping JSON envelopes on stdout.

## Background
Codex approval prefix rules work best when commands begin with stable argv prefixes such as sdd-forge flow run gate. Current operational guidance causes outer agents to prepend env SDD_FORGE_WORK_DIR=... and append shell redirects like > .tmp/file 2>&1, which prevents stable prefix matching and can fail before the command starts if the target directory does not exist. The existing work directory override is also broader than its name implies: it affects agent temp files, schema files, dumps, and log base paths rather than the target flow worktree.

## Scope
- Add --agent-work-dir for flow run commands as the per-invocation agent/tmp/log base directory override.
- Add --log-file for flow run commands and default runtime log creation when the option is omitted.
- Write default runtime logs under <agentWorkDir>/logs/<flowId>/ for active flows and <agentWorkDir>/logs/no-flow/ when no active flow exists.
- Preserve final JSON envelope output on stdout and keep runtime logs human-readable.
- Remove SDD_FORGE_WORK_DIR as the work directory override mechanism.
- Update source templates, generated skills, docs, and tests so outer agents use --agent-work-dir and --log-file instead of env prefixes or shell redirects.

## Out of Scope
- Changing SDD_FORGE_WORK_ROOT or SDD_FORGE_SOURCE_ROOT semantics.
- Changing SDD_FORGE_PROFILE provider-selection semantics.
- Replacing the existing structured JSONL Logger format.
- Changing GitHub workflow board behavior.
- Adding external logging dependencies.

## Constraints
- Use only Node.js built-in modules.
- Do not keep SDD_FORGE_WORK_DIR compatibility behavior; alpha policy permits removal.
- The final JSON envelope must remain machine-readable on stdout.
- Runtime logs must not require shell redirection.
- Template changes under src/templates must be propagated with sdd-forge upgrade.
- User-facing arguments: --agent-work-dir requires a non-empty path value; --log-file requires a non-empty path value; missing values or unknown placement shall return an ARGS_ERROR envelope with a non-zero exit code.
- Migration plan: remove SDD_FORGE_WORK_DIR from runtime behavior, update generated instructions and docs in the same change, and keep config.agent.workDir as the persistent configuration path for users who need a default work directory.

## Design Principles
- Parse per-invocation path overrides early enough that container paths and logger paths are built once from the effective values.
- Keep public option scope aligned with Issue #326: flow run commands expose the new options.
- Keep explicit --log-file path behavior close to current shell redirect behavior by resolving relative paths from the execution root.
- Keep runtime logs human-readable and separate from the stdout envelope contract.

## Overview
### Modules
- src/sdd-forge.js initializes the shared container before namespace dispatch, so it must pre-scan raw args for flow run --agent-work-dir without treating it as a top-level public command for unrelated namespaces.
- src/lib/config.js owns work directory resolution and must stop reading SDD_FORGE_WORK_DIR.
- src/lib/container.js constructs paths.agentWorkDir and logDir once, using the early override when present.
- src/lib/dispatcher.js owns command stdout/stderr emission, envelopes, hooks, and error paths; it is the central integration point for runtime log tee behavior.
- src/flow/registry.js declares flow run command argument contracts and help text.
- src/templates/partials/core-principle.md and src/templates/skills/sdd-forge.flow/SKILL.md generate the operational instructions outer agents read.

### Data Flow
- CLI raw args -> early flow run option scan -> initContainer({ agentWorkDirOverride }) -> paths.agentWorkDir/logDir -> dispatcher input -> command execution and runtime log writes.
- When --log-file is omitted, dispatcher derives log path from active flow spec id and command action/phase; otherwise it resolves the explicit path from the execution root.
- Command envelope JSON continues to stdout; stderr-equivalent diagnostics and progress are also copied to the runtime log.

### Decisions
- [VERIFY] Work directory override currently comes from SDD_FORGE_WORK_DIR in resolveWorkDir.
- [VERIFY] Container paths are created before dispatcher-level argument parsing.
- [VERIFY] Dispatcher owns envelope stdout and stderr/error emission.
- [VERIFY] Draft q1 resolved explicit relative --log-file paths from execution root.
- [VERIFY] Draft q2 resolved public scope as flow run, with implementation allowed to pre-scan raw args for container initialization.
- [VERIFY] Draft q3 resolved runtime logs as human-readable only.
- [CORRECTION] Main branch fix f332eb90 was applied before spec writing.

## Clarifications (Q&A)
- Q: How are explicit relative --log-file paths resolved?
  - A: Resolve them from the execution root, matching current shell redirect behavior.
- Q: Is --agent-work-dir global or flow run scoped?
  - A: The public option is flow run scoped. The implementation may pre-scan raw argv before initContainer so container paths can use the value.
- Q: Does the runtime log duplicate the final JSON envelope?
  - A: No. stdout remains the authoritative machine-readable envelope channel.
- Q: What replaces SDD_FORGE_WORK_DIR for persistent defaults?
  - A: Use config.agent.workDir for persistent defaults and --agent-work-dir for per-invocation overrides.

## Alternatives Considered
- Keep SDD_FORGE_WORK_DIR and only document better approval prefixes. — Rejected because env prefixes keep the command starting with env and do not solve approval prefix matching.
- Only add --log-file and keep env SDD_FORGE_WORK_DIR. — Rejected because shell redirects are only one of the two approval-prefix problems; env SDD_FORGE_WORK_DIR still changes the command prefix.
- Write final envelopes into runtime logs as well. — Rejected because mixing human-readable logs and machine-readable envelopes creates a second contract and risks parser confusion.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-16T14:19:42.073Z
- Notes: autoApprove selected [1] after spec gate passed; manual spec review fallback recorded due provider unavailability

## Requirements
- R1 [must]: flow run commands shall accept --agent-work-dir <path> and use it as the per-invocation agent/tmp/log base directory before container paths are constructed.
- R2 [must]: SDD_FORGE_WORK_DIR shall no longer affect resolveWorkDir, container paths, agent temp files, dumps, or log directories.
- R3 [must]: flow run commands shall accept --log-file <path>; explicit relative paths shall resolve from the execution root.
- R4 [must]: when --log-file is omitted, flow run commands shall create a default runtime log at <agentWorkDir>/logs/<flowId>/<action>-<phase>-<timestamp>.log for active flows and <agentWorkDir>/logs/no-flow/<command>-<timestamp>.log when no active flow exists.
- R5 [must]: final JSON envelopes shall continue to be emitted on stdout without human-readable runtime log text mixed into the envelope stream.
- R6 [must]: runtime logs shall capture human-readable progress, warnings, stderr-equivalent diagnostics, and relevant AI invocation/log pointers, but shall not include a duplicate final JSON envelope as a machine contract.
- R7 [must]: source templates, generated skills, and user-facing docs shall replace SDD_FORGE_WORK_DIR and shell redirect examples with --agent-work-dir and --log-file examples.
- R8 [must]: tests shall cover early --agent-work-dir parsing, SDD_FORGE_WORK_DIR removal, explicit and default --log-file path behavior, stdout envelope preservation, and instruction updates.
- R9 [must]: invalid or missing --agent-work-dir and --log-file option values shall fail at the CLI entry/dispatch boundary with a non-zero exit code and a JSON error envelope.

## Acceptance Criteria
- Running sdd-forge flow run gate --phase draft --agent-work-dir .tmp --log-file .tmp/gate.log starts with sdd-forge, writes a human-readable log file, and still prints one JSON envelope to stdout.
- Setting SDD_FORGE_WORK_DIR without --agent-work-dir does not change resolveWorkDir output.
- Omitting --log-file creates a log under <agentWorkDir>/logs/<flowId>/ for an active flow.
- A no-flow flow run command that reaches dispatch creates a log under <agentWorkDir>/logs/no-flow/.
- Generated .agents and .claude flow skills no longer instruct agents to use env SDD_FORGE_WORK_DIR or shell redirects for flow command logs.
- Missing values for --agent-work-dir or --log-file return an ARGS_ERROR envelope and a non-zero exit code.
- npm test passes for the affected unit coverage.

## Implementation Targets
- src/sdd-forge.js
- src/flow.js
- src/lib/config.js
- src/lib/container.js
- src/lib/dispatcher.js
- src/flow/registry.js
- src/templates/partials/core-principle.md
- src/templates/skills/sdd-forge.flow/SKILL.md
- tests/unit/lib
- tests/unit/flow
- docs

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add agent workdir option
  - Introduce --agent-work-dir for flow run commands and route it into container path construction before Agent and Logger are initialized.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add runtime log writer
  - Add human-readable runtime log capture for flow run commands with explicit and default log-file paths.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update agent instructions
  - Update templates, generated skills, and documentation so outer agents compose flow run commands with --agent-work-dir and --log-file.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update regression coverage
  - Replace obsolete SDD_FORGE_WORK_DIR tests and add regression coverage for the new CLI options and logging contracts.
  - see `tasks/T-4.md` for full spec
