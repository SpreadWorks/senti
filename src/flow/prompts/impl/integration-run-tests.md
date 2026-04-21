Use this guidance when the integration phase requires running scoped integration tests after writing them.

- Read the context provided by `flow get next-action`: `all_task_summary` and `testlog` (recent test execution evidence).
- Run the integration test suite scoped to recently changed task surfaces. Save output to a log file under the resolved work directory (priority: `SDD_FORGE_WORK_DIR` env > `config.agent.workDir` > `.tmp`):
  ```
  node tests/run.js --scope integration > <workDir>/logs/integration-test.log 2>&1
  ```
- Inspect the log for failures.
- **If tests pass:** record the result via `sdd-forge flow set test-summary --integration N` (use actual count) and advance.
- **If tests fail:**
  - If the failure is a real integration regression introduced by recent task changes, fix the offending task implementation. Do NOT modify integration tests to make them pass.
  - If the failure is a pre-existing bug outside this integration's scope, record it in issue-log (`sdd-forge flow set issue-log --step integration-run-tests --reason "..."`) before applying any workaround.
  - **Retry limit: 5 attempts.** If integration tests do not pass after 5 fix-and-rerun cycles, STOP and return control to the user.
- Do not advance until tests pass.
