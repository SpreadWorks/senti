# Feature Specification: 258-scenario-validity-step

**Feature Branch**: `feature/258-scenario-validity-step`
**Created**: 2026-05-17
**Status**: Draft
**Input**: GitHub Issue #329

## Goal
Add a plan-phase scenario-validity step that runs spec-local requirement tests before implementation, records whether each testable requirement fails for the expected pre-implementation reason, and blocks invalid tests before implementation starts.

## Background
Issue #329 documents a prior failure where an impossible assertion passed static review-test and was only discovered after implementation. The current plan/test step writes spec-local tests but does not execute them. The current impl/test-execute step runs after implementation, so it cannot prove that tests fail before implementation. The new step adds runtime evidence at the point where test validity must be checked.

## Scope
- [must] Add a scenario-validity leaf after plan/test and before review-test.
- [must] Execute only specs/<spec>/tests/ spec-local tests in the current plan worktree before implementation.
- [must] Persist scenario-validity-result.json and tests/.raw/scenario-validity.log with per-requirement outcomes.
- [must] Block when any testable requirement lacks expected_fail or has unexpected_pass, invalid_test, skipped, or not_run.
- [must] Update plan/test, review-test, and impl/test-execute prompts to describe the new phase split.
- [must] Update flow definition, registry command wiring, schemas, finalize artifact path handling, tests, and generated skill templates.
- [must] Run sdd-forge upgrade after template changes.

## Out of Scope
- Changing root npm test behavior outside the scenario-validity integration.
- Running project-wide regression during scenario-validity.
- Adding external dependencies or a new test framework.
- Retrofitting historical specs with scenario-validity artifacts.
- Publishing an npm release.

## Constraints
- Use only Node.js built-in modules.
- scenario-validity runs in the active plan worktree and must fail before test execution if git diff --name-only <baseBranch> -- src/ tests/ package.json .sdd-forge/config.json contains a path outside specs/<spec>/tests/, specs/<spec>/spec.json, specs/<spec>/draft.json, specs/<spec>/issue-log.json, specs/<spec>/spec-review.md, or specs/<spec>/draft-review-*.md.
- scenario-validity runs spec-local tests only; root regression remains the responsibility of impl/test-execute.
- The new flow command must return non-zero through the envelope failure path when scenario-validity blocks progress.
- bounded-resource-usage is acknowledged because the scenario-validity retry limit is exactly 3 and test discovery is bounded to files under specs/<spec>/tests/ whose basenames match *.{test,spec}.{js,ts,mjs}.
- Template changes must be propagated with sdd-forge upgrade.

## Design Principles
- Treat scenario-validity as a runtime gate for test validity, not as a replacement for implementation-phase regression.
- Keep test-execute as the impl-phase regression and final verification execution point.
- Use existing flow definition and registry patterns instead of adding parallel sequencing logic.

## Overview
### Modules
- src/flow/definition.js: add the scenario-validity leaf between test and review-test with maxAttempts 3.
- src/flow/registry.js: add flow run scenario-validity command metadata and post-hook step completion behavior.
- src/flow/lib/run-scenario-validity.js: execute spec-local tests, classify outcomes, write artifacts, and return pass/block envelope data.
- src/flow/lib/test-artifacts.js: expose durable/resettable scenario-validity artifact paths and validation helpers.
- src/flow/prompts/plan/test.md, src/flow/prompts/plan/review-test.md, src/flow/prompts/impl/test-execute.md: update user-facing step guidance.
- src/templates/skills/sdd-forge.flow/SKILL.md: propagate dispatcher guidance for the new plan-phase execution point.

### Data Flow
- plan/test writes specs/<spec>/tests/* with // spec: Rn headers -> scenario-validity runs node --test over those files in the current worktree -> scenario-validity-result.json and tests/.raw/scenario-validity.log are written -> review-test statically reviews tests and anti-patterns -> impl/test-execute runs post-implementation verification and root regression.

### Decisions
- [VERIFY] Flow definition currently has plan/test followed by review-test and no scenario-validity or gate-test leaf.
- [VERIFY] plan/test currently tells authors to write specs/<spec>/tests/ and not run tests because execution is centralized later.
- [VERIFY] impl/test-execute currently owns post-implementation test-execute-result.json and tests/.raw/test-execution.log.
- [VERIFY] Existing test header validation provides requirement-to-file coverage for spec-local tests.
- scenario-validity is the blocking runtime gate immediately after plan/test; no separate gate-test step is added.
- scenario-validity runs in the current plan worktree and treats implementation source changes as git diff paths under src/, tests/, package.json, or .sdd-forge/config.json outside the current spec artifact allow-list.
- Each testable requirement must have expected_fail; unexpected_pass, invalid_test, skipped, and not_run block progress.
- review-test keeps static anti-pattern guidance for six listed classes while scenario-validity provides runtime verification.

## Clarifications (Q&A)
- Q: Is scenario-validity a new gate-test step?
  - A: No. It is a scenario-validity step that behaves as the blocking runtime gate for plan-phase test validity. A separate gate-test step is not added.
- Q: Does scenario-validity run project regression?
  - A: No. It only runs spec-local tests under specs/<spec>/tests/. Project regression remains in impl/test-execute.
- Q: What is expected_fail?
  - A: expected_fail means the requirement's spec-local test ran before implementation and failed in a way attributable to the missing implementation behavior, not because the test was invalid, skipped, not run, or unrelated to the requirement.

## Alternatives Considered
- Add review-test -> scenario-validity -> gate-test as a three-step sequence — Rejected by draft q1 because it introduces a separate gate-test concept not present in the current flow and overlaps with scenario-validity's blocking responsibility.
- Run scenario-validity in a detached base-branch worktree — Rejected by draft q2 because the current plan worktree should not yet contain implementation changes and avoids copying newly authored spec-local tests into a second worktree.
- Allow aggregate success when at least one spec-local test fails — Rejected by draft q3 because it would allow some testable requirements to remain unverified before implementation.
- Run root regression during scenario-validity — Rejected by draft q4 because it mixes pre-implementation scenario validity with post-implementation project regression.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-17T12:16:27.345Z
- Notes: User approved gate-passed spec for Issue #329

## Requirements
- R1 [must]: FLOW_DEFINITION includes a plan-phase leaf id scenario-validity after test and before review-test. The leaf action is run-scenario-validity, its instructions key is plan.scenario-validity, its output schema is next-action/scenario-validity.schema.json, and its maxAttempts resolves to 3.
- R2 [must]: The flow registry exposes sdd-forge flow run scenario-validity as an internal flow command that requires an active flow, runs the scenario-validity command implementation, accepts no user-facing positional arguments, and marks the scenario-validity step done only when the result passes.
- R3 [must]: scenario-validity discovers and runs only spec-local test files under specs/<spec>/tests/ whose basenames match *.{test,spec}.{js,ts,mjs}. It does not run the project root regression command.
- R4 [must]: Before running tests, scenario-validity runs git diff --name-only <baseBranch> -- src/ tests/ package.json .sdd-forge/config.json. If any returned path is outside specs/<spec>/tests/, specs/<spec>/spec.json, specs/<spec>/draft.json, specs/<spec>/issue-log.json, specs/<spec>/spec-review.md, and specs/<spec>/draft-review-*.md, it writes a block result with classification invalid_test and does not execute tests.
- R5 [must]: scenario-validity writes specs/<spec>/scenario-validity-result.json and specs/<spec>/tests/.raw/scenario-validity.log on every invocation. The result file contains version, raw_output_path, command, process.started, process.exitCode, process.signal, process.timedOut, process.spawnError, and one summary entry for every testable requirement.
- R6 [must]: Each scenario-validity summary entry uses one of expected_fail, unexpected_pass, invalid_test, skipped, or not_run. The step passes only when every testable requirement has expected_fail and none has any blocking classification.
- R7 [must]: scenario-validity validates that each summary entry has evidence containing test_file, test_name, command, and raw_output_lines, and that raw_output_lines points into tests/.raw/scenario-validity.log.
- R8 [must]: test-artifact helpers add scenario-validity-result.json and tests/.raw/scenario-validity.log to DURABLE_TEST_ARTIFACT_RELATIVE_PATHS and RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS. run-finalize-commit excludes both files from the implementation commit artifact staging, and rerunning scenario-validity removes both stale files before writing new artifacts.
- R9 [must]: plan/test, plan/scenario-validity, plan/review-test, and impl/test-execute prompts describe the phase split: plan/test writes tests, scenario-validity performs pre-implementation spec-local runtime validation, review-test performs static anti-pattern review, and impl/test-execute performs post-implementation verification and root regression.
- R10 [must]: review-test prompt guidance lists all six anti-pattern classes from Issue #329: assertions that do not go through production code, input-as-expected round trips, always-matching regex, existence-only checks, catch-all PASS handling, and split-removed separator literal assertions.
- R11 [must]: Generated sdd-forge.flow skill template and installed skill output include scenario-validity in the plan-phase dispatcher guidance after running sdd-forge upgrade.
- R12 [must]: Automated tests cover the new flow definition order, registry command, scenario-validity pass/block classifications, artifact validation, prompt wording, template upgrade output, and coexistence with test-execute-result.json plus tests/.raw/test-execution.log.

## Acceptance Criteria
- flow get next-action returns scenario-validity after test and before review-test in a plan flow.
- sdd-forge flow run scenario-validity writes scenario-validity-result.json and tests/.raw/scenario-validity.log.
- scenario-validity passes when every testable requirement has expected_fail evidence.
- scenario-validity blocks on unexpected_pass, invalid_test, skipped, not_run, missing evidence, or implementation-target changes before the step.
- impl/test-execute still writes test-execute-result.json and tests/.raw/test-execution.log and remains responsible for root regression.
- review-test prompt includes the six anti-pattern classes from Issue #329.
- sdd-forge upgrade updates generated skill/template output for the new step.
- node tests/run.js --scope unit passes for affected unit tests.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add scenario-validity flow node
  - Add the scenario-validity plan leaf and registry command so the dispatcher can run the new step between test and review-test.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Implement scenario-validity runner
  - Run spec-local tests before implementation, classify per-requirement outcomes, and write scenario-validity artifacts.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Extend artifact handling
  - Make scenario-validity artifacts durable and resettable alongside existing test artifacts.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update prompts and templates
  - Update user-facing flow guidance so each phase describes the correct test execution responsibility.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Cover integration behavior
  - Add focused tests that prove scenario-validity integrates with the plan flow and leaves impl/test-execute behavior intact.
  - see `tasks/T-5.md` for full spec
