Use this guidance when a task enters its `write-tests` step. The AI writes tests against the task spec *before* implementation. To preserve test-first determinism:

- **MUST: Do not reference implementation diffs or implementation target files while the task is in `write-tests`.** Writing tests from the implementation shape leaks the implementation's assumptions into the tests and breaks test-first.
- The `flow get context` tool enforces this as a hard wall: files listed in the spec's `implementationTargets` are blocked in path mode and silently excluded from list / search results while `write-tests` is in progress. This skill policy is the redundant textual reinforcement of that tool-side block.
- Derive tests from spec requirements and acceptance criteria alone; if the spec is ambiguous, resolve ambiguity in the spec (plan phase), not by peeking at the intended implementation.
- Read the context provided by `flow get next-action`: `task_spec` and `related_summary`.
- Write tests under the project's test root (typically `tests/unit/` or `tests/integration/`) following the placement decision rule: if a future change breaks this test, is that always a bug? YES → `tests/`, NO → `specs/<spec>/tests/`.
- Tests should fail initially (since implementation has not happened yet).
- Save test execution output to a log file under the resolved work directory:
  ```
  node tests/run.js --filter <task-test-pattern> > <workDir>/logs/task-test.log 2>&1
  ```
- On complete, the next-action CLI advances to `task.approval-2` (or directly to `task.impl` depending on the configured task workflow shape).
