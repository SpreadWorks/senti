   - **Goal:** verify the integrity of `test-execute-result.json` against the raw output log and the actual code. Detect hallucination (fabricated results) by cross-referencing.
   - **Inputs:**
     - `specs/<spec>/test-execute-result.json` (executor's claimed result)
     - `specs/<spec>/tests/.raw/test-execution.log` (raw stdout/stderr)
     - `specs/<spec>/spec.json` (testable requirement IDs)
     - actual test files under `specs/<spec>/tests/`
   - **Required check items (verify ALL):**
     1. **file_path_exists** — every `evidence.test_file` exists in the actual code; `evidence.test_name` appears in that file.
     2. **req_id_in_output** — every requirement reported as `pass` has its requirement ID (R-N) appearing in the raw output (test name or output line).
     3. **test_count_consistency** — total number of tests reported (sum of `summary[]` entries) matches the test count in the raw output.
     4. **stack_trace_validity** — for `result: "fail"` entries with stack traces, the file/line referenced exists in the actual code.
     5. **summary_completeness** — every testable requirement (from `spec.json`, `requirements[].testable !== false`) is present in `summary[]` exactly once. No missing IDs, no duplicates, no unknown IDs.
   - **Outputs:**
     - `specs/<spec>/test-result-review.json` (machine-readable verdict, schema = `src/flow/schemas/test-result-review.schema.json`)
     - `specs/<spec>/test-result-review.md` (human-readable verdict + checked_items)
   - **Result schema (canonical):**
     ```json
     {
       "verdict": "pass",
       "checked_items": [
         { "check": "file_path_exists", "result": "pass", "detail": "all 5 test files verified" },
         { "check": "req_id_in_output", "result": "pass", "detail": "R1..R5 all appear in raw output" },
         { "check": "test_count_consistency", "result": "pass", "detail": "5 reported, 5 in raw output" },
         { "check": "stack_trace_validity", "result": "pass", "detail": "no failures" },
         { "check": "summary_completeness", "result": "pass", "detail": "all testable requirements present" }
       ],
       "result_file_path": "specs/<spec>/test-execute-result.json",
       "raw_output_path": "specs/<spec>/tests/.raw/test-execution.log"
     }
     ```
   - **Verdict semantics:**
     - `verdict: "pass"` — all 5 checked items pass.
     - `verdict: "fail"` — any check item fails. Set `invalid_reason` with a concise explanation. Downstream `gate-impl` and `retro` will treat this as test failure (the result file is untrusted).
   - **Separation from executor:** this step is invoked in a separate agent session. The reviewer must not see the executor's intermediate state — only the persisted artifacts. Configure `agent.providers` for model differentiation if desired (executor=Claude / reviewer=Codex etc.) — recommended but not required.
   - **Verdict values are lowercase:** `"pass"` / `"fail"`.
   - **On complete:** the registry post-hook marks this step done automatically.
