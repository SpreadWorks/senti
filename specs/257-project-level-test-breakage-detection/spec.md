# Feature Specification: 257-project-level-test-breakage-detection

**Feature Branch**: `feature/257-project-level-test-breakage-detection`
**Created**: 2026-05-13
**Status**: Draft
**Input**: GitHub Issue #322

## Goal
Guarantee project-level test breakage detection in the execution phase so review-test can stop receiving full project-level tests without weakening quality assurance.

## Background
Project-level tests are regression protection for the project and must be treated like source code that can be broken by an implementation. review-test is a plan-phase review for spec-local test design, so it should not be the place that receives all project-level tests. The execution path must therefore make project-level regression execution, evidence, review, and gate blocking explicit.

## Scope
- MUST: Define the test-execute contract for spec-local requirement tests and project-level regression tests.
- MUST: Define when changed files require full or targeted project-level regression execution.
- MUST: Migrate test-execute-result.json to version "2" with a dedicated regression object.
- MUST: Validate project-level regression evidence in test-result-review and gate-impl using deterministic checks.
- MUST: Surface project-level regression results in report consumers without mixing them into retro requirement aggregation.
- MUST: Add config support for test.command, test.projectPaths, and test.timeout.
- MUST: Run docs scan during flow preparation and fail preparation when analysis.json cannot be produced or read.
- MUST: Cover the new contracts with deterministic tests under specs/257-project-level-test-breakage-detection/tests/.

## Out of Scope
- Improving the review-test instruction prompt.
- Changing review-test input collection to remove full project-level tests content; current review-test collection behavior is preserved until the companion board removes project-level tests input after this execution-phase guarantee exists.
- Changing the spec-local test coverage judgment itself.
- Moving or reorganizing project-level tests.
- Comparing current test results with base branch test behavior or classifying pre-existing failures.

## Constraints
- Alpha policy applies: do not keep v1 test-execute-result.json compatibility paths.
- Project-specific paths such as src/ or tests/ must not be hardcoded into src/ product logic; classification must use analysis.json, explicit config, and generic trigger rules.
- Base-branch test behavior comparison is out of scope. A required project-level regression result of fail always blocks gate-impl.
- test.command is the only explicit root regression command config. Existing commands.test.task and commands.test.parent remain valid separate task prompt settings, keep their schema/tests, and must not be used for root regression discovery.
- Command execution must use an argv-style simple command parser. Shell control syntax such as pipes, &&, semicolons, redirection, subshells, and glob expansion is unsupported.
- bounded-resource-usage: review retries are already bounded, project-level regression execution uses test.timeout, then agent.timeout, then 600 seconds, and changed-file enumeration operates over finite git output.
- exit-code-contract: prepare/config loading failures, docs scan failures, analysis read failures, command discovery failures, spawn failures, invalid artifacts, failed reviews, and failed gates must stop the current command with non-zero failure behavior through existing flow error envelopes or thrown errors.
- validate-user-input-at-entry-point: .sdd-forge/config.json test.command, test.projectPaths, and test.timeout must be validated when config is loaded, before internal execution helpers trust them.
- If src/templates or src/presets are changed, run sdd-forge upgrade before final verification.

## Design Principles
- test-execute remains the single execution point for tests in the impl phase; downstream steps read persisted artifacts and do not rerun tests.
- The deterministic runner owns project-level regression command execution, raw markers, and the regression object. The AI agent may only produce requirement summary data through a temporary artifact.
- When classification is uncertain, use full project-level regression rather than skipping or narrowing it.
- Generated SDD artifacts are evidence for required=false classification, not triggers that force regression execution.
- test-result-review and gate-impl must verify artifacts and raw logs mechanically instead of trusting the agent's explanation.

## Overview
### Modules
- src/flow/lib/run-prepare-spec.js owns initial flow preparation and will run docs scan after the active root is established.
- src/flow/definition.js owns impl step order, next-action schema wiring, maxAttempts, context, and prerequisite derivation for test-execute/test-result-review.
- src/lib/config.js owns validation for .sdd-forge/config.json and will add the optional top-level test object.
- src/lib/container.js owns config loading at command startup and must preserve invalid config as a command failure instead of downgrading it to missing config.
- src/docs/lib/analysis-entry.js owns shared analysis category iteration for regression, check scan, context, docs prompt helpers, and DataSources.
- src/flow/lib/run-test-execute.js owns test execution and will compose the final v2 test-execute-result.json.
- src/lib/git-helpers.js owns shared git changed-file primitives and must preserve status, rename, and untracked details needed by regression snapshots.
- src/flow/prompts/impl/implement.md owns implement-step instructions for test-only specs and must not direct operators to skip the flow-level gate-impl regression gate.
- src/flow/schemas/test-execute-result.schema.json owns the v2 artifact contract, including summary line ranges and regression.
- src/flow/lib/run-test-result-review.js owns deterministic regression evidence validation before accepting AI review output.
- src/flow/prompts/impl/review.md and flow reset logic keep downstream test artifacts stale after review-applied code changes.
- src/flow/lib/run-gate.js owns gate-impl artifact prechecks and will independently validate current changed-file evidence.
- src/flow/lib/run-report.js loads completed v2 artifacts; src/flow/commands/report.js renders data.tests.projectRegression and the text report line.
- src/flow/lib/run-finalize.js must use the same v2 report data path as flow run report when it writes report.json.
- src/flow/lib/run-finalize-cleanup.js and the report-show path consume finalize report data and must preserve the same v2 regression validation and report text.
- src/flow/lib/run-finalize-commit.js stages durable raw evidence only and excludes temporary requirement summary artifacts.
- src/flow/lib/run-retro.js consumes v2 summary entries but keeps project regression out of requirement aggregation.
- src/flow/registry.js owns post-hook step advancement and must keep prerequisite failures from marking test-execute done.
- src/flow/lib/set-step.js prevents manual completion from bypassing required test and gate artifacts.
- src/lib/flow-store.js currently owns state.test.summary aggregation and must not remain a second source of truth for v2 test results.
- src/flow/lib/gate-step.js keeps project regression validation limited to the flow-level integration gate.
- src/flow/lib/run-review.js or a shared flow-state helper owns downstream reset after review-applied code changes.
- src/flow/lib/run-impl-confirm.js owns post-implementation next-step guidance and must not point operators past test-execute.
- src/lib/types.js documents the SddConfig test object for JavaScript consumers.
- src/docs/lib/test-env-detection.js includes configured test.command as the reported test command source for generated docs.
- src/presets/base/data/package.js or an adjacent base data source exposes package.json, composer.json, and Makefile test metadata needed for generated docs to mirror runtime discovery.
- src/presets/base templates and their docs data source or prompt context expose the selected test command so generated development/testing docs can mention configured test.command.
- src/templates/skills/rules.json owns generated agent rules and must exempt post-hook-managed test steps from manual completion guidance.
- src/docs/commands/enrich.js, text.js, review.js, and src/docs/lib/analysis-filter.js use the shared analysis category iterator for top-level analysis walks.
- tests/unit/lib/config-schema-commands-test.test.js continues to cover commands.test as a separate task-prompt config surface.
- src/templates/partials/flow-tracking.md and generated flow skills list post-hook-managed test steps and forbid masking prerequisite failures with manual step completion.
- src/locale/en/*.json and src/locale/ja/*.json own localized runtime help and messages for the new test config and artifact wording.
- src/lib/process.js or a new flow helper exposes deterministic process result fields for regression command classification.
- src/flow/schemas/next-action/test-execute.schema.json documents the minimal dispatcher output for test-execute.

### Data Flow
- prepare-spec runs docs scan at the active flow root and requires .sdd-forge/output/analysis.json to be readable.
- Invalid .sdd-forge/config.json remains a distinct config-load failure through command startup and is not converted into a missing-config state.
- prepare docs scan runs after worktree/root creation and before active-flow registration is considered successful; dry-run does not run docs scan.
- test-execute enumerates changed files against flow baseBranch and working tree state, classifies them, discovers the root test command, and executes full or targeted regression when required.
- test-execute and gate-impl use the same changed-file enumeration helper so status, rename, and untracked normalization cannot diverge between execution evidence and freshness checks.
- targeted mode is selected only when all trigger-relevant changes are test.projectPaths-classified test files; target paths are appended as argv tokens after the parsed root command.
- test.command is parsed directly; package.json, composer.json, and Makefile discovery execute deterministic wrapper argv commands and record the discovered script or target body as metadata, not as shell-parsed command text.
- test-execute writes raw regression start/end markers, reads the agent's temporary requirement summary, and persists final test-execute-result.json version "2".
- the agent may execute spec-local requirement tests, but its temporary summary is accepted only after deterministic validation against spec-local test files and raw output line ranges.
- test-result-review validates analysis/config/result/raw-log inputs, then writes project_regression_verification in checked_items.
- gate-impl checks test-result-review and repeats deterministic validation, including current changed-file snapshot comparison.
- report renders data.tests.projectRegression; retro aggregates only requirement summary[] results.
- report and finalize report generation fail when present test artifacts are unreadable or invalid instead of silently dropping them.
- finalize cleanup report envelopes use the same report data and text generated from validated v2 artifacts, so cleanup cannot display stale or downgraded regression information.
- impl review changes reset downstream test-execute, test-result-review, gate-impl, and retro evidence, or stale gate failure directs the operator to rerun test-execute.
- impl-confirm next-step guidance points to test-execute when implementation is complete, or otherwise delegates to the same flow definition order, so it cannot bypass execution-phase tests.
- manual set-step completion cannot mark test-execute, test-result-review, gate-impl, or retro done unless current artifacts validate.
- state.test.summary is removed from result authority or quarantined away from v2 test evidence; v2 artifacts are the only source for requirement summary and project regression report/retro consumers.

### Decisions
- [VERIFY] Current test-execute is agent-owned and uses v1 artifacts; this spec changes that ownership for project-level regression.
- [VERIFY] Current test-result-review validates five requirement-summary checks and has no project regression check.
- [VERIFY] Current gate integration precheck expects v1 and fails on summary[] failures; it has no regression validation.
- [VERIFY] Current config schema has commands.test for task prompts, not top-level test.command for regression.
- Project-level regression is a single regression object, not extra summary[] entries.
- Required regression failures are valid evidence but still block gate-impl.
- Command discovery priority is config, package-json, composer-json, then makefile; Python auto-guessing is not allowed.
- Targeted mode is only for changed project-level test files proven by test.projectPaths.
- Generated SDD artifacts are excluded from regression triggers and recorded only as classified_paths evidence.
- No base-branch test comparison is performed.
- review-test input reduction stays on the companion board.
- Invalid config must fail as invalid config.
- Changed-file snapshots must come from one shared helper.
- Generated docs must mirror every runtime test-command source.
- Schema files describe shape, but deterministic validators enforce cross-field and membership rules.
- Finalize report generation must not bypass v2 artifact loading.
- Test-only implementation instructions must not skip the regression gate.
- Package and composer test scripts are discovered but not shell-parsed.
- Legacy flow-state test summary is not authoritative for v2.
- Line ranges use a single v2 shape.

## Clarifications (Q&A)
- Q: Does commands.test participate in root regression command discovery?
  - A: No. commands.test.task and commands.test.parent remain task prompt settings. Only top-level test.command is explicit root regression config.
- Q: Does a failing required regression get compared with base branch behavior?
  - A: No. Base comparison, pre_existing states, and detached baseline measurement are out of scope; regression.result="fail" blocks gate-impl.
- Q: Can targeted mode use test-name filters or aliases instead of paths?
  - A: No. targeted mode must contain every target_paths entry as normalized path tokens after the root command tokens. If only filters or aliases are available, use full mode.
- Q: Are generated SDD artifacts part of regression.changed_files?
  - A: No. regression.changed_files is the trigger-relevant snapshot with generated SDD artifacts excluded. Generated artifacts may appear in classified_paths as spec-artifact-only evidence.
- Q: Does deterministic regression validation apply to every task-level gate-impl?
  - A: No. It applies to the flow-level integration gate-impl that runs after test-execute and test-result-review have produced artifacts. Task-level gate-impl does not require project regression artifacts.
- Q: Is review-test input collection changed in this spec?
  - A: No. This spec creates the execution-phase guarantee. The companion board changes review-test input after this guarantee exists.
- Q: Do active spec-local tests trigger project-level regression?
  - A: No by default. specs/<active-spec>/tests/** are requirement-test inputs/spec artifacts for regression classification. They trigger project-level regression only when they also match test.projectPaths.
- Q: Do skipped project regressions write raw regression markers?
  - A: No. Raw regression start/end markers and regression.raw_output_lines are required only when regression.required=true and a regression command is executed.
- Q: Does next-action test-execute schema mirror the full persisted v2 artifact?
  - A: No. The next-action schema may stay minimal for dispatcher output, but it must not contradict the v2 persisted artifact or old command-discovery behavior.
- Q: What is the canonical raw_output_lines shape in v2?
  - A: Both summary[].evidence.raw_output_lines and regression.raw_output_lines use {start_line,end_line}; both numbers are 1-based inclusive line numbers in the raw log.
- Q: How is targeted regression command built?
  - A: The parsed root command argv is used as the prefix, and every target_paths entry is appended as a separate argv token. If that cannot represent the targeted command, full mode is used.

## Alternatives Considered
- Keep passing full project-level tests to review-test. — Rejected because review-test is a plan-phase spec-local test design review and should not be responsible for regression execution evidence.
- Infer project-level test paths from directory names or filenames. — Rejected because projects differ in layout and naming; explicit test.projectPaths is required for targeted mode.
- Compare current failure with base branch test behavior before blocking. — Rejected because it expands flow responsibility into base-side test behavior and reintroduces the control problem the user asked to avoid.
- Keep v1 artifact compatibility. — Rejected by alpha policy; version "2" is a contract change and all consumers must migrate together.
- Also change review-test input collection in this spec. — Rejected because the user split input reduction into a companion board. This spec must make that companion change safe by guaranteeing execution-phase regression detection.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-13T02:01:26.732Z
- Notes: User approved gate-passed spec.

## Requirements
- R1 [must]: When prepare-spec establishes the active flow root, it shall run docs scan after worktree/root creation and before successful active-flow registration, skip docs scan for --dry-run, leave any partially created branch/worktree/spec files visible for operator cleanup on failure, and fail prepare when .sdd-forge/output/analysis.json is missing, unreadable, or has an invalid analysis shape.
- R2 [must]: src/docs/lib/analysis-entry.js shall expose iterateAnalysisCategories(analysis,{strict}) and shared metadata keys, extract project file paths from category objects containing entries[], optional summary, and optional dataSourceHash, ignore analyzedAt, enrichedAt, and generatedAt, support strict mode for regression classification, and be used anywhere code iterates analysis top-level categories, including docs scan existing-analysis indexes/reset logic, check scan, get-context, docs prompt helpers, DataSources, docs enrich/text/review, and analysis-filter.
- R3 [must]: Config validation shall accept an optional top-level test object with test.command, test.projectPaths, and test.timeout, validate test.command during config load, require test.projectPaths to be root-relative POSIX strings with no absolute paths, parent traversal, empty entries, globs, or shell metacharacters, treat entries ending in / as directory prefixes and other entries as exact files without existence checks, require test.timeout to be a positive integer number of seconds, and preserve invalid .sdd-forge/config.json as a distinct command startup failure rather than converting it to missing config.
- R4 [must]: Root regression command discovery shall use test.command, package.json scripts.test, composer.json scripts.test, then Makefile test target, record the selected source, parse only test.command directly, execute package.json scripts.test through argv ["npm","test","--"], execute composer.json scripts.test through argv ["composer","run-script","test","--"], execute Makefile test through argv ["make","test"], record discovered script or target text as metadata only, and fail when no supported source or ambiguous selected-source candidates exist.
- R5 [must]: Regression command parsing shall support argv-style commands with quoted args, escaped characters, and leading KEY=value env assignments, and reject shell control or expansion syntax.
- R6 [must]: Changed-file enumeration shall use a shared helper built on src/lib/git-helpers.js, use flow baseBranch plus HEAD, working tree, and untracked file state, preserve modified/added/deleted/renamed/untracked status, persist a stable sorted trigger-relevant changed_files[] snapshot using {status,path} or {status:"renamed",old_path,path} with root-relative normalized paths, and be reused by both test-execute evidence creation and gate-impl freshness comparison.
- R7 [must]: The classifier shall classify active spec-local test files under specs/<active-spec>/tests/** as requirement-test inputs/spec artifacts that do not trigger project regression unless they also match test.projectPaths, apply test.projectPaths-proven project test-file classification before generic analysis project-file triggers, select targeted mode only when every trigger-relevant changed file is a test.projectPaths-classified test file, append target_paths as argv tokens after the selected root command argv, fall back to full mode when targeted command construction cannot be represented with path tokens, require full regression for remaining analysis project files, execution/config/test-contract files, and unknown regular files, and mark non-trigger changes as regression.required=false using docs-only, spec-artifact-only, non-project-only, or mixed-non-trigger.
- R8 [must]: test-execute-result.json shall use version "2" enforced by schema-supported enum ["2"] and deterministic validators that reject v1 artifacts, keep summary[] mandatory for requirement results, migrate summary[].evidence.raw_output_lines to {start_line,end_line}, and store project-level regression in a single regression object outside summary[].
- R9 [must]: For regression.required=true, regression shall include mode, root_test_command, root_test_command_source, command, result, raw_output_lines, and changed_files, with target_paths required for targeted mode; raw_output_lines shall be {start_line,end_line} using 1-based inclusive raw-log line numbers.
- R10 [must]: For regression.required=false, regression shall include category, reason, classified_paths, and changed_files, with category limited to docs-only when every classified path is documentation, spec-artifact-only when every classified path is generated SDD/spec artifact, non-project-only when every classified path is non-project, or mixed-non-trigger when multiple non-trigger classes are present.
- R11 [must]: When regression.required=true, test-execute shall write standardized regression start and end markers to the raw log and ensure regression.raw_output_lines includes both markers with command and result values matching the artifact.
- R12 [must]: If a required regression command has started and then exits non-zero, exits 127, terminates by signal, or times out, test-execute shall write a valid v2 artifact with regression.result="fail" and allow downstream review and gate to process it.
- R13 [must]: If command discovery, config validation, config loading, analysis loading, or process spawn fails before the regression command starts, test-execute or prepare shall fail without writing a normal test-execute-result.json artifact and shall record issue-log fields for test-execute prerequisite failures; invalid config must surface through the existing command error/envelope path and must not be downgraded to NO_CONFIG.
- R14 [must]: test-execute shall delete stale test-execute-result.json, raw log, test-result-review.json, test-result-review.md, retro.json, and report.json at step start.
- R15 [must]: test-result-review shall run deterministic regression validation before accepting AI output, require checked_items[] to include project_regression_verification with result pass, advance the step only when deterministic validation and review verdict pass, make registry post-hook completion conditional on that pass verdict, and return non-zero failure while leaving the step retryable when validation or verdict fails.
- R16 [must]: The flow-level integration gate-impl shall require test-result-review pass, independently validate v2 regression evidence, compare the current trigger-relevant changed-file snapshot with regression.changed_files, and fail when required regression is missing, stale, unverifiable, or result fail.
- R17 [must]: report shall expose completed regression data under data.tests.projectRegression and render one text line Project regression: required=<true|false> result=<pass|fail|skipped> mode=<full|targeted|none>, adding category when required=false; flow run report, report-show, finalize report generation, and finalize cleanup report envelopes shall use the same v2 artifact-loading path and fail non-zero or preserve the same blocking failure when present test artifacts are unreadable or invalid.
- R18 [must]: retro shall continue aggregating requirement summary[] only, shall support v2 raw_output_lines range objects, and shall not mix project regression into requirement status totals.
- R19 [must]: Configuration docs, CLI docs, setup output, templates, generated skills, next-action schemas, prompts including implement.md, fixtures, existing project tests, snapshots, src/lib/flow-store.js summary handling, docs data sources or prompt context, and src/lib/types.js entries that describe test-execute-result.json, test-result-review, or .sdd-forge/config.json shall be updated to the v2 and test object contracts.
- R20 [must]: test-execute prompt files and run-test-execute.js system prompt shall use the R4 discovery order exactly and shall not instruct agents to discover root regression commands from README/docs hints, Python config auto-guessing, or commands.test.
- R21 [must]: Schema validation shall remain within the supported local schema subset, use supported constructs such as enum ["2"] rather than unsupported const for version enforcement, and enforce v2-only rules that need cross-field, marker, membership, or freshness checks with deterministic validator functions.
- R22 [must]: The temporary requirement summary artifact produced for test-execute shall live under the spec tests/.raw directory, be deleted at test-execute start and after final v2 artifact composition, and never be listed as a committed flow artifact.
- R23 [must]: Regression command execution shall expose a deterministic process result with started, exitCode, signal, timedOut, spawnError, stdout, and stderr fields, and test-execute shall use those fields to distinguish started failures from prerequisite failures.
- R24 [must]: The flow skill template and implement prompt shall document that prepare docs-scan or analysis failures are hard stops surfaced through the normal flow error envelope, that normal v2 artifact production advances test-execute, that started regression failures advance to test-result-review, that prerequisite failures are hard stops, that test-only specs may skip implement but must not skip the flow-level gate-impl regression gate, and that manual flow set step must not mask those outcomes; generated skills shall be refreshed with sdd-forge upgrade when the template changes.
- R25 [must]: finalize commit, including executeCommitPost() in run-finalize.js, and finalize cleanup report handling shall stage only durable raw evidence such as tests/.raw/test-execution.log, shall exclude the temporary requirement summary artifact by exact pathspec exclusion or filename pattern, shall use the same v2 report-show/report data when embedding cleanup output, and shall not catch and downgrade invalid present v2 test artifact or report-generation failures to a non-blocking report status.
- R26 [must]: Registry post-hooks shall mark test-execute done only when prerequisite checks succeeded and a normal v2 artifact was produced; started regression failures with regression.result="fail" shall advance to test-result-review, prerequisite failures shall throw or return ok:false and leave test-execute incomplete, and test-result-review post-hooks shall mark done only when deterministic validation and the review verdict pass.
- R27 [must]: Docs test environment detection shall report the selected project test command using the same R4 source order for test.command, package.json scripts.test, composer.json scripts.test, and Makefile test target, and the generated development/testing docs path shall receive that data through a shared discovery helper, data source, resolver, or text prompt context used by the base en/ja templates, so generated docs do not contradict regression command discovery.
- R28 [must]: src/flow/definition.js and run-impl-confirm.js shall keep implementation completion guidance on the path test-execute before test-result-review before review before flow-level gate-impl before retro, wire next-action schemas and contexts for the updated test-execute/test-result-review outputs, keep maxAttempts explicit, and expose prerequisite behavior tests for these transitions.
- R29 [must]: When impl review applies code changes after test-execute, downstream test-execute, test-result-review, gate-impl, and retro evidence shall be reset deterministically, or the stale gate failure and review prompt instructions shall direct the operator to rerun test-execute before gate-impl can pass.
- R30 [must]: Spec-local requirement test execution shall remain part of test-execute: the agent may run spec-local tests under specs/<active-spec>/tests/** and produce a temporary summary, but the runner shall validate each summary[] entry against the referenced test file, test name, command, and raw output line range before composing the final v2 artifact.
- R31 [must]: flow set step shall refuse or validate manual done transitions for test-execute, test-result-review, flow-level gate-impl, and retro so operators cannot bypass required current v2 artifacts, deterministic review checks, or regression gate evidence.
- R32 [must]: run-review or a shared flow-state helper shall own the reset trigger after review-applied code changes, resetting test-execute, test-result-review, flow-level gate-impl, and retro to pending and deleting stale downstream artifacts.
- R33 [must]: src/flow/lib/gate-step.js shall route project regression validation only to phase "integration" and keep task-level gate-impl behavior unchanged, with tests proving the phase split.
- R34 [must]: Existing flow-order and next-action tests and fixtures, including specs/251-fix-flow-impl-phase-order/tests/definition-impl-order.test.js and tests/unit/flow/get-next-action.test.js, shall be updated for the test-execute, test-result-review, review, gate-impl, retro impl sequence.
- R35 [must]: src/templates/partials/flow-tracking.md, src/templates/skills/rules.json, and generated flow skills shall list test-execute, test-result-review, and retro as post-hook-managed steps where manual step advancement must not mask prerequisite failures.
- R36 [must]: Runtime help and localized text under src/locale/en/*.json and src/locale/ja/*.json shall be updated when they mention test config, default agent terminology, test artifacts, or command/help wording affected by this v2 regression contract.
- R37 [must]: Legacy state.test.summary APIs such as setTestSummary() and aggregateTaskSummaryIntoParent() shall be removed or quarantined so they cannot overwrite, synthesize, or remain authoritative for v2 summary[] and regression results; existing tests for that legacy aggregation shall be deleted or rewritten against v2 artifact consumers.

## Acceptance Criteria
- Project-level test breakage detection is documented and implemented as test-execute / test-result-review / gate-impl responsibility, not review-test responsibility.
- A required project-level regression pass is mechanically provable from test-execute-result.json v2, raw markers, classifier output, and current changed-file snapshot.
- A required project-level regression fail is represented as valid evidence and blocks gate-impl.
- A prerequisite failure before command start stops the flow without normal test-execute-result.json and without downstream report synthesis.
- review-test input can be reduced separately without leaving project-level test breakage detection undefined.
- npm test is not hardcoded as the generic project command; this repository may discover npm test through package.json only.
- Existing unit and e2e tests that create v1 test-execute-result.json or v1 raw_output_lines arrays are updated or replaced.
- temporary requirement summary artifacts under tests/.raw are not staged by finalize commit.
- docs-generated test command information reflects top-level test.command when configured.
- test-only specs cannot skip the flow-level gate-impl regression gate.
- legacy state.test.summary is no longer an authoritative test result source.

## Implementation Targets
- src/flow/lib/run-prepare-spec.js
- src/flow/definition.js
- src/lib/config.js
- src/lib/container.js
- src/flow/lib/run-test-execute.js
- src/flow/lib/run-test-result-review.js
- src/flow/prompts/impl/implement.md
- src/flow/prompts/impl/review.md
- src/flow/lib/run-review.js
- src/flow/lib/run-impl-confirm.js
- src/flow/lib/run-gate.js
- src/flow/lib/gate-step.js
- src/flow/lib/set-step.js
- src/flow/lib/run-report.js
- src/flow/lib/run-finalize.js
- src/flow/lib/run-finalize-commit.js
- src/flow/lib/run-finalize-cleanup.js
- src/flow/lib/run-report-show.js
- src/flow/registry.js
- src/flow/commands/report.js
- src/flow/lib/run-retro.js
- src/lib/flow-store.js
- src/lib/process.js
- src/lib/git-helpers.js
- src/docs/lib/analysis-entry.js
- src/docs/lib/test-env-detection.js
- src/docs/commands/enrich.js
- src/docs/commands/text.js
- src/docs/commands/review.js
- src/docs/lib/analysis-filter.js
- src/check/commands/scan.js
- tests/unit/lib/config-schema-commands-test.test.js
- src/flow/schemas/test-execute-result.schema.json
- src/flow/schemas/test-result-review.schema.json
- src/flow/schemas/next-action/test-execute.schema.json
- src/flow/prompts/impl/test-execute.md
- src/flow/prompts/impl/test-result-review.md
- src/lib/types.js
- docs/cli_commands.md
- docs/ja/cli_commands.md
- src/presets/base/data/package.js
- src/presets/base/templates/en/development.md
- src/presets/base/templates/ja/development.md
- src/templates/skills/sdd-forge.flow/SKILL.md
- src/templates/partials/flow-tracking.md
- src/templates/skills/rules.json
- src/locale/en/ui.json
- src/locale/en/messages.json
- src/locale/ja/ui.json
- src/locale/ja/messages.json
- tests/unit/
- tests/e2e/
- tests/unit/flow/get-next-action.test.js
- specs/251-fix-flow-impl-phase-order/tests/definition-impl-order.test.js
- src/templates/
- src/presets/
- specs/257-project-level-test-breakage-detection/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add prepare analysis scan
  - Run docs scan during flow preparation and make analysis.json a required classifier input.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add regression classification
  - Classify changed files and discover the root regression command deterministically.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Migrate test execution artifact
  - Change test-execute so the runner owns project regression execution and persists test-execute-result.json version "2".
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Validate regression evidence
  - Make test-result-review and gate-impl mechanically verify project regression evidence.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Update result consumers
  - Migrate report and retro consumers to read v2 artifacts while keeping project regression separate from requirement aggregation.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Document test config
  - Expose the new test command, project path, and timeout config contract through validation, docs, and generated assets.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Refresh prompts and fixtures
  - Update prompts, schemas, fixtures, and snapshots so the full flow describes and verifies the v2 project regression contract.
  - see `tasks/T-7.md` for full spec
