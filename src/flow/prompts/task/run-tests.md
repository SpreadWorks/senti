Use this guidance for the per-task test execution step that runs after task implementation.

- Read the context provided by `flow get next-action`: `task_spec` and `testlog`.
- Run the task's test suite. Save output under the resolved work directory:
  ```
  node tests/run.js --filter <task-test-pattern> > <workDir>/logs/task-test.log 2>&1
  ```
- Inspect the log:
  - **All pass:** record `sdd-forge flow set test-summary --unit N --integration N --acceptance N` (use actual counts) and advance to `task.review` (or whichever next step the registry indicates).
  - **Failures:**
    - If caused by this task's implementation, fix the production code.
    - If caused by pre-existing bugs outside the task scope, record them in issue-log (`sdd-forge flow set issue-log --step task.run-tests --reason "..."`).
    - **Retry limit: 5 attempts.** If failures persist after 5 fix-and-rerun cycles, STOP and return control to the user.
- Do not advance until tests pass or every remaining failure is recorded as a deferred issue.
