   - **Single execution point:** This step is the **only** place where tests run. retro / review-impl / gate-impl read the result file produced here; they MUST NOT re-run tests.
   - **Test command discovery:** Determine the test runner from the project's declarative configuration in this priority order:
     1. `.sdd-forge/config.json` top-level `test.command`
     2. `package.json` `scripts.test`, executed as argv `["npm","test","--"]`
     3. `composer.json` `scripts.test`, executed as argv `["composer","run-script","test","--"]`
     4. `Makefile` target `test`, executed as argv `["make","test"]`
   - Do not use non-declarative documentation hints, language-specific implicit config, or task-prompt test command settings as root regression command sources.
   - If no supported command can be determined for a required project regression, do NOT guess. Fail before writing a normal `test-execute-result.json` and record the prerequisite failure in issue-log.
   - **Verbose execution:** Run the test command with verbose / non-quiet flags so individual test names appear in output (`--reporter spec`, `--verbose`, `jest --verbose`, `pytest -v`, etc.). Do not summarize; preserve raw output verbatim.
   - **Outputs:**
     - `specs/<spec>/test-execute-result.json` (machine-readable summary, schema = `src/flow/schemas/test-execute-result.schema.json`)
     - `specs/<spec>/tests/.raw/test-execution.log` (raw stdout/stderr concatenation)
     - The result file is overwritten unconditionally on each invocation. No caching.
   - **Result schema (canonical):**
     ```json
     {
       "version": "2",
       "raw_output_path": "specs/<spec>/tests/.raw/test-execution.log",
       "summary": [
         {
           "id": "R1",
           "result": "pass",
           "evidence": {
             "test_file": "specs/<spec>/tests/foo.test.js",
             "test_name": "R1: parser accepts valid header",
             "command": "node --test specs/<spec>/tests/foo.test.js",
             "raw_output_lines": { "start_line": 12, "end_line": 18 }
           }
         }
       ],
       "regression": {
         "required": true,
         "mode": "full",
         "root_test_command": "npm test --",
         "root_test_command_source": "package.json:scripts.test",
         "command": "npm test --",
         "result": "pass",
         "raw_output_lines": { "start_line": 19, "end_line": 42 },
         "changed_files": [{ "status": "modified", "path": "lib/example.js" }],
         "trigger_relevant_changed_files": [{ "status": "modified", "path": "lib/example.js" }]
       }
     }
     ```
   - Each `summary[]` entry MUST include `evidence` with `test_file`, `test_name`, `command`, and `raw_output_lines` as `{start_line,end_line}`.
   - Required project regression failures that start and exit non-zero, time out, or signal are valid v2 artifacts with `regression.result: "fail"`. Downstream gate blocks them.
   - **Verdict values are lowercase:** `"pass"` / `"fail"`. Never `"PASS"` / `"FAIL"`.
   - **MUST: AI summary of raw output is forbidden.** Save the raw stdout/stderr exactly as produced by the test command.
   - **On complete:** the registry post-hook marks this step done automatically. Do not call `flow set step` manually.
