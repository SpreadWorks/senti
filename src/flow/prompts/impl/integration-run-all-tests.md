Use this guidance when the integration phase requires running the full test suite (not just the integration scope) to verify cross-feature stability.

- Read the context provided by `flow get next-action`: `all_task_summary`, `testlog`, and `full_diff` (full diff against base branch).
- Run the project's full test suite. Save output to a log file under the resolved work directory:
  ```
  npm test > <workDir>/logs/all-tests.log 2>&1
  ```
- Inspect the log for failures, paying particular attention to tests outside the directly-touched task surfaces (those are the regressions a full-suite run is meant to catch).
- **If all tests pass:** record `sdd-forge flow set test-summary --unit N --integration N --acceptance N` (use actual counts for each category) and advance.
- **If tests fail:**
  - Cross-reference each failure against `full_diff` to identify whether the change set caused the failure.
  - If the failure is caused by this change set, fix the offending production code. Do NOT silently adjust tests.
  - If the failure is pre-existing, record it in issue-log (`sdd-forge flow set issue-log --step integration-run-all-tests --reason "..."`) and decide whether to address it in this spec or defer.
  - **Retry limit: 5 attempts.** If full-suite failures persist after 5 fix-and-rerun cycles, STOP and return control to the user.
- Do not advance until the full suite is green or every remaining failure is recorded as a deferred issue.
