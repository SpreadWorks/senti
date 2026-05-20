# Feature Specification: 261-finalize-report-delivery

**Feature Branch**: `feature/261-finalize-report-delivery`
**Created**: 2026-05-20
**Status**: Draft
**Input**: User request

## Goal
finalize-cleanup success must deliver the finalize Report through a CLI-owned display contract instead of relying on the agent's final message. The same cleanup invocation must not write runtime or JSONL logs under a worktree path that the cleanup command deletes.

## Background
The previous finalize-cleanup run succeeded and returned `data.report.text`, but the final chat response omitted the Report. The current design depends on skill and prompt text that tell the agent to paste `data.report.text`; that is not a durable product mechanism across environments or sessions. The same run also produced `[sdd-forge] log write failed: ENOENT ... worktree/.../.sdd-forge/agent-work/logs` after cleanup removed the worktree that contained the requested agent work dir. The fix needs a CLI-owned display contract for the Report and a durable log path for cleanup commands that delete their worktree.

## Scope
- must: `sdd-forge flow run finalize-cleanup` success with `data.report.text` emits the finalize Report through a human-readable CLI display block.
- must: stdout for `flow run finalize-cleanup` remains a single machine-readable JSON envelope; the human-readable Report display is emitted outside stdout.
- must: the Report text displayed by cleanup is the same string returned by `flow report show` for the same finalized spec.
- must: missing Report keeps cleanup success when teardown succeeded, includes `REPORT_MISSING`, and emits a visible warning instead of fabricated Report text.
- must: finalize-cleanup runtime log, explicit `--log-file`, and logger writes use a durable main-repo location when their effective paths resolve under the worktree being deleted.
- should: finalize-cleanup prompt and generated flow skill text describe the CLI display contract without reintroducing a legacy post-cleanup report-show command or relying on AI hand-pasting `data.report.text`.
- must: spec-local tests verify Report display, stdout JSON preservation, missing Report warning, report-show text equality, and no deleted-worktree log warning.

## Out of Scope
- Changing the contents or schema of `report.json`.
- Changing finalize-commit, finalize-merge, or finalize-sync ordering.
- Changing GitHub issue comment posting behavior.
- Changing an external AI client UI or forcing a chat application's final answer renderer.
- Adding external logging or terminal-display dependencies.

## Constraints
- No external dependencies; use Node.js built-ins only.
- No new user-facing command arguments are added. Existing `finalize-cleanup` arguments keep their validation: `--auto-rescue` and `--force` are mutually exclusive flags; `--agent-work-dir` and `--log-file` remain string path options parsed by the shared dispatcher.
- Exit code contract: cleanup teardown success remains exit 0 even when Report is missing and a `REPORT_MISSING` warning is emitted. Existing recoverable failure envelopes such as `ORPHAN_COMMITS_DETECTED`, `SQUASH_BASELINE_MISSING`, `SQUASH_BASELINE_DIVERGED`, `MAIN_REPO_DIRTY`, `MAIN_REPO_LOCKED`, `CHERRY_PICK_CONFLICT`, and `ARGS_ERROR` remain non-zero.
- Backward-compatible CLI interface: stdout remains parseable JSON for envelope-mode callers. The new human-readable Report block must be emitted to stderr or another non-stdout human channel so JSON stdout clients do not need a migration.
- bounded-resource-usage acknowledged exception: the finalize Report display must not truncate `data.report.text` because R1 and R2 require the non-stdout block to contain the exact same text as `sdd-forge flow report show`; bounded behavior still applies to runtime logs, warnings, and machine artifacts.
- When `finalize-cleanup` runs from a worktree and the effective agent work dir is inside that worktree, the CLI must relocate the effective agent work dir to the main repository before logger and runtime-log paths are created. Absolute `--agent-work-dir` values outside the deleted worktree are honored.
- When `finalize-cleanup` receives `--log-file` and the resolved log file path is inside the worktree being deleted, the runtime log file path must be relocated to the main repository using the same relative path from the worktree root. Absolute `--log-file` values outside the deleted worktree are honored.
- When `config.logs.dir` is present and resolves inside the worktree being deleted, the logger log directory must be relocated to the main repository using the same relative path from the worktree root. Absolute `config.logs.dir` values outside the deleted worktree are honored.
- Runtime and logger relocation must not use hardcoded `/tmp` paths. The durable default is under the main repository's `.sdd-forge/agent-work` tree unless the user supplied an outside-worktree absolute path.
- No silent error swallowing is introduced. The fix avoids the known deleted-worktree ENOENT path; unrelated log write errors must still be visible through the existing logger warning or dispatcher failure behavior.
- If `src/templates/skills/sdd-forge.flow/SKILL.md` changes, run `sdd-forge upgrade` and include generated `.agents/skills/` and `.claude/skills/` diffs when they change.
- OOP policy applies to new structured values. If the implementation introduces a reusable report display payload or durable agent-work-dir resolver, represent it with a class or existing command/dispatcher object pattern rather than ad-hoc discriminated unions.

## Design Principles
- Move user-visible Report delivery into the CLI path that owns cleanup, not into an agent memory convention.
- Keep stdout machine-readable and place human-readable display on a side channel so existing envelope consumers remain stable.
- Use `run-report-show.js` helpers as the source of truth for Report text so cleanup display and `flow report show` cannot drift.
- Resolve paths that must outlive worktree deletion before the command starts writing logs.
- Treat prompt and skill text as guidance for humans and agents; tests must verify the CLI behavior directly.

## Overview
### Modules
- src/flow/lib/run-finalize-cleanup.js - attaches the Report to the cleanup envelope after teardown and already reads it through report-show helpers.
- src/flow/lib/run-report-show.js - resolves `.sdd-forge/last-finalized-spec` and reads `report.json.text`; cleanup display must reuse this text.
- src/lib/dispatcher.js - writes envelope stdout and owns runtime log creation; it is the shared point for preserving JSON stdout while emitting a human display block.
- src/sdd-forge.js and src/lib/container.js - parse `--agent-work-dir` before container initialization and create logger/runtime path services.
- src/lib/log.js - async JSONL logger that currently warns when its log dir disappears after worktree cleanup.
- src/flow/prompts/impl/finalize-cleanup.md and src/templates/skills/sdd-forge.flow/SKILL.md - agent guidance that must mention the CLI-owned Report display without reintroducing the legacy post-cleanup report-show instruction.

### Data Flow
- finalize-cleanup success -> write pointer -> clear flow -> remove worktree/branch -> read report.json text from main repo -> envelope data.report -> JSON stdout + Report display block on non-stdout channel
- worktree cwd + finalize-cleanup + agentWorkDir/logFile/logs.dir inside worktree -> durable main-repo paths before log creation -> logger and runtime logs survive worktree deletion
- Report missing -> data.report null + REPORT_MISSING warning -> JSON stdout stays valid -> visible warning display names the missing Report problem

### Decisions
- [VERIFY] cleanup already embeds the same Report source used by report-show.
- [VERIFY] report-show prints report.json text from the last finalized spec.
- [VERIFY] dispatcher currently writes only the JSON envelope on success.
- [VERIFY] runtime logs currently default under paths.agentWorkDir.
- [VERIFY] logger logDir is also derived from the effective agentWorkDir.
- [VERIFY] top-level CLI parses --agent-work-dir before container initialization.
- Use a non-stdout human display channel for the Report.
- Relocate only doomed finalize-cleanup log-related paths.
- Keep REPORT_MISSING as a warning instead of a cleanup failure.

## Clarifications (Q&A)
- Q: Why not rely on the assistant final answer?
  - A: The assistant final answer is outside the CLI's enforcement boundary. This spec makes the CLI display the Report during `finalize-cleanup`; prompt and skill text become guidance, not the only delivery path.
- Q: Why keep stdout JSON-only?
  - A: Envelope-mode callers parse stdout as JSON. Emitting the human Report on a non-stdout channel gives terminal users the Report while preserving the machine contract.
- Q: Does REPORT_MISSING fail cleanup?
  - A: No. If teardown succeeded, cleanup remains ok:true and surfaces `REPORT_MISSING` as a warning because missing Report data is separate from branch/worktree cleanup.
- Q: Which paths are relocated?
  - A: Only `flow run finalize-cleanup` log-related paths that resolve under the active worktree are relocated. This includes agentWorkDir, `--log-file`, and `config.logs.dir`. Absolute values outside the worktree remain unchanged.

## Alternatives Considered
- Only strengthen prompt and skill instructions. — Rejected because the user explicitly asked for a mechanism that survives other sessions and environments; prompt text alone still depends on the agent final response.
- Append raw Report text to stdout after the JSON envelope. — Rejected because it would make stdout no longer parse as one JSON envelope for existing CLI automation.
- Flush the logger immediately before deleting the worktree without relocating log dirs. — Rejected because git/log writes can still occur after deletion; durable path resolution before logger creation prevents the deleted-directory race.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-19T08:52:59.068Z
- Notes: autoApprove: approved gate-passed spec for finalize-cleanup report delivery

## Requirements
- R1 [must]: `sdd-forge flow run finalize-cleanup` must preserve stdout as one JSON envelope and, on ok:true with `data.report.text`, emit that exact text in a human-readable `Finalize Report` block to a non-stdout channel during the same command invocation.
- R2 [must]: The cleanup Report display block must use the same finalized spec report text that `sdd-forge flow report show` prints immediately after cleanup, with no alternate formatter and no fabricated content.
- R3 [must]: When cleanup teardown succeeds but the Report cannot be read, the command must keep ok:true, set `data.report` to null, include a `REPORT_MISSING` warning, and emit a visible warning that names the missing Report problem instead of a Report block.
- R4 [must]: For `flow run finalize-cleanup` executed inside a worktree, if the effective `agentWorkDir`, explicit `--log-file`, or `config.logs.dir` resolves inside the worktree path, the CLI must resolve the corresponding logger and runtime log paths under the main repository before creating those logs.
- R5 [must]: A successful finalize-cleanup with `--agent-work-dir`, `--log-file`, or `config.logs.dir` pointing under the deleted worktree must not emit `[sdd-forge] log write failed` or runtime-log ENOENT warnings after the worktree is removed.
- R6 [should]: The finalize-cleanup prompt, generated flow skill template, and generated installed skill copies should describe that cleanup emits the Report itself without reintroducing a legacy post-cleanup report-show instruction.
- R7 [must]: Spec-local tests under `specs/261-finalize-report-delivery/tests/` must cover R1 through R5 with `// spec: R<N>` headers and must include a fixture where `--agent-work-dir` is under a worktree that cleanup deletes.

## Acceptance Criteria
- Given cleanup succeeds and report.json contains `text`, stdout parses as a single JSON envelope and stderr or the configured human channel contains one `Finalize Report` block with the same text.
- Given cleanup succeeds, running `sdd-forge flow report show` from the main repository prints the same Report text that cleanup displayed.
- Given report.json is missing or lacks text after successful teardown, the cleanup envelope has `data.report: null`, contains a `REPORT_MISSING` warning, exits 0, and displays a warning instead of a Report block.
- Given `flow run finalize-cleanup --agent-work-dir .sdd-forge/agent-work` is launched from a worktree and cleanup deletes that worktree, no stderr line contains `[sdd-forge] log write failed` or `ENOENT` for the deleted worktree agent-work logs.
- Given `flow run finalize-cleanup --log-file .sdd-forge/agent-work/logs/finalize.log` is launched from a worktree and cleanup deletes that worktree, the runtime log is written under the main repository at the same relative path and no deleted-worktree ENOENT warning is emitted.
- Given `config.logs.dir` is a relative path under the worktree during finalize-cleanup, JSONL logger output is written under the main repository at the same relative path and no deleted-worktree log write warning is emitted.
- Given the same cleanup command uses an absolute `--agent-work-dir` outside the worktree, the CLI honors that outside path and does not relocate it.
- Given `--log-file` or `config.logs.dir` is an absolute path outside the worktree, the CLI honors that outside path and does not relocate it.
- Existing recovery failures such as `ORPHAN_COMMITS_DETECTED` keep their non-zero envelope behavior and do not display a success Report block.
- Generated skill text no longer states that the only Report delivery mechanism is the agent placing `data.report.text` in the final response; it mentions the CLI display and avoids the legacy post-cleanup report-show instruction.
- If the flow skill template changes, `sdd-forge upgrade` has been executed and generated skill diffs are present or the command reports no generated file changes.

## Implementation Targets
- src/flow/lib/run-finalize-cleanup.js
- src/flow/lib/run-report-show.js
- src/lib/dispatcher.js
- src/sdd-forge.js
- src/lib/container.js
- src/lib/log.js
- src/flow/prompts/impl/finalize-cleanup.md
- src/templates/skills/sdd-forge.flow/SKILL.md
- .agents/skills/sdd-forge.flow/SKILL.md
- .claude/skills/sdd-forge.flow/SKILL.md
- specs/261-finalize-report-delivery/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add cleanup report display
  - Make finalize-cleanup emit a CLI-owned human-readable Report display while preserving JSON stdout and report-show equality.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Relocate cleanup log dirs
  - Ensure finalize-cleanup logger and runtime log paths survive deletion of the active worktree when the requested agent work dir is inside that worktree.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update cleanup guidance
  - Align finalize-cleanup prompt and flow skill guidance with the new CLI display contract.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add regression coverage
  - Add executable spec-local coverage for the CLI display contract and durable cleanup logging behavior.
  - see `tasks/T-4.md` for full spec
