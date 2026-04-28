   - If guardrail articles for the test phase have NOT been loaded in this session: `sdd-forge flow get guardrail test`. If output is non-empty, follow these principles when writing tests. Skip if already present in context.
   - If code changes exist, implementation verification test is required in principle.
   - AI decides the appropriate test type based on the project's test infrastructure (no separate test-type selection).
   - AI shares briefly which test framework will be used and what will be verified (not a separate approval gate).
   - **MUST: Decide test placement based on these criteria:**
     - **`tests/` (formal tests, run by `npm test`):** Public API / function interface contract tests, CLI command behavior specs, preset integrity checks — tests where breakage indicates a bug regardless of which spec introduced them.
     - **`specs/<spec>/tests/` (spec verification tests, NOT run by `npm test`):** Tests that only verify this spec's requirements are met, bug fix reproduction tests, temporary setup/integration verification. These are kept as history, not maintained long-term.
     - **Decision rule:** Ask "If a future change breaks this test, is that always a bug?" — YES → `tests/`, NO → `specs/<spec>/tests/`.
   - Write test code under `specs/<spec>/tests/`. Tests should fail initially (before implementation).
   - Run tests with `node --test specs/<spec>/tests/*.test.js` to verify they fail as expected.
   - **MUST: If a test reveals a production code bug that is outside the current spec's scope**, record it in issue-log (`sdd-forge flow set issue-log --step test --reason "..."`) before adjusting the test to match current behavior. Do not silently fix or skip the test.
   - **MUST: Create `specs/<spec>/tests/test-map.json`** mapping requirement IDs to test names.
     Schema: `{ [reqId: string]: string[] }` — keys are requirement IDs from spec.json, values are arrays of test names (matching the test description strings used in `describe`/`it` blocks).
     Example:
     ```json
     {
       "R1": ["241-set-files.test.js > should create file-map.json", "241-set-files.test.js > should deduplicate"],
       "R2": ["241-set-files.test.js > should create file-map.json"],
       "R3": []
     }
     ```
     - Every requirement ID from spec.json must appear as a key (empty array if no tests cover it).
     - Test names should match the `> ` separated format: `<file> > <test description>`.
   - **If no test environment**:
     - AI performs spec-implementation alignment check after coding.
     - Compare spec Requirements against actual code changes.
   - **If test environment needs to be set up**:
     - Treat as a separate spec (out of scope for current feature spec).
   - **On complete**:
     - `sdd-forge flow set step test done`
   - **After test step is done**:
     - Run `sdd-forge flow get prompt plan.complete` and present the choices.
     - **autoApprove transition:** If `autoApprove: true`, treat [1] as selected and continue the dispatcher loop into the implementation phase (no skill switch required).
     - **Note:** For test-only specs (no production code changes), the impl phase is automatically skipped in autoApprove mode by the dispatcher.
