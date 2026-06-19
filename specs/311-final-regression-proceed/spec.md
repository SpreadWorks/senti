# Feature Specification: 311-final-regression-proceed

**Feature Branch**: `feature/311-final-regression-proceed`
**Created**: 2026-06-19
**Status**: Draft
**Input**: GitHub Issue #403

## Goal
Allow eligible final-regression failures to be classified, recorded, and advanced without ever displaying or storing them as passed.

## Background
final-regression is the default full project regression point after retro and before finalize. It already writes current-run result artifacts, retained attempt logs, failure attribution, retryable, nextAction, process metadata, changed files, and issue-log entries. When the project regression fails, the command currently returns FINAL_REGRESSION_FAILED and the registry post-hook refuses to complete the step unless the result is pass or skipped. Issue #403 requires eligible existing, out-of-scope, or execution-environment failures to be classified, recorded, and allowed to proceed while preserving clear non-pass evidence.

## Scope
- must: Classify final-regression failures by execution/assertion nature and by relationship to the current diff.
- must: Record eligible non-current-diff failures as failed final-regression outcomes that can advance to finalize.
- must: Keep current-diff regressions, invalid workflow state, and artifact write or validation failures on fix-or-stop paths.
- must: Add manual and auto-mode handling so eligible failures with fixAttempts=0 recommend fix-and-rerun and eligible failures with fixAttempts>0 recommend record-and-proceed.
- must: Update final-regression artifacts, next-action schema, registry completion, prompt instructions, status/report summaries, and issue-log evidence.
- must: Preserve migration parity for pass, skipped, current-diff failure, raw log, changed-file, process metadata, retryable, nextAction, and issue-log behavior.

## Out of Scope
- must: Do not treat a failed project regression as pass.
- must: Do not allow record-and-proceed for failures caused by the current diff or broken core spec behavior.
- must: Do not force progress when final-regression cannot write required artifacts or workflow state assumptions are broken.
- must: Do not change when final-regression runs in the flow.
- must: Do not add external dependencies.
- must: Do not publish or release the package.

## Constraints
- Use Node.js built-in modules only; no new dependencies.
- Represent new meaningful final-regression values with dedicated classes or existing class extensions, not ad-hoc discriminated-union object literals.
- Source under src/ must remain project-agnostic and must not hardcode project-specific values.
- A record-and-proceed outcome must keep `result: "fail"`; advancement is expressed by explicit record-and-proceed evidence, not by changing result to pass or skipped.
- A record-and-proceed command path must validate the current final-regression artifact before marking the step complete.
- Current-diff failures, invalid project-test failures caused by this diff, workflow internal state failure, missing required artifacts, schema validation failure, and artifact write failure must remain fail-closed.
- All final-regression attempt logs remain durable under `tests/.raw/final-regression-attempt-*.log`.

## Design Principles
- Separate project regression pass/fail from flow progression policy.
- Make record-and-proceed an auditable risk acceptance, not a hidden success.
- Classify failures once into durable evidence and reuse that classification on rerun or proceed decisions.
- Fail closed when the flow cannot prove the failure is outside the current diff or cannot persist evidence.
- Keep existing final-regression pass/skipped/current-diff behavior stable while adding the eligible failed-progress path.

## Overview
### Modules
- src/flow/lib/run-final-regression.js owns final-regression execution, failure classification, artifact writing, raw log writing, issue-log recording, and the new record-and-proceed validation path.
- src/flow/lib/test-artifacts.js owns final-regression-result.json validation and must validate the new failed-recorded evidence without relaxing pass/skipped contracts.
- src/flow/schemas/next-action/final-regression.schema.json owns the machine-readable envelope shape for failed, pass, skipped, and failed-recorded final-regression outputs.
- src/flow/registry.js owns final-regression command options and post-hook step completion; it must complete the step only for pass, skipped, or validated failed-recorded outcomes.
- src/flow/lib/flow-judgment-contract.js owns step completion policy checks used by tryUpdateStepStatus(); it must allow final-regression completion for validated failed-recorded artifacts while continuing to reject ordinary fail artifacts.
- src/flow/prompts/impl/final-regression.md owns agent handling after failure, including manual choice presentation and auto-mode recommended option behavior.
- src/flow/commands/report.js and status/report data collection own user-visible non-pass display in final summaries and reports.
- tests/unit/flow/final-regression.test.js and specs/311-final-regression-proceed/tests/ own behavior coverage for classification, proceed validation, display, and migration parity.

### Data Flow
- Normal run: `senti flow run final-regression` discovers and runs the project regression command, writes a raw attempt log, classifies any failure, writes final-regression-result.json, appends issue-log on failure, and returns pass/skipped/fail evidence.
- Failure decision: the artifact records `result: "fail"`, process metadata, failed command, rawOutputPath, failure summary, diff relationship, fixAttempts, failure category, retryable, nextAction, nextRecommendedAction, remaining risk, current command identity, and changed-file fingerprints.
- Proceed path: after an eligible failed artifact exists, `senti flow run final-regression --record-and-proceed` recomputes current command identity and changed-file fingerprints, rejects mismatches as stale, records selectedAction=record-and-proceed, keeps result=fail, updates evidence, and allows registry plus flow-judgment-contract completion checks to mark final-regression done.
- Auto/manual behavior: prompt instructions choose fix-and-rerun when fixAttempts=0 for an eligible failure, then choose record-and-proceed when fixAttempts>0 for an eligible non-current-diff failure; auto mode selects the recommended action.
- Reporting: final report/status read the failed-recorded artifact and display final-regression as not passed, with remaining risk and next recommended action.

### Decisions
- [VERIFY] Existing final-regression already centralizes execution and artifact writing.
- [VERIFY] Existing final-regression completion only accepts pass or skipped.
- [VERIFY] Existing artifact validation has failureKind values that differ from Issue #403's user-visible category names.
- [VERIFY] Existing final-regression prompt stops instead of offering a proceed path for unattributed and environment-like failures.
- [VERIFY] Existing report display is too compact for record-and-proceed risk.
- [VERIFY] Existing next-action schema requires result, failureKind, retryable, and nextAction but has no selected record-and-proceed evidence.
- [VERIFY] Step completion also depends on flow-judgment-contract.
- [MIGRATION] Retain pass and skipped behavior.
- [MIGRATION] Retain fail-closed behavior for current-diff and workflow-integrity failures.
- [MIGRATION] Add failed-recorded as a new completion policy, not a replacement for pass/skipped.
- [MIGRATION] Retain raw logs, changed files, process metadata, retryable, nextAction, and issue-log evidence.
- Use Issue #403 category names in user-visible summaries while preserving source-aware internal mapping.
- Limit automatic category assignment to source-backed evidence and make out_of_scope/flaky_suspected explicit proceed classifications.
- Use command identity plus changed-file fingerprints as the stale-check basis.
- Derive fixAttempts from observable post-failure changes.
- Add an explicit record-and-proceed run option.

## Clarifications (Q&A)
- Q: Does record-and-proceed mean final-regression passed?
  - A: No. It means the failure was classified as eligible to carry forward with evidence. The artifact remains `result: "fail"` and reports must show final-regression did not pass.
- Q: How does auto mode decide?
  - A: Auto mode follows the same recommended option the prompt would present manually: eligible failure with fixAttempts=0 recommends fix-and-rerun; eligible non-current-diff failure with fixAttempts>0 recommends record-and-proceed.
- Q: Can current-diff regressions use record-and-proceed?
  - A: No. Current-diff regressions, broken spec behavior, workflow integrity problems, and missing or invalid artifacts are excluded and must be fixed or stopped.
- Q: Why add an explicit command option?
  - A: The active step must not be advanced by manually setting it done. A command option gives the runner and registry post-hook a validated, auditable path for failed-recorded completion.
- Q: Are Issue #403 category names required in user-visible output?
  - A: Yes. The implementation may preserve finer internal failureKind values, but status/report output must present the Issue #403 categories when explaining a recorded failure.
- Q: How is stale record-and-proceed evidence rejected?
  - A: The failed artifact stores command identity and changed-file fingerprints. `--record-and-proceed` recomputes both and rejects the artifact if either differs.
- Q: How are out_of_scope and flaky_suspected assigned?
  - A: They are not automatic categories from ordinary logs. They require explicit record-and-proceed evidence because current source inputs do not contain scope-investigation or flake-history data.
- Q: What counts as a fix attempt?
  - A: A fix attempt is observable when a later failed final-regression attempt for the same command identity has changed-file fingerprints different from an earlier failed attempt. The calculation scans at most the latest 10,000 final-regression failure records for the active spec and does not read raw log contents. A simple rerun with identical fingerprints does not count.

## Alternatives Considered
- Treat record-and-proceed as skipped. — Rejected because skipped means the project regression did not run or was proven unnecessary, while record-and-proceed means it failed and risk was accepted.
- Mark the final-regression step done manually after a user choice. — Rejected because manual step completion would bypass artifact validation and could advance with stale or unsafe evidence.
- Always recommend record-and-proceed for eligible failures on the first failure. — Rejected because Issue #403 requires the first failure recommendation order to attempt fix-and-rerun before record-and-proceed.
- Rename all existing internal failureKind values directly to Issue #403 names in the draft. — Rejected at spec time because existing validators and consumers use finer source-level categories; implementation should deliberately map or migrate them with tests.
- Automatically infer out_of_scope and flaky_suspected from final-regression log text. — Rejected because existing source inputs do not provide enough evidence for those categories; explicit proceed evidence is required instead.
- Count any repeated failure as a fix attempt. — Rejected because it would recommend record-and-proceed after a simple rerun with no observable repair.
- Allow record-and-proceed for current-diff failures when the user asks. — Rejected because Issue #403 explicitly excludes failures caused by the current diff and broken core behavior.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-19T08:18:21.124Z
- Notes: User approved gate-passed spec for Issue #403 final-regression record-and-proceed behavior.

## Requirements
- R1 [must]: Final-regression failure artifacts must distinguish assertion-like project test failures from execution failures and must record a user-visible failure category using Issue #403 categories. Automatic categories are limited to source-backed evidence: caused_by_current_change, existing_failure, environment, sandbox, timeout, and dependency. out_of_scope and flaky_suspected may be recorded only during record-and-proceed selection with explicit non-empty evidence.
- R2 [must]: When a failure is classified as caused_by_current_change, invalid project-test behavior tied to the current diff, broken workflow state, missing artifact evidence, artifact write failure, or schema validation failure, record-and-proceed must be unavailable and the flow must stay on fix-or-stop behavior.
- R3 [must]: When a failure is classified as existing_failure, environment, sandbox, timeout, dependency, or explicitly evidenced out_of_scope or flaky_suspected, and required evidence is present, the artifact must mark it as eligible for record-and-proceed while keeping `result: "fail"`.
- R4 [must]: A record-and-proceed selection must preserve failed command, exit code, raw log path, failure summary, current diff relationship, fix attempt count, selected action, remaining risk, nextAction, and a distinct nextRecommendedAction in final-regression-result.json and final report data. nextAction remains the flow transition field; nextRecommendedAction is the user/auto recommendation and is one of fix-and-rerun, record-and-proceed, or stop.
- R5 [must]: `senti flow run final-regression --record-and-proceed` must validate the current failed final-regression artifact, reject ineligible or stale failures, record selectedAction=record-and-proceed, keep `result: "fail"`, and return an envelope that allows the final-regression post-hook to mark the step done. Stale means the current command identity or current changed-file fingerprints differ from the durable values stored on the failed artifact.
- R6 [must]: The final-regression registry post-hook and src/flow/lib/flow-judgment-contract.js completion policy must mark the step done only for pass, skipped, or validated failed-recorded artifacts; they must not complete for ordinary fail artifacts or any artifact that failed validation.
- R7 [must]: Prompt handling must recommend fix-and-rerun when fixAttempts is 0 for an eligible failure, recommend record-and-proceed when fixAttempts is greater than 0 and the failure is still eligible and non-current-diff, and in auto mode select the recommended action. fixAttempts counts observable post-failure repairs by comparing changed-file fingerprints between failed final-regression attempts for the same command identity; identical-fingerprint reruns do not count. The calculation must scan at most the latest 10,000 final-regression failure records for the active spec and must not read raw log contents.
- R8 [must]: Status, final report, report JSON, and human-readable summaries must display failed-recorded final-regression as not passed, including failure category, raw log path, fix attempts, remaining risk, selected action, and next recommended action.
- R9 [must]: Migration parity must preserve existing pass completion, skipped completion with proof, raw attempt log retention, changed file snapshots, process metadata, retryable/nextAction fields, issue-log failure entries, and current-diff fail-closed behavior.
- R10 [must]: Spec-local tests under specs/311-final-regression-proceed/tests/ must cover R1 through R9 with `// spec: R<N>` headers, and shared unit tests must cover production final-regression runner, schema, registry, prompt, and report behavior where appropriate.

## Acceptance Criteria
- For R1, a failed project regression artifact includes both the internal attribution needed for flow handling and a user-visible Issue #403 category, and execution failures such as spawn EPERM, permission, missing CLI, dependency, timeout, and sandbox are not reported as assertion failures.
- For R1/R3, out_of_scope and flaky_suspected are not emitted by automatic classification without explicit record-and-proceed evidence; tests verify automatic classification does not invent those categories from ordinary log text.
- For R2, caused_by_current_change, invalid artifact write, schema validation failure, and workflow root/state failure do not expose record-and-proceed eligibility and cannot be completed by the record-and-proceed command.
- For R3, existing, out-of-scope, environment, sandbox, timeout, dependency, and flaky-suspected eligible failures keep `result: "fail"` and include a machine-readable record-and-proceed eligibility signal.
- For R4, after record-and-proceed is selected, final-regression-result.json and report data include failed command, exit code, raw log path, failure summary, current diff relationship, fix attempt count, selectedAction=record-and-proceed, remaining risk, nextAction, and nextRecommendedAction.
- For R5, running `senti flow run final-regression --record-and-proceed` against an eligible current failed artifact returns success for the command while preserving artifact result=fail; running it against a pass, skipped, current-diff failure, stale artifact, or invalid artifact returns a failure envelope and does not advance the step.
- For R5, stale rejection tests change either the resolved command identity or changed-file fingerprint snapshot after the failed artifact is written and verify `--record-and-proceed` rejects the artifact.
- For R6, the registry post-hook and flow-judgment-contract mark final-regression done for pass, skipped, and validated failed-recorded artifacts, and reject ordinary fail artifacts with no selected record-and-proceed evidence.
- For R7, the prompt text instructs agents to choose fix-and-rerun when fixAttempts=0, to choose record-and-proceed when fixAttempts>0 and the failure is still eligible, and to auto-select the recommended action when autoApprove is true.
- For R7, a repeated final-regression failure with identical command identity and changed-file fingerprints keeps fixAttempts at 0; a repeated failure after changed-file fingerprints differ for the same command identity increments fixAttempts and changes nextRecommendedAction to record-and-proceed when the failure remains eligible.
- For R8, final report text and report JSON show failed-recorded as non-pass and include remaining risk; no output line makes it look like final-regression passed or was skipped.
- For R9, existing tests or new tests prove pass and skipped outcomes still advance, raw attempt logs are retained, changedFiles/process/retryable/nextAction are still present, issue-log failure entries still write, and current-diff failures remain fix-or-stop.
- For R10, `node tests/run.js --scope unit` and spec-local tests execute the relevant final-regression coverage, or any unavailable command is recorded with issue-log evidence and explicit reason.

## Implementation Targets
- src/flow/lib/run-final-regression.js
- src/flow/lib/test-artifacts.js
- src/flow/schemas/next-action/final-regression.schema.json
- src/flow/registry.js
- src/flow/prompts/impl/final-regression.md
- src/flow/commands/report.js
- src/flow/lib/flow-judgment-contract.js
- tests/unit/flow/final-regression.test.js
- specs/311-final-regression-proceed/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Classify failed regression
  - Extend final-regression failure classification and artifact evidence so failures expose Issue #403 categories, assertion/execution nature, current diff relationship, freshness evidence, fixAttempts, and eligibility for record-and-proceed.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add proceed command
  - Add the validated record-and-proceed command path, registry completion behavior, and flow-judgment-contract completion policy for eligible failed final-regression artifacts.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Display recorded failure
  - Update prompt guidance, status/report data, and human-readable reports so failed-recorded final-regression is explicit and never appears as pass or skipped.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Cover parity behavior
  - Add spec-local and shared tests proving new record-and-proceed behavior and retained final-regression pass, skipped, fail-closed, evidence, and issue-log behavior.
  - see `tasks/T-4.md` for full spec
