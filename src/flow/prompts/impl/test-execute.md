   - **Single execution point:** This step is the **only** place where tests run. retro / review-impl / gate-impl read the result file produced here; they MUST NOT re-run tests.
   - **Test command discovery:** Determine the test runner from the project's declarative configuration in this priority order:
     1. `package.json` `scripts.test` (Node.js / npm projects)
     2. `composer.json` `scripts.test` (PHP / composer)
     3. `Makefile` target `test`, `pyproject.toml` `[tool.pytest]`, `setup.cfg`, `tox.ini` (Python)
     4. `config.test.command` in `.sdd-forge/config.json` (project override)
     5. README / docs hint about how to run tests
   - If no command can be determined, do NOT guess. Write an explicit error to `test-execute-result.json` `summary[].error` and exit non-zero.
   - **Verbose execution:** Run the test command with verbose / non-quiet flags so individual test names appear in output (`--reporter spec`, `--verbose`, `jest --verbose`, `pytest -v`, etc.). Do not summarize; preserve raw output verbatim.
   - **Outputs:**
     - `specs/<spec>/test-execute-result.json` (machine-readable summary, schema = `src/flow/schemas/test-execute-result.schema.json`)
     - `specs/<spec>/tests/.raw/test-execution.log` (raw stdout/stderr concatenation)
     - The result file is overwritten unconditionally on each invocation. No caching.
   - **Result schema (canonical):**
     ```json
     {
       "version": "1",
       "raw_output_path": "specs/<spec>/tests/.raw/test-execution.log",
       "summary": [
         {
           "id": "R1",
           "result": "pass",
           "evidence": {
             "test_file": "specs/<spec>/tests/foo.test.js",
             "test_name": "R1: parser accepts valid header",
             "command": "node --test specs/<spec>/tests/foo.test.js",
             "raw_output_lines": [12, 18]
           }
         }
       ]
     }
     ```
   - Each `summary[]` entry MUST include `evidence` with `test_file`, `test_name`, `command`, and `raw_output_lines` (line range in the raw output where the test result appears).
   - **Verdict values are lowercase:** `"pass"` / `"fail"`. Never `"PASS"` / `"FAIL"`.
   - **MUST: AI summary of raw output is forbidden.** Save the raw stdout/stderr exactly as produced by the test command.
   - **On complete:** the registry post-hook marks this step done automatically. Do not call `flow set step` manually.
