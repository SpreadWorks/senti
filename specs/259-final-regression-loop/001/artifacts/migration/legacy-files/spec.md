# Feature Specification: 259-final-regression-loop

**Feature Branch**: `feature/259-final-regression-loop`
**Created**: 2026-05-18
**Status**: Draft
**Input**: GitHub Issue #330

## Goal
Finish issue #330 by keeping full project regression out of the normal test-execute repair loop and running it as a late final-regression step before finalize.

## Background
Recent SDD flows repeatedly ran full project regression from test-execute. When review or gate repairs changed code, the test artifact became stale and full npm test -- ran again inside the normal repair loop. Issue #330 moves default full project regression to a final-regression step after retro, while normal test-execute keeps spec-local and targeted evidence. The current working tree already contains most of that implementation; this spec formalizes the remaining fixes and verification.

## Scope
- Use the existing uncommitted 30a7 implementation as the starting point and finish only the remaining gaps.
- Ensure normal test-execute defaults to spec-local plus targeted evidence and records full-regression deferral instead of running full npm test -- by default.
- Ensure flow run final-regression owns the default full project regression, writes stable artifacts, and advances only after pass validation.
- Fix final-regression next-action wiring, test-result-review raw output validation, stale plan prompt responsibility text, and failure classification rules.
- Add spec-local coverage and focused shared tests proving normal repair loops do not run full npm test -- unless explicitly configured.

## Out of Scope
- Re-implementing already present final-regression step, registry command, runner, artifact validator, or test-execute policy from scratch.
- Changing unrelated draft, spec, review, gate, finalize, or task flow behavior.
- Adding external dependencies.
- Publishing to npm.

## Constraints
- No external dependencies; use Node.js built-in modules and existing project helpers only.
- Alpha policy applies: do not keep compatibility code for obsolete internal formats introduced before this spec.
- test.testExecuteRegression is validated at the config boundary and may only be targeted, full, or skip.
- flow run final-regression has no user-facing arguments in this spec; any future option must be validated at the CLI registry boundary.
- exit-code-contract: flow run final-regression succeeds with exit code 0 only when final-regression-result.json validates with result pass. A fail artifact, invalid artifact, missing raw log, invalid command, timeout, permission, sandbox, dependency, or process error returns a failed envelope and non-zero process exit.
- bounded-resource-usage: raw test and final-regression logs are bounded by artifact validators to 64 MiB and 200000 raw lines; per-evidence raw ranges are capped at 2000 lines. final-regression failure matching inspects at most 256 KiB of combined failure evidence and at most 1000 changed files; exceeding the changed-file match cap stops as infra_failure instead of routing to regression-repair.
- backward-compatible-cli-interface: existing test-execute command remains available and the explicit test.testExecuteRegression=full setting is the migration path for users who intentionally want full regression inside test-execute.
- Templates or presets changed by this work must be propagated with sdd-forge upgrade before finalize.

## Design Principles
- Keep project-level confidence, spec-local evidence, review, and gate responsibilities in separate flow steps.
- Make failure routing data-driven from artifact fields instead of reclassifying the same final-regression failure on every retry.
- Prefer explicit deferral evidence over silent skipping when full regression is moved out of test-execute.
- Treat issue #330's already-implemented list as existing work; inspect and patch it instead of duplicating it.

## Overview
### Modules
- src/flow/definition.js and src/flow/registry.js define and dispatch the final-regression step.
- src/flow/lib/run-final-regression.js runs the final project command and writes final-regression-result.json plus tests/.raw/final-regression.log.
- src/flow/lib/test-regression.js and src/flow/lib/run-test-execute.js plan normal project regression policy for targeted, full, skip, and deferred cases.
- src/flow/lib/test-artifacts.js validates test-execute-result.json and final-regression-result.json contracts.
- src/flow/lib/run-test-result-review.js validates test-execute-result.json against raw output before review, gate-impl, retro, and final-regression.
- src/flow/prompts and src/templates/skills/sdd-forge.flow/SKILL.md describe the split responsibilities for test-execute, test-result-review, gate-impl, retro, final-regression, and finalize.
- src/flow/lib/run-test-result-review.js now forwards rawOutputText to validateTestExecuteResultEvidence for project regression marker checks.
- src/flow/lib/run-final-regression.js now requires failure output to reference a changed file before routing to regression-repair.
- src/flow/prompts/plan/scenario-validity.md now describes impl/final-regression as the default full project regression point.

### Data Flow
- implement -> test-execute writes spec-local and targeted/deferred evidence -> test-result-review validates artifact integrity -> review and gate-impl inspect the v2 artifact without running tests.
- retro summarizes test-execute and test-result-review evidence -> final-regression runs the full project command by default -> finalize-commit starts only after final-regression pass.
- On final-regression failure, final-regression-result.json records failureKind, retryable, nextAction, rawOutputPath, changedFiles, and previousFailureKind; issue-log records the failure.
- test-result-review reads tests/.raw/test-execution.log, passes that text as rawOutputText, and lets test-artifacts validate full regression markers deterministically.
- final-regression combines stdout, stderr, spawn errors, and discovery errors as failure evidence, then matches repo-relative changedFiles before choosing caused_by_current_change.
- plan/scenario-validity remains spec-local pre-implementation validation, while impl/test-execute handles spec-local/targeted evidence and impl/final-regression handles full regression.

### Decisions
- [VERIFY] final-regression step exists after retro and before finalize, with registry command and pass-only post-hook.
- [VERIFY] normal test-execute already has targeted/full/skip policy and deferred categories.
- [VERIFY] final-regression artifact contract is implemented and includes required routing fields.
- [CORRECTION] test-result-review must pass rawOutputText to validateTestExecuteResultEvidence, not rawText.
- [CORRECTION] scenario-validity prompt still assigns post-implementation project verification to impl/test-execute.
- [VERIFY] issue #330's board/issue body explicitly marks existing implementation as uncommitted work and instructs this spec not to re-implement it.
- T-1 fixed the rawText/rawOutputText mismatch rather than changing the artifact validator contract.
- T-2 keeps unlinked final-regression failures out of the normal repair loop by classifying them as pre_existing or another stop/test-repair category.
- T-4 changed only the stale scenario-validity prompt because templates and installed skills already used final-regression wording.

## Clarifications (Q&A)
- Q: Does this spec re-implement the already present 30a7 changes?
  - A: No. The existing uncommitted diff is treated as implemented work. Implementation should inspect, patch, and verify only the remaining gaps.
- Q: Where may full npm test -- run by default?
  - A: Only in final-regression. test-execute may run full project regression only when test.testExecuteRegression is explicitly set to full.
- Q: What happens when final-regression fails for an unrelated reason?
  - A: If the failure is not specifically linked to changedFiles, it must not choose regression-repair. It records pre_existing, invalid_project_test, or a stop category and returns control or a bounded test-repair path instead of entering the normal implementation repair loop.
- Q: What happens if a final-regression repair changes files after prior evidence exists?
  - A: flow run final-regression does not apply that repair. It emits nextAction only. If the user or agent edits files afterward, that edit is outside the final-regression command and remains subject to the existing stale-artifact reset behavior before finalize can rely on new evidence.
- Q: How is CLI success defined for final-regression?
  - A: exit-code-contract: The command succeeds only when final-regression-result.json validates and result is pass. Fail artifacts, invalid artifacts, missing raw logs, invalid command discovery, timeout, permission, sandbox, dependency, signal, and child-process EPERM outcomes are failed envelopes and non-zero CLI failures.
- Q: Where is project-test-integrity runtime evidence produced?
  - A: project-test-integrity: Task-level impl/review/gate steps must not run tests. Runtime evidence is produced by the spec-level test-execute and test-result-review steps, with full project evidence produced by final-regression before finalize.

## Alternatives Considered
- Keep full project regression in test-execute and optimize classification — Rejected because it leaves full npm test -- inside the same artifact invalidation loop that issue #330 is trying to remove.
- Skip project regression entirely during normal flows — Rejected because release confidence would depend on manual action. final-regression keeps the confidence check inside the flow before finalize.
- Route every final-regression failure back to gate-impl — Rejected because environment, sandbox, dependency, timeout, and pre-existing failures are not implementation defects and would create unnecessary review/gate/test loops.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-18T12:14:28.456Z
- Notes: User asked to continue; autoApprove true; treating approval choice [1] as selected.

## Requirements
- R1 [must]: Normal test-execute shall not run full project regression by default. When changed files require full project regression and test.testExecuteRegression is absent or targeted, test-execute-result.json shall record regression.required=false with category full-regression-deferred and a reason naming final-regression. When test.testExecuteRegression=skip, it shall record category project-regression-skipped. When test.testExecuteRegression=full, test-execute may run the full command and must include project regression start/end markers in the raw log.
- R2 [must]: flow run final-regression shall run after retro and before finalize, execute the project regression command, write final-regression-result.json and tests/.raw/final-regression.log, and mark final-regression done only when the artifact validates with result pass.
- R3 [must]: final-regression-result.json shall include version, result, completed, failureKind, command, rawOutputPath, retryable, nextAction, changedFiles, previousFailureKind, rawOutputLines, and process metadata. Pass artifacts shall have failureKind=null, retryable=false, and nextAction=finalize-commit. Fail artifacts shall include a non-null failureKind and a nextAction that routes to exactly one repair or stop path.
- R4 [must]: final-regression shall classify caused_by_current_change only when raw output or failing test metadata specifically references at least one changedFiles entry. If no such link exists, it shall not choose regression-repair; it shall classify as pre_existing, invalid_project_test, or a retryable=false stop category such as infra_failure, timeout, dependency_failure, sandbox_restriction, permission_error, or child_process_eprem. invalid_project_test shall route to test-repair, not regression-repair.
- R5 [must]: final-regression shall not mutate implementation files or test files while classifying a failure. The first caused_by_current_change failure may emit nextAction=regression-repair and the first invalid_project_test failure may emit nextAction=test-repair. The second final-regression failure for the same flow shall write previousFailureKind, set retryable=false, and set nextAction=stop.
- R6 [must]: test-result-review shall validate targeted or explicit full project regression evidence using the raw output text read from tests/.raw/test-execution.log. It shall pass rawOutputText to validateTestExecuteResultEvidence so missing start/end markers fail deterministically and valid markers pass.
- R7 [should]: get-next-action shall expose final-regression as an impl-phase mainline step after retro, use next-action/final-regression.schema.json, require no user approval for normal execution, and route a passing final-regression to finalize-commit.
- R8 [should]: Any edited prompt, template, skill, guardrail, report, retro, or locale text that mentions full project regression shall name impl/final-regression as the default full project regression step. Edited text shall not state that default project-wide regression remains in impl/test-execute.
- R9 [should]: gate-impl shall not block solely because full project regression was deferred from test-execute. It may block targeted or explicit full test-execute regression failures, invalid v2 artifacts, missing test-result-review pass, or failed final-regression evidence when that evidence exists.
- R10 [must]: The completed implementation shall include spec-local tests under specs/259-final-regression-loop/tests with // spec: R<N> headers covering the new behavior, and focused shared unit tests may be added or updated for changed public flow contracts.

## Acceptance Criteria
- A spec-local test demonstrates that the default test-execute policy records full-regression-deferred instead of running npm test -- in the normal repair loop.
- A spec-local test demonstrates that test.testExecuteRegression=full is the explicit exception that permits full project regression inside test-execute.
- A spec-local test demonstrates final-regression pass writes the required artifact and raw log and advances to finalize-commit.
- A spec-local test demonstrates first and second caused_by_current_change final-regression failures produce regression-repair then stop routing.
- A spec-local test demonstrates invalid_project_test routes to test-repair on the first failure and stop on the second failure.
- A spec-local test demonstrates final-regression failure classification writes only final-regression artifacts and issue-log entries, not implementation or test file edits.
- A spec-local test demonstrates caused_by_current_change is not selected when the failure output has no link to changedFiles.
- A spec-local test demonstrates run-test-result-review validates raw output markers through rawOutputText and fails when markers are missing.
- Existing focused tests for final-regression, test-regression policy, flow step order, and get-next-action pass.
- When template or preset files change, the corresponding installed skill/config files in .agents and .claude contain the same final-regression responsibility text as the source template or preset.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Fix raw evidence validation
  - Make test-result-review validate project regression evidence with the raw output text expected by the artifact validator.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Complete final-regression routing
  - Finish final-regression failure classification, retry cap, issue-log recording, and next-action behavior without returning failures to the normal review/gate loop.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify test-execute policy
  - Prove normal test-execute no longer runs default full project regression and preserves targeted/full/skip behavior.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Align flow text
  - Remove stale responsibility descriptions so prompts, templates, installed skills, reports, retro, and locale text agree on the final-regression split.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Finalize coverage
  - Add spec-local tests with requirement headers and run the focused test set needed to validate the completed flow contract.
  - see `tasks/T-5.md` for full spec
