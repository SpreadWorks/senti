# Test Design

### Test Design

- **TC-1: Default test-execute defers required full regression**
  - Type: integration
  - Input: Changed files require full project regression; `test.testExecuteRegression` absent; run `test-execute`.
  - Expected: Full regression command is not run. `test-execute-result.json` records `regression.required=false`, category `full-regression-deferred`, and reason names `final-regression`.

- **TC-2: Targeted test-execute defers required full regression**
  - Type: integration
  - Input: Changed files require full project regression; `test.testExecuteRegression=targeted`; run `test-execute`.
  - Expected: Full regression command is not run. Artifact records category `full-regression-deferred` with reason naming `final-regression`.

- **TC-3: Explicit skip records project regression skipped**
  - Type: integration
  - Input: Changed files require full regression; `test.testExecuteRegression=skip`; run `test-execute`.
  - Expected: Artifact records `regression.required=false`, category `project-regression-skipped`, and does not run full regression.

- **TC-4: Explicit full test-execute regression emits markers**
  - Type: integration
  - Input: `test.testExecuteRegression=full`; configured full regression command succeeds.
  - Expected: Full regression command runs. `tests/.raw/test-execution.log` contains project regression start and end markers.

- **TC-5: No full-regression need does not create deferred category**
  - Type: unit
  - Input: Changed file set that does not require project-wide regression.
  - Expected: `test-execute-result.json` does not report `full-regression-deferred` or `project-regression-skipped`.

- **TC-6: final-regression appears after retro before finalize**
  - Type: acceptance
  - Input: Flow reaches implementation phase after `retro`.
  - Expected: Next mainline step is `final-regression`; `finalize` is not offered before final-regression completes.

- **TC-7: final-regression runs configured project command**
  - Type: integration
  - Input: Run `flow run final-regression` with a passing project regression command.
  - Expected: Command executes once; `final-regression-result.json` and `tests/.raw/final-regression.log` are written.

- **TC-8: final-regression marks done only on valid pass artifact**
  - Type: integration
  - Input: Passing command but generated artifact is missing a required field.
  - Expected: Step is not marked done; validation failure is surfaced.

- **TC-9: Passing final-regression artifact schema**
  - Type: unit
  - Input: Successful final-regression execution.
  - Expected: Artifact includes `version`, `result`, `completed`, `failureKind`, `command`, `rawOutputPath`, `retryable`, `nextAction`, `changedFiles`, `previousFailureKind`, `rawOutputLines`, and process metadata. `failureKind=null`, `retryable=false`, `nextAction=finalize-commit`.

- **TC-10: Failing final-regression artifact schema**
  - Type: unit
  - Input: Failed project regression execution.
  - Expected: Artifact includes all required fields; `failureKind` is non-null; `nextAction` routes to exactly one repair or stop path.

- **TC-11: rawOutputPath points to final-regression log**
  - Type: integration
  - Input: Run final-regression.
  - Expected: `rawOutputPath` references `tests/.raw/final-regression.log`; `rawOutputLines` matches the raw log line count.

- **TC-12: caused_by_current_change when raw output names changed file**
  - Type: unit
  - Input: Changed files include `src/foo.js`; raw output references `src/foo.js`.
  - Expected: Failure classified as `caused_by_current_change`; first occurrence emits `nextAction=regression-repair`.

- **TC-13: caused_by_current_change when failing metadata names changed file**
  - Type: unit
  - Input: Raw output lacks filename, but failing test metadata references a changed file.
  - Expected: Failure classified as `caused_by_current_change`.

- **TC-14: No changed-file link does not route to regression-repair**
  - Type: unit
  - Input: Regression fails, but raw output and metadata reference no changed files.
  - Expected: Failure is classified as `pre_existing`, `invalid_project_test`, or a stop category; `nextAction` is not `regression-repair`.

- **TC-15: invalid_project_test routes to test-repair**
  - Type: unit
  - Input: Failure output indicates invalid or broken project test, with no changed-file causality.
  - Expected: `failureKind=invalid_project_test`; `nextAction=test-repair`.

- **TC-16: Infrastructure failure routes to stop**
  - Type: unit
  - Input: Raw output indicates infrastructure failure.
  - Expected: `failureKind=infra_failure`; `retryable=false`; `nextAction=stop`.

- **TC-17: Timeout routes to stop**
  - Type: integration
  - Input: Project regression command exceeds timeout.
  - Expected: `failureKind=timeout`; `retryable=false`; `nextAction=stop`; artifact and raw log are written.

- **TC-18: Dependency failure routes to stop**
  - Type: unit
  - Input: Raw output indicates missing dependency or install failure unrelated to changed files.
  - Expected: `failureKind=dependency_failure`; `retryable=false`; `nextAction=stop`.

- **TC-19: Sandbox restriction routes to stop**
  - Type: unit
  - Input: Raw output indicates sandbox restriction.
  - Expected: `failureKind=sandbox_restriction`; `retryable=false`; `nextAction=stop`.

- **TC-20: Permission error routes to stop**
  - Type: unit
  - Input: Raw output contains permission-denied failure.
  - Expected: `failureKind=permission_error`; `retryable=false`; `nextAction=stop`.

- **TC-21: child_process EPERM routes to stop**
  - Type: unit
  - Input: Child process fails with `EPERM`.
  - Expected: `failureKind=child_process_eprem`; `retryable=false`; `nextAction=stop`.

- **TC-22: Classification does not mutate implementation or test files**
  - Type: integration
  - Input: Run final-regression on a failing command; compare implementation and test file checksums before and after classification.
  - Expected: Only flow artifacts/logs change; source and test files are unchanged.

- **TC-23: Second caused_by_current_change failure stops**
  - Type: integration
  - Input: Same flow has an earlier final-regression failure classified `caused_by_current_change`; run final-regression again and fail similarly.
  - Expected: Artifact writes `previousFailureKind=caused_by_current_change`, `retryable=false`, `nextAction=stop`.

- **TC-24: Second invalid_project_test failure stops**
  - Type: integration
  - Input: Same flow has an earlier `invalid_project_test`; second final-regression also fails as invalid project test.
  - Expected: Artifact writes `previousFailureKind=invalid_project_test`, `retryable=false`, `nextAction=stop`.

- **TC-25: test-result-review validates targeted evidence from raw text**
  - Type: integration
  - Input: `tests/.raw/test-execution.log` contains valid targeted evidence; run `test-result-review`.
  - Expected: Raw log text is passed to evidence validation and review passes.

- **TC-26: test-result-review fails missing full-regression start marker**
  - Type: integration
  - Input: Explicit full regression evidence lacks start marker in `tests/.raw/test-execution.log`.
  - Expected: Evidence validation fails deterministically.

- **TC-27: test-result-review fails missing full-regression end marker**
  - Type: integration
  - Input: Explicit full regression evidence lacks end marker in raw log.
  - Expected: Evidence validation fails deterministically.

- **TC-28: test-result-review passes valid full-regression markers**
  - Type: integration
  - Input: Explicit full regression evidence has both start and end markers in order.
  - Expected: Evidence validation passes.

- **TC-29: get-next-action exposes final-regression schema**
  - Type: unit
  - Input: Query next action after `retro`.
  - Expected: Response uses `next-action/final-regression.schema.json` and exposes `final-regression` as impl-phase mainline step.

- **TC-30: final-regression requires no normal approval**
  - Type: acceptance
  - Input: Normal flow reaches final-regression.
  - Expected: User approval is not required before executing final-regression.

- **TC-31: Passing final-regression routes to finalize-commit**
  - Type: acceptance
  - Input: final-regression passes.
  - Expected: Next action is `finalize-commit`.

- **TC-32: gate-impl allows deferred test-execute full regression**
  - Type: integration
  - Input: `test-execute-result.json` has category `full-regression-deferred`; other required evidence passes.
  - Expected: `gate-impl` does not block solely due to deferred full regression.

- **TC-33: gate-impl blocks targeted regression failure**
  - Type: integration
  - Input: Targeted or explicit full test-execute regression failed.
  - Expected: `gate-impl` blocks.

- **TC-34: gate-impl blocks invalid v2 artifact**
  - Type: integration
  - Input: Test execution artifact is invalid v2 format.
  - Expected: `gate-impl` blocks.

- **TC-35: gate-impl blocks missing test-result-review pass**
  - Type: integration
  - Input: `test-result-review` has not passed.
  - Expected: `gate-impl` blocks.

- **TC-36: gate-impl blocks failed final-regression evidence**
  - Type: integration
  - Input: `final-regression-result.json` exists with `result=fail`.
  - Expected: `gate-impl` blocks.

- **TC-37: Spec-local tests exist with requirement headers**
  - Type: acceptance
  - Input: Inspect `specs/259-final-regression-loop/tests`.
  - Expected: New behavior is covered by spec-local tests, and each test file includes `// spec: R<N>` headers mapping coverage to requirements.

- **TC-38: Shared public flow contract tests remain focused**
  - Type: unit
  - Input: Inspect added or updated shared unit tests for flow contracts.
  - Expected: Tests cover changed public contracts only and do not duplicate broad spec-local behavior.

- **TC-39: R8 text update regression is excluded**
  - Type: unit
  - Input: Test planning for R8.
  - Expected: No automated test required because R8 explicitly states testing is not required.
