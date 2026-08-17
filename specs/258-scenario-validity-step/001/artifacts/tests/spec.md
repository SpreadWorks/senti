# Test Design

### Test Design

- **TC-1: Flow definition contains scenario-validity in correct plan order**
  - Type: unit
  - Input: Inspect `FLOW_DEFINITION` plan phase leaves.
  - Expected: `scenario-validity` appears after `test` and before `review-test`.

- **TC-2: Flow definition scenario-validity metadata is correct**
  - Type: unit
  - Input: Read the `scenario-validity` leaf definition.
  - Expected: Action is `run-scenario-validity`, instructions key is `plan.scenario-validity`, output schema is `next-action/scenario-validity.schema.json`, and `maxAttempts` resolves to `3`.

- **TC-3: Registry exposes internal scenario-validity command**
  - Type: unit
  - Input: Query flow registry for `sdd-forge flow run scenario-validity`.
  - Expected: Command exists as an internal flow command, requires an active flow, maps to scenario-validity implementation, and exposes no user-facing positional arguments.

- **TC-4: Scenario-validity command rejects inactive flow**
  - Type: integration
  - Input: Run `sdd-forge flow run scenario-validity` outside an active flow.
  - Expected: Command fails before execution and does not mark any step done.

- **TC-5: Scenario-validity command rejects positional arguments**
  - Type: integration
  - Input: Run `sdd-forge flow run scenario-validity extra`.
  - Expected: Command fails with argument validation error and does not execute tests.

- **TC-6: Passing scenario-validity marks only scenario-validity step done**
  - Type: integration
  - Input: Active flow with all testable requirements classified as `expected_fail`.
  - Expected: Command passes and marks `scenario-validity` done.

- **TC-7: Blocking scenario-validity does not mark step done**
  - Type: integration
  - Input: Active flow where one requirement is classified as `unexpected_pass`.
  - Expected: Command returns block/failure and leaves `scenario-validity` incomplete.

- **TC-8: Discovers only spec-local JavaScript test basenames**
  - Type: unit
  - Input: Files under `specs/foo/tests/`: `a.test.js`, `b.spec.ts`, `c.test.mjs`, `d.spec.mjs`.
  - Expected: All matching files are selected for execution.

- **TC-9: Ignores non-matching files in spec-local tests directory**
  - Type: unit
  - Input: Files under `specs/foo/tests/`: `helper.js`, `a.tests.js`, `b.test.jsx`, `c.spec.md`, `README.md`.
  - Expected: None are executed as scenario-validity tests.

- **TC-10: Ignores matching tests outside the active spec**
  - Type: integration
  - Input: Matching files under project `tests/`, another spec’s `specs/bar/tests/`, and active `specs/foo/tests/`.
  - Expected: Only files under `specs/foo/tests/` are executed.

- **TC-11: Does not run root regression command**
  - Type: integration
  - Input: Project root regression script configured to fail, spec-local scenario tests configured to run.
  - Expected: Scenario-validity executes only spec-local tests and does not invoke the root regression command.

- **TC-12: Diff precheck allows only spec planning/test artifacts**
  - Type: integration
  - Input: `git diff --name-only <baseBranch> -- src/ tests/ package.json .sdd-forge/config.json` returns no disallowed paths.
  - Expected: Scenario-validity proceeds to execute spec-local tests.

- **TC-13: Diff precheck blocks implementation changes**
  - Type: integration
  - Input: Diff precheck returns `src/foo.js`.
  - Expected: Result is written with classification `invalid_test`; tests are not executed.

- **TC-14: Diff precheck blocks root test changes**
  - Type: integration
  - Input: Diff precheck returns `tests/foo.test.js`.
  - Expected: Result is `invalid_test`; spec-local tests are not executed.

- **TC-15: Diff precheck blocks package/config changes**
  - Type: integration
  - Input: Diff precheck returns `package.json` or `.sdd-forge/config.json`.
  - Expected: Result is `invalid_test`; tests are not executed.

- **TC-16: Diff precheck allows active spec review and draft files**
  - Type: unit
  - Input: Changed paths include `specs/foo/spec.json`, `draft.json`, `issue-log.json`, `spec-review.md`, and `draft-review-abc.md`.
  - Expected: Paths are accepted by precheck.

- **TC-17: Diff precheck rejects another spec’s allowed-looking files**
  - Type: unit
  - Input: Active spec is `foo`; changed path is `specs/bar/spec.json`.
  - Expected: Path is rejected and classification is `invalid_test`.

- **TC-18: Writes artifacts on successful invocation**
  - Type: integration
  - Input: Scenario-validity runs and classifies all requirements as `expected_fail`.
  - Expected: Writes `specs/<spec>/scenario-validity-result.json` and `specs/<spec>/tests/.raw/scenario-validity.log`.

- **TC-19: Writes artifacts on blocked invocation**
  - Type: integration
  - Input: Diff precheck fails before tests execute.
  - Expected: Both result JSON and raw log are still written.

- **TC-20: Result JSON contains required process fields**
  - Type: unit
  - Input: Parse generated `scenario-validity-result.json`.
  - Expected: Contains `version`, `raw_output_path`, `command`, `process.started`, `process.exitCode`, `process.signal`, `process.timedOut`, and `process.spawnError`.

- **TC-21: Result contains one summary entry per testable requirement**
  - Type: unit
  - Input: Spec with three testable requirements.
  - Expected: Result summary has exactly three entries, each tied to a testable requirement.

- **TC-22: Valid summary classifications are accepted**
  - Type: unit
  - Input: Summary entries using `expected_fail`, `unexpected_pass`, `invalid_test`, `skipped`, and `not_run`.
  - Expected: Schema/artifact validation accepts only these values.

- **TC-23: Unknown summary classification is rejected**
  - Type: unit
  - Input: Summary entry classification `passed` or `failed`.
  - Expected: Artifact validation fails.

- **TC-24: Step passes only with all expected_fail**
  - Type: unit
  - Input: All testable requirements classified as `expected_fail`.
  - Expected: Scenario-validity result passes.

- **TC-25: Step blocks on unexpected_pass**
  - Type: unit
  - Input: One summary entry is `unexpected_pass`; others are `expected_fail`.
  - Expected: Scenario-validity blocks.

- **TC-26: Step blocks on invalid_test, skipped, or not_run**
  - Type: unit
  - Input: At least one testable requirement classified as `invalid_test`, `skipped`, or `not_run`.
  - Expected: Scenario-validity does not pass.

- **TC-27: Evidence requires test_file, test_name, command, and raw_output_lines**
  - Type: unit
  - Input: Summary entry missing one evidence field.
  - Expected: Artifact validation rejects the result.

- **TC-28: Evidence raw_output_lines must point into scenario-validity log**
  - Type: unit
  - Input: Evidence references another log file or invalid line range.
  - Expected: Artifact validation rejects the result.

- **TC-29: Evidence raw_output_lines valid range is accepted**
  - Type: unit
  - Input: Evidence references existing lines in `specs/<spec>/tests/.raw/scenario-validity.log`.
  - Expected: Artifact validation passes.

- **TC-30: Scenario-validity removes stale artifacts before rerun**
  - Type: integration
  - Input: Existing stale `scenario-validity-result.json` and `.raw/scenario-validity.log`, then rerun command.
  - Expected: Old files are removed/replaced; new result and log contain only current invocation data.

- **TC-31: Test artifact helpers include scenario-validity artifacts**
  - Type: unit
  - Input: Inspect `DURABLE_TEST_ARTIFACT_RELATIVE_PATHS` and `RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS`.
  - Expected: Both include `scenario-validity-result.json` and `tests/.raw/scenario-validity.log`.

- **TC-32: Finalize commit excludes scenario-validity artifacts**
  - Type: integration
  - Input: Run finalize commit staging with scenario-validity artifacts present.
  - Expected: Implementation commit does not stage `scenario-validity-result.json` or `tests/.raw/scenario-validity.log`.

- **TC-33: Scenario-validity artifacts coexist with test-execute artifacts**
  - Type: integration
  - Input: Existing `test-execute-result.json` and `tests/.raw/test-execution.log`, then run scenario-validity.
  - Expected: Existing test-execute artifacts are preserved; scenario-validity writes its own result and log separately.

- **TC-34: Prompt wording describes phase split**
  - Type: acceptance
  - Input: Inspect generated prompts for `plan/test`, `plan/scenario-validity`, `plan/review-test`, and `impl/test-execute`.
  - Expected: Prompts distinguish test writing, pre-implementation spec-local runtime validation, static anti-pattern review, and post-implementation/root regression verification.

- **TC-35: Review-test prompt lists all six anti-pattern classes**
  - Type: acceptance
  - Input: Inspect `plan/review-test` prompt guidance.
  - Expected: Guidance includes assertions bypassing production code, input-as-expected round trips, always-matching regex, existence-only checks, catch-all PASS handling, and split-removed separator literal assertions.

- **TC-36: Flow skill template includes scenario-validity dispatcher guidance**
  - Type: acceptance
  - Input: Inspect generated `sdd-forge.flow` skill template.
  - Expected: Plan-phase dispatcher guidance includes `scenario-validity` after test generation.

- **TC-37: Upgrade installs updated flow skill output**
  - Type: acceptance
  - Input: Run `sdd-forge upgrade` after template changes.
  - Expected: Installed skill output includes `scenario-validity` in plan-phase guidance.

- **TC-38: End-to-end plan flow order includes scenario-validity gate**
  - Type: acceptance
  - Input: Run a representative SDD plan flow through draft, spec, approval, test, scenario-validity, review-test.
  - Expected: Flow requires scenario-validity before review-test and blocks progression when scenario-validity fails.
