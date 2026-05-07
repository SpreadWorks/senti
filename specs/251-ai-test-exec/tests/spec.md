# Test Design

### Test Design

- **TC-1: impl phase mainline order**
  - Type: unit
  - Input: `FLOW_DEFINITION.impl.children`
  - Expected: order is `implement → test-execute → test-result-review → review-impl → gate-impl → retro`; each new node has correct `outputSchemaRef`.

- **TC-2: task subflow excludes spec-level test steps**
  - Type: unit
  - Input: `TASK_DEFINITION`
  - Expected: no `test-execute`, `test-result-review`, or `retro` added to task flow.

- **TC-3: new command registry entries**
  - Type: unit
  - Input: `src/flow/registry.js`
  - Expected: `run-test-execute` and `run-test-result-review` are registered with empty user-facing args and post hooks that mark steps done.

- **TC-4: next-action mapping supports new steps**
  - Type: unit
  - Input: `get-next-action` for `test-execute`, `test-result-review`, `retro`
  - Expected: each step resolves to the correct `instructionsKey` and schema.

- **TC-5: test-execute happy path writes artifacts**
  - Type: integration
  - Input: spec with package test script and passing tests
  - Expected: agent invokes a discovered test command via Bash and writes `specs/<spec>/test-execute-result.json` plus `specs/<spec>/tests/.raw/test-execution.log`.

- **TC-6: test-execute result schema**
  - Type: unit
  - Input: generated `test-execute-result.json`
  - Expected: validates against schema `{ version: "1", raw_output_path, summary[] }`; each summary item has `id`, `result`, optional `error`, and evidence fields.

- **TC-7: raw output is persistent**
  - Type: integration
  - Input: completed `test-execute`
  - Expected: raw log is under `specs/<spec>/tests/.raw/`, not `.tmp/`, and is not excluded by `.gitignore`.

- **TC-8: test-execute command discovery variants**
  - Type: unit
  - Input: projects configured for `node --test`, `jest`, `pytest`, `phpunit`, and `package.json scripts.test`
  - Expected: prompt/runner logic instructs discovery and verbose execution without hardcoding one runner.

- **TC-9: test-execute cannot discover command**
  - Type: integration
  - Input: spec with no recognizable test command
  - Expected: command exits with `EXIT_ERROR`/code `1`; no false PASS artifact is produced.

- **TC-10: test-execute agent failure**
  - Type: integration
  - Input: mocked `agent.call()` failure
  - Expected: command exits `1` as internal error and reports failure clearly.

- **TC-11: agent abstraction and session separation**
  - Type: unit
  - Input: `run-test-execute` and `run-test-result-review`
  - Expected: both use `ensureAgent`; separate steps use separate `agent.call()` invocations without shared context.

- **TC-12: test-result-review happy path**
  - Type: integration
  - Input: valid result JSON, raw log, spec requirements, and matching test files
  - Expected: writes `test-result-review.json` with `verdict: "pass"` and `checked_items[]`, plus `test-result-review.md`.

- **TC-13: five deterministic review checks**
  - Type: unit
  - Input: evidence covering file path, req ID, test count, stack trace, duration
  - Expected: each of the five check items is evaluated and recorded.

- **TC-14: review fails on missing test file**
  - Type: unit
  - Input: evidence references nonexistent `test_file`
  - Expected: `verdict: "fail"` with failed checked item.

- **TC-15: review fails on missing req ID appearance**
  - Type: unit
  - Input: summary references a requirement not present in test header/content
  - Expected: `verdict: "fail"`.

- **TC-16: review fails on test count mismatch**
  - Type: unit
  - Input: summary count differs from raw output count
  - Expected: `verdict: "fail"`.

- **TC-17: review validates stack trace relevance**
  - Type: unit
  - Input: failing test with unrelated or impossible stack trace
  - Expected: `verdict: "fail"`.

- **TC-18: review validates duration consistency**
  - Type: unit
  - Input: summary durations inconsistent with raw output
  - Expected: `verdict: "fail"`.

- **TC-19: summary completeness happy path**
  - Type: unit
  - Input: all `spec.json.requirements` testable IDs appear exactly once in summary
  - Expected: completeness check passes.

- **TC-20: summary completeness failure paths**
  - Type: unit
  - Input: missing ID, duplicate ID, and unknown ID cases
  - Expected: each case produces `verdict: "fail"`.

- **TC-21: lowercase verdict contract**
  - Type: unit
  - Input: artifacts with `PASS`, `FAIL`, `pass`, `fail`
  - Expected: schemas accept only lowercase `pass`/`fail`.

- **TC-22: retro happy path**
  - Type: integration
  - Input: `test-execute-result.json` with pass/fail requirement results
  - Expected: writes `retro.json`; pass maps to `done`, fail maps to `not_done`; no `partial`.

- **TC-23: retro missing result file**
  - Type: integration
  - Input: no `test-execute-result.json`
  - Expected: explicit error and exit code `1`.

- **TC-24: retro invalid JSON**
  - Type: integration
  - Input: malformed `test-execute-result.json`
  - Expected: explicit parse/schema error and exit code `1`.

- **TC-25: retro removes direct test execution dependency**
  - Type: unit
  - Input: `run-retro.js` and `req-map.js`
  - Expected: no dependency on `execFileSync('node --test')`, `parseTapOutput`, `extractReqResults`, or `evaluateReqByResults`.

- **TC-26: obsolete req-map helpers removed**
  - Type: unit
  - Input: exported API and consumers
  - Expected: `parseTapOutput`, `extractReqResults`, `evaluateReqByResults` do not exist and no consumers call them.

- **TC-27: non-test steps do not invoke test runners**
  - Type: unit
  - Input: grep over `run-retro.js`, `run-gate.js`, `commands/review.js`
  - Expected: no direct invocation of `node --test`, `npm test`, `jest`, `pytest`, or `phpunit`.

- **TC-28: gate-impl integration PASS**
  - Type: integration
  - Input: `test-result-review.json.verdict = "pass"` and all requirements pass in `test-execute-result.json`
  - Expected: gate returns PASS.

- **TC-29: gate-impl integration failure modes**
  - Type: integration
  - Input: missing review file, missing execute file, review verdict fail, or unmet requirement
  - Expected: gate returns FAIL for each case.

- **TC-30: task gate remains diff/guardrail only**
  - Type: unit
  - Input: task-level `gate-impl`
  - Expected: does not require `test-result-review.json` or `test-execute-result.json`.

- **TC-31: gate phase inference distinguishes scopes**
  - Type: unit
  - Input: in-progress flow-level `gate-impl` and task-level `gate-impl`
  - Expected: resolves to `integration` for flow-level and `task-impl` for task-level.

- **TC-32: gate next transitions**
  - Type: unit
  - Input: PASS/FAIL from `task-impl`, `integration`, and `gate-impl`
  - Expected: task-impl PASS goes to review; integration/gate-impl PASS goes to retro; failure paths match new lifecycle.

- **TC-33: review fix resets stale downstream steps**
  - Type: integration
  - Input: review applies code changes after prior test artifacts exist
  - Expected: `test-execute`, `test-result-review`, `gate-impl`, and `retro` reset to pending.

- **TC-34: run-review delegates next action**
  - Type: unit
  - Input: completed impl review
  - Expected: no hardcoded transition to `finalize` or `apply`; next action comes from definition.

- **TC-35: finalize post-hook no longer runs retro**
  - Type: integration
  - Input: finalize-commit post hook execution
  - Expected: retro is not invoked; report generation, issue comment, and artifact commit remain.

- **TC-36: finalize help and prompt text**
  - Type: unit
  - Input: registry help and finalize prompts
  - Expected: post-hook description mentions report/issue comment/artifact commit, not retro.

- **TC-37: artifact commit boundary**
  - Type: integration
  - Input: finalize-commit with implementation changes and test artifacts
  - Expected: implementation commit excludes `test-execute-result.json`, raw log, `test-result-review.json`, and `retro.json`; artifacts are committed separately.

- **TC-38: report generation inputs**
  - Type: integration
  - Input: `retro.json`, `test-execute-result.json`, `test-result-review.json`
  - Expected: `report.md` and `report.json` are generated from those files, not `state.test.summary`.

- **TC-39: report command schema validation**
  - Type: unit
  - Input: invalid retro, execute, or review artifact
  - Expected: report command fails before consuming invalid data.

- **TC-40: test-only auto skip path**
  - Type: integration
  - Input: test-only flow where implement/gate-impl would previously be skipped
  - Expected: production implementation may be skipped, but `test-execute` and `test-result-review` still run.

- **TC-41: prompt cleanup for no-test execution**
  - Type: unit
  - Input: implement, review, task impl, task review, plan test prompts
  - Expected: direct `npm test`, `node --test`, or “rerun tests” instructions are removed where specified.

- **TC-42: new step prompts exist**
  - Type: unit
  - Input: `impl/test-execute.md`, `impl/test-result-review.md`, `impl/retro.md`
  - Expected: prompts exist and contain required instructions for command discovery, verbose mode, artifact writing, no raw-output summary, read-only retro behavior, and step completion via post-hook.

- **TC-43: get-prompt lifecycle choices**
  - Type: unit
  - Input: finalize step choices
  - Expected: retro is not shown as finalize choice; lifecycle reflects `implement → test-execute → test-result-review → review → gate-impl → retro → finalize-*`.

- **TC-44: next-action schemas exist**
  - Type: unit
  - Input: schema files for `test-execute`, `test-result-review`, `retro`
  - Expected: all exist and are referenced by corresponding flow nodes.

- **TC-45: persisted artifact schemas exist**
  - Type: unit
  - Input: `test-execute-result.schema.json`, `test-result-review.schema.json`, `retro.schema.json`
  - Expected: schemas exist and are used before consumption by execute/review/gate/retro/report paths.

- **TC-46: header coverage becomes FAIL**
  - Type: unit
  - Input: testable requirement with no declared test header
  - Expected: `finalGaps` includes `{ type: "missing-header", reqId, desc, suggestion }` and verdict is FAIL.

- **TC-47: header-lie detection**
  - Type: unit
  - Input: test file declares req ID but test content does not verify it
  - Expected: `finalGaps` includes `{ type: "header-lie", reqId, file, content_excerpt }` and verdict is FAIL.

- **TC-48: validateTestHeaders helper reuse**
  - Type: unit
  - Input: `review.js` header coverage path
  - Expected: deterministic gaps use `validateTestHeaders` outputs: `uncoveredRequirements`, `headerNoTest`, `testNoHeader`.

- **TC-49: guardrail phase audit**
  - Type: unit
  - Input: all `src/presets/*/guardrail.json`
  - Expected: runtime pass/fail test guardrails are integration-phase only; task-impl guardrails are diff/header-only.

- **TC-50: status flattening**
  - Type: unit
  - Input: flow state with nested impl children
  - Expected: `get-status` progress counts nested `test-execute`, `test-result-review`, and `retro`.

- **TC-51: artifact overwrite policy**
  - Type: integration
  - Input: rerun `test-execute`, `test-result-review`, `retro`, and report
  - Expected: each rerun overwrites its own artifact unconditionally; retro behaves as force-enabled.

- **TC-52: exit code contract**
  - Type: integration
  - Input: success, prerequisite error, artifact invalid error, agent failure, gate/review FAIL verdict
  - Expected: success exits `0`; user/internal errors exit `1`; gate/review FAIL exits `0` with `envelope.ok=false`.

- **TC-53: skill template lifecycle update**
  - Type: acceptance
  - Input: generated/upgraded `src/templates/skills/sdd-forge.flow/SKILL.md`
  - Expected: old finalize retro and `flow run tests` baseline descriptions are removed; new lifecycle is documented.

- **TC-54: upgrade reflects template changes**
  - Type: acceptance
  - Input: after modifying templates/presets, run `sdd-forge upgrade`
  - Expected: generated project skills/configs update only changed files.

- **TC-55: existing regression tests updated**
  - Type: acceptance
  - Input: project test suite including specified unit/e2e files
  - Expected: lifecycle whitelist and old retro-post-hook assumptions match the new flow.

- **TC-56: spec verification tests placement**
  - Type: unit
  - Input: tests for this spec
  - Expected: verification tests live under `specs/251-ai-test-exec/tests/` and begin with `// spec: R<N>` headers.

- **TC-57: CHANGELOG alpha migration note**
  - Type: unit
  - Input: CHANGELOG entry
  - Expected: documents breaking alpha behavior, manual `flow set step retro done` workaround for in-progress flows, retained retro CLI args, and new artifacts.

- **TC-58: user-facing CLI args absent**
  - Type: unit
  - Input: registry entries for `test-execute`, `test-result-review`
  - Expected: `args: { flags: [], options: [] }`; validation relies on flow state prerequisites.
